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

  const draggedTab = state.tabs.find((t) => t.id === draggedTabId);
  if (!draggedTab || draggedTab.splitGroup || draggedTab.groupId) return {}; // must be a plain top-bar tab

  const targetTab = state.tabs.find((t) => t.id === targetTabId);
  if (!targetTab) return {};

  const draggedLeaf: SplitTree = { type: "leaf", tabId: draggedTab.id };

  // Dropping onto a pane that's already part of an existing group extends that group.
  const existingGroup = findGroupTabContaining(state.tabs, targetTabId);
  if (existingGroup?.splitGroup) {
    const updatedTree = replaceLeafWithBranch(
      existingGroup.splitGroup,
      targetTabId,
      direction,
      draggedLeaf,
    );
    if (!updatedTree) return {};
    return {
      tabs: state.tabs.map((t) => {
        if (t.id === existingGroup.id) return { ...t, splitGroup: updatedTree };
        if (t.id === draggedTab.id) return { ...t, groupId: existingGroup.id };
        return t;
      }),
    };
  }

  // Otherwise the target is a plain tab — start a brand new group. Both source
  // tabs keep their own permanent top-level slot (just tagged with groupId);
  // only a new pseudo group-tab is appended for the "Split" pill + layout tree.
  const targetLeaf: SplitTree = { type: "leaf", tabId: targetTab.id };
  const groupTab: TerminalTab = {
    id: crypto.randomUUID(),
    title: "Split",
    panes: [],
    splitGroup: makeBranch(direction, targetLeaf, draggedLeaf),
  };

  const tabs = state.tabs.map((t) =>
    t.id === targetTab.id || t.id === draggedTab.id ? { ...t, groupId: groupTab.id } : t,
  );

  return { tabs: [...tabs, groupTab], activeId: groupTab.id };
}
