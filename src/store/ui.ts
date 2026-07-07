import { create } from "zustand";

interface UiStore {
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;
  isFullscreen: boolean;
  setFullscreen: (value: boolean) => void;
  commandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  tabSwitcherOpen: boolean;
  openTabSwitcher: () => void;
  closeTabSwitcher: () => void;
  toggleTabSwitcher: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true, commandPaletteOpen: false, tabSwitcherOpen: false }),
  closeSettings: () => set({ settingsOpen: false }),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  isFullscreen: false,
  setFullscreen: (value) => set({ isFullscreen: value }),
  commandPaletteOpen: false,
  openCommandPalette: () => set({ commandPaletteOpen: true, settingsOpen: false, tabSwitcherOpen: false }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  tabSwitcherOpen: false,
  openTabSwitcher: () => set({ tabSwitcherOpen: true, settingsOpen: false, commandPaletteOpen: false }),
  closeTabSwitcher: () => set({ tabSwitcherOpen: false }),
  toggleTabSwitcher: () => set((s) => ({ tabSwitcherOpen: !s.tabSwitcherOpen })),
}));
