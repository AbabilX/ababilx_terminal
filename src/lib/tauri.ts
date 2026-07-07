import { invoke } from "@tauri-apps/api/core";

export interface DirEntry {
  name: string;
  is_dir: boolean;
  size: number;
}

/** Lists directory contents using Rust std::fs — no OS shell involved.
 *  Works cross-platform (Windows, macOS, Linux). Entries are sorted:
 *  directories first, then files, each group alphabetically. */
export async function listDir(path: string): Promise<DirEntry[]> {
  return invoke<DirEntry[]>("list_dir", { path });
}

export async function ping() {
  return invoke<string>("ping");
}

export async function createSession(id: string, cols: number, rows: number) {
  return invoke<void>("create_session", { id, cols, rows });
}

export async function writeToSession(id: string, data: string) {
  return invoke<void>("write_to_session", { id, data });
}

export async function resizeSession(id: string, cols: number, rows: number) {
  return invoke<void>("resize_session", { id, cols, rows });
}

export async function closeSession(id: string) {
  return invoke<void>("close_session", { id });
}

export interface PreviewFile {
  kind: "image" | "video" | "pdf" | "markdown";
  mime: string;
  name: string;
  base64: string;
}

export async function readPreviewFile(id: string, path: string) {
  return invoke<PreviewFile>("read_preview_file", { id, path });
}
