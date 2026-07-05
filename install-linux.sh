#!/usr/bin/env bash
# Installer script for Abaxana Terminal on Linux.
# Run via: curl -fsSL https://raw.githubusercontent.com/AbabilX/ababilx_terminal/main/install-linux.sh | bash

set -euo pipefail

echo "==> Installing Abaxana Terminal..."

# 1. Verify OS is Linux
if [ "$(uname -s)" != "Linux" ]; then
  echo "Error: This installer only supports Linux."
  exit 1
fi

# 2. Detect CPU architecture
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
  DEB_SUFFIX="amd64"
  RPM_SUFFIX="x86_64"
  echo "==> Detected x86_64 (amd64) architecture."
else
  echo "Error: Unsupported CPU architecture: $ARCH (only x86_64 builds are published currently)."
  exit 1
fi

# 3. Retrieve latest release version from GitHub
REPO="AbabilX/ababilx_terminal"
echo "==> Fetching latest release information for Abaxana..."

REDIRECT=$(curl -sI "https://github.com/$REPO/releases/latest" | grep -Ei "^location:" | tr -d '\r\n' || true)

if [ -z "$REDIRECT" ]; then
  REDIRECT=$(curl -s -o /dev/null -w "%{url_effective}" "https://github.com/$REPO/releases/latest" || true)
fi

VERSION_TAG=$(echo "$REDIRECT" | grep -oE "[^/]+$" || true)
VERSION=${VERSION_TAG#v}

if [ -z "$VERSION" ] || [ "$VERSION" = "latest" ] || [ "$VERSION" = "releases" ]; then
  VERSION_TAG=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"tag_name":\s*"(v[^"]+)".*/\1/' || true)
  VERSION=${VERSION_TAG#v}
fi

if [ -z "$VERSION" ] || [ "$VERSION" = "latest" ] || [ "$VERSION" = "releases" ]; then
  echo "Error: No release found for $REPO. Please make sure a release is published on GitHub."
  exit 1
fi

echo "==> Latest version found: v$VERSION"

# 4. Pick package format based on the detected package manager
TEMP_DIR=$(mktemp -d)
PACKAGE_PATH=""
INSTALL_MODE=""

if command -v apt-get >/dev/null 2>&1 || command -v dpkg >/dev/null 2>&1; then
  PACKAGE_NAME="Abaxana_${VERSION}_${DEB_SUFFIX}.deb"
  DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION_TAG/$PACKAGE_NAME"
  PACKAGE_PATH="$TEMP_DIR/$PACKAGE_NAME"
  INSTALL_MODE="deb"
elif command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1 || command -v rpm >/dev/null 2>&1; then
  PACKAGE_NAME="Abaxana-${VERSION}-1.${RPM_SUFFIX}.rpm"
  DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION_TAG/$PACKAGE_NAME"
  PACKAGE_PATH="$TEMP_DIR/$PACKAGE_NAME"
  INSTALL_MODE="rpm"
else
  PACKAGE_NAME="Abaxana_${VERSION}_${DEB_SUFFIX}.AppImage"
  DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION_TAG/$PACKAGE_NAME"
  PACKAGE_PATH="$TEMP_DIR/$PACKAGE_NAME"
  INSTALL_MODE="appimage"
fi

echo "==> Downloading installer package from: $DOWNLOAD_URL"

if ! curl -L -f -o "$PACKAGE_PATH" "$DOWNLOAD_URL"; then
  echo "Error: Failed to download the installer package. Check if the release asset exists."
  rm -rf "$TEMP_DIR"
  exit 1
fi

# 5. Install
case "$INSTALL_MODE" in
  deb)
    echo "==> Installing .deb package (requires sudo)..."
    sudo dpkg -i "$PACKAGE_PATH" || sudo apt-get install -f -y
    echo "==> Installation complete! Launch Abaxana from your application menu or run: abaxana"
    ;;
  rpm)
    echo "==> Installing .rpm package (requires sudo)..."
    if command -v dnf >/dev/null 2>&1; then
      sudo dnf install -y "$PACKAGE_PATH"
    elif command -v yum >/dev/null 2>&1; then
      sudo yum install -y "$PACKAGE_PATH"
    else
      sudo rpm -Uvh "$PACKAGE_PATH"
    fi
    echo "==> Installation complete! Launch Abaxana from your application menu or run: abaxana"
    ;;
  appimage)
    INSTALL_DIR="${HOME}/.local/bin"
    mkdir -p "$INSTALL_DIR"
    DEST="$INSTALL_DIR/Abaxana.AppImage"
    chmod +x "$PACKAGE_PATH"
    mv "$PACKAGE_PATH" "$DEST"
    echo "==> Installation complete! AppImage installed to: $DEST"
    echo "==> Run: $DEST"
    if ! echo ":$PATH:" | grep -q ":$INSTALL_DIR:"; then
      echo "==> Tip: add $INSTALL_DIR to your PATH if it is not already."
    fi
    ;;
esac

rm -rf "$TEMP_DIR"
