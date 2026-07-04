//! Stable interfaces between subsystems. Everything above the runtime talks
//! to these traits, never to concrete implementations — a remote/SSH
//! filesystem or a PTY-backed launcher plugs in without touching the runtime.

use std::collections::HashMap;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::{mpsc, Arc, Mutex};

use crate::error::RuntimeError;

/// Filesystem abstraction. v1 ships [`crate::fs::RealFs`]; future: SSH,
/// virtual workspaces, in-memory test fs.
pub trait FileSystem: Send + Sync {
    fn read(&self, path: &Path) -> io::Result<Vec<u8>>;
    /// `append: false` truncates/creates; `append: true` appends/creates.
    fn write(&self, path: &Path, data: &[u8], append: bool) -> io::Result<()>;
    fn read_dir(&self, path: &Path) -> io::Result<Vec<DirEntry>>;
    fn metadata(&self, path: &Path) -> io::Result<FileMeta>;
    fn create_dir(&self, path: &Path) -> io::Result<()>;
    fn remove(&self, path: &Path) -> io::Result<()>;
    /// Rename/move a path. May fail across filesystems (EXDEV); callers that
    /// need cross-device moves fall back to copy+remove.
    fn rename(&self, from: &Path, to: &Path) -> io::Result<()>;
    fn canonicalize(&self, path: &Path) -> io::Result<PathBuf>;
    fn exists(&self, path: &Path) -> bool;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DirEntry {
    pub name: String,
    pub is_dir: bool,
    pub len: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FileMeta {
    pub is_dir: bool,
    pub len: u64,
}

/// How external executables are started. AbabilX never depends on
/// PowerShell/CMD/Bash for shell semantics; implementations call OS process
/// APIs directly. Output streams to `output` incrementally; the launcher
/// returns the exit status when the process finishes. `ababil-exec` ships a
/// buffered pipe launcher (pipeline stages) and a PTY launcher
/// (interactive/TUI, colors, resize).
pub trait ProcessLauncher: Send + Sync {
    fn run(
        &self,
        spec: &ProcessSpec,
        stdin: Option<&[u8]>,
        output: &mut dyn OutputSink,
        ctrl: &ExecControl,
    ) -> Result<i32, RuntimeError>;
}

/// Live control surface for a running evaluation: cancellation (Ctrl+C),
/// interactive stdin, and terminal size. Created per command-line evaluation
/// by the session layer; launchers observe it while a process runs.
pub struct ExecControl {
    /// Set to request cancellation; launchers kill the active process.
    pub cancel: Arc<AtomicBool>,
    /// Interactive keystrokes for the active process. Taken (once) by the
    /// launcher of the foreground process.
    pub stdin_rx: Mutex<Option<mpsc::Receiver<Vec<u8>>>>,
    /// Current terminal size (cols, rows); PTY launchers poll and apply.
    pub size: Arc<Mutex<(u16, u16)>>,
    /// True when the evaluation is attached to a live terminal, allowing the
    /// runtime to pick an interactive (PTY) launcher for the final stage.
    pub interactive: bool,
}

impl ExecControl {
    /// No cancellation, no stdin, default size. For tests and one-shot evals.
    pub fn detached() -> Self {
        Self {
            cancel: Arc::new(AtomicBool::new(false)),
            stdin_rx: Mutex::new(None),
            size: Arc::new(Mutex::new((80, 24))),
            interactive: false,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ProcessSpec {
    pub program: String,
    pub args: Vec<String>,
    pub cwd: PathBuf,
    /// The session's own environment — the child sees exactly this.
    pub env: HashMap<String, String>,
}

/// Where command output goes. The renderer implements this; tests capture it.
pub trait OutputSink {
    fn stdout(&mut self, data: &[u8]);
    fn stderr(&mut self, data: &[u8]);
}

/// In-memory sink, used for pipeline intermediates and tests.
#[derive(Debug, Default)]
pub struct CaptureSink {
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

impl OutputSink for CaptureSink {
    fn stdout(&mut self, data: &[u8]) {
        self.stdout.extend_from_slice(data);
    }
    fn stderr(&mut self, data: &[u8]) {
        self.stderr.extend_from_slice(data);
    }
}

impl CaptureSink {
    pub fn stdout_string(&self) -> String {
        String::from_utf8_lossy(&self.stdout).into_owned()
    }
    pub fn stderr_string(&self) -> String {
        String::from_utf8_lossy(&self.stderr).into_owned()
    }
}

/// Plugin hook points, reserved from day 1. Implementations arrive in a later
/// phase; the runtime already dispatches [`Plugin::on_command`].
pub trait Plugin: Send + Sync {
    fn name(&self) -> &str;
    /// Fired after each simple command finishes.
    fn on_command(&self, _event: &CommandEvent) {}
    /// Fired when a block is (re)rendered. Dispatched by the renderer layer.
    fn on_render(&self, _event: &RenderEvent) {}
    /// Fired on workspace lifecycle changes. Dispatched by the workspace layer.
    fn on_workspace(&self, _event: &WorkspaceEvent) {}
}

#[derive(Debug, Clone)]
pub struct CommandEvent {
    pub argv: Vec<String>,
    pub status: i32,
    pub cwd: PathBuf,
}

#[derive(Debug, Clone)]
pub struct RenderEvent {
    pub block_id: String,
}

#[derive(Debug, Clone)]
pub struct WorkspaceEvent {
    pub kind: String,
}
