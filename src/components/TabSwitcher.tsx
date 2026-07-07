import { useEffect, useRef, useState } from "react";
import { useUiStore } from "../store/ui";
import { useTerminalStore } from "../store/terminal";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Add01Icon } from "@hugeicons/core-free-icons";

export function TabSwitcher() {
  const { tabSwitcherOpen, closeTabSwitcher } = useUiStore();
  const { tabs, activeId, setActive, closeTab, addTab } = useTerminalStore();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Total items = active tabs + 1 (the "+ Add Tab" card)
  const totalItems = tabs.length + 1;

  // Handle key down for arrow navigation and activation
  useEffect(() => {
    if (!tabSwitcherOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % totalItems);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        // Move down a row (assume 3 items per row)
        setSelectedIndex((prev) => (prev + 3) % totalItems);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        // Move up a row
        setSelectedIndex((prev) => (prev - 3 + totalItems) % totalItems);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedIndex === tabs.length) {
          addTab();
          closeTabSwitcher();
        } else {
          const targetTab = tabs[selectedIndex];
          if (targetTab) {
            setActive(targetTab.id);
            closeTabSwitcher();
          }
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeTabSwitcher();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tabSwitcherOpen, selectedIndex, totalItems, tabs, setActive, closeTabSwitcher, addTab]);

  // Click outside to close
  useEffect(() => {
    if (!tabSwitcherOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeTabSwitcher();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [tabSwitcherOpen, closeTabSwitcher]);

  if (!tabSwitcherOpen) return null;

  return (
    <div className="absolute inset-0 z-[110] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md select-none p-10">
      <div
        ref={containerRef}
        className="w-full max-w-[850px] flex flex-col gap-6"
      >
        {/* Title */}
        <div className="text-center">
          <h2 className="text-xl font-medium text-white tracking-wide">Active Terminal Desktops</h2>
          <p className="text-[12px] text-[var(--ui-text-muted)] mt-1">
            Navigate with arrow keys, press Enter to select, Esc to close
          </p>
        </div>

        {/* Tab Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-h-[70vh] overflow-y-auto p-4 justify-center">
          {tabs.map((tab, i) => {
            const isSelected = i === selectedIndex;
            const isActive = tab.id === activeId;
            const borderColor = tab.borderColor ?? "var(--ui-default-border-color)";

            return (
              <div
                key={tab.id}
                onClick={() => {
                  setActive(tab.id);
                  closeTabSwitcher();
                }}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`relative flex flex-col w-full h-[150px] bg-[#1e1e1e] border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-[#007acc] scale-[1.03] border-transparent shadow-[0_0_15px_rgba(0,122,204,0.3)]"
                    : "border-white/10 hover:border-white/20 hover:scale-[1.01] shadow-lg"
                }`}
              >
                {/* Card Titlebar */}
                <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/5 bg-[#252526] text-xs">
                  <div className="flex items-center gap-2 truncate">
                    {/* Tiny colored dot representing tab color */}
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: borderColor }}
                    />
                    <span className="font-semibold text-white truncate">{tab.title}</span>
                    {isActive && (
                      <span className="text-[10px] bg-[#007acc] text-white px-1.5 py-0.2 rounded-full">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Close Tab Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                      // Adjust selected index if it is now out of bounds
                      if (selectedIndex >= tabs.length - 1) {
                        setSelectedIndex(Math.max(0, tabs.length - 2));
                      }
                    }}
                    className="p-1 rounded text-white/55 hover:bg-white/10 hover:text-white transition-colors"
                    title="Close Desktop"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={11} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Styled Terminal Preview area */}
                <div className="flex-1 p-3.5 font-mono text-[10.5px] leading-relaxed text-[#f3f4f6]/85 bg-[#181818] overflow-hidden select-none">
                  <div className="text-white/40 mb-1"># session_id: {tab.id.slice(0, 8)}</div>
                  <div>user@abaxana:~$ <span className="text-sky-400">ls -la</span></div>
                  <div className="text-[var(--ui-text-faint)] leading-tight mt-1 truncate">
                    drwxr-xr-x  15 user  staff   480 Jul  7 21:40 .
                  </div>
                  <div className="text-[var(--ui-text-faint)] leading-tight truncate">
                    drwxr-xr-x   6 user  staff   192 Jul  7 15:30 ..
                  </div>
                  <div className="text-[var(--ui-text-faint)] leading-tight truncate">
                    -rw-r--r--   1 user  staff  1248 Jul  7 21:35 App.tsx
                  </div>
                  {/* Cursor blink representation */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span>user@abaxana:~$</span>
                    <span className="w-1.5 h-3 bg-white/70 animate-pulse" />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add New Tab Card */}
          <div
            onClick={() => {
              addTab();
              closeTabSwitcher();
            }}
            onMouseEnter={() => setSelectedIndex(tabs.length)}
            className={`flex flex-col items-center justify-center w-full h-[150px] bg-[#1a1a1a]/50 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
              selectedIndex === tabs.length
                ? "border-[#007acc] bg-[#1a1a1a]/85 scale-[1.03] shadow-[0_0_15px_rgba(0,122,204,0.2)]"
                : "border-white/10 hover:border-white/20 hover:scale-[1.01]"
            }`}
          >
            <HugeiconsIcon
              icon={Add01Icon}
              size={24}
              strokeWidth={1.5}
              className={`transition-colors ${
                selectedIndex === tabs.length ? "text-[#007acc]" : "text-white/40"
              }`}
            />
            <span className={`text-[12px] font-semibold mt-2.5 transition-colors ${
              selectedIndex === tabs.length ? "text-white" : "text-white/40"
            }`}>
              New Terminal Desktop
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
