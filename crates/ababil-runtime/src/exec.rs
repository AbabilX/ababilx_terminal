//! Plan executor: builtins, external processes, pipelines, redirects,
//! `&&`/`||` chaining.
//!
//! Streaming model: the final pipeline stage writes to the caller's sink as
//! the process runs (incremental output, cancellable). Intermediate stages
//! and file-redirected stdout are buffered, since the next stage/file needs
//! the complete byte stream. When the evaluation is interactive
//! (`ExecControl::interactive`) and the final stage is an external command
//! with no stdout redirect and no piped stdin, the interactive (PTY) launcher
//! is used so TUI programs, colors and resize work.

use std::path::PathBuf;
use std::sync::Arc;

use ababil_parser::ast::{Connector, RedirectKind};

use crate::builtins::{BuiltinCtx, BuiltinRegistry};
use crate::error::RuntimeError;
use crate::expand;
use crate::path::find_executable;
use crate::plan::{ExecutionPlan, PipelinePlan};
use crate::state::ShellState;
use crate::traits::{
    CommandEvent, ExecControl, FileSystem, OutputSink, Plugin, ProcessLauncher, ProcessSpec,
};

/// Side effects a command requests from the host (renderer / session layer).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Effect {
    ClearScreen,
    Exit(i32),
    CwdChanged(PathBuf),
}

#[derive(Debug, Clone, Default)]
pub struct ExecOutcome {
    pub status: i32,
    pub effects: Vec<Effect>,
}

pub struct Runtime {
    fs: Arc<dyn FileSystem>,
    /// Buffered launcher: pipeline stages, redirected output.
    launcher: Arc<dyn ProcessLauncher>,
    /// PTY-backed launcher for the interactive final stage, when available.
    interactive_launcher: Option<Arc<dyn ProcessLauncher>>,
    builtins: BuiltinRegistry,
    plugins: Vec<Arc<dyn Plugin>>,
}

impl Runtime {
    pub fn new(fs: Arc<dyn FileSystem>, launcher: Arc<dyn ProcessLauncher>) -> Self {
        Self {
            fs,
            launcher,
            interactive_launcher: None,
            builtins: BuiltinRegistry::with_defaults(),
            plugins: Vec::new(),
        }
    }

    pub fn with_interactive_launcher(mut self, launcher: Arc<dyn ProcessLauncher>) -> Self {
        self.interactive_launcher = Some(launcher);
        self
    }

    pub fn add_plugin(&mut self, plugin: Arc<dyn Plugin>) {
        self.plugins.push(plugin);
    }

    pub fn fs(&self) -> &dyn FileSystem {
        self.fs.as_ref()
    }

    pub fn builtins(&self) -> &BuiltinRegistry {
        &self.builtins
    }

    pub fn execute(
        &self,
        plan: &ExecutionPlan,
        state: &mut ShellState,
        sink: &mut dyn OutputSink,
        ctrl: &ExecControl,
    ) -> Result<ExecOutcome, RuntimeError> {
        let mut outcome = ExecOutcome::default();
        'steps: for step in &plan.steps {
            let mut status =
                self.run_pipeline(&step.first, state, sink, ctrl, &mut outcome.effects)?;
            if outcome.effects.iter().any(|e| matches!(e, Effect::Exit(_))) {
                outcome.status = status;
                break 'steps;
            }
            for (connector, pipeline) in &step.rest {
                let should_run = match connector {
                    Connector::And => status == 0,
                    Connector::Or => status != 0,
                };
                if should_run {
                    status =
                        self.run_pipeline(pipeline, state, sink, ctrl, &mut outcome.effects)?;
                    if outcome.effects.iter().any(|e| matches!(e, Effect::Exit(_))) {
                        outcome.status = status;
                        break 'steps;
                    }
                }
            }
            outcome.status = status;
            state.last_status = status;
        }
        state.last_status = outcome.status;
        Ok(outcome)
    }

    fn run_pipeline(
        &self,
        pipeline: &PipelinePlan,
        state: &mut ShellState,
        sink: &mut dyn OutputSink,
        ctrl: &ExecControl,
        effects: &mut Vec<Effect>,
    ) -> Result<i32, RuntimeError> {
        let mut piped: Option<Vec<u8>> = None;
        let mut status = 0;
        let count = pipeline.commands.len();

        for (i, cmd) in pipeline.commands.iter().enumerate() {
            let is_last = i + 1 == count;
            let argv = expand::expand_words(&cmd.words, state, self.fs.as_ref());
            if argv.is_empty() || argv[0].is_empty() {
                sink.stderr(b"ababil: empty command\n");
                return Ok(1);
            }

            // Redirects: `<` overrides the pipe; `>`/`>>` capture stdout.
            let mut input = piped.take();
            let mut out_file: Option<(PathBuf, bool)> = None;
            for redirect in &cmd.redirects {
                let target = expand::expand_word(&redirect.target, state, self.fs.as_ref())
                    .into_iter()
                    .next()
                    .unwrap_or_default();
                let path = state.resolve(&target);
                match redirect.kind {
                    RedirectKind::In => match self.fs.read(&path) {
                        Ok(data) => input = Some(data),
                        Err(e) => {
                            sink.stderr(format!("ababil: {target}: {e}\n").as_bytes());
                            return Ok(1);
                        }
                    },
                    RedirectKind::Out => out_file = Some((path, false)),
                    RedirectKind::Append => out_file = Some((path, true)),
                }
            }

            // Stdout routing decides buffering: final stage with no file
            // redirect streams straight to the caller's sink.
            let must_buffer = !is_last || out_file.is_some();
            let mut buffer: Vec<u8> = Vec::new();
            status = {
                let mut stage = StageSink {
                    buffer: must_buffer.then_some(&mut buffer),
                    sink,
                };
                self.run_command(&argv, input.as_deref(), state, &mut stage, ctrl, effects)?
            };

            for plugin in &self.plugins {
                plugin.on_command(&CommandEvent {
                    argv: argv.clone(),
                    status,
                    cwd: state.cwd.clone(),
                });
            }

            if effects.iter().any(|e| matches!(e, Effect::Exit(_))) {
                return Ok(status);
            }

            if let Some((path, append)) = out_file {
                if let Err(e) = self.fs.write(&path, &buffer, append) {
                    sink.stderr(format!("ababil: {}: {e}\n", path.display()).as_bytes());
                    return Ok(1);
                }
            } else if !is_last {
                piped = Some(buffer);
            }
        }
        Ok(status)
    }

    /// Run one command, writing stdout/stderr to `stage`. stderr always
    /// passes through to the real sink — it never enters the pipe.
    fn run_command(
        &self,
        argv: &[String],
        input: Option<&[u8]>,
        state: &mut ShellState,
        stage: &mut StageSink,
        ctrl: &ExecControl,
        effects: &mut Vec<Effect>,
    ) -> Result<i32, RuntimeError> {
        let name = argv[0].as_str();

        if let Some(builtin) = self.builtins.get(name) {
            let mut ctx = BuiltinCtx {
                state,
                fs: self.fs.as_ref(),
                input,
                registry: &self.builtins,
            };
            let result = builtin.run(&argv[1..], &mut ctx, stage);
            if let Some(effect) = result.effect {
                effects.push(effect);
            }
            return Ok(result.status);
        }

        // External executable, resolved against the *session* PATH and
        // launched directly through OS process APIs — never via an OS shell.
        let Some(program) = find_executable(name, state, self.fs.as_ref()) else {
            stage.stderr(format!("ababil: command not found: {name}\n").as_bytes());
            return Ok(127);
        };

        let spec = ProcessSpec {
            program: program.to_string_lossy().into_owned(),
            args: argv[1..].to_vec(),
            cwd: state.cwd.clone(),
            env: state.env.clone(),
        };

        // Interactive (PTY) launcher only for a live final stage with no
        // piped/redirected stdin: PTY stdin belongs to the user's keyboard.
        let launcher: &dyn ProcessLauncher =
            match (&self.interactive_launcher, ctrl.interactive, stage.is_streaming(), input) {
                (Some(l), true, true, None) => l.as_ref(),
                _ => self.launcher.as_ref(),
            };

        match launcher.run(&spec, input, stage, ctrl) {
            Ok(status) => Ok(status),
            Err(RuntimeError::Launch { program, message }) => {
                stage.stderr(format!("ababil: failed to launch {program}: {message}\n").as_bytes());
                Ok(126)
            }
            Err(e) => Err(e),
        }
    }
}

/// Per-stage output router: stdout to the pipe buffer (intermediate stages,
/// file redirects) or straight through (streaming final stage); stderr always
/// straight through.
struct StageSink<'a> {
    buffer: Option<&'a mut Vec<u8>>,
    sink: &'a mut dyn OutputSink,
}

impl StageSink<'_> {
    fn is_streaming(&self) -> bool {
        self.buffer.is_none()
    }
}

impl OutputSink for StageSink<'_> {
    fn stdout(&mut self, data: &[u8]) {
        match &mut self.buffer {
            Some(buffer) => buffer.extend_from_slice(data),
            None => self.sink.stdout(data),
        }
    }
    fn stderr(&mut self, data: &[u8]) {
        self.sink.stderr(data);
    }
}
