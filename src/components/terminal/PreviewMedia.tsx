import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Loading03Icon } from "@hugeicons/core-free-icons";

import { MarkdownPreview } from "./MarkdownPreview";
import type { PreviewState } from "./PreviewDialog";

/** Body of the preview dialog: loading / error / image / video / pdf / markdown. */
export function PreviewMedia({ preview }: { preview: PreviewState }) {
  return (
    <div className="flex min-h-24 min-w-64 items-center justify-center overflow-auto">
      {preview.loading && (
        <span className="flex items-center gap-2.5 p-8 text-sm text-gray-400">
          <HugeiconsIcon
            icon={Loading03Icon}
            size={16}
            className="animate-spin"
            strokeWidth={2}
          />
          Loading…
        </span>
      )}
      {preview.error && (
        <span className="flex max-w-[60vw] items-start gap-2.5 p-6 font-mono text-sm text-red-400">
          <HugeiconsIcon
            icon={Alert02Icon}
            size={16}
            className="mt-0.5 shrink-0"
            strokeWidth={2}
          />
          {preview.error}
        </span>
      )}
      {preview.url && preview.kind === "image" && (
        <img
          src={preview.url}
          alt={preview.name}
          className="max-h-[80vh] max-w-[85vw] object-contain"
        />
      )}
      {preview.url && preview.kind === "video" && (
        <video
          src={preview.url}
          controls
          autoPlay
          className="max-h-[80vh] max-w-[85vw]"
        />
      )}
      {preview.url && preview.kind === "pdf" && (
        <embed
          src={preview.url}
          type="application/pdf"
          className="h-[80vh] w-[75vw]"
        />
      )}
      {preview.text !== undefined && preview.kind === "markdown" && (
        <MarkdownPreview text={preview.text} />
      )}
    </div>
  );
}
