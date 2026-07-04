/**
 * Matches a KeyboardEvent against a binding string like "ctrl+shift+t" or "ctrl+,".
 * Modifier order in the string does not matter.
 */
const isMac =
  typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

export function matchesKeybind(e: KeyboardEvent, binding: string): boolean {
  const parts = binding.toLowerCase().split("+");
  const key = parts.pop();
  if (!key) return false;

  // App shortcuts write "ctrl" for the primary modifier; on Mac that means
  // Cmd (Ctrl stays free for terminal chords like Ctrl+C/Ctrl+D).
  const wantPrimary = parts.includes("ctrl") || parts.includes("cmd") || parts.includes("meta");
  const wantShift = parts.includes("shift");
  const wantAlt = parts.includes("alt");

  const primaryPressed = isMac ? e.metaKey : e.ctrlKey;
  const otherPressed = isMac ? e.ctrlKey : e.metaKey;

  return (
    primaryPressed === wantPrimary &&
    !otherPressed &&
    e.shiftKey === wantShift &&
    e.altKey === wantAlt &&
    e.key.toLowerCase() === key
  );
}
