import { create } from "zustand";
import { newTab } from "../tabNames";
import { createCloseActions } from "./closeActions";
import { createSplitActions } from "./splitActions";
import { createTabActions } from "./tabActions";
import type { TerminalStore } from "./types";

export type { TerminalStore } from "./types";

const initial = newTab();

export const useTerminalStore = create<TerminalStore>((set) => ({
  tabs: [initial],
  activeId: initial.id,
  focusedPaneId: initial.panes[0] ?? null,
  ...createTabActions(set),
  ...createSplitActions(set),
  ...createCloseActions(set),
}));
