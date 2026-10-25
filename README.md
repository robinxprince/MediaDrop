# MediaDrop

Search stock video, music, sound effects, images and GIFs from many sites at once, browse **Envato Elements**, **YouTube** and **Google Images**, and drop what you find straight into **Adobe Premiere Pro**: downloaded, converted to an edit-friendly format, and placed on your timeline.

Free and open source. macOS on Apple Silicon (M1 or newer) or Windows 10/11 (64-bit), Premiere Pro 22 or newer.

## Download

Get the latest zip for your computer from **[Releases](https://github.com/robinxprince/MediaDrop/releases/latest)**, unzip it, and follow `README.txt`. In short:

**Mac:** `MediaDrop-<version>-mac-apple-silicon.zip`

1. Double-click **Install MediaDrop.command**. macOS will warn that it can't verify the developer (MediaDrop isn't registered with Apple). Open **System Settings → Privacy & Security** and click **Open Anyway**.
2. Restart Premiere Pro.
3. Open MediaDrop. The **Pr** light turns green when Premiere is connected.

**Windows:** `MediaDrop-<version>-windows-x64.zip`

1. Right-click the zip, choose **Extract All**, then double-click **Install MediaDrop.cmd** in the extracted folder. If Windows shows "Windows protected your PC" (MediaDrop isn't signed with a paid certificate), click **More info → Run anyway**. It installs for your account only, so no administrator rights are needed.
2. Restart Premiere Pro.
3. Open MediaDrop from the Start menu. The **Pr** light turns green when Premiere is connected.

MediaDrop checks for new versions and shows an **Update** button in the top bar when one is out; it installs in one click.

To uninstall, use **Settings → Uninstall** in MediaDrop, or double-click **Uninstall MediaDrop.command** (Mac) or **Uninstall MediaDrop.cmd** (Windows) from the download; on Windows it's also in **Settings › Apps**. MediaDrop and its Premiere panel are removed; your downloaded media is kept, and you choose whether settings and saved logins go too.

## Features

- **Search every site:** one search fills tabs for videos, images, music, sound effects and GIFs from Mixkit, Flickr, Wikimedia Commons, YouTube and Tenor. Each result shows its site and whether it's copyright-free, free with credit, or copyrighted. Pick several and download them in one go, or open the same search on Pexels, Pixabay, Unsplash, Envato and more.
- **YouTube:** a download button on every thumbnail and video page. Choose any resolution, frame rate and codec, export as edit-ready H.264 MP4, ProRes 422 or the original file, grab audio only (WAV, M4A, MP3, FLAC), or trim to a clip from where the player is. Download whole playlists, choosing which videos.
- **Copied links:** copy a YouTube or media link anywhere and MediaDrop offers to download it.
- **Google Images:** right-click an image to import the original full-size file, not the thumbnail.
- **Envato Elements:** downloads are unzipped automatically and the main video, audio or template is imported.
- **Any site:** right-click an image, GIF or video to import it.
- **Organised imports:** media lands in **MediaDrop Imports** bins by type (Videos, Images, GIFs, Music), on the timeline, or in the Source Monitor.
- **Works without Premiere:** everything is saved to `Downloads/MediaDrop_Imports`, or a **MediaDrop Media** folder next to your project, so nothing is lost if Premiere is closed. It's imported as soon as Premiere is back.
- **Automatic conversion:** VP9, AV1, WebM, WebP, AVIF, SVG, OGG, FLAC and other formats Premiere struggles with are converted on import, using the hardware encoder (Apple VideoToolbox on Mac; NVIDIA, Intel or AMD on Windows).

## Privacy

MediaDrop has no server and collects nothing. Logins stay on your computer, encrypted with your Mac's Keychain or your Windows account. Signing in to YouTube is only needed for age-restricted or members-only videos; use a secondary Google account if you do, because downloading while signed in can get an account rate-limited.

Only download content you have the right to use. The licence labels in Search come from each site; check the original page before using a result commercially.

## Building from source

Requires Node.js 20+, on macOS (Apple Silicon) or Windows.

```bash
npm install
npm run fetch-tools        # downloads yt-dlp, ffmpeg and ffprobe for this computer into vendor/<platform>/ (checksum-verified)
npm run install-extension  # installs the Premiere panel for development
npm start                  # runs the app from source
```

To build a release (on a Mac; the Windows release builds on a Mac too):

```bash
npm run package                   # builds /Applications/MediaDrop.app and dist/MediaDrop-<version>-mac-apple-silicon.zip
npm run fetch-tools -- win32      # once: Windows yt-dlp and ffmpeg into vendor/win32/
npm run package:win               # builds dist/MediaDrop-<version>-windows-x64.zip
```

See [SHIPPING.md](SHIPPING.md) for releasing, signing and updates.

## How it works

```
MediaDrop app (Electron)                     Premiere Pro
├─ main.js         downloads, yt-dlp,         └─ premiere-extension/ (CEP panel)
│                  ffmpeg conversion, search,    ├─ server.js   HTTP bridge on 127.0.0.1:48200
│                  updates                       └─ host.jsx    imports files, places clips
├─ preload.js      safe API for the UI
└─ renderer/       UI, plus universal-preload.js
                   (Google originals, YouTube buttons)
```

MediaDrop saves each file, then sends its path to the Premiere panel over a local-only HTTP connection. The panel imports it into a **MediaDrop Imports** bin and places it on the active sequence.

## License

[MIT](LICENSE). Bundled tools keep their own licenses: yt-dlp (Unlicense), FFmpeg (GPLv3) and Electron (MIT). See [vendor/THIRD_PARTY_NOTICES.txt](vendor/THIRD_PARTY_NOTICES.txt).
