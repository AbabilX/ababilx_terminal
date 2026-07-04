/**
 * The AbabilX session event vocabulary — mirror of `ababil-session`'s
 * Rust `ShellEvent`. The frontend consumes ONLY these events; it never
 * observes processes, PTYs or the shell directly.
 */

export type ShellEvent =
  | { type: "command_started"; id: number; line: string }
  | { type: "stdout"; data: string }
  | { type: "stderr"; data: string }
  | {
      type: "command_finished";
      id: number;
      status: number;
      duration_ms: number;
      cwd: string;
    }
  | { type: "clear" }
  | { type: "cwd_changed"; cwd: string }
  | { type: "title_changed"; title: string }
  | { type: "bell" }
  | { type: "session_exited"; code: number };

/** Envelope as emitted by the Tauri host on the `shell-event` channel. */
export type ShellEventEnvelope = ShellEvent & { session_id: string };

export interface SessionCapabilities {
  supportsTui: boolean;
  supportsColor: boolean;
  supportsUnicode: boolean;
  supportsHyperlinks: boolean;
  supportsImages: boolean;
}

export interface SessionInfo {
  cwd: string;
  capabilities: SessionCapabilities;
}
