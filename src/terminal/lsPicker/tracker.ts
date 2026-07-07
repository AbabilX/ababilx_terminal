import type { Terminal } from "@xterm/xterm";

import { resolvePositions, type LsEntry } from "./parseEntries";
import type { DirEntry } from "../../lib/tauri";

const SETTLE_MS = 150;

/**
 * Bridges between the Rust `list_dir` result and the overlay renderer.
 *
 * Flow:
 *  1. routeInput calls `setRustEntries()` with Rust DirEntry[] immediately
 *     when the user presses Enter on a plain `ls`.
 *  2. The plain `ls` is forwarded to the PTY; its output appears in xterm.
 *  3. `noteOutput()` is called after each PTY chunk. Once output settles
 *     (SETTLE_MS with no new chunks) we scan the xterm buffer to resolve
 *     pixel positions for each directory name (we already know which entries
 *     ARE directories from Rust — we just need WHERE they appear).
 *  4. Calls `onEntries` with fully positioned LsEntry[].
 *
 * This hybrid approach gives cross-platform correctness (Rust source of truth)
 * while keeping accurate badge placement (buffer scan for positions only).
 */
export class LsTracker {
  private rustDirs: DirEntry[] = [];
  private awaiting = false;
  private startRow = 0;
  private timer: number | undefined;

  constructor(
    private term: Terminal,
    private onEntries: (entries: LsEntry[]) => void,
  ) {}

  /**
   * Called by routeInput immediately when the user types a plain `ls`.
   * Stores the Rust directory list and arms the position-resolve pass.
   */
  setRustEntries(entries: DirEntry[], startRow: number) {
    this.rustDirs = entries.filter((e) => e.is_dir);
    this.startRow = startRow;
    this.awaiting = true;
  }

  /** Debounced: resolve positions once PTY output settles. */
  noteOutput() {
    if (!this.awaiting) return;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.awaiting = false;
      if (this.rustDirs.length === 0) return;

      const rawEntries = this.rustDirs.map((e) => ({ name: e.name }));
      const positions = resolvePositions(this.term, this.startRow, rawEntries);

      const lsEntries: LsEntry[] = this.rustDirs
        .map((e, i) => ({
          name: e.name + "/",
          is_dir: true,
          size: 0,
          row: positions[i].row,
          col: positions[i].col,
        }))
        .filter((e) => e.row >= 0); // skip entries whose row couldn't be found

      if (lsEntries.length > 0) this.onEntries(lsEntries);
    }, SETTLE_MS);
  }

  cancel() {
    this.awaiting = false;
    this.rustDirs = [];
    window.clearTimeout(this.timer);
  }

  /** True when `line` is a plain ls with no flags. */
  static isPlainLs(line: string): boolean {
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    return tokens[0] === "ls" && !tokens.some((t) => t.startsWith("-"));
  }
}
