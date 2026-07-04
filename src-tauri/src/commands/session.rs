//! IPC surface for AbabilX terminal sessions. The frontend calls these
//! commands and consumes `ababilx://shell-event` events; it never sees
//! processes, PTYs or the shell directly.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use ababil_session::{EventSink, SessionCapabilities, ShellEvent, TerminalSession};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

pub const SHELL_EVENT: &str = "shell-event";

#[derive(Default)]
pub struct SessionManager {
    sessions: Mutex<HashMap<String, Arc<TerminalSession>>>,
}

/// Forwards session events to the WebView, tagged with the session id.
struct TauriEventSink {
    app: AppHandle,
    session_id: String,
}

#[derive(Serialize, Clone)]
struct EventEnvelope<'a> {
    session_id: &'a str,
    #[serde(flatten)]
    event: &'a ShellEvent,
}

impl EventSink for TauriEventSink {
    fn emit(&self, event: ShellEvent) {
        let _ = self.app.emit(
            SHELL_EVENT,
            EventEnvelope {
                session_id: &self.session_id,
                event: &event,
            },
        );
    }
}

#[derive(Serialize)]
pub struct SessionInfo {
    pub cwd: String,
    pub capabilities: SessionCapabilities,
}

fn get(manager: &State<SessionManager>, id: &str) -> Result<Arc<TerminalSession>, String> {
    manager
        .sessions
        .lock()
        .map_err(|e| e.to_string())?
        .get(id)
        .cloned()
        .ok_or_else(|| format!("no session: {id}"))
}

#[tauri::command]
pub fn session_create(
    app: AppHandle,
    manager: State<SessionManager>,
    id: String,
) -> Result<SessionInfo, String> {
    let sink = Arc::new(TauriEventSink {
        app,
        session_id: id.clone(),
    });
    let session = Arc::new(TerminalSession::new(sink));
    let info = SessionInfo {
        cwd: session.cwd(),
        capabilities: session.capabilities(),
    };
    manager
        .sessions
        .lock()
        .map_err(|e| e.to_string())?
        .insert(id, session);
    Ok(info)
}

#[tauri::command]
pub fn session_run(manager: State<SessionManager>, id: String, line: String) -> Result<u64, String> {
    get(&manager, &id)?.run_line(line)
}

#[tauri::command]
pub fn session_stdin(manager: State<SessionManager>, id: String, data: String) -> Result<(), String> {
    get(&manager, &id)?.write_stdin(data.into_bytes())
}

#[tauri::command]
pub fn session_cancel(manager: State<SessionManager>, id: String) -> Result<(), String> {
    get(&manager, &id)?.cancel();
    Ok(())
}

#[tauri::command]
pub fn session_resize(
    manager: State<SessionManager>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    get(&manager, &id)?.resize(cols, rows);
    Ok(())
}

#[tauri::command]
pub fn session_history(manager: State<SessionManager>, id: String) -> Result<Vec<String>, String> {
    Ok(get(&manager, &id)?.history())
}

#[tauri::command]
pub fn session_close(manager: State<SessionManager>, id: String) -> Result<(), String> {
    let session = {
        let mut sessions = manager.sessions.lock().map_err(|e| e.to_string())?;
        sessions.remove(&id)
    };
    if let Some(session) = session {
        session.cancel(); // stop any foreground process
    }
    Ok(())
}
