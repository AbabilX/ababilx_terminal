import { useEffect, useRef } from "react";

import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";

import { closeSession, createSession, resizeSession } from "../lib/tauri";
import { createTerminal } from "../terminal/createTerminal";
import { routeInput, type InputContext } from "../terminal/routeInput";
import { LsPicker } from "../terminal/lsPicker";
import { useTerminalStore } from "../store/terminal";
import type { PreviewState } from "../components/terminal/PreviewDialog";

interface PtyOutput {
  id: string;
  data: string;
}

interface UseTerminalSessionArgs {
  sessionId: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  preview: InputContext["preview"];
  previewRef: React.RefObject<PreviewState | null>;
}

/** Spins up the xterm instance + PTY session for one pane and wires input
 * routing, resize, and output. Returns refs the parent can read/focus. */
export function useTerminalSession({
  sessionId,
  containerRef,
  preview,
}: UseTerminalSessionArgs) {
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    const { terminal, fitAddon } = createTerminal();
    terminal.open(containerRef.current);
    fitAddon.fit();
    terminal.focus();

    const picker = new LsPicker(terminal, containerRef.current);
    const ctx: InputContext = { sessionId, picker, preview };

    terminal.onData((data) => routeInput(ctx, data));
    terminal.onResize(({ cols, rows }) => resizeSession(sessionId, cols, rows));

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return { terminalRef, fitRef };
}
