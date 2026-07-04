import { useCallback, useRef } from "react";

import type { Rect } from "../../store/splitTree";
import type { SplitOrientation } from "../../types/terminal";

const MIN_RATIO = 0.15;
const MAX_RATIO = 0.85;

interface SplitDividerProps {
  orientation: SplitOrientation;
  /** The branch's own rect (in % of the workspace) that this divider resizes within. */
  branchRect: Rect;
  workspaceRef: React.RefObject<HTMLDivElement | null>;
  /** Called with the new first-pane ratio (0–1) while dragging. */
  onResize: (ratio: number) => void;
}

export function SplitDivider({
  orientation,
  branchRect,
  workspaceRef,
  onResize,
}: SplitDividerProps) {
  const dragging = useRef(false);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const workspace = workspaceRef.current;
      if (!workspace) return;

      const workspaceRect = workspace.getBoundingClientRect();
      const branchPixelRect = {
        left: workspaceRect.left + (branchRect.left / 100) * workspaceRect.width,
        top: workspaceRect.top + (branchRect.top / 100) * workspaceRect.height,
        width: (branchRect.width / 100) * workspaceRect.width,
        height: (branchRect.height / 100) * workspaceRect.height,
      };
      dragging.current = true;

      const handleMove = (moveEvent: PointerEvent) => {
        if (!dragging.current) return;
        const raw =
          orientation === "row"
            ? (moveEvent.clientX - branchPixelRect.left) / branchPixelRect.width
            : (moveEvent.clientY - branchPixelRect.top) / branchPixelRect.height;
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
    [orientation, branchRect, workspaceRef, onResize],
  );

  return (
    <div
      onPointerDown={handlePointerDown}
      className={
        orientation === "row"
          ? "h-full w-full cursor-col-resize bg-transparent transition-colors hover:bg-sky-400/40"
          : "h-full w-full cursor-row-resize bg-transparent transition-colors hover:bg-sky-400/40"
      }
    />
  );
}
