import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";

import { matchesKeybind } from "../lib/keybinds";
import { useSettingsStore } from "../store/settings";
import { terminalTheme } from "./applyTerminalSettings";

/** Attaches the GPU (WebGL) renderer for fast, smooth scroll. Must run AFTER
 * terminal.open() — the addon needs the mounted canvas. If the GPU context is
 * lost (driver reset, tab backgrounded) it disposes itself so xterm falls back
 * to its DOM renderer instead of freezing. Silently no-ops if WebGL is
 * unavailable, keeping the DOM renderer. */
export function enableWebgl(terminal: Terminal) {
  try {
    const addon = new WebglAddon();
    addon.onContextLoss(() => addon.dispose());
    terminal.loadAddon(addon);
  } catch {
    // No WebGL (rare in the Tauri webview) — DOM renderer stays active.
  }
}

/** Builds an xterm instance styled from settings, with fit + weblinks. */
export function createTerminal() {
  const settings = useSettingsStore.getState().settings;
  const { terminal: term } = settings;

  const terminal = new Terminal({
    cursorBlink: term.cursorBlink,
    cursorStyle: term.cursorStyle,
    fontSize: term.fontSize,
    fontFamily: term.fontFamily,
    lineHeight: term.lineHeight,
    // Transparent canvas: the window's rgba background (settings
    // appearance.background/opacity) shows through the terminal.
    allowTransparency: true,
    theme: terminalTheme(settings),
  });

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(new WebLinksAddon());

  // Let app-level shortcuts (new tab, split, settings, command palette) bubble past xterm.
  terminal.attachCustomKeyEventHandler((e) => {
    if (e.type !== "keydown") return true;
    const kb = useSettingsStore.getState().settings.keybindings;
    const isAppShortcut = Object.values(kb).some((binding) =>
      matchesKeybind(e, binding),
    );
    const isPaletteShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p";
    return !(isAppShortcut || isPaletteShortcut);
  });

  return { terminal, fitAddon };
}
