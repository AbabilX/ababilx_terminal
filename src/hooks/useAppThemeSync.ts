import { useEffect } from "react";

import { useSettingsStore } from "../store/settings";

/** Syncs `appearance.theme` to `document.documentElement.dataset.appTheme`. */
export function useAppThemeSync() {
  const theme = useSettingsStore((s) => s.settings.appearance.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.dataset.appTheme = "light";
    } else {
      delete root.dataset.appTheme;
    }
  }, [theme]);
}
