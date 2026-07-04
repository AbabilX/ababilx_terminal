import { create } from "zustand";
import type { TerminalTab } from "../types/terminal";
import { newTab } from "./tabNames";

interface TerminalStore {
  tabs: TerminalTab[];
  activeId: string | null;
  addTab: () => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
  /** Adds an independent PTY pane to the right of the active tab's panes. */
  splitRight: () => void;
  /** Removes a pane (e.g. its shell exited); removes the tab when empty. */
  closePane: (paneId: string) => void;
  /** Moves the dragged tab to sit just before the target tab. */
  reorderTab: (draggedId: string, targetId: string) => void;
}

const initial = newTab();

export const useTerminalStore = create<TerminalStore>((set) => ({
  tabs: [initial],
  activeId: initial.id,

  addTab: () =>
    set((state) => {
      const tab = newTab();
      return { tabs: [...state.tabs, tab], activeId: tab.id };
    }),

  closeTab: (id) =>
    set((state) => {
      const tabs = state.tabs.filter((t) => t.id !== id);
      let activeId = state.activeId;
      if (activeId === id) {
        const closedIndex = state.tabs.findIndex((t) => t.id === id);
        activeId = tabs[Math.max(0, closedIndex - 1)]?.id ?? null;
      }
      return { tabs, activeId };
    }),

  setActive: (id) => set({ activeId: id }),

  splitRight: () =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === state.activeId
          ? { ...tab, panes: [...tab.panes, crypto.randomUUID()] }
          : tab,
      ),
    })),

  closePane: (paneId) =>
    set((state) => {
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
