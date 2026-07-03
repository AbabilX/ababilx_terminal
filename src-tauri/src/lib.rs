mod commands;
mod pty;

use pty::PtyManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(PtyManager::default())
        .invoke_handler(tauri::generate_handler![
            commands::terminal::ping,
            commands::terminal::create_session,
            commands::terminal::write_to_session,
            commands::terminal::resize_session,
            commands::terminal::close_session,
            commands::settings::read_settings,
            commands::settings::open_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
