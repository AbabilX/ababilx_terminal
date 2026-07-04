use std::io::{Read, Write};
use std::process::{Command, Stdio};
use std::sync::atomic::Ordering;
use std::sync::mpsc;
use std::time::Duration;

use ababil_runtime::traits::{ExecControl, OutputSink, ProcessSpec};
use ababil_runtime::{ProcessLauncher, RuntimeError};

/// Pipe-based launcher over `std::process`. Streams stdout/stderr to the
/// sink as the process runs and honors cancellation. Used for pipeline
/// stages and redirected output; interactive programs go through
/// [`crate::PtyLauncher`]. The child inherits the *session's* environment
/// map, not the host process environment.
#[derive(Debug, Default, Clone, Copy)]
pub struct NativeLauncher;

enum Chunk {
    Stdout(Vec<u8>),
    Stderr(Vec<u8>),
}

impl ProcessLauncher for NativeLauncher {
    fn run(
        &self,
        spec: &ProcessSpec,
        stdin: Option<&[u8]>,
        output: &mut dyn OutputSink,
        ctrl: &ExecControl,
    ) -> Result<i32, RuntimeError> {
        let mut cmd = Command::new(&spec.program);
        cmd.args(&spec.args)
            .current_dir(&spec.cwd)
            .env_clear()
            .envs(&spec.env)
            .stdin(if stdin.is_some() { Stdio::piped() } else { Stdio::null() })
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            // CREATE_NO_WINDOW: no console window may ever flash into view.
            cmd.creation_flags(0x0800_0000);
        }

        let launch_err = |e: std::io::Error| RuntimeError::Launch {
            program: spec.program.clone(),
            message: e.to_string(),
        };
        let mut child = cmd.spawn().map_err(launch_err)?;

        // Writer thread: child may exit without reading stdin (broken pipe is
        // fine); writing on this thread could deadlock against full pipes.
        if let Some(data) = stdin {
            if let Some(mut handle) = child.stdin.take() {
                let data = data.to_vec();
                std::thread::spawn(move || {
                    let _ = handle.write_all(&data);
                });
            }
        }

        let (tx, rx) = mpsc::channel::<Chunk>();
        let mut readers = 0;
        if let Some(out) = child.stdout.take() {
            readers += 1;
            spawn_reader(out, tx.clone(), Chunk::Stdout);
        }
        if let Some(err) = child.stderr.take() {
            readers += 1;
            spawn_reader(err, tx.clone(), Chunk::Stderr);
        }
        drop(tx);

        let mut killed = false;
        let mut closed = readers == 0;
        loop {
            if !killed && ctrl.cancel.load(Ordering::Relaxed) {
                let _ = child.kill();
                killed = true;
            }
            if closed {
                break;
            }
            match rx.recv_timeout(Duration::from_millis(30)) {
                Ok(Chunk::Stdout(data)) => output.stdout(&data),
                Ok(Chunk::Stderr(data)) => output.stderr(&data),
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(mpsc::RecvTimeoutError::Disconnected) => closed = true,
            }
        }

        let status = child.wait().map_err(launch_err)?;
        if killed {
            return Ok(130); // interrupted, shell convention
        }
        Ok(status.code().unwrap_or(-1))
    }
}

fn spawn_reader<R: Read + Send + 'static>(
    mut reader: R,
    tx: mpsc::Sender<Chunk>,
    wrap: fn(Vec<u8>) -> Chunk,
) {
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    if tx.send(wrap(buf[..n].to_vec())).is_err() {
                        break;
                    }
                }
            }
        }
    });
}
