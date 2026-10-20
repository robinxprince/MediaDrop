#!/usr/bin/env node

// Builds the Windows x64 app folder dist/win/MediaDrop from Electron's Windows runtime and this
// project's code. Runs on macOS or Windows: nothing here needs Windows itself.

const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const TARGET_DIR = path.join(ROOT_DIR, "dist", "win", "MediaDrop");
const VENDOR_DIR = path.join(ROOT_DIR, "vendor", "win32");
const pkg = require(path.join(ROOT_DIR, "package.json"));
const ELECTRON_VERSION = require("electron/package.json").version;

// ditto on macOS; tar reads zips on Windows 10 and 11
function unzip(zip, dest) {
  fs.mkdirSync(dest, { recursive: true });
  if (process.platform === "win32") cp.execFileSync("tar", ["-xf", zip, "-C", dest]);
  else cp.execFileSync("ditto", ["-x", "-k", zip, dest]);
}

(async () => {
  for (const name of ["bin", "yt-dlp"]) {
    if (!fs.existsSync(path.join(VENDOR_DIR, name))) throw new Error(`vendor/win32/${name} missing: run 'npm run fetch-tools -- win32'`);
  }

  // 1. Electron's Windows runtime, checked against Electron's published SHASUMS256
  const { downloadArtifact } = await import("@electron/get");
  console.log(`Electron ${ELECTRON_VERSION} (win32-x64)`);
  const electronZip = await downloadArtifact({ version: ELECTRON_VERSION, platform: "win32", arch: "x64", artifactName: "electron" });
  fs.rmSync(TARGET_DIR, { recursive: true, force: true });
  unzip(electronZip, TARGET_DIR);
  const exePath = path.join(TARGET_DIR, "MediaDrop.exe");
  fs.renameSync(path.join(TARGET_DIR, "electron.exe"), exePath);
  const resourcesDir = path.join(TARGET_DIR, "resources");
  fs.rmSync(path.join(resourcesDir, "default_app.asar"), { force: true });

  // 2. App code → resources\app; ffmpeg, ffprobe → resources\bin; yt-dlp folder build → resources\yt-dlp
  const appDir = path.join(resourcesDir, "app");
  for (const item of ["package.json", "main.js", "preload.js", "renderer", "assets"]) {
    fs.cpSync(path.join(ROOT_DIR, item), path.join(appDir, item), { recursive: true });
  }
  for (const name of ["bin", "yt-dlp"]) fs.cpSync(path.join(VENDOR_DIR, name), path.join(resourcesDir, name), { recursive: true });
  fs.copyFileSync(path.join(ROOT_DIR, "vendor", "THIRD_PARTY_NOTICES.txt"), path.join(TARGET_DIR, "THIRD_PARTY_NOTICES.txt"));
  // Settings > Apps > Uninstall runs this (install.ps1 registers it)
  fs.copyFileSync(path.join(__dirname, "windows", "uninstall.ps1"), path.join(TARGET_DIR, "uninstall.ps1"));

  // 3. Icon and the name Windows shows in Task Manager and file properties, instead of Electron's.
  // Electron's Authenticode signature no longer matches once these change, so it is dropped (ignoreCert).
  const ResEdit = await import("resedit");
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(ROOT_DIR, "assets", "AppIcon.ico")));
  const [iconGroup] = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, iconGroup.id, iconGroup.lang, iconFile.icons.map((i) => i.data));
  const [versionInfo] = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  const [major, minor, patch] = pkg.version.split(".").map(Number);
  versionInfo.setFileVersion(major, minor, patch, 0);
  versionInfo.setProductVersion(major, minor, patch, 0);
  for (const lang of versionInfo.getAllLanguagesForStringValues()) {
    versionInfo.setStringValues(lang, {
      ProductName: "MediaDrop",
      FileDescription: "MediaDrop",
      CompanyName: pkg.author,
      InternalName: "MediaDrop",
      OriginalFilename: "MediaDrop.exe",
      LegalCopyright: `MIT License, ${pkg.author}`,
      FileVersion: pkg.version,
      ProductVersion: pkg.version
    });
    versionInfo.removeStringValue(lang, "SquirrelAwareVersion"); // MediaDrop doesn't use the Squirrel updater
  }
  versionInfo.outputToResourceEntries(res.entries);
  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));

  // 4. Same Electron security switches as the macOS build (scripts/build-app.js). On Windows,
  // cookie encryption keeps saved logins encrypted with Windows' per-user key (DPAPI), like Chrome.
  const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");
  await flipFuses(exePath, {
    version: FuseVersion.V1,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false
  });

  console.log(`Built ${TARGET_DIR}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
