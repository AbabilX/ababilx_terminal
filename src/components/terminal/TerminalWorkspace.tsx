import { useTerminalStore } from "../../store/terminal";
import { SplitDropOverlay } from "./SplitDropOverlay";
import { SplitTreeView } from "./SplitTreeView";
import { TerminalTabView } from "./TerminalTabView";

export function TerminalWorkspace() {
  const { tabs, activeId, splitRoot, dropTabOnPane } = useTerminalStore();

  if (splitRoot) {
    return (
      <div className="absolute inset-0">
        <SplitTreeView node={splitRoot} />
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <div
            key={tab.id}
            className={`absolute inset-0 ${isActive ? "visible" : "invisible"}`}
          >
            {isActive ? (
              <SplitDropOverlay
                onDropTab={(draggedId, direction) =>
                  dropTabOnPane(tab.id, draggedId, direction)
                }
              >
                <TerminalTabView tab={tab} visible />
              </SplitDropOverlay>
            ) : (
              <TerminalTabView tab={tab} visible={false} />
            )}
          </div>
        );
      })}
    </div>
  );
}
