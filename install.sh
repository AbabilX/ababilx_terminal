#!/usr/bin/env bash
# Installer script for Abaxana Terminal on macOS.
# Run via: curl -fsSL https://raw.githubusercontent.com/AbabilX/ababilx_terminal/main/install.sh | bash

set -euo pipefail

echo "==> Installing Abaxana Terminal..."

# 1. Verify OS is macOS
if [ "$(uname -s)" != "Darwin" ]; then
  echo "Error: Abaxana Terminal installer currently only supports macOS (Darwin) for this script."
  exit 1
fi

# 2. Detect CPU architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  SUFFIX="aarch64"
  echo "==> Detected Apple Silicon (arm64) architecture."
elif [ "$ARCH" = "x86_64" ]; then
  SUFFIX="x64"
  echo "==> Detected Intel (x64) architecture."
else
  echo "Error: Unsupported CPU architecture: $ARCH"
  exit 1
fi

# 3. Retrieve latest release version from GitHub redirects
REPO="AbabilX/ababilx_terminal"
echo "==> Fetching latest release information for Abaxana..."

# Try retrieving redirect location header
REDIRECT=$(curl -sI "https://github.com/$REPO/releases/latest" | grep -Ei "^location:" | tr -d '\r\n' || true)

if [ -z "$REDIRECT" ]; then
  REDIRECT=$(curl -s -o /dev/null -w "%{url_effective}" "https://github.com/$REPO/releases/latest" || true)
fi

VERSION_TAG=$(echo "$REDIRECT" | grep -oE "[^/]+$" || true)
VERSION=${VERSION_TAG#v}

if [ -z "$VERSION" ] || [ "$VERSION" = "latest" ] || [ "$VERSION" = "releases" ]; then
  # Fallback check using GitHub API
  VERSION_TAG=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"tag_name":\s*"(v[^"]+)".*/\1/' || true)
  VERSION=${VERSION_TAG#v}
fi

if [ -z "$VERSION" ] || [ "$VERSION" = "latest" ] || [ "$VERSION" = "releases" ]; then
  echo "Error: No release found for $REPO. Please make sure a release is published on GitHub."
  exit 1
fi

# 4. Construct asset name and download URL
# Name pattern: Abaxana_{version}_{arch}.dmg
DMG_NAME="Abaxana_${VERSION}_${SUFFIX}.dmg"
DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION_TAG/$DMG_NAME"

echo "==> Latest version found: v$VERSION"
echo "==> Downloading installer package from: $DOWNLOAD_URL"

TEMP_DIR=$(mktemp -d)
TEMP_DMG="$TEMP_DIR/$DMG_NAME"

# Download the asset
if ! curl -L -f -o "$TEMP_DMG" "$DOWNLOAD_URL"; then
  echo "Error: Failed to download the DMG installer. Check if the release asset exists."
  rm -rf "$TEMP_DIR"
  exit 1
fi

# 5. Mount DMG, copy to /Applications, and cleanup
echo "==> Mounting installer package..."
MOUNT_POINT=$(hdiutil mount -nobrowse -plist "$TEMP_DMG" | grep -A 1 "mount-point" | grep -oE "/Volumes/[^\<]+" | head -n 1 || true)

if [ -z "$MOUNT_POINT" ]; then
  echo "Error: Failed to mount DMG installer."
  rm -rf "$TEMP_DIR"
  exit 1
fi

echo "==> Mounted at: $MOUNT_POINT"
APP_PATH="$MOUNT_POINT/Abaxana.app"

if [ ! -d "$APP_PATH" ]; then
  echo "Error: Abaxana.app not found inside the mounted package."
  hdiutil unmount "$MOUNT_POINT"
  rm -rf "$TEMP_DIR"
  exit 1
fi

DEST_APP="/Applications/Abaxana.app"

# Remove any existing install first, otherwise `cp -R` nests the bundle
# inside the old one (Abaxana.app/Abaxana.app).
SUDO=""
if [ -d "$DEST_APP" ]; then
  echo "==> Removing existing installation at $DEST_APP..."
  if ! rm -rf "$DEST_APP" 2>/dev/null; then
    SUDO="sudo"
    sudo rm -rf "$DEST_APP"
  fi
fi

echo "==> Copying Abaxana.app to /Applications..."
if ! cp -R "$APP_PATH" "/Applications/" 2>/dev/null; then
  echo "Permission denied or copy failed. Trying with sudo..."
  SUDO="sudo"
  if ! sudo cp -R "$APP_PATH" "/Applications/"; then
    echo "Error: Failed to copy Abaxana.app to /Applications."
    hdiutil unmount "$MOUNT_POINT"
    rm -rf "$TEMP_DIR"
    exit 1
  fi
fi

# The app is not signed with an Apple Developer ID / notarized, so macOS
# tags the downloaded bundle with a quarantine attribute and Gatekeeper
# refuses to launch it ("Abaxana is damaged and can't be opened").
# Strip the quarantine flag so the app opens directly. Re-apply an ad-hoc
# signature so the modified bundle stays launchable.
echo "==> Clearing Gatekeeper quarantine (app is unsigned)..."
$SUDO xattr -dr com.apple.quarantine "$DEST_APP" 2>/dev/null || true
$SUDO codesign --force --deep --sign - "$DEST_APP" 2>/dev/null || true

# 6. Unmount and Clean
echo "==> Cleaning up mount and temporary files..."
hdiutil unmount "$MOUNT_POINT"
rm -rf "$TEMP_DIR"

echo "==> Installation complete! Abaxana Terminal is now installed in your /Applications folder."
echo "==> You can open it from Launchpad or run: open -a Abaxana"
