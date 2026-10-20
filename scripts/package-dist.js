#!/usr/bin/env node

// Packages the app, the Premiere extension and a one-click installer into the release zip

const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const SETUP_DIR = path.join(DIST_DIR, "MediaDrop-Setup");
const VERSION = require(path.join(ROOT_DIR, "package.json")).version;
const ZIP_PATH = path.join(DIST_DIR, `MediaDrop-${VERSION}-mac-apple-silicon.zip`);

// 1. Ensure fresh native app build
console.log("\n[1/6] Building fresh native application...");
cp.execSync("node scripts/build-app.js", { cwd: ROOT_DIR, stdio: "inherit" });

// 2. Prepare dist directory
console.log("\n[2/6] Preparing distribution staging directory...");
if (fs.existsSync(SETUP_DIR)) {
  fs.rmSync(SETUP_DIR, { recursive: true, force: true });
}
fs.mkdirSync(SETUP_DIR, { recursive: true });

// 3. Copy MediaDrop.app
console.log("\n[3/6] Packaging MediaDrop.app...");
cp.execSync('cp -R "/Applications/MediaDrop.app" "' + SETUP_DIR + '/"');

// 4. Copy premiere-extension
console.log("\n[4/6] Packaging Premiere Pro extension backend...");
const extSrc = path.join(ROOT_DIR, "premiere-extension");
const extDest = path.join(SETUP_DIR, "premiere-extension");
cp.execSync(`cp -R "${extSrc}" "${extDest}"`);

// 5. Create "Install MediaDrop.command"
console.log("\n[5/6] Creating One-Click Installer script (Install MediaDrop.command)...");
const installerScript = `#!/bin/bash
# MediaDrop Automated One-Click Installer for macOS
DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "=================================================="
echo "          MediaDrop Installer for macOS           "
echo "=================================================="
echo ""

# 1. Install MediaDrop.app to /Applications
echo "[1/4] Installing MediaDrop to /Applications..."
if [ -d "/Applications/MediaDrop.app" ]; then
  pkill -f "/Applications/MediaDrop.app/Contents/MacOS/MediaDrop" 2>/dev/null || true
  sleep 1
  rm -rf "/Applications/MediaDrop.app"
fi
cp -R "$DIR/MediaDrop.app" "/Applications/"
echo "  ✓ Copied MediaDrop.app to /Applications"

touch "/Applications/MediaDrop.app"

# 2. Clear quarantine attribute
echo "[2/4] Setting macOS permissions..."
xattr -cr "/Applications/MediaDrop.app" 2>/dev/null || true
echo "  ✓ Gatekeeper permissions cleared"

# 3. Enable Adobe CEP PlayerDebugMode
echo "[3/4] Configuring Adobe Premiere Pro CEP Extensions..."
for v in 11 12 13 14 15 16 17 18 19 20; do
  defaults write com.adobe.CSXS.$v PlayerDebugMode 1 2>/dev/null || true
done
echo "  ✓ Adobe CEP PlayerDebugMode enabled"

# 4. Install Premiere Pro Extension
echo "[4/4] Installing Premiere Pro Bridge..."
CEP_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"
mkdir -p "$CEP_DIR"
TARGET_EXT="$CEP_DIR/MediaDropBackend"
rm -rf "$TARGET_EXT"
cp -R "$DIR/premiere-extension" "$TARGET_EXT"
echo "  ✓ Premiere Pro extension installed to $TARGET_EXT"

# macOS checks new programs the first time they run, which takes yt-dlp ~30 seconds.
# Do it now so the first YouTube download in MediaDrop doesn't wait for it.
echo "  … Preparing the YouTube downloader (about 30 seconds)"
for y in /Applications/MediaDrop.app/Contents/Resources/yt-dlp/*/yt-dlp_macos; do "$y" --version >/dev/null 2>&1 || true; done

# Register with macOS LaunchServices
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f /Applications/MediaDrop.app 2>/dev/null || true

echo ""
echo "=================================================="
echo "            INSTALLATION COMPLETE!                "
echo "=================================================="
echo "Next Steps:"
echo "1. If Adobe Premiere Pro is open, please QUIT and RESTART it."
echo "2. Open any project with an active sequence in Premiere."
echo "3. Opening MediaDrop now..."
echo "=================================================="
open -a MediaDrop
echo ""
echo "You can close this Terminal window now."
`;

const installerPath = path.join(SETUP_DIR, "Install MediaDrop.command");
fs.writeFileSync(installerPath, installerScript, { mode: 0o755 });
cp.execSync(`chmod +x "${installerPath}"`);

// Create README.txt
const readmeContent = `=======================================================
        MediaDrop ${VERSION} - Install Guide (macOS)
=======================================================

Requirements: a Mac with Apple Silicon (M1 or newer) and
Adobe Premiere Pro.

STEP 1 - Run the installer
  Double-click "Install MediaDrop.command".

  macOS will probably say it "cannot verify the developer"
  (MediaDrop is free and not registered with Apple). To allow it:
    1. Click "Done" (or "OK") on the warning.
    2. Open System Settings > Privacy & Security.
    3. Scroll down and click "Open Anyway" next to
       "Install MediaDrop.command", then confirm.

STEP 2 - Restart Premiere Pro
  If Premiere Pro was open, quit it and open it again.

STEP 3 - Use it
  Open a project with a sequence, then open MediaDrop.
  The "Pr" light in MediaDrop turns green when connected.

TIPS
  - Use Search to find videos, images, music, sound effects and
    GIFs from many sites. Each result says if it's free to use.
  - Right-click any image, GIF or video in MediaDrop to import it.
  - Click the download icon on a YouTube thumbnail to pick a quality.
  - Press Command+Shift+M to show MediaDrop from any app
    (change it in Settings).
  - Everything is saved to Downloads/MediaDrop_Imports, even
    when Premiere Pro isn't open.
  - When a new version is out, an "Update" button appears in
    the top bar. Click it to install the update in one step.

SIGNING IN (optional)
  You only need to sign in to YouTube for age-restricted or
  members-only videos. Public videos download without it.
  - Use a secondary Google account. Downloading with yt-dlp
    while signed in can get an account rate-limited.
  - Logins stay on your Mac, encrypted with your Keychain.
    MediaDrop has no server and sends your data nowhere.
  - If macOS asks for access to "MediaDrop Safe Storage"
    (usually after an update), click "Always Allow". That is
    the key that unlocks your saved logins.

Only download content you have the right to use.
Third-party licenses: THIRD_PARTY_NOTICES.txt
=======================================================
`;

fs.writeFileSync(path.join(SETUP_DIR, "README.txt"), readmeContent, "utf-8");
fs.copyFileSync(path.join(ROOT_DIR, "vendor", "THIRD_PARTY_NOTICES.txt"), path.join(SETUP_DIR, "THIRD_PARTY_NOTICES.txt"));

// 6. Create Zip archive
console.log("\n[6/6] Creating distributable zip archive...");
if (fs.existsSync(ZIP_PATH)) {
  fs.rmSync(ZIP_PATH, { force: true });
}

// ditto keeps permissions and executable bits; macOS metadata (._ files) is left out
cp.execSync(`ditto -c -k --norsrc --noextattr --keepParent "${SETUP_DIR}" "${ZIP_PATH}"`);

const stats = fs.statSync(ZIP_PATH);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);

console.log(`\nCreated ${ZIP_PATH} (${sizeMB} MB)`);
