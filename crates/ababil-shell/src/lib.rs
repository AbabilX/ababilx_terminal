//! AbabilX shell session: owns [`ShellState`], records history, expands
//! aliases, drives lex -> parse -> lower -> execute. One `Session` per
//! terminal session/tab.

mod alias;

use ababil_runtime::plan;
use ababil_runtime::{Effect, ExecControl, OutputSink, Runtime, ShellState};

pub use ababil_runtime::exec::ExecOutcome;

pub struct Session {
    state: ShellState,
    runtime: Runtime,
}

#[derive(Debug, Clone, Default)]
pub struct EvalResult {
    pub status: i32,
    pub effects: Vec<Effect>,
}

impl Session {
    pub fn new(runtime: Runtime) -> Self {
        Self {
            state: ShellState::from_os(),
            runtime,
        }
    }

    pub fn with_state(runtime: Runtime, state: ShellState) -> Self {
        Self { state, runtime }
    }

    pub fn state(&self) -> &ShellState {
        &self.state
    }

    pub fn state_mut(&mut self) -> &mut ShellState {
        &mut self.state
    }

    /// Evaluate one line with no live terminal attached (tests, scripts).
    pub fn eval(&mut self, line: &str, sink: &mut dyn OutputSink) -> EvalResult {
        self.eval_with(line, sink, &ExecControl::detached())
    }

    /// Evaluate one input line under a live [`ExecControl`] (cancellation,
    /// interactive stdin, resize). Parse errors and command failures are
    /// reported on the sink; only internal runtime faults would be fatal.
    pub fn eval_with(&mut self, line: &str, sink: &mut dyn OutputSink, ctrl: &ExecControl) -> EvalResult {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return EvalResult::default();
        }

        // History: skip consecutive duplicates.
        if self.state.history.last().map(String::as_str) != Some(trimmed) {
            self.state.history.push(trimmed.to_string());
        }

        let mut program = match ababil_parser::parse(trimmed) {
            Ok(p) => p,
            Err(e) => {
                sink.stderr(format!("ababil: parse error: {e}\n").as_bytes());
                self.state.last_status = 2;
                return EvalResult { status: 2, effects: Vec::new() };
            }
        };

        if let Err(e) = alias::expand_aliases(&mut program, &self.state.aliases) {
            sink.stderr(format!("ababil: {e}\n").as_bytes());
            self.state.last_status = 2;
            return EvalResult { status: 2, effects: Vec::new() };
        }

        let plan = plan::lower(&program);
        match self.runtime.execute(&plan, &mut self.state, sink, ctrl) {
            Ok(outcome) => EvalResult {
                status: outcome.status,
                effects: outcome.effects,
            },
            Err(e) => {
                sink.stderr(format!("ababil: runtime error: {e}\n").as_bytes());
                self.state.last_status = 1;
                EvalResult { status: 1, effects: Vec::new() }
            }
        }
    }
}
