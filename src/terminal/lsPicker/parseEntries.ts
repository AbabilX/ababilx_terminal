import type { Terminal } from "@xterm/xterm";

export interface LsEntry {
  name: string;
  /** Absolute buffer row of the line the name sits on. */
  row: number;
  /** Column of the first character of the name. */
  col: number;
}

/** Everything between the command line and the fresh prompt is ls output;
 * every whitespace-separated token becomes an entry. */
export function parseEntries(term: Terminal, startRow: number): LsEntry[] {
  const buf = term.buffer.active;
  if (buf.type !== "normal") return [];
  const endRow = buf.baseY + buf.cursorY;
  const entries: LsEntry[] = [];
  for (let row = startRow; row < endRow; row++) {
    const line = buf.getLine(row);
    if (!line) continue;
    const text = line.translateToString(true);
    for (const m of text.matchAll(/\S+/g)) {
      entries.push({ name: m[0], row, col: m.index ?? 0 });
    }
  }
  return entries;
}
