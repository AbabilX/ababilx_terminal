import type { Terminal } from "@xterm/xterm";

/** A single directory entry fed to the lsPicker overlay. */
export interface LsEntry {
  name: string;
  /** True for directories. */
  is_dir: boolean;
  /** File size in bytes; 0 for directories. */
  size: number;
  /** Absolute buffer row the name sits on (for overlay positioning). */
  row: number;
  /** Column of the first character (for overlay positioning). */
  col: number;
}

/**
 * Scan the terminal buffer between `startRow` (inclusive) and the current
 * cursor row (exclusive) to find pixel positions for each entry name.
 *
 * Previously this function was the *source of truth* for which entries were
 * directories (it looked for trailing `/` from `ls -p`). Now it is called
 * only to resolve buffer positions for Rust-sourced entries — the `is_dir`
 * flag comes from the Rust `list_dir` command instead.
 *
 * For each entry, we look for a buffer line that contains the entry's name
 * (with or without a trailing slash). If no matching line is found the entry
 * gets `row: -1` and `col: 0` and the badge renderer will skip it.
 */
export function resolvePositions(
  term: Terminal,
  startRow: number,
  entries: Pick<LsEntry, "name">[],
): Array<{ row: number; col: number }> {
  const buf = term.buffer.active;
  if (buf.type !== "normal") return entries.map(() => ({ row: -1, col: 0 }));

  const endRow = buf.baseY + buf.cursorY;

  // Build a map: bare name (no slash) → first buffer row + col where it appears.
  const posMap = new Map<string, { row: number; col: number }>();
  for (let row = startRow; row < endRow; row++) {
    const line = buf.getLine(row);
    if (!line) continue;
    const raw = line.translateToString(true);
    // Strip trailing slash (from `ls -p`), leading whitespace, and ANSI escapes.
    const stripped = raw.replace(/\x1b\[[0-9;]*m/g, "").trim().replace(/\/$/, "");
    if (stripped && !posMap.has(stripped)) {
      const col = raw.length - raw.trimStart().length;
      posMap.set(stripped, { row, col });
    }
  }

  return entries.map((e) => {
    const bare = e.name.replace(/\/$/, "");
    return posMap.get(bare) ?? { row: -1, col: 0 };
  });
}
