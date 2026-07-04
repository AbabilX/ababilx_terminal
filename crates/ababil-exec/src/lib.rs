//! Process launcher implementations.
//!
//! [`NativeLauncher`] runs external executables directly through OS process
//! APIs (`std::process` -> CreateProcessW / posix_spawn) with piped, streamed
//! stdio — used for pipeline stages and redirected output. [`PtyLauncher`]
//! attaches the foreground command to a pseudo terminal for full interactive
//! semantics. AbabilX never routes commands through PowerShell/CMD/Bash —
//! those are not dependencies, just executables a user may run like any
//! other.

mod native;
mod pty;

pub use native::NativeLauncher;
pub use pty::PtyLauncher;
