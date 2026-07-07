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
                let blur = commands::settings::blur_radius(app.handle());
                if blur > 0.0 {
                    #[cfg(target_os = "macos")]
                    let _ = window_vibrancy::apply_vibrancy(
                        &window,
                        window_vibrancy::NSVisualEffectMaterial::HudWindow,
                        None,
                        Some(16.0),
                    );
                    #[cfg(target_os = "windows")]
                    let _ = window_vibrancy::apply_acrylic(&window, Some((18, 18, 18, 125)));
                }
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
            commands::settings::write_settings,
            commands::settings::open_settings,
            commands::preview::read_preview_file,
            commands::terminal::list_dir,
            commands::update::get_platform
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
