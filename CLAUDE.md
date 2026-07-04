# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AbabilX Terminal: a Tauri (Rust) + React/TypeScript desktop terminal app that ships its **own shell language implementation** (not a PowerShell/CMD/Bash wrapper — AbabilX only spawns external executables directly via OS process APIs). The Rust side owns the entire shell pipeline (lex -> parse -> plan -> execute); the frontend is a thin renderer that talks to it over a small Tauri IPC/event contract.

## Commands

Frontend:
- `pnpm install` — install deps (pnpm workspace, single package)
- `pnpm dev` — Vite dev server only (no Tauri window)
- `pnpm tauri dev` — full app (Rust backend + webview), the normal way to run it
- `pnpm build` — `tsc` typecheck + Vite production build
- `pnpm tauri build` — production app bundle

Rust (workspace root, members = `src-tauri` + `crates/*`):
- `cargo build` — build everything
- `cargo test` — run all crate tests
- `cargo test -p ababil-shell` (or `ababil-runtime`, `ababil-parser`, `ababil-exec`, `ababil-session`, `ababil-config`, `ababil-workspace`) — test a single crate
- `cargo test -p ababil-shell --test shell` — run one test file (e.g. `crates/ababil-shell/tests/shell.rs`)
- `cargo test <test_name>` — run a single test by name substring
- `cargo clippy` — lint

## Architecture

The shell engine is a strict layered pipeline, each layer a separate crate, each testable without a GUI:

```
ababil-parser   text -> tokens -> AST (Program). Pure; no FS/env/process access.
ababil-runtime  AST -> ExecutionPlan (plan.rs) -> executed against ShellState
                via pluggable traits (traits.rs): FileSystem, ProcessLauncher,
                OutputSink. Builtins live under builtins/ (env, nav, misc).
                Variable/tilde/glob expansion happens here (expand.rs, glob.rs),
                not in the parser — that's why ast::Word keeps parts unexpanded.
ababil-exec     ProcessLauncher impls: NativeLauncher (piped stdio, for
                pipeline stages) and PtyLauncher (pseudo-terminal, for the
                interactive foreground command — colors/resize/TUI).
ababil-shell    Session: owns ShellState + Runtime, records history, expands
                aliases (alias.rs), drives one eval() call per input line.
                One Session per terminal tab.
ababil-session  TerminalSession: the stable frontend-facing boundary. Exposes
                run_line/write_stdin/cancel/resize and emits ShellEvent to an
                EventSink. This is the only contract the frontend or any
                future UI is allowed to depend on — never talk to Session,
                Runtime, or processes directly from outside this crate.
ababil-config   Layered JSON config store (defaults -> user -> workspace ->
                project -> runtime overrides), VSCode-style deep merge.
ababil-workspace Serializable layout model (tabs / split panes / per-pane cwd)
                for persisting and restoring window layout across restarts.
                Running processes are never revived.
```

Data/control flow for one command: keystroke in `Terminal.tsx` -> `ShellSession.run()` (src/terminal/session.ts) -> Tauri `invoke("session_run")` -> `commands::session::session_run` -> `TerminalSession` -> `Session` -> lex/parse/plan/execute -> results stream back as `ShellEvent`s over the `shell-event` Tauri event channel -> `TauriEventSink` (src-tauri/src/commands/session.rs) tags them with `session_id` -> frontend `ShellSession.onEvent` dispatches to the terminal renderer.

`src/terminal/events.ts` is a hand-kept mirror of the Rust `ShellEvent` enum (`ababil-session/src/events.rs`) — when adding/changing a `ShellEvent` variant, update both sides.

**Two IPC command sets exist in `src-tauri/src/commands/`**: `session.rs` (backed by `ababil-session`/`ababil-shell`, the real shell engine — what the current frontend uses via `ShellSession`) and `terminal.rs` + `src-tauri/src/pty/` (a separate, older raw-PTY command set: `ping`/`create_session`/`write_to_session`/etc., driven by `PtyManager`). Know which one you're touching — they are not interchangeable and don't share state.

### Frontend layout

- `src/terminal/` — the Tauri IPC boundary (`session.ts`) and event types (`events.ts`); also `renderer.ts` / `xtermRenderer.ts` for rendering shell output into xterm.js.
- `src/store/terminal.ts` — Zustand store for tabs/panes (tab titles are randomized from a flower-name list; drag-and-drop reordering via `reorderTab`).
- `src/store/settings.ts` — loads settings from the Rust `read_settings` command (backed by `ababil-config`), merged over `DEFAULT_SETTINGS`.
- `src/components/terminal/` — `Terminal.tsx`, `TerminalTab.tsx`, `TerminalTabs.tsx`.
- Window chrome: `AppHeader.tsx`; the window itself has decorations disabled (`window.set_decorations(false)`) and app draws its own title bar/controls.
