import type { Terminal } from "@xterm/xterm";

import { cellSize } from "./cellSize";
import { useSettingsStore } from "../../store/settings";

/** Commands handled by the app itself (never reach the shell). */
export const APP_COMMANDS = ["see"];

/**
 * Paints app commands ("see") yellow on the shell's edit line so the user
 * can tell them apart from real executables. Drawn as an overlay span
 * covering the echoed glyphs, positioned from the prompt column/row.
 */
export class CmdHighlight {
  private el: HTMLSpanElement | null = null;

  constructor(
    private term: Terminal,
    private host: HTMLElement,
  ) {}

  update(line: string | null, promptCol: number | null, promptRow: number) {
    const word = APP_COMMANDS.find(
      (c) => line !== null && (line === c || line.startsWith(c + " ")),
    );
    if (!word || promptCol === null) {
      this.remove();
      return;
    }

    const buf = this.term.buffer.active;
    const viewRow = promptRow - buf.viewportY;
    if (viewRow < 0 || viewRow >= this.term.rows) {
      // Scrolled out of view; skip rather than misplace it.
      this.remove();
      return;
    }

    const { w, h } = cellSize(this.term);
    if (!this.el) {
      this.el = document.createElement("span");
      this.el.style.cssText =
        "position:absolute;z-index:9;pointer-events:none;white-space:pre;";
      this.host.appendChild(this.el);
    }
    const o = this.el.style;
    o.left = `${promptCol * w}px`;
    o.top = `${viewRow * h}px`;
    o.height = `${h}px`;
    o.lineHeight = `${h}px`;
    o.fontSize = `${this.term.options.fontSize ?? 14}px`;
    o.fontFamily = this.term.options.fontFamily ?? "monospace";
    o.color = "#e3b341";
    // Solid settings background: must fully cover the shell's own (possibly
    // red) rendering of the word, so no alpha here.
    o.background = useSettingsStore.getState().settings.appearance.background;
    this.el.textContent = word;
  }

  remove() {
    this.el?.remove();
    this.el = null;
  }
}
