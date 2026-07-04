export interface TerminalTab {
  id: string;
  title: string;
  /** Each pane is an independent PTY session; rendered side by side. */
  panes: string[];
}

export interface Keybindings {
  newTab: string;
  splitRight: string;
  closeTab: string;
  settings: string;
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
  cursorStyle: "block" | "underline" | "bar";
  cursorBlink: boolean;
  lineHeight: number;
}

export interface AppSettings {
  appearance: AppearanceSettings;
  terminal: TerminalSettings;
  keybindings: Keybindings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  appearance: {
    theme: "dark",
    background: "#0d1117",
    opacity: 0.94,
    blur: 24,
  },
  terminal: {
    fontFamily: "JetBrains Mono, Consolas, monospace",
    fontSize: 14,
    cursorStyle: "block",
    cursorBlink: true,
    lineHeight: 1.2,
  },
  keybindings: {
    newTab: "ctrl+t",
    splitRight: "ctrl+\\",
    closeTab: "ctrl+w",
    settings: "ctrl+,",
  },
};
