/**
 * MediaDrop Host ExtendScript for Adobe Premiere Pro
 * Manages asset ingestion and timeline placement.
 */

if (typeof JSON === "undefined") {
    JSON = {
        stringify: function (obj) {
            var t = typeof obj;
            if (t !== "object" || obj === null) {
                if (t === "string") return '"' + obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r") + '"';
                return String(obj);
            }
            var json = [], isArr = (obj && obj.constructor === Array);
            for (var n in obj) {
                if (obj.hasOwnProperty(n)) {
                    var v = obj[n];
                    var vt = typeof v;
                    if (vt === "string") v = '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r") + '"';
                    else if (vt === "object" && v !== null) v = JSON.stringify(v);
                    json.push((isArr ? "" : '"' + n + '":') + String(v));
                }
            }
            return (isArr ? "[" : "{") + String(json) + (isArr ? "]" : "}");
        }
    };
}

function findOrCreateBin(binName, parent) {
    parent = parent || app.project.rootItem;
    for (var i = 0; i < parent.children.numItems; i++) {
        var child = parent.children[i];
        if (child && child.name === binName && child.type === 2 /* BIN */) {
            return child;
        }
    }
    try {
        return parent.createBin(binName);
    } catch (e) {
        return parent;
    }
}

function isAudioOnlyPath(p) {
    if (!p) return false;
    var ext = String(p).split('.').pop().toLowerCase();
    var audioExts = { "wav": 1, "mp3": 1, "aif": 1, "aiff": 1, "m4a": 1, "aac": 1, "flac": 1, "ogg": 1, "wma": 1 };
    return audioExts[ext] === 1;
}

function isStillPath(p) {
    return /\.(png|jpe?g|gif|webp|bmp|tiff?|psd)$/i.test(String(p || ""));
}

function targetedIndex(tracks) {
    for (var i = 0; i < tracks.numTracks; i++) {
        var t = tracks[i];
        if (t && typeof t.isTargeted === "function" && t.isTargeted()) return i;
    }
    return 0;
}

// True when nothing on the track overlaps [start, end) and the track isn't locked
function trackIsFree(track, start, end) {
    if (!track) return true;
    try { if (typeof track.isLocked === "function" && track.isLocked()) return false; } catch (e) {}
    var clips = track.clips;
    for (var i = 0; i < clips.numItems; i++) {
        var c = clips[i];
        if (c.start.seconds < end - 0.001 && c.end.seconds > start + 0.001) return false;
    }
    return true;
}

function itemDurationSeconds(item, filePath) {
    var d = 0;
    try { d = item.getOutPoint().seconds - item.getInPoint().seconds; } catch (e) {}
    // Stills take Premiere's default still duration; check a generous window for them
    if (isStillPath(filePath) || !(d > 0) || d > 6 * 3600) d = 10;
    return d;
}

// Adds empty tracks above the existing ones until track `index` exists in both lists
function addTracksUpTo(seq, index) {
    var addV = Math.max(0, index + 1 - seq.videoTracks.numTracks);
    var addA = Math.max(0, index + 1 - seq.audioTracks.numTracks);
    if (!addV && !addA) return true;
    try {
        app.enableQE();
        var qeSeq = qe.project.getActiveSequence();
        // addTracks(videoCount, videoAfterIndex, audioCount, audioType 1 = stereo, audioAfterIndex)
        qeSeq.addTracks(addV, seq.videoTracks.numTracks, addA, 1, seq.audioTracks.numTracks);
    } catch (e) {
        return false;
    }
    return seq.videoTracks.numTracks > index && seq.audioTracks.numTracks > index;
}

// Places the clip at the playhead on the first track pair, from the targeted track up,
// where it overlaps nothing. Existing clips are never moved, trimmed or covered.
function placeWithoutOverlap(seq, item, filePath) {
    var isAudio = isAudioOnlyPath(filePath);
    var start = seq.getPlayerPosition();
    var end = start.seconds + itemDurationSeconds(item, filePath);
    // Track collections go stale once tracks are added, so always read them fresh
    var mainTracks = function () { return isAudio ? seq.audioTracks : seq.videoTracks; };
    var from = targetedIndex(mainTracks());
    var limit = Math.max(seq.videoTracks.numTracks, seq.audioTracks.numTracks) + 1;

    for (var i = from; i < limit; i++) {
        var isNew = i >= mainTracks().numTracks || (!isAudio && i >= seq.audioTracks.numTracks);
        if (isNew && !addTracksUpTo(seq, i)) break;
        var track = mainTracks()[i];
        var free = trackIsFree(track, start.seconds, end) &&
            (isAudio || isStillPath(filePath) || trackIsFree(seq.audioTracks[i], start.seconds, end));
        if (!free) continue;
        track.overwriteClip(item, start);
        return { placed: true, trackName: track.name || ((isAudio ? "A" : "V") + (i + 1)), addedTrack: isNew, playheadSeconds: String(start.seconds) };
    }
    return { placed: false };
}

function normalizePath(p) {
    return String(p || "").replace(/\\/g, "/").toLowerCase();
}

// Find the project item for filePath, newest first. Falls back to the bin's last
// child only if no item reports a matching media path.
function findImportedItem(bin, filePath) {
    if (!bin || !bin.children || bin.children.numItems === 0) return null;
    var wanted = normalizePath(filePath);
    for (var i = bin.children.numItems - 1; i >= 0; i--) {
        var child = bin.children[i];
        try {
            if (child && typeof child.getMediaPath === "function" && normalizePath(child.getMediaPath()) === wanted) {
                return child;
            }
        } catch (e) {}
    }
    return bin.children[bin.children.numItems - 1];
}

function findItemInProject(filePath) {
    try {
        var matches = app.project.rootItem.findItemsMatchingMediaPath(filePath, true);
        if (matches && matches.length > 0) return matches[0];
    } catch (e) {}
    return null;
}

// MOGRTs can't go through importFiles; Premiere places them straight onto a sequence.
function importMogrt(filePath, seq) {
    if (!seq) {
        return JSON.stringify({ ok: false, error: "Open a sequence first: Motion Graphics Templates are placed directly on the timeline." });
    }
    if (typeof seq.importMGT !== "function") {
        return JSON.stringify({ ok: false, error: "This Premiere Pro version doesn't support importing .mogrt files by script." });
    }
    var playhead = seq.getPlayerPosition();
    var vIndex = 0;
    for (var i = 0; i < seq.videoTracks.numTracks; i++) {
        var t = seq.videoTracks[i];
        if (t && typeof t.isTargeted === "function" && t.isTargeted()) { vIndex = i; break; }
    }
    var trackItem = seq.importMGT(filePath, playhead.ticks, vIndex, 0);
    if (!trackItem) {
        return JSON.stringify({ ok: false, error: "Premiere failed to import the Motion Graphics Template." });
    }
    return JSON.stringify({
        ok: true,
        mode: "timeline",
        itemName: trackItem.name,
        bin: null,
        inserted: true,
        openedInSource: false,
        trackName: seq.videoTracks[vIndex].name,
        sequenceName: seq.name,
        playheadSeconds: String(playhead.seconds)
    });
}

function importMediaFile(filePath, modeOrInsertToTimeline, subBinName) {
    if (!filePath) {
        return JSON.stringify({ ok: false, error: "No file path provided" });
    }

    if (!hasOpenProject()) {
        return JSON.stringify({ ok: false, code: "NO_PROJECT", error: "No project is open in Premiere Pro." });
    }

    var targetFile = new File(filePath);
    if (!targetFile.exists) {
        return JSON.stringify({
            ok: false,
            error: "Target file does not exist on disk: " + filePath
        });
    }

    // Determine target mode: "timeline", "bin", or "source"
    var mode = "timeline";
    if (typeof modeOrInsertToTimeline === "boolean") {
        mode = modeOrInsertToTimeline ? "timeline" : "bin";
    } else if (typeof modeOrInsertToTimeline === "string") {
        mode = modeOrInsertToTimeline;
    }

    if (String(filePath).toLowerCase().match(/\.mogrt$/)) {
        try {
            return importMogrt(filePath, app.project.activeSequence);
        } catch (eMogrt) {
            return JSON.stringify({ ok: false, error: "MOGRT import failed: " + eMogrt.toString() });
        }
    }

    // Imports go to "MediaDrop Imports", optionally one sub-bin per site
    var targetBin = findOrCreateBin("MediaDrop Imports");
    if (subBinName) targetBin = findOrCreateBin(subBinName, targetBin);

    // A file that's already in the project is reused instead of imported twice
    var importedItem = findItemInProject(filePath);
    var reused = !!importedItem;
    if (!importedItem) {
        var importBin = targetBin;
        var success = app.project.importFiles([filePath], true, importBin, false);
        if (!success) {
            importBin = app.project.rootItem;
            success = app.project.importFiles([filePath], true, importBin, false);
            if (!success) {
                return JSON.stringify({ ok: false, error: "Premiere couldn't import " + targetFile.name + ". The file type may not be supported." });
            }
        }
        importedItem = findImportedItem(importBin, filePath);
    }

    var seq = app.project.activeSequence;
    var inserted = false;
    var openedInSource = false;
    var trackName = "";
    var playheadTime = "";
    var addedTrack = false;
    var tracksFull = false;

    if (mode === "source") {
        try {
            if (app.sourceMonitor) {
                if (importedItem && typeof app.sourceMonitor.openProjectItem === "function") {
                    app.sourceMonitor.openProjectItem(importedItem);
                    openedInSource = true;
                } else if (typeof app.sourceMonitor.openFilePath === "function") {
                    app.sourceMonitor.openFilePath(filePath);
                    openedInSource = true;
                }
            }
        } catch (eSource) {}
    } else if (mode === "timeline" && seq && importedItem) {
        try {
            var placed = placeWithoutOverlap(seq, importedItem, filePath);
            inserted = placed.placed;
            tracksFull = !placed.placed;
            trackName = placed.trackName || "";
            playheadTime = placed.playheadSeconds || "";
            addedTrack = !!placed.addedTrack;
        } catch (eTimeline) {}
    }

    return JSON.stringify({
        ok: true,
        mode: mode,
        itemName: importedItem ? importedItem.name : targetFile.name,
        bin: targetBin ? targetBin.name : "Root",
        projectName: String(app.project.name || "").replace(/\.prproj$/i, ""),
        reused: reused,
        addedTrack: addedTrack,
        tracksFull: tracksFull,
        inserted: inserted,
        openedInSource: openedInSource,
        trackName: trackName,
        sequenceName: seq ? seq.name : null,
        playheadSeconds: playheadTime
    });
}

function hasOpenProject() {
    try {
        return !!(app.project && app.project.rootItem && app.project.path);
    } catch (e) {
        return false;
    }
}

function getProjectStatus() {
    if (!hasOpenProject()) {
        return JSON.stringify({ ok: false, open: false, error: "No project open" });
    }
    var seq = app.project.activeSequence;
    return JSON.stringify({
        ok: true,
        open: true,
        projectName: String(app.project.name || "Untitled").replace(/\.prproj$/i, ""),
        projectPath: String(app.project.path || ""),
        activeSequence: seq ? seq.name : null,
        numVideoTracks: seq ? seq.videoTracks.numTracks : 0,
        numAudioTracks: seq ? seq.audioTracks.numTracks : 0
    });
}
