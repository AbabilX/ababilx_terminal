import { removeGroupMember } from "./applyGroupRemoval";
import type { SetTerminalState, TerminalStore } from "./types";

type CloseActions = Pick<TerminalStore, "closeTab" | "closePane">;

function closeSlot(
  state: Pick<TerminalStore, "tabs" | "activeId">,
  id: string,
  tabs: TerminalStore["tabs"],
): Partial<TerminalStore> {
  let activeId = state.activeId;
  if (activeId === id) {
    const closedIndex = state.tabs.findIndex((t) => t.id === id);
    activeId = tabs[Math.max(0, closedIndex - 1)]?.id ?? null;
  }
  return { tabs, activeId };
}

/** Removal flows that may collapse or dissolve a split group. */
export function createCloseActions(set: SetTerminalState): CloseActions {
  return {
    closeTab: (id) =>
      set((state) => {
        const tab = state.tabs.find((t) => t.id === id);
        if (!tab) return state;

        // Closing the whole split pill via its own top-bar close button.
        if (tab.splitGroup) {
          return closeSlot(
            state,
            id,
            state.tabs.filter((t) => t.id !== id && t.groupId !== id),
          );
        }

        // Closing one pane's header button inside a group tab's split.
        if (tab.groupId) {
          const groupTab = state.tabs.find((t) => t.id === tab.groupId);
          if (!groupTab) return state;
          return removeGroupMember(state, groupTab, tab, "kill");
        }

        // Closing a plain solo tab.
        return closeSlot(state, id, state.tabs.filter((t) => t.id !== id));
      }),

    closePane: (paneId) =>
      set((state) => {
        const tab = state.tabs.find((t) => t.panes.includes(paneId));
        if (!tab) return state;

        const remainingPanes = tab.panes.filter((p) => p !== paneId);
        if (remainingPanes.length > 0) {
          return {
            tabs: state.tabs.map((t) =>
              t.id === tab.id ? { ...t, panes: remainingPanes } : t,
            ),
          };
        }

        // Last pane closing empties the tab.
        if (tab.groupId) {
          const groupTab = state.tabs.find((t) => t.id === tab.groupId);
          if (!groupTab) return state;
          return removeGroupMember(state, groupTab, tab, "kill");
        }

        return closeSlot(state, tab.id, state.tabs.filter((t) => t.id !== tab.id));
      }),
  };
}
