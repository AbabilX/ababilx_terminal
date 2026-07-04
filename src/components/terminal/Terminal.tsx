import { useEffect, useRef } from "react";

import { PreviewDialog } from "./PreviewDialog";
import { usePreview } from "../../hooks/usePreview";
import { useTerminalSession } from "../../hooks/useTerminalSession";

import "@xterm/xterm/css/xterm.css";

interface TerminalViewProps {
  sessionId: string;
  visible: boolean;
}

export default function TerminalView({ sessionId, visible }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { preview, previewRef, openPreview, closePreview, showUsage } =
    usePreview(sessionId, () => terminalRef.current?.focus());

  const { terminalRef, fitRef } = useTerminalSession({
    sessionId,
    containerRef,
    previewRef,
    preview: {
      isOpen: () => previewRef.current !== null,
      open: openPreview,
      close: closePreview,
      showUsage,
    },
  });

  useEffect(() => {
    if (visible) {
      fitRef.current?.fit();
      terminalRef.current?.focus();
    }
  }, [visible, fitRef, terminalRef]);

  return (
    <>
      <div
        ref={containerRef}
        className="relative h-full w-full overflow-hidden"
        onClick={() => terminalRef.current?.focus()}
      />
      {preview && <PreviewDialog preview={preview} onClose={closePreview} />}
    </>
  );
}
