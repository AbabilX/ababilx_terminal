import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, TerminalIcon } from "@hugeicons/core-free-icons";

import type { TerminalTab } from "../../types/terminal";

interface TabItemProps {
  tab: TerminalTab;
  active: boolean;
  dragging: boolean;
  onSelect: () => void;
  onClose: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
}

export function TabItem({
  tab,
  active,
  dragging,
  onSelect,
  onClose,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: TabItemProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`group flex h-7 min-w-[120px] max-w-[200px] cursor-pointer select-none items-center gap-2 rounded-md px-2.5 text-xs transition-colors ${
        dragging ? "opacity-40" : ""
      } ${
        active
          ? "bg-white/[0.09] text-gray-100 shadow-sm"
          : "text-gray-500 hover:bg-white/[0.04] hover:text-gray-300"
      }`}
    >
      <HugeiconsIcon
        icon={TerminalIcon}
        size={13}
        className={active ? "shrink-0 text-gray-300" : "shrink-0"}
        strokeWidth={2}
      />
      <span className="truncate">{tab.title}</span>
      <button
        className="ml-auto flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded text-gray-500 opacity-0 transition-opacity hover:bg-white/10 hover:text-white group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close tab"
      >
        <HugeiconsIcon icon={Cancel01Icon} size={11} strokeWidth={2} />
      </button>
    </div>
  );
}
