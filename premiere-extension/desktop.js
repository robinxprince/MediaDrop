// What differs between macOS and Windows for the bridge (server.js) and the panel (panel.js):
// where the MediaDrop app lives and keeps its settings, how to open it and how to show a file
var MediaDropDesktop = (function () {
  if (typeof require !== "function") return null;
  const cp = require("child_process");
  const os = require("os");
  const path = require("path");
  const isWin = process.platform === "win32";

  // Install MediaDrop.cmd puts the app here on Windows
  const winExe = isWin && path.join(process.env.LOCALAPPDATA || "", "Programs", "MediaDrop", "MediaDrop.exe");

  return {
    installerName: isWin ? "Install MediaDrop.cmd" : "Install MediaDrop.command",

    // Electron's userData folder for the app named "mediadrop"
    appSettingsFile: isWin
      ? path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "mediadrop", "mediadrop-settings.json")
      : path.join(os.homedir(), "Library", "Application Support", "mediadrop", "mediadrop-settings.json"),

    // callback(err) runs only if MediaDrop couldn't be started
    launchApp(callback) {
      if (!isWin) return cp.execFile("/usr/bin/open", ["-a", "MediaDrop"], (err) => { if (err) callback(err); });
      const child = cp.spawn(winExe, [], { detached: true, stdio: "ignore" });
      child.on("error", callback);
      child.unref();
    },

    reveal(file) {
      if (isWin) cp.spawn("explorer.exe", [`/select,${file}`], { detached: true, stdio: "ignore" }).unref();
      else cp.execFile("/usr/bin/open", ["-R", file], () => {});
    }
  };
})();
