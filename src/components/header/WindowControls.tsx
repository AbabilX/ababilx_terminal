import { getCurrentWindow } from "@tauri-apps/api/window";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  Maximize01Icon,
  MinusSignIcon,
  Settings02Icon,
} from "@hugeicons/core-free-icons";

import { openSettingsFile } from "../../store/settings";

const win = getCurrentWindow();

const buttonClass =
  "flex h-7 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white";

export function WindowControls() {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        className={`${buttonClass} text-gray-500 hover:text-gray-200`}
        onClick={() => openSettingsFile()}
        aria-label="Settings"
      >
        <HugeiconsIcon icon={Settings02Icon} size={15} strokeWidth={2} />
      </button>
      <div className="mx-1 h-4 w-px bg-white/10" />
      <button
        className={buttonClass}
        onClick={() => win.minimize()}
        aria-label="Minimize"
      >
        <HugeiconsIcon icon={MinusSignIcon} size={14} strokeWidth={2} />
      </button>
      <button
        className={buttonClass}
        onClick={() => win.toggleMaximize()}
        aria-label="Maximize"
      >
        <HugeiconsIcon icon={Maximize01Icon} size={13} strokeWidth={2} />
      </button>
      <button
        className="flex h-7 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-500/80 hover:text-white"
        onClick={() => win.close()}
        aria-label="Close"
      >
        <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
