import { useState, type DragEvent, type ReactNode } from "react";

import type { SplitDirection } from "../../types/terminal";

interface SplitDropOverlayProps {
  children: ReactNode;
  onDropTab: (tabId: string, direction: SplitDirection) => void;
}

export function SplitDropOverlay({
  children,
  onDropTab,
}: SplitDropOverlayProps) {
  const [direction, setDirection] = useState<SplitDirection | null>(null);

  const updateDirection = (event: DragEvent<HTMLDivElement>) => {
    // NOTE: dataTransfer.getData() only returns real values on "drop"
    // (WebKit/Tauri restriction) — use .types to detect a tab drag mid-hover.
    if (!event.dataTransfer.types.includes("text/tab-id")) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDirection(getNearestEdge(event));
  };

  return (
    <div
      className="relative h-full w-full"
      onDragOver={updateDirection}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDirection(null);
        }
      }}
      onDrop={(event) => {
        const tabId = event.dataTransfer.getData("text/tab-id");
        if (!tabId || !direction) return;
        event.preventDefault();
        onDropTab(tabId, direction);
        setDirection(null);
      }}
    >
      {children}
      {direction && <DropPreview direction={direction} />}
    </div>
  );
}

function getNearestEdge(event: DragEvent<HTMLDivElement>): SplitDirection {
  const rect = event.currentTarget.getBoundingClientRect();
  const distances = {
    left: event.clientX - rect.left,
    right: rect.right - event.clientX,
    top: event.clientY - rect.top,
    bottom: rect.bottom - event.clientY,
  };

  return Object.entries(distances).reduce(
    (nearest, [side, distance]) =>
      distance < nearest.distance
        ? { side: side as SplitDirection, distance }
        : nearest,
    { side: "right" as SplitDirection, distance: Number.POSITIVE_INFINITY },
  ).side;
}

function DropPreview({ direction }: { direction: SplitDirection }) {
  const positionClass = {
    left: "left-0 top-0 h-full w-1/2",
    right: "right-0 top-0 h-full w-1/2",
    top: "left-0 top-0 h-1/2 w-full",
    bottom: "bottom-0 left-0 h-1/2 w-full",
  }[direction];

  return (
    <div className="pointer-events-none absolute inset-0 z-40 bg-black/10">
      <div
        className={`absolute ${positionClass} border-2 border-sky-400/80 bg-sky-400/15`}
      />
    </div>
  );
}
