import { useEffect, useState, type CSSProperties } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { AppHeader } from "./components/AppHeader";
import { SettingsPage } from "./components/settings";
import { TerminalWorkspace } from "./components/terminal/TerminalWorkspace";
import { matchesKeybind } from "./lib/keybinds";
import { hexToRgba } from "./lib/color";
import { useSettingsStore } from "./store/settings";
import { useUiStore } from "./store/ui";
import { useTerminalStore } from "./store/terminal";

const SETTINGS_REFRESH_MS = 750;

function App() {
  const { tabs } = useTerminalStore();
  const loadSettings = useSettingsStore((s) => s.load);
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const appearance = useSettingsStore((s) => s.settings.appearance);
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const [headerRevealed, setHeaderRevealed] = useState(false);
  const hideHeader = appearance.hideHeader && !settingsOpen;
  const appBackground = hexToRgba(appearance.background, appearance.opacity);
  const appStyle: CSSProperties & { "--app-background": string } = {
    "--app-background": appBackground,
    background: appBackground,
  };

  useEffect(() => {
    loadSettings();
    const id = window.setInterval(loadSettings, SETTINGS_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [loadSettings]);

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

      if (matchesKeybind(e, keybindings.newTab)) {
        e.preventDefault();
        store.addTab();
      } else if (matchesKeybind(e, keybindings.splitRight)) {
        e.preventDefault();
        store.splitRight();
      } else if (matchesKeybind(e, keybindings.closeTab)) {
        e.preventDefault();
        if (store.activeId) store.closeTab(store.activeId);
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
      className="flex h-screen w-screen flex-col overflow-hidden rounded-xl border border-white/10"
      style={appStyle}
    >
      {!hideHeader && !settingsOpen && <AppHeader />}
      <div className="relative min-h-0 flex-1 bg-[var(--app-background)]">
        {hideHeader && (
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
        {settingsOpen ? (
          <SettingsPage onClose={closeSettings} />
        ) : (
          settingsLoaded && <TerminalWorkspace />
        )}
      </div>
    </main>
  );
}

export default App;
