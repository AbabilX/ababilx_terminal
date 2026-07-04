import { useRef, useState } from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import { TabItem } from "./header/TabItem";
import { WindowControls } from "./header/WindowControls";
import { useTerminalStore } from "../store/terminal";

export function AppHeader() {
  const { tabs, activeId, addTab, closeTab, setActive, reorderTab } =
    useTerminalStore();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const lastOverId = useRef<string | null>(null);

  return (
    <div
      data-tauri-drag-region
      className="flex h-10 shrink-0 items-center gap-1 border-b border-white/[0.06] px-2"
    >
      <div
        data-tauri-drag-region
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1.5"
      >
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            active={tab.id === activeId}
            dragging={draggingId === tab.id}
            onSelect={() => setActive(tab.id)}
            onClose={() => closeTab(tab.id)}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/tab-id", tab.id);
              e.dataTransfer.effectAllowed = "move";
              lastOverId.current = tab.id;
              setDraggingId(tab.id);
            }}
            onDragEnter={() => {
              if (
                draggingId &&
                draggingId !== tab.id &&
                lastOverId.current !== tab.id
              ) {
                lastOverId.current = tab.id;
                reorderTab(draggingId, tab.id);
              }
            }}
            onDragEnd={() => {
              setDraggingId(null);
              lastOverId.current = null;
            }}
          />
        ))}
        <button
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/[0.06] hover:text-gray-200"
          onClick={() => addTab()}
          aria-label="New tab"
        >
          <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} />
        </button>
      </div>
      <WindowControls />
    </div>
  );
}
