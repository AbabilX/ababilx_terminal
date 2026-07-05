import { useEffect, useState, type CSSProperties } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { AppHeader } from "./components/AppHeader";
import { UpdateBanner } from "./components/UpdateBanner";
import { SettingsPage } from "./components/settings";
import { TerminalWorkspace } from "./components/terminal/TerminalWorkspace";
import { useWindowFullscreenSync } from "./hooks/useWindowFullscreenSync";
import { matchesKeybind } from "./lib/keybinds";
import { hexToRgba } from "./lib/color";
import { useSettingsStore } from "./store/settings";
import { useUiStore } from "./store/ui";
import { useTerminalStore } from "./store/terminal";
import { useUpdateStore } from "./store/update";

function App() {
  const { tabs } = useTerminalStore();
  const loadSettings = useSettingsStore((s) => s.load);
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const appearance = useSettingsStore((s) => s.settings.appearance);
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const isFullscreen = useUiStore((s) => s.isFullscreen);
  const checkForUpdate = useUpdateStore((s) => s.check);
  const [headerRevealed, setHeaderRevealed] = useState(false);
  // Header visibility is controlled only by the user's own setting —
  // entering native fullscreen never hides it on its own.
  const hideHeader = appearance.hideHeader && !settingsOpen;
  const appBackground = hexToRgba(appearance.background, appearance.opacity);
  useWindowFullscreenSync();
  const appStyle: CSSProperties & { "--app-background": string } = {
    "--app-background": appBackground,
    background: appBackground,
  };

  // Load settings once, then refresh only when the window regains focus
  // (picks up external edits to settings.json). No idle polling — saves in the
  // app already update the store directly.
  useEffect(() => {
    loadSettings();
    const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) loadSettings();
    });
    return () => {
      unlisten.then((off) => off());
    };
  }, [loadSettings]);

  // Check GitHub for a newer release once per launch. Silent no-op if
  // offline or already up to date; dismissal is remembered per version.
  useEffect(() => {
    checkForUpdate();
  }, [checkForUpdate]);

  // Close the window when the last tab is gone.
  useEffect(() => {
    if (tabs.length === 0) {
      getCurrentWindow().close();
    }
  }, [tabs.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const { keybindings } = useSettingsStore.getState().settings;
      const store = useTerminalStore.getState();

      if (e.key === "Escape" && useUiStore.getState().isFullscreen) {
        e.preventDefault();
        useUiStore.getState().setFullscreen(false);
        getCurrentWindow().setFullscreen(false);
        return;
      }

      if (matchesKeybind(e, keybindings.newTab)) {
        e.preventDefault();
        store.addTab();
      } else if (matchesKeybind(e, keybindings.splitRight)) {
        e.preventDefault();
        store.splitRight();
      } else if (matchesKeybind(e, keybindings.closeTab)) {
        e.preventDefault();
        if (store.focusedPaneId) {
          store.closePane(store.focusedPaneId);
        } else if (store.activeId) {
          store.closeTab(store.activeId);
        }
      } else if (matchesKeybind(e, keybindings.settings)) {
        e.preventDefault();
        useUiStore.getState().toggleSettings();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <main
      className={`flex h-screen w-screen flex-col overflow-hidden ${
        isFullscreen ? "" : "rounded-[16px] border border-white/10"
      }`}
      style={appStyle}
    >
      {!hideHeader && !settingsOpen && <AppHeader />}
      {!settingsOpen && <UpdateBanner />}
      <div className="relative min-h-0 flex-1">
        {hideHeader && !settingsOpen && (
          <div
            className="absolute inset-x-0 top-0 z-30"
            onMouseEnter={() => setHeaderRevealed(true)}
            onMouseLeave={() => setHeaderRevealed(false)}
          >
            <div
              className={`transition-transform duration-150 ease-out ${
                headerRevealed ? "translate-y-0" : "-translate-y-full"
              }`}
            >
              <AppHeader />
            </div>
            <div className="h-2 w-full" />
          </div>
        )}
        {settingsLoaded && <TerminalWorkspace />}
        {settingsOpen && (
          <div className="absolute inset-0 z-40">
            <SettingsPage onClose={closeSettings} />
          </div>
        )}
      </div>
    </main>
  );
}

export default App;
