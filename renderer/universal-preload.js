/**
 * MediaDrop guest preload — attached to every <webview> by main.js (will-attach-webview).
 *
 * Runs sandboxed, in an isolated world: it shares the page DOM but not its JS globals.
 *  1. Mouse back/forward buttons → host navigation; Chrome objects on Google sign-in;
 *     a click on a link to another site → the app, to open it in a tab
 *  2. Google Images → resolve the original full-size URL for right-click imports
 *  3. YouTube → format-picker button on every thumbnail and on watch pages
 */
(() => {
  const { ipcRenderer, webFrame } = require("electron");
  const host = location.hostname;

  // ── 1. MOUSE BACK / FORWARD ────────────────────────────────────────────────
  let lastNav = 0;
  const onMouseNav = (e) => {
    if (e.button !== 3 && e.button !== 4) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type !== "mouseup" || Date.now() - lastNav < 200) return;
    lastNav = Date.now();
    ipcRenderer.sendToHost("mediadrop-mouse-nav", e.button === 3 ? "back" : "forward");
  };
  window.addEventListener("mouseup", onMouseNav, true);
  window.addEventListener("auxclick", onMouseNav, true);

  // A plain click on a link to another site (Google results to Drive, Drive to Docs) goes to the
  // app, which opens it in a tab so this page stays as it was. Clicks the page handles itself,
  // and sign-in pages, which must return to the page that asked for them, stay in place.
  const SIGN_IN = /^(accounts?|login|auth|signin|sso|consent)\./;
  const bareHost = (h) => h.replace(/^www\./, "");
  document.addEventListener("click", (e) => {
    if (!e.isTrusted || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest && e.target.closest("a[href]");
    if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
    let url;
    try {
      url = new URL(link.href);
      // Google's results and Docs link through google.com/url?q=<the real link>
      if (/(^|\.)google\.[a-z.]+$/.test(url.hostname) && url.pathname === "/url") url = new URL(url.searchParams.get("q") || url.searchParams.get("url") || "");
    } catch (err) { return; }
    if (!/^https?:$/.test(url.protocol) || bareHost(url.hostname) === bareHost(host) || SIGN_IN.test(url.hostname) || SIGN_IN.test(host)) return;
    e.preventDefault();
    ipcRenderer.sendToHost("mediadrop-open-link", url.href);
  });

  // Google refuses to sign in when window.chrome lacks the objects real Chrome has
  // ("This browser or app may not be secure"). Add them on its sign-in page only:
  // bot managers elsewhere (Akamai on Flaticon) flag exactly this kind of patching.
  if (host === "accounts.google.com") {
    webFrame.executeJavaScript(`(() => {
      const c = window.chrome || (window.chrome = {});
      const now = () => Date.now() / 1000;
      c.app = c.app || { isInstalled: false, InstallState: { DISABLED: "disabled", INSTALLED: "installed", NOT_INSTALLED: "not_installed" }, RunningState: { CANNOT_RUN: "cannot_run", READY_TO_RUN: "ready_to_run", RUNNING: "running" }, getDetails: () => null, getIsInstalled: () => false };
      c.runtime = c.runtime || {};
      c.loadTimes = c.loadTimes || (() => ({ requestTime: now(), startLoadTime: now(), commitLoadTime: now(), finishDocumentLoadTime: now(), finishLoadTime: now(), firstPaintTime: now(), firstPaintAfterLoadTime: 0, navigationType: "Other", wasFetchedViaSpdy: true, wasNpnNegotiated: true, npnNegotiatedProtocol: "h2", wasAlternateProtocolAvailable: false, connectionInfo: "h2" }));
      c.csi = c.csi || (() => ({ startE: Date.now(), onloadT: Date.now(), pageT: performance.now(), tran: 15 }));
    })();`);
  }

  // ── 2. GOOGLE IMAGES: ORIGINAL-QUALITY RESOLVER ────────────────────────────
  // Grid thumbnails are tiny data: URLs. Google ships each result's original URL in
  // the page data as  [0,"<docid>",["<thumb>",h,w],["<original>",h,w],...
  // (first page: inline <script>s; infinite scroll: /search XHR responses, escaped once more).
  if (/(^|\.)google\.[a-z.]+$/.test(host)) {
    const originalsByDocId = new Map();
    const originalsByThumb = new Map();
    const RECORD_RE = /\[0,(\\*)"([\w-]{6,})\1",\[\1"(https?:[^"]*?)\1",\d+,\d+\],\[\1"(https?:[^"]*?)\1",\d+,\d+\]/g;
    const unescapeUrl = (s) => s
      .replace(/\\+u([0-9a-fA-F]{4})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\+\//g, "/");

    const indexText = (text) => {
      if (typeof text !== "string" || !text.includes("[0,")) return;
      for (const m of text.matchAll(RECORD_RE)) {
        const original = unescapeUrl(m[4]);
        originalsByDocId.set(m[2], original);
        originalsByThumb.set(unescapeUrl(m[3]), original);
      }
    };

    let scannedScripts = 0;
    const indexPageScripts = () => {
      const scripts = document.scripts;
      for (; scannedScripts < scripts.length; scannedScripts++) indexText(scripts[scannedScripts].textContent);
    };

    // Results loaded on scroll never reach the DOM as text, so capture the /search
    // responses in the page's main world and hand them over via postMessage.
    window.addEventListener("message", (e) => {
      if (e.source === window && e.data && e.data.type === "mediadrop:gimg-response") indexText(e.data.text);
    });
    webFrame.executeJavaScript(`(() => {
      if (window.__mediadropSearchHook) return;
      window.__mediadropSearchHook = true;
      const isSearch = (u) => { try { return new URL(u, location.href).pathname === "/search"; } catch (e) { return false; } };
      const forward = (text) => { if (typeof text === "string" && text.length > 200) window.postMessage({ type: "mediadrop:gimg-response", text }, location.origin); };
      const open = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (method, url) {
        if (isSearch(url)) this.addEventListener("load", () => {
          if (this.responseType === "" || this.responseType === "text") forward(this.responseText);
        });
        return open.apply(this, arguments);
      };
      const nativeFetch = window.fetch;
      window.fetch = function (input) {
        const p = nativeFetch.apply(this, arguments);
        const url = typeof input === "string" ? input : (input && input.url) || "";
        if (isSearch(url)) p.then((r) => r.clone().text()).then(forward, () => {});
        return p;
      };
    })()`).catch(() => {});

    const docIdFor = (el) => {
      const withDocId = el.closest("[data-docid]");
      if (withDocId) return withDocId.getAttribute("data-docid");
      const card = el.closest('div[jsname="G3m5s"][jsdata]');
      return card ? card.getAttribute("jsdata").split(";")[1] : "";
    };

    const resolveOriginal = (img) => {
      indexPageScripts();
      const src = img.currentSrc || img.src || "";
      if (originalsByThumb.has(src)) return originalsByThumb.get(src);
      const docId = docIdFor(img);
      if (docId && originalsByDocId.has(docId)) return originalsByDocId.get(docId);
      // Preview panel: once Google swaps in the full image it is already the original.
      if (/^https?:/.test(src) && !/\.gstatic\.com\//.test(src)) return src;
      return "";
    };

    // Main builds the native context menu; tell it the original before the user picks "Import".
    document.addEventListener("contextmenu", (e) => {
      const img = e.target instanceof Element && e.target.closest("img");
      if (!img) return;
      ipcRenderer.send("mediadrop:image-original", {
        srcURL: img.currentSrc || img.src || "",
        original: resolveOriginal(img)
      });
    }, true);
  }

  // ── 3. YOUTUBE: THUMBNAIL + WATCH PAGE BUTTONS ─────────────────────────────
  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    const THUMB_LINKS = 'a[href*="/watch?v="], a[href^="/shorts/"]';

    const canonicalVideoUrl = (href) => {
      try {
        const u = new URL(href, location.href);
        const id = u.searchParams.get("v") || (u.pathname.match(/^\/shorts\/([\w-]{11})/) || [])[1];
        return id ? `https://www.youtube.com/watch?v=${id}` : "";
      } catch (e) {
        return "";
      }
    };

    const titleFor = (link) => {
      const card = link.closest(
        "ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, " +
        "ytd-playlist-video-renderer, yt-lockup-view-model, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2"
      ) || link.parentElement;
      const titleEl = card && card.querySelector("#video-title, h3[title], h3");
      const text = (titleEl && (titleEl.getAttribute("title") || titleEl.textContent)) || link.getAttribute("aria-label") || "";
      // aria-labels end with the spoken duration ("… 1 minute, 3 seconds"); drop it
      return text.replace(/\s+/g, " ")
        .replace(/\s+(\d+ (hours?|minutes?|seconds?),?\s*)+$/i, "")
        .trim() || "YouTube Video";
    };

    const injectStyles = () => {
      if (document.getElementById("mediadrop-yt-styles")) return;
      const style = document.createElement("style");
      style.id = "mediadrop-yt-styles";
      style.textContent = `
        .mediadrop-thumb-btn {
          position: absolute; top: 6px; left: 6px; z-index: 1000;
          width: 30px; height: 30px; padding: 0; margin: 0;
          display: flex; align-items: center; justify-content: center;
          border: none; border-radius: 50%; cursor: pointer;
          background: rgba(10, 12, 18, 0.78); color: #fff;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
          opacity: 0.9; transition: opacity .15s, background .15s, color .15s;
        }
        a:hover > .mediadrop-thumb-btn { opacity: 1; }
        .mediadrop-thumb-btn:hover { background: #fff; color: #0f0f0f; }
        .mediadrop-thumb-btn.is-sent { background: #fff; color: #0f0f0f; }
        .mediadrop-thumb-btn svg { width: 16px; height: 16px; fill: currentColor; pointer-events: none; }
        #btn-mediadrop {
          display: inline-flex; align-items: center; gap: 6px; margin: 0 8px 0 0; padding: 0 16px; height: 36px;
          border: none; border-radius: 18px; cursor: pointer; font: 500 14px Roboto, Arial, sans-serif; white-space: nowrap; flex-shrink: 0;
          background: var(--yt-spec-badge-chip-background, rgba(255, 255, 255, 0.1)); color: var(--yt-spec-text-primary, #f1f1f1);
        }
        #btn-mediadrop svg { width: 20px; height: 20px; fill: currentColor; }
        #btn-mediadrop:hover { background: var(--yt-spec-button-chip-background-hover, rgba(255, 255, 255, 0.2)); }
      `;
      (document.head || document.documentElement).appendChild(style);
    };

    // YouTube enforces Trusted Types, so build markup with DOM APIs (no innerHTML).
    const SVG_NS = "http://www.w3.org/2000/svg";
    const downloadIcon = () => {
      const svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("aria-hidden", "true");
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", "M11 4h2v8.6l3.3-3.3 1.4 1.4L12 16.4l-5.7-5.7 1.4-1.4 3.3 3.3V4zM5 18h14v2H5z");
      svg.appendChild(path);
      return svg;
    };

    const swallow = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    const addThumbButton = (link) => {
      if (link.querySelector(":scope > .mediadrop-thumb-btn")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mediadrop-thumb-btn";
      btn.title = "Choose a format and import into Premiere Pro";
      btn.setAttribute("aria-label", "Choose a format and import into Premiere Pro");
      btn.appendChild(downloadIcon());
      ["pointerdown", "mousedown", "mouseup", "touchstart"].forEach((t) => btn.addEventListener(t, (e) => e.stopPropagation(), true));
      btn.addEventListener("click", (e) => {
        swallow(e);
        // YouTube recycles cards, so read the link at click time.
        const url = canonicalVideoUrl(link.getAttribute("href"));
        if (!url) return;
        ipcRenderer.sendToHost("youtube-import-trigger", { url, title: titleFor(link) });
        btn.classList.add("is-sent");
        setTimeout(() => btn.classList.remove("is-sent"), 1500);
      }, true);
      if (getComputedStyle(link).position === "static") link.style.position = "relative";
      link.appendChild(btn);
    };

    const addWatchButton = () => {
      if (!/^\/(watch|shorts\/)/.test(location.pathname) || document.getElementById("btn-mediadrop")) return;
      const target = document.querySelector("ytd-watch-metadata #top-level-buttons-computed") ||
                     document.querySelector("ytd-watch-metadata #actions") ||
                     document.querySelector("ytd-reel-player-overlay-renderer #actions");
      if (!target) return;
      const btn = document.createElement("button");
      btn.id = "btn-mediadrop";
      btn.type = "button";
      btn.title = "Choose a format and import into Premiere Pro";
      const label = document.createElement("span");
      label.textContent = "Download";
      btn.append(downloadIcon(), label);
      btn.addEventListener("click", (e) => {
        swallow(e);
        const heading = document.querySelector("ytd-watch-metadata h1");
        const title = (heading && heading.textContent.trim()) || document.title.replace(/ - YouTube$/, "").trim();
        ipcRenderer.sendToHost("youtube-import-trigger", { url: canonicalVideoUrl(location.href), title });
      });
      target.prepend(btn);
    };

    let scanQueued = false;
    const scan = () => {
      scanQueued = false;
      injectStyles();
      for (const link of document.querySelectorAll(THUMB_LINKS)) {
        if (link.querySelector("img")) addThumbButton(link);
      }
      addWatchButton();
    };
    const queueScan = () => {
      if (scanQueued) return;
      scanQueued = true;
      setTimeout(scan, 300);
    };

    const start = () => {
      new MutationObserver(queueScan).observe(document.documentElement, { childList: true, subtree: true });
      queueScan();
    };
    if (document.documentElement) start();
    else document.addEventListener("DOMContentLoaded", start, { once: true });
  }
})();
