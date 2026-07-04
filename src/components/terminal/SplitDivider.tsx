import { useCallback, useRef } from "react";

import type { SplitOrientation } from "../../types/terminal";

const MIN_RATIO = 0.15;
const MAX_RATIO = 0.85;

interface SplitDividerProps {
  orientation: SplitOrientation;
  /** Called with the new first-pane ratio (0–1) while dragging. */
  onResize: (ratio: number) => void;
}

export function SplitDivider({ orientation, onResize }: SplitDividerProps) {
  const dragging = useRef(false);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const container = event.currentTarget.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      dragging.current = true;

      const handleMove = (moveEvent: PointerEvent) => {
        if (!dragging.current) return;
        const raw =
          orientation === "row"
            ? (moveEvent.clientX - rect.left) / rect.width
            : (moveEvent.clientY - rect.top) / rect.height;
        onResize(Math.min(MAX_RATIO, Math.max(MIN_RATIO, raw)));
      };

      const handleUp = () => {
        dragging.current = false;
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [orientation, onResize],
  );

  return (
    <div
      onPointerDown={handlePointerDown}
      className={
        orientation === "row"
          ? "w-1 shrink-0 cursor-col-resize bg-white/5 transition-colors hover:bg-sky-400/40"
          : "h-1 shrink-0 cursor-row-resize bg-white/5 transition-colors hover:bg-sky-400/40"
      }
    />
  );
}
