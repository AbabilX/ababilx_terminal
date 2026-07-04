import { useRef, type CSSProperties } from "react";

import { computeSplitLayout, FULL_RECT, type Rect } from "../../store/splitTree";
import { useTerminalStore } from "../../store/terminal";
import type { TerminalTab } from "../../types/terminal";
import { SplitDivider } from "./SplitDivider";
import { SplitDropOverlay } from "./SplitDropOverlay";
import { TerminalTabView } from "./TerminalTabView";

/**
 * Every real tab — solo or a split group member — gets one permanent,
 * stably keyed slot here for its entire lifetime; only its rect/visibility
 * ever changes. Grouping (dragging one tab onto another) never removes or
 * re-adds a tab's slot, only tags it with a `groupId` — that's what keeps
 * every tab mounted forever, so merging, resizing, or collapsing a split
 * never kills/restarts a running shell.
 */
export function TerminalWorkspace() {
  const {
    tabs,
    activeId,
    dropTabOnPane,
    closeTab,
    returnPaneToTabs,
    resizeSplitBranch,
  } = useTerminalStore();
  const workspaceRef = useRef<HTMLDivElement>(null);

  const tabsById = new Map(tabs.map((tab) => [tab.id, tab]));
  const activeGroupTab = tabs.find((t) => t.id === activeId && t.splitGroup);
  const dividers = activeGroupTab?.splitGroup
    ? computeSplitLayout(activeGroupTab.splitGroup).dividers
    : [];

  return (
    <div ref={workspaceRef} className="absolute inset-0 overflow-hidden">
      {tabs
        .filter((tab) => !tab.splitGroup)
        .map((tab) => {
          const owner = tab.groupId ? tabsById.get(tab.groupId) : tab;
          const isActive = owner?.id === activeId;
          const rect = leafRect(tab, owner);

          return (
            <div
              key={tab.id}
              className={`absolute ${isActive ? "visible" : "invisible"}`}
              style={rectStyle(rect)}
            >
              <SplitDropOverlay
                onDropTab={(draggedId, direction) =>
                  dropTabOnPane(tab.id, draggedId, direction)
                }
              >
                <TerminalTabView
                  tab={tab}
                  visible={isActive}
                  showHeader={!!tab.groupId}
                  onClose={() => closeTab(tab.id)}
                  onReturn={() => returnPaneToTabs(tab.id)}
                />
              </SplitDropOverlay>
            </div>
          );
        })}

      {dividers.map((divider) => (
        <div key={divider.branchId} className="absolute z-30" style={dividerStyle(divider)}>
          <SplitDivider
            orientation={divider.orientation}
            branchRect={divider.branchRect}
            workspaceRef={workspaceRef}
            onResize={(ratio) =>
              resizeSplitBranch(divider.branchId, [ratio * 100, (1 - ratio) * 100])
            }
          />
        </div>
      ))}
    </div>
  );
}

function leafRect(tab: TerminalTab, owner: TerminalTab | undefined): Rect {
  if (!tab.groupId || !owner?.splitGroup) return FULL_RECT;
  const leaf = computeSplitLayout(owner.splitGroup).leaves.find((l) => l.tabId === tab.id);
  return leaf?.rect ?? FULL_RECT;
}

function rectStyle(rect: Rect): CSSProperties {
  return {
    top: `${rect.top}%`,
    left: `${rect.left}%`,
    width: `${rect.width}%`,
    height: `${rect.height}%`,
  };
}

function dividerStyle(divider: {
  orientation: "row" | "column";
  branchRect: Rect;
  linePosition: number;
}): CSSProperties {
  return divider.orientation === "row"
    ? {
        top: `${divider.branchRect.top}%`,
        height: `${divider.branchRect.height}%`,
        left: `calc(${divider.linePosition}% - 2px)`,
        width: "4px",
      }
    : {
        left: `${divider.branchRect.left}%`,
        width: `${divider.branchRect.width}%`,
        top: `calc(${divider.linePosition}% - 2px)`,
        height: "4px",
      };
}
