import type { IDisposable, Terminal } from "@xterm/xterm";

import { CmdHighlight } from "./cmdHighlight";
import { LineMirror } from "./lineMirror";
import { LsTracker } from "./tracker";
import { PickerOverlay } from "./overlay";

/** Numbers `ls` output 0-9; a digit borders an entry, Enter cds into it,
 * Esc / any other key dismisses. */
export class LsPicker {
  /** True while the overlay is showing and digit keys should be captured. */
  active = false;

  private overlay: PickerOverlay;
  private mirror: LineMirror;
  private highlight: CmdHighlight;
  private tracker: LsTracker;
  private scrollSub: IDisposable;

  constructor(term: Terminal, host: HTMLElement) {
    this.overlay = new PickerOverlay(term, host);
    this.mirror = new LineMirror(term);
    this.highlight = new CmdHighlight(term, host);
    this.tracker = new LsTracker(term, (entries) => {
      this.active = true;
      this.overlay.show(entries);
    });
    this.scrollSub = term.onScroll(() => {
      if (this.active) this.overlay.render();
    });
  }

  get line(): string | null {
    return this.mirror.line;
  }

  resetLine() {
    this.mirror.reset();
    this.updateHighlight();
  }

  noteInput(data: string) {
    for (const ch of data) {
      this.mirror.notePromptPos(ch);
      if (ch === "\r" || ch === "\n") this.onEnter();
      else this.mirror.noteChar(ch);
    }
  }

  /** Call after each PTY chunk has been written to the terminal buffer. */
  noteOutput() {
    // Echo of the user's keystrokes just landed: buffer is now accurate.
    this.updateHighlight();
    if (this.active) {
      this.dismiss(); // new output underneath would misalign the overlay
      return;
    }
    this.tracker.noteOutput();
  }

  select(index: number) {
    this.overlay.select(index);
  }

  /** Arms the tracker for a rewritten `ls -1p` sent from the input router. */
  armLs() {
    this.tracker.arm();
  }

  /** Command for the bordered entry; null when nothing selected. */
  commandForSelected(): string | null {
    if (!this.active) return null;
    const entry = this.overlay.selectedEntry;
    if (!entry) return null;
    const clean = entry.name.replace(/\/+$/, ""); // drop the `-p` trailing slash
    const name = clean.replace(/'/g, `'\\''`);
    this.dismiss();
    this.tracker.arm();
    return `cd '${name}' && ls -1p`;
  }

  dismiss() {
    this.tracker.cancel();
    this.active = false;
    this.overlay.clear();
  }

  dispose() {
    this.dismiss();
    this.highlight.remove();
    this.scrollSub.dispose();
  }

  private updateHighlight() {
    const { promptCol, promptRow } = this.mirror;
    this.highlight.update(this.line, promptCol, promptRow);
  }

  private onEnter() {
    // A plain `ls` is intercepted + rewritten in routeInput before it reaches
    // here, so this only resets state for every other Enter.
    this.mirror.reset();
    this.dismiss();
  }
}
