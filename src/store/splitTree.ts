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

export function findLeafTab(tree: SplitTree, tabId: string): TerminalTab | null {
  if (tree.type === "leaf") {
    return tree.tab.id === tabId ? tree.tab : null;
  }
  return (
    findLeafTab(tree.children[0], tabId) ?? findLeafTab(tree.children[1], tabId)
  );
}

export function findLeafByPane(tree: SplitTree, paneId: string): TerminalTab | null {
  if (tree.type === "leaf") {
    return tree.tab.panes.includes(paneId) ? tree.tab : null;
  }
  return (
    findLeafByPane(tree.children[0], paneId) ??
    findLeafByPane(tree.children[1], paneId)
  );
}

/** Replaces the leaf matching `targetTabId` with a new branch splitting it toward `direction`. */
export function replaceLeafWithBranch(
  tree: SplitTree,
  targetTabId: string,
  direction: SplitDirection,
  incoming: SplitTree,
): SplitTree | null {
  if (tree.type === "leaf") {
    return tree.tab.id === targetTabId
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

export function updateLeafTab(
  tree: SplitTree,
  tabId: string,
  update: (tab: TerminalTab) => TerminalTab,
): SplitTree {
  if (tree.type === "leaf") {
    return tree.tab.id === tabId ? { ...tree, tab: update(tree.tab) } : tree;
  }
  return {
    ...tree,
    children: [
      updateLeafTab(tree.children[0], tabId, update),
      updateLeafTab(tree.children[1], tabId, update),
    ],
  };
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
  removed: TerminalTab | null;
}

/** Removes a leaf by tab id, auto-collapsing its parent branch into the sibling pane. */
export function removeLeaf(tree: SplitTree, tabId: string): RemoveResult {
  if (tree.type === "leaf") {
    return tree.tab.id === tabId
      ? { tree: null, removed: tree.tab }
      : { tree, removed: null };
  }

  const [left, right] = tree.children;

  const leftResult = removeLeaf(left, tabId);
  if (leftResult.removed) {
    return {
      tree: leftResult.tree ?? right,
      removed: leftResult.removed,
    };
  }

  const rightResult = removeLeaf(right, tabId);
  if (rightResult.removed) {
    return {
      tree: rightResult.tree ?? left,
      removed: rightResult.removed,
    };
  }

  return { tree, removed: null };
}

/** Removes whichever leaf owns `paneId`; drops the leaf entirely once its last pane closes. */
export function removeLeafPane(
  tree: SplitTree,
  paneId: string,
): { tree: SplitTree | null; removedTab: TerminalTab | null; laneEmptied: boolean } {
  const owner = findLeafByPane(tree, paneId);
  if (!owner) return { tree, removedTab: null, laneEmptied: false };

  const remainingPanes = owner.panes.filter((p) => p !== paneId);
  if (remainingPanes.length > 0) {
    return {
      tree: updateLeafTab(tree, owner.id, (tab) => ({ ...tab, panes: remainingPanes })),
      removedTab: null,
      laneEmptied: false,
    };
  }

  const { tree: nextTree, removed } = removeLeaf(tree, owner.id);
  return { tree: nextTree, removedTab: removed, laneEmptied: true };
}

/** Finds whichever top-bar group tab (if any) contains `leafTabId` as one of its split leaves. */
export function findGroupTabContaining(
  tabs: TerminalTab[],
  leafTabId: string,
): TerminalTab | null {
  return (
    tabs.find(
      (tab) => tab.splitGroup && findLeafTab(tab.splitGroup, leafTabId) !== null,
    ) ?? null
  );
}

/** A rectangle in percentages (0–100) of the workspace container. */
export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface LayoutLeaf {
  tab: TerminalTab;
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

const FULL_RECT: Rect = { top: 0, left: 0, width: 100, height: 100 };

/**
 * Flattens a split tree into leaf rects + divider positions, all in percentages
 * of the workspace. Rendering from this flat list (instead of nesting React
 * components per branch) keeps every leaf's DOM position stable across layout
 * changes, so terminal sessions never get remounted (and thus never reset).
 */
export function computeSplitLayout(
  tree: SplitTree,
  rect: Rect = FULL_RECT,
): { leaves: LayoutLeaf[]; dividers: LayoutDivider[] } {
  if (tree.type === "leaf") {
    return { leaves: [{ tab: tree.tab, rect }], dividers: [] };
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
