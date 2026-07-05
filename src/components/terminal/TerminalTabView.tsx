import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";

import type { TerminalTab } from "../../types/terminal";
import { Terminal } from ".";

interface TerminalTabViewProps {
  tab: TerminalTab;
  visible: boolean;
  showHeader?: boolean;
  onClose?: () => void;
  onReturn?: () => void;
}

export function TerminalTabView({
  tab,
  visible,
  showHeader = false,
  onClose,
  onReturn,
}: TerminalTabViewProps) {
  const borderColor = tab.borderColor ?? "rgba(255,255,255,0.1)";

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden border"
      style={{ borderColor }}
    >
      {showHeader && (
        <div className="flex h-8 shrink-0 items-center gap-2 border-b border-white/10 px-2 text-xs text-gray-300">
          <span className="min-w-0 flex-1 truncate">{tab.title}</span>
          {onReturn && (
            <button
              className="rounded px-2 py-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              onClick={onReturn}
              aria-label="Return tab to top tabs"
              title="Return to tabs"
            >
              Return
            </button>
          )}
          {onClose && (
            <button
              className="rounded px-2 py-1 text-gray-400 transition-colors hover:bg-red-500/80 hover:text-white"
              onClick={onClose}
              aria-label="Close split tab"
              title="Close tab"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={2} />
            </button>
          )}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        {tab.panes.map((paneId, i) => (
          <div
            key={paneId}
            className={`min-w-0 flex-1 p-2 ${
              i > 0 ? "border-l border-white/10" : ""
            }`}
          >
            <Terminal sessionId={paneId} visible={visible} />
          </div>
        ))}
      </div>
    </div>
  );
}
