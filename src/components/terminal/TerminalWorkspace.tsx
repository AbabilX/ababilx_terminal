import type { SplitDirection } from "../../types/terminal";
import { useTerminalStore } from "../../store/terminal";
import { SplitDropOverlay } from "./SplitDropOverlay";
import { TerminalTabView } from "./TerminalTabView";

export function TerminalWorkspace() {
  const {
    tabs,
    activeId,
    splitLayout,
    closeTab,
    splitTabToSide,
    returnSplitToTabs,
  } = useTerminalStore();

  return (
    <SplitDropOverlay onDropTab={splitTabToSide}>
      {splitLayout ? (
        <div className={`absolute inset-0 flex ${splitClass(splitLayout.direction)}`}>
          {splitLayout.tabs.map((tab) => (
            <TerminalTabView
              key={tab.id}
              tab={tab}
              visible
              showHeader
              onClose={() => closeTab(tab.id)}
              onReturn={() => returnSplitToTabs(tab.id)}
            />
          ))}
        </div>
      ) : (
        tabs.map((tab) => (
          <div
            key={tab.id}
            className={`absolute inset-0 ${
              tab.id === activeId ? "visible" : "invisible"
            }`}
          >
            <TerminalTabView tab={tab} visible={tab.id === activeId} />
          </div>
        ))
      )}
    </SplitDropOverlay>
  );
}

function splitClass(direction: SplitDirection) {
  return direction === "top" || direction === "bottom" ? "flex-col" : "flex-row";
}
