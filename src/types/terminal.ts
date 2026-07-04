export interface TerminalTab {
  id: string;
  title: string;
  borderColor?: string;
  /** Each pane is an independent PTY session; rendered side by side. */
  panes: string[];
  /**
   * When set, this is the id of the "group" pseudo-tab whose split tree this
   * tab is currently a leaf of. The tab itself keeps its own permanent,
   * never-removed slot in the flat `tabs` array either way — grouping only
   * changes where it's positioned/shown, never whether it's mounted, so its
   * terminal (scrollback + live PTY) survives every split/merge/collapse.
   */
  groupId?: string;
  /**
   * When set, this top-bar tab is a "group" pseudo-tab: it holds no panes of
   * its own, only the split tree below. Each leaf references a real tab (by
   * id) elsewhere in the flat `tabs` array via `groupId`. Only one tab in the
   * top bar can be shown at a time (a plain tab or a group tab), matching how
   * iTerm/Terminal.app split panes live inside one tab instead of replacing
   * the whole window.
   */
  splitGroup?: SplitTree;
}

export type SplitDirection = "left" | "right" | "top" | "bottom";

/** "row" = side-by-side panes (left/right splits); "column" = stacked panes (top/bottom splits). */
export type SplitOrientation = "row" | "column";

export interface SplitLeaf {
  type: "leaf";
  tabId: string;
}

export interface SplitBranch {
  type: "branch";
  id: string;
  orientation: SplitOrientation;
  /** Percentage sizes (sum to 100) for [first child, second child]. */
  sizes: [number, number];
  children: [SplitTree, SplitTree];
}

/** Recursive layout tree: a pane is either a single tab (leaf) or a further split (branch). */
export type SplitTree = SplitLeaf | SplitBranch;

export interface Keybindings {
  newTab: string;
  splitRight: string;
  closeTab: string;
  settings: string;
}

export interface AliasItem {
  name: string;
  func: string;
}

export interface ShellSettings {
  program: string;
  args: string[];
}

export interface AppearanceSettings {
  theme: string;
  /** Window background as a hex code, e.g. "#0d1117". */
  background: string;
  /** Background opacity 0–1; below 1 the desktop shows through. */
  opacity: number;
  /** Background blur in px; 0 disables the system blur behind the window. */
  blur: number;
  /** When true, the tab/title bar stays hidden until the mouse hovers near the top. */
  hideHeader: boolean;
}

export interface TerminalSettings {
  fontFamily: string;
  fontSize: number;
  /** Terminal text color. Use "auto" to follow the selected theme. */
  foreground: string;
  cursorStyle: "block" | "underline" | "bar";
  cursorBlink: boolean;
  lineHeight: number;
}

export interface AppSettings {
  appearance: AppearanceSettings;
  terminal: TerminalSettings;
  keybindings: Keybindings;
  aliases: AliasItem[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  appearance: {
    theme: "dark",
    background: "#0d1117",
    opacity: 0.94,
    blur: 24,
    hideHeader: false,
  },
  terminal: {
    fontFamily: "JetBrains Mono, Consolas, monospace, 'Purno Pran Unicode'",
    fontSize: 14,
    foreground: "auto",
    cursorStyle: "block",
    cursorBlink: true,
    lineHeight: 1.2,
  },
  keybindings: {
    newTab: "ctrl+shift+t",
    splitRight: "ctrl+t",
    closeTab: "ctrl+w",
    settings: "ctrl+,",
  },
  aliases: [],
};
