import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { themeBackground } from "../lib/themes";
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type ShellSettings,
} from "../types/terminal";

const DEFAULT_SHELL: ShellSettings = { program: "auto", args: [] };

interface SettingsStore {
  settings: AppSettings;
  shell: ShellSettings;
  loaded: boolean;
  raw: string | null;
  load: () => Promise<void>;
  save: (next: AppSettings) => Promise<void>;
}

function mergeAppearance(parsed: Record<string, unknown>) {
  const appearance = {
    ...DEFAULT_SETTINGS.appearance,
    ...parsed,
  };
  const usesDefaultBackground =
    !parsed.background ||
    parsed.background === DEFAULT_SETTINGS.appearance.background;

  if (
    appearance.theme !== DEFAULT_SETTINGS.appearance.theme &&
    usesDefaultBackground
  ) {
    appearance.background = themeBackground(appearance.theme);
  }
  return appearance;
}

function parseFile(raw: string): {
  settings: AppSettings;
  shell: ShellSettings;
} {
  const parsed = JSON.parse(raw);
  return {
    settings: {
      appearance: mergeAppearance(parsed.appearance ?? {}),
      terminal: { ...DEFAULT_SETTINGS.terminal, ...parsed.terminal },
      keybindings: {
        ...DEFAULT_SETTINGS.keybindings,
        ...parsed.keybindings,
      },
      aliases: Array.isArray(parsed.aliases) ? parsed.aliases : [],
    },
    shell: {
      program: parsed.shell?.program ?? DEFAULT_SHELL.program,
      args: Array.isArray(parsed.shell?.args)
        ? parsed.shell.args
        : DEFAULT_SHELL.args,
    },
  };
}

function serialize(settings: AppSettings, shell: ShellSettings): string {
  return JSON.stringify({ shell, ...settings }, null, 2);
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  shell: DEFAULT_SHELL,
  loaded: false,
  raw: null,

  load: async () => {
    try {
      const raw = await invoke<string>("read_settings");
      const { settings, shell } = parseFile(raw);

      set((state) => {
        if (state.raw === raw && state.loaded) {
          return state;
        }
        return { loaded: true, raw, settings, shell };
      });
    } catch (err) {
      console.error("Failed to load settings, using defaults:", err);
      set({ loaded: true });
    }
  },

  save: async (next) => {
    const { shell } = get();
    const content = serialize(next, shell);
    await invoke<void>("write_settings", { content });
    set({ settings: next, raw: content, loaded: true });
  },
}));

export async function openSettingsFile() {
  return invoke<void>("open_settings");
}
