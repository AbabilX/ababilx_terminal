import { updateBranchSizes } from "../splitTree";
import { removeGroupMember } from "./applyGroupRemoval";
import { dropTabOnPane } from "./dropTabOnPane";
import type { SetTerminalState, TerminalStore } from "./types";

type SplitActions = Pick<
  TerminalStore,
  "splitRight" | "dropTabOnPane" | "returnPaneToTabs" | "resizeSplitBranch"
>;

/** Creating, editing, and resizing split-tree layouts. */
export function createSplitActions(set: SetTerminalState): SplitActions {
  return {
    splitRight: () =>
      set((state) => ({
        tabs: state.tabs.map((tab) =>
          tab.id === state.activeId && !tab.splitGroup
            ? { ...tab, panes: [...tab.panes, crypto.randomUUID()] }
            : tab,
        ),
      })),

    dropTabOnPane: (targetTabId, draggedTabId, direction) =>
      set((state) => dropTabOnPane(state, targetTabId, draggedTabId, direction)),

    returnPaneToTabs: (leafTabId) =>
      set((state) => {
        const tab = state.tabs.find((t) => t.id === leafTabId);
        if (!tab?.groupId) return state;
        const groupTab = state.tabs.find((t) => t.id === tab.groupId);
        if (!groupTab) return state;
        return removeGroupMember(state, groupTab, tab, "return");
      }),

    resizeSplitBranch: (branchId, sizes) =>
      set((state) => ({
        tabs: state.tabs.map((tab) =>
          tab.splitGroup
            ? { ...tab, splitGroup: updateBranchSizes(tab.splitGroup, branchId, sizes) }
            : tab,
        ),
      })),
  };
}
