import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";

import { matchesKeybind } from "../lib/keybinds";
import { resolveTheme } from "../lib/themes";
import { useSettingsStore } from "../store/settings";

/** Builds an xterm instance styled from settings, with fit + weblinks. */
export function createTerminal() {
  const { terminal: term, appearance } = useSettingsStore.getState().settings;

  const terminal = new Terminal({
    cursorBlink: term.cursorBlink,
    cursorStyle: term.cursorStyle,
    fontSize: term.fontSize,
    fontFamily: term.fontFamily,
    lineHeight: term.lineHeight,
    // Transparent canvas: the window's rgba background (settings
    // appearance.background/opacity) shows through the terminal.
    allowTransparency: true,
    theme: { ...resolveTheme(appearance.theme), background: "#00000000" },
  });

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(new WebLinksAddon());

  // Let app-level shortcuts (new tab, split, settings) bubble past xterm.
  terminal.attachCustomKeyEventHandler((e) => {
    if (e.type !== "keydown") return true;
    const kb = useSettingsStore.getState().settings.keybindings;
    const isAppShortcut = Object.values(kb).some((binding) =>
      matchesKeybind(e, binding),
    );
    return !isAppShortcut;
  });

  return { terminal, fitAddon };
}
