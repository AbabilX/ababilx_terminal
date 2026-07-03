import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_SETTINGS, type AppSettings } from "../types/terminal";

interface SettingsStore {
  settings: AppSettings;
  load: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: DEFAULT_SETTINGS,

  load: async () => {
    try {
      const raw = await invoke<string>("read_settings");
      const parsed = JSON.parse(raw);
      set({
        settings: {
          appearance: { ...DEFAULT_SETTINGS.appearance, ...parsed.appearance },
          terminal: { ...DEFAULT_SETTINGS.terminal, ...parsed.terminal },
          keybindings: {
            ...DEFAULT_SETTINGS.keybindings,
            ...parsed.keybindings,
          },
        },
      });
    } catch (err) {
      console.error("Failed to load settings, using defaults:", err);
    }
  },
}));

export async function openSettingsFile() {
  return invoke<void>("open_settings");
}
