//! Session environment builtins: export, alias, unalias.

use crate::builtins::{Builtin, BuiltinCtx, BuiltinResult};
use crate::traits::OutputSink;

pub struct Export;

impl Builtin for Export {
    fn name(&self) -> &'static str {
        "export"
    }
    fn summary(&self) -> &'static str {
        "set session environment variables (export NAME=value)"
    }
    fn run(&self, argv: &[String], ctx: &mut BuiltinCtx, out: &mut dyn OutputSink) -> BuiltinResult {
        if argv.is_empty() {
            let mut vars: Vec<_> = ctx.state.env.iter().collect();
            vars.sort_by(|a, b| a.0.cmp(b.0));
            for (k, v) in vars {
                out.stdout(format!("{k}={v}\n").as_bytes());
            }
            return BuiltinResult::ok();
        }
        let mut status = 0;
        for arg in argv {
            match arg.split_once('=') {
                Some((name, value)) if !name.is_empty() => {
                    ctx.state.env.insert(name.to_string(), value.to_string());
                }
                _ => match ctx.state.get_env(arg) {
                    Some(v) => out.stdout(format!("{arg}={v}\n").as_bytes()),
                    None => {
                        out.stderr(format!("export: {arg}: not set\n").as_bytes());
                        status = 1;
                    }
                },
            }
        }
        BuiltinResult::fail(status)
    }
}

pub struct Alias;

impl Builtin for Alias {
    fn name(&self) -> &'static str {
        "alias"
    }
    fn summary(&self) -> &'static str {
        "define or list aliases (alias name=value)"
    }
    fn run(&self, argv: &[String], ctx: &mut BuiltinCtx, out: &mut dyn OutputSink) -> BuiltinResult {
        if argv.is_empty() {
            let mut aliases: Vec<_> = ctx.state.aliases.iter().collect();
            aliases.sort_by(|a, b| a.0.cmp(b.0));
            for (name, value) in aliases {
                out.stdout(format!("alias {name}='{value}'\n").as_bytes());
            }
            return BuiltinResult::ok();
        }
        let mut status = 0;
        for arg in argv {
            match arg.split_once('=') {
                Some((name, value)) if !name.is_empty() => {
                    ctx.state
                        .aliases
                        .insert(name.to_string(), value.to_string());
                }
                _ => match ctx.state.aliases.get(arg) {
                    Some(value) => out.stdout(format!("alias {arg}='{value}'\n").as_bytes()),
                    None => {
                        out.stderr(format!("alias: {arg}: not found\n").as_bytes());
                        status = 1;
                    }
                },
            }
        }
        BuiltinResult::fail(status)
    }
}

pub struct Unalias;

impl Builtin for Unalias {
    fn name(&self) -> &'static str {
        "unalias"
    }
    fn summary(&self) -> &'static str {
        "remove aliases"
    }
    fn run(&self, argv: &[String], ctx: &mut BuiltinCtx, out: &mut dyn OutputSink) -> BuiltinResult {
        let mut status = 0;
        for name in argv {
            if ctx.state.aliases.remove(name).is_none() {
                out.stderr(format!("unalias: {name}: not found\n").as_bytes());
                status = 1;
            }
        }
        BuiltinResult::fail(status)
    }
}
