import { useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { useTerminalStore } from "../store/terminal";

const win = getCurrentWindow();

export function AppHeader() {
  const { tabs, activeId, addTab, closeTab, setActive, reorderTab } =
    useTerminalStore();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const lastOverId = useRef<string | null>(null);

  return (
    <div
      data-tauri-drag-region
      className="flex h-9 shrink-0 items-stretch bg-[#161b22]"
    >
      <div
        data-tauri-drag-region
        className="flex flex-1 items-stretch overflow-x-auto"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <div
              key={tab.id}
              draggable
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
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={() => {
                setDraggingId(null);
                lastOverId.current = null;
              }}
              onClick={() => setActive(tab.id)}
              className={`group flex min-w-[120px] max-w-[200px] cursor-pointer items-center gap-2 border-r border-[#0d1117] px-3 text-xs ${
                draggingId === tab.id ? "opacity-40" : ""
              } ${
                active
                  ? "bg-[#0d1117] text-gray-200"
                  : "text-gray-500 hover:bg-[#1c2128] hover:text-gray-300"
              }`}
            >
              <span className="truncate">{tab.title}</span>
              <button
                className="ml-auto rounded p-0.5 text-gray-500 opacity-0 hover:bg-[#30363d] hover:text-white group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                aria-label="Close tab"
              >
                &#10005;
              </button>
            </div>
          );
        })}
        <button
          className="flex w-9 shrink-0 items-center justify-center text-gray-500 hover:bg-[#1c2128] hover:text-gray-200"
          onClick={() => addTab()}
          aria-label="New tab"
        >
          +
        </button>
      </div>
      <div className="flex shrink-0 items-stretch">
        <button
          className="flex w-11 items-center justify-center text-gray-400 hover:bg-[#30363d] hover:text-white"
          onClick={() => win.minimize()}
          aria-label="Minimize"
        >
          &#8211;
        </button>
        <button
          className="flex w-11 items-center justify-center text-gray-400 hover:bg-[#30363d] hover:text-white"
          onClick={() => win.toggleMaximize()}
          aria-label="Maximize"
        >
          &#9633;
        </button>
        <button
          className="flex w-11 items-center justify-center text-gray-400 hover:bg-red-600 hover:text-white"
          onClick={() => win.close()}
          aria-label="Close"
        >
          &#10005;
        </button>
      </div>
    </div>
  );
}
