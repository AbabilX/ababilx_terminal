//! AbabilX shell runtime.
//!
//! Consumes an [`ababil_parser::Program`], lowers it to an [`plan::ExecutionPlan`]
//! and executes it against a [`state::ShellState`] using pluggable backends:
//! [`traits::FileSystem`] for file access, [`traits::ProcessLauncher`] for
//! external executables and [`traits::OutputSink`] for output. Nothing in this
//! crate touches a renderer or a GUI.

pub mod builtins;
pub mod error;
pub mod exec;
pub mod expand;
pub mod fs;
pub mod glob;
pub mod path;
pub mod plan;
pub mod state;
pub mod traits;

pub use error::RuntimeError;
pub use exec::{Effect, ExecOutcome, Runtime};
pub use plan::ExecutionPlan;
pub use state::ShellState;
pub use traits::{ExecControl, FileSystem, OutputSink, Plugin, ProcessLauncher};
