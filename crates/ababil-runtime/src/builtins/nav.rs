//! Navigation builtins: pwd, cd, ls.

use crate::builtins::{Builtin, BuiltinCtx, BuiltinResult};
use crate::exec::Effect;
use crate::traits::OutputSink;

pub struct Pwd;

impl Builtin for Pwd {
    fn name(&self) -> &'static str {
        "pwd"
    }
    fn summary(&self) -> &'static str {
        "print the current working directory"
    }
    fn run(&self, _argv: &[String], ctx: &mut BuiltinCtx, out: &mut dyn OutputSink) -> BuiltinResult {
        out.stdout(format!("{}\n", ctx.state.cwd.display()).as_bytes());
        BuiltinResult::ok()
    }
}

pub struct Cd;

impl Builtin for Cd {
    fn name(&self) -> &'static str {
        "cd"
    }
    fn summary(&self) -> &'static str {
        "change the working directory (cd, cd <dir>, cd -)"
    }
    fn run(&self, argv: &[String], ctx: &mut BuiltinCtx, out: &mut dyn OutputSink) -> BuiltinResult {
        let target = match argv.first().map(String::as_str) {
            None | Some("~") => match ctx.state.home_dir() {
                Some(home) => home,
                None => {
                    out.stderr(b"cd: cannot determine home directory\n");
                    return BuiltinResult::fail(1);
                }
            },
            Some("-") => match ctx.state.prev_cwd.clone() {
                Some(prev) => prev,
                None => {
                    out.stderr(b"cd: no previous directory\n");
                    return BuiltinResult::fail(1);
                }
            },
            Some(path) => ctx.state.resolve(path),
        };

        let resolved = match ctx.fs.canonicalize(&target) {
            Ok(p) => p,
            Err(e) => {
                out.stderr(format!("cd: {}: {e}\n", target.display()).as_bytes());
                return BuiltinResult::fail(1);
            }
        };
        match ctx.fs.metadata(&resolved) {
            Ok(meta) if meta.is_dir => {}
            Ok(_) => {
                out.stderr(format!("cd: {}: not a directory\n", resolved.display()).as_bytes());
                return BuiltinResult::fail(1);
            }
            Err(e) => {
                out.stderr(format!("cd: {}: {e}\n", resolved.display()).as_bytes());
                return BuiltinResult::fail(1);
            }
        }

        ctx.state.prev_cwd = Some(ctx.state.cwd.clone());
        ctx.state.cwd = resolved.clone();
        BuiltinResult::effect(Effect::CwdChanged(resolved))
    }
}

pub struct Ls;

impl Builtin for Ls {
    fn name(&self) -> &'static str {
        "ls"
    }
    fn summary(&self) -> &'static str {
        "list directory contents (-a all, -l long)"
    }
    fn run(&self, argv: &[String], ctx: &mut BuiltinCtx, out: &mut dyn OutputSink) -> BuiltinResult {
        let mut all = false;
        let mut long = false;
        let mut paths: Vec<&str> = Vec::new();
        for arg in argv {
            match arg.as_str() {
                "-a" => all = true,
                "-l" => long = true,
                "-la" | "-al" => {
                    all = true;
                    long = true;
                }
                flag if flag.starts_with('-') => {
                    out.stderr(format!("ls: unknown option: {flag}\n").as_bytes());
                    return BuiltinResult::fail(2);
                }
                path => paths.push(path),
            }
        }
        if paths.is_empty() {
            paths.push(".");
        }

        let multiple = paths.len() > 1;
        let mut status = 0;
        for (i, path) in paths.iter().enumerate() {
            let dir = ctx.state.resolve(path);
            let entries = match ctx.fs.read_dir(&dir) {
                Ok(e) => e,
                Err(err) => {
                    // Not a directory? Show the file itself, like POSIX ls.
                    if let Ok(meta) = ctx.fs.metadata(&dir) {
                        if !meta.is_dir {
                            out.stdout(format!("{path}\n").as_bytes());
                            continue;
                        }
                    }
                    out.stderr(format!("ls: {path}: {err}\n").as_bytes());
                    status = 1;
                    continue;
                }
            };
            if multiple {
                if i > 0 {
                    out.stdout(b"\n");
                }
                out.stdout(format!("{path}:\n").as_bytes());
            }
            for entry in entries {
                if !all && entry.name.starts_with('.') {
                    continue;
                }
                let display = if entry.is_dir {
                    format!("{}/", entry.name)
                } else {
                    entry.name.clone()
                };
                if long {
                    let kind = if entry.is_dir { "dir " } else { "file" };
                    out.stdout(format!("{kind} {:>10}  {display}\n", entry.len).as_bytes());
                } else {
                    out.stdout(format!("{display}\n").as_bytes());
                }
            }
        }
        BuiltinResult::fail(status)
    }
}
