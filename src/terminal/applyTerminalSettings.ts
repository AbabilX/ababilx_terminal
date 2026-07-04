import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";

import { resolveTheme } from "../lib/themes";
import type { AppSettings } from "../types/terminal";

export function terminalTheme(settings: AppSettings) {
  const theme = resolveTheme(settings.appearance.theme);
  const foreground = settings.terminal.foreground.trim();

  return {
    ...theme,
    background: "#00000000",
    foreground:
      foreground && foreground !== "auto"
        ? foreground
        : theme.foreground,
  };
}

export function applyTerminalSettings(
  terminal: Terminal,
  fitAddon: FitAddon | null,
  settings: AppSettings,
) {
  const term = settings.terminal;

  terminal.options.cursorBlink = term.cursorBlink;
  terminal.options.cursorStyle = term.cursorStyle;
  terminal.options.fontSize = term.fontSize;
  terminal.options.fontFamily = term.fontFamily;
  terminal.options.lineHeight = term.lineHeight;
  terminal.options.theme = terminalTheme(settings);

  requestAnimationFrame(() => fitAddon?.fit());
}
