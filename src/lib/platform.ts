/** Frontend platform sniff. In the Tauri webview the userAgent still carries
 * the host OS token, which is enough to branch line-editing behaviour that
 * differs between PowerShell/ConPTY (Windows) and readline shells (Unix). */
export const isWindows = /Windows/i.test(navigator.userAgent);

/** Bytes that erase `n` chars backward from the cursor in the shell's line
 * editor. DEL (0x7f) maps to BackwardDeleteChar in both PSReadLine and GNU
 * readline, so this works cross-platform — unlike Ctrl-U (0x15), which is a
 * kill-line only in Emacs-mode readline and echoes as a literal `^U` under
 * PSReadLine's default Windows edit mode. */
export function eraseChars(n: number): string {
  const char = isWindows ? "\x08" : "\x7f";
  return char.repeat(Math.max(0, n));
}
