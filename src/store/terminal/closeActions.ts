import { findGroupTabContaining, findLeafByPane, removeLeaf, removeLeafPane } from "../splitTree";
import { applyGroupRemoval } from "./applyGroupRemoval";
import type { SetTerminalState, TerminalStore } from "./types";

type CloseActions = Pick<TerminalStore, "closeTab" | "closePane">;

/** Removal flows that may collapse or dissolve a split group. */
export function createCloseActions(set: SetTerminalState): CloseActions {
  return {
    closeTab: (id) =>
      set((state) => {
        // Closing one pane's header button inside a group tab's split.
        const groupTab = findGroupTabContaining(state.tabs, id);
        if (groupTab?.splitGroup) {
          return applyGroupRemoval(state, groupTab, removeLeaf(groupTab.splitGroup, id), null);
        }

        // Closing a plain tab, or an entire group tab via its own top-bar close button.
        const tabs = state.tabs.filter((t) => t.id !== id);
        let activeId = state.activeId;
        if (activeId === id) {
          const closedIndex = state.tabs.findIndex((t) => t.id === id);
          activeId = tabs[Math.max(0, closedIndex - 1)]?.id ?? null;
        }
        return { tabs, activeId };
      }),

    closePane: (paneId) =>
      set((state) => {
        const groupTab = state.tabs.find(
          (tab) => tab.splitGroup && findLeafByPane(tab.splitGroup, paneId),
        );

        if (groupTab?.splitGroup) {
          const result = removeLeafPane(groupTab.splitGroup, paneId);
          if (result.laneEmptied) {
            return applyGroupRemoval(
              state,
              groupTab,
              { tree: result.tree, removed: result.removedTab },
              null,
            );
          }
          if (!result.tree) return state;
          return {
            tabs: state.tabs.map((tab) =>
              tab.id === groupTab.id ? { ...tab, splitGroup: result.tree! } : tab,
            ),
          };
        }

        const tabs = state.tabs
          .map((tab) =>
            tab.splitGroup ? tab : { ...tab, panes: tab.panes.filter((p) => p !== paneId) },
          )
          .filter((tab) => tab.splitGroup || tab.panes.length > 0);

        let activeId = state.activeId;
        if (activeId && !tabs.some((t) => t.id === activeId)) {
          const closedIndex = state.tabs.findIndex((t) => t.id === activeId);
          activeId = tabs[Math.max(0, closedIndex - 1)]?.id ?? null;
        }
        return { tabs, activeId };
      }),
  };
}
