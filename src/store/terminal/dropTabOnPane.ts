import type { SplitDirection, SplitTree, TerminalTab } from "../../types/terminal";
import { findGroupTabContaining, makeBranch, replaceLeafWithBranch } from "../splitTree";
import type { TerminalStore } from "./types";

/** Drops `draggedTabId` onto the `targetTabId` pane's edge, splitting it into/within a group. */
export function dropTabOnPane(
  state: Pick<TerminalStore, "tabs" | "activeId">,
  targetTabId: string,
  draggedTabId: string,
  direction: SplitDirection,
): Partial<TerminalStore> {
  if (targetTabId === draggedTabId) return {};

  const draggedIndex = state.tabs.findIndex((t) => t.id === draggedTabId);
  if (draggedIndex === -1) return {}; // must be a plain top-bar tab

  const draggedTab = state.tabs[draggedIndex];
  if (draggedTab.splitGroup) return {}; // dragging a whole group isn't supported yet

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
    if (!updatedTree) return {};
    return {
      tabs: tabsWithoutDragged.map((tab) =>
        tab.id === existingGroup.id ? { ...tab, splitGroup: updatedTree } : tab,
      ),
    };
  }

  // Otherwise the target is a plain tab — start a brand new group in its place.
  const targetIndex = tabsWithoutDragged.findIndex((t) => t.id === targetTabId);
  if (targetIndex === -1) return {};
  const targetTab = tabsWithoutDragged[targetIndex];
  if (targetTab.splitGroup) return {};

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
}
