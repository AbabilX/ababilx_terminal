//! Terminal session runtime — the stable boundary between the AbabilX core
//! and any frontend.
//!
//! A frontend (React block UI, future native UI, tests) never talks to
//! processes or the shell directly: it calls [`TerminalSession`] methods
//! (run_line / write_stdin / cancel / resize) and consumes [`ShellEvent`]s
//! from its [`EventSink`]. This API is the public contract; renderers and
//! launchers change behind it.

mod events;
mod session;

pub use events::{EventSink, SessionCapabilities, ShellEvent};
pub use session::TerminalSession;
