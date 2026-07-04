import type { LsPicker } from "./lsPicker";
import { writeToSession } from "../lib/tauri";

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
  }

  picker.noteInput(data);
  writeToSession(sessionId, data);
}
