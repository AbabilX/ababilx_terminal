/**
 * Renderer abstraction. Application code (blocks UI, panes, session glue)
 * depends on this interface only — never on xterm.js. `XtermRenderer` is the
 * first implementation; a GPU/native renderer replaces it without touching
 * application logic.
 */

export interface ScreenCell {
  text: string;
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/** Immutable capture of the visible screen, used to freeze a finished
 * command's output into a block. */
export interface ScreenSnapshot {
  cols: number;
  rows: number;
  lines: ScreenCell[][];
  /** Plain-text form, one string per line, for copy/search. */
  text: string[];
}

export interface RendererTheme {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  /** 16-color ANSI palette, index 0-15. */
  ansi: string[];
}

export interface TerminalRenderer {
  /** Mount into a DOM container and start rendering. */
  attach(container: HTMLElement): void;
  /** Unmount and release resources. Renderer may be re-attached later. */
  detach(): void;

  /** Feed raw output (ANSI/VT sequences included). */
  write(data: string): void;

  resize(cols: number, rows: number): void;
  clear(): void;
  snapshot(): ScreenSnapshot;

  /** Currently selected text, empty string when nothing is selected. */
  selection(): string;
  /** Find text on screen/scrollback; returns whether a match was focused. */
  search(term: string): boolean;

  applyTheme(theme: RendererTheme): void;

  /** User keystrokes captured by the renderer (interactive programs). */
  onInput(handler: (data: string) => void): void;
  /** Renderer-driven size changes (fit-to-container). */
  onResize(handler: (cols: number, rows: number) => void): void;

  readonly cols: number;
  readonly rows: number;
}
