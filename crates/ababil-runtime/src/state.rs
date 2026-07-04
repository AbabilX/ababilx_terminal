//! Session-owned shell state. AbabilX implements its own cwd, environment,
//! aliases and history — the OS process environment only seeds the initial
//! values.

use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct ShellState {
    pub cwd: PathBuf,
    /// Previous cwd, for `cd -`.
    pub prev_cwd: Option<PathBuf>,
    pub env: HashMap<String, String>,
    pub aliases: HashMap<String, String>,
    pub history: Vec<String>,
    pub last_status: i32,
}

impl ShellState {
    /// Seed from the host process: OS environment + current directory.
    pub fn from_os() -> Self {
        Self {
            cwd: std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
            prev_cwd: None,
            env: std::env::vars().collect(),
            aliases: HashMap::new(),
            history: Vec::new(),
            last_status: 0,
        }
    }

    /// Empty state rooted at `cwd` — used by tests.
    pub fn new_at(cwd: PathBuf) -> Self {
        Self {
            cwd,
            prev_cwd: None,
            env: HashMap::new(),
            aliases: HashMap::new(),
            history: Vec::new(),
            last_status: 0,
        }
    }

    /// Environment lookup. Case-insensitive on Windows (`PATH` == `Path`),
    /// case-sensitive elsewhere.
    pub fn get_env(&self, name: &str) -> Option<&str> {
        if let Some(v) = self.env.get(name) {
            return Some(v);
        }
        if cfg!(windows) {
            self.env
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case(name))
                .map(|(_, v)| v.as_str())
        } else {
            None
        }
    }

    pub fn home_dir(&self) -> Option<PathBuf> {
        self.get_env("HOME")
            .or_else(|| self.get_env("USERPROFILE"))
            .map(PathBuf::from)
    }

    /// Resolve a possibly-relative path against the session cwd.
    pub fn resolve(&self, path: &str) -> PathBuf {
        let p = PathBuf::from(path);
        if p.is_absolute() {
            p
        } else {
            self.cwd.join(p)
        }
    }
}
