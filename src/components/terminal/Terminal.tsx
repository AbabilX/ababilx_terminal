import { useEffect, useRef } from "react";

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

import "@xterm/xterm/css/xterm.css";

export default function TerminalView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "JetBrains Mono, Consolas, monospace",
      theme: {
        background: "#0d1117",
        foreground: "#f8f8f2",
        cursor: "#ffffff",
      },
    });

    const fitAddon = new FitAddon();

    terminal.loadAddon(fitAddon);

    terminal.open(containerRef.current);

    fitAddon.fit();

    terminal.focus();

    terminal.writeln("🚀 AbabilX Terminal");
    terminal.writeln("");
    terminal.write("$ ");

    terminal.onData((data) => {
      terminal.write(data);
    });

    window.addEventListener("resize", () => fitAddon.fit());

    terminalRef.current = terminal;

    return () => {
      terminal.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      tabIndex={0}
      onClick={() => terminalRef.current?.focus()}
    />
  );
}
