import { useState } from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Settings02Icon } from "@hugeicons/core-free-icons";

import { TabItem } from "./header/TabItem";
import { WindowControls } from "./header/WindowControls";
import { useTerminalStore } from "../store/terminal";
import { useUiStore } from "../store/ui";

export function AppHeader() {
  const {
    tabs,
    activeId,
    addTab,
    closeTab,
    setActive,
    renameTab,
    setTabBorderColor,
    reorderTab,
    dropTabOnPane,
  } = useTerminalStore();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const openSettings = useUiStore((s) => s.openSettings);

  return (
    <div
      data-tauri-drag-region
      className="flex h-10 shrink-0 items-center gap-2 border-b border-white/[0.06] px-3"
    >
      <WindowControls />
      <div
        data-tauri-drag-region
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1.5"
      >
        {tabs.filter((tab) => !tab.groupId).map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            active={tab.id === activeId}
            dragging={draggingId === tab.id}
            onSelect={() => setActive(tab.id)}
            onClose={() => closeTab(tab.id)}
            onRename={(title) => renameTab(tab.id, title)}
            onSetColor={(color) => setTabBorderColor(tab.id, color)}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/tab-id", tab.id);
              e.dataTransfer.setData("text/plain", tab.id);
              e.dataTransfer.effectAllowed = "move";
              setDraggingId(tab.id);
            }}
            onDropTab={(draggedId, zone) => {
              if (zone === "merge") {
                dropTabOnPane(tab.id, draggedId, "right");
              } else {
                reorderTab(draggedId, tab.id);
              }
            }}
            onDragEnd={() => setDraggingId(null)}
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
      <button
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/[0.06] hover:text-gray-200"
        onClick={() => openSettings()}
        aria-label="Settings"
      >
        <HugeiconsIcon icon={Settings02Icon} size={15} strokeWidth={2} />
      </button>
    </div>
  );
}
