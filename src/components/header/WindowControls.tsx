import { getCurrentWindow } from "@tauri-apps/api/window";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  Maximize01Icon,
  MinusSignIcon,
} from "@hugeicons/core-free-icons";

import { useUiStore } from "../../store/ui";
import { isWindows } from "../../lib/platform";

const win = getCurrentWindow();

const dotClass =
  "flex h-3 w-3 items-center justify-center rounded-full transition-colors";
// mac shows the glyph only while the pointer is over the cluster.
const glyphClass =
  "text-black/60 opacity-0 transition-opacity group-hover/traffic:opacity-100";

/** Window controls: Adapt based on host OS. Windows-style controls when on Windows, macOS traffic-lights otherwise. */
export function WindowControls() {
  const isFullscreen = useUiStore((s) => s.isFullscreen);
  const setFullscreen = useUiStore((s) => s.setFullscreen);

  const toggleFullscreen = () => {
    const next = !isFullscreen;
    setFullscreen(next);
    win.setFullscreen(next);
  };

  if (isWindows) {
    return (
      <div className="flex shrink-0 items-center h-[30px] -my-1 -mr-2">
        {/* Minimize Button */}
        <button
          className="flex w-11 h-[30px] items-center justify-center text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text-strong)] transition-colors cursor-pointer"
          onClick={() => win.minimize()}
          aria-label="Minimize"
        >
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
          </svg>
        </button>

        {/* Maximize / Restore Button */}
        <button
          className="flex w-11 h-[30px] items-center justify-center text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text-strong)] transition-colors cursor-pointer"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <rect x="4" y="8" width="12" height="12" rx="0.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 8V4h12v12h-4" />
            </svg>
          ) : (
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <rect x="4" y="4" width="16" height="16" rx="0.5" />
            </svg>
          )}
        </button>

        {/* Close Button */}
        <button
          className="flex w-11 h-[30px] items-center justify-center text-[var(--ui-text-muted)] hover:bg-[#e81123] hover:text-white transition-colors cursor-pointer"
          onClick={() => win.close()}
          aria-label="Close"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  // macOS-style
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
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
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
