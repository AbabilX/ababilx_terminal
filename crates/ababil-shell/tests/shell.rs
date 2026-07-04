//! End-to-end shell tests: real filesystem (temp dir), native launcher.

use std::path::PathBuf;
use std::sync::Arc;

use ababil_exec::NativeLauncher;
use ababil_runtime::fs::RealFs;
use ababil_runtime::traits::CaptureSink;
use ababil_runtime::{Effect, Runtime, ShellState};
use ababil_shell::Session;

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir()
        .join("ababil-tests")
        .join(format!("{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir.canonicalize().unwrap()
}

fn session_at(dir: &PathBuf) -> Session {
    let runtime = Runtime::new(Arc::new(RealFs), Arc::new(NativeLauncher));
    let mut state = ShellState::new_at(dir.clone());
    state.env = std::env::vars().collect();
    Session::with_state(runtime, state)
}

fn eval(session: &mut Session, line: &str) -> (i32, String, String) {
    let mut sink = CaptureSink::default();
    let result = session.eval(line, &mut sink);
    (result.status, sink.stdout_string(), sink.stderr_string())
}

#[test]
fn pwd_and_cd() {
    let dir = temp_dir("cd");
    std::fs::create_dir(dir.join("sub")).unwrap();
    let mut s = session_at(&dir);

    let (status, out, _) = eval(&mut s, "pwd");
    assert_eq!(status, 0);
    assert!(out.trim().ends_with("cd-") == false && out.contains("ababil-tests"));

    let (status, _, _) = eval(&mut s, "cd sub");
    assert_eq!(status, 0);
    assert!(s.state().cwd.ends_with("sub"));

    let (status, _, _) = eval(&mut s, "cd -");
    assert_eq!(status, 0);
    assert!(!s.state().cwd.ends_with("sub"));

    let (status, _, err) = eval(&mut s, "cd no-such-dir");
    assert_eq!(status, 1);
    assert!(err.contains("cd:"));
}

#[test]
fn echo_variables_and_status() {
    let dir = temp_dir("echo");
    let mut s = session_at(&dir);
    eval(&mut s, "export GREET=hello");
    let (_, out, _) = eval(&mut s, r#"echo $GREET "quoted $GREET" '$GREET'"#);
    assert_eq!(out, "hello quoted hello $GREET\n");

    eval(&mut s, "cd no-such-dir");
    let (_, out, _) = eval(&mut s, "echo $STATUS");
    assert_eq!(out.trim(), "1");
}

#[test]
fn connectors() {
    let dir = temp_dir("conn");
    let mut s = session_at(&dir);
    let (_, out, _) = eval(&mut s, "echo a && echo b || echo c");
    assert_eq!(out, "a\nb\n");
    let (_, out, _) = eval(&mut s, "cd nope && echo yes || echo no");
    assert_eq!(out, "no\n");
    let (_, out, _) = eval(&mut s, "echo one; echo two");
    assert_eq!(out, "one\ntwo\n");
}

#[test]
fn redirects_and_glob() {
    let dir = temp_dir("redir");
    let mut s = session_at(&dir);
    eval(&mut s, "echo alpha > a.txt");
    eval(&mut s, "echo beta >> a.txt");
    let content = std::fs::read_to_string(dir.join("a.txt")).unwrap();
    assert_eq!(content, "alpha\nbeta\n");

    eval(&mut s, "echo x > b.log");
    let (_, out, _) = eval(&mut s, "echo *.txt");
    assert_eq!(out.trim(), "a.txt");
    // Quoted glob stays literal.
    let (_, out, _) = eval(&mut s, r#"echo "*.txt""#);
    assert_eq!(out.trim(), "*.txt");
}

#[test]
fn aliases() {
    let dir = temp_dir("alias");
    let mut s = session_at(&dir);
    eval(&mut s, "alias greet=echo");
    let (_, out, _) = eval(&mut s, "greet hi");
    assert_eq!(out, "hi\n");

    // Recursive alias must not loop.
    eval(&mut s, "alias echo='echo prefixed'");
    let (_, out, _) = eval(&mut s, "echo hi");
    assert_eq!(out, "prefixed hi\n");

    eval(&mut s, "unalias echo greet");
    let (_, out, _) = eval(&mut s, "echo hi");
    assert_eq!(out, "hi\n");
}

#[test]
fn history_and_help_and_which() {
    let dir = temp_dir("hist");
    let mut s = session_at(&dir);
    eval(&mut s, "echo one");
    eval(&mut s, "echo one"); // consecutive duplicate: recorded once
    eval(&mut s, "pwd");
    let (_, out, _) = eval(&mut s, "history");
    assert_eq!(out.matches("echo one").count(), 1);
    assert!(out.contains("pwd"));

    let (_, out, _) = eval(&mut s, "which cd");
    assert_eq!(out.trim(), "cd: shell builtin");

    let (_, out, _) = eval(&mut s, "help");
    assert!(out.contains("alias"));
    assert!(out.contains("history"));
}

#[test]
fn command_not_found_and_parse_error() {
    let dir = temp_dir("nf");
    let mut s = session_at(&dir);
    let (status, _, err) = eval(&mut s, "definitely-not-a-command-xyz");
    assert_eq!(status, 127);
    assert!(err.contains("command not found"));

    let (status, _, err) = eval(&mut s, "echo 'unterminated");
    assert_eq!(status, 2);
    assert!(err.contains("parse error"));
}

#[test]
fn exit_effect() {
    let dir = temp_dir("exit");
    let mut s = session_at(&dir);
    let mut sink = CaptureSink::default();
    let result = s.eval("exit 3; echo never", &mut sink);
    assert_eq!(result.status, 3);
    assert!(result.effects.contains(&Effect::Exit(3)));
    assert!(!sink.stdout_string().contains("never"));
}

#[test]
fn clear_effect_and_ls() {
    let dir = temp_dir("ls");
    std::fs::create_dir(dir.join("subdir")).unwrap();
    std::fs::write(dir.join("file.txt"), b"x").unwrap();
    std::fs::write(dir.join(".hidden"), b"x").unwrap();
    let mut s = session_at(&dir);

    let (_, out, _) = eval(&mut s, "ls");
    assert!(out.contains("subdir/"));
    assert!(out.contains("file.txt"));
    assert!(!out.contains(".hidden"));

    let (_, out, _) = eval(&mut s, "ls -a");
    assert!(out.contains(".hidden"));

    let mut sink = CaptureSink::default();
    let result = s.eval("clear", &mut sink);
    assert!(result.effects.contains(&Effect::ClearScreen));
}

#[cfg(windows)]
#[test]
fn external_command_pipeline() {
    let dir = temp_dir("ext");
    let mut s = session_at(&dir);
    // findstr.exe ships with Windows; launched directly, no shell.
    eval(&mut s, "echo match-me > in.txt; echo skip >> in.txt");
    let (status, out, err) = eval(&mut s, "findstr match < in.txt");
    assert_eq!(status, 0, "stderr: {err}");
    assert!(out.contains("match-me"));
    assert!(!out.contains("skip"));

    let (status, out, _) = eval(&mut s, "echo hello | findstr hell");
    assert_eq!(status, 0);
    assert!(out.contains("hello"));
}
