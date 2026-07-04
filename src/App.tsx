import { useEffect, type CSSProperties } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { AppHeader } from "./components/AppHeader";
import { Terminal } from "./components/terminal";
import { matchesKeybind } from "./lib/keybinds";
import { hexToRgba } from "./lib/color";
import { openSettingsFile, useSettingsStore } from "./store/settings";
import { useTerminalStore } from "./store/terminal";

const SETTINGS_REFRESH_MS = 750;

function App() {
  const { tabs, activeId } = useTerminalStore();
  const loadSettings = useSettingsStore((s) => s.load);
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const appearance = useSettingsStore((s) => s.settings.appearance);
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
        openSettingsFile();
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
      <AppHeader />
      <div className="relative min-h-0 flex-1 bg-[var(--app-background)]">
        {settingsLoaded && tabs.map((tab) => (
          <div
            key={tab.id}
            className={`absolute inset-0 flex ${
              tab.id === activeId ? "visible" : "invisible"
            }`}
          >
            {tab.panes.map((paneId, i) => (
              <div
                key={paneId}
                className={`min-w-0 flex-1 p-2 ${
                  i > 0 ? "border-l border-white/10" : ""
                }`}
              >
                <Terminal sessionId={paneId} visible={tab.id === activeId} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}

export default App;
