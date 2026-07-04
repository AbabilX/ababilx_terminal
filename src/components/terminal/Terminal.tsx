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
import { LsPicker } from "../../terminal/lsPicker";
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

    const picker = new LsPicker(terminal, containerRef.current);

    terminal.onData((data) => {
      if (picker.active) {
        if (/^[0-9]$/.test(data)) {
          picker.select(Number(data)); // consumed; not sent to the shell
          return;
        }
        if (data === "\x1b") {
          picker.dismiss(); // Esc: back to normal typing, nothing sent
          return;
        }
        if (data === "\r") {
          const cmd = picker.commandForSelected();
          if (cmd) {
            writeToSession(sessionId, cmd + "\r"); // cd into it + list inside
            return;
          }
        }
        picker.dismiss();
      }
      picker.noteInput(data);
      writeToSession(sessionId, data);
    });

    terminal.onResize(({ cols, rows }) => {
      resizeSession(sessionId, cols, rows);
    });

    const unlistenOutput = listen<PtyOutput>("pty-output", (event) => {
      if (event.payload.id === sessionId) {
        // noteOutput must run after the chunk lands in the buffer.
        terminal.write(event.payload.data, () => picker.noteOutput());
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
      picker.dismiss(); // reflow shifts text under the overlay
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
      picker.dispose();
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
      className="relative h-full w-full overflow-hidden"
      onClick={() => terminalRef.current?.focus()}
    />
  );
}
