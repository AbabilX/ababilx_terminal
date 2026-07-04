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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[90vh] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#161b22]/95 shadow-2xl ${
          wide ? "w-[70vw] max-w-[900px]" : "max-w-[90vw]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-2.5">
          <HugeiconsIcon
            icon={preview.kind ? KIND_ICONS[preview.kind] : File01Icon}
            size={15}
            className="shrink-0 text-gray-400"
            strokeWidth={2}
          />
          <span className="min-w-0 flex-1 truncate font-mono text-sm text-gray-200">
            {preview.name || "preview"}
          </span>
          <button
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
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
