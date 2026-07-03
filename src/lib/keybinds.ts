/**
 * Matches a KeyboardEvent against a binding string like "ctrl+shift+t" or "ctrl+,".
 * Modifier order in the string does not matter.
 */
export function matchesKeybind(e: KeyboardEvent, binding: string): boolean {
  const parts = binding.toLowerCase().split("+");
  const key = parts.pop();
  if (!key) return false;

  const wantCtrl = parts.includes("ctrl");
  const wantShift = parts.includes("shift");
  const wantAlt = parts.includes("alt");
  const wantMeta = parts.includes("meta") || parts.includes("cmd");

  return (
    e.ctrlKey === wantCtrl &&
    e.shiftKey === wantShift &&
    e.altKey === wantAlt &&
    e.metaKey === wantMeta &&
    e.key.toLowerCase() === key
  );
}
