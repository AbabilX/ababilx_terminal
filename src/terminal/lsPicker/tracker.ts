import type { Terminal } from "@xterm/xterm";

import { parseEntries, type LsEntry } from "./parseEntries";

const SETTLE_MS = 200;

/** Arms after an `ls`, waits for its output to settle, parses the entries. */
export class LsTracker {
  private awaiting = false;
  private startRow = 0;
  private timer: number | undefined;

  constructor(
    private term: Terminal,
    private onEntries: (entries: LsEntry[]) => void,
  ) {}

  /** True when `line` is a plain ls (flags mean the user picked their own
   * layout — don't rewrite or number it). */
  static isPlainLs(line: string): boolean {
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    return tokens[0] === "ls" && !tokens.some((t) => t.startsWith("-"));
  }

  /** Rewrites a plain `ls [args]` to `ls -1p [args]`: `-1` (one entry per
   * line, so spaced names stay intact) + `-p` (trailing `/` marks folders). */
  static rewriteWithFlags(line: string): string {
    const rest = line.trim().replace(/^ls\b/, "").trim();
    return rest ? `ls -1p ${rest}` : "ls -1p";
  }

  /** Output of the next command starts one row below the cursor. */
  arm() {
    const buf = this.term.buffer.active;
    this.startRow = buf.baseY + buf.cursorY + 1;
    this.awaiting = true;
  }

  /** Debounced: parses once no new output arrived for SETTLE_MS. */
  noteOutput() {
    if (!this.awaiting) return;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.awaiting = false;
      const entries = parseEntries(this.term, this.startRow);
      if (entries.length > 0) this.onEntries(entries);
    }, SETTLE_MS);
  }

  cancel() {
    this.awaiting = false;
    window.clearTimeout(this.timer);
  }
}
