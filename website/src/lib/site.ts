const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
// Each release's zips, linked straight to GitHub's file downloads so a click starts the download
const asset = (platform: string) =>
  `https://github.com/robinxprince/MediaDrop/releases/download/v${version}/MediaDrop-${version}-${platform}.zip`;

export const site = {
  name: "MediaDrop",
  repo: "https://github.com/robinxprince/MediaDrop",
  releases: "https://github.com/robinxprince/MediaDrop/releases/latest",
  readme: "https://github.com/robinxprince/MediaDrop#readme",
  license: "https://github.com/robinxprince/MediaDrop/blob/main/LICENSE",
  url: "https://robinxprince.github.io/MediaDrop",
  version,
  beta: true,
  downloads: {
    mac: { href: asset("mac-apple-silicon"), file: `MediaDrop-${version}-mac-apple-silicon.zip`, label: "Download for Mac", system: "macOS · Apple Silicon (M1 or newer)" },
    windows: { href: asset("windows-x64"), file: `MediaDrop-${version}-windows-x64.zip`, label: "Download for Windows", system: "Windows 10 or 11 · 64-bit" },
  },
  requirements: "Mac (Apple Silicon) or Windows 10/11 · Premiere Pro 22+",
};
