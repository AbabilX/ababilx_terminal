import { invoke } from "@tauri-apps/api/core";

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
