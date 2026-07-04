/**
 * xterm.js implementation of `TerminalRenderer` — the only module in the
 * application allowed to import xterm.
 */

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

import type {
  RendererTheme,
  ScreenCell,
  ScreenSnapshot,
  TerminalRenderer,
} from "./renderer";

export class XtermRenderer implements TerminalRenderer {
  private term: Terminal;
  private fit: FitAddon;
  private inputHandlers: Array<(data: string) => void> = [];
  private resizeHandlers: Array<(cols: number, rows: number) => void> = [];
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    this.term = new Terminal({
      allowProposedApi: true,
      convertEol: true,
      cursorBlink: true,
      scrollback: 10_000,
    });
    this.fit = new FitAddon();
    this.term.loadAddon(this.fit);
    this.term.onData((data) => this.inputHandlers.forEach((h) => h(data)));
    this.term.onResize(({ cols, rows }) =>
      this.resizeHandlers.forEach((h) => h(cols, rows)),
    );
  }

  attach(container: HTMLElement): void {
    this.term.open(container);
    this.fit.fit();
    this.resizeObserver = new ResizeObserver(() => this.fit.fit());
    this.resizeObserver.observe(container);
  }

  detach(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.term.dispose();
  }

  write(data: string): void {
    this.term.write(data);
  }

  resize(cols: number, rows: number): void {
    this.term.resize(cols, rows);
  }

  clear(): void {
    this.term.clear();
  }

  snapshot(): ScreenSnapshot {
    const buffer = this.term.buffer.active;
    const lines: ScreenCell[][] = [];
    const text: string[] = [];
    for (let y = 0; y < buffer.length; y++) {
      const line = buffer.getLine(y);
      if (!line) continue;
      const cells: ScreenCell[] = [];
      for (let x = 0; x < line.length; x++) {
        const cell = line.getCell(x);
        if (!cell) continue;
        cells.push({
          text: cell.getChars() || " ",
          bold: !!cell.isBold(),
          italic: !!cell.isItalic(),
          underline: !!cell.isUnderline(),
        });
      }
      lines.push(cells);
      text.push(line.translateToString(true));
    }
    // Trim trailing blank lines so block snapshots stay tight.
    while (text.length > 0 && text[text.length - 1] === "") {
      text.pop();
      lines.pop();
    }
    return { cols: this.term.cols, rows: this.term.rows, lines, text };
  }

  selection(): string {
    return this.term.getSelection();
  }

  search(_term: string): boolean {
    // Search addon lands with the block UI phase.
    return false;
  }

  applyTheme(theme: RendererTheme): void {
    this.term.options.theme = {
      background: theme.background,
      foreground: theme.foreground,
      cursor: theme.cursor,
      selectionBackground: theme.selectionBackground,
      black: theme.ansi[0],
      red: theme.ansi[1],
      green: theme.ansi[2],
      yellow: theme.ansi[3],
      blue: theme.ansi[4],
      magenta: theme.ansi[5],
      cyan: theme.ansi[6],
      white: theme.ansi[7],
      brightBlack: theme.ansi[8],
      brightRed: theme.ansi[9],
      brightGreen: theme.ansi[10],
      brightYellow: theme.ansi[11],
      brightBlue: theme.ansi[12],
      brightMagenta: theme.ansi[13],
      brightCyan: theme.ansi[14],
      brightWhite: theme.ansi[15],
    };
  }

  onInput(handler: (data: string) => void): void {
    this.inputHandlers.push(handler);
  }

  onResize(handler: (cols: number, rows: number) => void): void {
    this.resizeHandlers.push(handler);
  }

  get cols(): number {
    return this.term.cols;
  }

  get rows(): number {
    return this.term.rows;
  }
}
