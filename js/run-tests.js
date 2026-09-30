/**
 * Headless self-test for Level Surge (macOS JavaScriptCore).
 * Run from project root:
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc js/run-tests.js
 */
var __TEST_ERRORS = [];
var __TEST_LOGS = [];
function out(s) { __TEST_LOGS.push(String(s)); print(s); }
function fail(s) { __TEST_ERRORS.push(String(s)); out("FAIL: " + s); }

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

out("--- Level Surge headless tests ---");

try {
  load("js/levels.js");
  load("js/worlds.js");
  try { load("js/roast.js"); } catch (e) { out("roast.js skipped: " + e); }
  load("js/game.js");
} catch (e) {
  fail("script load: " + e);
  throw e;
}

out("HAND_LEVELS: " + (HAND_LEVELS && HAND_LEVELS.length));
out("SURGE_WORLDS: " + (SURGE_WORLDS && SURGE_WORLDS.count));
out("__GAME: " + (!!__GAME));

if (!HAND_LEVELS || !HAND_LEVELS.length) fail("HAND_LEVELS missing");
if (!SURGE_WORLDS) fail("SURGE_WORLDS missing");
if (!__GAME) fail("__GAME missing");

if (SURGE_WORLDS) {
  for (var d = 1; d <= 20; d++) {
    var lvls = SURGE_WORLDS.generate(d);
    var n = SURGE_WORLDS.roomCount(d);
    var t = SURGE_WORLDS.trapCount(d);
    if (lvls.length !== n) fail("D" + d + " rooms " + lvls.length + " != " + n);
    var want = d === 1 ? 10 : t;
    if (lvls[0].events.length !== want) fail("D" + d + " traps0 " + lvls[0].events.length + " != " + want);
    if (d > 1) {
      var last = lvls[lvls.length - 1];
      if (last.events.length !== t + 4) fail("D" + d + " boss traps " + last.events.length + " != " + (t + 4));
    }
    if (!SURGE_WORLDS.theme(d) || !SURGE_WORLDS.theme(d).name) fail("D" + d + " missing theme");
  }
  out("World generate/theme: OK");
}

var ACTIONS = {
  hole:1, fill:1, spikes:1, clearRowHazards:1, shake:1, say:1, sfx:1,
  reverse:1, gravity:1, moveDoor:1, chase:1, saw:1, queue:1,
  teleport:1, push:1, lock:1, laser:1, wind:1, platform:1, drop:1,
  hideDoor:1, showDoor:1, swapDoor:1, slow:1,
  dust:1, flash:1, whisper:1, glow:1, lie:1,
};
var IF_KEYS = {
  x:1, beenPast:1, xLess:1, time:1, jump:1, before:1, jumpAfter:1,
  door:1, y:1, land:1, still:1, zone:1,
  air:1, ground:1, falling:1, jumps:1, vxMin:1, vxLess:1,
};
function walkAction(a, tag) {
  if (!a || !a.length) { fail(tag + " empty action"); return; }
  if (!ACTIONS[a[0]]) fail(tag + " unknown action " + a[0]);
  if (a[0] === "queue") {
    for (var i = 2; i < a.length; i++) walkAction(a[i], tag + ".q");
  }
}
HAND_LEVELS.forEach(function (lvl, i) {
  var tag = "#" + (i + 1) + " " + (lvl.name || "?");
  if (!lvl.events || lvl.events.length !== 10) fail(tag + " expected 10 traps got " + (lvl.events && lvl.events.length));
  (lvl.events || []).forEach(function (ev, ei) {
    Object.keys(ev.if || {}).forEach(function (k) {
      if (!IF_KEYS[k]) fail(tag + " trap " + ei + " unknown if." + k);
    });
    (ev.do || []).forEach(function (a, ai) { walkAction(a, tag + " ." + ai); });
  });
  if ((lvl.map || []).join("").indexOf("S") < 0) fail(tag + " missing S");
});
out("Handmade validate: " + (__TEST_ERRORS.length ? "issues logged" : "OK"));

if (__GAME) {
  out("Running unitTests...");
  try {
    var units = __GAME.unitTests();
    if (units && units.length) units.forEach(function (u) { fail("unit: " + u); });
    else out("unitTests: OK");
  } catch (e) {
    fail("unitTests threw: " + e);
  }

  out("Running smokeAllLevels...");
  try {
    var smoke = __GAME.smokeAllLevels();
    var bad = smoke.filter(function (s) { return !s.ok; });
    if (bad.length) {
      bad.forEach(function (s) { fail("smoke " + s.i + " " + s.name + ": " + (s.errors || []).join("; ")); });
    } else out("smokeAllLevels: OK (" + smoke.length + " rooms)");
  } catch (e) {
    fail("smokeAllLevels threw: " + e);
  }

  out("Running playtestAll (bot)...");
  try {
    var play = __GAME.playtestAll();
    var wins = play.filter(function (p) { return p.win; }).length;
    var dead = play.filter(function (p) { return p.dead; }).length;
    var stuck = play.filter(function (p) { return !p.win && !p.dead; }).length;
    out("playtest: wins=" + wins + " deaths=" + dead + " stuck=" + stuck + " / " + play.length);
    play.forEach(function (p) {
      if (!isFinite(p.x)) fail("playtest NaN x on " + p.name);
    });
  } catch (e) {
    fail("playtestAll threw: " + e);
  }

  out("Spot-check jumpPunish...");
  try {
    LEVELS = SURGE_WORLDS.generate(1);
    window.LEVELS = LEVELS;
    __GAME.startGame(0);
    __GAME.loadLevel(0);
    __GAME.player.x = 2 * 32;
    __GAME.player.y = 5 * 32;
    __GAME.world.jumped = true;
    __GAME.player.onGround = false;
    for (var f = 0; f < 30; f++) __GAME.step();
    var hasV = __GAME.world.tiles.some(function (row) { return row.indexOf("v") >= 0; });
    out("trapsFired=" + __GAME.world.trapsFired + " ceilingSpikes=" + hasV);
    if (!hasV) {
      // Direct action path
      __GAME.loadLevel(0);
      __GAME.runAction(["fill", 1, 5, 16, 1, "v"]);
      hasV = __GAME.world.tiles.some(function (row) { return row.indexOf("v") >= 0; });
      out("direct fill ceilingSpikes=" + hasV);
      if (!hasV) fail("fill action cannot place ceiling spikes");
      else {
        out("fill action OK; re-checking event match...");
        __GAME.loadLevel(0);
        __GAME.player.x = 2 * 32;
        __GAME.world.jumped = true;
        __GAME.player.onGround = false;
        var ev = __GAME.world.events[0];
        var matched = __GAME.matchEvent(ev);
        out("event0 match=" + matched + " if=" + JSON.stringify(ev.if));
        if (!matched) fail("jumpPunish matchEvent failed");
        else {
          for (var f2 = 0; f2 < 30; f2++) __GAME.step();
          hasV = __GAME.world.tiles.some(function (row) { return row.indexOf("v") >= 0; });
          out("after matched steps trapsFired=" + __GAME.world.trapsFired + " spikes=" + hasV);
          if (!hasV) fail("jumpPunish matched but never fired spikes");
          else out("jumpPunish lethal: OK");
        }
      }
    } else out("jumpPunish lethal: OK");
  } catch (e) {
    fail("trap spot-check threw: " + e);
  }
}

out("---");
if (__TEST_ERRORS.length) {
  out("RESULT: FAIL (" + __TEST_ERRORS.length + " issues)");
  __TEST_ERRORS.forEach(function (e) { out(" - " + e); });
  throw new Error("tests failed: " + __TEST_ERRORS.length);
}
out("RESULT: PASS");
