import type { SplitDirection, TerminalTab } from "../../types/terminal";

export interface TerminalStore {
  tabs: TerminalTab[];
  activeId: string | null;
  focusedPaneId: string | null;
  addTab: () => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
  setFocusedPane: (paneId: string) => void;
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

/** `set` as handed to each action-slice factory below. */
export type SetTerminalState = (
  partial:
    | Partial<TerminalStore>
    | ((state: TerminalStore) => Partial<TerminalStore>),
) => void;
