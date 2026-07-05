import { newTab } from "../tabNames";
import { firstPaneForActive } from "./focus";
import type { SetTerminalState, TerminalStore } from "./types";

type TabActions = Pick<
  TerminalStore,
  | "addTab"
  | "setActive"
  | "setFocusedPane"
  | "renameTab"
  | "setTabBorderColor"
  | "reorderTab"
>;

/** Plain top-bar tab management: no split-tree awareness. */
export function createTabActions(set: SetTerminalState): TabActions {
  return {
    addTab: () =>
      set((state) => {
        const tab = newTab();
        return {
          tabs: [...state.tabs, tab],
          activeId: tab.id,
          focusedPaneId: tab.panes[0] ?? null,
        };
      }),

    setActive: (id) =>
      set((state) => ({
        activeId: id,
        focusedPaneId: firstPaneForActive(state.tabs, id),
      })),

    setFocusedPane: (paneId) => set({ focusedPaneId: paneId }),

    renameTab: (id, title) =>
      set((state) => {
        const nextTitle = title.trim();
        if (!nextTitle) return state;
        return {
          tabs: state.tabs.map((tab) =>
            tab.id === id ? { ...tab, title: nextTitle } : tab,
          ),
        };
      }),

    setTabBorderColor: (id, color) =>
      set((state) => ({
        tabs: state.tabs.map((tab) =>
          tab.id === id ? { ...tab, borderColor: color ?? undefined } : tab,
        ),
      })),

    reorderTab: (draggedId, targetId) =>
      set((state) => {
        if (draggedId === targetId) return state;
        const tabs = [...state.tabs];
        const fromIndex = tabs.findIndex((t) => t.id === draggedId);
        const toIndex = tabs.findIndex((t) => t.id === targetId);
        if (fromIndex === -1 || toIndex === -1) return state;
        const [dragged] = tabs.splice(fromIndex, 1);
        tabs.splice(toIndex, 0, dragged);
        return { tabs };
      }),
  };
}
