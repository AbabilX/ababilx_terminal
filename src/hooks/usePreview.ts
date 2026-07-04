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
    const trimmed = rawArg.trim();
    // Quoted arg: strip the quotes as-is (shell quoting means no backslash-escapes inside).
    // Unquoted arg: shell-style backslash-escapes (e.g. drag-and-dropped paths with
    // `\ ` for spaces) never reach a real shell here, so unescape them ourselves.
    const arg = /^(['"])(.*)\1$/.test(trimmed)
      ? trimmed.replace(/^(['"])(.*)\1$/, "$2")
      : trimmed.replace(/\\(.)/g, "$1");
    setPreview({ name: arg, loading: true });
    try {
      const file = await readPreviewFile(sessionId, arg);
      if (file.kind === "markdown") {
        const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
        const text = new TextDecoder("utf-8").decode(bytes);
        setPreview((p) => (p ? { name: file.name, kind: file.kind, text } : p));
        return;
      }
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
