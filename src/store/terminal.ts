import { create } from "zustand";
import type { SplitDirection, SplitTree, TerminalTab } from "../types/terminal";
import { newTab } from "./tabNames";
import {
  findGroupTabContaining,
  findLeafByPane,
  makeBranch,
  removeLeaf,
  removeLeafPane,
  replaceLeafWithBranch,
  updateBranchSizes,
} from "./splitTree";

interface TerminalStore {
  tabs: TerminalTab[];
  activeId: string | null;
  addTab: () => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
  renameTab: (id: string, title: string) => void;
  setTabBorderColor: (id: string, color: string | null) => void;
  /** Adds an independent PTY pane to the right of the active tab's panes (no-op on group tabs). */
  splitRight: () => void;
  /** Drops `draggedTabId` onto the `targetTabId` pane's edge, splitting it into/within a group. */
  dropTabOnPane: (
    targetTabId: string,
    draggedTabId: string,
    direction: SplitDirection,
  ) => void;
  /** Moves one split pane's tab back to the normal top tab list. */
  returnPaneToTabs: (leafTabId: string) => void;
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
  activeId: initial.id,

  addTab: () =>
    set((state) => {
      const tab = newTab();
      return { tabs: [...state.tabs, tab], activeId: tab.id };
    }),

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

  setActive: (id) => set({ activeId: id }),

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

  splitRight: () =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === state.activeId && !tab.splitGroup
          ? { ...tab, panes: [...tab.panes, crypto.randomUUID()] }
          : tab,
      ),
    })),

  dropTabOnPane: (targetTabId, draggedTabId, direction) =>
    set((state) => {
      if (targetTabId === draggedTabId) return state;

      const draggedIndex = state.tabs.findIndex((t) => t.id === draggedTabId);
      if (draggedIndex === -1) return state; // must be a plain top-bar tab

      const draggedTab = state.tabs[draggedIndex];
      if (draggedTab.splitGroup) return state; // dragging a whole group isn't supported yet

      const draggedLeaf: SplitTree = { type: "leaf", tab: draggedTab };
      const tabsWithoutDragged = state.tabs.filter((_, i) => i !== draggedIndex);

      // Dropping onto a pane that's already part of an existing group extends that group.
      const existingGroup = findGroupTabContaining(tabsWithoutDragged, targetTabId);
      if (existingGroup?.splitGroup) {
        const updatedTree = replaceLeafWithBranch(
          existingGroup.splitGroup,
          targetTabId,
          direction,
          draggedLeaf,
        );
        if (!updatedTree) return state;
        return {
          tabs: tabsWithoutDragged.map((tab) =>
            tab.id === existingGroup.id ? { ...tab, splitGroup: updatedTree } : tab,
          ),
        };
      }

      // Otherwise the target is a plain tab — start a brand new group in its place.
      const targetIndex = tabsWithoutDragged.findIndex((t) => t.id === targetTabId);
      if (targetIndex === -1) return state;
      const targetTab = tabsWithoutDragged[targetIndex];
      if (targetTab.splitGroup) return state;

      const targetLeaf: SplitTree = { type: "leaf", tab: targetTab };
      const groupTab: TerminalTab = {
        id: crypto.randomUUID(),
        title: "Split",
        panes: [],
        splitGroup: makeBranch(direction, targetLeaf, draggedLeaf),
      };

      const tabs = [...tabsWithoutDragged];
      tabs.splice(targetIndex, 1, groupTab);

      return { tabs, activeId: groupTab.id };
    }),

  returnPaneToTabs: (leafTabId) =>
    set((state) => {
      const groupTab = findGroupTabContaining(state.tabs, leafTabId);
      if (!groupTab?.splitGroup) return state;
      return applyGroupRemoval(
        state,
        groupTab,
        removeLeaf(groupTab.splitGroup, leafTabId),
        "return",
      );
    }),

  resizeSplitBranch: (branchId, sizes) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.splitGroup
          ? { ...tab, splitGroup: updateBranchSizes(tab.splitGroup, branchId, sizes) }
          : tab,
      ),
    })),

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
 * Applies the result of removing one leaf from `groupTab`'s split tree:
 * - Tree fully collapses (0 leaves left) -> the group tab itself is discarded.
 * - Tree collapses to a single leaf -> the group dissolves back into that
 *   plain tab, in the same top-bar slot the group used to occupy.
 * - Tree still has 2+ leaves -> the group tab keeps living with the smaller tree.
 *
 * `mode: "return"` appends the removed tab to the end of the top bar (Return
 * button); `mode: null` discards it for good (real close). Focus only ever
 * moves away from whatever's currently shown if the group being edited was
 * itself the active tab and it just stopped existing.
 */
function applyGroupRemoval(
  state: Pick<TerminalStore, "tabs" | "activeId">,
  groupTab: TerminalTab,
  result: { tree: SplitTree | null; removed: TerminalTab | null },
  mode: "return" | null,
): Partial<TerminalStore> {
  const { tree, removed } = result;
  if (!removed) return {};

  const groupWasActive = state.activeId === groupTab.id;
  const tail = mode === "return" ? [removed] : [];

  if (tree === null) {
    const tabs = state.tabs.filter((t) => t.id !== groupTab.id).concat(tail);
    const activeId = groupWasActive ? tail[0]?.id ?? tabs[0]?.id ?? null : state.activeId;
    return { tabs, activeId };
  }

  if (tree.type === "leaf") {
    const survivor = tree.tab;
    const tabs = state.tabs.map((t) => (t.id === groupTab.id ? survivor : t)).concat(tail);
    const activeId = groupWasActive ? survivor.id : state.activeId;
    return { tabs, activeId };
  }

  const tabs = state.tabs
    .map((t) => (t.id === groupTab.id ? { ...t, splitGroup: tree } : t))
    .concat(tail);
  return { tabs };
}
