import { useEffect, useRef, useState, type CSSProperties } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  DashboardSquare03Icon,
  TerminalIcon,
} from "@hugeicons/core-free-icons";

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
  /** `"reorder"` (dropped near an edge) moves the tab; `"merge"` (dropped near
   * the center) drags it into a split with this tab — either way regardless
   * of which tab is currently active/visible. */
  onDropTab: (draggedId: string, zone: "reorder" | "merge") => void;
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
  onDropTab,
  onDragEnd,
}: TabItemProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(tab.title);
  const [hoverZone, setHoverZone] = useState<"reorder" | "merge" | null>(null);

  const zoneFromEvent = (e: React.DragEvent<HTMLDivElement>): "reorder" | "merge" => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    return ratio < 0.2 || ratio > 0.8 ? "reorder" : "merge";
  };

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

  const borderColor = tab.borderColor ?? "var(--ui-default-border-color)";
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
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("text/tab-id")) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setHoverZone(zoneFromEvent(e));
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setHoverZone(null);
          }
        }}
        onDrop={(e) => {
          const draggedId = e.dataTransfer.getData("text/tab-id");
          if (draggedId && draggedId !== tab.id && hoverZone) {
            e.preventDefault();
            onDropTab(draggedId, hoverZone);
          }
          setHoverZone(null);
        }}
        onDragEnd={onDragEnd}
        onClick={onSelect}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        style={style}
        title={tab.splitGroup ? "Split view — contains multiple panes" : undefined}
        className={`group flex h-7 min-w-[120px] max-w-[200px] cursor-pointer select-none items-center gap-2 rounded-md border px-2.5 text-xs transition-colors ${
          dragging ? "opacity-40" : ""
        } ${
          hoverZone === "merge"
            ? "ring-2 ring-sky-400/70"
            : hoverZone === "reorder"
              ? "outline outline-2 outline-offset-1 outline-sky-400/50"
              : ""
        } ${
          active
            ? "bg-[var(--ui-active-surface)] text-[var(--ui-text)] shadow-sm"
            : "text-[var(--ui-text-faint)] hover:bg-[var(--ui-surface)] hover:text-[var(--ui-text-muted)]"
        }`}
      >
        <HugeiconsIcon
          icon={tab.splitGroup ? DashboardSquare03Icon : TerminalIcon}
          size={13}
          className={active ? "shrink-0 text-[var(--ui-text-secondary)]" : "shrink-0"}
          strokeWidth={2}
        />
        {editing ? (
          <input
            ref={inputRef}
            className="min-w-0 flex-1 rounded bg-[var(--ui-overlay-strong-bg)] px-1 py-0.5 text-xs text-[var(--ui-text-strong)] outline-none ring-1 ring-[var(--ui-overlay-ring)]"
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
          className="ml-auto flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded text-[var(--ui-text-faint)] opacity-0 transition-opacity hover:bg-[var(--ui-hover-strong)] hover:text-[var(--ui-text-strong)] group-hover:opacity-100"
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
