//! PTY-backed launcher for the interactive final stage: full terminal
//! semantics (colors, progress bars, TUI apps like vim), live resize,
//! keyboard stdin, Ctrl+C.
//!
//! Lifetime note: the session object is persistent (state, env, cwd,
//! history); the PTY pair currently lives per foreground command. EOF on the
//! PTY reader is the one fully reliable end-of-output signal ConPTY gives
//! us, which makes command/block boundaries exact. A pooled
//! persistent-per-session PTY is a contained optimization inside this
//! launcher later — the `ProcessLauncher` contract does not change.

use std::io::Read;
use std::sync::atomic::Ordering;
use std::sync::mpsc;
use std::time::Duration;

use ababil_runtime::traits::{ExecControl, OutputSink, ProcessSpec};
use ababil_runtime::{ProcessLauncher, RuntimeError};
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};

#[derive(Debug, Default, Clone, Copy)]
pub struct PtyLauncher;

/// ConPTY startup handshake: conhost sends a Device Status Report query
/// (`ESC[6n`) and blocks the client process until the "terminal" replies
/// with a cursor position. Headless (no renderer attached yet), the launcher
/// answers on the renderer's behalf and strips the query from the stream —
/// if a renderer also saw it, its duplicate reply would reach the child as
/// keyboard input.
#[derive(Default)]
struct QueryResponder {
    carry: Vec<u8>,
}

const DSR_QUERY: &[u8] = b"\x1b[6n";

impl QueryResponder {
    /// Returns the stream with DSR queries removed, plus how many were seen.
    /// A partial query at the end of a chunk is held back until more bytes
    /// arrive (queries can split across reads).
    fn scan(&mut self, data: &[u8]) -> (Vec<u8>, usize) {
        let mut buf = std::mem::take(&mut self.carry);
        buf.extend_from_slice(data);

        let mut out = Vec::with_capacity(buf.len());
        let mut queries = 0;
        let mut i = 0;
        while i < buf.len() {
            if buf[i..].starts_with(DSR_QUERY) {
                queries += 1;
                i += DSR_QUERY.len();
                continue;
            }
            // Hold back a trailing prefix of the query for the next chunk.
            let remaining = &buf[i..];
            if remaining.len() < DSR_QUERY.len() && DSR_QUERY.starts_with(remaining) {
                self.carry = remaining.to_vec();
                return (out, queries);
            }
            out.push(buf[i]);
            i += 1;
        }
        (out, queries)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn responds_to_dsr_and_strips_it() {
        let mut r = QueryResponder::default();
        let (out, q) = r.scan(b"\x1b[6nhello");
        assert_eq!(q, 1);
        assert_eq!(out, b"hello");
    }

    #[test]
    fn dsr_split_across_chunks() {
        let mut r = QueryResponder::default();
        let (out, q) = r.scan(b"abc\x1b[");
        assert_eq!(out, b"abc");
        assert_eq!(q, 0);
        let (out, q) = r.scan(b"6ndef");
        assert_eq!(q, 1);
        assert_eq!(out, b"def");
    }

    #[test]
    fn similar_sequences_pass_through() {
        let mut r = QueryResponder::default();
        let (out, q) = r.scan(b"\x1b[6m\x1b[0m");
        assert_eq!(q, 0);
        assert_eq!(out, b"\x1b[6m\x1b[0m");
    }
}

impl ProcessLauncher for PtyLauncher {
    fn run(
        &self,
        spec: &ProcessSpec,
        _stdin: Option<&[u8]>, // piped stdin never reaches the PTY path
        output: &mut dyn OutputSink,
        ctrl: &ExecControl,
    ) -> Result<i32, RuntimeError> {
        let launch_err = |message: String| RuntimeError::Launch {
            program: spec.program.clone(),
            message,
        };

        let (cols, rows) = *ctrl.size.lock().unwrap();
        let pty_system = NativePtySystem::default();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| launch_err(e.to_string()))?;

        let mut cmd = CommandBuilder::new(&spec.program);
        cmd.args(&spec.args);
        cmd.cwd(&spec.cwd);
        cmd.env_clear();
        for (k, v) in &spec.env {
            cmd.env(k, v);
        }

        let mut child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| launch_err(e.to_string()))?;
        drop(pair.slave);

        let mut writer = pair
            .master
            .take_writer()
            .map_err(|e| launch_err(e.to_string()))?;
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| launch_err(e.to_string()))?;

        let (tx, rx) = mpsc::channel::<Vec<u8>>();
        std::thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        if tx.send(buf[..n].to_vec()).is_err() {
                            break;
                        }
                    }
                }
            }
        });

        // Foreground process owns the keyboard for its lifetime.
        let stdin_rx = ctrl.stdin_rx.lock().unwrap().take();

        let mut responder = QueryResponder::default();

        let mut killed = false;
        let mut last_size = (cols, rows);
        // After the child exits the reader may only EOF once the master is
        // dropped (ConPTY). Drain until EOF or a quiet period, whichever
        // comes first.
        let mut exited_quiet: Option<std::time::Instant> = None;

        loop {
            if !killed && ctrl.cancel.load(Ordering::Relaxed) {
                let _ = child.kill();
                killed = true;
            }

            let size = *ctrl.size.lock().unwrap();
            if size != last_size {
                let _ = pair.master.resize(PtySize {
                    rows: size.1,
                    cols: size.0,
                    pixel_width: 0,
                    pixel_height: 0,
                });
                last_size = size;
            }

            if let Some(stdin_rx) = &stdin_rx {
                while let Ok(data) = stdin_rx.try_recv() {
                    use std::io::Write;
                    let _ = writer.write_all(&data);
                }
            }

            match rx.recv_timeout(Duration::from_millis(20)) {
                Ok(data) => {
                    let (filtered, dsr_queries) = responder.scan(&data);
                    if dsr_queries > 0 {
                        use std::io::Write;
                        for _ in 0..dsr_queries {
                            let _ = writer.write_all(b"\x1b[1;1R");
                        }
                        let _ = writer.flush();
                    }
                    if !filtered.is_empty() {
                        output.stdout(&filtered);
                    }
                    if exited_quiet.is_some() {
                        exited_quiet = Some(std::time::Instant::now());
                    }
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    // Reader EOF: no more output will ever arrive.
                    break;
                }
            }

            if exited_quiet.is_none() {
                if let Ok(Some(_)) = child.try_wait() {
                    exited_quiet = Some(std::time::Instant::now());
                }
            } else if exited_quiet.unwrap().elapsed() > Duration::from_millis(150) {
                break;
            }
        }

        let status = child.wait().map(|s| s.exit_code() as i32).unwrap_or(-1);
        drop(writer);
        drop(pair.master);
        if killed {
            return Ok(130);
        }
        Ok(status)
    }
}
