const { app, BrowserWindow, session, ipcMain, Menu, MenuItem, shell, net, dialog, globalShortcut, nativeImage, clipboard } = require("electron");
const path = require("path");
const fs = require("fs");
const cp = require("child_process");
const http = require("http");
const crypto = require("crypto");

const IS_WIN = process.platform === "win32";

// Apps opened from Finder get a minimal PATH, so add Homebrew and the standard binary paths on macOS.
// Every child process inherits process.env.
const BREW_PATHS = process.platform === "darwin" ? ["/opt/homebrew/bin", "/usr/local/bin", "/opt/homebrew/opt/ffmpeg/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"] : [];
if (BREW_PATHS.length) process.env.PATH = `${BREW_PATHS.join(":")}:${process.env.PATH || ""}`;

const SETTINGS_FILE = path.join(app.getPath("userData"), "mediadrop-settings.json");
const DEFAULT_DOWNLOAD_DIR = path.join(app.getPath("downloads"), "MediaDrop_Imports");

const DEFAULT_HOTKEY = "Alt+Space";
const OLD_DEFAULT_HOTKEY = "CommandOrControl+Shift+M";

let currentSettings = {
  downloadFolder: DEFAULT_DOWNLOAD_DIR,
  insertMode: "source", // "timeline" | "bin" | "source"
  hotkey: DEFAULT_HOTKEY,
  alwaysOnTop: false,
  binsByType: true, // MediaDrop Imports › Videos, Images, GIFs, Music
  importSound: false,
  saveLocation: "ask", // "ask" | "folder" | "project": a MediaDrop Media folder beside the open project
  clipboardOffers: true, // offer to download media links the user copies
  defaultsVersion: 2
};

// Folder of the project open in Premiere, kept current by the bridge monitor
let currentProjectDir = "";

function getDownloadDir() {
  if (currentSettings.saveLocation === "project" && currentProjectDir) return path.join(currentProjectDir, "MediaDrop Media");
  return currentSettings.downloadFolder || DEFAULT_DOWNLOAD_DIR;
}

// Where the next download goes: the setting, or with "Ask every time" the user's answer.
// One answer covers the downloads that start together (a batch, a playlist), and
// "Always save here" turns it into the setting. Resolves to null when the user cancels.
const ASK_REUSE_MS = 30000;
let lastAnswer = null; // { dir, at }
let pendingQuestion = null;

function chooseDownloadDir() {
  if (currentSettings.saveLocation !== "ask") return Promise.resolve(getDownloadDir());
  if (lastAnswer && Date.now() - lastAnswer.at < ASK_REUSE_MS) return Promise.resolve(lastAnswer.dir);
  if (!pendingQuestion) pendingQuestion = askWhereToSave().finally(() => { pendingQuestion = null; });
  return pendingQuestion;
}

async function askWhereToSave() {
  const folder = currentSettings.downloadFolder || DEFAULT_DOWNLOAD_DIR;
  const choices = [{ label: "Downloads folder", dir: folder, saveLocation: "folder" }];
  if (currentProjectDir) choices.push({ label: "Beside the project", dir: path.join(currentProjectDir, "MediaDrop Media"), saveLocation: "project" });
  choices.push({ label: "Choose Folder…" });
  const buttons = [...choices.map((c) => c.label), "Cancel"];
  // A download can start while MediaDrop is in the background (a copied link); the question must be seen
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) mainWindow.show();
  const { response, checkboxChecked } = await dialog.showMessageBox(mainWindow, {
    type: "question",
    message: "Where should MediaDrop save this?",
    detail: choices.filter((c) => c.dir).map((c) => `${c.label}: ${displayPath(c.dir)}`).join("\n"),
    buttons,
    defaultId: 0,
    cancelId: buttons.length - 1,
    checkboxLabel: "Always save here (you can change this in Settings)"
  });
  const choice = choices[response];
  if (!choice) return null;

  let { dir, saveLocation } = choice;
  if (!dir) {
    const picked = await dialog.showOpenDialog(mainWindow, {
      title: "Choose Where to Save",
      defaultPath: folder,
      properties: ["openDirectory", "createDirectory"]
    });
    if (picked.canceled || !picked.filePaths.length) return null;
    dir = picked.filePaths[0];
    saveLocation = "folder";
  }
  if (checkboxChecked) saveSettings(choice.dir ? { saveLocation } : { saveLocation, downloadFolder: dir });
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  lastAnswer = { dir, at: Date.now() };
  return dir;
}

// ffmpeg and ffprobe ship inside the app (Contents/Resources/bin, or resources\bin on Windows; vendor/<platform>/bin in dev).
const BUNDLED_BIN_DIRS = [path.join(process.resourcesPath, "bin"), path.join(__dirname, "vendor", process.platform, "bin")];

function getBinaryPath(name) {
  const file = IS_WIN ? `${name}.exe` : name;
  for (const dir of [...BUNDLED_BIN_DIRS, ...BREW_PATHS]) {
    const full = path.join(dir, file);
    if (fs.existsSync(full)) return full;
  }
  return file;
}

// File names that save on macOS and Windows: no path or wildcard characters, no control characters,
// and none of Windows' device names (CON, NUL, COM1…), which it refuses as file names
function safeFileName(name) {
  const clean = String(name || "").replace(/[/\\?%*:|"<>\x00-\x1f]/g, "_");
  return /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(clean) ? `_${clean}` : clean;
}

// Never overwrite: an existing file may already be linked as media in a Premiere project.
function getUniqueFilePath(dir, baseName, ext) {
  const cleanExt = ext ? (ext.startsWith(".") ? ext : `.${ext}`) : "";
  let candidate = path.join(dir, `${baseName}${cleanExt}`);
  let counter = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${baseName} (${counter})${cleanExt}`);
    counter++;
  }
  return candidate;
}

// rename can't cross drives (the staging folder to an external disk), so copy then delete there
function moveFile(from, to) {
  try {
    fs.renameSync(from, to);
  } catch (e) {
    if (e.code !== "EXDEV") throw e;
    fs.copyFileSync(from, to);
    fs.unlinkSync(from);
  }
}

function getUniqueFilePathFor(dir, filename) {
  const ext = path.extname(filename);
  return getUniqueFilePath(dir, path.basename(filename, ext), ext);
}

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
      currentSettings = { ...currentSettings, ...data };
      // 1.0.7 moved everyone once to the new defaults; a shortcut someone picked themselves stays
      if (!(data.defaultsVersion >= 2)) {
        Object.assign(currentSettings, { insertMode: "source", importSound: false, saveLocation: "ask", defaultsVersion: 2 });
        if (!data.hotkey || data.hotkey === OLD_DEFAULT_HOTKEY) currentSettings.hotkey = DEFAULT_HOTKEY;
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(currentSettings, null, 2), "utf-8");
      }
      currentSettings.hotkey = sanitizeHotkey(currentSettings.hotkey);
    }
  } catch (e) {
    console.warn("[MediaDrop] Could not load settings:", e);
  }
  const folder = getDownloadDir();
  if (!fs.existsSync(folder)) {
    try { fs.mkdirSync(folder, { recursive: true }); } catch (e) {}
  }
}

function saveSettings(newSettings) {
  currentSettings = { ...currentSettings, ...newSettings };
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(currentSettings, null, 2), "utf-8");
  } catch (e) {
    console.error("[MediaDrop] Failed to write settings:", e);
  }
  applySettings();
  return currentSettings;
}

// Any key combination is allowed, bare keys included; the settings screen warns when a
// shortcut without ⌘, ⌃ or ⌥ will stop that key from typing in other apps
function sanitizeHotkey(shortcut) {
  if (!shortcut || typeof shortcut !== "string") return DEFAULT_HOTKEY;
  const parts = shortcut.trim().split("+").map(p => p.trim());
  const modifiers = ["Command", "Cmd", "Control", "Ctrl", "CommandOrControl", "Alt", "Option", "Super", "Shift"];
  const keys = parts.filter(p => !modifiers.includes(p));
  if (keys.length !== 1 || !keys[0]) return DEFAULT_HOTKEY;
  return parts.join("+");
}

// ⌥Space / Alt+Space is also the default of a few launchers (ChatGPT, Raycast); when another
// app already has it, the old three-key default still brings MediaDrop up
function registerGlobalHotkey(shortcut) {
  try {
    globalShortcut.unregisterAll();
    const candidate = (shortcut && typeof shortcut === "string" && shortcut.trim())
      ? shortcut.trim()
      : DEFAULT_HOTKEY;

    let registered = false;
    try {
      registered = globalShortcut.register(candidate, () => {
        toggleOrSurfaceWindow();
      });
    } catch (err) {
      console.warn(`[MediaDrop] Cannot directly register "${candidate}":`, err.message);
    }

    console.log(`[MediaDrop] Global shortcut "${candidate}" registered:`, registered);
    if (!registered && candidate !== OLD_DEFAULT_HOTKEY) {
      globalShortcut.register(OLD_DEFAULT_HOTKEY, () => {
        toggleOrSurfaceWindow();
      });
    }
  } catch (e) {
    console.warn("[MediaDrop] Failed to register global shortcut:", e.message);
  }
}

function applySettings() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(!!currentSettings.alwaysOnTop, "floating");
  }
  registerGlobalHotkey(currentSettings.hotkey);
}

let mainWindow = null;
let lastPremiereOnlineState = false;

// ── SINGLE INSTANCE LOCK & SURFACE PROTOCOL ──────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    surfaceWindow();
  });
}

function surfaceWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (process.platform === "darwin") {
    app.focus({ steal: true });
  }
  mainWindow.show();
  mainWindow.focus();
  mainWindow.moveTop();
  if (currentSettings.alwaysOnTop) {
    mainWindow.setAlwaysOnTop(true, "floating");
  } else if (IS_WIN) {
    // Windows won't let a background app take the foreground (it flashes the taskbar instead),
    // but a moment on top brings the window in front of Premiere
    mainWindow.setAlwaysOnTop(true);
    mainWindow.setAlwaysOnTop(false);
  }
}

function toggleOrSurfaceWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isVisible() && mainWindow.isFocused() && !mainWindow.isMinimized()) {
    mainWindow.hide();
  } else {
    surfaceWindow();
  }
}

// Internal HTTP server on 48201 for instantaneous show/focus triggers from Premiere
function startSurfaceServer() {
  const surfaceHttp = http.createServer((req, res) => {
    // Only local programs (the Premiere panel uses Node's http) may call this. Browsers attach an
    // Origin header and the Host check blocks DNS rebinding, so web pages are turned away.
    const host = String(req.headers.host || "").toLowerCase();
    if ((host !== "127.0.0.1:48201" && host !== "localhost:48201") || req.headers.origin) {
      res.writeHead(403);
      return res.end();
    }
    if (req.url === "/ping") {
      // Lets the Premiere panel see that MediaDrop is running without bringing it forward
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, version: app.getVersion() }));
    } else if (req.url === "/downloads") {
      // What the Premiere panel shows under "Downloading"
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        active: [...activeDownloads.values()],
        pending: pendingImports.map((p) => path.basename(p.filePath))
      }));
    } else if (req.url === "/show" || req.url === "/" || req.url.startsWith("/show?")) {
      surfaceWindow();
      // The Premiere panel's quick starts open a built-in site: /show?site=youtube
      // and its search box adds a query: /show?site=youtube&q=drone+city
      const params = new URL(req.url, "http://127.0.0.1").searchParams;
      const site = params.get("site");
      const query = (params.get("q") || "").trim().slice(0, 200);
      if (["youtube", "envato", "google"].includes(site) && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("open-site", { site, query });
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, surfaced: true }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  surfaceHttp.on("error", (e) => {
    console.log("[MediaDrop] Surface port 48201 busy or unavailable:", e.message);
  });
  surfaceHttp.listen(48201, "127.0.0.1", () => {
    console.log("[MediaDrop] Surface server active on 127.0.0.1:48201");
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, "assets", "logo.png");
  let appIcon = null;
  if (fs.existsSync(iconPath)) {
    try {
      appIcon = nativeImage.createFromPath(iconPath);
      if (process.platform === "darwin" && app.dock) {
        app.dock.setIcon(appIcon);
      }
    } catch (e) {}
  }

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1000,
    minHeight: 650,
    title: "MediaDrop - Asset Ingest for Premiere Pro",
    backgroundColor: "#0c0e14",
    titleBarStyle: IS_WIN ? "hidden" : "hiddenInset",
    // Windows: native window buttons drawn over the right of the header, in its colours (--bg-surface)
    ...(IS_WIN && { titleBarOverlay: { color: "#11141c", symbolColor: "#9aa3b8", height: 51 } }),
    icon: appIcon || undefined,
    alwaysOnTop: !!currentSettings.alwaysOnTop,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  // Every <webview> (built-in and custom tabs) gets the same locked-down guest preload
  mainWindow.webContents.on("will-attach-webview", (_e, webPreferences) => {
    delete webPreferences.preloadURL;
    webPreferences.preload = path.join(__dirname, "renderer", "universal-preload.js");
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
  });

  // Sites in the tabs never get windows of their own. Links meant for a new tab (Drive opening a
  // Doc, links inside Docs, target="_blank") are handed to the app, which opens them in MediaDrop.
  // The tabs carry allowpopups only so these requests reach this handler.
  mainWindow.webContents.on("did-attach-webview", (_e, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url) && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("open-link", { url, from: contents.id });
      }
      return { action: "deny" };
    });
  });

  // The app window itself never navigates away or opens windows; sites live in the tabs
  mainWindow.webContents.on("will-navigate", (e) => e.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.webContents.on("did-finish-load", async () => {
    applySettings();
    const status = await premiereSnapshot();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("premiere-status", status);
    }
  });

  // Handle mouse hardware back/forward buttons (app-command)
  mainWindow.on("app-command", (e, cmd) => {
    if (cmd === "browser-backward") {
      mainWindow.webContents.send("mouse-nav", "back");
    } else if (cmd === "browser-forward") {
      mainWindow.webContents.send("mouse-nav", "forward");
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Only MediaDrop's own window may call these; pages open in the site tabs never can
function handleFromApp(channel, fn) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error("Not allowed");
    return fn(event, ...args);
  });
}

// ── PREMIERE PRO HTTP BRIDGE ─────────────────────────────────────────────────
// Every finished download ends here. The file is already saved, so a failed import is
// reported as "saved, but not imported" — never as a download error.
function displayPath(p) {
  if (IS_WIN) return p; // "~" means nothing to Windows users
  const home = app.getPath("home");
  return p.startsWith(home + path.sep) ? "~" + p.slice(home.length) : p;
}

function reportIngest(filePath, type, msg, extra = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const titles = { success: "Imported to Premiere Pro", waiting: "Waiting for Premiere Pro", saved: "Download complete" };
  mainWindow.webContents.send("toast", {
    type,
    title: titles[type],
    msg,
    filePath,
    folder: displayPath(path.dirname(filePath)),
    ...extra
  });
}

// Errors that clear up on their own once Premiere and a project are open
function isWaitableError(err) {
  return ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "NO_PROJECT"].includes(err.code);
}

function premiereErrorText(err) {
  if (err.code === "ECONNREFUSED" || err.code === "ECONNRESET") return "Premiere Pro isn't open, or the MediaDrop panel isn't loaded.";
  if (err.code === "ETIMEDOUT") return "Premiere Pro is busy and didn't answer.";
  if (err.code === "NO_PROJECT") return "No project is open in Premiere Pro.";
  return err.message || String(err);
}

// Downloads that finished while Premiere wasn't ready; imported as soon as a project is open
const pendingImports = [];

function queueImport(filePath, site, reason) {
  if (!pendingImports.some((p) => p.filePath === filePath)) pendingImports.push({ filePath, site });
  const next = reason.code === "NO_PROJECT" ? "Open a project" : "Open Premiere Pro with the MediaDrop panel";
  reportIngest(filePath, "waiting", `${premiereErrorText(reason)} ${next} and it imports automatically.`, { pending: pendingImports.length, site });
}

function postImport(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request({
      hostname: "127.0.0.1",
      port: 48200,
      path: "/import",
      method: "POST",
      timeout: 15000,
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        let result = null;
        try { result = JSON.parse(data); } catch (e) {}
        if (res.statusCode === 200 && result && result.ok) return resolve(result.result || {});
        reject(Object.assign(new Error((result && result.error) || `The Premiere panel answered with HTTP ${res.statusCode}.`), { code: result && result.code }));
      });
    });
    req.on("error", reject);
    // destroy() emits "error", which rejects
    req.on("timeout", () => req.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })));
    req.end(body);
  });
}

function placementText(itemName, mode, host) {
  if (host.inserted) {
    const track = host.trackName ? ` on ${host.trackName}${host.addedTrack ? " (new track)" : ""}` : "";
    return `"${itemName}" placed in ${host.sequenceName}${track}, at the playhead.`;
  }
  if (host.openedInSource) return `"${itemName}" opened in the Source Monitor.`;
  const bin = host.bin && host.bin !== "MediaDrop Imports" ? `MediaDrop Imports › ${host.bin}` : "MediaDrop Imports";
  if (mode === "timeline" && host.tracksFull) return `"${itemName}" added to ${bin}. Every track was busy at the playhead.`;
  if (mode === "timeline" && !host.sequenceName) return `"${itemName}" added to ${bin}. Open a sequence to place clips on the timeline.`;
  return `"${itemName}" added to ${bin}.`;
}

function sendToPremiere(filePath, downloadId) {
  return importFile(filePath, (downloadId && downloadSources.get(downloadId)) || "");
}

const BIN_BY_EXT = {
  ".gif": "GIFs",
  ".jpg": "Images", ".jpeg": "Images", ".png": "Images", ".bmp": "Images", ".tif": "Images", ".tiff": "Images", ".psd": "Images",
  ".mp3": "Music", ".wav": "Music", ".aif": "Music", ".aiff": "Music", ".m4a": "Music", ".aac": "Music", ".flac": "Music", ".ogg": "Music",
};

// The bin a file belongs in when bins by type is on; anything not listed is a video
function mediaBin(filePath) {
  return BIN_BY_EXT[path.extname(filePath).toLowerCase()] || "Videos";
}

// site: where the file came from ("YouTube", "Envato", …), kept for history
async function importFile(filePath, site) {
  const mode = currentSettings.insertMode || "source";
  const bin = currentSettings.binsByType !== false ? mediaBin(filePath) : "";
  const itemName = path.basename(filePath);
  try {
    const host = await postImport({ filePath, mode, insertToTimeline: mode === "timeline", bin: bin || undefined });
    const note = host.reused ? " It was already in your project, so it wasn't imported twice." : "";
    reportIngest(filePath, "success", placementText(itemName, mode, host) + note, { project: host.projectName || "", site });
    return { ok: true, result: host };
  } catch (err) {
    if (isWaitableError(err)) {
      queueImport(filePath, site, err);
      return { ok: false, waiting: true, error: premiereErrorText(err) };
    }
    console.warn("[MediaDrop] Premiere import failed:", err.message);
    reportIngest(filePath, "saved", `Couldn't import into Premiere: ${premiereErrorText(err)}`, { site });
    return { ok: false, error: premiereErrorText(err) };
  }
}

let flushingImports = false;
async function flushPendingImports() {
  if (flushingImports || !pendingImports.length) return;
  flushingImports = true;
  try {
    while (pendingImports.length) {
      const next = pendingImports[0];
      if (!fs.existsSync(next.filePath)) { pendingImports.shift(); continue; }
      const res = await importFile(next.filePath, next.site);
      if (res.waiting) break; // still not ready; importFile left it queued
      pendingImports.shift();
    }
  } finally {
    flushingImports = false;
  }
}

function getPremiereStatus() {
  return new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:48200/status", { timeout: 2500 }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        let status = null;
        try { status = JSON.parse(data).status || null; } catch (e) {}
        const projectPath = status && status.ok && typeof status.projectPath === "string" ? status.projectPath : "";
        currentProjectDir = path.isAbsolute(projectPath) ? path.dirname(projectPath) : "";
        resolve(status);
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

// Check Premiere Bridge Health
function checkBridgeHealth() {
  return new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:48200/health", { timeout: 1500 }, (res) => {
      let data = "";
      res.on("data", c => { data += c; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ online: parsed.ok === true, port: 48200 });
        } catch (e) {
          resolve({ online: false, port: 48200 });
        }
      });
    });
    req.on("error", () => resolve({ online: false, port: 48200 }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ online: false, port: 48200 });
    });
  });
}

const CHROME_VERSION = process.versions.chrome || "120.0.6099.291";
const UA_PLATFORM = IS_WIN ? "Windows NT 10.0; Win64; x64" : "Macintosh; Intel Mac OS X 10_15_7"; // what Chrome reports, matching the client hints
const REAL_CHROME_UA = `Mozilla/5.0 (${UA_PLATFORM}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`;

// ── UNIFIED SESSION ──────────────────────────────────────────────────────────
// Present as the Chrome version we actually run (minus the "Electron/x" token). Faking a
// different browser — mismatched versions, spoofed client hints, forced headers — is what
// bot managers such as Akamai (Flaticon) flag with a 403, so keep everything consistent.
function setupUnifiedSession() {
  const sharedSession = session.fromPartition("persist:mediadrop");
  sharedSession.setUserAgent(REAL_CHROME_UA, "en-US,en");

  // Sites in the tabs get no camera, microphone, location, notifications or the like;
  // only full screen video and copying to the clipboard
  const ALLOWED_PERMISSIONS = new Set(["fullscreen", "clipboard-sanitized-write"]);
  sharedSession.setPermissionRequestHandler((_wc, permission, callback) => callback(ALLOWED_PERMISSIONS.has(permission)));
  sharedSession.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission));
  try {
    session.defaultSession.setUserAgent(REAL_CHROME_UA, "en-US,en");
  } catch (e) {}

  // Handle standard Chromium native downloads
  sharedSession.on("will-download", (event, item, contents) => {
    let filename = item.getFilename() || `asset_${Date.now()}`;
    filename = safeFileName(filename);

    // Electron needs the save path right away, so while "Ask every time" waits for an answer
    // the file downloads to a staging folder and moves to the chosen one when it's done
    const fresh = lastAnswer && Date.now() - lastAnswer.at < ASK_REUSE_MS;
    const knownDir = currentSettings.saveLocation !== "ask" ? getDownloadDir() : fresh ? lastAnswer.dir : null;
    const chosenDir = knownDir ? null : chooseDownloadDir();
    const saveDir = knownDir || path.join(app.getPath("temp"), "mediadrop-staging");
    try { fs.mkdirSync(saveDir, { recursive: true }); } catch (e) {}
    let savePath = getUniqueFilePathFor(saveDir, filename);
    filename = path.basename(savePath);
    item.setSavePath(savePath);
    let cancelledByUser = false;
    if (chosenDir) chosenDir.then((dir) => { if (!dir) { cancelledByUser = true; item.cancel(); } });

    const downloadId = "dl-" + Date.now();
    let pageUrl = "";
    try { pageUrl = contents && !contents.isDestroyed() ? contents.getURL() : ""; } catch (e) {}
    downloadSources.set(downloadId, siteName(pageUrl || item.getURL()));
    emitProgress({
      id: downloadId,
      name: filename,
      percent: 0,
      state: "downloading"
    });

    item.on("updated", (_e, state) => {
      if (state === "progressing" && mainWindow && !mainWindow.isDestroyed()) {
        const total = item.getTotalBytes();
        const percent = total > 0 ? Math.round((item.getReceivedBytes() / total) * 100) : 50;
        emitProgress({
          id: downloadId,
          name: filename,
          percent,
          state: "downloading"
        });
      }
    });

    item.once("done", async (_e, state) => {
      if (state === "completed" && chosenDir) {
        const dir = await chosenDir;
        if (!dir) {
          cancelledByUser = true;
          try { fs.unlinkSync(savePath); } catch (e) {}
        } else {
          const dest = getUniqueFilePathFor(dir, filename);
          try {
            moveFile(savePath, dest);
            savePath = dest;
            filename = path.basename(dest);
          } catch (e) {
            console.error("[MediaDrop] Could not move the download to", dir, e);
          }
        }
      }
      if (state === "completed" && !cancelledByUser) {
        await normalizeAndIngestMedia(savePath, filename, downloadId);
      } else {
        if (mainWindow && !mainWindow.isDestroyed()) {
          emitProgress({
            id: downloadId,
            name: filename,
            percent: 100,
            state: "error",
            phase: "error",
            subText: cancelledByUser ? `"${filename}" wasn't saved.` : `The download of "${filename}" didn't finish (${state}).`
          });
        }
      }
    });
  });
}

// ── CORE MEDIA ENGINE (FFmpeg, FFprobe & Safe Streaming) ─────────────────────
// Returns a canonical watch URL, or "" if the input is not a YouTube video URL.
// The URL comes from page-controlled messages, so anything else must be rejected:
// an arbitrary string here would be parsed by yt-dlp as a command-line option.
function cleanYouTubeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  let parsed;
  try { parsed = new URL(rawUrl.trim()); } catch (e) { return ""; }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
  const host = parsed.hostname.toLowerCase();
  if (host !== "youtu.be" && host !== "youtube.com" && !host.endsWith(".youtube.com")) return "";
  const match = parsed.href.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|live\/|shorts\/|watch\?v=|watch\?.+?&v=))([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : "";
}

const YT_AUDIO_FORMATS = new Set(["wav", "m4a", "mp3", "flac"]);
const YT_VIDEO_OUTPUTS = new Set(["mp4", "prores", "original"]);

// Optional clip range in seconds → ffmpeg output options. Returns [] for the whole video
// and null for an invalid range. Trimming happens locally after the download: yt-dlp's
// --download-sections streams through ffmpeg, which YouTube's servers often refuse.
function clipTrimArgs(start, end) {
  const hasStart = start !== undefined && start !== null && start !== "";
  const hasEnd = end !== undefined && end !== null && end !== "";
  if (!hasStart && !hasEnd) return [];
  const s = hasStart ? Number(start) : 0;
  const e = hasEnd ? Number(end) : Infinity;
  if (!Number.isFinite(s) || s < 0 || Number.isNaN(e) || e <= s) return null;
  return ["-ss", String(s), ...(Number.isFinite(e) ? ["-to", String(e)] : [])];
}

// Length of the trimmed output, for progress reporting
function trimmedDuration(durationSec, trim) {
  if (!trim.length) return durationSec;
  const start = Number(trim[1]);
  const toIndex = trim.indexOf("-to");
  const end = toIndex >= 0 ? Math.min(Number(trim[toIndex + 1]), durationSec || Infinity) : durationSec;
  return Number.isFinite(end) ? Math.max(0, end - start) : 0;
}

// Stream-copy cut (no re-encode; starts at the nearest keyframe). Returns the path to use.
async function cutWithoutReencode(src, dest, trim) {
  const ok = await runFfmpegWithDrainedPipes(getBinaryPath("ffmpeg"), ["-y", "-i", src, ...trim, "-c", "copy", dest]);
  if (!ok) return src;
  try { fs.unlinkSync(src); } catch (e) {}
  return dest;
}

async function exportYouTubeCookies() {
  try {
    const ses = session.fromPartition("persist:mediadrop");
    const cookies = await ses.cookies.get({});
    // yt-dlp authenticates with youtube.com cookies alone. google.com cookies are the whole
    // Google account session (Gmail, Drive...), so they never leave the app.
    const relevant = (cookies || []).filter(c => {
      const d = (c.domain || "").toLowerCase().replace(/^\./, "");
      return d === "youtube.com" || d.endsWith(".youtube.com");
    });
    if (!relevant || relevant.length === 0) return null;

    // Unique per call, owner-only, and deleted by the caller once yt-dlp exits (removeCookieFile).
    const cookiePath = path.join(app.getPath("temp"), `mediadrop_yt_cookies_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
    let netscapeFormat = "# Netscape HTTP Cookie File\n# Generated by MediaDrop for yt-dlp authentication\n\n";
    const seen = new Set();
    for (const c of relevant) {
      const domain = c.domain.startsWith(".") ? c.domain : "." + c.domain;
      const key = `${domain}:${c.name}:${c.path || "/"}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const tailmatch = "TRUE";
      const pathStr = c.path || "/";
      const secure = c.secure ? "TRUE" : "FALSE";
      const expires = c.expirationDate ? Math.round(c.expirationDate) : Math.round(Date.now() / 1000 + 86400 * 30);
      netscapeFormat += `${domain}\t${tailmatch}\t${pathStr}\t${secure}\t${expires}\t${c.name}\t${c.value}\n`;
    }
    fs.writeFileSync(cookiePath, netscapeFormat, { encoding: "utf-8", mode: 0o600, flag: "wx" });
    return cookiePath;
  } catch (e) {
    console.warn("[MediaDrop] Could not export session cookies:", e.message);
    return null;
  }
}

function removeCookieFile(cookiePath) {
  if (!cookiePath) return;
  try { fs.unlinkSync(cookiePath); } catch (e) {}
}

function probeMedia(filePath) {
  const ffprobeCmd = getBinaryPath("ffprobe");
  return new Promise((resolve) => {
    const ffprobeProc = cp.spawn(ffprobeCmd, [
      "-v", "error",
      "-show_entries", "stream=codec_name,codec_type,duration",
      "-show_entries", "format=duration",
      "-of", "json",
      filePath
    ], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });

    let stdoutData = "";
    let stderrData = "";

    ffprobeProc.stdout.on("data", (c) => { stdoutData += c.toString(); });
    ffprobeProc.stderr.on("data", (c) => { stderrData += c.toString(); });

    ffprobeProc.on("close", (code) => {
      if (code !== 0) {
        console.warn("[MediaDrop] ffprobe error:", stderrData);
        return resolve({ codec: "", durationSec: 0, isH264: false, isAudioOnly: false });
      }
      try {
        const data = JSON.parse(stdoutData);
        const videoStream = (data.streams || []).find(s => s.codec_type === "video");
        const audioStream = (data.streams || []).find(s => s.codec_type === "audio");
        const codec = videoStream ? (videoStream.codec_name || "").toLowerCase() : "";
        const durationSec = parseFloat(data.format?.duration || videoStream?.duration || audioStream?.duration || 0) || 0;
        const isH264 = codec === "h264" || codec === "avc1";
        const isAudioOnly = !videoStream && !!audioStream;
        resolve({ codec, durationSec, isH264, isAudioOnly });
      } catch (e) {
        resolve({ codec: "", durationSec: 0, isH264: false, isAudioOnly: false });
      }
    });

    ffprobeProc.on("error", (err) => {
      console.warn("[MediaDrop] ffprobe spawn error:", err.message);
      resolve({ codec: "", durationSec: 0, isH264: false, isAudioOnly: false });
    });
  });
}

function runFfmpegWithDrainedPipes(ffmpegCmd, args) {
  return new Promise((resolve) => {
    const proc = cp.spawn(ffmpegCmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    proc.stdout.resume();
    proc.stderr.resume();
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", (err) => {
      console.warn("[MediaDrop] ffmpeg spawn error:", err.message);
      resolve(false);
    });
  });
}

function runFfmpegTranscodeWithProgress({ ffmpegCmd, ffmpegArgs, durationSec, downloadId, safeTitle, label }) {
  return new Promise((resolve) => {
    const proc = cp.spawn(ffmpegCmd, ffmpegArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });

    let stderrBuf = "";
    proc.stderr.on("data", (chunk) => {
      stderrBuf += chunk.toString();
      if (stderrBuf.length > 4096) stderrBuf = stderrBuf.slice(-4096);
    });

    let stdoutBuf = "";
    let lastUpdate = 0;

    proc.stdout.on("data", (chunk) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop(); // keep partial line

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("out_time_us=")) {
          const us = parseInt(trimmed.substring(12), 10);
          if (!isNaN(us) && us > 0) {
            const curSec = us / 1000000;
            let pct = 0;
            if (durationSec > 0) {
              pct = Math.min(99, Math.max(1, Math.round((curSec / durationSec) * 100)));
            } else {
              // Asymptotic fallback progress so UI is never frozen
              pct = Math.min(95, Math.max(1, Math.round(100 * (1 - Math.exp(-curSec / 45)))));
            }

            const now = Date.now();
            if (now - lastUpdate > 150) {
              lastUpdate = now;
              if (mainWindow && !mainWindow.isDestroyed()) {
                emitProgress({
                  id: downloadId,
                  name: safeTitle,
                  percent: pct,
                  state: "transcoding",
                  phase: "transcoding",
                  subText: `${label}: ${pct}%`
                });
              }
            }
          }
        }
      }
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        console.warn(`[MediaDrop FFmpeg] exited with code ${code}. Stderr snippet:\n${stderrBuf}`);
        resolve(false);
      }
    });

    proc.on("error", (err) => {
      console.warn("[MediaDrop FFmpeg] spawn error:", err.message);
      resolve(false);
    });
  });
}

function sendProgress(downloadId, name, fields) {
  emitProgress({ id: downloadId, name, ...fields });
}

// Every progress update passes through here, so the Dock badge and the Premiere panel
// (GET /downloads on the surface server) always know what's in flight.
const activeDownloads = new Map();
function emitProgress(data) {
  if (data.state === "completed" || data.state === "error" || data.phase === "error") {
    activeDownloads.delete(data.id);
  } else {
    activeDownloads.set(data.id, {
      name: data.name || "",
      percent: Number.isFinite(data.percent) ? data.percent : null,
      phase: data.phase || data.state || "downloading"
    });
  }
  updateDockBadge();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("download-progress", data);
}

function updateDockBadge() {
  if (app.dock) app.dock.setBadge(activeDownloads.size ? String(activeDownloads.size) : "");
}

// ── REUSE FINISHED DOWNLOADS ─────────────────────────────────────────────────
// Asking for the same YouTube clip with the same settings again imports the saved file
// instead of downloading it twice.
const DOWNLOAD_INDEX_FILE = path.join(app.getPath("userData"), "download-index.json");
const downloadKeys = new Map(); // downloadId → reuse key
const downloadSources = new Map(); // downloadId → site name, kept in history

function readDownloadIndex() {
  try { return JSON.parse(fs.readFileSync(DOWNLOAD_INDEX_FILE, "utf8")) || {}; } catch (e) { return {}; }
}

function findReusableFile(key) {
  const file = readDownloadIndex()[key];
  return file && fs.existsSync(file) ? file : null;
}

function rememberDownload(key, filePath) {
  const index = readDownloadIndex();
  delete index[key];
  index[key] = filePath;
  const keys = Object.keys(index);
  keys.slice(0, Math.max(0, keys.length - 500)).forEach((k) => delete index[k]);
  try { fs.writeFileSync(DOWNLOAD_INDEX_FILE, JSON.stringify(index)); } catch (e) {}
}

// "elements.envato.com" → "Envato", "www.pexels.com" → "Pexels"
function siteName(pageUrl) {
  let host = "";
  try { host = new URL(pageUrl).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
  if (/(^|\.)envato\.com$/.test(host)) return "Envato";
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return "YouTube";
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return "Google Images";
  const parts = host.split(".");
  const name = (parts.length > 1 ? parts[parts.length - 2] : parts[0]).replace(/[^\w-]/g, "");
  return name ? name.charAt(0).toUpperCase() + name.slice(1, 30) : "";
}

// The file is saved: mark the download complete, then hand it to Premiere
function finishIngest(downloadId, filePath) {
  sendProgress(downloadId, path.basename(filePath), { percent: 100, state: "completed", phase: "completed" });
  if (downloadKeys.has(downloadId)) rememberDownload(downloadKeys.get(downloadId), filePath);
  sendToPremiere(filePath, downloadId);
  return { ok: true, outPath: filePath };
}

// Edit-ready encoders per target, hardware first, then a CPU fallback. macOS has VideoToolbox; on
// Windows the GPU's encoder is tried (NVIDIA, then Intel, then AMD), and one that's missing fails at once.
const H264_BITRATE = ["-b:v", "25M", "-maxrate", "35M", "-bufsize", "50M", "-profile:v", "high"];
const H264_AUDIO = ["-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-movflags", "+faststart"];
const PRORES_AUDIO = ["-c:a", "pcm_s16le", "-ar", "48000"];
const H264_HARDWARE = IS_WIN
  ? [
    { label: "Converting to H.264 (NVIDIA)", args: ["-c:v", "h264_nvenc", "-preset", "p5", "-rc", "vbr", ...H264_BITRATE, "-pix_fmt", "yuv420p", ...H264_AUDIO] },
    { label: "Converting to H.264 (Intel)", args: ["-c:v", "h264_qsv", ...H264_BITRATE, "-pix_fmt", "nv12", ...H264_AUDIO] },
    { label: "Converting to H.264 (AMD)", args: ["-c:v", "h264_amf", "-rc", "vbr_peak", ...H264_BITRATE, "-pix_fmt", "yuv420p", ...H264_AUDIO] }
  ]
  : [{ label: "Converting to H.264 (hardware)", args: ["-c:v", "h264_videotoolbox", ...H264_BITRATE, "-pix_fmt", "yuv420p", ...H264_AUDIO] }];
const VIDEO_ENCODERS = {
  h264: [
    ...H264_HARDWARE,
    { label: "Converting to H.264 (CPU)", args: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", ...H264_AUDIO] }
  ],
  prores: [
    ...(IS_WIN ? [] : [{ label: "Converting to ProRes 422 (hardware)", args: ["-c:v", "prores_videotoolbox", "-profile:v", "standard", ...PRORES_AUDIO] }]),
    { label: "Converting to ProRes 422 (CPU)", args: ["-c:v", "prores_ks", "-profile:v", "2", "-pix_fmt", "yuv422p10le", ...PRORES_AUDIO] }
  ]
};

// target "h264" → MP4 (remuxed without re-encoding when the video is already H.264); "prores" → MOV
// trim: optional ffmpeg -ss/-to output options; a trimmed H.264 clip is re-encoded so the cut is frame-accurate
async function transcodeOrRemuxMedia({ downloadedFile, finalSavePath, downloadId, durationSec, detectedCodec, target = "h264", trim = [] }) {
  const ffmpegCmd = getBinaryPath("ffmpeg");
  const name = path.basename(finalSavePath);
  const removeSource = () => {
    try { if (downloadedFile !== finalSavePath && fs.existsSync(downloadedFile)) fs.unlinkSync(downloadedFile); } catch (e) {}
  };

  if (target === "h264" && !trim.length && (detectedCodec === "h264" || detectedCodec === "avc1")) {
    if (path.extname(downloadedFile).toLowerCase() === ".mp4") {
      try { fs.renameSync(downloadedFile, finalSavePath); } catch (e) { finalSavePath = downloadedFile; }
      return finishIngest(downloadId, finalSavePath);
    }
    sendProgress(downloadId, name, { percent: 95, state: "transcoding", phase: "remuxing", subText: "Packaging as MP4 (no re-encode)" });
    const remuxed = await runFfmpegWithDrainedPipes(ffmpegCmd, [
      "-y", "-i", downloadedFile, "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", finalSavePath
    ]);
    if (remuxed) {
      removeSource();
      return finishIngest(downloadId, finalSavePath);
    }
  }

  for (const encoder of VIDEO_ENCODERS[target]) {
    sendProgress(downloadId, name, { percent: 0, state: "transcoding", phase: "transcoding", subText: encoder.label });
    const ok = await runFfmpegTranscodeWithProgress({
      ffmpegCmd,
      ffmpegArgs: ["-y", "-i", downloadedFile, ...trim, ...encoder.args, "-progress", "pipe:1", finalSavePath],
      durationSec,
      downloadId,
      safeTitle: name,
      label: encoder.label
    });
    if (ok) {
      removeSource();
      return finishIngest(downloadId, finalSavePath);
    }
    console.warn(`[MediaDrop] ${encoder.label} failed`);
  }

  // Keep the original download so the user still has the media; drop the partial output.
  try { if (fs.existsSync(finalSavePath) && downloadedFile !== finalSavePath) fs.unlinkSync(finalSavePath); } catch (e) {}
  const errStr = `Conversion failed. The original download is kept at ${displayPath(downloadedFile)}`;
  sendProgress(downloadId, name, { percent: 100, state: "error", phase: "error", subText: errStr });
  return { ok: false, error: errStr };
}

// ── PLATFORM TOOLS ───────────────────────────────────────────────────────────
// Zips: ditto on macOS; on Windows the tar that ships with Windows 10 and 11, which reads zips
function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  if (IS_WIN) return execFileAsync(path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe"), ["-xf", zipPath, "-C", destDir]);
  return execFileAsync("/usr/bin/ditto", ["-x", "-k", zipPath, destDir]);
}

// Any image to PNG, scaled so its longer side is maxSize when given: sips on macOS; on Windows
// ffmpeg, or Chromium for SVG (the Windows ffmpeg build has no SVG decoder)
async function convertImageToPng(src, out, maxSize) {
  if (!IS_WIN) {
    await execFileAsync("/usr/bin/sips", ["-s", "format", "png", ...(maxSize ? ["-Z", String(maxSize)] : []), src, "--out", out]);
  } else if (path.extname(src).toLowerCase() === ".svg") {
    await rasterizeSvg(src, out, maxSize || 1024);
  } else {
    await execFileAsync(getBinaryPath("ffmpeg"), ["-y", "-v", "error", "-i", src, "-frames:v", "1", out]);
  }
}

// Draws the SVG as an image, where its scripts never run, onto a canvas in a hidden window
async function rasterizeSvg(src, out, size) {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  try {
    await win.loadURL("about:blank");
    const svgUrl = `data:image/svg+xml;base64,${fs.readFileSync(src).toString("base64")}`;
    const png = await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || ${size}, h = img.naturalHeight || ${size}, scale = ${size} / Math.max(w, h);
        const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(w * scale), height: Math.round(h * scale) });
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png").split(",")[1]);
      };
      img.onerror = () => reject(new Error("not a readable SVG"));
      img.src = ${JSON.stringify(svgUrl)};
    })`);
    fs.writeFileSync(out, Buffer.from(png, "base64"));
  } finally {
    win.destroy();
  }
}

// ── LAYER 2: FORMAT COMPATIBILITY ADAPTER (Pre-Premiere Normalizer) ──────────
// Websites often serve AVIF or WebP from a URL ending in .jpg. Premiere trusts the extension
// and fails with "header error", so read the file's first bytes to learn what it really is.
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".heic", ".heif", ".jfif", ".bmp", ".tif", ".tiff", ""]);

function sniffImageExt(filePath) {
  let head;
  try {
    const fd = fs.openSync(filePath, "r");
    head = Buffer.alloc(32);
    fs.readSync(fd, head, 0, 32, 0);
    fs.closeSync(fd);
  } catch (e) {
    return null;
  }
  const ascii = head.toString("latin1");
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return ".jpg";
  if (ascii.startsWith("\x89PNG")) return ".png";
  if (ascii.startsWith("GIF8")) return ".gif";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return ".webp";
  if (ascii.slice(4, 8) === "ftyp") {
    const brand = ascii.slice(8, 12);
    if (brand === "avif" || brand === "avis") return ".avif";
    if (["heic", "heix", "hevc", "mif1", "msf1"].includes(brand)) return ".heic";
  }
  if (/^\s*<(!doctype html|html)/i.test(ascii)) return ".html";
  return null;
}

async function normalizeAndIngestMedia(filePath, originalFilename, downloadId) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error("[MediaDrop Normalizer] File does not exist:", filePath);
      return;
    }

    // Give mislabelled images their real extension before deciding what to do with them
    const labelled = path.extname(filePath).toLowerCase();
    if (IMAGE_EXTS.has(labelled)) {
      const actual = sniffImageExt(filePath);
      if (actual === ".html") {
        emitProgress({ id: downloadId, name: path.basename(filePath), percent: 100, state: "error", phase: "error",
          subText: "The site sent a web page instead of the file. Try opening the image first, then download it." });
        try { fs.unlinkSync(filePath); } catch (e) {}
        return;
      }
      const same = actual === labelled || (actual === ".jpg" && [".jpeg", ".jfif"].includes(labelled));
      if (actual && !same) {
        const fixed = getUniqueFilePath(path.dirname(filePath), path.basename(filePath, labelled), actual.slice(1));
        try {
          fs.renameSync(filePath, fixed);
          filePath = fixed;
        } catch (e) {}
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const downloadDir = path.dirname(filePath);
    const baseName = path.basename(filePath, ext);

    // Audio Premiere can't open (Ogg, Opus, FLAC) -> 48 kHz WAV
    if ([".ogg", ".oga", ".opus", ".flac"].includes(ext)) {
      const outWav = getUniqueFilePath(downloadDir, baseName, "wav");
      emitProgress({ id: downloadId, name: path.basename(outWav), percent: 90, state: "transcoding", phase: "normalizing", subText: "Converting to WAV" });
      const finalAudio = await new Promise((resolve) => {
        cp.execFile(getBinaryPath("ffmpeg"), ["-y", "-i", filePath, "-vn", "-c:a", "pcm_s16le", "-ar", "48000", outWav], { windowsHide: true }, (err) => {
          if (err) console.warn("[MediaDrop Normalizer] Audio conversion error:", err.message);
          resolve(err ? filePath : outWav);
        });
      });
      emitProgress({ id: downloadId, name: path.basename(finalAudio), percent: 100, state: "completed" });
      sendToPremiere(finalAudio, downloadId);
      return;
    }

    // 1. Vector Icons (.svg) -> Auto-convert to 1024x1024 crisp transparent PNG
    if (ext === ".svg") {
      const outPng = getUniqueFilePath(downloadDir, baseName, "png");
      if (mainWindow && !mainWindow.isDestroyed()) {
        emitProgress({
          id: downloadId,
          name: path.basename(outPng),
          percent: 90,
          state: "transcoding",
          phase: "normalizing",
          subText: "Converting SVG to PNG"
        });
      }

      await convertImageToPng(filePath, outPng, 1024).then(() => {
        console.log(`[MediaDrop Normalizer] Rasterized SVG -> ${outPng}`);
        return outPng;
      }, (err) => {
        console.warn("[MediaDrop Normalizer] SVG conversion error:", err.message);
        return filePath;
      }).then((finalFile) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          emitProgress({
            id: downloadId,
            name: path.basename(finalFile),
            percent: 100,
            state: "completed"
          });
        }
        sendToPremiere(finalFile, downloadId);
      });
      return;
    }

    // 2. Web Videos (.webm, .mkv) -> Transcode or Remux to MP4
    if (ext === ".webm" || ext === ".mkv") {
      const outMp4 = getUniqueFilePath(downloadDir, baseName, "mp4");
      const probe = await probeMedia(filePath);

      await transcodeOrRemuxMedia({
        downloadedFile: filePath,
        finalSavePath: outMp4,
        downloadId,
        durationSec: probe.durationSec,
        detectedCodec: probe.codec
      });

      return;
    }

    // 3. Web Images (.webp, .jfif, .avif, .heic) -> Lossless PNG
    if (ext === ".webp" || ext === ".jfif" || ext === ".avif" || ext === ".heic" || ext === ".heif") {
      const outPng = getUniqueFilePath(downloadDir, baseName, "png");
      if (mainWindow && !mainWindow.isDestroyed()) {
        emitProgress({
          id: downloadId,
          name: path.basename(outPng),
          percent: 90,
          state: "transcoding",
          phase: "normalizing",
          subText: "Converting to PNG"
        });
      }

      await convertImageToPng(filePath, outPng).then(() => {
        console.log(`[MediaDrop Normalizer] Converted ${ext} -> ${outPng}`);
        return outPng;
      }, (err) => {
        console.warn("[MediaDrop Normalizer] Image conversion error:", err.message);
        return filePath;
      }).then((finalImg) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          emitProgress({
            id: downloadId,
            name: path.basename(finalImg),
            percent: 100,
            state: "completed"
          });
        }
        sendToPremiere(finalImg, downloadId);
      });
      return;
    }

    // 4. Archives (.zip) -> Auto-extract & recursively normalize primary media
    if (ext === ".zip") {
      const extractDir = path.join(downloadDir, `${baseName}_${Date.now()}`);
      fs.mkdirSync(extractDir, { recursive: true });

      if (mainWindow && !mainWindow.isDestroyed()) {
        emitProgress({
          id: downloadId,
          name: path.basename(filePath),
          percent: 50,
          state: "extracting"
        });
      }

      extractZip(filePath, extractDir).then(() => null, (e) => e).then(async (err) => {
        if (!err) {
          const primaryFile = findPrimaryMediaFile(extractDir);
          if (primaryFile) {
            const cleanExt = path.extname(primaryFile);
            const cleanName = safeFileName(path.basename(primaryFile, cleanExt)).slice(0, 80);
            const extractedTarget = getUniqueFilePath(downloadDir, cleanName, cleanExt);
            try {
              fs.copyFileSync(primaryFile, extractedTarget);
              await normalizeAndIngestMedia(extractedTarget, path.basename(extractedTarget), downloadId);
            } catch (e) {
              await normalizeAndIngestMedia(primaryFile, path.basename(primaryFile), downloadId);
            }
          } else {
            sendToPremiere(filePath, downloadId);
          }
        } else {
          sendToPremiere(filePath, downloadId);
        }
      });
      return;
    }

    // 5. Native Formats (.mp4, .mov, .wav, .mp3, .png, .jpg, .jpeg, .mogrt, .prproj) -> Direct Pass-through
    if (mainWindow && !mainWindow.isDestroyed()) {
      emitProgress({
        id: downloadId,
        name: path.basename(filePath),
        percent: 100,
        state: "completed"
      });
    }
    sendToPremiere(filePath, downloadId);
  } catch (err) {
    console.error("[MediaDrop Normalizer] Unexpected error:", err);
    sendToPremiere(filePath, downloadId);
  }
}

function findPrimaryMediaFile(dir) {
  const MEDIA_EXTS = new Set([
    ".mp4", ".mov", ".mkv", ".m4v", ".webm",
    ".wav", ".mp3", ".aac", ".aif", ".aiff", ".m4a", ".flac",
    ".png", ".jpg", ".jpeg", ".webp", ".svg", ".avif", ".heic"
  ]);

  // A .mogrt always wins (template packs ship larger preview .mp4s next to it);
  // otherwise take the largest media file.
  let mogrtFile = null;
  let bestFile = null;
  let bestSize = 0;

  function walk(currentDir) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          // Skip __MACOSX resource fork directories
          if (entry.name !== "__MACOSX") walk(full);
        } else if (entry.isFile()) {
          // Skip hidden dotfiles like ._filename.mp4
          if (entry.name.startsWith("._")) continue;

          const ext = path.extname(entry.name).toLowerCase();
          if (ext === ".mogrt") {
            if (!mogrtFile) mogrtFile = full;
          } else if (MEDIA_EXTS.has(ext)) {
            const size = fs.statSync(full).size;
            if (size > bestSize) {
              bestSize = size;
              bestFile = full;
            }
          }
        }
      }
    } catch (e) {}
  }

  walk(dir);
  return mogrtFile || bestFile;
}

// Download image/gif/video from URL directly (for right-click context menu)
// name: optional title for the file, e.g. a search result's title
async function downloadDirectMedia(mediaUrl, mediaType = "image", referrer = "", name = "") {
  try {
    const downloadDir = await chooseDownloadDir();
    if (!downloadDir) return;
    if (!fs.existsSync(downloadDir)) {
      try { fs.mkdirSync(downloadDir, { recursive: true }); } catch (e) {}
    }

    // Determine file extension
    let ext = ".jpg";
    const cleanUrl = mediaUrl.split("?")[0].toLowerCase();
    if (cleanUrl.endsWith(".gif") || cleanUrl.includes(".gif") || cleanUrl.includes("tenor") || cleanUrl.includes("giphy")) ext = ".gif";
    else if (cleanUrl.endsWith(".png") || cleanUrl.includes(".png")) ext = ".png";
    else if (cleanUrl.endsWith(".mp4") || cleanUrl.includes(".mp4")) ext = ".mp4";
    else if (cleanUrl.endsWith(".webm") || cleanUrl.includes(".webm")) ext = ".webm";
    else if (cleanUrl.endsWith(".mov") || cleanUrl.includes(".mov")) ext = ".mov";
    else if (cleanUrl.endsWith(".svg") || cleanUrl.includes(".svg")) ext = ".svg";
    else if (cleanUrl.endsWith(".jpeg")) ext = ".jpeg";
    else if (/\.(mp3|wav|ogg|flac|m4a|aiff?)$/.test(cleanUrl)) ext = cleanUrl.slice(cleanUrl.lastIndexOf("."));
    else if (mediaType === "video") ext = ".mp4";
    else if (mediaType === "audio") ext = ".mp3";

    const prefix = ext === ".gif" ? "gif_" : `${mediaType}_`;
    const cleanName = safeFileName(name).replace(/\s+/g, " ").trim().slice(0, 80);
    const fileStem = cleanName || `${prefix}${Date.now()}`;
    const savePath = getUniqueFilePath(downloadDir, fileStem, ext);
    const filename = path.basename(savePath);

    const downloadId = "dl-" + Date.now();
    downloadSources.set(downloadId, siteName(referrer || mediaUrl));
    if (mainWindow && !mainWindow.isDestroyed()) {
      emitProgress({
        id: downloadId,
        name: filename,
        percent: 25,
        state: "downloading"
      });
    }

    // Same session as the webviews: same cookies and User-Agent as the page the user sees
    // Send only the page origin as Referer, like a browser does cross-site. With the default
    // referrer policy Chromium rejects a full-URL Referer (or any on an https→http request)
    // with net::ERR_BLOCKED_BY_CLIENT, so the policy is set explicitly.
    const request = net.request({
      method: "GET",
      url: mediaUrl,
      partition: "persist:mediadrop",
      useSessionCookies: true,
      referrerPolicy: "unsafe-url"
    });
    if (/^https?:/i.test(referrer)) request.setHeader("Referer", new URL(referrer).origin + "/");
    const ACCEPT = { video: "video/*,*/*;q=0.8", audio: "audio/*,*/*;q=0.8" };
    request.setHeader("Accept", ACCEPT[mediaType] || "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8");

    let finalSavePath = savePath;

    const failDownload = (message) => {
      console.error("[MediaDrop] Direct media download error:", message);
      try { fs.unlinkSync(savePath); } catch (e) {}
      if (mainWindow && !mainWindow.isDestroyed()) {
        emitProgress({
          id: downloadId,
          name: filename,
          percent: 100,
          state: "error",
          phase: "error",
          subText: message
        });
      }
    };

    request.on("response", (response) => {
      // Without this check a 403/404 HTML error page gets saved as ".jpg" and imported
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        return failDownload(`Server responded with HTTP ${response.statusCode}`);
      }

      try {
        const cType = (response.headers["content-type"] || response.headers["Content-Type"] || "");
        const headerStr = (Array.isArray(cType) ? cType.join(";") : String(cType)).toLowerCase();
        if (headerStr.includes("text/html")) {
          response.resume();
          return failDownload("The link points to a web page, not a media file.");
        }
        let targetExt = ext;
        if (headerStr.includes("image/gif")) targetExt = ".gif";
        else if (headerStr.includes("video/mp4")) targetExt = ".mp4";
        else if (headerStr.includes("image/png")) targetExt = ".png";
        else if (headerStr.includes("video/webm")) targetExt = ".webm";
        else if (headerStr.includes("image/jpeg")) targetExt = ".jpg";
        else if (headerStr.includes("image/webp")) targetExt = ".webp";
        else if (headerStr.includes("audio/mpeg")) targetExt = ".mp3";
        else if (headerStr.includes("audio/wav") || headerStr.includes("audio/x-wav")) targetExt = ".wav";
        else if (headerStr.includes("audio/ogg")) targetExt = ".ogg";
        else if (headerStr.includes("audio/flac")) targetExt = ".flac";

        if (targetExt !== ext) finalSavePath = getUniqueFilePath(downloadDir, fileStem, targetExt);
      } catch (e) {}

      const fileStream = fs.createWriteStream(savePath);
      fileStream.on("error", (err) => {
        response.resume();
        failDownload(`Could not write file: ${err.message}`);
      });
      response.on("error", (err) => {
        fileStream.destroy();
        failDownload(err.message);
      });
      response.pipe(fileStream);
      fileStream.on("finish", () => {
        if (finalSavePath !== savePath) {
          try {
            fs.renameSync(savePath, finalSavePath);
          } catch (e) {
            finalSavePath = savePath;
          }
        }
        normalizeAndIngestMedia(finalSavePath, path.basename(finalSavePath), downloadId);
      });
    });

    request.on("error", (err) => failDownload(err.message));

    request.end();
  } catch (err) {
    console.error("[MediaDrop] Failed to initiate direct media download:", err);
  }
}

// ── GLOBAL CONTEXT MENU FOR WEBVIEWS ─────────────────────────────────────────
// The guest preload reports the original full-size URL of the image under the cursor
// (e.g. Google Images, whose grid only holds thumbnails) just before the menu opens.
const imageOriginals = new Map();
ipcMain.on("mediadrop:image-original", (event, payload) => {
  const srcURL = payload && typeof payload.srcURL === "string" ? payload.srcURL : "";
  let original = "";
  try {
    const u = new URL(String((payload && payload.original) || ""));
    if (u.protocol === "https:" || u.protocol === "http:") original = u.href;
  } catch (e) {}
  imageOriginals.set(event.sender.id, { srcURL, original });
});

app.on("web-contents-created", (_event, contents) => {
  contents.once("destroyed", () => imageOriginals.delete(contents.id));
  // Listen for context menu in webviews
  contents.on("context-menu", (_e, params) => {
    const menu = new Menu();

    if ((params.mediaType === "image" || params.mediaType === "video") && params.srcURL) {
      const isGif = params.srcURL.toLowerCase().includes(".gif") || 
                    params.srcURL.toLowerCase().includes("tenor") || 
                    params.srcURL.toLowerCase().includes("giphy");
      const label = isGif 
        ? "Import GIF to Premiere Pro" 
        : (params.mediaType === "video" ? "Import Video to Premiere Pro" : "Import Image to Premiere Pro");
      menu.append(new MenuItem({
        label: label,
        click: async () => {
          let mediaUrl = params.srcURL;
          const hint = params.mediaType === "image" ? imageOriginals.get(contents.id) : null;
          if (hint && hint.srcURL === params.srcURL && hint.original) {
            mediaUrl = hint.original;
          }
          if (/^(data|blob):/i.test(mediaUrl)) {
            // Inline/blob media lives only in the page: let Chromium save it via will-download
            contents.downloadURL(mediaUrl);
          } else {
            downloadDirectMedia(mediaUrl, params.mediaType, params.pageURL);
          }
        }
      }));
      menu.append(new MenuItem({ type: "separator" }));
    }

    if (params.linkURL) {
      menu.append(new MenuItem({
        label: "Copy Link",
        role: "copyLink"
      }));
      menu.append(new MenuItem({ type: "separator" }));
    }

    if (params.selectionText) {
      menu.append(new MenuItem({ role: "copy" }));
    }

    menu.append(new MenuItem({ role: "reload" }));

    if (menu.items.length > 1) {
      menu.popup();
    }
  });
});

// ── YOUTUBE DOWNLOAD ENGINE (yt-dlp & Apple VideoToolbox) ────────────────────
function videoCodecName(vcodec) {
  const c = String(vcodec || "").toLowerCase();
  if (c.startsWith("avc1") || c.includes("h264")) return "H.264";
  if (c.startsWith("vp09") || c.startsWith("vp9")) return "VP9";
  if (c.startsWith("av01")) return "AV1";
  if (c.startsWith("hev") || c.startsWith("hvc")) return "HEVC";
  return c.split(".")[0].toUpperCase() || "Video";
}

// One entry per resolution / frame rate / codec / HDR combination: the highest-bitrate stream
function parseYouTubeFormats(info) {
  const duration = info.duration || 0;
  const raw = info.formats || [];
  const bytesOf = (f, kbps) => f.filesize || f.filesize_approx || (kbps && duration ? Math.round(kbps * 125 * duration) : 0);

  const audioBytes = raw
    .filter(f => f.vcodec === "none" && f.acodec && f.acodec !== "none")
    .reduce((max, a) => Math.max(max, bytesOf(a, a.abr || a.tbr)), 0);

  const video = raw.filter(f => f.vcodec && f.vcodec !== "none" && f.height && /^[\w-]+$/.test(f.format_id || ""));
  const direct = video.filter(f => !String(f.protocol || "").startsWith("m3u8"));
  const best = new Map();
  for (const f of direct.length ? direct : video) {
    const codec = videoCodecName(f.vcodec);
    const fps = Math.round(f.fps || 30);
    const hdr = Boolean(f.dynamic_range && f.dynamic_range !== "SDR");
    const key = `${f.width}x${f.height}-${fps}-${codec}-${hdr}`;
    const kbps = f.tbr || f.vbr || 0;
    const prev = best.get(key);
    if (!prev || kbps > prev.kbps) best.set(key, { f, codec, fps, hdr, kbps });
  }

  const codecOrder = { "H.264": 0, "VP9": 1, "AV1": 2 };
  const videos = [...best.values()].map(({ f, codec, fps, hdr }) => ({
    id: f.format_id,
    width: f.width || 0,
    height: f.height,
    quality: Math.min(f.width || f.height, f.height), // "1080p" is the short side, also for vertical video
    fps,
    codec,
    hdr,
    bytes: bytesOf(f, f.vbr || f.tbr)
  })).sort((a, b) => b.quality - a.quality || b.fps - a.fps || (codecOrder[a.codec] ?? 9) - (codecOrder[b.codec] ?? 9));

  return { videos, audioBytes };
}

// Electron doubles as the Node runtime yt-dlp needs to solve YouTube's JS challenges
const YT_DLP_ENV = { ...process.env, ELECTRON_RUN_AS_NODE: "1" };

function ytDlpCommonArgs() {
  const args = ["--js-runtimes", `node:${process.execPath}`];
  const ffmpegPath = getBinaryPath("ffmpeg");
  if (path.isAbsolute(ffmpegPath)) args.push("--ffmpeg-location", path.dirname(ffmpegPath));
  return args;
}

// yt-dlp ships as its folder build, <version>/yt-dlp_macos (yt-dlp.exe on Windows) + _internal: it
// starts in a fraction of a second, where the single-file build unpacks itself on every run. Folder
// builds can't update themselves, so MediaDrop keeps verified newer releases in userData/yt-dlp/<version>.
// YouTube changes break old versions, so this matters.
const YT_DLP_USER_DIR = path.join(app.getPath("userData"), "yt-dlp");
const YT_DLP_DIRS = [YT_DLP_USER_DIR, path.join(process.resourcesPath, "yt-dlp"), path.join(__dirname, "vendor", process.platform, "yt-dlp")];
const YT_DLP_VERSION_RE = /^\d+(\.\d+)+$/;
const YT_DLP_ZIP = IS_WIN ? "yt-dlp_win.zip" : "yt-dlp_macos.zip";
const YT_DLP_EXE = IS_WIN ? "yt-dlp.exe" : "yt-dlp_macos";

function ytDlpInstalls() {
  const installs = [];
  for (const dir of YT_DLP_DIRS) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) {}
    for (const version of names.filter((n) => YT_DLP_VERSION_RE.test(n))) {
      const exe = path.join(dir, version, YT_DLP_EXE);
      if (fs.existsSync(exe)) installs.push({ version, exe });
    }
  }
  return installs.sort((a, b) => compareVersions(b.version, a.version));
}

let ytDlpCurrent = null;
function getYtDlp() {
  if (!ytDlpCurrent) ytDlpCurrent = ytDlpInstalls()[0] || { version: "0", exe: getBinaryPath("yt-dlp") };
  return ytDlpCurrent;
}

function execFileAsync(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    cp.execFile(file, args, { windowsHide: true, ...options }, (err, stdout) => (err ? reject(err) : resolve(stdout)));
  });
}

async function fetchOk(url, options) {
  const res = await net.fetch(url, options);
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
  return res;
}

// Runs at startup, before any download: drops superseded copies, warms up the current one
// (macOS scans new executables on their first run, which takes seconds) and, once a day,
// installs a newer yt-dlp release.
async function updateYtDlp() {
  try {
    fs.rmSync(path.join(app.getPath("userData"), "bin"), { recursive: true, force: true }); // single-file copy from 1.0.0
    fs.mkdirSync(YT_DLP_USER_DIR, { recursive: true });
    for (const name of fs.readdirSync(YT_DLP_USER_DIR)) {
      const keep = name === getYtDlp().version || name.startsWith(".last-");
      if (!keep) fs.rmSync(path.join(YT_DLP_USER_DIR, name), { recursive: true, force: true });
    }
  } catch (e) {
    console.warn("[MediaDrop] Could not tidy yt-dlp copies:", e.message);
  }
  cp.execFile(getYtDlp().exe, ["--version"], { env: YT_DLP_ENV, timeout: 60000, windowsHide: true }, () => {});

  const stamp = path.join(YT_DLP_USER_DIR, ".last-update-check");
  try {
    if (fs.existsSync(stamp) && Date.now() - fs.statSync(stamp).mtimeMs < 24 * 60 * 60 * 1000) return;
    fs.writeFileSync(stamp, "");
  } catch (e) {
    return;
  }

  let work = null;
  try {
    const release = await (await fetchOk("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest", {
      headers: { Accept: "application/vnd.github+json" }
    })).json();
    const version = String(release.tag_name || "");
    if (!YT_DLP_VERSION_RE.test(version) || compareVersions(version, getYtDlp().version) <= 0) return;

    const base = `https://github.com/yt-dlp/yt-dlp/releases/download/${version}/`;
    const sums = await (await fetchOk(base + "SHA2-256SUMS")).text();
    const expected = sums.split("\n").map((l) => l.trim().split(/\s+/)).find((p) => p[1] === YT_DLP_ZIP);
    if (!expected) throw new Error(`${YT_DLP_ZIP} is not listed in SHA2-256SUMS`);
    const zip = Buffer.from(await (await fetchOk(base + YT_DLP_ZIP)).arrayBuffer());
    if (crypto.createHash("sha256").update(zip).digest("hex") !== expected[0]) throw new Error("checksum mismatch");

    work = fs.mkdtempSync(path.join(YT_DLP_USER_DIR, ".tmp-"));
    const zipPath = path.join(work, YT_DLP_ZIP);
    const extracted = path.join(work, version);
    fs.writeFileSync(zipPath, zip);
    await extractZip(zipPath, extracted);
    const exe = path.join(extracted, YT_DLP_EXE);
    await execFileAsync(exe, ["--version"], { env: YT_DLP_ENV, timeout: 60000 }); // runs, and is warmed up
    fs.renameSync(extracted, path.join(YT_DLP_USER_DIR, version));
    ytDlpCurrent = null; // the next download uses the new version; the old copy goes at next launch
    console.log("[MediaDrop] yt-dlp updated to", version);
  } catch (e) {
    console.warn("[MediaDrop] yt-dlp update failed:", e.message);
  } finally {
    if (work) fs.rmSync(work, { recursive: true, force: true });
  }
}

function setupYouTubeHandlers() {
  handleFromApp("youtube:get-formats", async (_e, url) => {
    const cleanUrl = cleanYouTubeUrl(url);
    if (!cleanUrl) return { ok: false, error: "Not a valid YouTube video URL" };
    const ytDlpCmd = getYtDlp().exe;
    const cookieFile = await exportYouTubeCookies();

    const args = [
      "-J",
      "--no-playlist",
      "--socket-timeout", "20",
      "--retries", "5",
      ...ytDlpCommonArgs()
    ];

    if (cookieFile && fs.existsSync(cookieFile)) {
      args.push("--cookies", cookieFile);
    }
    args.push("--", cleanUrl);

    return new Promise((resolve) => {
      cp.execFile(ytDlpCmd, args, {
        maxBuffer: 100 * 1024 * 1024,
        env: YT_DLP_ENV,
        windowsHide: true
      }, (err, stdout, stderr) => {
        removeCookieFile(cookieFile);
        if (err) {
          const rawErr = (stderr || err.message || "");
          const cleanErr = rawErr
            .split("\n")
            .map(l => l.trim())
            .filter(l => l && !l.includes("[pot:bgutil") && !l.includes("TransportError"))
            .filter(l => l.toLowerCase().startsWith("error:"))
            .join("; ") || err.message;
          console.error("[MediaDrop] yt-dlp error:", cleanErr);
          return resolve({ ok: false, error: cleanErr });
        }
        try {
          const info = JSON.parse(stdout);
          const durationMins = info.duration ? Math.floor(info.duration / 60) : 0;
          const durationSecs = info.duration ? info.duration % 60 : 0;
          const durationStr = `${durationMins}:${durationSecs < 10 ? "0" : ""}${durationSecs}`;

          const { videos, audioBytes } = parseYouTubeFormats(info);

          resolve({
            ok: true,
            title: info.title || "YouTube Video",
            uploader: info.uploader || info.channel || "",
            duration: durationStr,
            durationSec: info.duration || 0,
            thumbnail: info.thumbnail || "",
            videos,
            audioBytes
          });
        } catch (e) {
          resolve({ ok: false, error: "Failed to parse YouTube metadata: " + e.message });
        }
      });
    });
  });

  const downloadYouTube = async (opts, ctx) => {
    const { url, title, mode, streamId, height, output = "mp4", includeAudio = true, audioFormat = "wav", start, end } = opts;
    const cleanUrl = cleanYouTubeUrl(url);
    if (!cleanUrl) return { ok: false, error: "Not a valid YouTube video URL" };
    const isAudio = mode === "audio";
    if (isAudio && !YT_AUDIO_FORMATS.has(audioFormat)) return { ok: false, error: "Unsupported audio format" };
    if (!isAudio && !(typeof streamId === "string" && /^[\w-]+$/.test(streamId))) return { ok: false, error: "Missing video stream" };
    if (!isAudio && !YT_VIDEO_OUTPUTS.has(output)) return { ok: false, error: "Unsupported output format" };
    const trim = clipTrimArgs(start, end);
    if (trim === null) return { ok: false, error: "Invalid clip range" };

    const maxHeight = Number.isInteger(height) && height > 0 ? height : 1080;
    let formatId;
    if (isAudio) formatId = audioFormat === "m4a" ? "140/bestaudio[ext=m4a]/bestaudio" : "bestaudio/best";
    else if (!includeAudio) formatId = `${streamId}/bestvideo[height<=${maxHeight}]`;
    else if (output === "original") formatId = `${streamId}+bestaudio[ext=m4a]/${streamId}+bestaudio/bestvideo[height<=${maxHeight}]+bestaudio/best`;
    else formatId = `${streamId}+bestaudio/bestvideo[height<=${maxHeight}]+bestaudio/best`;

    const safeTitle = safeFileName(title || "youtube_video")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);

    const downloadId = "yt-" + Date.now();
    ctx.downloadId = downloadId;
    downloadSources.set(downloadId, "YouTube");

    // Same video with the same settings already downloaded: import that file instead
    const reuseKey = ["yt", cleanUrl, mode, isAudio ? audioFormat : `${streamId}:${output}:${includeAudio}`, trim.join(",")].join("|");
    downloadKeys.set(downloadId, reuseKey);
    const existing = findReusableFile(reuseKey);
    if (existing) {
      sendProgress(downloadId, path.basename(existing), { percent: 100, state: "completed", phase: "completed", reused: true });
      sendToPremiere(existing, downloadId);
      return { ok: true, outPath: existing, reused: true };
    }
    const downloadDir = await chooseDownloadDir();
    if (!downloadDir) return { ok: false, cancelled: true };
    if (!fs.existsSync(downloadDir)) {
      try { fs.mkdirSync(downloadDir, { recursive: true }); } catch (e) {}
    }
    // "original" keeps whatever container yt-dlp produced, so its extension is only known afterwards
    const finalExt = isAudio ? audioFormat : (output === "prores" ? "mov" : "mp4");
    const finalSavePath = getUniqueFilePath(downloadDir, safeTitle, finalExt);
    const finalBaseName = path.basename(finalSavePath, "." + finalExt);

    // Temporary staging prefix to avoid file collision during raw download
    const rawPrefix = `__raw_${Date.now()}_`;
    const rawTemplate = path.join(downloadDir, `${rawPrefix}%(id)s.%(ext)s`);

    const ytDlpCmd = getYtDlp().exe;
    const cookieFile = await exportYouTubeCookies();

    const ytArgs = [
      ...ytDlpCommonArgs(),
      "-f", formatId,
      "--no-playlist",
      "--force-overwrites",
      "--progress",
      "--newline",
      "--socket-timeout", "20",
      "--retries", "10",
      "--fragment-retries", "10",
      "--concurrent-fragments", "4"
    ];

    if (cookieFile && fs.existsSync(cookieFile)) {
      ytArgs.push("--cookies", cookieFile);
    }

    if (isAudio) {
      ytArgs.push("--extract-audio", "--audio-format", audioFormat);
    } else if (output === "original") {
      ytArgs.push("--merge-output-format", "mp4/mkv");
    } else {
      // MKV holds any codec pair, so the merge never fails; ffmpeg converts it afterwards
      ytArgs.push("--merge-output-format", "mkv");
    }

    ytArgs.push("-o", rawTemplate, "--", cleanUrl);

    if (mainWindow && !mainWindow.isDestroyed()) {
      emitProgress({
        id: downloadId,
        name: `${finalBaseName}.${finalExt}`,
        percent: 0,
        state: "downloading",
        phase: "downloading",
        subText: "Connecting to YouTube…"
      });
    }

    return new Promise((resolve) => {
      const proc = cp.spawn(ytDlpCmd, ytArgs, { env: YT_DLP_ENV, windowsHide: true });

      let currentStream = 1;
      let ytStderr = "";

      proc.stdout.on("data", (data) => {
        const text = data.toString();
        const lines = text.split("\n");

        for (const line of lines) {
          // Detect second stream download (audio stream starting after video)
          if (line.includes("[download] Destination:") && !line.includes(rawPrefix)) {
            currentStream++;
          }

          // Detect merging phase
          if (line.includes("[Merger]") || line.includes("Merging formats")) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              emitProgress({
                id: downloadId,
                name: `${finalBaseName}.${finalExt}`,
                percent: 98,
                state: "merging",
                phase: "merging",
                subText: "Merging high-resolution video and audio streams..."
              });
            }
            continue;
          }

          // Detect audio extraction phase
          if (line.includes("[ExtractAudio]")) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              emitProgress({
                id: downloadId,
                name: `${finalBaseName}.${finalExt}`,
                percent: 98,
                state: "downloading",
                phase: "extracting",
                subText: `Extracting ${audioFormat.toUpperCase()} master audio...`
              });
            }
            continue;
          }

          const match = line.match(/\[download\]\s+([\d\.]+)%/);
          if (match && mainWindow && !mainWindow.isDestroyed()) {
            const rawPct = parseFloat(match[1]);
            let overallPct = Math.min(100, Math.round(rawPct));
            let subText = `Downloading: ${overallPct}%`;

            if (!isAudio) {
              if (currentStream === 1) {
                // Stream 1 (Video): 0% to 85%
                overallPct = Math.min(85, Math.round(rawPct * 0.85));
                subText = `Downloading video stream: ${Math.round(rawPct)}%`;
              } else {
                // Stream 2 (Audio): 85% to 98%
                overallPct = Math.min(98, 85 + Math.round(rawPct * 0.13));
                subText = `Downloading master audio stream: ${Math.round(rawPct)}%`;
              }
            } else {
              subText = `Downloading audio: ${overallPct}%`;
            }

            emitProgress({
              id: downloadId,
              name: `${finalBaseName}.${finalExt}`,
              percent: overallPct,
              state: "downloading",
              phase: "downloading",
              subText
            });
          }
        }
      });

      proc.stderr.on("data", (data) => {
        const str = data.toString();
        ytStderr += str;
        console.warn("[yt-dlp stderr]:", str);
      });

      proc.on("error", (err) => {
        removeCookieFile(cookieFile);
        console.error("[MediaDrop] yt-dlp process spawn error:", err);
        const errMsg = "Failed to launch yt-dlp: " + err.message;
        if (mainWindow && !mainWindow.isDestroyed()) {
          emitProgress({
            id: downloadId,
            name: `${finalBaseName}.${finalExt}`,
            percent: 100,
            state: "error",
            phase: "error",
            subText: errMsg
          });
        }
        resolve({ ok: false, error: errMsg });
      });

      proc.on("close", async (code) => {
        removeCookieFile(cookieFile);
        if (code !== 0) {
          const cleanErr = ytStderr
            .split("\n")
            .map(l => l.trim())
            .filter(l => l && !l.includes("[pot:bgutil") && !l.includes("TransportError"))
            .filter(l => l.toLowerCase().startsWith("error:"))
            .join("; ") || `yt-dlp exited with code ${code}`;

          console.error(`[MediaDrop] yt-dlp error (${code}):`, cleanErr);
          if (mainWindow && !mainWindow.isDestroyed()) {
            emitProgress({
              id: downloadId,
              name: `${finalBaseName}.${finalExt}`,
              percent: 100,
              state: "error",
              phase: "error",
              subText: cleanErr.slice(0, 140)
            });
          }
          return resolve({ ok: false, error: cleanErr });
        }

        // Find the downloaded raw file in downloadDir matching rawPrefix
        let downloadedFile = null;
        try {
          const files = fs.readdirSync(downloadDir);
          const matched = files.filter(f =>
            f.startsWith(rawPrefix) &&
            !f.endsWith(".part") &&
            !f.endsWith(".ytdl") &&
            !/\.f\d+\.[a-zA-Z0-9]+$/.test(f)
          );

          if (isAudio) {
            const audioMatch = matched.find(f => f.toLowerCase().endsWith("." + finalExt));
            if (audioMatch) {
              downloadedFile = path.join(downloadDir, audioMatch);
            } else if (matched.length > 0) {
              downloadedFile = path.join(downloadDir, matched[0]);
            }
          } else {
            const videoMatch = matched.find(f => f.endsWith(".mkv") || f.endsWith(".mp4") || f.endsWith(".webm"));
            if (videoMatch) {
              downloadedFile = path.join(downloadDir, videoMatch);
            } else if (matched.length > 0) {
              downloadedFile = path.join(downloadDir, matched[0]);
            }
          }
        } catch (e) {
          console.error("[MediaDrop] Error locating downloaded media:", e);
        }

        if (!downloadedFile || !fs.existsSync(downloadedFile)) {
          if (fs.existsSync(finalSavePath)) {
            downloadedFile = finalSavePath;
          } else {
            const errStr = "Downloaded media stream could not be found on disk";
            if (mainWindow && !mainWindow.isDestroyed()) {
              emitProgress({
                id: downloadId,
                name: `${finalBaseName}.${finalExt}`,
                percent: 100,
                state: "error",
                phase: "error",
                subText: errStr
              });
            }
            return resolve({ ok: false, error: errStr });
          }
        }

        if (isAudio) {
          let audioPath = finalSavePath;
          if (trim.length) audioPath = await cutWithoutReencode(downloadedFile, finalSavePath, trim);
          else if (downloadedFile !== finalSavePath) {
            try { fs.renameSync(downloadedFile, finalSavePath); } catch (e) { audioPath = downloadedFile; }
          }
          return resolve(finishIngest(downloadId, audioPath));
        }

        if (output === "original") {
          const ext = path.extname(downloadedFile).slice(1) || "mkv";
          const originalPath = getUniqueFilePath(downloadDir, safeTitle, ext);
          let savedPath = originalPath;
          if (trim.length) savedPath = await cutWithoutReencode(downloadedFile, originalPath, trim);
          else {
            try { fs.renameSync(downloadedFile, originalPath); } catch (e) { savedPath = downloadedFile; }
          }
          return resolve(finishIngest(downloadId, savedPath));
        }

        const probe = await probeMedia(downloadedFile);
        resolve(await transcodeOrRemuxMedia({
          downloadedFile,
          finalSavePath,
          downloadId,
          durationSec: trimmedDuration(probe.durationSec, trim),
          detectedCodec: probe.codec,
          target: output === "prores" ? "prores" : "h264",
          trim
        }));
      });
    });
  };

  handleFromApp("youtube:download", async (_e, opts = {}) => {
    const ctx = {};
    const res = await downloadYouTube(opts || {}, ctx);
    // A failed download may end without a final progress event; don't leave it in the badge
    if ((!res || !res.ok) && ctx.downloadId) {
      activeDownloads.delete(ctx.downloadId);
      updateDockBadge();
    }
    return res;
  });
}

// ── IPC GENERAL HANDLERS ─────────────────────────────────────────────────────
function setupIpcHandlers() {
  handleFromApp("premiere:check-status", () => premiereSnapshot());

  handleFromApp("app:open-downloads", () => {
    shell.openPath(getDownloadDir());
    return true;
  });

  handleFromApp("app:reveal-file", (_e, filePath) => {
    if (typeof filePath === "string" && path.isAbsolute(filePath) && fs.existsSync(filePath)) shell.showItemInFolder(filePath);
  });

  // Dragging a finished download out of MediaDrop drops the real file into Premiere
  ipcMain.on("app:start-drag", (event, filePath) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return;
    if (typeof filePath !== "string" || !path.isAbsolute(filePath) || !fs.existsSync(filePath)) return;
    const icon = nativeImage.createFromPath(path.join(__dirname, "assets", "logo.png")).resize({ width: 48, height: 48 });
    event.sender.startDrag({ file: filePath, icon });
  });

  handleFromApp("premiere:import-path", async (_e, filePath, site) => {
    if (typeof filePath !== "string" || !path.isAbsolute(filePath) || !fs.existsSync(filePath)) {
      return { ok: false, error: "File not found" };
    }
    const safeSite = typeof site === "string" && /^[\w .-]{1,40}$/.test(site) ? site : "";
    return await importFile(filePath, safeSite);
  });

  // Settings & Configuration Handlers
  handleFromApp("settings:get", () => {
    return currentSettings;
  });

  // The renderer hosts remote web content, so treat its input as untrusted: accept only
  // known keys with valid values. downloadFolder is deliberately excluded and can only be
  // changed through the native folder picker (settings:select-folder).
  handleFromApp("settings:save", (_e, newSettings) => {
    const input = (newSettings && typeof newSettings === "object") ? newSettings : {};
    const accepted = {};
    if (["timeline", "bin", "source"].includes(input.insertMode)) accepted.insertMode = input.insertMode;
    if (typeof input.alwaysOnTop === "boolean") accepted.alwaysOnTop = input.alwaysOnTop;
    if (typeof input.binsByType === "boolean") accepted.binsByType = input.binsByType;
    if (typeof input.importSound === "boolean") accepted.importSound = input.importSound;
    if (["ask", "folder", "project"].includes(input.saveLocation)) accepted.saveLocation = input.saveLocation;
    if (typeof input.clipboardOffers === "boolean") accepted.clipboardOffers = input.clipboardOffers;
    if (typeof input.hotkey === "string" && input.hotkey.length <= 64) accepted.hotkey = sanitizeHotkey(input.hotkey);
    return saveSettings(accepted);
  });

  handleFromApp("settings:select-folder", async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Select Folder for Downloaded Assets",
      defaultPath: currentSettings.downloadFolder || app.getPath("downloads"),
      properties: ["openDirectory", "createDirectory"]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const selected = result.filePaths[0];
      saveSettings({ downloadFolder: selected });
      return selected;
    }
    return null;
  });

  handleFromApp("settings:toggle-always-on-top", (_e, flag) => {
    const nextVal = typeof flag === "boolean" ? flag : !currentSettings.alwaysOnTop;
    currentSettings.alwaysOnTop = nextVal;
    saveSettings({ alwaysOnTop: nextVal });
    return nextVal;
  });
}

// ── BACKGROUND BRIDGE MONITOR ────────────────────────────────────────────────
async function premiereSnapshot() {
  const health = await checkBridgeHealth();
  const project = health.online ? await getPremiereStatus() : null;
  return {
    online: health.online,
    project: project && project.open ? project.projectName : null,
    sequence: project && project.open ? project.activeSequence : null,
    insertMode: currentSettings.insertMode,
    pending: pendingImports.length
  };
}

// ── SEARCH, LINK DOWNLOADS AND PLAYLISTS ─────────────────────────────────────
function isWebUrl(value) {
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch (e) { return false; }
}

function isYouTubeUrl(value) {
  try { return /(^|\.)(youtube\.com|youtu\.be)$/.test(new URL(value).hostname); } catch (e) { return false; }
}

function runYtDlpJson(args) {
  return new Promise((resolve) => {
    cp.execFile(getYtDlp().exe, [...ytDlpCommonArgs(), "--flat-playlist", "-J", "--no-warnings", ...args],
      { env: YT_DLP_ENV, maxBuffer: 50 * 1024 * 1024, timeout: 60000, windowsHide: true }, (err, stdout, stderr) => {
        if (err) return resolve({ ok: false, error: (stderr || err.message).trim().split("\n").pop() });
        try { resolve({ ok: true, data: JSON.parse(stdout) }); } catch (e) { resolve({ ok: false, error: "Unreadable response" }); }
      });
  });
}

// Every result says where it's from and how it may be used:
//   free   = copyright-free, no credit needed (Mixkit License, CC0, public domain)
//   credit = free to use if the author is credited (CC BY, CC BY-SA)
//   check  = copyrighted; the owner decides (YouTube, Tenor)
const MIXKIT_LICENCE = { tier: "free", name: "Mixkit License: free for commercial use, no credit needed" };
const CHECK_LICENCE = { tier: "check", name: "Copyrighted: check with the owner before using it" };

function licenceFromName(name) {
  const n = String(name || "").trim();
  if (/^(cc0|pd|public domain)/i.test(n) || /public domain/i.test(n)) return { tier: "free", name: `${n}: free to use, no credit needed` };
  if (/^cc[ -]by(?!.*\bnc\b)(?!.*\bnd\b)/i.test(n) || /^attribution$/i.test(n)) return { tier: "credit", name: `${n}: free to use, credit the author` };
  return { tier: "check", name: n ? `${n}: check the licence before using it` : CHECK_LICENCE.name };
}

const stripTags = (html) => String(html || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, " ").trim();
const querySlug = (q) => q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");

async function fetchText(url, headers = {}) {
  const res = await net.fetch(url, { headers, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Mixkit has no search API; its topic pages list results as server-rendered cards
function parseMixkit(html, section) {
  return html.split(/<div class="item-grid-card[ "]/).slice(1).map((card) => {
    const pick = (re) => (card.match(re) || [])[1] || "";
    if (section === "free-stock-video") {
      const id = pick(/data-algolia-analytics-object-id="video-(\d+)"/);
      if (!id) return null;
      const base = `https://assets.mixkit.co/videos/${id}/${id}`;
      return {
        id, title: stripTags(pick(/overlay-video-title">([\s\S]*?)<\/span>/)) || "Mixkit clip", by: "",
        thumb: pick(/<img src="(https:\/\/[^"]+)"/) || `${base}-thumb-360-0.jpg`, preview: `${base}-360.mp4`, url: `${base}-720.mp4`,
        page: `https://mixkit.co${pick(/href="(\/free-stock-video\/[^"]+)"/)}`
      };
    }
    const preview = pick(/data-audio-player-preview-url-value="([^"]+)"/);
    const id = pick(/data-audio-player-item-id-value="(\d+)"/);
    if (!id || !isWebUrl(preview)) return null;
    const [m, s] = pick(/data-test-id="duration">\s*([\d:]+)/).split(":").map(Number);
    return {
      id, title: stripTags(pick(/item-grid-card__title">([\s\S]*?)<\/h2>/)) || "Mixkit track",
      by: stripTags(pick(/preview__author">([\s\S]*?)<\/p>/)).replace(/^by\s+/i, ""),
      duration: (m || 0) * 60 + (s || 0), thumb: "", preview,
      // Sound effects preview as a short MP3; the download is the full WAV
      url: section === "free-sound-effects" ? preview.replace(/-preview\.mp3$/, ".wav") : preview,
      page: `https://mixkit.co/${section}/discover/`
    };
  }).filter(Boolean);
}

async function searchMixkit(q, section) {
  const load = async (words) => parseMixkit(await fetchText(`https://mixkit.co/${section}/discover/${querySlug(words)}/`), section);
  let results = await load(q);
  // Music and sound effect topics are single words, so fall back to each word of the query
  const words = q.split(/\s+/).filter((w) => w.length > 2).slice(0, 3);
  if (!results.length && words.length > 1) {
    const lists = await Promise.all(words.map((w) => load(w).catch(() => [])));
    const seen = new Set();
    results = lists.flat().filter((r) => !seen.has(r.id) && seen.add(r.id));
  }
  return results.map((r) => ({ ...r, site: "Mixkit", licence: MIXKIT_LICENCE }));
}

async function searchYouTube(q) {
  const res = await runYtDlpJson([`ytsearch16:${q}`]);
  if (!res.ok) throw new Error(res.error);
  return (res.data.entries || []).filter((v) => v && /^[\w-]{11}$/.test(v.id)).map((v) => ({
    id: v.id, title: v.title || "YouTube video", by: v.channel || v.uploader || "",
    duration: Number(v.duration) || 0, thumb: `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${v.id}`, page: `https://www.youtube.com/watch?v=${v.id}`,
    site: "YouTube", licence: CHECK_LICENCE
  }));
}

// Wikimedia asks API clients to identify themselves
const WIKIMEDIA_HEADERS = { "Api-User-Agent": "MediaDrop (https://github.com/robinxprince/MediaDrop)" };

async function searchCommons(q) {
  // Quotes stop "car" also matching "Carina"
  const filter = "filetype:bitmap -filemime:image/gif";
  const api = "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=30"
    + `&gsrsearch=${encodeURIComponent(`"${q}" ${filter}`)}&prop=imageinfo&iiprop=url|size|extmetadata`
    + "&iiextmetadatafilter=LicenseShortName|Artist&iiurlwidth=400";
  const data = JSON.parse(await fetchText(api, WIKIMEDIA_HEADERS));
  return Object.values((data.query && data.query.pages) || {}).sort((a, b) => a.index - b.index).map((p) => {
    const ii = (p.imageinfo || [])[0];
    if (!ii || !isWebUrl(ii.url)) return null;
    const meta = ii.extmetadata || {};
    // Large photos come as a 1920px copy, not a 50 MB original
    const big = ii.width > 1920 && isWebUrl(ii.thumburl);
    return {
      id: String(p.pageid), title: p.title.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, ""),
      by: stripTags(meta.Artist && meta.Artist.value).slice(0, 60),
      thumb: isWebUrl(ii.thumburl) ? ii.thumburl : ii.url,
      url: big ? ii.thumburl.replace(/\/\d+px-/, "/1920px-") : ii.url,
      page: ii.descriptionurl, site: "Wikimedia",
      licence: licenceFromName(meta.LicenseShortName && meta.LicenseShortName.value)
    };
  }).filter(Boolean);
}

// Openverse adds Flickr and other openly licensed photos; it's often slow, so it arrives late
async function searchOpenverse(q) {
  const res = await net.fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=20&license_type=commercial&mature=false`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(res.status === 429 ? "Too many searches for now" : `HTTP ${res.status}`);
  const data = await res.json();
  return (data.results || []).filter((r) => isWebUrl(r.url)).map((r) => ({
    id: r.id, title: r.title || "Untitled", by: r.creator || "",
    thumb: isWebUrl(r.thumbnail) ? r.thumbnail : "", url: r.url,
    page: isWebUrl(r.foreign_landing_url) ? r.foreign_landing_url : "",
    site: r.source === "flickr" ? "Flickr" : r.source === "wikimedia" ? "Wikimedia" : "Openverse",
    licence: licenceFromName(`${r.license === "cc0" || r.license === "pdm" ? (r.license === "cc0" ? "CC0" : "Public domain") : `CC ${String(r.license || "").toUpperCase()}`} ${r.license_version || ""}`.trim())
  }));
}

// Tenor's search page carries its results as JSON
async function searchTenor(q) {
  const html = await fetchText(`https://tenor.com/search/${querySlug(q)}-gifs`);
  const json = (html.match(/<script id="store-cache" type="text\/x-cache"[^>]*>([\s\S]*?)<\/script>/) || [])[1];
  if (!json) return [];
  const search = (JSON.parse(json).universal || {}).search || {};
  const results = Object.values(search).flatMap((s) => (s && s.results) || []);
  return results.map((g) => {
    const f = g.media_formats || {};
    if (!f.gif || !isWebUrl(f.gif.url)) return null;
    return {
      id: g.id, title: g.h1_title || g.content_description || "GIF", by: (g.user && g.user.username) || "",
      thumb: (f.tinygif || f.gif).url, url: f.gif.url, page: isWebUrl(g.itemurl) ? g.itemurl : "",
      site: "Tenor", licence: CHECK_LICENCE
    };
  }).filter(Boolean).slice(0, 40);
}

const SEARCH_SOURCES = {
  mixkitVideo: (q) => searchMixkit(q, "free-stock-video"),
  mixkitMusic: (q) => searchMixkit(q, "free-stock-music"),
  mixkitSfx: (q) => searchMixkit(q, "free-sound-effects"),
  // Plain YouTube searches return films and vlogs; these words bring back usable clips
  youtubeVideo: (q) => searchYouTube(`${q} stock footage`),
  youtubeMusic: (q) => searchYouTube(`${q} no copyright music`),
  commonsImages: searchCommons,
  openverseImages: searchOpenverse,
  tenor: searchTenor
};

// Answers are kept for ten minutes so switching tabs or searching again is instant
const searchCache = new Map();

function setupSearchHandlers() {
  handleFromApp("search:source", async (_e, source, query) => {
    const q = typeof query === "string" ? query.trim().slice(0, 120) : "";
    if (!q || !Object.hasOwn(SEARCH_SOURCES, source)) return { ok: true, results: [] };
    const key = `${source}|${q.toLowerCase()}`;
    const hit = searchCache.get(key);
    if (hit && Date.now() - hit.time < 10 * 60 * 1000) return { ok: true, results: hit.results };
    try {
      const results = await SEARCH_SOURCES[source](q);
      searchCache.set(key, { time: Date.now(), results });
      if (searchCache.size > 200) searchCache.delete(searchCache.keys().next().value);
      return { ok: true, results };
    } catch (err) {
      return { ok: false, error: err.name === "TimeoutError" ? "took too long to answer" : err.message };
    }
  });

  // Download a media file by its address, e.g. a search result or a copied link
  handleFromApp("media:download-url", (_e, url, opts = {}) => {
    if (!isWebUrl(url)) return { ok: false, error: "Not a web address" };
    const kind = ["image", "video", "audio"].includes(opts.kind) ? opts.kind : "image";
    const referrer = isWebUrl(opts.referrer) ? opts.referrer : "";
    const name = typeof opts.name === "string" ? opts.name.slice(0, 120) : "";
    downloadDirectMedia(url, kind, referrer, name);
    return { ok: true };
  });

  handleFromApp("youtube:playlist", async (_e, url) => {
    if (!isYouTubeUrl(url)) return { ok: false, error: "Not a YouTube link" };
    const list = new URL(url).searchParams.get("list");
    if (!list || !/^[\w-]+$/.test(list)) return { ok: false, error: "This link has no playlist" };
    const res = await runYtDlpJson(["--", `https://www.youtube.com/playlist?list=${list}`]);
    if (!res.ok) return res;
    const entries = (res.data.entries || []).filter((v) => v && /^[\w-]{11}$/.test(v.id)).slice(0, 200).map((v) => ({
      id: v.id,
      title: v.title || "YouTube video",
      duration: Number(v.duration) || 0,
      url: `https://www.youtube.com/watch?v=${v.id}`
    }));
    return { ok: true, title: res.data.title || "Playlist", entries };
  });
}

// Copied a YouTube or media file link anywhere? Offer it in MediaDrop. Read locally only.
const MEDIA_LINK = /^https?:\/\/\S+\.(mp4|mov|m4v|webm|gif|jpe?g|png|webp|mp3|wav|m4a|aiff?)(\?\S*)?$/i;

function classifyLink(text) {
  if (!isWebUrl(text)) return null;
  if (isYouTubeUrl(text)) {
    const u = new URL(text);
    if (/^\/(watch|shorts\/|live\/)/.test(u.pathname) || u.hostname === "youtu.be") return u.searchParams.get("list") ? "youtube-playlist-video" : "youtube";
    if (u.pathname === "/playlist" && u.searchParams.get("list")) return "youtube-playlist";
    return null;
  }
  return MEDIA_LINK.test(text) ? "media" : null;
}

async function startClipboardWatch() {
  const read = async () => { try { return String(await clipboard.readText()).trim(); } catch (e) { return ""; } };
  let last = await read(); // don't offer what was already copied before launch
  setInterval(async () => {
    if (currentSettings.clipboardOffers === false) return;
    const text = await read();
    if (text === last) return;
    last = text;
    if (text.length > 2000) return;
    const kind = classifyLink(text);
    if (kind && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("clipboard-link", { url: text, kind });
  }, 1000);
}

// Every 3 s while MediaDrop is in front, every 10 s otherwise
function startBridgeMonitor() {
  const tick = async () => {
    try {
      const status = await premiereSnapshot();
      lastPremiereOnlineState = status.online;
      if (status.project && pendingImports.length) {
        await flushPendingImports();
        status.pending = pendingImports.length;
      }
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("premiere-status", status);
    } catch (e) {}
    const inFront = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && mainWindow.isFocused();
    setTimeout(tick, inFront ? 3000 : 10000);
  };
  setTimeout(tick, 3000);
}

// ── UPDATES ──────────────────────────────────────────────────────────────────
// Checks GitHub Releases for a newer version. "Update now" downloads this platform's release zip,
// verifies its SHA-256 against the digest GitHub publishes, and runs the bundled installer,
// which replaces the installed app and the Premiere panel, then reopens the app.
const UPDATE_REPO = "robinxprince/MediaDrop";
const UPDATE_ASSET_RE = IS_WIN ? /-windows-x64\.zip$/ : /-mac-apple-silicon\.zip$/;
const INSTALLED_APP = IS_WIN ? path.join(process.env.LOCALAPPDATA || "", "Programs", "MediaDrop") : "/Applications/MediaDrop.app";
const UPDATE_CHECK_INTERVAL = 6 * 60 * 60 * 1000;
let availableUpdate = null;
let updateInProgress = false;

function compareVersions(a, b) {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

// True when this is the copy the installer put in place, which updates and uninstalls act on
function isInstalledCopy() {
  const prefix = INSTALLED_APP + path.sep;
  return IS_WIN ? process.execPath.toLowerCase().startsWith(prefix.toLowerCase()) : process.execPath.startsWith(prefix);
}

async function checkForUpdate() {
  try {
    const res = await net.fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" }
    });
    if (!res.ok) return;
    const release = await res.json();
    const version = String(release.tag_name || "").replace(/^v/, "");
    if (!/^\d+\.\d+\.\d+$/.test(version) || compareVersions(version, app.getVersion()) <= 0) return;
    const asset = (release.assets || []).find((a) => UPDATE_ASSET_RE.test(a.name));
    const digest = asset && /^sha256:([0-9a-f]{64})$/.exec(asset.digest || "");
    if (!asset || !digest || !asset.browser_download_url.startsWith(`https://github.com/${UPDATE_REPO}/releases/download/`)) return;

    availableUpdate = {
      version,
      // The dialog shows plain text, so drop Markdown emphasis, code and heading marks
      notes: String(release.body || "").replace(/\*\*|__|`/g, "").replace(/^#+\s*/gm, "").trim().slice(0, 1200),
      pageUrl: release.html_url,
      assetUrl: asset.browser_download_url,
      sha256: digest[1],
      size: asset.size
    };
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("update-available", { version, size: asset.size });
    }
  } catch (e) {
    console.warn("[MediaDrop] Update check failed:", e.message);
  }
}

function sendUpdateProgress(fields) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("update-progress", fields);
}

function downloadUpdate(url, dest, totalBytes) {
  return new Promise((resolve, reject) => {
    const request = net.request(url);
    request.on("response", (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`GitHub returned HTTP ${response.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      const hash = crypto.createHash("sha256");
      let received = 0, lastPercent = -1;
      response.on("data", (chunk) => {
        hash.update(chunk);
        received += chunk.length;
        const percent = totalBytes ? Math.floor((received / totalBytes) * 100) : 0;
        if (percent !== lastPercent) {
          lastPercent = percent;
          sendUpdateProgress({ phase: "downloading", percent });
        }
      });
      response.on("error", reject);
      file.on("error", reject);
      file.on("finish", () => resolve(hash.digest("hex")));
      response.pipe(file);
    });
    request.on("error", reject);
    request.end();
  });
}

async function installUpdate() {
  const update = availableUpdate;
  if (!update) return { ok: false, error: "No update is available." };
  if (updateInProgress) return { ok: false, error: "The update is already downloading." };
  if (!isInstalledCopy()) {
    return { ok: false, error: IS_WIN
      ? "Updates install only when MediaDrop was installed with Install MediaDrop.cmd."
      : "Updates install only when MediaDrop runs from the Applications folder." };
  }
  updateInProgress = true;
  const workDir = fs.mkdtempSync(path.join(app.getPath("temp"), "mediadrop-update-"));
  try {
    const zipPath = path.join(workDir, "update.zip");
    const digest = await downloadUpdate(update.assetUrl, zipPath, update.size);
    if (digest !== update.sha256) throw new Error("The download is damaged (checksum mismatch). Try again.");

    sendUpdateProgress({ phase: "installing" });
    const extractDir = path.join(workDir, "extracted");
    await extractZip(zipPath, extractDir);
    fs.rmSync(zipPath, { force: true });
    const setupDir = path.join(extractDir, "MediaDrop-Setup");
    const installer = path.join(setupDir, IS_WIN ? "install.ps1" : "Install MediaDrop.command");
    if (!fs.existsSync(installer) || !fs.existsSync(path.join(setupDir, IS_WIN ? "MediaDrop" : "MediaDrop.app"))) {
      throw new Error("The update package is missing its installer.");
    }

    // The installer outlives this process: it waits for MediaDrop to quit, replaces it and reopens it
    const log = fs.openSync(path.join(workDir, "install.log"), "w");
    const [runner, args] = IS_WIN
      ? [path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
        ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", installer, "-Update"]]
      : ["/bin/bash", [installer]];
    cp.spawn(runner, args, { detached: true, windowsHide: true, stdio: ["ignore", log, log], cwd: setupDir }).unref();
    setTimeout(() => app.quit(), 300);
    return { ok: true };
  } catch (e) {
    updateInProgress = false;
    fs.rmSync(workDir, { recursive: true, force: true });
    console.error("[MediaDrop] Update failed:", e);
    return { ok: false, error: e.message };
  }
}

// ── UNINSTALL ────────────────────────────────────────────────────────────────
// Runs the uninstaller that ships inside the app (scripts/mac/uninstall.command, scripts/windows/uninstall.ps1).
// It outlives this process: it waits for MediaDrop to quit, then removes the app and the Premiere panel.
function setupUninstallHandler() {
  handleFromApp("app:uninstall", async () => {
    const script = IS_WIN ? path.join(INSTALLED_APP, "uninstall.ps1") : path.join(process.resourcesPath, "uninstall.command");
    if (!isInstalledCopy() || !fs.existsSync(script)) {
      await dialog.showMessageBox(mainWindow, {
        type: "info",
        message: "This copy of MediaDrop can't uninstall itself",
        detail: IS_WIN
          ? "Uninstall works on the copy that Install MediaDrop.cmd installed."
          : "Uninstall works on the copy in the Applications folder."
      });
      return { ok: false };
    }
    const { response, checkboxChecked } = await dialog.showMessageBox(mainWindow, {
      type: "warning",
      message: "Uninstall MediaDrop?",
      detail: `MediaDrop and its Premiere Pro panel are removed. Your downloaded media stays in ${displayPath(getDownloadDir())}. Restart Premiere Pro afterwards.`,
      checkboxLabel: "Also delete settings and saved logins",
      buttons: ["Uninstall", "Cancel"],
      defaultId: 1,
      cancelId: 1
    });
    if (response !== 0) return { ok: false, cancelled: true };

    const [runner, args] = IS_WIN
      ? [path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
        ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, ...(checkboxChecked ? ["-RemoveData"] : [])]]
      : ["/bin/bash", [script, checkboxChecked ? "--remove-data" : "--keep-data"]];
    cp.spawn(runner, args, { detached: true, windowsHide: true, stdio: "ignore", cwd: app.getPath("temp") }).unref();
    setTimeout(() => app.quit(), 300);
    return { ok: true };
  });
}

// ── BUGS AND FEEDBACK ────────────────────────────────────────────────────────
// Opens the GitHub issue forms (.github/ISSUE_TEMPLATE) in the browser, with the version and computer filled in
const FEEDBACK_FORMS = { bug: "bug_report.yml", feedback: "feedback.yml" };

function setupFeedbackHandler() {
  handleFromApp("app:feedback", (event, kind) => {
    const template = FEEDBACK_FORMS[kind];
    if (!template) return { ok: false };
    const os = IS_WIN ? `Windows ${require("os").release()}` : `macOS ${process.getSystemVersion()}`;
    // Windows on ARM and Rosetta run the x64 build translated, which is worth knowing in a bug report
    const system = `${os}, ${app.runningUnderARM64Translation ? "ARM running the x64 build" : process.arch}`;
    const params = new URLSearchParams({ template, version: app.getVersion() });
    if (kind === "bug") params.set("system", system);
    shell.openExternal(`https://github.com/${UPDATE_REPO}/issues/new?${params}`);
    return { ok: true };
  });
}

function setupUpdateHandlers() {
  // The installer has finished by the time it reopens MediaDrop, so its files from the last update can go
  const tempDir = app.getPath("temp");
  for (const name of fs.readdirSync(tempDir)) {
    // Windows refuses while the installer still has its log open; that copy goes next launch
    if (name.startsWith("mediadrop-update-")) try { fs.rmSync(path.join(tempDir, name), { recursive: true, force: true }); } catch (e) {}
  }

  handleFromApp("update:install", async () => {
    const update = availableUpdate;
    if (!update) return { ok: false, error: "No update is available." };
    const sizeMb = update.size ? ` (${Math.round(update.size / 1e6)} MB)` : "";
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "info",
      message: `Update to MediaDrop ${update.version}?`,
      detail: `${update.notes ? update.notes + "\n\n" : ""}MediaDrop downloads the update${sizeMb}, closes, installs it and reopens. Restart Premiere Pro afterwards to load the updated panel.`,
      buttons: ["Update Now", "Release Notes", "Later"],
      defaultId: 0,
      cancelId: 2
    });
    if (response === 1) shell.openExternal(update.pageUrl);
    if (response !== 0) return { ok: false, cancelled: true };
    return installUpdate();
  });

  setTimeout(checkForUpdate, 5000);
  setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
}

app.whenReady().then(() => {
  // Older builds left all Google/YouTube session cookies in this shared temp file
  removeCookieFile(path.join(app.getPath("temp"), "mediadrop_yt_cookies.txt"));
  loadSettings();
  createWindow();
  setupUnifiedSession();
  setupYouTubeHandlers();
  updateYtDlp();
  setupIpcHandlers();
  setupUpdateHandlers();
  setupUninstallHandler();
  setupFeedbackHandler();
  setupSearchHandlers();
  startBridgeMonitor();
  startClipboardWatch();
  startSurfaceServer();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
