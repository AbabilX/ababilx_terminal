import { useEffect, useRef } from "react";

import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";

import { createTerminal } from "../terminal/createTerminal";
import { ensureFontsReady } from "../terminal/fonts";
import { wireTerminal } from "../terminal/wireTerminal";
import type { InputContext } from "../terminal/routeInput";
import type { PreviewState } from "../components/terminal/PreviewDialog";

interface UseTerminalSessionArgs {
  sessionId: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  preview: InputContext["preview"];
  previewRef: React.RefObject<PreviewState | null>;
}

/** Spins up the xterm instance + PTY session for one pane, deferred until
 * the bundled fonts are loaded. Returns refs the parent can read/focus. */
export function useTerminalSession({
  sessionId,
  containerRef,
  preview,
}: UseTerminalSessionArgs) {
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    // Wait for our bundled webfonts before xterm takes its first cell-size
    // measurement — otherwise it measures a fallback font and the whole
    // grid renders at the wrong width.
    ensureFontsReady().then(() => {
      if (disposed || !containerRef.current) return;

      const { terminal, fitAddon } = createTerminal();
      terminal.open(containerRef.current);
      fitAddon.fit();
      terminal.focus();

      cleanup = wireTerminal(
        terminal,
        fitAddon,
        containerRef.current,
        sessionId,
        preview,
      );
      terminalRef.current = terminal;
      fitRef.current = fitAddon;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return { terminalRef, fitRef };
}
