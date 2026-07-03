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
