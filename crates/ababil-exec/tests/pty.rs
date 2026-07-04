use std::collections::HashMap;
use std::time::Instant;

use ababil_exec::PtyLauncher;
use ababil_runtime::traits::{CaptureSink, ExecControl, ProcessSpec};
use ababil_runtime::ProcessLauncher;

#[cfg(windows)]
#[test]
fn pty_runs_and_exits() {
    let spec = ProcessSpec {
        program: r"C:\Windows\System32\where.exe".into(),
        args: vec!["ping".into()],
        cwd: std::env::temp_dir(),
        env: std::env::vars().collect::<HashMap<_, _>>(),
    };
    let ctrl = ExecControl::detached();
    let mut sink = CaptureSink::default();
    let started = Instant::now();
    let status = PtyLauncher.run(&spec, None, &mut sink, &ctrl).unwrap();
    eprintln!(
        "status={status} elapsed={:?} out={:?}",
        started.elapsed(),
        sink.stdout_string()
    );
    assert_eq!(status, 0);
    assert!(sink.stdout_string().to_lowercase().contains("ping"));
    assert!(started.elapsed().as_secs() < 10);
}
