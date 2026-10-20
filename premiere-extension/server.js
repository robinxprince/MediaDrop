const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 48200;
const csi = (typeof CSInterface !== "undefined") ? new CSInterface() : null;

const LOG_FILE = path.join(require("os").tmpdir(), "mediadrop-cep.log");
// Start a fresh log once it passes 1 MB so it can't grow forever
try { if (fs.statSync(LOG_FILE).size > 1024 * 1024) fs.unlinkSync(LOG_FILE); } catch (e) {}
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(line.trim());
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch (e) {}
}

log("Starting MediaDrop CEP Bridge on port " + PORT + "...");

const IMPORT_MODES = ["timeline", "bin", "source"];

// The MediaDrop panel lists these as "Recent imports"
const RECENT_FILE = path.join(require("os").tmpdir(), "mediadrop-recent.json");
function recordImport(result) {
  let where = `Project bin · ${result.bin || "MediaDrop Imports"}`;
  if (result.tracksFull) where = `Bin · ${result.bin} (no free track at the playhead)`;
  if (result.inserted) where = `Timeline · ${result.sequenceName}${result.trackName ? " · " + result.trackName : ""}`;
  else if (result.openedInSource) where = "Source Monitor";
  let items = [];
  try { items = JSON.parse(fs.readFileSync(RECENT_FILE, "utf8")); } catch (e) {}
  if (!Array.isArray(items)) items = [];
  items.unshift({ name: result.itemName, where, file: result.filePath, time: Date.now() });
  try { fs.writeFileSync(RECENT_FILE, JSON.stringify(items.slice(0, 20))); } catch (e) {}
}
const MAX_BODY_BYTES = 64 * 1024;

function importToPremiere(filePath, mode, bin) {
  return new Promise((resolve, reject) => {
    if (!csi) return reject(new Error("CSInterface unavailable inside CEP runtime"));
    // JSON.stringify yields a valid, fully escaped ExtendScript string literal
    const script = `importMediaFile(${JSON.stringify(filePath)}, ${JSON.stringify(mode)}, ${JSON.stringify(bin || "")})`;
    log("evalScript: " + script);
    csi.evalScript(script, (result) => {
      log("evalScript result: " + result);
      try {
        const parsed = JSON.parse(result);
        if (parsed.ok) resolve(parsed);
        else reject(Object.assign(new Error(parsed.error || "ExtendScript error"), { code: parsed.code }));
      } catch (e) {
        reject(new Error("ExtendScript returned non-JSON: " + result));
      }
    });
  });
}

// Only the local MediaDrop app may drive the bridge. Browsers always attach an
// Origin header to cross-site POSTs, and a Host check blocks DNS-rebinding, so
// any web page the user visits is rejected while Node's http client is allowed.
function isTrustedLocalRequest(req) {
  const host = String(req.headers.host || "").toLowerCase();
  if (host !== `127.0.0.1:${PORT}` && host !== `localhost:${PORT}`) return false;
  return !req.headers.origin;
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function getProjectStatus() {
  return new Promise((resolve) => {
    if (!csi) return resolve({ ok: false, error: "CSInterface unavailable" });
    csi.evalScript("getProjectStatus()", (result) => {
      try {
        resolve(JSON.parse(result));
      } catch (e) {
        resolve({ ok: false, raw: result });
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  // /health is read-only and polled by the panel, so it stays open to any local caller.
  if (req.method === "GET" && req.url === "/health") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return sendJson(res, 200, { ok: true, status: "ready", port: PORT, timestamp: Date.now() });
  }

  if (!isTrustedLocalRequest(req)) {
    log(`Rejected ${req.method} ${req.url} (origin: ${req.headers.origin || "-"}, host: ${req.headers.host || "-"})`);
    return sendJson(res, 403, { ok: false, error: "Forbidden" });
  }

  if (req.method === "GET" && req.url === "/status") {
    const status = await getProjectStatus();
    return sendJson(res, 200, { ok: true, status });
  }

  if (req.method === "POST" && req.url === "/open-app") {
    log("Received /open-app request. Launching MediaDrop...");
    // 1. Try waking up running instance via surface server
    const pingSurface = http.get("http://127.0.0.1:48201/show", { timeout: 1000 }, (pRes) => {
      log("Surface server responded: HTTP " + pRes.statusCode);
      sendJson(res, 200, { ok: true, method: "surface" });
    });

    pingSurface.on("error", () => {
      // 2. App not running, launch standalone app
      log("Surface server not responding, launching MediaDrop...");
      MediaDropDesktop.launchApp((err) => log("Error launching app: " + err.message));
      sendJson(res, 200, { ok: true, method: "spawn" });
    });

    return;
  }

  if (req.method === "POST" && req.url === "/import") {
    let body = "";
    let tooLarge = false;
    req.on("data", chunk => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) { tooLarge = true; req.destroy(); }
    });
    req.on("end", async () => {
      if (tooLarge) return;
      try {
        const parsed = JSON.parse(body || "{}");
        const { filePath, insertToTimeline = true, mode, bin } = parsed;
        if (typeof filePath !== "string" || !path.isAbsolute(filePath)) {
          throw new Error("'filePath' must be an absolute path");
        }
        const targetMode = mode || (insertToTimeline ? "timeline" : "bin");
        if (!IMPORT_MODES.includes(targetMode)) throw new Error("Invalid mode: " + targetMode);
        if (bin !== undefined && !(typeof bin === "string" && /^[\w .-]{0,40}$/.test(bin))) throw new Error("Invalid bin name");

        log(`Received import request for: "${filePath}" (mode: ${targetMode})`);
        const result = await importToPremiere(filePath, targetMode, bin);
        recordImport({ ...result, filePath });
        sendJson(res, 200, { ok: true, result });
      } catch (err) {
        log(`Import error: ${err.message}`);
        sendJson(res, 500, { ok: false, error: err.message, code: err.code });
      }
    });
  } else {
    sendJson(res, 404, { ok: false, error: "Not found" });
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    log(`Port ${PORT} is already in use. MediaDrop Bridge may already be running.`);
  } else {
    log(`Server error: ${err.message}`);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  log(`MediaDrop CEP server listening on 127.0.0.1:${PORT}`);
});

// Broadcast server status to CEP environment
if (typeof window !== "undefined") {
  window.__mediadrop_server = server;
}
