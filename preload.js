const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  platform: process.platform,

  // Event Listeners from Main Process
  onDownloadProgress: (cb) => {
    ipcRenderer.on("download-progress", (_e, data) => cb(data));
  },
  onToast: (cb) => {
    ipcRenderer.on("toast", (_e, data) => cb(data));
  },
  onPremiereStatus: (cb) => {
    ipcRenderer.on("premiere-status", (_e, data) => cb(data));
  },
  onUpdateAvailable: (cb) => {
    ipcRenderer.on("update-available", (_e, data) => cb(data));
  },
  onUpdateProgress: (cb) => {
    ipcRenderer.on("update-progress", (_e, data) => cb(data));
  },
  onMouseNav: (cb) => {
    ipcRenderer.on("mouse-nav", (_e, data) => cb(data));
  },
  onOpenSite: (cb) => {
    ipcRenderer.on("open-site", (_e, data) => cb(data));
  },
  onOpenLink: (cb) => {
    ipcRenderer.on("open-link", (_e, data) => cb(data));
  },
  onClipboardLink: (cb) => {
    ipcRenderer.on("clipboard-link", (_e, data) => cb(data));
  },

  // YouTube Extraction & Download
  youtubeGetFormats: (url) => ipcRenderer.invoke("youtube:get-formats", url),
  youtubeDownload: (opts) => ipcRenderer.invoke("youtube:download", opts),
  youtubePlaylist: (url) => ipcRenderer.invoke("youtube:playlist", url),

  // Search and link downloads
  searchSource: (source, query) => ipcRenderer.invoke("search:source", source, query),
  downloadUrl: (url, opts) => ipcRenderer.invoke("media:download-url", url, opts),

  // Premiere Bridge & App Utilities
  checkPremiereBridge: () => ipcRenderer.invoke("premiere:check-status"),
  openDownloadsFolder: () => ipcRenderer.invoke("app:open-downloads"),
  revealFile: (filePath) => ipcRenderer.invoke("app:reveal-file", filePath),
  importLocalFile: (filePath, site) => ipcRenderer.invoke("premiere:import-path", filePath, site),
  startDrag: (filePath) => ipcRenderer.send("app:start-drag", filePath),

  installUpdate: () => ipcRenderer.invoke("update:install"),
  uninstall: () => ipcRenderer.invoke("app:uninstall"),
  openFeedback: (kind) => ipcRenderer.invoke("app:feedback", kind),

  // Settings & Configuration
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  selectDownloadFolder: () => ipcRenderer.invoke("settings:select-folder"),
  toggleAlwaysOnTop: (flag) => ipcRenderer.invoke("settings:toggle-always-on-top", flag)
});
