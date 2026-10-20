// MediaDrop Renderer Application Logic

// ── DOM ELEMENTS ─────────────────────────────────────────────────────────────
const sidebar = document.getElementById("sidebar");
const btnHamburger = document.getElementById("btnHamburger");

const views = {
  envato: document.getElementById("view-envato"),
  youtube: document.getElementById("view-youtube"),
  google: document.getElementById("view-google")
};

let activeTabName = "envato";
let activeView = views.envato;

const urlDisplay = document.getElementById("urlDisplay");
const btnHeaderYtDownload = document.getElementById("btnHeaderYtDownload");
const btnHeaderPlaylist = document.getElementById("btnHeaderPlaylist");
const searchView = document.getElementById("view-search");
const searchQuery = document.getElementById("searchQuery");
const searchForm = document.getElementById("searchForm");

const bridgeStatusPill = document.getElementById("bridgeStatusPill");

const btnAlwaysOnTop = document.getElementById("btnAlwaysOnTop");
const btnSettings = document.getElementById("btnSettings");
const settingsModal = document.getElementById("settingsModal");
const settingsClose = document.getElementById("settingsClose");
const btnSaveSettings = document.getElementById("btnSaveSettings");
const settingInsertMode = document.getElementById("settingInsertMode");
const settingFolderPath = document.getElementById("settingFolderPath");
const btnBrowseFolder = document.getElementById("btnBrowseFolder");
const btnOpenFolder = document.getElementById("btnOpenFolder");
const settingHotkey = document.getElementById("settingHotkey");
const btnRecordHotkey = document.getElementById("btnRecordHotkey");
const settingAlwaysOnTop = document.getElementById("settingAlwaysOnTop");

const bookmarkContextMenu = document.getElementById("bookmarkContextMenu");
const ctxMenuRemove = document.getElementById("ctxMenuRemove");
const ctxMenuCopy = document.getElementById("ctxMenuCopy");
const ctxMenuReload = document.getElementById("ctxMenuReload");

const formatModal = document.getElementById("formatModal");
const modalClose = document.getElementById("modalClose");
const modalVideoTitle = document.getElementById("modalVideoTitle");
const modalUploader = document.getElementById("modalUploader");
const modalThumb = document.getElementById("modalThumb");

const toastTracker = document.getElementById("toastTracker");
const toastIcon = document.getElementById("toastIcon");
const toastTitle = document.getElementById("toastTitle");
const toastSubtitle = document.getElementById("toastSubtitle");
const progressFill = document.getElementById("progressFill");
const toastPercent = document.getElementById("toastPercent");
const toastClose = document.getElementById("toastClose");

const historyDrawer = document.getElementById("historyDrawer");
const historyClose = document.getElementById("historyClose");
const historyList = document.getElementById("historyList");


// ── HAMBURGER MENU & SIDEBAR TOGGLE ──────────────────────────────────────────
btnHamburger.addEventListener("click", () => {
  if (sidebar.classList.contains("collapsed")) {
    sidebar.classList.remove("collapsed");
    sidebar.classList.add("expanded");
  } else {
    sidebar.classList.remove("expanded");
    sidebar.classList.add("collapsed");
  }
});

// ── TAB SWITCHING LOGIC ──────────────────────────────────────────────────────
// "search" is the Search panel; "explore" is a site picked in it, shown under the same search header
function switchTab(targetTab) {
  if (targetTab === activeTabName && (views[targetTab] || targetTab === "search")) return;

  // Unset active class on all sidebar buttons
  document.querySelectorAll(".sidebar-nav .nav-item").forEach(n => n.classList.remove("active"));
  // Hide all webviews
  Object.values(views).forEach(v => v.classList.remove("active"));
  searchView.classList.toggle("active", targetTab === "search");
  searchForm.classList.toggle("hidden", targetTab !== "search" && targetTab !== "explore");
  searchForm.classList.toggle("on-site", targetTab === "explore");

  const targetBtn = document.getElementById(`tab-${targetTab === "explore" ? "search" : targetTab}`);
  if (targetBtn) {
    targetBtn.classList.add("active");
    targetBtn.scrollIntoView({ block: "nearest" });
  }

  activeTabName = targetTab;
  activeView = views[targetTab] || null;
  if (activeView) activeView.classList.add("active");
  if (targetTab === "search") setTimeout(() => searchQuery.focus(), 0);

  try {
    urlDisplay.value = activeView ? (activeView.getURL() || activeView.src || "") : "";
  } catch (e) {
    urlDisplay.value = activeView ? (activeView.src || "") : "";
  }

  updateYouTubeControls();
  updatePinButtonVisibility();
  updateNavButtonsState();
}

// Built-in tab click listeners
document.getElementById("tab-envato").onclick = () => switchTab("envato");
document.getElementById("tab-youtube").onclick = () => switchTab("youtube");
document.getElementById("tab-google").onclick = () => switchTab("google");
// Search returns to the site picked in it, if one is open
document.getElementById("tab-search").onclick = () => switchTab(search.site !== "all" && !search.site.startsWith("pick:") && views.explore ? "explore" : "search");
// The Premiere panel opens a site, optionally searching it: { site: "youtube", query: "drone city" }
const SEARCH_URLS = {
  youtube: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  envato: (q) => `https://elements.envato.com/stock-video/${encodeURIComponent(q.trim().toLowerCase().replace(/\s+/g, "-"))}`,
  google: (q) => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`
};
window.api.onOpenSite(({ site, query } = {}) => {
  if (!views[site]) return;
  switchTab(site);
  if (query) views[site].loadURL(SEARCH_URLS[site](query));
});

// Sidebar bottom utilities
document.getElementById("btnSidebarDownloads").onclick = () => {
  window.api.openDownloadsFolder();
};

document.getElementById("btnSidebarHistory").onclick = () => {
  closePremierePopover();
  historyDrawer.classList.toggle("hidden");
  if (!historyDrawer.classList.contains("hidden")) {
    renderHistory();
    historySearch.focus();
  }
};

// ── CUSTOM BOOKMARKS & ANY WEBSITE PINNING ───────────────────────────────────
const customTabsNav = document.getElementById("customTabsNav");
const btnAddWebsite = document.getElementById("btnAddWebsite");
const btnPinCurrent = document.getElementById("btnPinCurrent");
const addSiteModal = document.getElementById("addSiteModal");
const addSiteClose = document.getElementById("addSiteClose");
const addSiteForm = document.getElementById("addSiteForm");
const siteUrlInput = document.getElementById("siteUrlInput");
const viewport = document.querySelector(".browser-viewport");

const DEFAULT_PRESETS = [
  { id: "preset_pexels", title: "Pexels", url: "https://www.pexels.com/", domain: "pexels.com" }
];

function getSavedBookmarks() {
  try {
    const raw = localStorage.getItem("mediadrop_bookmarks");
    if (raw !== null) {
      return JSON.parse(raw);
    }
    return DEFAULT_PRESETS;
  } catch (e) {
    return DEFAULT_PRESETS;
  }
}

function saveBookmarks(list) {
  try {
    localStorage.setItem("mediadrop_bookmarks", JSON.stringify(list));
  } catch (e) {}
}

let customBookmarks = getSavedBookmarks();

// Page titles, filenames and yt-dlp output are controlled by websites; escape them
// before interpolating into innerHTML so they can't inject markup into the app UI.
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

function extractDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch (e) {
    return url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split("/")[0].split("?")[0];
  }
}


function createCustomWebview(id, url) {
  let wv = document.getElementById(`view-${id}`);
  if (!wv) {
    wv = document.createElement("webview");
    wv.id = `view-${id}`;
    wv.src = url;
    wv.homeUrl = url;
    wv.partition = "persist:mediadrop";
    viewport.appendChild(wv);

    const handleNav = (navUrl) => {
      if (wv === activeView) {
        urlDisplay.value = navUrl || "";
        updateYouTubeControls();
        updatePinButtonVisibility();
        updateNavButtonsState();
      }
    };

    wv.addEventListener("did-navigate", (e) => handleNav(e.url));
    wv.addEventListener("did-navigate-in-page", (e) => handleNav(e.url));
    wv.addEventListener("dom-ready", () => {
      if (wv === activeView) updateNavButtonsState();
    });
    wv.addEventListener("ipc-message", handleGuestMessage);
    wv.addEventListener("page-title-updated", (e) => {
      if (wv === activeView) {
        updatePinButtonVisibility();
        updateNavButtonsState();
      }
      const bm = customBookmarks.find(b => b.id === id);
      if (bm && (!bm.title || bm.title === bm.domain)) {
        bm.title = e.title.slice(0, 24);
        saveBookmarks(customBookmarks);
        renderCustomTabs();
      }
    });

    views[id] = wv;
  }
  return wv;
}

function renderCustomTabs() {
  customTabsNav.innerHTML = "";

  customBookmarks.forEach(bm => {
    createCustomWebview(bm.id, bm.url);

    const btn = document.createElement("button");
    btn.className = `nav-item custom-tab ${activeTabName === bm.id ? "active" : ""}`;
    btn.dataset.tab = bm.id;
    btn.id = `tab-${bm.id}`;
    btn.title = `${bm.title} (${bm.domain}) - Drag to reorder, right-click for options`;
    btn.draggable = true;

    const iconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(bm.domain)}&sz=64`;
    const initial = (bm.title || bm.domain || "W").charAt(0).toUpperCase();

    btn.innerHTML = `
      <div class="nav-icon-box">
        <img class="custom-tab-icon" draggable="false" src="${escapeHtml(iconUrl)}" alt="${escapeHtml(bm.title)}" 
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
        <div class="custom-tab-badge" style="display:none;">${escapeHtml(initial)}</div>
      </div>
      <span class="nav-label">${escapeHtml(bm.title)}</span>
    `;

    btn.addEventListener("click", () => {
      switchTab(bm.id);
    });

    // Right-click opens custom context menu (Fixes accidental deletion on hover!)
    btn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openBookmarkContextMenu(e.clientX, e.clientY, bm);
    });

    customTabsNav.appendChild(btn);
  });
}

// ── SIDEBAR ORDER: drag sites up or down; the order is remembered ───────────
const sidebarNav = document.querySelector(".sidebar-nav");
const BUILTIN_ORDER_KEY = "mediadrop_builtin_order";

function applyBuiltinOrder() {
  let order = [];
  try { order = JSON.parse(localStorage.getItem(BUILTIN_ORDER_KEY)) || []; } catch (e) {}
  const divider = sidebarNav.querySelector(".sidebar-divider");
  order.forEach((id) => {
    const btn = document.getElementById(`tab-${id}`);
    if (btn && btn.parentElement === sidebarNav) sidebarNav.insertBefore(btn, divider);
  });
}

// Lets the site buttons directly inside `container` be dragged into a new order
function makeSortable(container, onReorder) {
  let dragged = null;
  const itemAt = (target) => {
    const item = target.closest && target.closest(".nav-item[data-tab]");
    return item && item.parentElement === container ? item : null;
  };
  container.addEventListener("dragstart", (e) => {
    const item = itemAt(e.target);
    if (!item) return;
    dragged = item;
    item.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  container.addEventListener("dragover", (e) => {
    if (!dragged) return;
    e.preventDefault();
    const over = itemAt(e.target);
    if (!over || over === dragged) return;
    const box = over.getBoundingClientRect();
    container.insertBefore(dragged, e.clientY < box.top + box.height / 2 ? over : over.nextSibling);
  });
  container.addEventListener("drop", (e) => { if (dragged) e.preventDefault(); });
  container.addEventListener("dragend", () => {
    if (!dragged) return;
    dragged.classList.remove("dragging");
    dragged = null;
    onReorder([...container.children].filter((el) => el.matches(".nav-item[data-tab]")).map((el) => el.dataset.tab));
  });
}

applyBuiltinOrder();
makeSortable(sidebarNav, (ids) => {
  try { localStorage.setItem(BUILTIN_ORDER_KEY, JSON.stringify(ids)); } catch (e) {}
});
makeSortable(customTabsNav, (ids) => {
  customBookmarks = ids.map((id) => customBookmarks.find((b) => b.id === id)).filter(Boolean);
  saveBookmarks(customBookmarks);
});

function addBookmark(title, url) {
  if (!url) return;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  const domain = extractDomain(url);

  // If already pinned, switch directly to it
  const existing = customBookmarks.find(b => b.domain === domain || b.url === url);
  if (existing) {
    switchTab(existing.id);
    showNotice(`"${existing.title}" is already in sidebar`, "📌");
    return;
  }

  const cleanTitle = title || domain.split(".")[0].toUpperCase();
  const id = "custom_" + Date.now().toString(36);

  customBookmarks.push({ id, title: cleanTitle, url, domain });
  saveBookmarks(customBookmarks);
  renderCustomTabs();
  switchTab(id);

  showNotice(`"${cleanTitle}" pinned to sidebar`, "📌");
}

function removeBookmark(id) {
  const bm = customBookmarks.find(b => b.id === id);
  customBookmarks = customBookmarks.filter(b => b.id !== id);
  saveBookmarks(customBookmarks);

  const wv = document.getElementById(`view-${id}`);
  if (wv) wv.remove();
  delete views[id];

  renderCustomTabs();

  if (activeTabName === id) {
    switchTab("envato");
  }

  showNotice(bm ? `Removed "${bm.title}"` : "Removed bookmark", "✕");
}

function updatePinButtonVisibility() {
  let curUrl = "";
  try {
    curUrl = activeView ? (activeView.getURL() || activeView.src || "") : "";
  } catch (e) {}

  if (!curUrl || curUrl === "about:blank") {
    btnPinCurrent.classList.add("hidden");
    return;
  }

  const curDomain = extractDomain(curUrl);
  const isPinned = customBookmarks.some(b => b.domain === curDomain);
  const isBuiltIn = curDomain.includes("envato.com") || curDomain.includes("youtube.com") || curDomain === "google.com";

  if (!isPinned && !isBuiltIn) {
    btnPinCurrent.classList.remove("hidden");
    const pinText = btnPinCurrent.querySelector("span");
    if (pinText) pinText.textContent = `Pin ${curDomain}`;
  } else {
    btnPinCurrent.classList.add("hidden");
  }
}

btnPinCurrent.onclick = () => {
  let curUrl = "";
  let curTitle = "";
  try {
    curUrl = activeView.getURL() || "";
    curTitle = activeView.getTitle() || "";
  } catch (e) {}

  if (!curUrl) return;
  const domain = extractDomain(curUrl);
  const title = curTitle ? curTitle.split(/[-–|]/)[0].trim().slice(0, 24) : domain;
  addBookmark(title, curUrl);
};

// ── CLEAN GOOGLE SEARCH PANEL ────────────────────────────────────────────────
btnAddWebsite.onclick = () => {
  addSiteModal.classList.remove("hidden");
  siteUrlInput.value = "";
  setTimeout(() => siteUrlInput.focus(), 80);
};

addSiteClose.onclick = () => {
  addSiteModal.classList.add("hidden");
};

addSiteForm.onsubmit = (e) => {
  e.preventDefault();
  let input = siteUrlInput.value.trim();
  if (!input) return;

  const shouldPin = document.getElementById("chkPinToSidebar")?.checked ?? true;
  addSiteModal.classList.add("hidden");

  // If input looks like a web address (e.g. pexels.com, https://...)
  if (input.includes(".") && !input.includes(" ")) {
    if (!input.startsWith("http://") && !input.startsWith("https://")) {
      input = "https://" + input;
    }
    const domain = extractDomain(input);
    const name = domain.split(".")[0];
    const title = name.charAt(0).toUpperCase() + name.slice(1);
    if (shouldPin) {
      addBookmark(title, input);
    } else {
      views.google.loadURL(input);
      switchTab("google");
    }
  } else {
    // Open as Google search query
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(input)}`;
    if (shouldPin) {
      addBookmark(`Search: ${input.slice(0, 16)}`, searchUrl);
    } else {
      views.google.loadURL(searchUrl);
      switchTab("google");
    }
  }
};

// ── BOOKMARK RIGHT-CLICK CONTEXT MENU ────────────────────────────────────────
let contextMenuTargetBm = null;

function openBookmarkContextMenu(x, y, bm) {
  contextMenuTargetBm = bm;
  if (!bookmarkContextMenu) return;
  const menuWidth = 190;
  const menuHeight = 120;
  const posX = Math.min(x, window.innerWidth - menuWidth - 8);
  const posY = Math.min(y, window.innerHeight - menuHeight - 8);
  bookmarkContextMenu.style.left = `${posX}px`;
  bookmarkContextMenu.style.top = `${posY}px`;
  bookmarkContextMenu.classList.remove("hidden");
}

function closeBookmarkContextMenu() {
  if (bookmarkContextMenu) {
    bookmarkContextMenu.classList.add("hidden");
  }
  contextMenuTargetBm = null;
}

if (ctxMenuRemove) {
  ctxMenuRemove.onclick = () => {
    if (contextMenuTargetBm) {
      removeBookmark(contextMenuTargetBm.id);
    }
    closeBookmarkContextMenu();
  };
}

if (ctxMenuCopy) {
  ctxMenuCopy.onclick = async () => {
    if (contextMenuTargetBm && contextMenuTargetBm.url) {
      try {
        await navigator.clipboard.writeText(contextMenuTargetBm.url);
        showNotice("URL Copied to Clipboard", "📋");
      } catch (e) {}
    }
    closeBookmarkContextMenu();
  };
}

if (ctxMenuReload) {
  ctxMenuReload.onclick = () => {
    if (contextMenuTargetBm && views[contextMenuTargetBm.id]) {
      try {
        views[contextMenuTargetBm.id].reload();
      } catch (e) {}
    }
    closeBookmarkContextMenu();
  };
}

window.addEventListener("click", () => closeBookmarkContextMenu());
window.addEventListener("contextmenu", (e) => {
  if (!e.target.closest(".custom-tab")) {
    closeBookmarkContextMenu();
  }
});

// ── SETTINGS & ALWAYS-ON-TOP ─────────────────────────────────────────────────
let appSettings = {
  downloadFolder: "",
  insertMode: "timeline",
  hotkey: "CommandOrControl+Shift+M",
  alwaysOnTop: false,
  binsByType: true,
  importSound: true,
  saveLocation: "folder",
  clipboardOffers: true
};

// ── SLEEK MINIMAL FLOATING NOTIFICATION PILL ────────────────────────────────
let noticeTimeout = null;
function showNotice(text, icon = "✓") {
  const minimalNotice = document.getElementById("minimalNotice");
  const noticeIcon = document.getElementById("noticeIcon");
  const noticeText = document.getElementById("noticeText");
  if (!minimalNotice || !noticeText) return;

  clearTimeout(noticeTimeout);
  if (noticeIcon) noticeIcon.textContent = icon;
  noticeText.textContent = text;

  minimalNotice.classList.remove("hidden");
  noticeTimeout = setTimeout(() => {
    minimalNotice.classList.add("hidden");
  }, 1900);
}

const DEFAULT_HOTKEY = "CommandOrControl+Shift+M";
const HOTKEY_HINT = "Brings MediaDrop up from any app";
const KEY_SYMBOLS = { CommandOrControl: "⌘", Control: "⌃", Alt: "⌥", Shift: "⇧" };
const PUNCTUATION_KEYS = {
  Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backslash: "\\",
  BracketLeft: "[", BracketRight: "]", Minus: "-", Equal: "=", Backquote: "`"
};

function renderHotkey(shortcut) {
  settingHotkey.replaceChildren(...(shortcut || DEFAULT_HOTKEY).split("+").map((part) => {
    const kbd = document.createElement("kbd");
    kbd.textContent = KEY_SYMBOLS[part] || part;
    return kbd;
  }));
}

function setHotkeyHint(text = HOTKEY_HINT, kind = "") {
  hotkeyHint.textContent = text;
  hotkeyHint.className = kind ? `set-desc is-${kind}` : "set-desc";
}

// Electron accelerator name for the physical key (e.key would give "µ" for Option+M)
function acceleratorKey(code) {
  const m = /^(?:Key|Digit)([A-Z0-9])$/.exec(code);
  if (m) return m[1];
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  if (code.startsWith("Arrow")) return code.slice(5);
  if (["Space", "Home", "End", "PageUp", "PageDown"].includes(code)) return code;
  return PUNCTUATION_KEYS[code] || null;
}

async function loadAppSettings() {
  if (window.api && typeof window.api.getSettings === "function") {
    try {
      const data = await window.api.getSettings();
      if (data) {
        appSettings = { ...appSettings, ...data };
        updateSettingsUI();
      }
    } catch (e) {
      console.warn("Could not load settings:", e);
    }
  }
}

function updateSettingsUI() {
  if (settingInsertMode) settingInsertMode.value = appSettings.insertMode || "timeline";
  if (settingFolderPath) {
    const folder = appSettings.downloadFolder || "";
    settingFolderPath.textContent = folder ? folder.replace(/^\/Users\/[^/]+/, "~") : "~/Downloads/MediaDrop_Imports";
    settingFolderPath.title = folder;
  }
  if (settingHotkey) renderHotkey(appSettings.hotkey);
  if (settingAlwaysOnTop) settingAlwaysOnTop.checked = Boolean(appSettings.alwaysOnTop);
  settingBinsByType.checked = appSettings.binsByType !== false;
  settingImportSound.checked = appSettings.importSound !== false;
  settingClipboard.checked = appSettings.clipboardOffers !== false;
  settingSaveLocation.value = appSettings.saveLocation === "project" ? "project" : "folder";
  const preset = getYtPreset();
  settingYtPreset.textContent = ytPresetSummary(preset);
  btnForgetYtPreset.classList.toggle("hidden", !preset);
  if (premiere.checked) updateBridgeUI({});
  if (btnAlwaysOnTop) {
    if (appSettings.alwaysOnTop) {
      btnAlwaysOnTop.classList.add("pinned");
      btnAlwaysOnTop.setAttribute("title", "Always on Top: ON (Click to unpin)");
    } else {
      btnAlwaysOnTop.classList.remove("pinned");
      btnAlwaysOnTop.setAttribute("title", "Always on Top: OFF (Click to pin)");
    }
  }
}

if (btnAlwaysOnTop) {
  btnAlwaysOnTop.onclick = async () => {
    if (window.api && typeof window.api.toggleAlwaysOnTop === "function") {
      const nextVal = await window.api.toggleAlwaysOnTop(!appSettings.alwaysOnTop);
      appSettings.alwaysOnTop = nextVal;
      updateSettingsUI();
      showNotice(nextVal ? "Pinned Always on Top" : "Unpinned Window", nextVal ? "📌" : "🔓");
    }
  };
}

// Edits apply on Save; Cancel, Esc and clicking outside restore what was there.
// The folder is the exception: the native picker saves it straight away.
let settingsSnapshot = null;
let isRecordingHotkey = false;
const btnResetHotkey = document.getElementById("btnResetHotkey");
const hotkeyHint = document.getElementById("hotkeyHint");

function stopRecordingHotkey() {
  isRecordingHotkey = false;
  btnRecordHotkey.classList.remove("recording");
  renderHotkey(appSettings.hotkey);
}

function openSettings() {
  settingsSnapshot = {
    insertMode: appSettings.insertMode,
    hotkey: appSettings.hotkey,
    alwaysOnTop: appSettings.alwaysOnTop,
    binsByType: appSettings.binsByType,
    importSound: appSettings.importSound,
    saveLocation: appSettings.saveLocation,
    clipboardOffers: appSettings.clipboardOffers
  };
  premierePopover.classList.add("hidden");
  stopRecordingHotkey();
  setHotkeyHint();
  updateSettingsUI();
  settingsModal.classList.remove("hidden");
}

function closeSettings() {
  if (settingsSnapshot) Object.assign(appSettings, settingsSnapshot);
  settingsSnapshot = null;
  stopRecordingHotkey();
  updateSettingsUI();
  settingsModal.classList.add("hidden");
}

btnSettings.onclick = openSettings;
settingsClose.onclick = closeSettings;
document.getElementById("settingsCancel").onclick = closeSettings;
settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) closeSettings();
});

btnBrowseFolder.onclick = async () => {
  const chosen = await window.api.selectDownloadFolder();
  if (chosen) {
    appSettings.downloadFolder = chosen;
    updateSettingsUI();
  }
};

btnOpenFolder.onclick = () => window.api.openDownloadsFolder();

btnResetHotkey.onclick = () => {
  appSettings.hotkey = DEFAULT_HOTKEY;
  stopRecordingHotkey();
  setHotkeyHint();
};

btnRecordHotkey.onclick = () => {
  if (isRecordingHotkey) {
    stopRecordingHotkey();
    setHotkeyHint();
    return;
  }
  isRecordingHotkey = true;
  btnRecordHotkey.classList.add("recording");
  settingHotkey.textContent = "Press keys…";
  setHotkeyHint("Press any key or combination. Esc cancels.", "active");
};

window.addEventListener("keydown", (e) => {
  if (!isRecordingHotkey) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.key === "Escape") {
    stopRecordingHotkey();
    setHotkeyHint();
    return;
  }
  if (["Meta", "Control", "Shift", "Alt", "Tab"].includes(e.key)) return;

  const key = acceleratorKey(e.code);
  if (!key) {
    setHotkeyHint("That key can't be used in a shortcut. Try a letter or number.", "error");
    return;
  }
  const modifiers = [];
  if (e.metaKey) modifiers.push("CommandOrControl");
  if (e.ctrlKey) modifiers.push("Control");
  if (e.altKey) modifiers.push("Alt");
  if (e.shiftKey) modifiers.push("Shift");
  appSettings.hotkey = [...modifiers, key].join("+");
  stopRecordingHotkey();
  // Without ⌘, ⌃ or ⌥ the key stops typing in other apps while MediaDrop runs; allowed, but say so
  const blocksTyping = !e.metaKey && !e.ctrlKey && !e.altKey && !/^F\d+$/.test(key);
  if (blocksTyping) setHotkeyHint("Works, but while MediaDrop is open this key won't type in other apps.", "warning");
  else setHotkeyHint();
}, true);

settingInsertMode.onchange = () => {
  appSettings.insertMode = settingInsertMode.value;
};

settingAlwaysOnTop.onchange = () => {
  appSettings.alwaysOnTop = settingAlwaysOnTop.checked;
};

const settingBinsByType = document.getElementById("settingBinsByType");
const settingImportSound = document.getElementById("settingImportSound");
const settingYtPreset = document.getElementById("settingYtPreset");
const btnForgetYtPreset = document.getElementById("btnForgetYtPreset");
settingBinsByType.onchange = () => { appSettings.binsByType = settingBinsByType.checked; };
settingImportSound.onchange = () => { appSettings.importSound = settingImportSound.checked; };
const settingClipboard = document.getElementById("settingClipboard");
const settingSaveLocation = document.getElementById("settingSaveLocation");
settingClipboard.onchange = () => { appSettings.clipboardOffers = settingClipboard.checked; };
settingSaveLocation.onchange = () => { appSettings.saveLocation = settingSaveLocation.value; };
btnForgetYtPreset.onclick = () => {
  setYtPreset(null);
  updateSettingsUI();
};

btnSaveSettings.onclick = async () => {
  stopRecordingHotkey();
  const saved = await window.api.saveSettings(appSettings);
  appSettings = { ...appSettings, ...saved };
  settingsSnapshot = null;
  updateSettingsUI();
  settingsModal.classList.add("hidden");
  showNotice("Settings saved", "✓");
};

// Modal Backdrop Dismiss
[addSiteModal, formatModal].forEach(modal => {
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.add("hidden");
      }
    });
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeBookmarkContextMenu();
    if (addSiteModal && !addSiteModal.classList.contains("hidden")) addSiteModal.classList.add("hidden");
    if (!settingsModal.classList.contains("hidden")) closeSettings();
    if (formatModal && !formatModal.classList.contains("hidden")) formatModal.classList.add("hidden");
    if (historyDrawer && !historyDrawer.classList.contains("hidden")) historyDrawer.classList.add("hidden");
  }
});

// ── GUEST WEBVIEW MESSAGES (from renderer/universal-preload.js) ─────────────
function handleGuestMessage(event) {
  const payload = event.args[0];
  if (event.channel === "mediadrop-mouse-nav") {
    if (payload === "back") handleNavBack();
    else if (payload === "forward") handleNavForward();
  } else if (event.channel === "youtube-import-trigger" && payload && payload.url) {
    requestYouTubeDownload(payload.url, payload.title);
  }
}

// ── WEBVIEW SETUP & NAVIGATION EVENTS ────────────────────────────────────────
function setupWebviews() {
  views.envato.homeUrl = "https://elements.envato.com/";
  views.youtube.homeUrl = "https://www.youtube.com/";
  views.google.homeUrl = "https://www.google.com/";

  Object.entries(views).forEach(([name, webview]) => {
    const handleNav = (url) => {
      if (webview === activeView) {
        urlDisplay.value = url || "";
        updateYouTubeControls();
        updatePinButtonVisibility();
        updateNavButtonsState();
      }
    };

    webview.addEventListener("did-navigate", (e) => handleNav(e.url));
    webview.addEventListener("did-navigate-in-page", (e) => handleNav(e.url));
    webview.addEventListener("dom-ready", () => {
      if (webview === activeView) updateNavButtonsState();
    });

    webview.addEventListener("page-title-updated", () => {
      updateYouTubeControls();
      updatePinButtonVisibility();
      if (webview === activeView) updateNavButtonsState();
    });

    webview.addEventListener("ipc-message", handleGuestMessage);
  });

  renderCustomTabs();
}

// ── BROWSER CONTROLS & MOUSE BUTTON NAVIGATION ───────────────────────────────
let lastNavTime = 0;

function handleNavBack() {
  const now = Date.now();
  if (now - lastNavTime < 200) return false;
  lastNavTime = now;
  try {
    if (activeView && activeView.canGoBack()) {
      activeView.goBack();
      setTimeout(updateNavButtonsState, 150);
      return true;
    }
  } catch (e) {}
  return false;
}

function handleNavForward() {
  const now = Date.now();
  if (now - lastNavTime < 200) return false;
  lastNavTime = now;
  try {
    if (activeView && activeView.canGoForward()) {
      activeView.goForward();
      setTimeout(updateNavButtonsState, 150);
      return true;
    }
  } catch (e) {}
  return false;
}

function updateNavButtonsState() {
  const btnBack = document.getElementById("navBack");
  const btnForward = document.getElementById("navForward");
  if (!btnBack || !btnForward) return;
  try {
    const canBack = Boolean(activeView && activeView.canGoBack());
    const canForward = Boolean(activeView && activeView.canGoForward());
    btnBack.style.opacity = canBack ? "1" : "0.35";
    btnBack.style.cursor = canBack ? "pointer" : "default";
    btnForward.style.opacity = canForward ? "1" : "0.35";
    btnForward.style.cursor = canForward ? "pointer" : "default";
  } catch (e) {}
}

document.getElementById("navBack").onclick = () => handleNavBack();
document.getElementById("navForward").onclick = () => handleNavForward();

document.getElementById("navReload").onclick = () => {
  try { activeView.reload(); } catch (e) {}
};

document.getElementById("navHome").onclick = () => {
  try { activeView.loadURL(activeView.homeUrl); } catch (e) {}
};

// 1. Mouse Button 3 (Back) and Button 4 (Forward) on Host Window
function checkHostMouseNav(e) {
  if (e.button === 3) {
    e.preventDefault();
    e.stopPropagation();
    handleNavBack();
  } else if (e.button === 4) {
    e.preventDefault();
    e.stopPropagation();
    handleNavForward();
  }
}

window.addEventListener("mouseup", checkHostMouseNav, true);
window.addEventListener("auxclick", checkHostMouseNav, true);

// 2. Hardware / Driver mouse navigation from Electron Main process (app-command)
if (window.api && typeof window.api.onMouseNav === "function") {
  window.api.onMouseNav((direction) => {
    if (direction === "back") handleNavBack();
    else if (direction === "forward") handleNavForward();
  });
}

// 3. Browser-standard keyboard navigation shortcuts (Cmd+[, Cmd+], Alt+Left, Alt+Right)
window.addEventListener("keydown", (e) => {
  const isInput = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if (isInput) return;

  // macOS Cmd+[ or Cmd+Left or Alt+Left (Back)
  const isBack = ((e.metaKey || e.ctrlKey) && (e.key === "[" || e.key === "ArrowLeft")) || (e.altKey && e.key === "ArrowLeft");
  // macOS Cmd+] or Cmd+Right or Alt+Right (Forward)
  const isForward = ((e.metaKey || e.ctrlKey) && (e.key === "]" || e.key === "ArrowRight")) || (e.altKey && e.key === "ArrowRight");

  if (isBack) {
    e.preventDefault();
    handleNavBack();
  } else if (isForward) {
    e.preventDefault();
    handleNavForward();
  }
});

// Allow user to paste a URL and press Enter
urlDisplay.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    let input = urlDisplay.value.trim();
    if (!input) return;
    if (!activeView) return runSearch(input);
    if (!input.startsWith("http://") && !input.startsWith("https://")) {
      input = "https://" + input;
    }
    activeView.loadURL(input);
  }
});

// ── YOUTUBE DOWNLOAD CONTROLS ────────────────────────────────────────────────
function isYouTubeVideoUrl(url) {
  if (!url || typeof url !== "string") return false;
  return url.includes("/watch") || url.includes("/shorts/") || url.includes("youtu.be/");
}

function updateYouTubeControls(explicitUrl) {
  let currentUrl = explicitUrl || "";
  let currentTitle = "";
  try {
    if (activeView && typeof activeView.getURL === "function") {
      currentUrl = currentUrl || activeView.getURL() || "";
      currentTitle = (activeView.getTitle() || "").replace(/ - YouTube$/, "");
    }
  } catch (e) {}

  if (!currentUrl && urlDisplay) {
    currentUrl = urlDisplay.value || "";
  }

  const isYtTab = activeTabName === "youtube" || (currentUrl && (currentUrl.includes("youtube.com") || currentUrl.includes("youtu.be")));
  const isVideo = isYouTubeVideoUrl(currentUrl);

  btnHeaderPlaylist.classList.toggle("hidden", !(isYtTab && /[?&]list=[\w-]+/.test(currentUrl)));
  if (isYtTab && isVideo) {
    // Both Header Download Button and Floating Banner appear when an active video is loaded
    btnHeaderYtDownload.classList.remove("hidden");
  } else {
    // Hidden on search results, channels, and feeds (video cards have individual quick-import buttons)
    btnHeaderYtDownload.classList.add("hidden");
  }
}

// Polling interval ensures YouTube SPA pushState changes are caught instantly
setInterval(() => {
  if (activeTabName === "youtube" || (urlDisplay && (urlDisplay.value.includes("youtube.com") || urlDisplay.value.includes("youtu.be")))) {
    updateYouTubeControls();
  }
}, 1200);

// Header Download Button Action
// ⌥-click always opens the options, even with saved settings
btnHeaderYtDownload.onclick = (e) => {
  handleYouTubeDownloadTrigger(e.altKey);
};

function handleYouTubeDownloadTrigger(showOptions = false) {
  let url = "";
  let title = "YouTube Video";

  try {
    if (activeView && typeof activeView.getURL === "function") {
      url = activeView.getURL() || "";
      title = (activeView.getTitle() || "YouTube Video").replace(/ - YouTube$/, "").trim();
    }
  } catch (e) {}

  if (!url || (!url.includes("youtube.com") && !url.includes("youtu.be"))) {
    if (urlDisplay && urlDisplay.value && (urlDisplay.value.includes("youtube.com") || urlDisplay.value.includes("youtu.be"))) {
      url = urlDisplay.value.trim();
    }
  }

  // If on homepage or search, ask or prompt for current video
  if (!isYouTubeVideoUrl(url)) {
    const inputUrl = prompt("Enter or paste YouTube Video URL to ingest directly into Premiere:", isYouTubeVideoUrl(urlDisplay.value) ? urlDisplay.value : "");
    if (inputUrl && inputUrl.trim()) {
      requestYouTubeDownload(inputUrl.trim(), "YouTube Video", showOptions);
    }
    return;
  }

  requestYouTubeDownload(url, title, showOptions);
}

// ── SAVED YOUTUBE SETTINGS ───────────────────────────────────────────────────
// "Use these settings next time" skips the dialog: the closest match to the saved
// quality and codec is picked automatically.
const YT_PRESET_KEY = "mediadrop_yt_preset";

function getYtPreset() {
  try { return JSON.parse(localStorage.getItem(YT_PRESET_KEY)) || null; } catch (e) { return null; }
}

function setYtPreset(preset) {
  try {
    if (preset) localStorage.setItem(YT_PRESET_KEY, JSON.stringify(preset));
    else localStorage.removeItem(YT_PRESET_KEY);
  } catch (e) {}
  updateYtButtonTitle();
}

function ytPresetSummary(p) {
  if (!p) return "Ask for quality and format every time";
  if (p.mode === "audio") return `Always ${String(p.audioFormat).toUpperCase()} audio. ⌥-click Download to change`;
  const out = VIDEO_OUTPUTS[p.output] || VIDEO_OUTPUTS.mp4;
  return `Up to ${p.quality}p ${p.codec} → ${out.short}${p.includeAudio ? "" : ", no audio"}. ⌥-click Download to change`;
}

function updateYtButtonTitle() {
  btnHeaderYtDownload.title = getYtPreset()
    ? "Download with your saved settings. ⌥-click to choose quality and format"
    : "Choose a format and import this video into Premiere Pro";
}

// Highest stream at or below the saved quality, preferring the saved codec
function pickSavedStream(videos, p) {
  const fits = videos.filter((v) => v.quality <= p.quality);
  const pool = fits.length ? fits : [videos[videos.length - 1]];
  const sameCodec = pool.filter((v) => v.codec === p.codec);
  return (sameCodec.length ? sameCodec : pool).slice().sort((a, b) => b.quality - a.quality || b.fps - a.fps)[0];
}

// yt-dlp's wording → what to do about it
function friendlyYouTubeError(message) {
  const m = String(message || "");
  if (/not a bot|sign in to confirm/i.test(m)) return "YouTube wants you to sign in. Sign in on the YouTube tab, then try again.";
  if (/private video/i.test(m)) return "This video is private.";
  if (/members-only|join this channel/i.test(m)) return "This video is for channel members only.";
  if (/age/i.test(m) && /restrict|confirm your age/i.test(m)) return "This video is age-restricted. Sign in on the YouTube tab, then try again.";
  if (/unavailable|removed|does not exist/i.test(m)) return "This video isn't available.";
  if (/timed out|network|connection|getaddrinfo/i.test(m)) return "Couldn't reach YouTube. Check your internet connection and try again.";
  return m || "Something went wrong.";
}

async function requestYouTubeDownload(url, title, showOptions = false) {
  const preset = getYtPreset();
  if (!preset || showOptions) return openYouTubeFormatModal(url, title);
  return downloadWithPreset(url, title, preset);
}

// Picks the stream closest to the preset and downloads it; resolves when the download ends
async function downloadWithPreset(url, title, preset, label = "saved settings") {
  setToast({ title: "Getting video info", sub: title || "YouTube video", hint: "Using your saved settings" });
  let data;
  try {
    data = await window.api.youtubeGetFormats(url);
  } catch (err) {
    data = { ok: false, error: err.message };
  }
  if (!data || !data.ok) {
    return setToast({ kind: "warn", icon: "!", title: "Couldn't read this video", sub: friendlyYouTubeError(data && data.error), hideAfter: 10000 });
  }

  const opts = { url, title: data.title };
  let summary;
  if (preset.mode === "audio" || !data.videos.length) {
    const audioFormat = preset.audioFormat || "wav";
    Object.assign(opts, { mode: "audio", audioFormat });
    summary = `${audioFormat.toUpperCase()} audio`;
  } else {
    const v = pickSavedStream(data.videos, preset);
    const output = VIDEO_OUTPUTS[preset.output] ? preset.output : "mp4";
    Object.assign(opts, { mode: "video", streamId: v.id, height: v.height, output, includeAudio: preset.includeAudio !== false });
    summary = `${v.quality}p ${v.codec} → ${VIDEO_OUTPUTS[output].short}`;
  }
  return runYouTubeDownload(opts, data.title, `${summary} · ${label}`);
}

// ── YOUTUBE DOWNLOAD DIALOG ──────────────────────────────────────────────────
const formatBody = document.getElementById("formatBody");
const formatFooter = document.getElementById("formatFooter");
const dlSummary = document.getElementById("dlSummary");
const dlStart = document.getElementById("dlStart");
const dlRemember = document.getElementById("dlRemember");

const VIDEO_OUTPUTS = {
  mp4: { label: "MP4 · H.264", short: "MP4", note: "Edit-ready. H.264 streams are copied as-is; other codecs are converted." },
  prores: { label: "MOV · ProRes 422", short: "ProRes MOV", note: "Smoothest editing. Always converted, and files are much larger." },
  original: { label: "Original (no conversion)", short: "original file", note: "Keeps the YouTube codec. Premiere may not open VP9 or AV1 files." }
};
const AUDIO_OUTPUTS = [
  { id: "wav", label: "WAV", detail: "48 kHz, uncompressed", kbps: 2304 },
  { id: "m4a", label: "M4A", detail: "Original AAC, no conversion", kbps: 128 },
  { id: "mp3", label: "MP3", detail: "320 kbps", kbps: 320 },
  { id: "flac", label: "FLAC", detail: "Lossless", kbps: 900 }
];

let dl = null; // state of the open dialog; replaced on every open so late responses are ignored

function formatBytes(bytes) {
  if (!bytes) return "";
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`;
}

// "83", "1:23" or "1:02:03" → seconds; "" → null; anything else → NaN
function parseClipTime(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(t)) return NaN;
  return t.split(":").reduce((acc, part) => acc * 60 + Number(part), 0);
}

function formatClock(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

function youTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1, 12);
    return u.searchParams.get("v") || (u.pathname.match(/^\/(?:shorts|live)\/([\w-]{11})/) || [])[1] || "";
  } catch (e) {
    return "";
  }
}

// Where the YouTube tab's player is, in seconds, if it's showing this video; otherwise null
async function playerTime(url) {
  try {
    const id = youTubeId(url);
    if (!id || youTubeId(views.youtube.getURL()) !== id) return null;
    const t = await views.youtube.executeJavaScript("(document.querySelector('video.html5-main-video') || document.querySelector('video') || {}).currentTime");
    return Number.isFinite(t) ? t : null;
  } catch (e) {
    return null;
  }
}

function closeFormatModal() {
  formatModal.classList.add("hidden");
  dl = null;
}

async function openYouTubeFormatModal(url, title) {
  const state = (dl = { url });
  formatModal.classList.remove("hidden");
  modalVideoTitle.textContent = title || "YouTube video";
  modalUploader.innerHTML = `<span class="mini-spinner"></span>Fetching formats…`;
  modalThumb.removeAttribute("src");
  formatFooter.classList.add("hidden");
  formatBody.innerHTML = `<div class="dl-skeleton"><div></div><div></div><div></div><div></div></div>`;

  let data;
  try {
    data = await window.api.youtubeGetFormats(url);
  } catch (err) {
    data = { ok: false, error: err.message };
  }
  if (dl !== state) return;

  if (!data || !data.ok) {
    modalUploader.textContent = "";
    formatBody.innerHTML = `
      <div class="dl-error">
        <strong>Couldn't load formats</strong>
        <span>${escapeHtml(friendlyYouTubeError(data && data.error))}</span>
        <button type="button" id="dlRetry" class="btn btn-secondary btn-sm">Try again</button>
      </div>`;
    document.getElementById("dlRetry").onclick = () => openYouTubeFormatModal(url, title);
    return;
  }

  const firstH264 = data.videos.find(v => v.codec === "H.264") || data.videos[0];
  Object.assign(state, {
    data,
    mode: data.videos.length ? "video" : "audio",
    streamId: firstH264 ? firstH264.id : "",
    output: "mp4",
    includeAudio: true,
    audioFormat: "wav",
    startText: "",
    endText: ""
  });
  state.inPlayer = (await playerTime(url)) !== null;
  if (dl !== state) return;
  dlRemember.checked = Boolean(getYtPreset());
  modalVideoTitle.textContent = data.title;
  modalUploader.textContent = [data.uploader, data.duration].filter(Boolean).join(" · ");
  if (data.thumbnail) modalThumb.src = data.thumbnail;
  renderFormatBody();
  formatFooter.classList.remove("hidden");
}

function renderFormatBody() {
  const { data, mode } = dl;
  const rows = mode === "video"
    ? data.videos.map(v => `
        <label class="dl-row">
          <input type="radio" name="dlChoice" value="${escapeHtml(v.id)}" ${v.id === dl.streamId ? "checked" : ""}>
          <span class="dl-q">${Number(v.quality)}p</span>
          <span class="dl-fps">${Number(v.fps)} fps</span>
          <span class="dl-codec">${escapeHtml(v.codec)}${v.hdr ? `<em>HDR</em>` : ""}</span>
          <span class="dl-size">${v.bytes ? `~${formatBytes(v.bytes + data.audioBytes)}` : ""}</span>
        </label>`).join("")
    : AUDIO_OUTPUTS.map(a => `
        <label class="dl-row">
          <input type="radio" name="dlChoice" value="${a.id}" ${a.id === dl.audioFormat ? "checked" : ""}>
          <span class="dl-q">${a.label}</span>
          <span class="dl-detail">${a.detail}</span>
          <span class="dl-size">${data.durationSec ? `~${formatBytes(a.kbps * 125 * data.durationSec)}` : ""}</span>
        </label>`).join("");

  formatBody.innerHTML = `
    <div class="dl-tabs" role="tablist">
      <button type="button" class="dl-tab ${mode === "video" ? "active" : ""}" data-mode="video" ${data.videos.length ? "" : "disabled"}>Video</button>
      <button type="button" class="dl-tab ${mode === "audio" ? "active" : ""}" data-mode="audio">Audio only</button>
    </div>
    <div class="dl-list">${rows}</div>
    <div class="dl-options">
      ${mode === "video" ? `
        <label class="dl-field"><span>Format</span>
          <select id="dlOutput">${Object.entries(VIDEO_OUTPUTS).map(([id, o]) =>
            `<option value="${id}" ${id === dl.output ? "selected" : ""}>${o.label}</option>`).join("")}
          </select>
        </label>
        <label class="dl-check"><input type="checkbox" id="dlIncludeAudio" ${dl.includeAudio ? "checked" : ""}>Include audio</label>` : ""}
      <div class="dl-field dl-clip"><span>Clip</span>
        <input id="dlStartTime" type="text" placeholder="0:00" value="${escapeHtml(dl.startText)}" spellcheck="false" aria-label="Clip start">
        <span class="dl-dash">–</span>
        <input id="dlEndTime" type="text" placeholder="${formatClock(data.durationSec)}" value="${escapeHtml(dl.endText)}" spellcheck="false" aria-label="Clip end">
        ${dl.inPlayer ? `
          <button type="button" class="dl-now" data-edge="start" title="Start the clip where the video is paused">Start here</button>
          <button type="button" class="dl-now" data-edge="end" title="End the clip where the video is paused">End here</button>` : ""}
      </div>
    </div>
    <p id="dlNote" class="dl-note"></p>`;

  formatBody.querySelectorAll(".dl-tab").forEach(tab => {
    tab.onclick = () => { dl.mode = tab.dataset.mode; renderFormatBody(); };
  });
  formatBody.querySelectorAll('input[name="dlChoice"]').forEach(radio => {
    radio.onchange = () => {
      if (dl.mode === "video") dl.streamId = radio.value;
      else dl.audioFormat = radio.value;
      updateFormatSummary();
    };
  });
  const bind = (id, event, apply) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, () => { apply(el); updateFormatSummary(); });
  };
  bind("dlOutput", "change", el => { dl.output = el.value; });
  bind("dlIncludeAudio", "change", el => { dl.includeAudio = el.checked; });
  bind("dlStartTime", "input", el => { dl.startText = el.value; });
  bind("dlEndTime", "input", el => { dl.endText = el.value; });
  formatBody.querySelectorAll(".dl-now").forEach(btn => {
    btn.onclick = async () => {
      const sec = await playerTime(dl.url);
      if (sec === null || !dl) return;
      dl[btn.dataset.edge === "start" ? "startText" : "endText"] = formatClock(sec);
      renderFormatBody();
    };
  });
  updateFormatSummary();
}

function clipRange() {
  const duration = dl.data.durationSec || Infinity;
  const start = parseClipTime(dl.startText);
  const end = parseClipTime(dl.endText);
  const valid = !Number.isNaN(start) && !Number.isNaN(end) &&
    (start ?? 0) < (end ?? duration) && (end ?? 0) <= duration + 1;
  return { start, end, valid, isClip: start !== null || end !== null };
}

function updateFormatSummary() {
  const { data } = dl;
  const clip = clipRange();
  const fraction = clip.isClip && clip.valid && data.durationSec
    ? Math.min(1, ((clip.end ?? data.durationSec) - (clip.start ?? 0)) / data.durationSec)
    : 1;

  let parts, note;
  if (dl.mode === "video") {
    const v = data.videos.find(x => x.id === dl.streamId) || data.videos[0];
    const out = VIDEO_OUTPUTS[dl.output];
    const bytes = v.bytes ? (v.bytes + (dl.includeAudio ? data.audioBytes : 0)) * fraction : 0;
    parts = [`${v.quality}p${v.fps > 30 ? v.fps : ""} ${v.codec}`, `→ ${out.short}`,
      dl.output === "prores" ? "large file" : (bytes ? `~${formatBytes(bytes)}` : "")];
    note = dl.output === "mp4" && v.codec !== "H.264" ? `${v.codec} will be converted to H.264 after download.` : out.note;
  } else {
    const a = AUDIO_OUTPUTS.find(x => x.id === dl.audioFormat);
    parts = [a.label, data.durationSec ? `~${formatBytes(a.kbps * 125 * data.durationSec * fraction)}` : ""];
    note = "";
  }
  if (clip.isClip && clip.valid) {
    parts.push(`${formatClock(clip.start ?? 0)}–${formatClock(clip.end ?? data.durationSec)}`);
    note = dl.mode === "video" && dl.output !== "original"
      ? "The full video downloads first, then it's trimmed to the exact frame."
      : "The full video downloads first, then it's trimmed at the nearest keyframe.";
  }

  const noteEl = document.getElementById("dlNote");
  dlSummary.textContent = parts.filter(Boolean).join(" · ");
  noteEl.textContent = clip.valid ? note : "Check the clip times. Use m:ss, for example 0:30 – 1:10.";
  noteEl.classList.toggle("is-error", !clip.valid);
  dlStart.disabled = !clip.valid;
}

function startFormatDownload() {
  if (!dl || !dl.data || dlStart.disabled) return;
  const { url, data } = dl;
  const clip = clipRange();
  const opts = { url, title: data.title, start: clip.start, end: clip.end };
  if (dl.mode === "video") {
    const v = data.videos.find(x => x.id === dl.streamId) || data.videos[0];
    Object.assign(opts, { mode: "video", streamId: v.id, height: v.height, output: dl.output, includeAudio: dl.includeAudio });
    setYtPreset(dlRemember.checked ? { mode: "video", quality: v.quality, codec: v.codec, output: dl.output, includeAudio: dl.includeAudio } : null);
  } else {
    Object.assign(opts, { mode: "audio", audioFormat: dl.audioFormat });
    setYtPreset(dlRemember.checked ? { mode: "audio", audioFormat: dl.audioFormat } : null);
  }
  const summary = dlSummary.textContent;
  closeFormatModal();
  runYouTubeDownload(opts, data.title, summary);
}

dlStart.onclick = startFormatDownload;
document.getElementById("dlCancel").onclick = closeFormatModal;
modalClose.onclick = closeFormatModal;
formatModal.addEventListener("mousedown", (e) => { if (e.target === formatModal) closeFormatModal(); });

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeFormatModal();
    historyDrawer.classList.add("hidden");
  } else if (e.key === "Enter" && dl && dl.data && e.target.tagName !== "SELECT" && e.target.tagName !== "BUTTON") {
    startFormatDownload();
  }
});

// ── DOWNLOAD PROGRESS & RESULT ───────────────────────────────────────────────
const toastProgress = document.getElementById("toastProgress");
const toastActions = document.getElementById("toastActions");
const toastQueue = document.getElementById("toastQueue");
let toastDismissTimeout = null;
let toastFilePath = "";

// kind: "progress" | "success" (imported) | "waiting" (queued for Premiere) | "saved" (on disk, not imported) | "warn" (failed)
function setToast({ title, sub = "", hint = "", percent = null, kind = "progress", icon = "↓", filePath = "", hideAfter = 0 }) {
  clearTimeout(toastDismissTimeout);
  toastTracker.className = `toast-tracker ${kind}${filePath ? " has-file" : ""}`;
  toastTracker.draggable = Boolean(filePath);
  toastIcon.textContent = icon;
  toastTitle.textContent = title;
  toastSubtitle.textContent = sub;
  toastActionHint.textContent = hint;
  const showBar = kind === "progress";
  toastProgress.classList.toggle("hidden", !showBar);
  toastProgress.classList.toggle("indeterminate", showBar && percent === null);
  progressFill.style.width = percent === null ? "" : `${percent}%`;
  toastPercent.textContent = showBar && percent !== null ? `${percent}%` : "";
  toastFilePath = filePath;
  toastActions.classList.toggle("hidden", !filePath);
  renderToastQueue();
  if (hideAfter) toastDismissTimeout = setTimeout(() => toastTracker.classList.add("hidden"), hideAfter);
}

toastClose.onclick = () => {
  clearTimeout(toastDismissTimeout);
  toastTracker.classList.add("hidden");
};
document.getElementById("toastReveal").onclick = () => {
  if (toastFilePath) window.api.revealFile(toastFilePath);
};
// Drag the finished file straight onto Premiere's timeline or a bin
toastTracker.addEventListener("dragstart", (e) => {
  if (!toastFilePath || e.target.closest("button")) return;
  e.preventDefault();
  window.api.startDrag(toastFilePath);
});

// Every download in flight, so parallel downloads show up under the main card
const activeDownloads = new Map();
let toastDownloadId = "";

function renderToastQueue() {
  const others = [...activeDownloads.entries()].filter(([id]) => id !== toastDownloadId);
  toastQueue.classList.toggle("hidden", others.length === 0);
  toastQueue.replaceChildren(...others.map(([, d]) => {
    const li = document.createElement("li");
    const pct = Number.isFinite(d.percent) ? d.percent : null;
    li.innerHTML = `<span class="q-name"></span><span class="q-pct">${pct === null ? "…" : pct + "%"}</span><span class="q-bar"><span style="width:${pct || 0}%"></span></span>`;
    li.querySelector(".q-name").textContent = d.name;
    return li;
  }));
}

async function runYouTubeDownload(opts, title, summary) {
  setToast({ title: "Starting download", sub: title, hint: summary });
  let res;
  try {
    res = await window.api.youtubeDownload(opts);
  } catch (err) {
    res = { ok: false, error: err.message };
  }
  if (!res || !res.ok) {
    setToast({ kind: "warn", icon: "!", title: "Download failed", sub: friendlyYouTubeError(res && res.error), hideAfter: 10000 });
  }
}

const PHASE_TITLES = {
  merging: "Merging audio and video",
  remuxing: "Packaging",
  transcoding: "Converting",
  normalizing: "Converting",
  extracting: "Extracting audio"
};

window.api.onDownloadProgress((data) => {
  const name = data.name || "";
  const done = data.state === "completed" || data.state === "error" || data.phase === "error";
  if (done) activeDownloads.delete(data.id);
  else activeDownloads.set(data.id, { name, percent: data.percent });
  toastDownloadId = data.id;

  if (data.state === "error" || data.phase === "error") {
    return setToast({ kind: "warn", icon: "!", title: "Download failed", sub: data.subText || name, hideAfter: 10000 });
  }
  if (data.state === "completed") {
    if (data.reused) return setToast({ title: "Already downloaded", sub: name, hint: "Using the file you saved earlier…", percent: 100, icon: "✓" });
    return setToast({ title: "Saved", sub: name, hint: "Sending to Premiere…", percent: 100, icon: "✓" });
  }
  if (data.state === "extracting") {
    return setToast({ title: "Unzipping", sub: name });
  }
  const percent = Number.isFinite(data.percent) ? data.percent : null;
  setToast({ title: PHASE_TITLES[data.phase] || PHASE_TITLES[data.state] || "Downloading", sub: name, hint: data.subText || "", percent });
});

// A soft two-note chime when a clip lands in Premiere
let chimeContext = null;
function playChime() {
  if (appSettings.importSound === false) return;
  try {
    chimeContext = chimeContext || new AudioContext();
    const t0 = chimeContext.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const t = t0 + i * 0.09;
      const osc = chimeContext.createOscillator();
      const gain = chimeContext.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.07, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(gain).connect(chimeContext.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  } catch (e) {}
}

window.api.onToast((data) => {
  if (data.filePath) addHistoryItem(data);
  if (data.type === "success") {
    updateBridgeUI({ online: true });
    playChime();
    setToast({ kind: "success", icon: "✓", title: data.title, sub: data.msg, hideAfter: 5000 });
  } else if (data.type === "waiting") {
    updateBridgeUI({ pending: data.pending || 0 });
    setToast({ kind: "waiting", icon: "↻", title: data.title, sub: `Saved to ${data.folder}`, hint: data.msg, filePath: data.filePath });
  } else if (data.type === "saved") {
    setToast({ kind: "saved", icon: "✓", title: data.title, sub: `Saved to ${data.folder}`, hint: data.msg, filePath: data.filePath, hideAfter: 15000 });
  } else {
    showNotice(data.msg || data.title || "Notice", "!");
  }
});

// ── UPDATES ──────────────────────────────────────────────────────────────────
const btnUpdate = document.getElementById("btnUpdate");
const btnUpdateText = document.getElementById("btnUpdateText");

window.api.onUpdateAvailable(({ version }) => {
  btnUpdateText.textContent = `Update to ${version}`;
  btnUpdate.classList.remove("hidden");
});

btnUpdate.onclick = async () => {
  btnUpdate.disabled = true;
  const res = await window.api.installUpdate();
  if (!res.ok) {
    btnUpdate.disabled = false;
    if (!res.cancelled) setToast({ kind: "warn", icon: "!", title: "Update failed", sub: res.error, hideAfter: 10000 });
  }
};

window.api.onUpdateProgress(({ phase, percent }) => {
  if (phase === "downloading") setToast({ title: "Downloading update", sub: "MediaDrop restarts when it's installed.", percent });
  else setToast({ title: "Installing update", sub: "MediaDrop will close and reopen in a moment." });
});

// ── PREMIERE STATUS ──────────────────────────────────────────────────────────
// The pill names the project and sequence downloads will land in; clicking it opens a
// checklist of what's still missing before imports can work.
const bridgeLabel = document.getElementById("bridgeLabel");
const premierePopover = document.getElementById("premierePopover");
const MODE_LABELS = { timeline: "the timeline, at the playhead", bin: "the project bin", source: "the Source Monitor" };
let premiere = { checked: false, online: false, project: null, sequence: null, pending: 0 };

function setStep(id, done, todo) {
  const li = document.getElementById(id);
  li.classList.toggle("done", done);
  li.classList.toggle("todo", !done && todo);
}

function updateBridgeUI(status) {
  premiere = { ...premiere, ...status, checked: true };
  const { online, project, sequence, pending } = premiere;
  const mode = appSettings.insertMode || "timeline";
  const needsSequence = mode === "timeline";

  let kind, label;
  if (!online) { kind = "offline"; label = "Premiere not connected"; }
  else if (!project) { kind = "attention"; label = "Open a project"; }
  else if (needsSequence && !sequence) { kind = "attention"; label = `${project} · no sequence`; }
  else { kind = "online"; label = needsSequence ? `${project} · ${sequence}` : project; }
  if (pending) label = `${pending} waiting · ${label}`;

  bridgeStatusPill.className = `bridge-pill ${kind}`;
  bridgeLabel.textContent = label;
  bridgeStatusPill.title = kind === "online" ? `Downloads go to ${project}` : "See what Premiere Pro needs";

  setStep("stepPanel", online, true);
  setStep("stepProject", online && Boolean(project), online);
  setStep("stepSequence", online && Boolean(project && sequence), online && Boolean(project) && needsSequence);
  document.getElementById("stepProjectTitle").textContent = project ? `Project: ${project}` : "A project is open";
  document.getElementById("stepSequenceTitle").textContent = sequence ? `Sequence: ${sequence}` : (needsSequence ? "A sequence is open" : "A sequence is open (optional)");
  document.getElementById("prPopTitle").textContent = kind === "online" ? "Ready to import" : "Almost ready";
  document.getElementById("prDest").textContent = MODE_LABELS[mode];
  const pendingEl = document.getElementById("prPending");
  pendingEl.classList.toggle("hidden", !pending);
  pendingEl.textContent = `${pending} ${pending === 1 ? "download is" : "downloads are"} waiting and will import as soon as Premiere is ready.`;

  // First launch: show the checklist once if something's missing
  if (!online || !project) {
    let seen = true;
    try { seen = localStorage.getItem("mediadrop_setup_seen") === "1"; localStorage.setItem("mediadrop_setup_seen", "1"); } catch (e) {}
    if (!seen) openPremierePopover();
  }
}

function openPremierePopover() {
  historyDrawer.classList.add("hidden");
  premierePopover.classList.remove("hidden");
  bridgeStatusPill.setAttribute("aria-expanded", "true");
}

function closePremierePopover() {
  premierePopover.classList.add("hidden");
  bridgeStatusPill.setAttribute("aria-expanded", "false");
}

async function refreshPremiereStatus() {
  try {
    updateBridgeUI(await window.api.checkPremiereBridge());
  } catch (e) {
    updateBridgeUI({ online: false });
  }
}

bridgeStatusPill.onclick = () => {
  if (premierePopover.classList.contains("hidden")) {
    openPremierePopover();
    refreshPremiereStatus();
  } else {
    closePremierePopover();
  }
};
document.getElementById("prChange").onclick = () => {
  closePremierePopover();
  openSettings();
};
document.addEventListener("mousedown", (e) => {
  if (!e.target.closest(".pr-status")) closePremierePopover();
});

// The main process pushes a fresh status every 3 seconds
window.api.onPremiereStatus((data) => updateBridgeUI(data || { online: false }));
refreshPremiereStatus();

// ── RECENT DOWNLOADS ─────────────────────────────────────────────────────────
const HISTORY_KEY = "mediadrop_history";
const historySearch = document.getElementById("historySearch");
const historyEmpty = document.getElementById("historyEmpty");
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv)$/i;
const AUDIO_EXT = /\.(wav|mp3|m4a|aac|flac|aiff?|ogg)$/i;
const FILE_ICONS = {
  audio: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  place: '<path d="M12 4v10M7 9l5 5 5-5"/><path d="M4 18h16"/>',
  finder: '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.2h9A1.5 1.5 0 0 1 21 9.7V17.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/>'
};

let downloadHistory = [];
try { downloadHistory = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) {}
if (!Array.isArray(downloadHistory)) downloadHistory = [];

function addHistoryItem({ filePath, site, project }) {
  const previous = downloadHistory.find((h) => h.path === filePath);
  downloadHistory = downloadHistory.filter((h) => h.path !== filePath);
  downloadHistory.unshift({
    name: filePath.split("/").pop(),
    path: filePath,
    site: site || (previous && previous.site) || "",
    project: project || (previous && previous.project) || "",
    time: Date.now()
  });
  downloadHistory = downloadHistory.slice(0, 100);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(downloadHistory)); } catch (e) {}
  if (!historyDrawer.classList.contains("hidden")) renderHistory();
}

function timeAgo(ms) {
  const sec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  return new Date(ms).toLocaleDateString();
}

function fileUrl(file) {
  return "file://" + file.split("/").map(encodeURIComponent).join("/");
}

function svgIcon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${FILE_ICONS[name]}</svg>`;
}

// The picture itself, or a frame one second into the video
function historyThumb(file) {
  const thumb = document.createElement("span");
  thumb.className = "history-thumb";
  thumb.innerHTML = svgIcon(AUDIO_EXT.test(file) ? "audio" : "file");
  let media = null;
  if (IMAGE_EXT.test(file)) {
    media = new Image();
    media.src = fileUrl(file);
  } else if (VIDEO_EXT.test(file)) {
    media = document.createElement("video");
    Object.assign(media, { muted: true, preload: "metadata", src: fileUrl(file) + "#t=1" });
  }
  if (media) {
    media.onerror = () => media.remove();
    thumb.append(media);
  }
  return thumb;
}

function renderHistory() {
  const q = historySearch.value.trim().toLowerCase();
  const items = downloadHistory.filter((h) => !q || [h.name, h.site, h.project].join(" ").toLowerCase().includes(q));

  historyList.replaceChildren(...items.slice(0, 60).map((item) => {
    const li = document.createElement("li");
    li.className = "history-item";
    li.draggable = true;
    li.title = `${item.path}\nDrag into Premiere to place it yourself`;

    const words = document.createElement("span");
    words.className = "history-words";
    const name = Object.assign(document.createElement("span"), { className: "history-name", textContent: item.name });
    const meta = Object.assign(document.createElement("span"), {
      className: "history-meta",
      textContent: [item.site, item.project && `in ${item.project}`, timeAgo(item.time)].filter(Boolean).join(" · ")
    });
    words.append(name, meta);

    const actions = document.createElement("span");
    actions.className = "history-actions";
    actions.innerHTML = `
      <button type="button" class="history-action" data-act="place" title="Send to Premiere again" aria-label="Send to Premiere again">${svgIcon("place")}</button>
      <button type="button" class="history-action" data-act="reveal" title="Show in Finder" aria-label="Show in Finder">${svgIcon("finder")}</button>`;
    actions.querySelector('[data-act="place"]').onclick = () => {
      setToast({ title: "Sending to Premiere", sub: item.name });
      window.api.importLocalFile(item.path, item.site);
    };
    actions.querySelector('[data-act="reveal"]').onclick = () => window.api.revealFile(item.path);

    li.addEventListener("dragstart", (e) => {
      if (e.target.closest("button")) return;
      e.preventDefault();
      window.api.startDrag(item.path);
    });

    li.append(historyThumb(item.path), words, actions);
    return li;
  }));

  historyEmpty.classList.toggle("hidden", items.length > 0);
  historyEmpty.querySelector("p").textContent = q ? "No matches" : "Nothing downloaded yet";
}

historySearch.addEventListener("input", renderHistory);
historyClose.onclick = () => {
  historyDrawer.classList.add("hidden");
};

// ── SEARCH EVERY SITE ────────────────────────────────────────────────────────
// One search fills every tab at once: videos, images, music, sound effects and GIFs.
// Each site's results appear as soon as it answers, each labelled with where it's
// from and whether it's free to use. Other sites open right here with the same search.
const collectionChips = document.getElementById("collectionChips");
const searchResults = document.getElementById("searchResults");
const searchFreeOnly = document.getElementById("searchFreeOnly");
const searchSources = document.getElementById("searchSources");

const slug = (q) => encodeURIComponent(q.trim().toLowerCase().replace(/\s+/g, "-"));
const enc = (q) => encodeURIComponent(q.trim());

// Sites that open inside Search with the same query
const SITES = {
  pexelsVideo: { domain: "pexels.com", name: "Pexels", url: (q) => `https://www.pexels.com/search/videos/${enc(q)}/` },
  pixabayVideo: { domain: "pixabay.com", name: "Pixabay", url: (q) => `https://pixabay.com/videos/search/${enc(q)}/` },
  coverr: { domain: "coverr.co", name: "Coverr", url: (q) => `https://coverr.co/s?q=${enc(q)}` },
  envatoVideo: { domain: "elements.envato.com", name: "Envato", url: (q) => `https://elements.envato.com/stock-video/${slug(q)}` },
  unsplash: { domain: "unsplash.com", name: "Unsplash", url: (q) => `https://unsplash.com/s/photos/${slug(q)}` },
  pexels: { domain: "pexels.com", name: "Pexels", url: (q) => `https://www.pexels.com/search/${enc(q)}/` },
  pixabayImages: { domain: "pixabay.com", name: "Pixabay", url: (q) => `https://pixabay.com/images/search/${enc(q)}/` },
  googleImages: { domain: "google.com", name: "Google Images", url: (q) => `https://www.google.com/search?tbm=isch&q=${enc(q)}` },
  envatoPhotos: { domain: "elements.envato.com", name: "Envato", url: (q) => `https://elements.envato.com/photos/${slug(q)}` },
  pixabayMusic: { domain: "pixabay.com", name: "Pixabay", url: (q) => `https://pixabay.com/music/search/${enc(q)}/` },
  fma: { domain: "freemusicarchive.org", name: "Free Music Archive", url: (q) => `https://freemusicarchive.org/search?quicksearch=${enc(q)}` },
  envatoMusic: { domain: "elements.envato.com", name: "Envato", url: (q) => `https://elements.envato.com/audio/music/${slug(q)}` },
  freesound: { domain: "freesound.org", name: "Freesound", url: (q) => `https://freesound.org/search/?q=${enc(q)}` },
  pixabaySfx: { domain: "pixabay.com", name: "Pixabay", url: (q) => `https://pixabay.com/sound-effects/search/${enc(q)}/` },
  envatoSfx: { domain: "elements.envato.com", name: "Envato", url: (q) => `https://elements.envato.com/sound-effects/${slug(q)}` },
  giphy: { domain: "giphy.com", name: "GIPHY", url: (q) => `https://giphy.com/search/${slug(q)}` },
  googleGifs: { domain: "google.com", name: "Google GIFs", url: (q) => `https://www.google.com/search?tbm=isch&tbs=itp:animated&q=${enc(q)}` }
};

// Where MediaDrop's own results come from, for their icons in the source row
const INLINE_SITES = { Mixkit: "mixkit.co", YouTube: "youtube.com", Flickr: "flickr.com", Wikimedia: "commons.wikimedia.org", Tenor: "tenor.com", Openverse: "openverse.org" };

// Each tab searches its sources in main.js (filterable by "picks") and can open more sites in place
const ICON = (d) => `<svg class="sv-tab-icon" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const COLLECTIONS = [
  { id: "video", label: "Videos", kind: "video", sources: ["mixkitVideo", "youtubeVideo"], picks: ["Mixkit", "YouTube"], sites: ["pexelsVideo", "pixabayVideo", "coverr", "envatoVideo"],
    icon: ICON('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4.5-2.5z"/>') },
  { id: "images", label: "Images", kind: "image", sources: ["openverseImages", "commonsImages"], picks: ["Flickr", "Wikimedia"], sites: ["unsplash", "pexels", "pixabayImages", "googleImages", "envatoPhotos"],
    icon: ICON('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9.5" r="1.8"/><path d="m21 16-5-5-9 9"/>') },
  { id: "music", label: "Music", kind: "audio", sources: ["mixkitMusic", "youtubeMusic"], picks: ["Mixkit", "YouTube"], sites: ["pixabayMusic", "fma", "envatoMusic"],
    icon: ICON('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>') },
  { id: "sfx", label: "Sound effects", kind: "audio", sources: ["mixkitSfx"], picks: ["Mixkit"], sites: ["freesound", "pixabaySfx", "envatoSfx"],
    icon: ICON('<path d="M3 12h2M7 8v8M11 4v16M15 8v8M19 10v4M21 12h0"/>') },
  { id: "gifs", label: "GIFs", kind: "image", sources: ["tenor"], picks: ["Tenor"], sites: ["giphy", "googleGifs"],
    icon: ICON('<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M10 10H8a1.5 1.5 0 0 0-1.5 1.5v1A1.5 1.5 0 0 0 8 14h2v-2H9M12.5 10v4M15.5 14v-4h2.5M15.5 12h2"/>') }
];
const favicon = (domain) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
const collectionById = (id) => COLLECTIONS.find((c) => c.id === id) || COLLECTIONS[0];

const LICENCE_BADGE = {
  free: { label: "Copyright-free", cls: "free" },
  credit: { label: "Free · credit author", cls: "credit" },
  check: { label: "Copyrighted", cls: "check" }
};
const TIER_ORDER = { free: 0, credit: 1, check: 2 };
const EXAMPLES = ["car", "city at night", "whoosh", "rain", "upbeat", "explosion", "applause", "ocean"];

const search = {
  query: "", collection: "video", answers: new Map(), items: new Map(), picked: new Set(), token: 0,
  freeOnly: false,
  // "all", "pick:<site>" (one of MediaDrop's sources), "site:<id>" (a site opened in place) or "page" (a result's page)
  site: "all"
};
try {
  search.collection = collectionById(localStorage.getItem("searchTab")).id;
  search.freeOnly = localStorage.getItem("searchFreeOnly") === "1";
} catch (e) {}
searchFreeOnly.checked = search.freeOnly;

function renderChips() {
  collectionChips.innerHTML = COLLECTIONS.map((c) => {
    const { results, pending } = collectionState(c);
    const count = search.query ? (pending && !results.length ? `<span class="mini-spinner sv-loading"></span>` : `<span class="sv-count">${results.length}${pending ? "+" : ""}</span>`) : "";
    return `<button type="button" role="tab" class="sv-tab ${c.id === search.collection ? "active" : ""}" data-id="${c.id}" aria-selected="${c.id === search.collection}">${c.icon}${c.label}${count}</button>`;
  }).join("");
  collectionChips.querySelectorAll(".sv-tab").forEach((tab) => {
    tab.onclick = () => {
      const to = collectionById(tab.dataset.id);
      search.collection = to.id;
      try { localStorage.setItem("searchTab", search.collection); } catch (e) {}
      stopPreview();
      renderChips();
      // Keep the same site where the new tab has it (Pexels videos -> Pexels photos)
      if (search.site.startsWith("site:")) {
        const name = SITES[search.site.slice(5)].name;
        const same = to.sites.find((id) => SITES[id].name === name);
        if (same && search.query) return pickSource(`site:${same}`);
      } else if (search.site.startsWith("pick:") && to.picks.includes(search.site.slice(5))) {
        renderSources();
        renderResults();
        searchView.scrollTop = 0;
        return;
      }
      pickSource("all");
      searchView.scrollTop = 0;
    };
  });
}

// The row under the media tabs: MediaDrop's results, each of its sources, then other sites shown in place
const ALL_ICON = `<svg class="sv-source-icon sv-source-all" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`;
function renderSources() {
  const c = collectionById(search.collection);
  const chip = (key, icon, label, extra = "") =>
    `<button type="button" role="tab" class="sv-source ${search.site === key ? "active" : ""}" data-key="${key}" aria-selected="${search.site === key}">${icon}<span>${escapeHtml(label)}</span>${extra}</button>`;
  const img = (domain) => `<img class="sv-source-icon" src="${favicon(domain)}" alt="" draggable="false">`;
  const count = (name) => {
    if (!search.query) return "";
    const { results, pending } = collectionState(c, name);
    return pending && !results.length ? "" : `<span class="sv-count">${results.length}</span>`;
  };
  searchSources.innerHTML =
    chip("all", ALL_ICON, "All results") +
    c.picks.map((name) => chip(`pick:${name}`, img(INLINE_SITES[name]), name, count(name))).join("") +
    `<span class="sv-sources-sep" aria-hidden="true"></span>` +
    c.sites.map((id) => chip(`site:${id}`, img(SITES[id].domain), SITES[id].name)).join("");
  searchSources.querySelectorAll(".sv-source").forEach((btn) => { btn.onclick = () => pickSource(btn.dataset.key); });
}

function pickSource(key) {
  search.site = key;
  stopPreview();
  if (key.startsWith("site:")) {
    const site = SITES[key.slice(5)];
    exploreUrl(search.query ? site.url(search.query) : `https://${site.domain}/`);
  } else {
    switchTab("search");
    renderResults();
  }
  renderSources();
}

// Copyright-free first, then free-with-credit, then copyrighted; sites keep their own order within each
function collectionState(c, siteName) {
  let pending = false;
  const errors = [];
  const results = [];
  let hidden = 0;
  c.sources.forEach((source) => {
    const answer = search.answers.get(source);
    if (!answer) { pending = true; return; }
    if (!answer.ok) { errors.push(answer.error); return; }
    answer.results.forEach((r) => {
      if (siteName && r.site !== siteName) return;
      if (!search.freeOnly || r.licence.tier !== "check") results.push({ ...r, key: `${source}:${r.id}`, source });
      else hidden++;
    });
  });
  results.sort((a, b) => TIER_ORDER[a.licence.tier] - TIER_ORDER[b.licence.tier]);
  return { results, pending, errors, hidden };
}

function runSearch(query) {
  const q = String(query || "").trim().slice(0, 120);
  if (!q) return;
  searchQuery.value = q;
  // A site picked above searches itself; otherwise MediaDrop's results show
  if (search.site.startsWith("site:")) {
    search.query = q;
    pickSource(search.site);
  } else {
    if (search.site === "page") search.site = "all";
    switchTab("search");
    renderSources();
  }
  if (q === search.query && search.answers.size) return;
  search.query = q;
  search.answers.clear();
  const token = ++search.token;
  // Every tab's sources start together, so switching tabs never waits
  COLLECTIONS.flatMap((c) => c.sources).forEach(async (source) => {
    const answer = await window.api.searchSource(source, q).catch((err) => ({ ok: false, error: err.message }));
    if (token !== search.token) return;
    search.answers.set(source, answer);
    if (answer.ok) answer.results.forEach((r) => search.items.set(`${source}:${r.id}`, { ...r, source }));
    renderChips();
    if (collectionById(search.collection).sources.includes(source)) { renderSources(); renderResults(); }
  });
  renderChips();
  renderResults();
}

document.getElementById("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  runSearch(searchQuery.value);
});

searchFreeOnly.addEventListener("change", () => {
  search.freeOnly = searchFreeOnly.checked;
  try { localStorage.setItem("searchFreeOnly", search.freeOnly ? "1" : "0"); } catch (e) {}
  renderChips();
  renderResults();
});

function renderResults() {
  if (!search.query) {
    searchResults.innerHTML = `
      <div class="sv-intro">
        <h3>Find media for your edit</h3>
        <p>Type what you need. Every tab fills with matching videos, images, music, sound effects and GIFs from several sites, and each result says whether you're free to use it.</p>
        <div class="sv-examples">${EXAMPLES.map((q) => `<button type="button" class="sv-example">${q}</button>`).join("")}</div>
        <div class="sv-legend">${legend()}</div>
      </div>`;
    searchResults.querySelectorAll(".sv-example").forEach((b) => { b.onclick = () => runSearch(b.textContent); });
    return;
  }

  const c = collectionById(search.collection);
  const pick = search.site.startsWith("pick:") ? search.site.slice(5) : "";
  const { results, pending, errors, hidden } = collectionState(c, pick);
  const noun = c.id === "gifs" ? c.label : c.label.toLowerCase();
  // A preview keeps playing while results update; its button is found again afterwards
  const playingKey = previewButton && previewButton.closest("[data-key]") ? previewButton.closest("[data-key]").dataset.key : "";

  let body;
  if (results.length) body = c.kind === "audio" ? audioList(results) : mediaGrid(results, c.id !== "video");
  else if (pending) body = `<p class="sv-empty"><span class="mini-spinner sv-loading"></span>Searching…</p>`;
  else if (hidden) body = `<p class="sv-empty">All ${hidden} ${noun} found are copyrighted. Untick “Free to use only” to see them.</p>`;
  else body = `<p class="sv-empty">No ${noun} found for “${escapeHtml(search.query)}”. Try simpler words, or pick another site above.</p>`;

  searchResults.innerHTML = `
    <div class="sv-legend">${legend()}${pending && results.length ? `<span class="sv-more-coming"><span class="mini-spinner sv-loading"></span>More coming</span>` : ""}</div>
    ${body}
    ${errors.length && !results.length ? `<p class="sv-error">Some sites didn't answer (${escapeHtml(errors[0])}). Try again in a moment.</p>` : ""}`;
  bindResults(searchResults);
  if (playingKey) {
    const btn = searchResults.querySelector(`[data-key="${CSS.escape(playingKey)}"] .sv-play`);
    if (btn) { previewButton = btn; btn.classList.add("playing"); btn.innerHTML = PAUSE; }
  }
}

function legend() {
  return Object.entries(LICENCE_BADGE).map(([tier, b]) =>
    `<span class="sv-lic ${b.cls}">${b.label}</span>`).join("") +
    `<span class="sv-legend-note">Copyrighted results need the owner's permission</span>`;
}

function badges(r) {
  const b = LICENCE_BADGE[r.licence.tier];
  return `<span class="sv-badges"><span class="sv-src">${escapeHtml(r.site)}</span><span class="sv-lic ${b.cls}" title="${escapeHtml(r.licence.name)}">${b.label}</span></span>`;
}

const TICK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
const GET = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>`;
const PLAY = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>`;
const PAUSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>`;

function mediaGrid(list, square) {
  return `<div class="sv-grid ${square ? "images" : ""} ${search.picked.size ? "picking" : ""}">${list.map((r) => `
    <div class="sv-card ${search.picked.has(r.key) ? "picked" : ""}" data-key="${escapeHtml(r.key)}">
      <div class="sv-thumb" data-act="open" title="Preview on ${escapeHtml(r.site)}">
        ${r.thumb ? `<img src="${escapeHtml(r.thumb)}" alt="" loading="lazy">` : ""}
        ${r.preview ? `<video src="${escapeHtml(r.preview)}" muted loop playsinline preload="none"></video>` : ""}
        ${r.duration ? `<span class="sv-dur">${formatClock(r.duration)}</span>` : ""}
      </div>
      <button type="button" class="sv-pick" data-act="pick" title="Select" aria-label="Select ${escapeHtml(r.title)}">${TICK}</button>
      <button type="button" class="sv-get" data-act="get" title="Download${r.site === "YouTube" ? " (⌥-click for options)" : ""}" aria-label="Download ${escapeHtml(r.title)}">${GET}</button>
      <span class="sv-title" title="${escapeHtml(r.title)}">${escapeHtml(r.title)}</span>
      ${badges(r)}
    </div>`).join("")}</div>`;
}

function audioList(list) {
  return `<div class="sv-audio">${list.map((r) => `
    <div class="sv-track ${search.picked.has(r.key) ? "picked" : ""}" data-key="${escapeHtml(r.key)}">
      <button type="button" class="sv-pick" data-act="pick" title="Select" aria-label="Select ${escapeHtml(r.title)}">${TICK}</button>
      ${r.preview
        ? `<button type="button" class="sv-play" data-act="play" aria-label="Play preview of ${escapeHtml(r.title)}">${PLAY}</button>`
        : `<button type="button" class="sv-play sv-play-thumb" data-act="open" aria-label="Open ${escapeHtml(r.title)} on ${escapeHtml(r.site)}">${r.thumb ? `<img src="${escapeHtml(r.thumb)}" alt="">` : PLAY}</button>`}
      <div class="sv-track-words">
        <span class="sv-title" title="${escapeHtml(r.title)}">${escapeHtml(r.title)}</span>
        <span class="sv-by">${r.by ? `${escapeHtml(r.by)}` : ""}</span>
      </div>
      ${badges(r)}
      <span class="sv-track-meta">${r.duration ? formatClock(r.duration) : ""}</span>
      <button type="button" class="sv-get" data-act="get" title="Download" aria-label="Download ${escapeHtml(r.title)}">${GET}</button>
    </div>`).join("")}</div>`;
}

function bindResults(body) {
  body.querySelectorAll("[data-act]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const key = el.closest("[data-key]").dataset.key;
      const item = search.items.get(key);
      if (!item) return;
      const act = el.dataset.act;
      if (act === "pick") togglePick(key);
      else if (act === "get") getItem(item, e.altKey);
      else if (act === "play") togglePreview(item, el);
      else if (act === "open") {
        if (search.picked.size) togglePick(key); // while picking, a click on the picture picks it too
        else openItem(item);
      }
    });
  });
  // Clips play their small preview on hover
  body.querySelectorAll(".sv-thumb video").forEach((video) => {
    const thumb = video.parentElement;
    thumb.addEventListener("mouseenter", () => { video.classList.add("on"); video.play().catch(() => {}); });
    thumb.addEventListener("mouseleave", () => { video.classList.remove("on"); video.pause(); });
  });
}

const kindOf = (item) => {
  const col = COLLECTIONS.find((c) => c.sources.includes(item.source));
  return col ? col.kind : "image";
};

function getItem(item, showOptions = false) {
  if (item.site === "YouTube") {
    // From the Music tab a YouTube result comes down as audio
    if (kindOf(item) === "audio" && !showOptions) return downloadWithPreset(item.url, item.title, { mode: "audio", audioFormat: "wav" }, "audio only");
    return requestYouTubeDownload(item.url, item.title, showOptions);
  }
  setToast({ title: "Starting download", sub: item.title, hint: `${item.site} · ${LICENCE_BADGE[item.licence.tier].label}` });
  return window.api.downloadUrl(item.url, { kind: kindOf(item), name: item.title, referrer: item.page });
}

function openItem(item) {
  if (item.site === "YouTube") {
    switchTab("youtube");
    views.youtube.loadURL(item.url);
  } else if (item.page) {
    search.site = "page";
    exploreUrl(item.page);
    renderSources();
  }
}

// ── Picking several results ──
const selectionBar = document.getElementById("selectionBar");
const selectionCount = document.getElementById("selectionCount");

function togglePick(key) {
  if (search.picked.has(key)) search.picked.delete(key);
  else search.picked.add(key);
  searchResults.querySelectorAll(`[data-key="${CSS.escape(key)}"]`).forEach((el) => el.classList.toggle("picked", search.picked.has(key)));
  searchResults.querySelectorAll(".sv-grid").forEach((g) => g.classList.toggle("picking", search.picked.size > 0));
  updateSelectionBar();
}

function updateSelectionBar() {
  const n = search.picked.size;
  selectionBar.classList.toggle("hidden", n === 0);
  selectionCount.textContent = `${n} selected`;
}

document.getElementById("selectionClear").onclick = () => {
  search.picked.clear();
  searchResults.querySelectorAll(".picked").forEach((el) => el.classList.remove("picked"));
  searchResults.querySelectorAll(".sv-grid").forEach((g) => g.classList.remove("picking"));
  updateSelectionBar();
};

document.getElementById("selectionDownload").onclick = () => {
  const items = [...search.picked].map((k) => search.items.get(k)).filter(Boolean);
  document.getElementById("selectionClear").click();
  queueDownloads(items.map((item) => ({ title: item.title, url: item.url, item })));
};

// ── Download queue: videos one at a time so a batch never floods the connection ──
// Without saved YouTube settings a batch uses up to 1080p H.264 MP4 with audio
const BATCH_PRESET = { mode: "video", quality: 1080, codec: "H.264", output: "mp4", includeAudio: true };
const downloadQueue = [];
let queueRunning = false;

function queueDownloads(jobs) {
  if (!jobs.length) return;
  downloadQueue.push(...jobs);
  showNotice(`${jobs.length} added to downloads`, "↓");
  if (!queueRunning) drainQueue();
}

async function drainQueue() {
  queueRunning = true;
  while (downloadQueue.length) {
    const job = downloadQueue.shift();
    const left = downloadQueue.length ? ` · ${downloadQueue.length} more waiting` : "";
    try {
      if (job.item && (job.item.site !== "YouTube" || kindOf(job.item) === "audio")) await getItem(job.item);
      else await downloadWithPreset(job.url, job.title, getYtPreset() || BATCH_PRESET, `batch${left}`);
    } catch (e) {}
  }
  queueRunning = false;
}

// ── Audio previews ──
let previewAudio = null;
let previewButton = null;

function stopPreview() {
  if (previewAudio) previewAudio.pause();
  if (previewButton) { previewButton.classList.remove("playing"); previewButton.innerHTML = PLAY; }
  previewAudio = previewButton = null;
}

function togglePreview(item, btn) {
  const same = previewButton === btn;
  stopPreview();
  if (same) return;
  previewAudio = new Audio(item.preview || item.url);
  previewButton = btn;
  btn.classList.add("playing");
  btn.innerHTML = PAUSE;
  previewAudio.addEventListener("ended", stopPreview);
  previewAudio.play().catch(() => {
    stopPreview();
    showNotice("This preview won't play here. Download it to listen.", "!");
  });
}

// ── A site shown inside Search, under the search header ──
function exploreUrl(url) {
  const existing = views.explore;
  const wv = createCustomWebview("explore", url);
  if (existing) wv.loadURL(url);
  wv.homeUrl = url;
  switchTab("explore");
  stopPreview();
}


renderChips();
renderSources();
renderResults();

// ── WHOLE PLAYLISTS ──────────────────────────────────────────────────────────
const playlistModal = document.getElementById("playlistModal");
const plList = document.getElementById("plList");
const plAll = document.getElementById("plAll");
const plStart = document.getElementById("plStart");
const plSummary = document.getElementById("plSummary");
let playlist = null;

async function openPlaylist(url) {
  const state = (playlist = { entries: [] });
  playlistModal.classList.remove("hidden");
  document.getElementById("plTitle").textContent = "Reading playlist…";
  document.getElementById("plSettings").textContent = getYtPreset()
    ? ytPresetSummary(getYtPreset()).split(". ")[0]
    : "Up to 1080p H.264 → MP4. Save settings in the Download dialog to change";
  plList.innerHTML = `<li class="sv-empty" style="padding:16px 8px"><span class="mini-spinner sv-loading"></span>Getting the list of videos…</li>`;
  plStart.disabled = true;
  plSummary.textContent = "";

  let res;
  try { res = await window.api.youtubePlaylist(url); } catch (err) { res = { ok: false, error: err.message }; }
  if (playlist !== state) return;
  if (!res || !res.ok) {
    document.getElementById("plTitle").textContent = "Couldn't read the playlist";
    plList.innerHTML = `<li class="sv-error" style="padding:16px 8px">${escapeHtml(friendlyYouTubeError(res && res.error))}</li>`;
    return;
  }
  state.entries = res.entries;
  document.getElementById("plTitle").textContent = res.title;
  plList.innerHTML = res.entries.map((v, i) => `
    <li><label>
      <input type="checkbox" data-i="${i}" checked>
      <span class="pl-n">${i + 1}</span>
      <span class="pl-name">${escapeHtml(v.title)}</span>
      <span class="pl-dur">${v.duration ? formatClock(v.duration) : ""}</span>
    </label></li>`).join("");
  plList.querySelectorAll("input").forEach((box) => { box.onchange = updatePlaylistSummary; });
  plList.scrollTop = 0;
  plAll.checked = true;
  updatePlaylistSummary();
}

function pickedPlaylistEntries() {
  return [...plList.querySelectorAll("input:checked")].map((box) => playlist.entries[Number(box.dataset.i)]).filter(Boolean);
}

function updatePlaylistSummary() {
  const n = pickedPlaylistEntries().length;
  plSummary.textContent = `${n} of ${playlist.entries.length} videos`;
  plStart.textContent = n ? `Download ${n}` : "Download";
  plStart.disabled = n === 0;
  plAll.checked = n === playlist.entries.length;
}

function closePlaylist() {
  playlistModal.classList.add("hidden");
  playlist = null;
}

plAll.onchange = () => {
  plList.querySelectorAll("input").forEach((box) => { box.checked = plAll.checked; });
  updatePlaylistSummary();
};
plStart.onclick = () => {
  const jobs = pickedPlaylistEntries().map((v) => ({ title: v.title, url: v.url }));
  closePlaylist();
  queueDownloads(jobs);
};
document.getElementById("plCancel").onclick = closePlaylist;
document.getElementById("plClose").onclick = closePlaylist;
playlistModal.addEventListener("mousedown", (e) => { if (e.target === playlistModal) closePlaylist(); });
btnHeaderPlaylist.onclick = () => {
  try { openPlaylist(activeView.getURL()); } catch (e) {}
};

// ── COPIED LINKS ─────────────────────────────────────────────────────────────
const clipCard = document.getElementById("clipCard");
let clipOffer = null;
let clipTimer = null;

const CLIP_TITLES = {
  youtube: "Download this YouTube video?",
  "youtube-playlist-video": "Download this YouTube video?",
  "youtube-playlist": "Download this playlist?",
  media: "Download this file?"
};

function hideClipCard() {
  clipCard.classList.add("hidden");
  clipOffer = null;
  clearTimeout(clipTimer);
}

window.api.onClipboardLink((offer) => {
  if (!offer || !CLIP_TITLES[offer.kind]) return;
  clipOffer = offer;
  document.getElementById("clipTitle").textContent = CLIP_TITLES[offer.kind];
  document.getElementById("clipUrl").textContent = offer.url.replace(/^https?:\/\/(www\.)?/, "");
  clipCard.classList.remove("hidden");
  clearTimeout(clipTimer);
  clipTimer = setTimeout(hideClipCard, 30000);
});

document.getElementById("clipDismiss").onclick = hideClipCard;
document.getElementById("clipDownload").onclick = () => {
  const offer = clipOffer;
  hideClipCard();
  if (!offer) return;
  if (offer.kind === "youtube-playlist") return openPlaylist(offer.url);
  if (offer.kind !== "media") return requestYouTubeDownload(offer.url, "YouTube video");
  const path = offer.url.split("?")[0].toLowerCase();
  const kind = /\.(mp4|mov|m4v|webm)$/.test(path) ? "video" : /\.(mp3|wav|m4a|aiff?)$/.test(path) ? "audio" : "image";
  setToast({ title: "Starting download", sub: offer.url });
  window.api.downloadUrl(offer.url, { kind });
};

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !playlistModal.classList.contains("hidden")) closePlaylist();
});

// Initialize
updateYtButtonTitle();
setupWebviews();
updateYouTubeControls();
loadAppSettings();
