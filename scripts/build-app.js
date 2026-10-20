#!/usr/bin/env node

// Builds /Applications/MediaDrop.app from the Electron runtime and this project's code

const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const ELECTRON_DIST_APP = path.join(ROOT_DIR, "node_modules", "electron", "dist", "Electron.app");
const TARGET_APP = "/Applications/MediaDrop.app";

let baseApp = null;
if (fs.existsSync(ELECTRON_DIST_APP)) {
  baseApp = ELECTRON_DIST_APP;
} else if (fs.existsSync(TARGET_APP)) {
  baseApp = TARGET_APP;
} else if (fs.existsSync(path.join(ROOT_DIR, "dist", "MediaDrop-Setup", "MediaDrop.app"))) {
  baseApp = path.join(ROOT_DIR, "dist", "MediaDrop-Setup", "MediaDrop.app");
}

if (!baseApp) {
  console.error("Error: No base Electron app found. Run 'npm install' first.");
  process.exit(1);
}

// 1. Prepare target app
if (baseApp !== TARGET_APP) {
  if (fs.existsSync(TARGET_APP)) {
    console.log(`Removing old ${TARGET_APP}`);
    fs.rmSync(TARGET_APP, { recursive: true, force: true });
  }
  console.log(`Creating ${TARGET_APP}`);
  cp.execSync(`cp -R "${baseApp}" "${TARGET_APP}"`);
} else {
  console.log(`Updating ${TARGET_APP}`);
}

// 3. Rename executable
const macosDir = path.join(TARGET_APP, "Contents", "MacOS");
const oldExe = path.join(macosDir, "Electron");
const newExe = path.join(macosDir, "MediaDrop");
if (fs.existsSync(oldExe)) {
  fs.renameSync(oldExe, newExe);
  cp.execSync(`chmod +x "${newExe}"`);
}

// 4. Update Info.plist & Application Icon
const plistPath = path.join(TARGET_APP, "Contents", "Info.plist");
if (fs.existsSync(plistPath)) {
  let plist = fs.readFileSync(plistPath, "utf-8");
  plist = plist.replace(/<string>Electron<\/string>/g, "<string>MediaDrop</string>");
  plist = plist.replace(/<string>com\.github\.Electron<\/string>/g, "<string>com.mediadrop.app</string>");
  plist = plist.replace(/<key>CFBundleName<\/key>\s*<string>.*?<\/string>/, "<key>CFBundleName</key>\n\t<string>MediaDrop</string>");
  plist = plist.replace(/<key>CFBundleDisplayName<\/key>\s*<string>.*?<\/string>/, "<key>CFBundleDisplayName</key>\n\t<string>MediaDrop</string>");
  plist = plist.replace(/<key>CFBundleExecutable<\/key>\s*<string>.*?<\/string>/, "<key>CFBundleExecutable</key>\n\t<string>MediaDrop</string>");
  plist = plist.replace(/<key>CFBundleIconFile<\/key>\s*<string>.*?<\/string>/, "<key>CFBundleIconFile</key>\n\t<string>AppIcon.icns</string>");
  const appVersion = require(path.join(ROOT_DIR, "package.json")).version;
  plist = plist.replace(/<key>CFBundleVersion<\/key>\s*<string>.*?<\/string>/, `<key>CFBundleVersion</key>\n\t<string>${appVersion}</string>`);
  plist = plist.replace(/<key>CFBundleShortVersionString<\/key>\s*<string>.*?<\/string>/, `<key>CFBundleShortVersionString</key>\n\t<string>${appVersion}</string>`);
  fs.writeFileSync(plistPath, plist);
}

// Copy custom AppIcon.icns to bundle resources
const srcIcns = path.join(ROOT_DIR, "assets", "AppIcon.icns");
const resDir = path.join(TARGET_APP, "Contents", "Resources");
if (fs.existsSync(srcIcns)) {
  fs.copyFileSync(srcIcns, path.join(resDir, "AppIcon.icns"));
  fs.copyFileSync(srcIcns, path.join(resDir, "electron.icns"));
  fs.copyFileSync(srcIcns, path.join(resDir, "app.icns"));
}

// 5. Populate Contents/Resources/app cleanly (avoid nested directories)
const appDir = path.join(TARGET_APP, "Contents", "Resources", "app");
if (fs.existsSync(appDir)) {
  fs.rmSync(appDir, { recursive: true, force: true });
}
fs.mkdirSync(appDir, { recursive: true });

// Copy essential files and assets directly into appDir
const itemsToCopy = ["package.json", "main.js", "preload.js", "renderer", "assets"];
itemsToCopy.forEach((item) => {
  const src = path.join(ROOT_DIR, item);
  if (fs.existsSync(src)) {
    cp.execSync(`cp -R "${src}" "${appDir}/"`);
  }
});

// Bundled command-line tools: ffmpeg, ffprobe → Contents/Resources/bin; yt-dlp folder build → Contents/Resources/yt-dlp
const resourcesDir = path.join(TARGET_APP, "Contents", "Resources");
for (const name of ["bin", "yt-dlp"]) {
  const src = path.join(ROOT_DIR, "vendor", name);
  const dest = path.join(resourcesDir, name);
  fs.rmSync(dest, { recursive: true, force: true });
  if (fs.existsSync(src)) cp.execSync(`cp -R "${src}" "${dest}"`);
  else console.warn(`  ! vendor/${name} missing: run 'npm run fetch-tools' (falls back to Homebrew yt-dlp/ffmpeg)`);
}
fs.copyFileSync(path.join(ROOT_DIR, "vendor", "THIRD_PARTY_NOTICES.txt"), path.join(resourcesDir, "THIRD_PARTY_NOTICES.txt"));

// Clean up any stale node_modules inside app directory (standalone app has zero external dependencies)
const targetNodeModules = path.join(appDir, "node_modules");
if (fs.existsSync(targetNodeModules)) fs.rmSync(targetNodeModules, { recursive: true, force: true });

// Electron security switches ("fuses") are baked into the binary, so flip them before signing.
// - Cookie encryption: logins are stored encrypted with a key in the macOS Keychain, like Chrome.
// - NODE_OPTIONS / --inspect off: other programs can't inject code into MediaDrop through them.
// RunAsNode stays on: yt-dlp runs MediaDrop's Electron as its JavaScript runtime.
const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");

(async () => {
  await flipFuses(TARGET_APP, {
    version: FuseVersion.V1,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false
  });

  // Renaming the executable and editing Info.plist/Resources broke Electron's signature.
  // Re-seal the bundle with an ad-hoc signature so Apple Silicon will launch it.
  // (A paid Apple Developer ID + notarization is what removes the Gatekeeper warning entirely.)
  cp.execSync(`xattr -cr "${TARGET_APP}"`);
  cp.execSync(`codesign --force --deep --sign - "${TARGET_APP}"`, { stdio: "inherit" });
  cp.execSync(`codesign --verify --deep --strict "${TARGET_APP}"`, { stdio: "inherit" });

  // Touch bundle and register with macOS LaunchServices so Spotlight, Finder, and Dock recognize icon immediately
  try {
    cp.execSync(`touch "${TARGET_APP}"`);
    cp.execSync('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f /Applications/MediaDrop.app 2>/dev/null || true');
  } catch (e) {}

  console.log(`Installed ${TARGET_APP}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
