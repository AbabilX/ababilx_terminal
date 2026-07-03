import { useEffect, useRef } from "react";

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { listen } from "@tauri-apps/api/event";

import {
  closeSession,
  createSession,
  resizeSession,
  writeToSession,
} from "../../lib/tauri";
import { matchesKeybind } from "../../lib/keybinds";
import { resolveTheme } from "../../lib/themes";
import { useSettingsStore } from "../../store/settings";
import { useTerminalStore } from "../../store/terminal";

import "@xterm/xterm/css/xterm.css";

interface PtyOutput {
  id: string;
  data: string;
}

interface TerminalViewProps {
  sessionId: string;
  visible: boolean;
}

export default function TerminalView({ sessionId, visible }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const { terminal: term, appearance } = useSettingsStore.getState().settings;
    let disposed = false;

    const terminal = new Terminal({
      cursorBlink: term.cursorBlink,
      cursorStyle: term.cursorStyle,
      fontSize: term.fontSize,
      fontFamily: term.fontFamily,
      lineHeight: term.lineHeight,
      theme: resolveTheme(appearance.theme),
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());

    terminal.open(containerRef.current);
    fitAddon.fit();
    terminal.focus();

    // Let app-level shortcuts (new tab, split, settings) bubble past xterm.
    terminal.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown") return true;
      const kb = useSettingsStore.getState().settings.keybindings;
      const isAppShortcut = Object.values(kb).some((binding) =>
        matchesKeybind(e, binding),
      );
      return !isAppShortcut;
    });

    terminal.onData((data) => {
      writeToSession(sessionId, data);
    });

    terminal.onResize(({ cols, rows }) => {
      resizeSession(sessionId, cols, rows);
    });

    const unlistenOutput = listen<PtyOutput>("pty-output", (event) => {
      if (event.payload.id === sessionId) {
        terminal.write(event.payload.data);
      }
    });

    const unlistenExit = listen<string>("pty-exit", (event) => {
      if (event.payload === sessionId && !disposed) {
        useTerminalStore.getState().closePane(sessionId);
      }
    });

    createSession(sessionId, terminal.cols, terminal.rows).catch((err) => {
      terminal.writeln(`\x1b[31mFailed to start shell: ${err}\x1b[0m`);
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(containerRef.current);

    terminalRef.current = terminal;
    fitRef.current = fitAddon;

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      unlistenOutput.then((fn) => fn());
      unlistenExit.then((fn) => fn());
      closeSession(sessionId);
      terminal.dispose();
    };
  }, [sessionId]);

  useEffect(() => {
    if (visible) {
      fitRef.current?.fit();
      terminalRef.current?.focus();
    }
  }, [visible]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
      onClick={() => terminalRef.current?.focus()}
    />
  );
}
