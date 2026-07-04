//! echo, clear, exit, history, which, help.

use crate::builtins::{Builtin, BuiltinCtx, BuiltinResult};
use crate::exec::Effect;
use crate::path::find_executable;
use crate::traits::OutputSink;

pub struct Echo;

impl Builtin for Echo {
    fn name(&self) -> &'static str {
        "echo"
    }
    fn summary(&self) -> &'static str {
        "print arguments (-n: no trailing newline)"
    }
    fn run(&self, argv: &[String], _ctx: &mut BuiltinCtx, out: &mut dyn OutputSink) -> BuiltinResult {
        let (newline, args) = match argv.first().map(String::as_str) {
            Some("-n") => (false, &argv[1..]),
            _ => (true, argv),
        };
        out.stdout(args.join(" ").as_bytes());
        if newline {
            out.stdout(b"\n");
        }
        BuiltinResult::ok()
    }
}

pub struct Clear;

impl Builtin for Clear {
    fn name(&self) -> &'static str {
        "clear"
    }
    fn summary(&self) -> &'static str {
        "clear the terminal"
    }
    fn run(&self, _argv: &[String], _ctx: &mut BuiltinCtx, _out: &mut dyn OutputSink) -> BuiltinResult {
        BuiltinResult::effect(Effect::ClearScreen)
    }
}

pub struct Exit;

impl Builtin for Exit {
    fn name(&self) -> &'static str {
        "exit"
    }
    fn summary(&self) -> &'static str {
        "exit the session (exit [code])"
    }
    fn run(&self, argv: &[String], ctx: &mut BuiltinCtx, out: &mut dyn OutputSink) -> BuiltinResult {
        let code = match argv.first() {
            None => ctx.state.last_status,
            Some(arg) => match arg.parse::<i32>() {
                Ok(code) => code,
                Err(_) => {
                    out.stderr(format!("exit: {arg}: numeric argument required\n").as_bytes());
                    return BuiltinResult {
                        status: 2,
                        effect: Some(Effect::Exit(2)),
                    };
                }
            },
        };
        BuiltinResult {
            status: code,
            effect: Some(Effect::Exit(code)),
        }
    }
}

pub struct History;

impl Builtin for History {
    fn name(&self) -> &'static str {
        "history"
    }
    fn summary(&self) -> &'static str {
        "show command history"
    }
    fn run(&self, _argv: &[String], ctx: &mut BuiltinCtx, out: &mut dyn OutputSink) -> BuiltinResult {
        for (i, line) in ctx.state.history.iter().enumerate() {
            out.stdout(format!("{:>5}  {line}\n", i + 1).as_bytes());
        }
        BuiltinResult::ok()
    }
}

pub struct Which;

impl Builtin for Which {
    fn name(&self) -> &'static str {
        "which"
    }
    fn summary(&self) -> &'static str {
        "locate a command (builtin, alias or PATH executable)"
    }
    fn run(&self, argv: &[String], ctx: &mut BuiltinCtx, out: &mut dyn OutputSink) -> BuiltinResult {
        if argv.is_empty() {
            out.stderr(b"which: missing argument\n");
            return BuiltinResult::fail(2);
        }
        let mut status = 0;
        for name in argv {
            if let Some(value) = ctx.state.aliases.get(name) {
                out.stdout(format!("{name}: alias for '{value}'\n").as_bytes());
            } else if ctx.registry.contains(name) {
                out.stdout(format!("{name}: shell builtin\n").as_bytes());
            } else if let Some(path) = find_executable(name, ctx.state, ctx.fs) {
                out.stdout(format!("{}\n", path.display()).as_bytes());
            } else {
                out.stderr(format!("which: {name}: not found\n").as_bytes());
                status = 1;
            }
        }
        BuiltinResult::fail(status)
    }
}

pub struct Help;

impl Builtin for Help {
    fn name(&self) -> &'static str {
        "help"
    }
    fn summary(&self) -> &'static str {
        "list built-in commands"
    }
    fn run(&self, _argv: &[String], ctx: &mut BuiltinCtx, out: &mut dyn OutputSink) -> BuiltinResult {
        out.stdout(b"AbabilX shell builtins:\n");
        for builtin in ctx.registry.iter() {
            out.stdout(format!("  {:<10} {}\n", builtin.name(), builtin.summary()).as_bytes());
        }
        BuiltinResult::ok()
    }
}
