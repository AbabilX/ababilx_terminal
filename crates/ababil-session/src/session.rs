//! Session runtime: owns the shell, the active foreground process controls
//! and the event stream. One instance per pane; methods are called from any
//! thread (IPC handlers), evaluation runs on a worker thread.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::time::Instant;

use ababil_exec::{NativeLauncher, PtyLauncher};
use ababil_runtime::fs::RealFs;
use ababil_runtime::traits::ExecControl;
use ababil_runtime::{Effect, OutputSink, Runtime};
use ababil_shell::Session;

use crate::events::{EventSink, SessionCapabilities, ShellEvent};

pub struct TerminalSession {
    shell: Mutex<Session>,
    events: Arc<dyn EventSink>,
    caps: SessionCapabilities,
    size: Arc<Mutex<(u16, u16)>>,
    active: Mutex<Option<ActiveRun>>,
    next_id: AtomicU64,
    busy: Arc<AtomicBool>,
}

struct ActiveRun {
    cancel: Arc<AtomicBool>,
    stdin_tx: mpsc::Sender<Vec<u8>>,
}

impl TerminalSession {
    pub fn new(events: Arc<dyn EventSink>) -> Self {
        let runtime = Runtime::new(Arc::new(RealFs), Arc::new(NativeLauncher))
            .with_interactive_launcher(Arc::new(PtyLauncher));
        Self {
            shell: Mutex::new(Session::new(runtime)),
            events,
            caps: SessionCapabilities::default(),
            size: Arc::new(Mutex::new((80, 24))),
            active: Mutex::new(None),
            next_id: AtomicU64::new(1),
            busy: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn capabilities(&self) -> SessionCapabilities {
        self.caps
    }

    pub fn cwd(&self) -> String {
        self.shell
            .lock()
            .map(|s| s.state().cwd.display().to_string())
            .unwrap_or_default()
    }

    pub fn history(&self) -> Vec<String> {
        self.shell
            .lock()
            .map(|s| s.state().history.clone())
            .unwrap_or_default()
    }

    pub fn is_busy(&self) -> bool {
        self.busy.load(Ordering::Acquire)
    }

    /// Start evaluating one submitted line on a worker thread. Events flow to
    /// the sink; returns the command id that will appear in
    /// `CommandStarted`/`CommandFinished`. One foreground command at a time.
    pub fn run_line(self: &Arc<Self>, line: String) -> Result<u64, String> {
        if self
            .busy
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_err()
        {
            return Err("session is busy running a command".into());
        }

        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let cancel = Arc::new(AtomicBool::new(false));
        let (stdin_tx, stdin_rx) = mpsc::channel::<Vec<u8>>();
        *self.active.lock().unwrap() = Some(ActiveRun {
            cancel: cancel.clone(),
            stdin_tx,
        });

        let ctrl = ExecControl {
            cancel,
            stdin_rx: Mutex::new(Some(stdin_rx)),
            size: self.size.clone(),
            interactive: self.caps.supports_tui,
        };

        let session = self.clone();
        std::thread::spawn(move || {
            // Whatever happens (including a panic below), the session must
            // return to idle and drop the active controls.
            struct IdleGuard(Arc<TerminalSession>);
            impl Drop for IdleGuard {
                fn drop(&mut self) {
                    *self.0.active.lock().unwrap() = None;
                    self.0.busy.store(false, Ordering::Release);
                }
            }
            let _guard = IdleGuard(session.clone());

            session.events.emit(ShellEvent::CommandStarted {
                id,
                line: line.clone(),
            });
            let started = Instant::now();

            let (status, effects) = {
                let mut shell = session.shell.lock().unwrap();
                let mut sink = EventOutputSink::new(session.events.clone());
                let result = shell.eval_with(&line, &mut sink, &ctrl);
                sink.flush();
                (result.status, result.effects)
            };

            let cwd = session.cwd();
            for effect in &effects {
                match effect {
                    Effect::ClearScreen => session.events.emit(ShellEvent::Clear),
                    Effect::CwdChanged(path) => session.events.emit(ShellEvent::CwdChanged {
                        cwd: path.display().to_string(),
                    }),
                    Effect::Exit(_) => {}
                }
            }

            session.events.emit(ShellEvent::CommandFinished {
                id,
                status,
                duration_ms: started.elapsed().as_millis() as u64,
                cwd,
            });

            if let Some(Effect::Exit(code)) =
                effects.iter().find(|e| matches!(e, Effect::Exit(_)))
            {
                session.events.emit(ShellEvent::SessionExited { code: *code });
            }
        });

        Ok(id)
    }

    /// Keyboard input for the foreground process (interactive programs).
    pub fn write_stdin(&self, data: Vec<u8>) -> Result<(), String> {
        let active = self.active.lock().unwrap();
        match active.as_ref() {
            Some(run) => run.stdin_tx.send(data).map_err(|_| "process ended".into()),
            None => Err("no foreground process".into()),
        }
    }

    /// Ctrl+C: request cancellation of the foreground command.
    pub fn cancel(&self) {
        if let Some(run) = self.active.lock().unwrap().as_ref() {
            run.cancel.store(true, Ordering::Relaxed);
        }
    }

    /// Terminal size changed; applies live to the foreground PTY.
    pub fn resize(&self, cols: u16, rows: u16) {
        *self.size.lock().unwrap() = (cols, rows);
    }
}

/// Bridges `OutputSink` to `ShellEvent`s, re-assembling UTF-8 code points
/// split across raw chunks so the frontend always receives valid strings.
struct EventOutputSink {
    events: Arc<dyn EventSink>,
    out_carry: Vec<u8>,
    err_carry: Vec<u8>,
}

impl EventOutputSink {
    fn new(events: Arc<dyn EventSink>) -> Self {
        Self {
            events,
            out_carry: Vec::new(),
            err_carry: Vec::new(),
        }
    }

    fn decode(carry: &mut Vec<u8>, data: &[u8]) -> Option<String> {
        carry.extend_from_slice(data);
        let valid_len = match std::str::from_utf8(carry) {
            Ok(_) => carry.len(),
            Err(e) => e.valid_up_to(),
        };
        // Keep at most 3 trailing bytes as a partial code point; anything
        // longer is genuinely invalid — pass it through lossily.
        if carry.len() - valid_len > 3 {
            let text = String::from_utf8_lossy(carry).into_owned();
            carry.clear();
            return Some(text);
        }
        if valid_len == 0 {
            return None;
        }
        let rest = carry.split_off(valid_len);
        let text = String::from_utf8(std::mem::replace(carry, rest)).expect("validated prefix");
        Some(text)
    }

    fn flush(&mut self) {
        if !self.out_carry.is_empty() {
            let text = String::from_utf8_lossy(&self.out_carry).into_owned();
            self.out_carry.clear();
            self.events.emit(ShellEvent::Stdout { data: text });
        }
        if !self.err_carry.is_empty() {
            let text = String::from_utf8_lossy(&self.err_carry).into_owned();
            self.err_carry.clear();
            self.events.emit(ShellEvent::Stderr { data: text });
        }
    }
}

impl OutputSink for EventOutputSink {
    fn stdout(&mut self, data: &[u8]) {
        if let Some(text) = Self::decode(&mut self.out_carry, data) {
            self.events.emit(ShellEvent::Stdout { data: text });
        }
    }
    fn stderr(&mut self, data: &[u8]) {
        if let Some(text) = Self::decode(&mut self.err_carry, data) {
            self.events.emit(ShellEvent::Stderr { data: text });
        }
    }
}
