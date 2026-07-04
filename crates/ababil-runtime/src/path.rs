//! Executable resolution against the session's own PATH (not the OS
//! process's). Used by `which` and by launchers that want explicit paths.

use std::path::PathBuf;

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

fn candidates(base: &PathBuf) -> Vec<PathBuf> {
    if cfg!(windows) {
        let has_ext = base.extension().is_some();
        let mut v = Vec::new();
        if has_ext {
            v.push(base.clone());
        }
        for ext in ["exe", "cmd", "bat", "com"] {
            let mut p = base.clone().into_os_string();
            p.push(format!(".{ext}"));
            v.push(PathBuf::from(p));
        }
        if !has_ext {
            v.push(base.clone());
        }
        v
    } else {
        vec![base.clone()]
    }
}
