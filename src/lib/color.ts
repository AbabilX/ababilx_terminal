/** "#0d1117" (+ optional alpha 0–1) -> "rgba(13, 17, 23, a)". Bad hex falls back to near-black. */
export function hexToRgba(hex: string, alpha = 1): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = parseInt(m ? m[1] : "0d1117", 16);
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${a})`;
}

/** Same hex lightened/darkened toward white/black by `amount` (-1..1), as rgba. */
export function shadeRgba(hex: string, amount: number, alpha = 1): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = parseInt(m ? m[1] : "0d1117", 16);
  const mix = (c: number) =>
    Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${mix((n >> 16) & 0xff)}, ${mix((n >> 8) & 0xff)}, ${mix(n & 0xff)}, ${a})`;
}
