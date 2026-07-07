import { useUiStore } from "../store/ui";
import { WindowControls } from "./header/WindowControls";
import { isWindows } from "../lib/platform";
import appIcon from "../assets/app-icon.png";

export function AppHeader() {
  const openCommandPalette = useUiStore((s) => s.openCommandPalette);
  const openTabSwitcher = useUiStore((s) => s.openTabSwitcher);

  return (
    <div
      data-tauri-drag-region
      className="relative flex h-[30px] shrink-0 items-center justify-between border-b border-[var(--ui-border-subtle)] px-2 select-none"
      style={{
        background: "var(--app-background)",
      }}
    >
      {/* Left side: Logo */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* macOS traffic lights on far left */}
        {!isWindows && <WindowControls />}

        {/* App Logo */}
        <div className="flex items-center justify-center p-0.5" title="Abaxana">
          <img src={appIcon} alt="Abaxana Logo" className="h-4 w-4 rounded" />
        </div>
      </div>

      {/* Center Side: Absolutely Centered Search Bar with Stack Icon on Left */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 w-[400px] max-w-[50%] justify-center">
        {/* Stack / Task View Icon */}
        <button
          onClick={openTabSwitcher}
          className="flex h-5 w-5 items-center justify-center rounded text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)] hover:text-white transition-colors cursor-pointer shrink-0"
          title="Active Desktops (Win+Tab)"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="3" width="9" height="9" rx="1.5" />
            <rect x="9" y="9" width="9" height="9" rx="1.5" fill="#1e1e1e" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>

        {/* Search Bar */}
        <div
          onClick={openCommandPalette}
          className="flex flex-1 items-center gap-2 bg-[var(--ui-surface)] border border-[var(--ui-border-subtle)] hover:bg-[var(--ui-hover)] hover:border-[var(--ui-border)] rounded h-[20px] px-2 text-[10.5px] text-[var(--ui-text-muted)] hover:text-[var(--ui-text-secondary)] cursor-pointer transition-all select-none"
          title="Search commands (Ctrl+P)"
        >
          <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <span className="truncate">Search commands (Ctrl+P)</span>
        </div>
      </div>

      {/* Right Side: Window Controls */}
      <div className="flex items-center gap-1 shrink-0">
        {isWindows && <WindowControls />}
      </div>
    </div>
  );
}
