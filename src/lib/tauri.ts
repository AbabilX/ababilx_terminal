import { invoke } from "@tauri-apps/api/core";

export async function ping() {
  return invoke<string>("ping");
}
