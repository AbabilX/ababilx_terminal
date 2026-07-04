import type { Terminal } from "@xterm/xterm";

import { renderBadges } from "./badges";
import type { LsEntry } from "./parseEntries";

const MAX_NUMBERED = 10;
const OVERLAY_STYLE =
  "position:absolute;inset:0;pointer-events:none;z-index:10;overflow:hidden;";

/** Owns the badge/border DOM node plus the entries + selection it draws. */
export class PickerOverlay {
  entries: LsEntry[] = [];
  selected = -1;
  private el: HTMLDivElement | null = null;

  constructor(
    private term: Terminal,
    private host: HTMLElement,
  ) {}

  get selectedEntry(): LsEntry | null {
    return this.selected >= 0 ? this.entries[this.selected] : null;
  }

  show(entries: LsEntry[]) {
    this.entries = entries;
    this.selected = -1;
    this.render();
  }

  /** Toggles the border on `index`; no-op past the numbered range. */
  select(index: number) {
    if (index >= Math.min(this.entries.length, MAX_NUMBERED)) return;
    this.selected = this.selected === index ? -1 : index;
    this.render();
  }

  render() {
    if (!this.el) {
      this.el = document.createElement("div");
      this.el.style.cssText = OVERLAY_STYLE;
      this.host.appendChild(this.el);
    }
    renderBadges(this.term, this.el, this.entries, this.selected, MAX_NUMBERED);
  }

  clear() {
    this.entries = [];
    this.selected = -1;
    this.el?.remove();
    this.el = null;
  }
}
