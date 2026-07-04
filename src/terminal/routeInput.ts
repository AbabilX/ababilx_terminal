import type { LsPicker } from "./lsPicker";
import { LsTracker } from "./lsPicker/tracker";
import { findAlias } from "../lib/aliases";
import { writeToSession } from "../lib/tauri";
import { useSettingsStore } from "../store/settings";

export interface InputContext {
  sessionId: string;
  picker: LsPicker;
  preview: {
    isOpen: () => boolean;
    open: (arg: string) => void;
    close: () => void;
    showUsage: () => void;
  };
}

/** Routes one keystroke chunk: preview dialog, ls picker, `see`, or shell. */
export function routeInput(ctx: InputContext, data: string) {
  const { sessionId, picker, preview } = ctx;

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
        writeToSession(sessionId, cmd + "\r"); // cd into it + list inside
        return;
      }
    }
    picker.dismiss();
  }

  if (data === "\r") {
    const line = picker.line?.trim();
    const m = line?.match(/^see(?:\s+(.+))?$/);
    if (m) {
      writeToSession(sessionId, "\x15"); // wipe the typed line from the shell
      picker.resetLine();
      if (m[1]) preview.open(m[1]);
      else preview.showUsage();
      return;
    }

    const alias = line ? findAlias(useSettingsStore.getState().settings.aliases, line) : undefined;
    if (alias) {
      picker.resetLine();
      // Kill-line + retype sent as ONE write: two separate invoke() calls
      // race under Tauri (no cross-call ordering guarantee), which only
      // shows up once the release build is fast enough to expose it.
      writeToSession(sessionId, "\x15" + alias.func.trim() + "\r");
      return;
    }

    // Plain `ls` → re-issue as `ls -1p` so the picker can number folders only
    // (trailing `/`) and survive spaced names (one entry per line).
    if (line && LsTracker.isPlainLs(line)) {
      picker.resetLine();
      picker.armLs(); // arm before output arrives
      writeToSession(sessionId, "\x15" + LsTracker.rewriteWithFlags(line) + "\r");
      return;
    }
  }

  picker.noteInput(data);
  writeToSession(sessionId, data);
}
