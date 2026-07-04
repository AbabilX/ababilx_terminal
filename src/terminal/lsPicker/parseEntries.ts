import type { Terminal } from "@xterm/xterm";

export interface LsEntry {
  name: string;
  /** Absolute buffer row of the line the name sits on. */
  row: number;
  /** Column of the first character of the name. */
  col: number;
}

/** Everything between the command line and the fresh prompt is `ls -1p`
 * output: one entry per line. Only directories (trailing `/` from `-p`)
 * become entries — files are shown but never numbered. */
export function parseEntries(term: Terminal, startRow: number): LsEntry[] {
  const buf = term.buffer.active;
  if (buf.type !== "normal") return [];
  const endRow = buf.baseY + buf.cursorY;
  const entries: LsEntry[] = [];
  for (let row = startRow; row < endRow; row++) {
    const line = buf.getLine(row);
    if (!line) continue;
    const raw = line.translateToString(true);
    const name = raw.trim();
    if (!name.endsWith("/")) continue; // `-p`: directories only
    const col = raw.length - raw.trimStart().length; // leading indent (0 for -1)
    entries.push({ name, row, col });
  }
  return entries;
}
