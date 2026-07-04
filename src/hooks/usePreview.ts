import { useRef, useState } from "react";

import type { PreviewState } from "../components/terminal/PreviewDialog";
import { readPreviewFile } from "../lib/tauri";

/** State + open/close logic for the `see <file>` preview dialog. */
export function usePreview(sessionId: string, refocus: () => void) {
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const previewRef = useRef<PreviewState | null>(null);
  previewRef.current = preview;

  const closePreview = () => {
    setPreview((p) => {
      if (p?.url) URL.revokeObjectURL(p.url);
      return null;
    });
    refocus();
  };

  const openPreview = async (rawArg: string) => {
    const arg = rawArg.trim().replace(/^(['"])(.*)\1$/, "$2");
    setPreview({ name: arg, loading: true });
    try {
      const file = await readPreviewFile(sessionId, arg);
      const blob = await (
        await fetch(`data:${file.mime};base64,${file.base64}`)
      ).blob();
      const url = URL.createObjectURL(blob);
      // Only apply if the dialog wasn't closed while loading.
      setPreview((p) => {
        if (!p) {
          URL.revokeObjectURL(url);
          return p;
        }
        return { name: file.name, kind: file.kind, url };
      });
    } catch (err) {
      setPreview((p) => (p ? { name: arg, error: String(err) } : p));
    }
  };

  const showUsage = () => setPreview({ name: "see", error: "usage: see <file>" });

  return { preview, previewRef, openPreview, closePreview, showUsage };
}
