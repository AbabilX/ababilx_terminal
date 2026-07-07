/**
 * Tracks the current working directory of a PTY session by watching the
 * commands the user sends. This is "best-effort": it stays accurate as long as
 * directory changes come from visible `cd` commands typed directly into the
 * shell. Script-internal `cd` calls are not observed.
 *
 * Initialise with the home directory (the same default PtySession uses when it
 * starts). Call `noteCommand(cmd)` with the expanded command string just before
 * it is sent to the shell; CWD is updated when the command is a `cd …`.
 */
export class CwdTracker {
  private _cwd: string;
  private _prevCwd: string;
  readonly homeDir: string;

  constructor(homeDir: string) {
    this.homeDir = homeDir;
    this._cwd = homeDir;
    this._prevCwd = homeDir;
  }

  get cwd(): string {
    return this._cwd;
  }

  /**
   * Called with the **expanded** command that is about to be sent to the PTY.
   * Parses `cd` invocations and updates the tracked CWD accordingly.
   */
  noteCommand(cmd: string, homeDir: string) {
    const trimmed = cmd.trim();

    // Match: `cd`, `cd ~`, `cd -`, `cd <path>`
    const m = trimmed.match(/^cd(?:\s+(.+))?$/);
    if (!m) return;

    const arg = m[1]?.trim() ?? "";

    if (!arg || arg === "~") {
      this._prevCwd = this._cwd;
      this._cwd = homeDir;
      return;
    }

    if (arg === "-") {
      const tmp = this._prevCwd;
      this._prevCwd = this._cwd;
      this._cwd = tmp;
      return;
    }

    // Absolute path (Unix or Windows) — use as-is.
    if (isAbsolute(arg)) {
      this._prevCwd = this._cwd;
      this._cwd = normPath(arg);
      return;
    }

    // Tilde expansion for `~/…` or `~\…`.
    if (arg.startsWith("~/") || arg.startsWith("~\\")) {
      this._prevCwd = this._cwd;
      this._cwd = normPath(homeDir + arg.slice(1));
      return;
    }

    // Relative path — resolve against tracked CWD.
    this._prevCwd = this._cwd;
    this._cwd = normPath(joinPath(this._cwd, arg));
  }
}

/** Very lightweight path join/normalize that handles both `/` and `\` separators. */
function joinPath(base: string, rel: string): string {
  const sep = base.includes("\\") ? "\\" : "/";
  return base.replace(/[/\\]+$/, "") + sep + rel;
}

function isAbsolute(p: string): boolean {
  // Unix absolute path
  if (p.startsWith("/")) return true;
  // Windows drive-letter path: C:\ or C:/
  if (/^[A-Za-z]:[/\\]/.test(p)) return true;
  // Windows UNC path
  if (p.startsWith("\\\\")) return true;
  return false;
}

/** Remove redundant `.` and `..` segments (best-effort, not fs-verified). */
function normPath(p: string): string {
  const sep = p.includes("\\") ? "\\" : "/";
  const parts = p.split(/[/\\]/);
  const stack: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") {
      if (stack.length === 0) stack.push(part); // preserve leading empty for Unix root
      continue;
    }
    if (part === "..") {
      if (stack.length > 1) stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join(sep);
}
