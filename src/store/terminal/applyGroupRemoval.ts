import type { SplitTree, TerminalTab } from "../../types/terminal";
import type { TerminalStore } from "./types";

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
export function applyGroupRemoval(
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
    // Keep the top-bar slot's id stable across the collapse (it's the React
    // key in TerminalWorkspace) so the surviving pane's terminal never
    // remounts and its live PTY/scrollback survive.
    const survivor: TerminalTab = { ...tree.tab, id: groupTab.id };
    const tabs = state.tabs.map((t) => (t.id === groupTab.id ? survivor : t)).concat(tail);
    const activeId = groupWasActive ? survivor.id : state.activeId;
    return { tabs, activeId };
  }

  const tabs = state.tabs
    .map((t) => (t.id === groupTab.id ? { ...t, splitGroup: tree } : t))
    .concat(tail);
  return { tabs };
}
