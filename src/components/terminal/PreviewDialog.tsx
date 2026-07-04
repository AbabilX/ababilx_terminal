export interface PreviewState {
  name: string;
  kind?: "image" | "video" | "pdf";
  /** Blob URL of the file contents; absent while loading or on error. */
  url?: string;
  error?: string;
  loading?: boolean;
}

interface PreviewDialogProps {
  preview: PreviewState;
  onClose: () => void;
}

export function PreviewDialog({ preview, onClose }: PreviewDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] max-w-[90vw] flex-col overflow-hidden rounded-lg border border-[#30363d] bg-[#161b22] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-8 border-b border-[#30363d] px-4 py-2">
          <span className="truncate font-mono text-sm text-[#c9d1d9]">
            {preview.name || "preview"}
          </span>
          <button
            className="rounded px-2 text-lg leading-none text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]"
            onClick={onClose}
            aria-label="Close preview"
          >
            ×
          </button>
        </div>

        <div className="flex min-h-24 min-w-64 items-center justify-center overflow-auto">
          {preview.loading && (
            <span className="p-6 text-sm text-[#8b949e]">Loading…</span>
          )}
          {preview.error && (
            <span className="max-w-[60vw] p-6 font-mono text-sm text-[#f85149]">
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
        </div>
      </div>
    </div>
  );
}
