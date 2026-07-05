function parsePart(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Compare semver-like strings (major.minor.patch). Returns -1, 0, or 1. */
export function compareVersions(a: string, b: string): number {
  const partsA = a.replace(/^v/i, "").split(".");
  const partsB = b.replace(/^v/i, "").split(".");

  for (let i = 0; i < 3; i++) {
    const diff = parsePart(partsA[i] ?? "0") - parsePart(partsB[i] ?? "0");
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }

  return 0;
}
