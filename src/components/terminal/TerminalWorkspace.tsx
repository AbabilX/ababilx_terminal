import { useRef, type CSSProperties } from "react";

import { computeSplitLayout } from "../../store/splitTree";
import { useTerminalStore } from "../../store/terminal";
import { SplitDivider } from "./SplitDivider";
import { SplitDropOverlay } from "./SplitDropOverlay";
import { TerminalTabView } from "./TerminalTabView";

/**
 * Every top-bar tab — plain or a split group — gets one permanent, stably
 * keyed slot here; only its visibility/position ever changes. This is what
 * keeps every tab (and any panes nested inside a group) mounted forever, so
 * switching tabs or editing a split never kills/restarts a running shell.
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

  return (
    <div ref={workspaceRef} className="absolute inset-0 overflow-hidden">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        const visibilityClass = isActive ? "visible" : "invisible";

        if (!tab.splitGroup) {
          return (
            <div key={tab.id} className={`absolute inset-0 ${visibilityClass}`}>
              <SplitDropOverlay
                onDropTab={(draggedId, direction) =>
                  dropTabOnPane(tab.id, draggedId, direction)
                }
              >
                <TerminalTabView tab={tab} visible={isActive} />
              </SplitDropOverlay>
            </div>
          );
        }

        const layout = computeSplitLayout(tab.splitGroup);

        return (
          <div key={tab.id} className={`absolute inset-0 ${visibilityClass}`}>
            {layout.leaves.map(({ tab: leafTab, rect }) => (
              <div key={leafTab.id} className="absolute" style={rectStyle(rect)}>
                <SplitDropOverlay
                  onDropTab={(draggedId, direction) =>
                    dropTabOnPane(leafTab.id, draggedId, direction)
                  }
                >
                  <TerminalTabView
                    tab={leafTab}
                    visible={isActive}
                    showHeader
                    onClose={() => closeTab(leafTab.id)}
                    onReturn={() => returnPaneToTabs(leafTab.id)}
                  />
                </SplitDropOverlay>
              </div>
            ))}

            {layout.dividers.map((divider) => (
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
      })}
    </div>
  );
}

function rectStyle(rect: { top: number; left: number; width: number; height: number }): CSSProperties {
  return {
    top: `${rect.top}%`,
    left: `${rect.left}%`,
    width: `${rect.width}%`,
    height: `${rect.height}%`,
  };
}

function dividerStyle(divider: {
  orientation: "row" | "column";
  branchRect: { top: number; left: number; width: number; height: number };
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
