use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::pty::PtyManager;

#[tauri::command]
pub fn ping() -> String {
    "pong".to_string()
}

#[tauri::command]
pub fn create_session(
    app: AppHandle,
    manager: State<'_, PtyManager>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    manager
        .create(app, id, cols, rows)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_to_session(
    manager: State<'_, PtyManager>,
    id: String,
    data: String,
) -> Result<(), String> {
    manager.write(&id, &data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn resize_session(
    manager: State<'_, PtyManager>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    manager.resize(&id, cols, rows).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn close_session(manager: State<'_, PtyManager>, id: String) {
    manager.close(&id);
}

/// A single directory entry returned by [`list_dir`].
#[derive(Debug, Clone, Serialize)]
pub struct DirEntry {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
}

/// Lists the contents of `path` using `std::fs` — no OS shell involved.
/// Returns entries sorted: directories first (alphabetically), then files
/// (alphabetically). Dot-files are included so callers can filter as needed.
/// Tilde (`~`) in the path is expanded to the user home directory.
#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let expanded = expand_tilde(&path);
    let read = std::fs::read_dir(&expanded).map_err(|e| format!("{path}: {e}"))?;

    let mut entries: Vec<DirEntry> = read
        .filter_map(|res| {
            let entry = res.ok()?;
            let meta = entry.metadata().ok()?;
            Some(DirEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                is_dir: meta.is_dir(),
                size: if meta.is_dir() { 0 } else { meta.len() },
            })
        })
        .collect();

    // Dirs first, then files; each group alphabetically (case-insensitive).
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

fn expand_tilde(path: &str) -> PathBuf {
    if path == "~" || path.starts_with("~/") || path.starts_with("~\\") {
        let home = std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."));
        if path == "~" {
            home
        } else {
            // Skip the `~/` or `~\` prefix.
            home.join(&path[2..])
        }
    } else {
        PathBuf::from(path)
    }
}
