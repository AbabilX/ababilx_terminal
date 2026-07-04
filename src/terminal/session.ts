/**
 * Frontend session client — the only module that talks to the Tauri session
 * IPC. The block UI consumes `ShellEvent`s through `onEvent` and calls the
 * methods below; it has no other channel to the backend.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { SessionInfo, ShellEvent, ShellEventEnvelope } from "./events";

const SHELL_EVENT = "shell-event";

export class ShellSession {
  private constructor(
    readonly id: string,
    readonly info: SessionInfo,
    private unlisten: UnlistenFn,
    private handlers: Array<(event: ShellEvent) => void>,
  ) {}

  static async create(id: string): Promise<ShellSession> {
    const handlers: Array<(event: ShellEvent) => void> = [];
    const unlisten = await listen<ShellEventEnvelope>(SHELL_EVENT, (e) => {
      if (e.payload.session_id === id) {
        handlers.forEach((h) => h(e.payload));
      }
    });
    try {
      const info = await invoke<SessionInfo>("session_create", { id });
      return new ShellSession(id, info, unlisten, handlers);
    } catch (err) {
      unlisten();
      throw err;
    }
  }

  onEvent(handler: (event: ShellEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const i = this.handlers.indexOf(handler);
      if (i >= 0) this.handlers.splice(i, 1);
    };
  }

  /** Submit one command line; resolves to the command id. */
  run(line: string): Promise<number> {
    return invoke<number>("session_run", { id: this.id, line });
  }

  /** Keystrokes for the foreground interactive process. */
  writeStdin(data: string): Promise<void> {
    return invoke("session_stdin", { id: this.id, data });
  }

  /** Ctrl+C. */
  cancel(): Promise<void> {
    return invoke("session_cancel", { id: this.id });
  }

  resize(cols: number, rows: number): Promise<void> {
    return invoke("session_resize", { id: this.id, cols, rows });
  }

  history(): Promise<string[]> {
    return invoke<string[]>("session_history", { id: this.id });
  }

  async close(): Promise<void> {
    this.unlisten();
    this.handlers.length = 0;
    await invoke("session_close", { id: this.id });
  }
}
