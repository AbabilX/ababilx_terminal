# 🦅 Abaxana Terminal

Abaxana is a high-performance, developer-focused desktop terminal emulator built with **Tauri (Rust)** and **React/TypeScript**. 

Unlike traditional terminal emulators that wrap system shell binaries (like bash, zsh, cmd, or PowerShell), Abaxana implements its own custom, secure shell language pipeline. It compiles and runs commands directly against native OS process APIs. The Rust-based shell engine owns the execution pipeline, while the React/TypeScript frontend serves as a light, responsive terminal renderer communicating via a fast IPC contract.

---

## 🚀 Quick Install (Terminal)

You can install Abaxana directly from your terminal using the following one-liner commands.

### 🍏 macOS (M1/M2/M3 & Intel)
Run the following command in your terminal to download, mount, and install the application automatically:
```bash
curl -fsSL https://raw.githubusercontent.com/AbabilX/ababilx_terminal/main/install.sh | bash
```

### 🐧 Linux (Debian/Ubuntu, Fedora, & others)
Run the following command in your terminal to download and install the package automatically (`.deb`, `.rpm`, or `.AppImage` depending on your distro):
```bash
curl -fsSL https://raw.githubusercontent.com/AbabilX/ababilx_terminal/main/install-linux.sh | bash
```

### 🏁 Windows (PowerShell)
Open PowerShell and run the following command to download and run the installer package:
```powershell
irm https://raw.githubusercontent.com/AbabilX/ababilx_terminal/main/install.ps1 | iex
```

---

## 🛠️ Development & Building from Source

### Prerequisites
To build Abaxana locally, ensure you have the following installed:
- **Rust** (MSRV 1.75+) — Install via [rustup.rs](https://rustup.rs)
- **Node.js** (v18+) — Download from [nodejs.org](https://nodejs.org)
- **pnpm** — Install via `npm install -g pnpm`

### Steps
1. **Clone the repository:**
   ```bash
   git clone https://github.com/AbabilX/ababilx_terminal.git
   cd ababilx_terminal
   ```

2. **Install frontend dependencies:**
   ```bash
   pnpm install
   ```

3. **Run in development mode (with Tauri GUI window):**
   ```bash
   pnpm tauri dev
   ```

4. **Run compiler & test suites:**
   - Run Rust tests: `cargo test`
   - Run typecheck and linting: `pnpm build`

5. **Build the production release bundle:**
   ```bash
   pnpm tauri build
   ```
   *The installer packages (`.dmg`, `.msi`, `.deb`) will be generated inside `src-tauri/target/release/bundle/`.*

---

## 🏛️ Architecture

Abaxana's shell engine is structured as a strict layered pipeline across multiple Rust crates:

```
ababil-parser   --> Tokenizes and parses terminal inputs into an AST. Pure; no file system or OS access.
ababil-runtime  --> Converts AST to ExecutionPlans and executes builtins against ShellState.
ababil-exec     --> Owns process spawning using native launchers (NativeLauncher & PtyLauncher).
ababil-shell    --> Controls active session state, alias expansion, command history, and evaluations.
ababil-session  --> Stable boundary API exposing run commands, cancellation, and events to the frontend.
ababil-config   --> Manages layered JSON configuration stores (defaults, user-specific, workspace overrides).
ababil-workspace--> Manages serializable layout models (tabs, split panes) for session persistence.
```

---

## 📄 License
This project is open-source and available under the MIT License.
