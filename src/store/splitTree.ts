import type {
  SplitDirection,
  SplitOrientation,
  SplitTree,
  TerminalTab,
} from "../types/terminal";

/** Builds a new branch from an existing pane and an incoming tab, ordered by drop direction. */
export function makeBranch(
  direction: SplitDirection,
  target: SplitTree,
  dragged: SplitTree,
): SplitTree {
  const orientation: SplitOrientation =
    direction === "left" || direction === "right" ? "row" : "column";
  const children: [SplitTree, SplitTree] =
    direction === "left" || direction === "top"
      ? [dragged, target]
      : [target, dragged];

  return {
    type: "branch",
    id: crypto.randomUUID(),
    orientation,
    sizes: [50, 50],
    children,
  };
}

/** Replaces the leaf matching `targetTabId` with a new branch splitting it toward `direction`. */
export function replaceLeafWithBranch(
  tree: SplitTree,
  targetTabId: string,
  direction: SplitDirection,
  incoming: SplitTree,
): SplitTree | null {
  if (tree.type === "leaf") {
    return tree.tabId === targetTabId
      ? makeBranch(direction, tree, incoming)
      : null;
  }

  const [left, right] = tree.children;
  const updatedLeft = replaceLeafWithBranch(left, targetTabId, direction, incoming);
  if (updatedLeft) {
    return { ...tree, children: [updatedLeft, right] };
  }
  const updatedRight = replaceLeafWithBranch(right, targetTabId, direction, incoming);
  if (updatedRight) {
    return { ...tree, children: [left, updatedRight] };
  }
  return null;
}

export function updateBranchSizes(
  tree: SplitTree,
  branchId: string,
  sizes: [number, number],
): SplitTree {
  if (tree.type === "leaf") return tree;
  if (tree.id === branchId) return { ...tree, sizes };
  return {
    ...tree,
    children: [
      updateBranchSizes(tree.children[0], branchId, sizes),
      updateBranchSizes(tree.children[1], branchId, sizes),
    ],
  };
}

interface RemoveResult {
  /** Resulting tree, or null when the whole subtree collapsed away. */
  tree: SplitTree | null;
  removedTabId: string | null;
}

/** Removes a leaf by tab id, auto-collapsing its parent branch into the sibling pane. */
export function removeLeaf(tree: SplitTree, tabId: string): RemoveResult {
  if (tree.type === "leaf") {
    return tree.tabId === tabId
      ? { tree: null, removedTabId: tree.tabId }
      : { tree, removedTabId: null };
  }

  const [left, right] = tree.children;

  const leftResult = removeLeaf(left, tabId);
  if (leftResult.removedTabId) {
    return {
      tree: leftResult.tree ?? right,
      removedTabId: leftResult.removedTabId,
    };
  }

  const rightResult = removeLeaf(right, tabId);
  if (rightResult.removedTabId) {
    return {
      tree: rightResult.tree ?? left,
      removedTabId: rightResult.removedTabId,
    };
  }

  return { tree, removedTabId: null };
}

/** Finds whichever top-bar group tab (if any) owns `tabId` as one of its split members. */
export function findGroupTabContaining(
  tabs: TerminalTab[],
  tabId: string,
): TerminalTab | null {
  const groupId = tabs.find((t) => t.id === tabId)?.groupId;
  if (!groupId) return null;
  return tabs.find((t) => t.id === groupId) ?? null;
}

/** A rectangle in percentages (0–100) of the workspace container. */
export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface LayoutLeaf {
  tabId: string;
  rect: Rect;
}

export interface LayoutDivider {
  branchId: string;
  orientation: SplitOrientation;
  /** Full rect of the branch being resized — the divider drag is relative to this. */
  branchRect: Rect;
  /** Where the thin divider line sits: left% for "row", top% for "column". */
  linePosition: number;
}

export const FULL_RECT: Rect = { top: 0, left: 0, width: 100, height: 100 };

/**
 * Flattens a split tree into leaf rects + divider positions, all in percentages
 * of the workspace. Purely structural (tabId references only, no tab data) —
 * rendering looks up each leaf's actual TerminalTab separately, from the flat
 * `tabs` array, which is what keeps every tab's DOM position stable across
 * layout changes so terminal sessions never get remounted (and thus never
 * reset).
 */
export function computeSplitLayout(
  tree: SplitTree,
  rect: Rect = FULL_RECT,
): { leaves: LayoutLeaf[]; dividers: LayoutDivider[] } {
  if (tree.type === "leaf") {
    return { leaves: [{ tabId: tree.tabId, rect }], dividers: [] };
  }

  const [firstSize] = tree.sizes;
  let firstRect: Rect;
  let secondRect: Rect;
  let linePosition: number;

  if (tree.orientation === "row") {
    const firstWidth = (rect.width * firstSize) / 100;
    firstRect = { ...rect, width: firstWidth };
    secondRect = { ...rect, left: rect.left + firstWidth, width: rect.width - firstWidth };
    linePosition = rect.left + firstWidth;
  } else {
    const firstHeight = (rect.height * firstSize) / 100;
    firstRect = { ...rect, height: firstHeight };
    secondRect = { ...rect, top: rect.top + firstHeight, height: rect.height - firstHeight };
    linePosition = rect.top + firstHeight;
  }

  const first = computeSplitLayout(tree.children[0], firstRect);
  const second = computeSplitLayout(tree.children[1], secondRect);

  return {
    leaves: [...first.leaves, ...second.leaves],
    dividers: [
      ...first.dividers,
      { branchId: tree.id, orientation: tree.orientation, branchRect: rect, linePosition },
      ...second.dividers,
    ],
  };
}
