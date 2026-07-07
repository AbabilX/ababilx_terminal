import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";

import { closeSession, createSession, resizeSession } from "../lib/tauri";
import { routeInput, type InputContext } from "./routeInput";
import { LsPicker } from "./lsPicker";
import { CwdTracker } from "./cwdTracker";
import { useTerminalStore } from "../store/terminal";

interface PtyOutput {
  id: string;
  data: string;
}

/** Wires input routing, PTY output/exit, resize, and the ls picker for one
 * already-open terminal. Returns a cleanup function. */
export function wireTerminal(
  terminal: Terminal,
  fitAddon: FitAddon,
  container: HTMLElement,
  sessionId: string,
  preview: InputContext["preview"],
): () => void {
  let disposed = false;
  const picker = new LsPicker(terminal, container);

  // Seed the CWD tracker with the platform home directory. This matches the
  // default cwd that PtySession uses when it spawns the shell process.
  const homeDir = getHomeDir();
  const cwdTracker = new CwdTracker(homeDir);

  const ctx: InputContext = { sessionId, picker, cwdTracker, preview };

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
  resizeObserver.observe(container);

  return () => {
    disposed = true;
    resizeObserver.disconnect();
    unlistenOutput.then((fn) => fn());
    unlistenExit.then((fn) => fn());
    closeSession(sessionId);
    picker.dispose();
    terminal.dispose();
  };
}

/** Returns the initial CWD for the CwdTracker. We use "~" because the Rust
 * `list_dir` command expands tilde to the real home directory before calling
 * `std::fs::read_dir`. The tracker also passes "~" to `noteCommand()` so plain
 * `cd` and `cd ~` correctly reset back to home. */
function getHomeDir(): string {
  return "~";
}
