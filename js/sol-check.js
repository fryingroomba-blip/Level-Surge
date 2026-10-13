/**
 * Headless sol validation for handmade levels.
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc js/sol-check.js
 */
var store = {};
var listeners = {};
function El(tag, id) {
  this.tagName = (tag || "div").toUpperCase();
  this.id = id || "";
  this.className = "";
  this.style = {};
  this.textContent = "";
  this.innerHTML = "";
  this.value = "";
  this.disabled = false;
  this.children = [];
  this.onclick = null;
  this._listeners = {};
}
El.prototype.appendChild = function (c) { this.children.push(c); return c; };
El.prototype.addEventListener = function (t, fn) {
  (this._listeners[t] = this._listeners[t] || []).push(fn);
};
El.prototype.removeEventListener = function () {};
El.prototype.getBoundingClientRect = function () {
  return { width: 960, height: 540, top: 0, left: 0, right: 960, bottom: 540 };
};
El.prototype.focus = function () {};
Object.defineProperty(El.prototype, "classList", {
  get: function () {
    var self = this;
    return {
      add: function (c) {
        var parts = self.className ? self.className.split(/\s+/) : [];
        if (parts.indexOf(c) < 0) parts.push(c);
        self.className = parts.join(" ").trim();
      },
      remove: function (c) {
        self.className = self.className.split(/\s+/).filter(function (x) { return x && x !== c; }).join(" ");
      },
      contains: function (c) {
        return self.className.split(/\s+/).indexOf(c) >= 0;
      },
      toggle: function (c, force) {
        var has = this.contains(c);
        if (force === true || (!has && force !== false)) this.add(c);
        else this.remove(c);
      },
    };
  },
});
var els = {};
function ensure(id, tag) {
  if (!els[id]) els[id] = new El(tag || "div", id);
  return els[id];
}
[
  "game", "hud", "title-screen", "clear-screen", "win-screen", "pause-screen",
  "levels-screen", "toast", "level-num", "level-name", "deaths", "trap-count",
  "timer", "combo-hud", "mute-btn", "pause-btn", "mobile", "dim-name",
  "room-pips", "shard-hud", "dim-card", "btn-dash", "play-btn", "again-btn",
  "next-dim-btn", "levels-btn", "levels-back", "resume-btn", "retry-btn",
  "quit-btn", "clear-name", "clear-stats", "win-rating", "win-stats", "win-best",
  "pause-name", "records", "level-grid", "dim-card-num", "dim-card-name",
  "dim-card-lore", "btn-left", "btn-right", "btn-jump",
].forEach(function (id) { ensure(id, id === "game" ? "canvas" : "div"); });
var canvasCtx = {
  fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
  globalCompositeOperation: "source-over", font: "", textAlign: "", letterSpacing: "",
  shadowColor: "", shadowBlur: 0,
  save: function () {}, restore: function () {},
  translate: function () {}, scale: function () {}, rotate: function () {},
  fillRect: function () {}, strokeRect: function () {}, clearRect: function () {},
  beginPath: function () {}, closePath: function () {}, moveTo: function () {},
  lineTo: function () {}, arc: function () {}, ellipse: function () {},
  fill: function () {}, stroke: function () {},
  createLinearGradient: function () { return { addColorStop: function () {} }; },
  createRadialGradient: function () { return { addColorStop: function () {} }; },
  measureText: function () { return { width: 10 }; },
  fillText: function () {}, strokeText: function () {},
  quadraticCurveTo: function () {},
};
els.game.getContext = function () { return canvasCtx; };
els.game.width = 960;
els.game.height = 540;
var document = {
  getElementById: function (id) { return ensure(id); },
  createElement: function (tag) { return new El(tag); },
  addEventListener: function (t, fn) {
    (listeners[t] = listeners[t] || []).push(fn);
  },
  body: new El("body"),
};
var window = this;
window.document = document;
window.devicePixelRatio = 1;
window.AudioContext = null;
window.webkitAudioContext = null;
window.matchMedia = function () {
  return { matches: false, addListener: function () {}, addEventListener: function () {} };
};
window.localStorage = {
  getItem: function (k) { return store[k] || null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; },
};
window.addEventListener = function (t, fn) {
  (listeners[t] = listeners[t] || []).push(fn);
};
window.requestAnimationFrame = function () { return 0; };
window.performance = { now: function () { return Date.now(); } };
window.setTimeout = function (fn) { return 0; };
window.clearTimeout = function () {};
window.globalThis = window;

load("js/levels.js");
load("js/tracks.js");
load("js/worlds.js");
try { load("js/roast.js"); } catch (e) {}
load("js/game.js");

print("--- playSolAll ---");
var sols = __GAME.playSolAll();
var fails = [];
sols.forEach(function (r) {
  print((r.i + 1) + " " + r.name + " win=" + r.win + " dead=" + r.dead +
    " reason=" + (r.reason || "") + " x=" + r.x + " frames=" + r.frames + " traps=" + r.traps);
  if (!r.win) fails.push(r.i);
});
print("solWins=" + sols.filter(function (r) { return r.win; }).length + "/" + sols.length);

if (fails.length) {
  print("--- searchSol for fails ---");
  fails.forEach(function (i) {
    var r = __GAME.searchSol(i, 120);
    print("search " + (i + 1) + " " + r.name + " win=" + r.win +
      " found=" + (r.found || "none") + " reason=" + (r.reason || "") + " x=" + r.x);
    if (r.win && r.found) {
      HAND_LEVELS[i].sol = r.found;
      print("UPDATED SOL #" + (i + 1) + ": " + r.found);
    }
  });
}

print("--- rare + entity action smoke ---");
var rares = ["slip","jumpCut","magnet","blink","clamp","echo","sticky","rift","blackout","heavy"];
var ents = ["stalker","drone","rocket","voidFog","watcher","sentry","swarm","phantom","huntLight","crushBot"];
LEVELS = HAND_LEVELS.slice();
window.LEVELS = LEVELS;
__GAME.startGame(0);
__GAME.loadLevel(0);
rares.concat(ents).forEach(function (t) {
  try {
    if (t === "slip") __GAME.runAction(["slip", 0.2]);
    else if (t === "jumpCut") __GAME.runAction(["jumpCut", 0.6, 0.2]);
    else if (t === "magnet") __GAME.runAction(["magnet", 10, 0.1, 0.2]);
    else if (t === "blink") __GAME.runAction(["blink", 2, 8, 1, 1, 0.2]);
    else if (t === "clamp") __GAME.runAction(["clamp", 4, 8, 0.2]);
    else if (t === "echo") __GAME.runAction(["echo", 0.2]);
    else if (t === "sticky") __GAME.runAction(["sticky", 0.2]);
    else if (t === "rift") __GAME.runAction(["rift", 0.3]);
    else if (t === "blackout") __GAME.runAction(["blackout", 0.2]);
    else if (t === "heavy") __GAME.runAction(["heavy", 1.3, 0.2]);
    else if (t === "stalker") __GAME.runAction(["stalker", 70, 0.3, 3]);
    else if (t === "drone") __GAME.runAction(["drone", 4, 3, 0.3]);
    else if (t === "rocket") __GAME.runAction(["rocket", 1, 8, 0.3, 0.05]);
    else if (t === "voidFog") __GAME.runAction(["voidFog", 0.3]);
    else if (t === "watcher") __GAME.runAction(["watcher", 10, 2, 0.3]);
    else if (t === "sentry") __GAME.runAction(["sentry", 1, 8, 0.3]);
    else if (t === "swarm") __GAME.runAction(["swarm", 6, 1, 2]);
    else if (t === "phantom") __GAME.runAction(["phantom", 0.3]);
    else if (t === "huntLight") __GAME.runAction(["huntLight", 0.3, 70]);
    else if (t === "crushBot") __GAME.runAction(["crushBot", 4, 0.4, 5]);
    print("OK " + t);
  } catch (e) {
    print("FAIL " + t + ": " + e);
  }
});

print("--- dim rare/entity placement sample ---");
for (var d = 4; d <= 14; d++) {
  var lvls = SURGE_WORLDS.generate(d);
  var rareCount = 0;
  var entCount = 0;
  var kinds = {};
  lvls.forEach(function (lvl) {
    (lvl.events || []).forEach(function (ev) {
      (ev.do || []).forEach(function (a) {
        if (rares.indexOf(a[0]) >= 0) {
          rareCount++;
          kinds[a[0]] = (kinds[a[0]] || 0) + 1;
        }
        if (ents.indexOf(a[0]) >= 0) {
          entCount++;
          kinds[a[0]] = (kinds[a[0]] || 0) + 1;
        }
      });
    });
  });
  print("D" + d + " rares=" + rareCount + " ents=" + entCount + " kinds=" + JSON.stringify(kinds));
}

var finalFails = __GAME.playSolAll().filter(function (r) { return !r.win; });
print("---");
if (finalFails.length) {
  print("RESULT: FAIL unbeatable=" + finalFails.map(function (r) { return r.name; }).join(","));
  throw new Error("unbeatable levels");
}
print("RESULT: ALL LEVELS BEATABLE");
