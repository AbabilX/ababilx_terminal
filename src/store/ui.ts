import { create } from "zustand";

interface UiStore {
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;
  isFullscreen: boolean;
  setFullscreen: (value: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  isFullscreen: false,
  setFullscreen: (value) => set({ isFullscreen: value }),
}));
