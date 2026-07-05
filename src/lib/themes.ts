import type { ITheme } from "@xterm/xterm";

/** Named terminal color palettes, selected by appearance.theme in settings. */
export const THEMES: Record<string, ITheme> = {
  dark: {
    background: "#050608",
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

export function themeBackground(name: string): string {
  return resolveTheme(name).background ?? THEMES.dark.background!;
}

/** True when `background` still matches a built-in theme default (not customized). */
export function isThemeDefaultBackground(_theme: string, background: string): boolean {
  const normalized = background.trim().toLowerCase();
  const legacyDefaults = ["#0d1117"];
  if (legacyDefaults.includes(normalized)) return true;
  return Object.values(THEMES).some(
    (t) => (t.background ?? "").toLowerCase() === normalized,
  );
}
