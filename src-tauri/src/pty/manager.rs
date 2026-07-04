use std::collections::HashMap;
use std::sync::Mutex;

use anyhow::Result;
use tauri::AppHandle;

use super::session::PtySession;

#[derive(Default)]
pub struct PtyManager {
    sessions: Mutex<HashMap<String, PtySession>>,
}

impl PtyManager {
    pub fn create(&self, app: AppHandle, id: String, cols: u16, rows: u16) -> Result<()> {
        let (program, args) = crate::commands::settings::shell_config(&app);
        let session = PtySession::spawn(app, id.clone(), cols, rows, program, args)?;
        self.sessions.lock().unwrap().insert(id, session);
        Ok(())
    }

    pub fn write(&self, id: &str, data: &str) -> Result<()> {
        match self.sessions.lock().unwrap().get(id) {
            Some(session) => session.write(data),
            None => anyhow::bail!("no session with id {id}"),
        }
    }

    pub fn resize(&self, id: &str, cols: u16, rows: u16) -> Result<()> {
        match self.sessions.lock().unwrap().get(id) {
            Some(session) => session.resize(cols, rows),
            None => anyhow::bail!("no session with id {id}"),
        }
    }

    pub fn session_pid(&self, id: &str) -> Option<u32> {
        self.sessions.lock().unwrap().get(id).and_then(|s| s.pid())
    }

    pub fn close(&self, id: &str) {
        if let Some(session) = self.sessions.lock().unwrap().remove(id) {
            session.kill();
        }
    }
}
