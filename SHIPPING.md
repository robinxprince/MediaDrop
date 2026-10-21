# Shipping MediaDrop

## 1. Build a release

```bash
# bump "version" in package.json first (e.g. 1.0.0 → 1.0.1); both builds sign the Premiere panel (see "Signing the Premiere panel")
npm run package        # macOS
npm run package:win    # Windows (builds on the Mac; run `npm run fetch-tools -- win32` once first)
```

### macOS

Output: `dist/MediaDrop-<version>-mac-apple-silicon.zip` (~210 MB). It contains:

| File | What it is |
|---|---|
| `MediaDrop.app` | The app. yt-dlp (in `Contents/Resources/yt-dlp`), ffmpeg and ffprobe (in `Contents/Resources/bin`) are inside it, so users need no Homebrew or Terminal setup |
| `premiere-extension/` | The Premiere Pro bridge (CEP extension) |
| `Install MediaDrop.command` | Installer: copies the app to /Applications and installs the signed extension |
| `README.txt` | Install steps for the user |
| `THIRD_PARTY_NOTICES.txt` | Licenses (FFmpeg is GPLv3, so this file must ship with it) |

Supported: Apple Silicon Macs (M1 or newer) with Premiere Pro 22 or newer. Intel Macs are not supported.

### Windows

Output: `dist/MediaDrop-<version>-windows-x64.zip` (~260 MB), built from Electron's Windows runtime by `scripts/build-win.js`. It contains:

| File | What it is |
|---|---|
| `MediaDrop/` | The app folder: `MediaDrop.exe`, with yt-dlp (`resources\yt-dlp`), ffmpeg, ffprobe and their DLLs (`resources\bin`) inside, and `uninstall.ps1` |
| `premiere-extension/` | The Premiere Pro bridge (CEP extension), the same one macOS uses |
| `Install MediaDrop.cmd` | Runs `install.ps1`: installs the app to `%LOCALAPPDATA%\Programs\MediaDrop` (no admin rights), installs the signed extension to `%APPDATA%\Adobe\CEP\extensions`, puts back any CEP debug mode setting an earlier version turned on, adds Start menu and desktop shortcuts and a Settings › Apps entry |
| `README.txt`, `THIRD_PARTY_NOTICES.txt` | As on macOS |

The installer scripts live in `scripts/windows/`. Keep them ASCII: Windows PowerShell 5.1 misreads UTF-8 without a BOM.

Supported: 64-bit Windows 10 or 11 with Premiere Pro 22 or newer. Video conversion tries the NVIDIA, Intel and AMD hardware encoders, then the CPU.

## 2. Test before every release

Test on a Mac (or a new macOS user account) that has never had MediaDrop or Homebrew, and on a Windows PC (or a new Windows user account) that has never had MediaDrop:

1. Download the zip the way users will (from the internet, not AirDrop or a USB stick) and unzip it.
2. Run the installer and follow README.txt, including the "Open Anyway" (macOS) or "More info → Run anyway" (Windows) step.
3. Restart Premiere, open a sequence, and check that the Pr light turns green.
4. Test a YouTube download (thumbnail button → pick quality), a Google image right-click import, an Envato download, and a search in each Search tab.

## 3. Publish

The repository is [robinxprince/MediaDrop](https://github.com/robinxprince/MediaDrop). Publish each version as a GitHub release; the app's update check reads the latest one.

```bash
git add -A && git commit -m "Release 1.0.1" && git push
gh release create v1.0.1 dist/MediaDrop-1.0.1-mac-apple-silicon.zip dist/MediaDrop-1.0.1-windows-x64.zip --title "MediaDrop 1.0.1" --notes "What's new: ..."
```

Rules the update check depends on:
- The tag is `v` + the version in package.json (`v1.0.1`).
- The zips keep the `-mac-apple-silicon.zip` and `-windows-x64.zip` names the build gives them. Each app only looks for its own; a release without a Windows zip simply isn't offered to Windows users.
- Release notes are shown in the app's update dialog (first ~1200 characters), so lead with what users will notice.
- Don't mark it as a pre-release: those aren't "latest". Use a pre-release for test builds you don't want pushed to users.

Share the link `https://github.com/robinxprince/MediaDrop/releases/latest`; it always points to the newest version.

## 4. What users will see (unsigned app)

MediaDrop isn't signed with an Apple Developer ID or a Windows code-signing certificate, so:

- **Gatekeeper:** macOS blocks `Install MediaDrop.command` the first time. Users go to System Settings → Privacy & Security → **Open Anyway**. README.txt explains this.
- **SmartScreen (Windows):** Windows shows "Windows protected your PC" for `Install MediaDrop.cmd`; users click **More info → Run anyway**. The installer clears the downloaded-file mark on what it installs, so MediaDrop itself opens without a prompt. An Authenticode code-signing certificate (an EV one, or an OV one once it builds reputation) removes the warning; sign `MediaDrop.exe` with `signtool` after `scripts/build-win.js`.

### Signing the Premiere panel

Both builds sign `premiere-extension` with Adobe's free `ZXPSignCmd` and a self-signed certificate, so Premiere loads the panel without CEP's `PlayerDebugMode` (which would let it load any unsigned panel). `npm run package` and `npm run package:win` do it automatically and fail if signing isn't set up. On the release Mac:

- `~/Library/Application Support/MediaDrop-signing/ZXPSignCmd`: version 4.1.3 for macOS from [Adobe-CEP/CEP-Resources](https://github.com/Adobe-CEP/CEP-Resources/tree/master/ZXPSignCMD) (Intel build, runs under Rosetta).
- `~/Library/Application Support/MediaDrop-signing/MediaDrop-panel.p12`: the certificate. Back it up; a lost one is replaced with a new self-signed certificate (`ZXPSignCmd -selfSignedCert …`) and nothing else changes.
- The certificate's password is in the login Keychain as "MediaDrop panel signing" (account `mediadrop`), never in the repo.

The signature covers every file, so don't edit the installed panel; change `premiere-extension/` and rebuild. `npm run install-extension` (development) still uses debug mode, because the source folder isn't signed.

## 5. Remove the warnings (optional, $99/year)

1. Join the Apple Developer Program and create a **Developer ID Application** certificate and a **Developer ID Installer** certificate.
2. Sign the app with the hardened runtime and Electron's entitlements (`allow-jit`, `allow-unsigned-executable-memory`, `disable-library-validation`). Sign the binaries in `Contents/Resources/bin` too.
3. Replace the `.command` installer with a signed `.pkg` (`pkgbuild` + `productbuild --sign "Developer ID Installer: …"`) that installs both the app and the extension.
4. Notarize with `xcrun notarytool submit … --wait`, then `xcrun stapler staple`.

The result: users double-click and it opens, with no security prompts.

## 6. Updates

- **yt-dlp** ships as its folder build, which starts in 0.2 s (the single-file build unpacks itself for ~4 s on every run). Folder builds can't self-update, so once a day MediaDrop checks yt-dlp's latest GitHub release, verifies `yt-dlp_macos.zip` (`yt-dlp_win.zip` on Windows) against its SHA2-256SUMS and installs it in `~/Library/Application Support/mediadrop/yt-dlp/<version>` (`%APPDATA%\mediadrop\yt-dlp` on Windows). YouTube changes don't break downloads between MediaDrop releases.
- **Everything else:** bump the version, run `npm run package`, and publish a release (section 3). Within 6 hours of opening MediaDrop, users see an **Update to x.y.z** button in the top bar. Clicking it shows your release notes, then downloads the zip, checks its SHA-256 against the digest GitHub publishes for the file, runs the bundled installer (which also updates the Premiere panel) and reopens the app. Users restart Premiere to load a changed panel.
- Fully silent background updates need a paid Developer ID (section 5) and Electron's Squirrel.Mac updater, which refuses ad-hoc-signed apps.

## 7. Legal and responsibility

- **YouTube's Terms of Service** prohibit downloading except through features YouTube provides. Tools like yt-dlp are legal to distribute, but say clearly that users must only download content they have rights to (own footage, Creative Commons, licensed). Don't market it as "download any video".
- **Envato, Google Images and stock sites:** licensing is the user's responsibility. Images found on Google are usually copyrighted.
- **FFmpeg (GPLv3):** keep `THIRD_PARTY_NOTICES.txt` in every release; it points to the source code. If you ever modify ffmpeg, you must publish your changes.
- **Search licence labels** come from each source (Mixkit License, Creative Commons metadata). YouTube and Tenor results are always marked copyrighted.
- **Privacy:** the app keeps logins and cookies only on the user's computer. Say so on your release page.

## 8. Accounts and security

- **Logins are encrypted.** The build turns on Electron's cookie encryption, so saved logins are encrypted with a key in the macOS Keychain ("MediaDrop Safe Storage"), like Chrome. With ad-hoc signing, macOS may ask users to allow that Keychain item after an update; README.txt tells them to click "Always Allow". Developer ID signing (section 5) makes the prompt go away. On Windows the key is protected by Windows for the user's account (DPAPI), with no prompt.
- **yt-dlp only sees YouTube cookies,** never the rest of the Google session.
- **Recommend a secondary Google account.** yt-dlp's docs warn that downloading while signed in can get an account rate-limited or banned. Signing in is only needed for age-restricted or members-only videos.
- **Google may block sign-in** inside embedded browsers ("This browser or app may not be secure"). That is Google's policy; don't try to work around it.
- **Ship updates regularly.** MediaDrop's built-in browser only gets security fixes when you release a new version. Every couple of months: `npm install electron@latest`, test, bump the version, `npm run package`, publish.
