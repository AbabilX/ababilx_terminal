/**
 * Renders Rust `list_dir` results into styled ANSI terminal output.
 *
 * Our format (NOT PowerShell Get-ChildItem, NOT unix `ls -l`):
 *   - Directories first (bold blue with trailing `/`)
 *   - Files second (normal white, size in dim gray)
 *   - Multi-column layout that fills the terminal width
 *   - Numbered badge hints (0-9) for the lsPicker overlay
 */

import type { DirEntry } from "../lib/tauri";
import type { LsEntry } from "./lsPicker/parseEntries";

// ANSI colour constants
const RESET   = "\x1b[0m";
const DIR_CLR = "\x1b[1;38;5;111m";   // bold steel-blue  (dirs)
const FILE_CLR = "\x1b[38;5;252m";    // soft white       (files)
const SIZE_CLR = "\x1b[38;5;244m";    // dim gray         (sizes)
const DIM     = "\x1b[2m";

/** Human-readable file size (B / K / M / G). */
function humanSize(bytes: number): string {
  if (bytes === 0) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}M`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}G`;
}

export interface LsRenderResult {
  /** ANSI text to write directly to the terminal (includes leading \r\n). */
  text: string;
  /** Pre-calculated overlay entries with exact buffer row positions.
   *  Pass directly to picker — no xterm buffer scraping needed. */
  dirEntries: LsEntry[];
}

/**
 * Formats `entries` (from Rust `list_dir`) into:
 *   - ANSI styled text for direct terminal.write() output
 *   - Exact LsEntry positions for the numbered overlay
 *
 * @param entries  Sorted entries from `list_dir` (dirs first).
 * @param termCols Terminal column count (from `terminal.cols`).
 * @param baseRow  Absolute buffer row BEFORE we start writing (baseY+cursorY).
 *                 Row 0 of our output = baseRow + 1 (after the leading \r\n).
 */
export function renderLsOutput(
  entries: DirEntry[],
  termCols: number,
  baseRow: number,
): LsRenderResult {
  const dirs  = entries.filter(e => e.is_dir);
  const files = entries.filter(e => !e.is_dir);

  // -------------------------------------------------------------------------
  // Column layout helpers
  // -------------------------------------------------------------------------
  function columnLayout(
    names: string[],      // visible names (without ANSI)
    color: string,
    suffix: string,       // e.g. "/" for dirs, "" for files
    extraRight: (i: number) => string,  // extra text right of the name (size)
    extraRightLen: (i: number) => number,
    startAbsRow: number,
  ): { text: string; rows: number; positions: Array<{ row: number; col: number }> } {
    if (names.length === 0) return { text: "", rows: 0, positions: [] };

    const visibleNames = names.map((n, i) => n + suffix + extraRight(i));
    const maxVis = Math.max(...visibleNames.map(n => n.length));
    const colWidth = maxVis + 2; // 2-space gap between columns
    const numCols  = Math.max(1, Math.floor(termCols / colWidth));
    const numRows  = Math.ceil(names.length / numCols);

    let text = "";
    const positions: Array<{ row: number; col: number }> = [];

    for (let i = 0; i < names.length; i++) {
      const col = (i % numCols) * colWidth;
      const row = startAbsRow + Math.floor(i / numCols);
      positions.push({ row, col });

      const extra     = extraRight(i);
      const extraLen  = extraRightLen(i);
      const nameOnly  = names[i] + suffix;
      const padSpaces = colWidth - nameOnly.length - extraLen;

      text += color + nameOnly + RESET
             + DIM + extra + RESET
             + " ".repeat(Math.max(0, padSpaces));

      if ((i + 1) % numCols === 0 || i === names.length - 1) {
        text += "\r\n";
      }
    }

    return { text, rows: numRows, positions };
  }

  // -------------------------------------------------------------------------
  // Render directories
  // -------------------------------------------------------------------------
  let currentRow = baseRow + 1; // +1 for the leading \r\n
  let bodyText = "";
  const dirLsEntries: LsEntry[] = [];

  if (dirs.length > 0) {
    const dirNames = dirs.map(d => d.name);
    const { text: dText, rows: dRows, positions } = columnLayout(
      dirNames,
      DIR_CLR,
      "/",
      () => "",
      () => 0,
      currentRow,
    );
    bodyText += dText;
    positions.forEach((pos, i) => {
      dirLsEntries.push({
        name: dirs[i].name + "/",
        is_dir: true,
        size: 0,
        row: pos.row,
        col: pos.col,
      });
    });
    currentRow += dRows;
  }

  // -------------------------------------------------------------------------
  // Render files
  // -------------------------------------------------------------------------
  if (files.length > 0) {
    if (dirs.length > 0) {
      // Blank separator line between dirs and files
      bodyText += "\r\n";
      currentRow++;
    }
    const fileNames = files.map(f => f.name);
    const fileSizes = files.map(f => humanSize(f.size));
    const { text: fText } = columnLayout(
      fileNames,
      FILE_CLR,
      "",
      (i) => (fileSizes[i] ? `  ${fileSizes[i]}` : ""),
      (i) => (fileSizes[i] ? 2 + fileSizes[i].length : 0),
      currentRow,
    );
    bodyText += fText;
  }

  // Show count summary line
  const summary = buildSummary(dirs.length, files.length);

  const text = "\r\n" + bodyText + summary;
  return { text, dirEntries: dirLsEntries };
}

function buildSummary(dirCount: number, fileCount: number): string {
  if (dirCount === 0 && fileCount === 0) return DIM + "(empty)" + RESET + "\r\n";
  const parts: string[] = [];
  if (dirCount > 0)  parts.push(`${dirCount} ${dirCount === 1 ? "dir" : "dirs"}`);
  if (fileCount > 0) parts.push(`${fileCount} ${fileCount === 1 ? "file" : "files"}`);
  return SIZE_CLR + parts.join(", ") + RESET + "\r\n";
}
