#!/usr/bin/env node
/**
 * Downloads the command-line tools MediaDrop bundles:
 *   vendor/yt-dlp/<version> — latest official macOS folder build, checked against yt-dlp's SHA2-256SUMS
 *   vendor/bin/ffmpeg, ffprobe — pinned arm64 static builds (see vendor/THIRD_PARTY_NOTICES.txt), checked against fixed hashes
 * Run once after cloning: npm run fetch-tools
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const cp = require("child_process");

const BIN_DIR = path.join(__dirname, "..", "vendor", "bin");
const YT_DLP_DIR = path.join(__dirname, "..", "vendor", "yt-dlp");
const FFMPEG_BASE = "https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_9.0.2";
const FFMPEG_ZIPS = {
  ffmpeg: "c8ed4c4e6978a03c485edbfe4e0a5dc2380f8a30bba5150531b31b094492d924",
  ffprobe: "fcbe839537485eaee7a7a8bc5cbc0f90d53617e80943e8a5b2e31cb851197ea6"
};

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

function download(url, dest) {
  cp.execFileSync("curl", ["-fL", "--retry", "3", "--progress-bar", "-o", dest, url], { stdio: "inherit" });
}

function verify(file, expected) {
  const actual = sha256(file);
  if (actual !== expected) throw new Error(`Checksum mismatch for ${path.basename(file)}: expected ${expected}, got ${actual}`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mediadrop-tools-"));
try {
  fs.mkdirSync(BIN_DIR, { recursive: true });

  // The release redirect names the version: .../releases/tag/2026.08.19
  const latest = cp.execFileSync("curl", ["-fsSLI", "-o", "/dev/null", "-w", "%{url_effective}", "https://github.com/yt-dlp/yt-dlp/releases/latest"]).toString();
  const version = latest.split("/").pop();
  if (!/^\d+(\.\d+)+$/.test(version)) throw new Error(`Unexpected yt-dlp release URL: ${latest}`);
  console.log(`yt-dlp ${version}`);
  const ytBase = `https://github.com/yt-dlp/yt-dlp/releases/download/${version}`;
  const sums = cp.execFileSync("curl", ["-fsSL", `${ytBase}/SHA2-256SUMS`]).toString();
  const line = sums.split("\n").find((l) => l.trim().endsWith(" yt-dlp_macos.zip"));
  if (!line) throw new Error("yt-dlp_macos.zip not listed in SHA2-256SUMS");
  const ytZip = path.join(tmp, "yt-dlp_macos.zip");
  download(`${ytBase}/yt-dlp_macos.zip`, ytZip);
  verify(ytZip, line.split(/\s+/)[0]);
  fs.rmSync(YT_DLP_DIR, { recursive: true, force: true });
  cp.execFileSync("ditto", ["-x", "-k", ytZip, path.join(YT_DLP_DIR, version)]);
  fs.rmSync(path.join(BIN_DIR, "yt-dlp"), { force: true }); // single-file build used before 1.0.1

  for (const [name, hash] of Object.entries(FFMPEG_ZIPS)) {
    console.log(`${name} 9.0.2`);
    const zip = path.join(tmp, `${name}.zip`);
    download(`${FFMPEG_BASE}/${name}.zip`, zip);
    verify(zip, hash);
    cp.execFileSync("ditto", ["-x", "-k", zip, tmp]);
    fs.copyFileSync(path.join(tmp, name), path.join(BIN_DIR, name));
  }

  for (const name of ["ffmpeg", "ffprobe"]) fs.chmodSync(path.join(BIN_DIR, name), 0o755);
  console.log("\nTools ready in vendor/bin and vendor/yt-dlp");
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
