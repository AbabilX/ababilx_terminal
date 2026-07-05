import { useEffect, useRef } from "react";

import { PreviewDialog } from "./PreviewDialog";
import { usePreview } from "../../hooks/usePreview";
import { useTerminalSession } from "../../hooks/useTerminalSession";
import { useTerminalStore } from "../../store/terminal";

import "@xterm/xterm/css/xterm.css";

interface TerminalViewProps {
  sessionId: string;
  visible: boolean;
}

export default function TerminalView({ sessionId, visible }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const setFocusedPane = useTerminalStore((state) => state.setFocusedPane);

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
      setFocusedPane(sessionId);
      terminalRef.current?.focus();
    }
  }, [visible, fitRef, terminalRef, sessionId, setFocusedPane]);

  const focusPane = () => {
    setFocusedPane(sessionId);
    terminalRef.current?.focus();
  };

  return (
    <>
      <div
        ref={containerRef}
        className="relative h-full w-full overflow-hidden bg-[var(--app-background)]"
        onClick={focusPane}
        onFocusCapture={() => setFocusedPane(sessionId)}
      />
      {preview && <PreviewDialog preview={preview} onClose={closePreview} />}
    </>
  );
}
