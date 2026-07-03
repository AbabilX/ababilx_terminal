use std::io::{Read, Write};
use std::sync::Mutex;
use std::thread;

use anyhow::Result;
use portable_pty::{Child, CommandBuilder, MasterPty, NativePtySystem, PtySize, PtySystem};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
struct PtyOutput {
    id: String,
    data: String,
}

pub struct PtySession {
    master: Mutex<Box<dyn MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
    child: Mutex<Box<dyn Child + Send + Sync>>,
}

impl PtySession {
    pub fn spawn(
        app: AppHandle,
        id: String,
        cols: u16,
        rows: u16,
        program: Option<String>,
        args: Vec<String>,
    ) -> Result<Self> {
        let pty_system = NativePtySystem::default();
        let pair = pty_system.openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let shell = program.unwrap_or_else(default_shell);
        let mut cmd = CommandBuilder::new(shell);
        cmd.args(args);
        if let Some(home) = dirs_home() {
            cmd.cwd(home);
        }

        let child = pair.slave.spawn_command(cmd)?;
        drop(pair.slave);

        let writer = pair.master.take_writer()?;
        let mut reader = pair.master.try_clone_reader()?;

        // Reader thread: forward PTY output to the frontend until EOF.
        let event_id = id.clone();
        thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app.emit(
                            "pty-output",
                            PtyOutput {
                                id: event_id.clone(),
                                data,
                            },
                        );
                    }
                }
            }
            let _ = app.emit("pty-exit", event_id.clone());
        });

        Ok(Self {
            master: Mutex::new(pair.master),
            writer: Mutex::new(writer),
            child: Mutex::new(child),
        })
    }

    pub fn write(&self, data: &str) -> Result<()> {
        let mut writer = self.writer.lock().unwrap();
        writer.write_all(data.as_bytes())?;
        writer.flush()?;
        Ok(())
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<()> {
        self.master.lock().unwrap().resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;
        Ok(())
    }

    pub fn kill(&self) {
        let _ = self.child.lock().unwrap().kill();
    }
}

fn default_shell() -> String {
    if cfg!(windows) {
        // Prefer PowerShell 7 if installed, otherwise Windows PowerShell.
        if which("pwsh.exe") {
            "pwsh.exe".into()
        } else {
            "powershell.exe".into()
        }
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into())
    }
}

fn which(exe: &str) -> bool {
    std::env::var_os("PATH")
        .map(|paths| {
            std::env::split_paths(&paths).any(|dir| dir.join(exe).is_file())
        })
        .unwrap_or(false)
}

fn dirs_home() -> Option<std::path::PathBuf> {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
        .map(std::path::PathBuf::from)
}
