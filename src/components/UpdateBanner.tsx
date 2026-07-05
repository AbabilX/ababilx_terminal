import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  Copy01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

import { useUpdateStore } from "../store/update";

export function UpdateBanner() {
  const info = useUpdateStore((s) => s.info);
  const dismiss = useUpdateStore((s) => s.dismiss);
  const [copied, setCopied] = useState(false);

  if (!info) return null;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(info.command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard failures
    }
  };

  return (
    <div className="flex shrink-0 items-start gap-3 border-b border-[var(--ui-warning-border)] bg-[var(--ui-warning-bg)] px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[var(--ui-warning-text)]">
          Abaxana v{info.current} → v{info.latest} is available
        </p>
        <code
          className="mt-1 block cursor-text select-all truncate font-mono text-xs text-[var(--ui-warning-text-muted)]"
          title={info.command}
        >
          {info.command}
        </code>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-[var(--ui-warning-text-faint)] transition-colors hover:bg-[var(--ui-warning-hover-bg)] hover:text-[var(--ui-warning-text-strong)]"
          onClick={onCopy}
          aria-label="Copy update command"
        >
          <HugeiconsIcon
            icon={copied ? Tick02Icon : Copy01Icon}
            size={14}
            strokeWidth={2}
          />
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--ui-warning-text-faint)] transition-colors hover:bg-[var(--ui-warning-hover-bg)] hover:text-[var(--ui-warning-text-strong)]"
          onClick={dismiss}
          aria-label="Dismiss update notification"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
