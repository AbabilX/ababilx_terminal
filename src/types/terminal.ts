export interface TerminalTab {
  id: string;
  title: string;
  borderColor?: string;
  /** Each pane is an independent PTY session; rendered side by side. */
  panes: string[];
}

export type SplitDirection = "left" | "right" | "top" | "bottom";

export interface SplitLayout {
  direction: SplitDirection;
  tabs: [TerminalTab, TerminalTab];
}

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
