export type AppPlatform = "macos" | "linux" | "windows";

const UPDATE_COMMANDS: Record<AppPlatform, string> = {
  macos:
    "curl -fsSL https://raw.githubusercontent.com/AbabilX/ababilx_terminal/main/install.sh | bash",
  linux:
    "curl -fsSL https://raw.githubusercontent.com/AbabilX/ababilx_terminal/main/install-linux.sh | bash",
  windows:
    "irm https://raw.githubusercontent.com/AbabilX/ababilx_terminal/main/install.ps1 | iex",
};

export function getUpdateCommand(platform: AppPlatform): string {
  return UPDATE_COMMANDS[platform];
}
