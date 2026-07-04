//! Executable resolution against the session's own PATH (not the OS
//! process's). Used by `which` and by launchers that want explicit paths.

use std::path::{Path, PathBuf};

use crate::state::ShellState;
use crate::traits::FileSystem;

/// Find `name` on the session PATH. Honors PATHEXT on Windows.
pub fn find_executable(name: &str, state: &ShellState, fs: &dyn FileSystem) -> Option<PathBuf> {
    // Explicit path (contains a separator): check directly.
    if name.contains(['/', '\\']) {
        let p = state.resolve(name);
        return candidates(&p).into_iter().find(|c| fs.exists(c));
    }

    let path_var = state.get_env("PATH")?.to_string();
    let sep = if cfg!(windows) { ';' } else { ':' };
    for dir in path_var.split(sep).filter(|d| !d.is_empty()) {
        let base = PathBuf::from(dir).join(name);
        if let Some(hit) = candidates(&base).into_iter().find(|c| fs.exists(c)) {
            return Some(hit);
        }
    }
    None
}

fn candidates(base: &Path) -> Vec<PathBuf> {
    if cfg!(windows) {
        let has_ext = base.extension().is_some();
        let mut v = Vec::new();
        if has_ext {
            v.push(base.to_path_buf());
        }
        for ext in ["exe", "cmd", "bat", "com"] {
            let mut p = base.to_path_buf().into_os_string();
            p.push(format!(".{ext}"));
            v.push(PathBuf::from(p));
        }
        if !has_ext {
            v.push(base.to_path_buf());
        }
        v
    } else {
        vec![base.to_path_buf()]
    }
}
