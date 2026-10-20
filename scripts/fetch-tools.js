#!/usr/bin/env node
/**
 * Downloads the command-line tools MediaDrop bundles into vendor/<platform>:
 *   yt-dlp/<version> — latest official folder build (macOS or Windows), checked against yt-dlp's SHA2-256SUMS
 *   bin/ffmpeg, ffprobe — pinned builds (see vendor/THIRD_PARTY_NOTICES.txt), checked against fixed hashes:
 *     macOS: arm64 static builds; Windows: x64 shared build (the .exe files plus the FFmpeg DLLs they load)
 * Run once after cloning: npm run fetch-tools          (tools for this computer)
 *                         npm run fetch-tools -- win32  (Windows tools, to build the Windows release)
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const cp = require("child_process");

const PLATFORM = process.argv[2] || process.platform;
if (!["darwin", "win32"].includes(PLATFORM)) throw new Error(`No MediaDrop build for "${PLATFORM}": use darwin or win32`);
const VENDOR_DIR = path.join(__dirname, "..", "vendor", PLATFORM);
const BIN_DIR = path.join(VENDOR_DIR, "bin");
const YT_DLP_DIR = path.join(VENDOR_DIR, "yt-dlp");
const YT_DLP_ZIP = PLATFORM === "win32" ? "yt-dlp_win.zip" : "yt-dlp_macos.zip";

const FFMPEG_MAC_BASE = "https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_9.0.2";
const FFMPEG_MAC_ZIPS = {
  ffmpeg: "c8ed4c4e6978a03c485edbfe4e0a5dc2380f8a30bba5150531b31b094492d924",
  ffprobe: "fcbe839537485eaee7a7a8bc5cbc0f90d53617e80943e8a5b2e31cb851197ea6"
};
const FFMPEG_WIN_ZIP = {
  url: "https://github.com/GyanD/codexffmpeg/releases/download/9.0.2/ffmpeg-9.0.2-full_build-shared.zip",
  sha256: "8d31e162f1616e37aab3fa2db991b97e1b8dbeb1c8465fd81a81be16ff91b328",
  binDir: "ffmpeg-9.0.2-full_build-shared/bin"
};

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

function download(url, dest) {
  cp.execFileSync("curl", ["-fL", "--retry", "3", "--progress-bar", "-o", dest, url], { stdio: "inherit" });
}

function verify(file, expected) {
  const actual = sha256(file);
  if (actual !== expected) throw new Error(`Checksum mismatch for ${path.basename(file)}: expected ${expected}, got ${actual}`);
}

// ditto on macOS; tar reads zips on Windows 10 and 11
function unzip(zip, dest) {
  fs.mkdirSync(dest, { recursive: true });
  if (process.platform === "win32") cp.execFileSync("tar", ["-xf", zip, "-C", dest]);
  else cp.execFileSync("ditto", ["-x", "-k", zip, dest]);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mediadrop-tools-"));
try {
  // The release redirect names the version: .../releases/tag/2026.08.19
  const latest = cp.execFileSync("curl", ["-fsSLI", "-o", os.devNull, "-w", "%{url_effective}", "https://github.com/yt-dlp/yt-dlp/releases/latest"]).toString();
  const version = latest.split("/").pop();
  if (!/^\d+(\.\d+)+$/.test(version)) throw new Error(`Unexpected yt-dlp release URL: ${latest}`);
  console.log(`yt-dlp ${version} (${PLATFORM})`);
  const ytBase = `https://github.com/yt-dlp/yt-dlp/releases/download/${version}`;
  const sums = cp.execFileSync("curl", ["-fsSL", `${ytBase}/SHA2-256SUMS`]).toString();
  const line = sums.split("\n").find((l) => l.trim().endsWith(` ${YT_DLP_ZIP}`));
  if (!line) throw new Error(`${YT_DLP_ZIP} not listed in SHA2-256SUMS`);
  const ytZip = path.join(tmp, YT_DLP_ZIP);
  download(`${ytBase}/${YT_DLP_ZIP}`, ytZip);
  verify(ytZip, line.split(/\s+/)[0]);
  fs.rmSync(YT_DLP_DIR, { recursive: true, force: true });
  unzip(ytZip, path.join(YT_DLP_DIR, version));

  fs.rmSync(BIN_DIR, { recursive: true, force: true });
  fs.mkdirSync(BIN_DIR, { recursive: true });
  if (PLATFORM === "win32") {
    console.log("ffmpeg, ffprobe 9.0.2 (Windows x64)");
    const zip = path.join(tmp, "ffmpeg.zip");
    download(FFMPEG_WIN_ZIP.url, zip);
    verify(zip, FFMPEG_WIN_ZIP.sha256);
    unzip(zip, tmp);
    const from = path.join(tmp, FFMPEG_WIN_ZIP.binDir);
    for (const name of fs.readdirSync(from).filter((n) => n.endsWith(".dll") || n === "ffmpeg.exe" || n === "ffprobe.exe")) {
      fs.copyFileSync(path.join(from, name), path.join(BIN_DIR, name));
    }
  } else {
    for (const [name, hash] of Object.entries(FFMPEG_MAC_ZIPS)) {
      console.log(`${name} 9.0.2`);
      const zip = path.join(tmp, `${name}.zip`);
      download(`${FFMPEG_MAC_BASE}/${name}.zip`, zip);
      verify(zip, hash);
      unzip(zip, tmp);
      fs.copyFileSync(path.join(tmp, name), path.join(BIN_DIR, name));
      fs.chmodSync(path.join(BIN_DIR, name), 0o755);
    }
  }
  console.log(`\nTools ready in vendor/${PLATFORM}`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
