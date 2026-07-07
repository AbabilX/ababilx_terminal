import { useEffect, useRef, useState } from "react";
import { useUiStore } from "../store/ui";
import { useTerminalStore } from "../store/terminal";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface PaletteCommand {
  id: string;
  name: string;
  category?: string;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette() {
  const { commandPaletteOpen, closeCommandPalette, openSettings } = useUiStore();
  const { tabs, activeId, addTab, splitRight, closeTab, setActive } = useTerminalStore();

  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Setup list of commands
  const commands: PaletteCommand[] = [
    {
      id: "new-tab",
      name: "New Tab",
      category: "Terminal",
      shortcut: "Ctrl + T",
      action: () => addTab(),
    },
    {
      id: "split-pane",
      name: "Split Pane Vertically",
      category: "Terminal",
      shortcut: "Ctrl + Shift + D",
      action: () => splitRight(),
    },
    {
      id: "close-tab",
      name: "Close Current Tab",
      category: "Terminal",
      shortcut: "Ctrl + W",
      action: () => {
        if (activeId) closeTab(activeId);
      },
    },
    {
      id: "settings",
      name: "Preferences: Open User Settings",
      category: "Preferences",
      shortcut: "Ctrl + ,",
      action: () => openSettings(),
    },
    {
      id: "fullscreen",
      name: "View: Toggle Fullscreen Mode",
      category: "View",
      shortcut: "F11",
      action: () => {
        getCurrentWindow().isFullscreen().then((fullscreen) => {
          getCurrentWindow().setFullscreen(!fullscreen);
        });
      },
    },
  ];

  // Add tabs to the commands list so user can search and switch to them!
  tabs.forEach((tab, index) => {
    commands.push({
      id: `switch-tab-${tab.id}`,
      name: `Switch to Tab: ${tab.title || `Tab ${index + 1}`}`,
      category: "Navigation",
      shortcut: `Alt + ${index + 1}`,
      action: () => setActive(tab.id),
    });
  });

  // Filter commands
  const filtered = commands.filter((cmd) =>
    cmd.name.toLowerCase().includes(search.toLowerCase()) ||
    (cmd.category && cmd.category.toLowerCase().includes(search.toLowerCase()))
  );

  // Focus input when opened
  useEffect(() => {
    if (commandPaletteOpen) {
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  // Click outside listener
  useEffect(() => {
    if (!commandPaletteOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeCommandPalette();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [commandPaletteOpen, closeCommandPalette]);

  // Key handler
  useEffect(() => {
    if (!commandPaletteOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
          closeCommandPalette();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeCommandPalette();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandPaletteOpen, filtered, selectedIndex, closeCommandPalette]);

  if (!commandPaletteOpen) return null;

  return (
    <div className="absolute inset-0 z-[100] flex justify-center bg-black/45 backdrop-blur-xs select-none">
      <div
        ref={containerRef}
        className="mt-[50px] flex h-fit w-full max-w-[500px] flex-col rounded-lg border border-[var(--ui-border)] bg-[#1e1e1e] text-[var(--ui-text)] shadow-2xl overflow-hidden"
        style={{
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Search input field */}
        <div className="p-2 border-b border-[var(--ui-border-subtle)]">
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-[#252526] px-3 py-1.5 text-[13px] text-white border border-[#007acc] rounded-md outline-none placeholder:text-[var(--ui-text-faint)]"
            placeholder="Search commands (e.g. New Tab, Switch to Tab...)"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
          />
        </div>

        {/* Commands list */}
        <div className="max-h-[300px] overflow-y-auto py-1">
          {filtered.length > 0 ? (
            filtered.map((cmd, i) => {
              const isActive = i === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  className={`flex items-center justify-between px-3 py-1.5 text-[12px] cursor-pointer ${
                    isActive
                      ? "bg-[#007acc] text-white"
                      : "text-[var(--ui-text-secondary)] hover:bg-[#2a2d2e]"
                  }`}
                  onClick={() => {
                    cmd.action();
                    closeCommandPalette();
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <div className="flex items-center gap-2 truncate">
                    {cmd.category && (
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                        isActive ? "bg-white/20 text-white" : "bg-[#2d2d2d] text-[var(--ui-text-muted)]"
                      }`}>
                        {cmd.category}
                      </span>
                    )}
                    <span className="truncate">{cmd.name}</span>
                  </div>
                  {cmd.shortcut && (
                    <span className={`text-[10.5px] font-mono ${isActive ? "text-white/80" : "text-[var(--ui-text-faint)]"}`}>
                      {cmd.shortcut}
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            <div className="px-3 py-4 text-center text-[12px] text-[var(--ui-text-muted)]">
              No commands found matching "{search}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
