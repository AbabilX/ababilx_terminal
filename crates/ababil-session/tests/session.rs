use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use ababil_session::{EventSink, ShellEvent, TerminalSession};

#[derive(Default)]
struct CollectSink {
    events: Mutex<Vec<ShellEvent>>,
}

impl EventSink for CollectSink {
    fn emit(&self, event: ShellEvent) {
        self.events.lock().unwrap().push(event);
    }
}

/// A ~1s-per-echo ping to `count` packets, spelled for the host OS: Windows
/// counts with `-n`, macOS/Linux with `-c` (where `-n` means numeric).
fn ping(count: u32) -> String {
    let flag = if cfg!(windows) { "-n" } else { "-c" };
    format!("ping {flag} {count} 127.0.0.1")
}

impl CollectSink {
    fn snapshot(&self) -> Vec<ShellEvent> {
        self.events.lock().unwrap().clone()
    }
}

fn wait_idle(session: &TerminalSession, timeout: Duration) {
    let deadline = Instant::now() + timeout;
    while session.is_busy() {
        assert!(Instant::now() < deadline, "session did not finish in time");
        std::thread::sleep(Duration::from_millis(10));
    }
}

#[test]
fn event_flow_for_builtin() {
    let sink = Arc::new(CollectSink::default());
    let session = Arc::new(TerminalSession::new(sink.clone()));

    let id = session.run_line("echo streaming".into()).unwrap();
    wait_idle(&session, Duration::from_secs(5));

    let events = sink.snapshot();
    assert!(matches!(
        &events[0],
        ShellEvent::CommandStarted { id: got, line } if *got == id && line == "echo streaming"
    ));
    assert!(events
        .iter()
        .any(|e| matches!(e, ShellEvent::Stdout { data } if data.contains("streaming"))));
    assert!(matches!(
        events.last().unwrap(),
        ShellEvent::CommandFinished { id: got, status: 0, .. } if *got == id
    ));
}

#[test]
fn busy_session_rejects_second_command() {
    let sink = Arc::new(CollectSink::default());
    let session = Arc::new(TerminalSession::new(sink.clone()));

    // ping with count 3 takes ~2s; second run_line must be rejected.
    session.run_line(ping(3)).unwrap();
    std::thread::sleep(Duration::from_millis(200));
    assert!(session.run_line("echo nope".into()).is_err());
    wait_idle(&session, Duration::from_secs(15));
}

#[test]
fn cancel_kills_foreground_process() {
    let sink = Arc::new(CollectSink::default());
    let session = Arc::new(TerminalSession::new(sink.clone()));

    let started = Instant::now();
    session.run_line(ping(30)).unwrap();
    std::thread::sleep(Duration::from_millis(500));
    session.cancel();
    wait_idle(&session, Duration::from_secs(10));
    assert!(
        started.elapsed() < Duration::from_secs(10),
        "cancel did not stop the process"
    );

    let events = sink.snapshot();
    assert!(matches!(
        events.last().unwrap(),
        ShellEvent::CommandFinished { status, .. } if *status != 0
    ));
}

#[test]
fn cwd_and_clear_and_exit_events() {
    let sink = Arc::new(CollectSink::default());
    let session = Arc::new(TerminalSession::new(sink.clone()));

    session.run_line("cd ..".into()).unwrap();
    wait_idle(&session, Duration::from_secs(5));
    assert!(sink
        .snapshot()
        .iter()
        .any(|e| matches!(e, ShellEvent::CwdChanged { .. })));

    session.run_line("clear".into()).unwrap();
    wait_idle(&session, Duration::from_secs(5));
    assert!(sink.snapshot().iter().any(|e| matches!(e, ShellEvent::Clear)));

    session.run_line("exit 0".into()).unwrap();
    wait_idle(&session, Duration::from_secs(5));
    assert!(sink
        .snapshot()
        .iter()
        .any(|e| matches!(e, ShellEvent::SessionExited { code: 0 })));
}

#[cfg(windows)]
#[test]
fn external_streams_incrementally() {
    let sink = Arc::new(CollectSink::default());
    let session = Arc::new(TerminalSession::new(sink.clone()));

    // Two pings a second apart: output must arrive in more than one
    // Stdout event if streaming works.
    session.run_line(ping(2)).unwrap();
    wait_idle(&session, Duration::from_secs(15));

    let events = sink.snapshot();
    let stdout_chunks = events
        .iter()
        .filter(|e| matches!(e, ShellEvent::Stdout { .. }))
        .count();
    assert!(
        stdout_chunks >= 2,
        "expected incremental output, got {stdout_chunks} chunk(s)"
    );
    assert!(matches!(
        events.last().unwrap(),
        ShellEvent::CommandFinished { status: 0, .. }
    ));
}
