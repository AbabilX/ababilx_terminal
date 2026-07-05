import { removeGroupMember } from "./applyGroupRemoval";
import { keepFocusedPane } from "./focus";
import type { SetTerminalState, TerminalStore } from "./types";

type CloseActions = Pick<TerminalStore, "closeTab" | "closePane">;

function closeSlot(
  state: Pick<TerminalStore, "tabs" | "activeId" | "focusedPaneId">,
  id: string,
  tabs: TerminalStore["tabs"],
  removedPaneIds: string[],
): Partial<TerminalStore> {
  let activeId = state.activeId;
  if (activeId === id) {
    const closedIndex = state.tabs.findIndex((t) => t.id === id);
    activeId = tabs[Math.max(0, closedIndex - 1)]?.id ?? null;
  }
  return {
    tabs,
    activeId,
    focusedPaneId: keepFocusedPane(tabs, activeId, state.focusedPaneId, removedPaneIds),
  };
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
          const removedPaneIds = state.tabs
            .filter((t) => t.groupId === id)
            .flatMap((t) => t.panes);
          return closeSlot(
            state,
            id,
            state.tabs.filter((t) => t.id !== id && t.groupId !== id),
            removedPaneIds,
          );
        }

        // Closing one pane's header button inside a group tab's split.
        if (tab.groupId) {
          const groupTab = state.tabs.find((t) => t.id === tab.groupId);
          if (!groupTab) return state;
          const result = removeGroupMember(state, groupTab, tab, "kill");
          const tabs = result.tabs ?? state.tabs;
          const activeId = result.activeId ?? state.activeId;
          return {
            ...result,
            focusedPaneId: keepFocusedPane(tabs, activeId, state.focusedPaneId, tab.panes),
          };
        }

        // Closing a plain solo tab.
        return closeSlot(state, id, state.tabs.filter((t) => t.id !== id), tab.panes);
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
            focusedPaneId:
              state.focusedPaneId === paneId ? remainingPanes[0] : state.focusedPaneId,
          };
        }

        // Last pane closing empties the tab.
        if (tab.groupId) {
          const groupTab = state.tabs.find((t) => t.id === tab.groupId);
          if (!groupTab) return state;
          const result = removeGroupMember(state, groupTab, tab, "kill");
          const tabs = result.tabs ?? state.tabs;
          const activeId = result.activeId ?? state.activeId;
          return {
            ...result,
            focusedPaneId: keepFocusedPane(tabs, activeId, state.focusedPaneId, [paneId]),
          };
        }

        return closeSlot(state, tab.id, state.tabs.filter((t) => t.id !== tab.id), [paneId]);
      }),
  };
}
