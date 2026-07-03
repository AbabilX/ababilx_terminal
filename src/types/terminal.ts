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
  opacity: number;
  backgroundBlur: boolean;
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
    opacity: 1,
    backgroundBlur: false,
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
