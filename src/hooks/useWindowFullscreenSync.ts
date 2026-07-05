import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { useUiStore } from "../store/ui";

/**
 * Keeps `useUiStore.isFullscreen` in sync with the native window state.
 * Native fullscreen can also be entered/exited via OS shortcuts (e.g. the
 * macOS menu bar or Control+Cmd+F), not just our own toggle button, so we
 * re-check on every resize rather than only tracking our own toggles.
 */
export function useWindowFullscreenSync() {
  const setFullscreen = useUiStore((s) => s.setFullscreen);

  useEffect(() => {
    const win = getCurrentWindow();
    let cancelled = false;

    win.isFullscreen().then((value) => {
      if (!cancelled) setFullscreen(value);
    });

    const unlisten = win.onResized(() => {
      win.isFullscreen().then((value) => {
        if (!cancelled) setFullscreen(value);
      });
    });

    return () => {
      cancelled = true;
      unlisten.then((off) => off());
    };
  }, [setFullscreen]);
}
