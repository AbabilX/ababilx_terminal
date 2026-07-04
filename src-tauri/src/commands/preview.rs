//! Backing for the frontend `see <file>` command: resolves the file against
//! the session shell's current directory and returns its bytes for an
//! in-app preview dialog (images, video, pdf, markdown).

use std::fs;
use std::path::PathBuf;

use base64::Engine;
use serde::Serialize;
use tauri::State;

use crate::pty::PtyManager;

/// Keeps the base64 IPC payload (and the webview blob) a sane size.
const MAX_PREVIEW_BYTES: u64 = 64 * 1024 * 1024;

#[derive(Serialize)]
pub struct PreviewFile {
    pub kind: String,
    pub mime: String,
    pub name: String,
    pub base64: String,
}

fn kind_for(ext: &str) -> Option<(&'static str, &'static str)> {
    Some(match ext {
        "png" => ("image", "image/png"),
        "jpg" | "jpeg" => ("image", "image/jpeg"),
        "gif" => ("image", "image/gif"),
        "webp" => ("image", "image/webp"),
        "bmp" => ("image", "image/bmp"),
        "avif" => ("image", "image/avif"),
        "svg" => ("image", "image/svg+xml"),
        "mp4" | "m4v" => ("video", "video/mp4"),
        "mov" => ("video", "video/quicktime"),
        "webm" => ("video", "video/webm"),
        "pdf" => ("pdf", "application/pdf"),
        "md" | "markdown" => ("markdown", "text/markdown"),
        _ => return None,
    })
}

/// Current working directory of a live process (the tab's shell).
fn process_cwd(pid: u32) -> Option<PathBuf> {
    #[cfg(target_os = "linux")]
    {
        if let Ok(p) = fs::read_link(format!("/proc/{pid}/cwd")) {
            return Some(p);
        }
    }
    // macOS (and lsof-equipped unix): `-Fn` prints the path as an `n` line.
    let out = std::process::Command::new("lsof")
        .args(["-a", "-p", &pid.to_string(), "-d", "cwd", "-Fn"])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    String::from_utf8_lossy(&out.stdout)
        .lines()
        .find_map(|l| l.strip_prefix('n').map(PathBuf::from))
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from)
}

#[tauri::command]
pub fn read_preview_file(
    manager: State<'_, PtyManager>,
    id: String,
    path: String,
) -> Result<PreviewFile, String> {
    let raw = path.trim().trim_matches('"').trim_matches('\'');
    if raw.is_empty() {
        return Err("usage: see <file>".into());
    }

    let mut resolved = if raw == "~" || raw.starts_with("~/") {
        let home = home_dir().ok_or("cannot find home directory")?;
        if raw == "~" {
            home
        } else {
            home.join(&raw[2..])
        }
    } else {
        PathBuf::from(raw)
    };
    if resolved.is_relative() {
        let cwd = manager
            .session_pid(&id)
            .and_then(process_cwd)
            .or_else(home_dir)
            .ok_or("cannot resolve the shell's current directory")?;
        resolved = cwd.join(resolved);
    }

    let ext = resolved
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    let (kind, mime) = kind_for(&ext).ok_or_else(|| {
        format!("unsupported type: .{ext} (images, video, pdf and markdown only)")
    })?;

    let meta = fs::metadata(&resolved).map_err(|e| format!("{}: {e}", resolved.display()))?;
    if !meta.is_file() {
        return Err(format!("{} is not a file", resolved.display()));
    }
    if meta.len() > MAX_PREVIEW_BYTES {
        return Err(format!(
            "file too large to preview ({} MB, max {} MB)",
            meta.len() / (1024 * 1024),
            MAX_PREVIEW_BYTES / (1024 * 1024)
        ));
    }

    let bytes = fs::read(&resolved).map_err(|e| format!("{}: {e}", resolved.display()))?;
    let name = resolved
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| raw.to_string());

    Ok(PreviewFile {
        kind: kind.into(),
        mime: mime.into(),
        name,
        base64: base64::engine::general_purpose::STANDARD.encode(bytes),
    })
}
