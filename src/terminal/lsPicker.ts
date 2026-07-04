import type { IDisposable, Terminal } from "@xterm/xterm";

interface LsEntry {
  name: string;
  /** Absolute buffer row of the line the name sits on. */
  row: number;
  /** Column of the first character of the name. */
  col: number;
}

const MAX_NUMBERED = 10;
const SETTLE_MS = 200;

/**
 * Watches for a plain `ls` command and, once its output settles, overlays a
 * gray index (0-9) beside the first ten entries. Pressing that digit while
 * the overlay is up draws a border around the matching entry; pressing the
 * same digit again clears it, and any other key dismisses the overlay.
 */
export class LsPicker {
  /** True while the overlay is showing and digit keys should be captured. */
  active = false;

  private entries: LsEntry[] = [];
  private selected = -1;
  /** Mirror of the shell's edit buffer; null once we lose track of it. */
  private inputLine: string | null = "";
  private awaiting = false;
  private startRow = 0;
  private settleTimer: number | undefined;
  private overlay: HTMLDivElement | null = null;
  private scrollSub: IDisposable;

  constructor(
    private term: Terminal,
    private host: HTMLElement,
  ) {
    this.scrollSub = term.onScroll(() => {
      if (this.active) this.render();
    });
  }

  /** Feed every input chunk that is about to be sent to the shell. */
  noteInput(data: string) {
    for (const ch of data) {
      if (ch === "\r" || ch === "\n") {
        this.onEnter();
      } else if (ch === "\x7f" || ch === "\b") {
        if (this.inputLine !== null) {
          this.inputLine = this.inputLine.slice(0, -1);
        }
      } else if (ch < " ") {
        // Escape sequences and control chars (arrows, history, ^C…) mean the
        // shell's line no longer matches what we saw typed — stop tracking.
        this.inputLine = null;
      } else if (this.inputLine !== null) {
        this.inputLine += ch;
      }
    }
  }

  /** Call after each PTY chunk has been written to the terminal buffer. */
  noteOutput() {
    if (this.active) {
      // New output underneath would misalign the overlay.
      this.dismiss();
      return;
    }
    if (!this.awaiting) return;
    window.clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(() => this.parse(), SETTLE_MS);
  }

  /** Digit pressed while the overlay is active. */
  select(index: number) {
    if (index >= Math.min(this.entries.length, MAX_NUMBERED)) return;
    this.selected = this.selected === index ? -1 : index;
    this.render();
  }

  dismiss() {
    this.awaiting = false;
    this.active = false;
    this.selected = -1;
    this.entries = [];
    window.clearTimeout(this.settleTimer);
    this.overlay?.remove();
    this.overlay = null;
  }

  dispose() {
    this.dismiss();
    this.scrollSub.dispose();
  }

  private onEnter() {
    const line = this.inputLine;
    this.inputLine = "";
    this.dismiss();
    if (line === null) return;
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    if (tokens[0] !== "ls" || tokens.some((t) => t.startsWith("-"))) return;
    const buf = this.term.buffer.active;
    this.startRow = buf.baseY + buf.cursorY + 1;
    this.awaiting = true;
  }

  private parse() {
    this.awaiting = false;
    const buf = this.term.buffer.active;
    if (buf.type !== "normal") return;
    // Everything between the command line and the fresh prompt is ls output.
    const endRow = buf.baseY + buf.cursorY;
    this.entries = [];
    for (let row = this.startRow; row < endRow; row++) {
      const line = buf.getLine(row);
      if (!line) continue;
      const text = line.translateToString(true);
      for (const m of text.matchAll(/\S+/g)) {
        this.entries.push({ name: m[0], row, col: m.index ?? 0 });
      }
    }
    if (this.entries.length === 0) return;
    this.active = true;
    this.render();
  }

  private cellSize() {
    const dims = (
      this.term as unknown as {
        _core?: {
          _renderService?: {
            dimensions?: { css?: { cell?: { width: number; height: number } } };
          };
        };
      }
    )._core?._renderService?.dimensions?.css?.cell;
    if (dims?.width && dims?.height) return { w: dims.width, h: dims.height };
    const screen = this.term.element?.querySelector(".xterm-screen");
    if (screen instanceof HTMLElement && this.term.cols > 0) {
      return {
        w: screen.clientWidth / this.term.cols,
        h: screen.clientHeight / this.term.rows,
      };
    }
    return { w: 9, h: 17 };
  }

  private render() {
    if (!this.overlay) {
      this.overlay = document.createElement("div");
      this.overlay.style.cssText =
        "position:absolute;inset:0;pointer-events:none;z-index:10;overflow:hidden;";
      this.host.appendChild(this.overlay);
    }
    this.overlay.replaceChildren();

    const buf = this.term.buffer.active;
    const { w, h } = this.cellSize();
    const count = Math.min(this.entries.length, MAX_NUMBERED);

    for (let i = 0; i < count; i++) {
      const { name, row, col } = this.entries[i];
      const viewRow = row - buf.viewportY;
      if (viewRow < 0 || viewRow >= this.term.rows) continue;
      const x = col * w;
      const y = viewRow * h;

      const badge = document.createElement("span");
      badge.textContent = String(i);
      badge.style.cssText =
        `position:absolute;left:${x + name.length * w + 2}px;top:${y}px;` +
        `height:${h}px;line-height:${h}px;` +
        `font-size:${Math.max(9, Math.round(h * 0.55))}px;` +
        `font-family:${this.term.options.fontFamily ?? "monospace"};` +
        "color:#6e7681;";
      this.overlay.appendChild(badge);

      if (i === this.selected) {
        const box = document.createElement("div");
        box.style.cssText =
          `position:absolute;left:${x - 2}px;top:${y - 1}px;` +
          `width:${name.length * w + 4}px;height:${h + 2}px;` +
          "border:1px solid #58a6ff;border-radius:3px;";
        this.overlay.appendChild(box);
      }
    }
  }
}
