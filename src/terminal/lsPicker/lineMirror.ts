import type { Terminal } from "@xterm/xterm";

/**
 * Tracks the shell's current edit line. Prefers a keystroke mirror (exact
 * even before echo lands); falls back to reading the terminal buffer when
 * the mirror lost track (tab completion, history arrows), since by then the
 * shell has already rendered the real line.
 */
export class LineMirror {
  /** Mirror of the shell's edit buffer; null once we lose track of it. */
  private inputLine: string | null = "";
  /** Column where the typed text starts (prompt end), captured at the
   * first keystroke of each line; null before typing starts. */
  promptCol: number | null = null;
  /** Absolute buffer row of the line being typed. */
  promptRow = 0;

  constructor(private term: Terminal) {}

  get line(): string | null {
    return this.inputLine !== null ? this.inputLine : this.lineFromBuffer();
  }

  reset() {
    this.inputLine = "";
    this.promptCol = null;
  }

  /** First keystroke of a line: the echo hasn't landed yet, so the cursor
   * still sits at the end of the prompt — remember where. */
  notePromptPos(ch: string) {
    if (this.promptCol === null && ch !== "\r" && ch !== "\n") {
      const buf = this.term.buffer.active;
      this.promptCol = buf.cursorX;
      this.promptRow = buf.baseY + buf.cursorY;
    }
  }

  /** Feed one non-Enter keystroke. */
  noteChar(ch: string) {
    if (ch === "\x7f" || ch === "\b") {
      if (this.inputLine !== null) {
        this.inputLine = this.inputLine.slice(0, -1);
      }
    } else if (ch < " ") {
      // Control chars / escapes (tab completion, arrows, ^C…): the mirror
      // no longer matches the shell's line; the buffer fallback takes over.
      this.inputLine = null;
    } else if (this.inputLine !== null) {
      this.inputLine += ch;
    }
  }

  /** Reads the line being edited straight from the terminal buffer. */
  private lineFromBuffer(): string | null {
    if (this.promptCol === null) return null;
    const buf = this.term.buffer.active;
    const first = buf.getLine(this.promptRow);
    if (!first) return null;
    let text = first.translateToString(true);
    for (let row = this.promptRow + 1; row < buf.length; row++) {
      const l = buf.getLine(row);
      if (!l || !l.isWrapped) break;
      text += l.translateToString(true);
    }
    return text.slice(this.promptCol);
  }
}
