import { getCurrentWindow } from "@tauri-apps/api/window";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  Maximize01Icon,
  MinusSignIcon,
} from "@hugeicons/core-free-icons";

const win = getCurrentWindow();

const dotClass =
  "flex h-3 w-3 items-center justify-center rounded-full transition-colors";
// mac shows the glyph only while the pointer is over the cluster.
const glyphClass =
  "text-black/60 opacity-0 transition-opacity group-hover/traffic:opacity-100";

/** macOS-style window controls: red close / yellow minimize / green maximize. */
export function WindowControls() {
  return (
    <div className="group/traffic flex shrink-0 items-center gap-2">
      <button
        className={`${dotClass} bg-[#ff5f57] hover:bg-[#ff5f57]`}
        onClick={() => win.close()}
        aria-label="Close"
      >
        <HugeiconsIcon
          icon={Cancel01Icon}
          size={8}
          strokeWidth={3}
          className={glyphClass}
        />
      </button>
      <button
        className={`${dotClass} bg-[#febc2e] hover:bg-[#febc2e]`}
        onClick={() => win.minimize()}
        aria-label="Minimize"
      >
        <HugeiconsIcon
          icon={MinusSignIcon}
          size={8}
          strokeWidth={3}
          className={glyphClass}
        />
      </button>
      <button
        className={`${dotClass} bg-[#28c840] hover:bg-[#28c840]`}
        onClick={() => win.toggleMaximize()}
        aria-label="Maximize"
      >
        <HugeiconsIcon
          icon={Maximize01Icon}
          size={7}
          strokeWidth={3}
          className={glyphClass}
        />
      </button>
    </div>
  );
}
