use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

const DEFAULT_SETTINGS: &str = r##"{
  "shell": {
    "program": "auto",
    "args": __SHELL_ARGS__
  },
  "appearance": {
    "theme": "dark",
    "background": "#0d1117",
    "opacity": 0.94,
    "blur": 24
  },
  "terminal": {
    "fontFamily": "JetBrains Mono, Consolas, monospace, 'Purno Pran Unicode'",
    "fontSize": 14,
    "cursorStyle": "block",
    "cursorBlink": true,
    "lineHeight": 1.2
  },
  "keybindings": {
    "newTab": "ctrl+t",
    "splitRight": "ctrl+\\",
    "closeTab": "ctrl+w",
    "settings": "ctrl+,"
  }
}
"##;

/// Windows PowerShell flags; on unix the shell runs as a login shell instead.
const WINDOWS_SHELL_ARGS: [&str; 2] = ["-NoLogo", "-NoProfile"];

fn default_shell_args() -> Vec<String> {
    if cfg!(windows) {
        WINDOWS_SHELL_ARGS.iter().map(|s| s.to_string()).collect()
    } else {
        vec!["-l".into()]
    }
}

fn default_settings() -> String {
    let args = serde_json::to_string(&default_shell_args()).unwrap_or_else(|_| "[]".into());
    DEFAULT_SETTINGS.replace("__SHELL_ARGS__", &args)
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("settings.json"))
}

const LEGACY_FONT_FAMILY: &str = "JetBrains Mono, Consolas, monospace";
const FONT_FAMILY: &str = "JetBrains Mono, Consolas, monospace, 'Purno Pran Unicode'";

/// Old `terminal.fontFamily` values from before/during the bangla font
/// bundle; migrated to `FONT_FAMILY` verbatim (exact match only — these
/// must never overlap as substrings of each other or of `FONT_FAMILY`,
/// otherwise repeated migration passes compound instead of settling).
const RETIRED_FONT_FAMILIES: [&str; 2] = [
    LEGACY_FONT_FAMILY,
    // Short-lived build: bangla fallback listed 2nd, so browsers without
    // "JetBrains Mono" installed skipped straight to it for every
    // character, not just bangla.
    "JetBrains Mono, 'Purno Pran Unicode', Consolas, monospace",
];

fn ensure_settings(app: &AppHandle) -> Result<PathBuf, String> {
    let path = settings_path(app)?;
    if !path.exists() {
        fs::write(&path, default_settings()).map_err(|e| e.to_string())?;
        return Ok(path);
    }
    if let Ok(raw) = fs::read_to_string(&path) {
        if let Some(retired) = RETIRED_FONT_FAMILIES
            .iter()
            .find(|f| raw.contains(&format!("\"fontFamily\": \"{f}\"")))
        {
            let patched = raw.replace(
                &format!("\"fontFamily\": \"{retired}\""),
                &format!("\"fontFamily\": \"{FONT_FAMILY}\""),
            );
            fs::write(&path, patched).map_err(|e| e.to_string())?;
        }
    }
    Ok(path)
}

const DEFAULT_INIT_PS1: &str = r##"# AbabilX Terminal shell init - loaded for every new session. Edit freely.

function prompt {
    $cwd = (Get-Location).Path
    if ($cwd.StartsWith($HOME)) { $cwd = "~" + $cwd.Substring($HOME.Length) }
    $esc = [char]27
    "$esc[38;5;141mAbabilX$esc[0m $esc[36m$cwd$esc[0m $esc[92m>$esc[0m "
}

Clear-Host
"##;

fn ensure_init_script(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("init.ps1");
    if !path.exists() {
        fs::write(&path, DEFAULT_INIT_PS1).map_err(|e| e.to_string())?;
    }
    Ok(path)
}

/// appearance.blur from settings.json (px). 0 disables the window blur;
/// the old boolean `backgroundBlur: true` is honored as 24.
pub fn blur_radius(app: &AppHandle) -> f64 {
    let parsed: Option<serde_json::Value> = ensure_settings(app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|raw| serde_json::from_str(&raw).ok());
    let appearance = parsed.as_ref().and_then(|v| v.get("appearance"));
    if let Some(radius) = appearance.and_then(|a| a.get("blur")).and_then(|b| b.as_f64()) {
        return radius.max(0.0);
    }
    let legacy = appearance
        .and_then(|a| a.get("backgroundBlur"))
        .and_then(|b| b.as_bool())
        .unwrap_or(false);
    if legacy { 24.0 } else { 0.0 }
}

/// Shell program + args from settings.json; "auto" resolves the default shell.
pub fn shell_config(app: &AppHandle) -> (Option<String>, Vec<String>) {
    let parsed: Option<serde_json::Value> = ensure_settings(app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|raw| serde_json::from_str(&raw).ok());

    let shell = parsed.as_ref().and_then(|v| v.get("shell"));

    let program = shell
        .and_then(|s| s.get("program"))
        .and_then(|p| p.as_str())
        .filter(|p| !p.is_empty() && *p != "auto")
        .map(String::from);

    let mut args: Vec<String> = shell
        .and_then(|s| s.get("args"))
        .and_then(|a| a.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_else(default_shell_args);

    // A settings.json created on Windows carries PowerShell flags that make
    // unix shells exit immediately ("zsh: bad option"); swap the untouched
    // Windows defaults for this platform's defaults.
    if !cfg!(windows) && args == WINDOWS_SHELL_ARGS {
        args = default_shell_args();
    }

    // Load our own init script (custom prompt) unless the user already
    // controls startup via -Command/-File in their shell args.
    let user_controls_startup = args
        .iter()
        .any(|a| a.eq_ignore_ascii_case("-command") || a.eq_ignore_ascii_case("-file"));
    if cfg!(windows) && !user_controls_startup {
        if let Ok(init) = ensure_init_script(app) {
            args.push("-NoExit".into());
            args.push("-Command".into());
            args.push(format!(". '{}'", init.display()));
        }
    }

    (program, args)
}

#[tauri::command]
pub fn read_settings(app: AppHandle) -> Result<String, String> {
    let path = ensure_settings(&app)?;
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_settings(app: AppHandle) -> Result<(), String> {
    let path = ensure_settings(&app)?;
    tauri_plugin_opener::open_path(path, None::<&str>).map_err(|e| e.to_string())
}
