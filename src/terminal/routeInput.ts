import type { LsPicker } from "./lsPicker";
import { findAlias } from "../lib/aliases";
import { listDir, writeToSession } from "../lib/tauri";
import { useSettingsStore } from "../store/settings";
import { eraseChars } from "../lib/platform";
import type { CwdTracker } from "./cwdTracker";

export interface InputContext {
  sessionId: string;
  picker: LsPicker;
  cwdTracker: CwdTracker;
  preview: {
    isOpen: () => boolean;
    open: (arg: string) => void;
    close: () => void;
    showUsage: () => void;
  };
}

/** Routes one keystroke chunk: preview dialog, ls picker, `see`, or shell. */
export function routeInput(ctx: InputContext, data: string) {
  const { sessionId, picker, cwdTracker, preview } = ctx;

  // While the preview dialog is open, swallow all input; Esc closes it.
  if (preview.isOpen()) {
    if (data === "\x1b") preview.close();
    return;
  }

  if (picker.active) {
    if (/^[0-9]$/.test(data)) {
      picker.select(Number(data)); // consumed; not sent to the shell
      return;
    }
    if (data === "\x1b") {
      picker.dismiss(); // Esc: back to normal typing, nothing sent
      return;
    }
    if (data === "\r") {
      const cmd = picker.commandForSelected();
      if (cmd) {
        // Update CWD tracker for the cd that the picker is about to emit.
        cwdTracker.noteCommand(cmd, cwdTracker.homeDir);
        writeToSession(sessionId, cmd + "\r"); // cd into selected dir
        return;
      }
    }
    picker.dismiss();
  }

  if (data === "\r") {
    const raw = picker.line ?? "";
    const line = raw.trim();
    // Erase what the user actually typed (raw, incl. leading spaces) using
    // portable backspaces — Ctrl-U (\x15) is not a kill-line under PSReadLine's
    // default Windows edit mode and would echo as a literal `^U`.
    const erase = eraseChars(raw.length);

    // -----------------------------------------------------------------------
    // `see` — file preview command
    // -----------------------------------------------------------------------
    const m = line.match(/^see(?:\s+(.+))?$/);
    if (m) {
      writeToSession(sessionId, erase); // wipe the typed line from the shell
      picker.resetLine();
      if (m[1]) preview.open(m[1]);
      else preview.showUsage();
      return;
    }

    // -----------------------------------------------------------------------
    // Alias expansion
    // -----------------------------------------------------------------------
    const alias = line
      ? findAlias(useSettingsStore.getState().settings.aliases, line)
      : undefined;
    if (alias) {
      picker.resetLine();
      // Update CWD tracker for the cd that the alias expands to.
      cwdTracker.noteCommand(alias.func.trim(), cwdTracker.homeDir);
      // Erase + retype sent as ONE write to avoid Tauri invoke() race.
      writeToSession(sessionId, erase + alias.func.trim() + "\r");
      return;
    }

    // -----------------------------------------------------------------------
    // Plain `ls [path]` — Rust-native directory listing (all platforms)
    // -----------------------------------------------------------------------
    if (line && isPlainLs(line)) {
      picker.resetLine();

      // Resolve the path argument (if any) against the tracked CWD.
      const arg = line.replace(/^ls\b/, "").trim();
      const targetPath = arg || cwdTracker.cwd;

      // Kick off the Rust list_dir call. This runs in parallel with sending
      // `ls` to the PTY so the user sees native output. Once the PTY output
      // settles, the tracker matches positions in the xterm buffer to the
      // Rust-sourced directory names and renders the numbered overlay.
      listDir(targetPath).then((entries) => {
        picker.armLs(entries);
      }).catch(() => {
        // listDir failed (e.g. path doesn't exist) — no overlay, that's fine.
      });

      // Send the plain `ls` (or `ls <path>`) to the shell for display.
      // No flag rewriting: the OS shell can render however it likes; we get
      // directory data from Rust, not from parsing the shell output format.
      writeToSession(sessionId, erase + line + "\r");
      return;
    }

    // -----------------------------------------------------------------------
    // Track `cd` commands so CwdTracker stays in sync
    // -----------------------------------------------------------------------
    if (line) {
      cwdTracker.noteCommand(line, cwdTracker.homeDir);
    }
  }

  picker.noteInput(data);
  writeToSession(sessionId, data);
}

/** True when `line` is a plain `ls` (no flags). Users adding flags have chosen
 * their own format and the overlay should not interfere. */
function isPlainLs(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  return tokens[0] === "ls" && !tokens.some((t) => t.startsWith("-"));
}
