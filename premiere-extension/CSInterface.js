/**
 * CSInterface v11.0.0
 * Adobe Common Extensibility Platform (CEP) Interface
 */

var CSInterface = function () {
    this.inCEP = typeof window.__adobe_cep__ !== "undefined";
    this.hostEnvironment = null;
};

var SystemPath = {
    USER_DATA: "userData",
    COMMON_FILES: "commonFiles",
    MY_DOCUMENTS: "myDocuments",
    APPLICATION: "application",
    EXTENSION: "extension",
    HOST_APPLICATION: "hostApplication"
};

var RGBColor = function (red, green, blue, alpha) {
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.alpha = alpha;
};

var ColorType = {
    RGB: "RGB"
};

var UIColor = function (type, antialiasLevel, color) {
    this.type = type;
    this.antialiasLevel = antialiasLevel;
    this.color = color;
};

var AppSkinInfo = function (baseFontFamily, baseFontSize, appBarBackgroundColor, panelBackgroundColor, appBarBackgroundColorSRGB, panelBackgroundColorSRGB, systemHighlightColor) {
    this.baseFontFamily = baseFontFamily;
    this.baseFontSize = baseFontSize;
    this.appBarBackgroundColor = appBarBackgroundColor;
    this.panelBackgroundColor = panelBackgroundColor;
    this.appBarBackgroundColorSRGB = appBarBackgroundColorSRGB;
    this.panelBackgroundColorSRGB = panelBackgroundColorSRGB;
    this.systemHighlightColor = systemHighlightColor;
};

var HostEnvironment = function (appName, appVersion, appLocale, appUILocale, appId, isAppOnline, appSkinInfo) {
    this.appName = appName;
    this.appVersion = appVersion;
    this.appLocale = appLocale;
    this.appUILocale = appUILocale;
    this.appId = appId;
    this.isAppOnline = isAppOnline;
    this.appSkinInfo = appSkinInfo;
};

var CSEvent = function (type, scope, appId, extensionId) {
    this.type = type;
    this.scope = scope || "GLOBAL";
    this.appId = appId;
    this.extensionId = extensionId;
    this.data = "";
};

CSInterface.THEME_COLOR_CHANGED_EVENT = "com.adobe.csxs.events.ThemeColorChanged";

CSInterface.prototype.getHostEnvironment = function () {
    if (this.inCEP && window.__adobe_cep__ && typeof window.__adobe_cep__.getHostEnvironment === "function") {
        this.hostEnvironment = JSON.parse(window.__adobe_cep__.getHostEnvironment());
        return this.hostEnvironment;
    }
    return {
        appName: "PPRO",
        appVersion: "24.0.0",
        appLocale: "en_US",
        appUILocale: "en_US",
        appId: "PPRO",
        isAppOnline: true,
        appSkinInfo: {
            baseFontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
            baseFontSize: 12,
            panelBackgroundColor: { color: { red: 32, green: 32, blue: 36, alpha: 255 } },
            systemHighlightColor: { color: { red: 167, green: 139, blue: 250, alpha: 255 } }
        }
    };
};

CSInterface.prototype.evalScript = function (script, callback) {
    if (this.inCEP && window.__adobe_cep__ && typeof window.__adobe_cep__.evalScript === "function") {
        if (callback === null || typeof callback === "undefined") {
            callback = function () {};
        }
        window.__adobe_cep__.evalScript(script, callback);
    } else if (typeof callback === "function") {
        callback(JSON.stringify({ ok: false, error: "Not in CEP environment" }));
    }
};

CSInterface.prototype.addEventListener = function (type, listener, obj) {
    if (this.inCEP && window.__adobe_cep__) {
        window.__adobe_cep__.addEventListener(type, listener, obj);
    } else {
        window.addEventListener(type, listener);
    }
};

CSInterface.prototype.removeEventListener = function (type, listener, obj) {
    if (this.inCEP && window.__adobe_cep__) {
        window.__adobe_cep__.removeEventListener(type, listener, obj);
    } else {
        window.removeEventListener(type, listener);
    }
};

CSInterface.prototype.dispatchEvent = function (event) {
    if (this.inCEP && window.__adobe_cep__) {
        window.__adobe_cep__.dispatchEvent(event);
    }
};

CSInterface.prototype.openURLInDefaultBrowser = function (url) {
    if (typeof cep !== "undefined" && cep.util && cep.util.openURLInDefaultBrowser) {
        cep.util.openURLInDefaultBrowser(url);
    } else if (this.inCEP && window.__adobe_cep__) {
        window.__adobe_cep__.openURLInDefaultBrowser(url);
    } else {
        window.open(url, "_blank");
    }
};

CSInterface.prototype.closeExtension = function () {
    if (this.inCEP && window.__adobe_cep__) {
        window.__adobe_cep__.closeExtension();
    }
};

CSInterface.prototype.getSystemPath = function (pathType) {
    if (this.inCEP && window.__adobe_cep__ && typeof window.__adobe_cep__.getSystemPath === "function") {
        var path = window.__adobe_cep__.getSystemPath(pathType);
        var OSVersion = window.__adobe_cep__.getOSInformation ? window.__adobe_cep__.getOSInformation() : "";
        if (OSVersion && OSVersion.indexOf("Windows") >= 0) {
            path = path.replace("file:///", "");
            path = path.replace(/\\/g, "/");
        } else {
            path = path.replace("file://", "");
        }
        return decodeURI(path);
    }
    return "";
};
