import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";

import { compareVersions } from "./versionCompare";
import { getUpdateCommand, type AppPlatform } from "./updateCommands";

const VERSION_URL =
  "https://raw.githubusercontent.com/AbabilX/ababilx_terminal/main/version.json";

const DISMISS_KEY = "abaxana.updateDismissedFor";

interface VersionManifest {
  version: string;
}

export interface UpdateInfo {
  current: string;
  latest: string;
  command: string;
}

function isDismissed(latest: string): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === latest;
  } catch {
    return false;
  }
}

export function dismissUpdate(latest: string): void {
  try {
    localStorage.setItem(DISMISS_KEY, latest);
  } catch {
    // ignore storage failures
  }
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const [current, platform] = await Promise.all([
      getVersion(),
      invoke<AppPlatform>("get_platform"),
    ]);

    const response = await fetch(`${VERSION_URL}?t=${Date.now()}`);
    if (!response.ok) return null;

    const manifest = (await response.json()) as VersionManifest;
    if (!manifest.version) return null;

    const latest = manifest.version.replace(/^v/i, "");
    if (compareVersions(current, latest) >= 0) return null;
    if (isDismissed(latest)) return null;

    return {
      current,
      latest,
      command: getUpdateCommand(platform),
    };
  } catch {
    return null;
  }
}
