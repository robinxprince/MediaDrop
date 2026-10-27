#!/usr/bin/env node

// Packages the app, the Premiere extension and a one-click installer into the release zip.
//   npm run package       macOS (Apple Silicon): dist/MediaDrop-<version>-mac-apple-silicon.zip
//   npm run package:win   Windows x64:           dist/MediaDrop-<version>-windows-x64.zip
// The updater (main.js) finds each platform's zip by those names and expects MediaDrop-Setup inside.

const fs = require("fs");
const path = require("path");
const os = require("os");
const cp = require("child_process");

const IS_WIN = process.argv[2] === "win";
const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const SETUP_DIR = IS_WIN ? path.join(DIST_DIR, "win", "MediaDrop-Setup") : path.join(DIST_DIR, "MediaDrop-Setup");
const VERSION = require(path.join(ROOT_DIR, "package.json")).version;
const ZIP_PATH = path.join(DIST_DIR, `MediaDrop-${VERSION}-${IS_WIN ? "windows-x64" : "mac-apple-silicon"}.zip`);

// 1. Ensure fresh native app build
console.log("\n[1/6] Building fresh native application...");
cp.execSync(`node scripts/${IS_WIN ? "build-win.js" : "build-app.js"}`, { cwd: ROOT_DIR, stdio: "inherit" });

// 2. Prepare dist directory
console.log("\n[2/6] Preparing distribution staging directory...");
if (fs.existsSync(SETUP_DIR)) {
  fs.rmSync(SETUP_DIR, { recursive: true, force: true });
}
fs.mkdirSync(SETUP_DIR, { recursive: true });

// 3. Copy the app
if (IS_WIN) {
  console.log("\n[3/6] Packaging MediaDrop for Windows...");
  fs.cpSync(path.join(DIST_DIR, "win", "MediaDrop"), path.join(SETUP_DIR, "MediaDrop"), { recursive: true });
} else {
  console.log("\n[3/6] Packaging MediaDrop.app...");
  cp.execSync('cp -R "/Applications/MediaDrop.app" "' + SETUP_DIR + '/"');
}

// 4. Copy premiere-extension
console.log("\n[4/6] Packaging Premiere Pro extension backend...");
fs.cpSync(path.join(ROOT_DIR, "premiere-extension"), path.join(SETUP_DIR, "premiere-extension"), { recursive: true });
signPanel(path.join(SETUP_DIR, "premiere-extension"));

if (IS_WIN) packageWindowsInstaller();
else packageMacInstaller();
fs.copyFileSync(path.join(ROOT_DIR, "vendor", "THIRD_PARTY_NOTICES.txt"), path.join(SETUP_DIR, "THIRD_PARTY_NOTICES.txt"));

// 6. Create Zip archive
console.log("\n[6/6] Creating distributable zip archive...");
if (fs.existsSync(ZIP_PATH)) {
  fs.rmSync(ZIP_PATH, { force: true });
}

if (process.platform === "win32") {
  // tar on Windows 10 and 11 writes zips (-a picks the format from the extension)
  cp.execFileSync("tar", ["-a", "-c", "-f", ZIP_PATH, "-C", path.dirname(SETUP_DIR), path.basename(SETUP_DIR)]);
} else {
  // ditto keeps permissions and executable bits; macOS metadata (._ files) is left out
  cp.execSync(`ditto -c -k --norsrc --noextattr --keepParent "${SETUP_DIR}" "${ZIP_PATH}"`);
}

const stats = fs.statSync(ZIP_PATH);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);

console.log(`\nCreated ${ZIP_PATH} (${sizeMB} MB)`);

// Signs the Premiere panel so Premiere loads it without CEP's PlayerDebugMode. The signature
// (META-INF/signatures.xml) covers every file, so the installers copy the folder unchanged.
// Certificate and tool live outside the repo; the certificate's password is in the Keychain (SHIPPING.md).
function signPanel(dir) {
  console.log("      Signing the Premiere panel...");
  const signDir = path.join(os.homedir(), "Library", "Application Support", "MediaDrop-signing");
  const tool = path.join(signDir, "ZXPSignCmd");
  const cert = path.join(signDir, "MediaDrop-panel.p12");
  if (process.platform !== "darwin" || !fs.existsSync(tool) || !fs.existsSync(cert)) {
    throw new Error(`Panel signing needs ZXPSignCmd and MediaDrop-panel.p12 in ${signDir} on the Mac: see SHIPPING.md`);
  }
  const password = cp.execFileSync("security", ["find-generic-password", "-a", "mediadrop", "-s", "MediaDrop panel signing", "-w"]).toString().trim();
  for (const entry of fs.readdirSync(dir, { recursive: true })) {
    if (path.basename(entry) === ".DS_Store") fs.rmSync(path.join(dir, entry));
  }
  const zxp = path.join(DIST_DIR, "MediaDrop-panel.zxp");
  fs.rmSync(zxp, { force: true });
  // The timestamp keeps the signature valid after the certificate expires
  cp.execFileSync(tool, ["-sign", dir, zxp, cert, password, "-tsa", "http://timestamp.digicert.com"], { stdio: ["ignore", "ignore", "inherit"] });
  fs.rmSync(dir, { recursive: true, force: true });
  cp.execFileSync("ditto", ["-x", "-k", zxp, dir]);
  fs.rmSync(zxp);
  cp.execFileSync(tool, ["-verify", dir], { stdio: ["ignore", "ignore", "inherit"] });
}

// 5. Windows: "Install MediaDrop.cmd" runs install.ps1 (scripts/windows), which the updater also runs
function packageWindowsInstaller() {
  console.log("\n[5/6] Adding the installer (Install MediaDrop.cmd)...");
  fs.copyFileSync(path.join(__dirname, "windows", "install.ps1"), path.join(SETUP_DIR, "install.ps1"));
  // cmd.exe expects Windows line endings
  const cmd = fs.readFileSync(path.join(__dirname, "windows", "Install MediaDrop.cmd"), "utf-8").replace(/\r?\n/g, "\r\n");
  fs.writeFileSync(path.join(SETUP_DIR, "Install MediaDrop.cmd"), cmd);
  const uninstallCmd = fs.readFileSync(path.join(__dirname, "windows", "Uninstall MediaDrop.cmd"), "utf-8").replace(/\r?\n/g, "\r\n");
  fs.writeFileSync(path.join(SETUP_DIR, "Uninstall MediaDrop.cmd"), uninstallCmd);

  const readmeContent = `=======================================================
        MediaDrop ${VERSION} - Install Guide (Windows)
=======================================================

Requirements: Windows 10 or 11 (64-bit) and Adobe Premiere Pro.

STEP 1 - Unzip, then run the installer
  Right-click the zip > Extract All, open the extracted
  MediaDrop-Setup folder and double-click "Install MediaDrop.cmd".

  Windows will probably show "Windows protected your PC"
  (MediaDrop is free and not signed with a paid certificate).
  To allow it:
    1. Click "More info".
    2. Click "Run anyway".

  MediaDrop installs for your Windows account only, so it
  doesn't ask for administrator rights. It adds MediaDrop to
  the Start menu and the desktop.

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
  - Press Alt+Space to show MediaDrop from any app
    (change it in Settings).
  - Everything is saved to Downloads\\MediaDrop_Imports, even
    when Premiere Pro isn't open.
  - When a new version is out, an "Update" button appears in
    the top bar. Click it to install the update in one step.
  - To uninstall: MediaDrop Settings > Uninstall, Windows
    Settings > Apps > Installed apps > MediaDrop, or double-click
    "Uninstall MediaDrop.cmd". Your downloaded media is kept.

SIGNING IN (optional)
  You only need to sign in to YouTube for age-restricted or
  members-only videos. Public videos download without it.
  - Use a secondary Google account. Downloading with yt-dlp
    while signed in can get an account rate-limited.
  - Logins stay on your PC, encrypted by Windows for your
    account. MediaDrop has no server and sends your data nowhere.

Only download content you have the right to use.
Third-party licenses: THIRD_PARTY_NOTICES.txt
=======================================================
`;
  fs.writeFileSync(path.join(SETUP_DIR, "README.txt"), readmeContent.replace(/\n/g, "\r\n"), "utf-8");
}

function packageMacInstaller() {
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
echo "[1/3] Installing MediaDrop to /Applications..."
if [ -d "/Applications/MediaDrop.app" ]; then
  pkill -f "/Applications/MediaDrop.app/Contents/MacOS/MediaDrop" 2>/dev/null || true
  sleep 1
  rm -rf "/Applications/MediaDrop.app"
fi
cp -R "$DIR/MediaDrop.app" "/Applications/"
echo "  ✓ Copied MediaDrop.app to /Applications"

touch "/Applications/MediaDrop.app"

# 2. Clear quarantine attribute
echo "[2/3] Setting macOS permissions..."
xattr -cr "/Applications/MediaDrop.app" 2>/dev/null || true
echo "  ✓ Gatekeeper permissions cleared"

# 3. Install the Premiere Pro panel (signed, so Premiere loads it without CEP's debug mode)
echo "[3/3] Installing Premiere Pro Bridge..."
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
  fs.copyFileSync(path.join(__dirname, "mac", "uninstall.command"), path.join(SETUP_DIR, "Uninstall MediaDrop.command"));
  fs.chmodSync(path.join(SETUP_DIR, "Uninstall MediaDrop.command"), 0o755);

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
  - Press Option+Space to show MediaDrop from any app
    (change it in Settings).
  - Everything is saved to Downloads/MediaDrop_Imports, even
    when Premiere Pro isn't open.
  - When a new version is out, an "Update" button appears in
    the top bar. Click it to install the update in one step.
  - To uninstall: MediaDrop Settings > Uninstall, or double-click
    "Uninstall MediaDrop.command". Your downloaded media is kept.

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
}
