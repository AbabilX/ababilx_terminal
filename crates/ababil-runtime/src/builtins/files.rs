//! File-manipulation builtins: cat, mkdir, touch, rm, cp, mv.
//!
//! Implemented natively on the `FileSystem` trait so they behave identically
//! on macOS and Windows — the user types the Unix command everywhere and the
//! shell never shells out to `type`/`copy`/`del`/cmd.exe.

use std::path::{Path, PathBuf};

use crate::builtins::{Builtin, BuiltinCtx, BuiltinResult};
use crate::traits::{FileSystem, OutputSink};

/// Split argv into flags (`-x`) and positional operands.
fn split_flags(argv: &[String]) -> (Vec<char>, Vec<&str>) {
    let mut flags = Vec::new();
    let mut operands = Vec::new();
    let mut only_operands = false;
    for arg in argv {
        if only_operands {
            operands.push(arg.as_str());
        } else if arg == "--" {
            only_operands = true;
        } else if arg.len() > 1 && arg.starts_with('-') {
            flags.extend(arg.chars().skip(1));
        } else {
            operands.push(arg.as_str());
        }
    }
    (flags, operands)
}

pub struct Cat;

impl Builtin for Cat {
    fn name(&self) -> &'static str {
        "cat"
    }
    fn summary(&self) -> &'static str {
        "concatenate and print files"
    }
    fn run(&self, argv: &[String], ctx: &mut BuiltinCtx, out: &mut dyn OutputSink) -> BuiltinResult {
        let (_flags, files) = split_flags(argv);

        // No file operands: echo piped stdin, like POSIX cat.
        if files.is_empty() {
            if let Some(input) = ctx.input {
                out.stdout(input);
            }
            return BuiltinResult::ok();
        }

        let mut status = 0;
        for file in files {
            let path = ctx.state.resolve(file);
            match ctx.fs.read(&path) {
                Ok(data) => out.stdout(&data),
                Err(e) => {
                    out.stderr(format!("cat: {file}: {e}\n").as_bytes());
                    status = 1;
                }
            }
        }
        BuiltinResult::fail(status)
    }
}

pub struct Mkdir;

impl Builtin for Mkdir {
    fn name(&self) -> &'static str {
        "mkdir"
    }
    fn summary(&self) -> &'static str {
        "create directories (-p: make parents, no error if existing)"
    }
    fn run(&self, argv: &[String], ctx: &mut BuiltinCtx, out: &mut dyn OutputSink) -> BuiltinResult {
        let (flags, dirs) = split_flags(argv);
        let parents = flags.contains(&'p');
        if dirs.is_empty() {
            out.stderr(b"mkdir: missing operand\n");
            return BuiltinResult::fail(1);
        }

        let mut status = 0;
        for dir in dirs {
            let path = ctx.state.resolve(dir);
            // Without -p, refuse when the directory already exists.
            if !parents && ctx.fs.exists(&path) {
                out.stderr(format!("mkdir: {dir}: File exists\n").as_bytes());
                status = 1;
                continue;
            }
            if let Err(e) = ctx.fs.create_dir(&path) {
                out.stderr(format!("mkdir: {dir}: {e}\n").as_bytes());
                status = 1;
            }
        }
        BuiltinResult::fail(status)
    }
}

pub struct Touch;

impl Builtin for Touch {
    fn name(&self) -> &'static str {
        "touch"
    }
    fn summary(&self) -> &'static str {
        "create empty files if they do not exist"
    }
    fn run(&self, argv: &[String], ctx: &mut BuiltinCtx, out: &mut dyn OutputSink) -> BuiltinResult {
        let (_flags, files) = split_flags(argv);
        if files.is_empty() {
            out.stderr(b"touch: missing operand\n");
            return BuiltinResult::fail(1);
        }

        let mut status = 0;
        for file in files {
            let path = ctx.state.resolve(file);
            if ctx.fs.exists(&path) {
                continue; // already there; native mtime bump is a later concern
            }
            // append=true creates the file without truncating; empty write.
            if let Err(e) = ctx.fs.write(&path, b"", true) {
                out.stderr(format!("touch: {file}: {e}\n").as_bytes());
                status = 1;
            }
        }
        BuiltinResult::fail(status)
    }
}

pub struct Rm;

impl Builtin for Rm {
    fn name(&self) -> &'static str {
        "rm"
    }
    fn summary(&self) -> &'static str {
        "remove files (-r: recurse into directories, -f: ignore missing)"
    }
    fn run(&self, argv: &[String], ctx: &mut BuiltinCtx, out: &mut dyn OutputSink) -> BuiltinResult {
        let (flags, targets) = split_flags(argv);
        let recursive = flags.contains(&'r') || flags.contains(&'R');
        let force = flags.contains(&'f');
        if targets.is_empty() {
            if force {
                return BuiltinResult::ok();
            }
            out.stderr(b"rm: missing operand\n");
            return BuiltinResult::fail(1);
        }

        let mut status = 0;
        for target in targets {
            let path = ctx.state.resolve(target);
            match ctx.fs.metadata(&path) {
                Ok(meta) => {
                    if meta.is_dir && !recursive {
                        out.stderr(format!("rm: {target}: is a directory\n").as_bytes());
                        status = 1;
                        continue;
                    }
                    if let Err(e) = ctx.fs.remove(&path) {
                        out.stderr(format!("rm: {target}: {e}\n").as_bytes());
                        status = 1;
                    }
                }
                Err(_) if force => {}
                Err(e) => {
                    out.stderr(format!("rm: {target}: {e}\n").as_bytes());
                    status = 1;
                }
            }
        }
        BuiltinResult::fail(status)
    }
}

/// Copy a file or (when `recursive`) a directory tree from `src` to `dst`.
fn copy_tree(fs: &dyn FileSystem, src: &Path, dst: &Path, recursive: bool) -> std::io::Result<()> {
    let meta = fs.metadata(src)?;
    if meta.is_dir {
        if !recursive {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "is a directory",
            ));
        }
        fs.create_dir(dst)?;
        for entry in fs.read_dir(src)? {
            copy_tree(fs, &src.join(&entry.name), &dst.join(&entry.name), true)?;
        }
        Ok(())
    } else {
        fs.write(dst, &fs.read(src)?, false)
    }
}

/// If `dst` is an existing directory, resolve the real target inside it using
/// `src`'s file name (`cp a.txt dir/` -> `dir/a.txt`).
fn dest_into_dir(fs: &dyn FileSystem, src: &Path, dst: &Path) -> PathBuf {
    if fs.metadata(dst).map(|m| m.is_dir).unwrap_or(false) {
        if let Some(name) = src.file_name() {
            return dst.join(name);
        }
    }
    dst.to_path_buf()
}

pub struct Cp;

impl Builtin for Cp {
    fn name(&self) -> &'static str {
        "cp"
    }
    fn summary(&self) -> &'static str {
        "copy files and directories (-r: recurse)"
    }
    fn run(&self, argv: &[String], ctx: &mut BuiltinCtx, out: &mut dyn OutputSink) -> BuiltinResult {
        let (flags, operands) = split_flags(argv);
        let recursive = flags.contains(&'r') || flags.contains(&'R');
        if operands.len() < 2 {
            out.stderr(b"cp: usage: cp [-r] source... dest\n");
            return BuiltinResult::fail(1);
        }
        let (sources, dest) = operands.split_at(operands.len() - 1);
        let dest_path = ctx.state.resolve(dest[0]);
        let dest_is_dir = ctx.fs.metadata(&dest_path).map(|m| m.is_dir).unwrap_or(false);
        if sources.len() > 1 && !dest_is_dir {
            out.stderr(format!("cp: {}: not a directory\n", dest[0]).as_bytes());
            return BuiltinResult::fail(1);
        }

        let mut status = 0;
        for source in sources {
            let src_path = ctx.state.resolve(source);
            let target = dest_into_dir(ctx.fs, &src_path, &dest_path);
            if let Err(e) = copy_tree(ctx.fs, &src_path, &target, recursive) {
                out.stderr(format!("cp: {source}: {e}\n").as_bytes());
                status = 1;
            }
        }
        BuiltinResult::fail(status)
    }
}

pub struct Mv;

impl Builtin for Mv {
    fn name(&self) -> &'static str {
        "mv"
    }
    fn summary(&self) -> &'static str {
        "move or rename files and directories"
    }
    fn run(&self, argv: &[String], ctx: &mut BuiltinCtx, out: &mut dyn OutputSink) -> BuiltinResult {
        let (_flags, operands) = split_flags(argv);
        if operands.len() < 2 {
            out.stderr(b"mv: usage: mv source... dest\n");
            return BuiltinResult::fail(1);
        }
        let (sources, dest) = operands.split_at(operands.len() - 1);
        let dest_path = ctx.state.resolve(dest[0]);
        let dest_is_dir = ctx.fs.metadata(&dest_path).map(|m| m.is_dir).unwrap_or(false);
        if sources.len() > 1 && !dest_is_dir {
            out.stderr(format!("mv: {}: not a directory\n", dest[0]).as_bytes());
            return BuiltinResult::fail(1);
        }

        let mut status = 0;
        for source in sources {
            let src_path = ctx.state.resolve(source);
            let target = dest_into_dir(ctx.fs, &src_path, &dest_path);
            match ctx.fs.rename(&src_path, &target) {
                Ok(()) => {}
                Err(_) => {
                    // Cross-device rename fails (EXDEV): fall back to copy+remove.
                    if copy_tree(ctx.fs, &src_path, &target, true)
                        .and_then(|()| ctx.fs.remove(&src_path))
                        .is_err()
                    {
                        out.stderr(format!("mv: cannot move {source}\n").as_bytes());
                        status = 1;
                    }
                }
            }
        }
        BuiltinResult::fail(status)
    }
}
