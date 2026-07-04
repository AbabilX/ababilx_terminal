import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { themeBackground } from "../lib/themes";
import { DEFAULT_SETTINGS, type AppSettings } from "../types/terminal";

interface SettingsStore {
  settings: AppSettings;
  loaded: boolean;
  raw: string | null;
  load: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  raw: null,

  load: async () => {
    try {
      const raw = await invoke<string>("read_settings");
      const parsed = JSON.parse(raw);
      const appearance = { ...DEFAULT_SETTINGS.appearance, ...parsed.appearance };
      const usesDefaultBackground =
        !parsed.appearance?.background ||
        parsed.appearance.background === DEFAULT_SETTINGS.appearance.background;

      if (appearance.theme !== DEFAULT_SETTINGS.appearance.theme && usesDefaultBackground) {
        appearance.background = themeBackground(appearance.theme);
      }

      set((state) => {
        if (state.raw === raw && state.loaded) {
          return state;
        }

        return {
          loaded: true,
          raw,
          settings: {
            appearance,
            terminal: { ...DEFAULT_SETTINGS.terminal, ...parsed.terminal },
            keybindings: {
              ...DEFAULT_SETTINGS.keybindings,
              ...parsed.keybindings,
            },
          },
        };
      });
    } catch (err) {
      console.error("Failed to load settings, using defaults:", err);
      set({ loaded: true });
    }
  },
}));

export async function openSettingsFile() {
  return invoke<void>("open_settings");
}
