import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  File01Icon,
  Image01Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";

import { PreviewMedia } from "./PreviewMedia";

export interface PreviewState {
  name: string;
  kind?: "image" | "video" | "pdf" | "markdown";
  /** Blob URL of the file contents; images/video/pdf only. */
  url?: string;
  /** Decoded UTF-8 text; markdown only. */
  text?: string;
  error?: string;
  loading?: boolean;
}

interface PreviewDialogProps {
  preview: PreviewState;
  onClose: () => void;
}

const KIND_ICONS = {
  image: Image01Icon,
  video: Video01Icon,
  pdf: File01Icon,
  markdown: File01Icon,
} as const;

export function PreviewDialog({ preview, onClose }: PreviewDialogProps) {
  const wide = preview.kind === "markdown";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay-scrim)] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[90vh] flex-col overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)] shadow-2xl ${
          wide ? "w-[70vw] max-w-[900px]" : "max-w-[90vw]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--ui-border-subtle)] px-4 py-2.5">
          <HugeiconsIcon
            icon={preview.kind ? KIND_ICONS[preview.kind] : File01Icon}
            size={15}
            className="shrink-0 text-[var(--ui-text-muted)]"
            strokeWidth={2}
          />
          <span className="min-w-0 flex-1 truncate font-mono text-sm text-[var(--ui-text-secondary)]">
            {preview.name || "preview"}
          </span>
          <button
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-hover-strong)] hover:text-[var(--ui-text-strong)]"
            onClick={onClose}
            aria-label="Close preview"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={2} />
          </button>
        </div>
        <PreviewMedia preview={preview} />
      </div>
    </div>
  );
}
