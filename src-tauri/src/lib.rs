mod commands;
mod pty;

use pty::PtyManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window.set_decorations(false)?;
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .manage(PtyManager::default())
        .manage(commands::session::SessionManager::default())
        .invoke_handler(tauri::generate_handler![
            commands::session::session_create,
            commands::session::session_run,
            commands::session::session_stdin,
            commands::session::session_cancel,
            commands::session::session_resize,
            commands::session::session_history,
            commands::session::session_close,
            commands::terminal::ping,
            commands::terminal::create_session,
            commands::terminal::write_to_session,
            commands::terminal::resize_session,
            commands::terminal::close_session,
            commands::settings::read_settings,
            commands::settings::open_settings,
            commands::preview::read_preview_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
