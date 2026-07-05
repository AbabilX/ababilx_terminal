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
    <div className="flex shrink-0 items-start gap-3 border-b border-amber-400/20 bg-amber-400/[0.08] px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-amber-100/90">
          Abaxana v{info.current} → v{info.latest} is available
        </p>
        <code
          className="mt-1 block cursor-text select-all truncate font-mono text-xs text-amber-100/70"
          title={info.command}
        >
          {info.command}
        </code>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-amber-100/80 transition-colors hover:bg-amber-400/10 hover:text-amber-50"
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
          className="flex h-7 w-7 items-center justify-center rounded-md text-amber-100/60 transition-colors hover:bg-amber-400/10 hover:text-amber-50"
          onClick={dismiss}
          aria-label="Dismiss update notification"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
