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
    "foreground": "auto",
    "cursorStyle": "block",
    "cursorBlink": true,
    "lineHeight": 1.2
  },
  "keybindings": {
    "newTab": "ctrl+shift+t",
    "splitRight": "ctrl+t",
    "closeTab": "ctrl+w",
    "settings": "ctrl+,"
  },
  "aliases": []
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

/// Fills in `appearance.background`/`appearance.blur` for settings.json
/// files written before those keys existed (old schema: `opacity` +
/// `backgroundBlur: bool`, no hex background). Without this, `blur_radius`
/// reads the raw file, finds no `blur` key, and silently leaves the window
/// blur off no matter what the user edits.
fn migrate_appearance(raw: &str) -> Option<String> {
    let mut val: serde_json::Value = serde_json::from_str(raw).ok()?;
    let appearance = val.get_mut("appearance")?.as_object_mut()?;
    let mut changed = false;
    if !appearance.contains_key("background") {
        appearance.insert("background".into(), serde_json::json!("#0d1117"));
        changed = true;
    }
    if !appearance.contains_key("blur") {
        let legacy = appearance
            .get("backgroundBlur")
            .and_then(|b| b.as_bool())
            .unwrap_or(false);
        appearance.insert("blur".into(), serde_json::json!(if legacy { 24.0 } else { 0.0 }));
        changed = true;
    }
    changed.then(|| serde_json::to_string_pretty(&val).unwrap_or_else(|_| raw.to_string()))
}

fn migrate_terminal(raw: &str) -> Option<String> {
    let mut val: serde_json::Value = serde_json::from_str(raw).ok()?;
    let terminal = val.get_mut("terminal")?.as_object_mut()?;
    let mut changed = false;
    if !terminal.contains_key("foreground") {
        terminal.insert("foreground".into(), serde_json::json!("auto"));
        changed = true;
    }
    changed.then(|| serde_json::to_string_pretty(&val).unwrap_or_else(|_| raw.to_string()))
}

fn migrate_aliases(raw: &str) -> Option<String> {
    let mut val: serde_json::Value = serde_json::from_str(raw).ok()?;
    if val.get("aliases").is_some() {
        return None;
    }
    val.as_object_mut()?.insert("aliases".into(), serde_json::json!([]));
    Some(serde_json::to_string_pretty(&val).unwrap_or_else(|_| raw.to_string()))
}

/// First version: alias functions must be `cd <path>` only.
fn is_cd_alias(func: &str) -> bool {
    let trimmed = func.trim();
    if !trimmed.to_ascii_lowercase().starts_with("cd ") {
        return false;
    }
    let rest = trimmed[3..].trim();
    !rest.is_empty()
}

fn validate_aliases(val: &serde_json::Value) -> Result<(), String> {
    let Some(arr) = val.get("aliases").and_then(|a| a.as_array()) else {
        return Ok(());
    };
    let mut names = std::collections::HashSet::new();
    for item in arr {
        let name = item
            .get("name")
            .and_then(|n| n.as_str())
            .ok_or_else(|| "alias missing name".to_string())?
            .trim();
        let func = item
            .get("func")
            .and_then(|f| f.as_str())
            .ok_or_else(|| format!("alias '{name}' missing func"))?;
        if name.is_empty() {
            return Err("alias name cannot be empty".into());
        }
        if !names.insert(name.to_string()) {
            return Err(format!("duplicate alias name: {name}"));
        }
        if !is_cd_alias(func) {
            return Err(format!(
                "alias '{name}': func must be a cd command (e.g. cd /path)"
            ));
        }
    }
    Ok(())
}

fn validate_settings(val: &serde_json::Value) -> Result<(), String> {
    for key in ["appearance", "terminal", "keybindings"] {
        if !val.get(key).map(|v| v.is_object()).unwrap_or(false) {
            return Err(format!("settings missing or invalid '{key}'"));
        }
    }
    validate_aliases(val)
}

fn migrate_keybindings(raw: &str) -> Option<String> {
    let mut val: serde_json::Value = serde_json::from_str(raw).ok()?;
    let keybindings = val.get_mut("keybindings")?.as_object_mut()?;
    let mut changed = false;

    if keybindings.get("newTab").and_then(|v| v.as_str()) == Some("ctrl+t") {
        keybindings.insert("newTab".into(), serde_json::json!("ctrl+shift+t"));
        changed = true;
    }
    if keybindings.get("splitRight").and_then(|v| v.as_str()) == Some("ctrl+\\") {
        keybindings.insert("splitRight".into(), serde_json::json!("ctrl+t"));
        changed = true;
    }

    changed.then(|| serde_json::to_string_pretty(&val).unwrap_or_else(|_| raw.to_string()))
}

fn ensure_settings(app: &AppHandle) -> Result<PathBuf, String> {
    let path = settings_path(app)?;
    if !path.exists() {
        fs::write(&path, default_settings()).map_err(|e| e.to_string())?;
        return Ok(path);
    }
    if let Ok(raw) = fs::read_to_string(&path) {
        let mut raw = raw;
        if let Some(retired) = RETIRED_FONT_FAMILIES
            .iter()
            .find(|f| raw.contains(&format!("\"fontFamily\": \"{f}\"")))
        {
            raw = raw.replace(
                &format!("\"fontFamily\": \"{retired}\""),
                &format!("\"fontFamily\": \"{FONT_FAMILY}\""),
            );
        }
        if let Some(patched) = migrate_appearance(&raw) {
            raw = patched;
        }
        if let Some(patched) = migrate_terminal(&raw) {
            raw = patched;
        }
        if let Some(patched) = migrate_keybindings(&raw) {
            raw = patched;
        }
        if let Some(patched) = migrate_aliases(&raw) {
            raw = patched;
        }
        fs::write(&path, &raw).map_err(|e| e.to_string())?;
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

#[tauri::command]
pub fn write_settings(app: AppHandle, content: String) -> Result<(), String> {
    let val: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("invalid JSON: {e}"))?;
    validate_settings(&val)?;

    let path = ensure_settings(&app)?;
    let pretty = serde_json::to_string_pretty(&val).map_err(|e| e.to_string())?;
    fs::write(&path, pretty).map_err(|e| e.to_string())
}
