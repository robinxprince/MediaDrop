#!/usr/bin/env node

// Copies premiere-extension into Premiere Pro's CEP extensions folder and enables
// PlayerDebugMode so the unsigned extension loads

const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const os = require("os");

const EXTENSION_NAME = "MediaDropBackend";
const SOURCE_DIR = path.join(__dirname, "..", "premiere-extension");
const IS_WIN = process.platform === "win32";
const USER_CEP_DIR = IS_WIN
  ? path.join(process.env.APPDATA, "Adobe", "CEP", "extensions")
  : path.join(os.homedir(), "Library", "Application Support", "Adobe", "CEP", "extensions");
const TARGET_DIR = path.join(USER_CEP_DIR, EXTENSION_NAME);

// 1. Ensure user CEP directory exists
if (!fs.existsSync(USER_CEP_DIR)) {
  console.log(`Creating directory: ${USER_CEP_DIR}`);
  fs.mkdirSync(USER_CEP_DIR, { recursive: true });
}

// 2. Enable PlayerDebugMode for CSXS versions 11 to 16

const csxsVersions = [11, 12, 13, 14, 15, 16];
csxsVersions.forEach((v) => {
  try {
    if (IS_WIN) cp.execFileSync("reg", ["add", `HKCU\\Software\\Adobe\\CSXS.${v}`, "/v", "PlayerDebugMode", "/t", "REG_SZ", "/d", "1", "/f"], { stdio: "ignore" });
    else cp.execSync(`defaults write com.adobe.CSXS.${v} PlayerDebugMode 1`, { stdio: "ignore" });
  } catch (e) {
    console.warn(`  ! Could not set CSXS.${v}:`, e.message);
  }
});

// 3. Copy extension files

if (fs.existsSync(TARGET_DIR)) {
  fs.rmSync(TARGET_DIR, { recursive: true, force: true });
}

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyRecursive(SOURCE_DIR, TARGET_DIR);
console.log(`Installed to ${TARGET_DIR}`);
console.log("Restart Premiere Pro if it's open, then find the panel under Window > Extensions > MediaDrop.");
