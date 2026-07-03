import type { ITheme } from "@xterm/xterm";

/** Named terminal color palettes, selected by appearance.theme in settings. */
export const THEMES: Record<string, ITheme> = {
  dark: {
    background: "#0d1117",
    foreground: "#f8f8f2",
    cursor: "#ffffff",
    selectionBackground: "#264f78",
  },
  light: {
    background: "#ffffff",
    foreground: "#1f2328",
    cursor: "#1f2328",
    selectionBackground: "#add6ff",
  },
};

export function resolveTheme(name: string): ITheme {
  return THEMES[name] ?? THEMES.dark;
}
