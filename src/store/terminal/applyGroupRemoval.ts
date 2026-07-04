import type { TerminalTab } from "../../types/terminal";
import { removeLeaf } from "../splitTree";
import type { TerminalStore } from "./types";

/**
 * Removes `tab` (a split group member) from its owning `groupTab`'s tree.
 * `mode: "kill"` drops the tab entirely from `tabs` (real close); `mode:
 * "return"` clears its `groupId` and leaves it alive, ungrouped. Either way,
 * if the tree collapses to a single remaining leaf, that survivor is also
 * ungrouped and the group pseudo-tab is discarded — the survivor's own
 * top-level array entry is never touched, so it never remounts and its live
 * PTY/scrollback survive.
 */
export function removeGroupMember(
  state: Pick<TerminalStore, "tabs" | "activeId">,
  groupTab: TerminalTab,
  tab: TerminalTab,
  mode: "kill" | "return",
): Partial<TerminalStore> {
  if (!groupTab.splitGroup) return {};
  const { tree, removedTabId } = removeLeaf(groupTab.splitGroup, tab.id);
  if (!removedTabId) return {};

  const groupWasActive = state.activeId === groupTab.id;
  const withoutMember =
    mode === "kill"
      ? state.tabs.filter((t) => t.id !== tab.id)
      : state.tabs.map((t) => (t.id === tab.id ? { ...t, groupId: undefined } : t));

  if (tree === null) {
    // No members left; the group itself dissolves.
    const tabs = withoutMember.filter((t) => t.id !== groupTab.id);
    const activeId = groupWasActive
      ? (mode === "return" ? tab.id : (tabs[0]?.id ?? null))
      : state.activeId;
    return { tabs, activeId };
  }

  if (tree.type === "leaf") {
    // Exactly one member remains; dissolve the group back into that plain tab.
    const survivorId = tree.tabId;
    const tabs = withoutMember
      .filter((t) => t.id !== groupTab.id)
      .map((t) => (t.id === survivorId ? { ...t, groupId: undefined } : t));
    const activeId = groupWasActive ? survivorId : state.activeId;
    return { tabs, activeId };
  }

  const tabs = withoutMember.map((t) =>
    t.id === groupTab.id ? { ...t, splitGroup: tree } : t,
  );
  return { tabs };
}
