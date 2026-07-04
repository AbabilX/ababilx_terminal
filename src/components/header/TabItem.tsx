import { useEffect, useRef, useState, type CSSProperties } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, TerminalIcon } from "@hugeicons/core-free-icons";

import type { TerminalTab } from "../../types/terminal";
import { TabContextMenu } from "./TabContextMenu";

interface TabItemProps {
  tab: TerminalTab;
  active: boolean;
  dragging: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename: (title: string) => void;
  onSetColor: (color: string | null) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

export function TabItem({
  tab,
  active,
  dragging,
  onSelect,
  onClose,
  onRename,
  onSetColor,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: TabItemProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(tab.title);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  useEffect(() => {
    if (editing) {
      setDraftTitle(tab.title);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing, tab.title]);

  const borderColor = tab.borderColor ?? "rgba(255,255,255,0.1)";
  const style: CSSProperties = {
    borderColor,
    boxShadow: active ? `inset 0 -2px 0 ${borderColor}` : undefined,
  };

  const commitRename = () => {
    onRename(draftTitle);
    setEditing(false);
  };

  return (
    <>
      <div
        draggable={!editing}
        onDragStart={onDragStart}
        onDragEnter={onDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragEnd={onDragEnd}
        onClick={onSelect}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        style={style}
        className={`group flex h-7 min-w-[120px] max-w-[200px] cursor-pointer select-none items-center gap-2 rounded-md border px-2.5 text-xs transition-colors ${
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
        {editing ? (
          <input
            ref={inputRef}
            className="min-w-0 flex-1 rounded bg-black/30 px-1 py-0.5 text-xs text-white outline-none ring-1 ring-white/20"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <span className="truncate">{tab.title}</span>
        )}
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
      {menu && (
        <TabContextMenu
          x={menu.x}
          y={menu.y}
          onRename={() => setEditing(true)}
          onSetColor={(color) => onSetColor(color)}
          onResetColor={() => onSetColor(null)}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}
