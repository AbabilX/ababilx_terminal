import type { Terminal } from "@xterm/xterm";

import { cellSize } from "./cellSize";
import type { LsEntry } from "./parseEntries";

/** Draws the gray index badges (and the border around the selected entry)
 * into `overlay`, positioned over the terminal canvas. */
export function renderBadges(
  term: Terminal,
  overlay: HTMLDivElement,
  entries: LsEntry[],
  selected: number,
  maxNumbered: number,
) {
  overlay.replaceChildren();

  const buf = term.buffer.active;
  const { w, h } = cellSize(term);
  const count = Math.min(entries.length, maxNumbered);

  for (let i = 0; i < count; i++) {
    const { name, row, col } = entries[i];
    const viewRow = row - buf.viewportY;
    if (viewRow < 0 || viewRow >= term.rows) continue;
    const x = col * w;
    const y = viewRow * h;

    const badge = document.createElement("span");
    badge.textContent = String(i);
    badge.style.cssText =
      `position:absolute;left:${x + name.length * w + 2}px;top:${y}px;` +
      `height:${h}px;line-height:${h}px;` +
      `font-size:${Math.max(9, Math.round(h * 0.55))}px;` +
      `font-family:${term.options.fontFamily ?? "monospace"};` +
      "color:#6e7681;";
    overlay.appendChild(badge);

    if (i === selected) {
      const box = document.createElement("div");
      box.style.cssText =
        `position:absolute;left:${x - 2}px;top:${y - 1}px;` +
        `width:${name.length * w + 4}px;height:${h + 2}px;` +
        "border:1px solid #58a6ff;border-radius:3px;";
      overlay.appendChild(box);
    }
  }
}
