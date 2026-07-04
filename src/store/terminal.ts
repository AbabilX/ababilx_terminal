import { create } from "zustand";
import type { SplitDirection, SplitLayout, TerminalTab } from "../types/terminal";
import { newTab } from "./tabNames";

interface TerminalStore {
  tabs: TerminalTab[];
  splitLayout: SplitLayout | null;
  activeId: string | null;
  addTab: () => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
  renameTab: (id: string, title: string) => void;
  setTabBorderColor: (id: string, color: string | null) => void;
  /** Adds an independent PTY pane to the right of the active tab's panes. */
  splitRight: () => void;
  /** Moves a tab beside the active tab in the editor area. */
  splitTabToSide: (tabId: string, direction: SplitDirection) => void;
  /** Returns both split tabs to the normal top tab list. */
  returnSplitToTabs: (activeId: string) => void;
  /** Removes a pane (e.g. its shell exited); removes the tab when empty. */
  closePane: (paneId: string) => void;
  /** Moves the dragged tab to sit just before the target tab. */
  reorderTab: (draggedId: string, targetId: string) => void;
}

const initial = newTab();

export const useTerminalStore = create<TerminalStore>((set) => ({
  tabs: [initial],
  splitLayout: null,
  activeId: initial.id,

  addTab: () =>
    set((state) => {
      const tab = newTab();
      return { tabs: [...state.tabs, tab], activeId: tab.id };
    }),

  closeTab: (id) =>
    set((state) => {
      if (state.splitLayout?.tabs.some((tab) => tab.id === id)) {
        const remaining = state.splitLayout.tabs.find((tab) => tab.id !== id);
        const tabs = remaining ? [...state.tabs, remaining] : state.tabs;
        return { tabs, splitLayout: null, activeId: remaining?.id ?? tabs[0]?.id ?? null };
      }

      const tabs = state.tabs.filter((t) => t.id !== id);
      let activeId = state.activeId;
      if (activeId === id) {
        const closedIndex = state.tabs.findIndex((t) => t.id === id);
        activeId = tabs[Math.max(0, closedIndex - 1)]?.id ?? null;
      }
      return { tabs, activeId };
    }),

  setActive: (id) => set({ activeId: id }),

  renameTab: (id, title) =>
    set((state) => {
      const nextTitle = title.trim();
      if (!nextTitle) return state;
      return {
        tabs: state.tabs.map((tab) =>
          tab.id === id ? { ...tab, title: nextTitle } : tab,
        ),
        splitLayout: updateSplitTab(state.splitLayout, id, (tab) => ({
          ...tab,
          title: nextTitle,
        })),
      };
    }),

  setTabBorderColor: (id, color) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, borderColor: color ?? undefined } : tab,
      ),
      splitLayout: updateSplitTab(state.splitLayout, id, (tab) => ({
        ...tab,
        borderColor: color ?? undefined,
      })),
    })),

  splitRight: () =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === state.activeId
          ? { ...tab, panes: [...tab.panes, crypto.randomUUID()] }
          : tab,
      ),
    })),

  splitTabToSide: (tabId, direction) =>
    set((state) => {
      if (!state.activeId || tabId === state.activeId || state.splitLayout) {
        return state;
      }

      const dragged = state.tabs.find((tab) => tab.id === tabId);
      const active = state.tabs.find((tab) => tab.id === state.activeId);
      if (!dragged || !active) return state;

      const tabs = state.tabs.filter(
        (tab) => tab.id !== tabId && tab.id !== state.activeId,
      );
      const splitTabs: [TerminalTab, TerminalTab] =
        direction === "left" || direction === "top"
          ? [dragged, active]
          : [active, dragged];

      return {
        tabs,
        splitLayout: { direction, tabs: splitTabs },
        activeId: tabs[0]?.id ?? null,
      };
    }),

  returnSplitToTabs: (activeId) =>
    set((state) => {
      if (!state.splitLayout) return state;
      return {
        tabs: [...state.tabs, ...state.splitLayout.tabs],
        splitLayout: null,
        activeId,
      };
    }),

  closePane: (paneId) =>
    set((state) => {
      if (state.splitLayout?.tabs.some((tab) => tab.panes.includes(paneId))) {
        const updatedSplitTabs = state.splitLayout.tabs
          .map((tab) => ({
            ...tab,
            panes: tab.panes.filter((p) => p !== paneId),
          }))
          .filter((tab) => tab.panes.length > 0);

        if (updatedSplitTabs.length === 2) {
          return {
            splitLayout: {
              ...state.splitLayout,
              tabs: updatedSplitTabs as [TerminalTab, TerminalTab],
            },
          };
        }

        const remaining = updatedSplitTabs[0];
        const tabs = remaining ? [...state.tabs, remaining] : state.tabs;
        return { tabs, splitLayout: null, activeId: remaining?.id ?? tabs[0]?.id ?? null };
      }

      const tabs = state.tabs
        .map((tab) => ({
          ...tab,
          panes: tab.panes.filter((p) => p !== paneId),
        }))
        .filter((tab) => tab.panes.length > 0);

      let activeId = state.activeId;
      if (activeId && !tabs.some((t) => t.id === activeId)) {
        const closedIndex = state.tabs.findIndex((t) => t.id === activeId);
        activeId = tabs[Math.max(0, closedIndex - 1)]?.id ?? null;
      }
      return { tabs, activeId };
    }),

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
}));

function updateSplitTab(
  splitLayout: SplitLayout | null,
  id: string,
  update: (tab: TerminalTab) => TerminalTab,
): SplitLayout | null {
  if (!splitLayout) return null;
  return {
    ...splitLayout,
    tabs: splitLayout.tabs.map((tab) =>
      tab.id === id ? update(tab) : tab,
    ) as [TerminalTab, TerminalTab],
  };
}
