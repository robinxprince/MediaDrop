const csi = (typeof CSInterface !== "undefined") ? new CSInterface() : null;
const nodeRequire = (typeof require === "function") ? require : null;
const fs = nodeRequire && nodeRequire("fs");
const os = nodeRequire && nodeRequire("os");
const path = nodeRequire && nodeRequire("path");

// server.js (the bridge) writes each import here; the MediaDrop app keeps its settings in its own folder
const RECENT_FILE = path && path.join(os.tmpdir(), "mediadrop-recent.json");
const APP_SETTINGS_FILE = MediaDropDesktop && MediaDropDesktop.appSettingsFile;
const POLL_MS = 3000;

const $ = (id) => document.getElementById(id);
const statusDot = $("statusDot");
const statusTitle = $("statusTitle");
const statusText = $("statusText");
const btnOpen = $("btnOpen");

// ── Match Premiere's own panel colour ───────────────────────────────────────
function applyHostTheme() {
  try {
    const c = csi.getHostEnvironment().appSkinInfo.panelBackgroundColor.color;
    const shade = (d) => `rgb(${[c.red, c.green, c.blue].map((v) => Math.round(Math.min(255, v + d))).join(",")})`;
    const root = document.documentElement.style;
    root.setProperty("--ground", shade(0));
    root.setProperty("--surface", shade(10));
    root.setProperty("--raised", shade(20));
  } catch (e) {}
}

// ── Status ──────────────────────────────────────────────────────────────────
function getProject() {
  return new Promise((resolve) => {
    if (!csi) return resolve(null);
    csi.evalScript("getProjectStatus()", (result) => {
      try { resolve(JSON.parse(result)); } catch (e) { resolve(null); }
    });
  });
}

// Talks to the MediaDrop app through Node's http, which sends no Origin header; the app
// rejects browser requests, so web pages can't drive it
function appRequest(urlPath) {
  return new Promise((resolve) => {
    if (!nodeRequire) return resolve(null);
    const req = nodeRequire("http").get("http://127.0.0.1:48201" + urlPath, { timeout: 1500 }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch (e) { resolve(null); } });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

async function isAppRunning() {
  const res = await appRequest("/ping");
  return !!(res && res.ok);
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return fallback; }
}

const ICONS = {
  timeline: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4"/>',
  bin: '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.2h9A1.5 1.5 0 0 1 21 9.7V17.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/>',
  source: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M9 20h6M12 16.5V20M10.5 8.5v4.5l4-2.25z"/>',
  audio: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'
};

// Where the MediaDrop app will put the next download (its "Send downloads to" setting)
function destination(sequence) {
  const mode = (readJson(APP_SETTINGS_FILE, {}) || {}).insertMode || "timeline";
  if (mode === "source") return { icon: "source", target: "Source Monitor" };
  if (mode === "bin") return { icon: "bin", target: "MediaDrop Imports bin" };
  if (!sequence) return { icon: "bin", target: "MediaDrop Imports bin (no sequence open)" };
  return { icon: "timeline", target: `${sequence}, at the playhead` };
}

function setStatus(kind, title, text) {
  statusDot.className = "dot " + kind;
  statusTitle.textContent = title;
  statusText.textContent = text;
}

let appRunning = false;
let routeKey = "";

async function refreshStatus() {
  const [project, running] = await Promise.all([getProject(), isAppRunning()]);
  appRunning = running;
  if (!btnOpen.disabled) btnOpen.textContent = running ? "Show MediaDrop" : "Open MediaDrop";

  const hasProject = project && project.ok;
  $("projVal").textContent = $("projVal").title = hasProject ? project.projectName : "—";
  $("seqVal").textContent = $("seqVal").title = hasProject && project.activeSequence ? project.activeSequence : "None open";

  $("route").hidden = !hasProject;
  if (hasProject) {
    const dest = destination(project.activeSequence);
    if (routeKey !== dest.icon) $("routeIcon").innerHTML = ICONS[dest.icon];
    routeKey = dest.icon;
    $("routeTarget").textContent = $("routeTarget").title = dest.target;
  }

  if (!hasProject) {
    setStatus("attention", "Open a project", "MediaDrop imports into the project open in Premiere Pro.");
  } else if (!running) {
    setStatus("attention", "MediaDrop is closed", "Open it to start finding media for this project.");
  } else if (pendingCount) {
    setStatus("attention", `Importing ${pendingCount} waiting ${pendingCount === 1 ? "download" : "downloads"}`, "They were saved while Premiere wasn't ready.");
  } else {
    setStatus("ready", "Ready to import", "Everything you download lands in this project.");
  }
}

// ── Open the app, optionally on one of its sites ────────────────────────────
function waitForApp(timeoutMs) {
  const until = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const tick = async () => {
      if (await isAppRunning()) return resolve(true);
      if (Date.now() > until) return resolve(false);
      setTimeout(tick, 700);
    };
    tick();
  });
}

async function openApp(site, query) {
  const params = new URLSearchParams();
  if (site) params.set("site", site);
  if (site && query) params.set("q", query);
  const show = () => appRequest(`/show${params.toString() ? "?" + params : ""}`);
  if (await isAppRunning()) return show();
  if (!MediaDropDesktop) return;
  MediaDropDesktop.launchApp(() => {
    setStatus("attention", "MediaDrop isn't installed", `Run ${MediaDropDesktop.installerName} from the download, then try again.`);
  });
  if (site && await waitForApp(20000)) show();
}

btnOpen.addEventListener("click", async () => {
  btnOpen.disabled = true;
  btnOpen.textContent = appRunning ? "Showing…" : "Opening…";
  await openApp(null);
  setTimeout(() => {
    btnOpen.disabled = false;
    refreshStatus();
  }, 1200);
});

// Typed a search? The site buttons search it there; Enter searches YouTube
const searchInput = $("searchInput");
document.querySelectorAll(".start").forEach((btn) => {
  btn.addEventListener("click", () => openApp(btn.dataset.site, searchInput.value.trim()));
});
$("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (searchInput.value.trim()) openApp("youtube", searchInput.value.trim());
});
searchInput.addEventListener("input", () => {
  document.querySelectorAll(".start").forEach((btn) => {
    btn.title = searchInput.value.trim() ? `Search "${searchInput.value.trim()}" on ${btn.textContent.trim()}` : `Open ${btn.textContent.trim()}`;
  });
});

// ── Downloads in progress (read from the MediaDrop app) ─────────────────────
function getDownloads() {
  return appRequest("/downloads");
}

const PHASES = { merging: "Merging", transcoding: "Converting", normalizing: "Converting", remuxing: "Packaging", extracting: "Unzipping" };
let pendingCount = 0;

async function renderDownloads() {
  const data = await getDownloads();
  const active = (data && data.active) || [];
  const pending = (data && data.pending) || [];
  pendingCount = pending.length;
  const rows = active.map((d) => ({ name: d.name, percent: d.percent, label: PHASES[d.phase] })).concat(
    pending.map((name) => ({ name, waiting: true, label: "Waiting for Premiere" })));

  $("downloading").hidden = rows.length === 0;
  $("dlList").replaceChildren(...rows.map((r) => {
    const li = document.createElement("li");
    const known = Number.isFinite(r.percent);
    li.className = "dl-item" + (r.waiting ? " waiting" : known ? "" : " indeterminate");
    li.append(
      Object.assign(document.createElement("span"), { className: "dl-name", textContent: r.name || "Download" }),
      Object.assign(document.createElement("span"), { className: "dl-pct", textContent: r.label || (known ? `${r.percent}%` : "…") })
    );
    const bar = Object.assign(document.createElement("span"), { className: "dl-bar" });
    const fill = document.createElement("span");
    if (known && !r.waiting) fill.style.width = `${r.percent}%`;
    bar.append(fill);
    li.append(bar);
    return li;
  }));
}

// ── Recent imports ──────────────────────────────────────────────────────────
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv)$/i;
const AUDIO_EXT = /\.(wav|mp3|m4a|aac|flac|aiff?|ogg)$/i;

function timeAgo(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString();
}

function fileUrl(file) {
  return "file://" + file.split("/").map(encodeURIComponent).join("/");
}

function iconSvg(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
}

// A real preview of the file: the image itself, or a frame from one second into the video
function makeThumb(file) {
  const thumb = document.createElement("span");
  thumb.className = "thumb";
  const fallback = AUDIO_EXT.test(file || "") ? "audio" : "file";
  thumb.innerHTML = iconSvg(fallback);
  if (!file || !fs || !fs.existsSync(file)) return thumb;

  let media = null;
  if (IMAGE_EXT.test(file)) {
    media = new Image();
    media.src = fileUrl(file);
  } else if (VIDEO_EXT.test(file)) {
    media = document.createElement("video");
    Object.assign(media, { muted: true, preload: "metadata", src: fileUrl(file) + "#t=1" });
  }
  if (media) {
    media.alt = "";
    media.onerror = () => media.remove();
    thumb.append(media);
  }
  return thumb;
}

let recentText = null;
let newestSeen = null;

function renderRecent() {
  if (!fs) return;
  let text = "[]";
  try { text = fs.readFileSync(RECENT_FILE, "utf8"); } catch (e) {}
  const list = $("recentList");

  if (text === recentText) {
    // Same list: only the "x min ago" labels move on
    list.querySelectorAll(".recent-when").forEach((el) => { el.textContent = timeAgo(Number(el.dataset.time)); });
    return;
  }
  recentText = text;

  let items = [];
  try { items = JSON.parse(text); } catch (e) {}
  if (!Array.isArray(items)) items = [];
  const firstRender = newestSeen === null;

  list.replaceChildren(...items.slice(0, 8).map((item, i) => {
    const li = document.createElement("li");
    li.className = "recent-item" + (!firstRender && item.time > newestSeen ? " is-new" : "");
    li.style.animationDelay = firstRender ? `${i * 50}ms` : "0ms";
    li.title = item.file ? `${item.file}\nClick to show in Finder` : item.name || "";

    const words = document.createElement("span");
    words.className = "recent-words";
    words.append(
      Object.assign(document.createElement("span"), { className: "recent-name", textContent: item.name || "Untitled" }),
      Object.assign(document.createElement("span"), { className: "recent-where", textContent: item.where || "" })
    );
    const when = Object.assign(document.createElement("span"), { className: "recent-when", textContent: timeAgo(item.time) });
    when.dataset.time = item.time;

    li.append(makeThumb(item.file), words, when);
    if (item.file && MediaDropDesktop) {
      li.addEventListener("click", () => MediaDropDesktop.reveal(item.file));
    }
    return li;
  }));
  newestSeen = items.length ? items[0].time : 0;
  $("recentEmpty").hidden = items.length > 0;
  $("btnClear").hidden = items.length === 0;
}

$("btnClear").addEventListener("click", () => {
  try { fs.writeFileSync(RECENT_FILE, "[]"); } catch (e) {}
  renderRecent();
});

// ── Start ───────────────────────────────────────────────────────────────────
if (csi) {
  applyHostTheme();
  csi.addEventListener(CSInterface.THEME_COLOR_CHANGED_EVENT, applyHostTheme);
}
refreshStatus();
renderRecent();
renderDownloads();
setInterval(() => {
  refreshStatus();
  renderRecent();
}, POLL_MS);
setInterval(renderDownloads, 1000);
