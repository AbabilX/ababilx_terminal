//! The event vocabulary of the AbabilX platform. Frontends consume only
//! these; they never observe processes, PTYs or the shell directly.

use serde::Serialize;

/// Everything a session can tell its renderer. `data` fields are UTF-8
/// strings (the session layer re-assembles code points split across raw
/// chunks); raw-byte transport can be added as a parallel channel later
/// without breaking this contract.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ShellEvent {
    /// A submitted line began executing. Starts a block.
    CommandStarted { id: u64, line: String },
    Stdout { data: String },
    Stderr { data: String },
    /// The submitted line finished. Closes the block.
    CommandFinished {
        id: u64,
        status: i32,
        duration_ms: u64,
        cwd: String,
    },
    /// `clear` builtin: renderer should clear the screen/blocks.
    Clear,
    CwdChanged { cwd: String },
    /// Reserved: OSC 0/2 title updates (parsed in the ANSI phase).
    TitleChanged { title: String },
    /// Reserved: BEL.
    Bell,
    /// The session ended (`exit`); the host should close the pane.
    SessionExited { code: i32 },
}

/// Where session events go. The Tauri host forwards them to the WebView;
/// tests collect them in memory.
pub trait EventSink: Send + Sync {
    fn emit(&self, event: ShellEvent);
}

/// What this session's renderer stack can display. Negotiated at attach
/// time; future renderer features (Kitty graphics, Sixel, OSC 8 hyperlinks,
/// inline images) switch on here instead of being probed ad hoc.
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SessionCapabilities {
    pub supports_tui: bool,
    pub supports_color: bool,
    pub supports_unicode: bool,
    pub supports_hyperlinks: bool,
    pub supports_images: bool,
}

impl Default for SessionCapabilities {
    fn default() -> Self {
        Self {
            supports_tui: true,
            supports_color: true,
            supports_unicode: true,
            supports_hyperlinks: false,
            supports_images: false,
        }
    }
}
