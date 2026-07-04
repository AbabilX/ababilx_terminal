import { create } from "zustand";
import type { SplitDirection, SplitTree, TerminalTab } from "../types/terminal";
import { newTab } from "./tabNames";
import {
  findLeafTab,
  removeLeaf,
  removeLeafPane,
  replaceLeafWithBranch,
  updateBranchSizes,
  updateLeafTab,
} from "./splitTree";

interface TerminalStore {
  tabs: TerminalTab[];
  /** Editor-area split layout; null when no tab has been split out yet. */
  splitRoot: SplitTree | null;
  activeId: string | null;
  addTab: () => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
  renameTab: (id: string, title: string) => void;
  setTabBorderColor: (id: string, color: string | null) => void;
  /** Adds an independent PTY pane to the right of the active tab's panes. */
  splitRight: () => void;
  /** Drops `draggedTabId` onto the `targetTabId` pane's edge, splitting it. */
  dropTabOnPane: (
    targetTabId: string,
    draggedTabId: string,
    direction: SplitDirection,
  ) => void;
  /** Moves one split pane's tab back to the normal top tab list. */
  returnPaneToTabs: (tabId: string) => void;
  /** Resizes a split branch; sizes are percentages for [first, second] children. */
  resizeSplitBranch: (branchId: string, sizes: [number, number]) => void;
  /** Removes a pane (e.g. its shell exited); removes the tab when empty. */
  closePane: (paneId: string) => void;
  /** Moves the dragged tab to sit just before the target tab. */
  reorderTab: (draggedId: string, targetId: string) => void;
}

const initial = newTab();

export const useTerminalStore = create<TerminalStore>((set) => ({
  tabs: [initial],
  splitRoot: null,
  activeId: initial.id,

  addTab: () =>
    set((state) => {
      const tab = newTab();
      return { tabs: [...state.tabs, tab], activeId: tab.id };
    }),

  closeTab: (id) =>
    set((state) => {
      if (state.splitRoot && findLeafTab(state.splitRoot, id)) {
        return collapseAfterRemoval(state, removeLeaf(state.splitRoot, id), null);
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
        splitRoot: state.splitRoot
          ? updateLeafTab(state.splitRoot, id, (tab) => ({ ...tab, title: nextTitle }))
          : null,
      };
    }),

  setTabBorderColor: (id, color) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, borderColor: color ?? undefined } : tab,
      ),
      splitRoot: state.splitRoot
        ? updateLeafTab(state.splitRoot, id, (tab) => ({
            ...tab,
            borderColor: color ?? undefined,
          }))
        : null,
    })),

  splitRight: () =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === state.activeId
          ? { ...tab, panes: [...tab.panes, crypto.randomUUID()] }
          : tab,
      ),
    })),

  dropTabOnPane: (targetTabId, draggedTabId, direction) =>
    set((state) => {
      if (targetTabId === draggedTabId) return state;

      const draggedIndex = state.tabs.findIndex((t) => t.id === draggedTabId);
      if (draggedIndex === -1) return state;

      const draggedTab = state.tabs[draggedIndex];
      const tabsWithoutDragged = state.tabs.filter((_, i) => i !== draggedIndex);
      const draggedLeaf: SplitTree = { type: "leaf", tab: draggedTab };

      if (!state.splitRoot) {
        const targetIndex = tabsWithoutDragged.findIndex((t) => t.id === targetTabId);
        if (targetIndex === -1) return state;

        const targetTab = tabsWithoutDragged[targetIndex];
        const remainingTabs = tabsWithoutDragged.filter((_, i) => i !== targetIndex);
        const targetLeaf: SplitTree = { type: "leaf", tab: targetTab };

        const root = replaceLeafWithBranch(
          targetLeaf,
          targetTab.id,
          direction,
          draggedLeaf,
        );
        if (!root) return state;

        return {
          tabs: remainingTabs,
          splitRoot: root,
          activeId: remainingTabs[0]?.id ?? null,
        };
      }

      const updatedRoot = replaceLeafWithBranch(
        state.splitRoot,
        targetTabId,
        direction,
        draggedLeaf,
      );
      if (!updatedRoot) return state;

      return { tabs: tabsWithoutDragged, splitRoot: updatedRoot };
    }),

  returnPaneToTabs: (tabId) =>
    set((state) => {
      if (!state.splitRoot) return state;
      return collapseAfterRemoval(state, removeLeaf(state.splitRoot, tabId), "return");
    }),

  resizeSplitBranch: (branchId, sizes) =>
    set((state) => {
      if (!state.splitRoot) return state;
      return { splitRoot: updateBranchSizes(state.splitRoot, branchId, sizes) };
    }),

  closePane: (paneId) =>
    set((state) => {
      if (state.splitRoot) {
        const result = removeLeafPane(state.splitRoot, paneId);
        if (result.laneEmptied) {
          return collapseAfterRemoval(
            state,
            { tree: result.tree, removed: result.removedTab },
            null,
          );
        }
        if (result.tree) {
          return { splitRoot: result.tree };
        }
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

/**
 * Shared collapse logic after removing a leaf from the split tree:
 * - Tree gone entirely -> that lone tab returns to the top bar.
 * - Tree collapsed to a single leaf -> both tabs return to the top bar (split ends).
 * - Otherwise -> keep the (smaller) split tree as-is.
 *
 * `mode: "return"` also pushes the removed tab back to the top bar (Return button);
 * `mode: null` discards it (real close).
 */
function collapseAfterRemoval(
  state: Pick<TerminalStore, "tabs">,
  result: { tree: SplitTree | null; removed: TerminalTab | null },
  mode: "return" | null,
): Partial<TerminalStore> {
  const { tree, removed } = result;
  if (!removed) return {};

  const returnedTabs = mode === "return" ? [removed] : [];

  if (tree === null) {
    const tabs = [...state.tabs, ...returnedTabs];
    return { tabs, splitRoot: null, activeId: returnedTabs[0]?.id ?? tabs[0]?.id ?? null };
  }

  if (tree.type === "leaf") {
    const tabs = [...state.tabs, tree.tab, ...returnedTabs];
    return { tabs, splitRoot: null, activeId: returnedTabs[0]?.id ?? tree.tab.id };
  }

  return { tabs: [...state.tabs, ...returnedTabs], splitRoot: tree };
}
