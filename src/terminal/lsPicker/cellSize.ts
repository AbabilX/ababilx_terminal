import type { Terminal } from "@xterm/xterm";

/** Pixel size of one terminal cell (render service, with DOM fallback). */
export function cellSize(term: Terminal): { w: number; h: number } {
  const dims = (
    term as unknown as {
      _core?: {
        _renderService?: {
          dimensions?: { css?: { cell?: { width: number; height: number } } };
        };
      };
    }
  )._core?._renderService?.dimensions?.css?.cell;
  if (dims?.width && dims?.height) return { w: dims.width, h: dims.height };
  const screen = term.element?.querySelector(".xterm-screen");
  if (screen instanceof HTMLElement && term.cols > 0) {
    return {
      w: screen.clientWidth / term.cols,
      h: screen.clientHeight / term.rows,
    };
  }
  return { w: 9, h: 17 };
}
