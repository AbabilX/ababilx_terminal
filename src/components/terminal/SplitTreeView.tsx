import type { SplitTree } from "../../types/terminal";
import { useTerminalStore } from "../../store/terminal";
import { SplitDivider } from "./SplitDivider";
import { SplitDropOverlay } from "./SplitDropOverlay";
import { TerminalTabView } from "./TerminalTabView";

interface SplitTreeViewProps {
  node: SplitTree;
}

/** Recursively renders a split layout: leaves are terminal panes, branches are resizable row/column splits. */
export function SplitTreeView({ node }: SplitTreeViewProps) {
  const dropTabOnPane = useTerminalStore((s) => s.dropTabOnPane);
  const closeTab = useTerminalStore((s) => s.closeTab);
  const returnPaneToTabs = useTerminalStore((s) => s.returnPaneToTabs);
  const resizeSplitBranch = useTerminalStore((s) => s.resizeSplitBranch);

  if (node.type === "leaf") {
    const tab = node.tab;
    return (
      <SplitDropOverlay
        onDropTab={(draggedId, direction) => dropTabOnPane(tab.id, draggedId, direction)}
      >
        <TerminalTabView
          tab={tab}
          visible
          showHeader
          onClose={() => closeTab(tab.id)}
          onReturn={() => returnPaneToTabs(tab.id)}
        />
      </SplitDropOverlay>
    );
  }

  const [first, second] = node.children;
  const flexDirClass = node.orientation === "row" ? "flex-row" : "flex-col";

  return (
    <div className={`flex h-full min-h-0 w-full min-w-0 ${flexDirClass}`}>
      <div
        className="min-h-0 min-w-0 overflow-hidden"
        style={{ flexBasis: `${node.sizes[0]}%`, flexGrow: 0, flexShrink: 1 }}
      >
        <SplitTreeView node={first} />
      </div>
      <SplitDivider
        orientation={node.orientation}
        onResize={(ratio) =>
          resizeSplitBranch(node.id, [ratio * 100, (1 - ratio) * 100])
        }
      />
      <div
        className="min-h-0 min-w-0 overflow-hidden"
        style={{ flexBasis: `${node.sizes[1]}%`, flexGrow: 0, flexShrink: 1 }}
      >
        <SplitTreeView node={second} />
      </div>
    </div>
  );
}
