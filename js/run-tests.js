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

window.__SURGE_TEST__ = true;
out("--- Level Surge headless tests ---");

try {
  load("js/guard.js");
  load("js/levels.js");
  load("js/tracks.js");
  load("js/worlds.js");
  try { load("js/roast.js"); } catch (e) { out("roast.js skipped: " + e); }
  load("js/game.js");
} catch (e) {
  fail("script load: " + e);
  throw e;
}

out("HAND_LEVELS: " + (HAND_LEVELS && HAND_LEVELS.length));
out("SURGE_WORLDS: " + (SURGE_WORLDS && SURGE_WORLDS.count));
out("SURGE_TRACKS: " + (SURGE_TRACKS && SURGE_TRACKS.count));
out("__GAME: " + (!!__GAME));

if (!HAND_LEVELS || !HAND_LEVELS.length) fail("HAND_LEVELS missing");
if (!SURGE_WORLDS) fail("SURGE_WORLDS missing");
if (!SURGE_TRACKS || SURGE_TRACKS.count !== 20) fail("SURGE_TRACKS missing or not 20");
if (!__GAME) fail("__GAME missing");
if (!SURGE_GUARD) fail("SURGE_GUARD missing");

if (__GAME && __GAME.securitySelfTest) {
  try {
    var sec = __GAME.securitySelfTest();
    if (sec && sec.length) sec.forEach(function (s) { fail("security: " + s); });
    else out("securitySelfTest: OK");
  } catch (e) {
    fail("securitySelfTest threw: " + e);
  }
} else fail("securitySelfTest missing");

if (SURGE_TRACKS) {
  var ids = {};
  var styles = {};
  SURGE_TRACKS.TRACKS.forEach(function (tr, i) {
    if (!tr.id) fail("track " + (i + 1) + " missing id");
    if (ids[tr.id]) fail("duplicate track id " + tr.id);
    ids[tr.id] = 1;
    if (!tr.style) fail("track " + tr.id + " missing style");
    if (styles[tr.style]) fail("duplicate track style " + tr.style);
    styles[tr.style] = 1;
    if (!tr.prog || tr.prog.length < 3) fail("track " + tr.id + " bad prog");
    if (!tr.motif || !tr.scale) fail("track " + tr.id + " incomplete");
  });
  out("Soundtrack pack: OK (" + SURGE_TRACKS.count + " unique styles)");
}

if (SURGE_WORLDS) {
  for (var d = 1; d <= 20; d++) {
    var lvls = SURGE_WORLDS.generate(d);
    var n = SURGE_WORLDS.roomCount(d);
    var t = SURGE_WORLDS.trapCount(d);
    if (lvls.length !== n) fail("D" + d + " rooms " + lvls.length + " != " + n);
    var want = d === 1 ? 12 : t;
    if (lvls[0].events.length !== want) fail("D" + d + " traps0 " + lvls[0].events.length + " != " + want);
    if (d > 1) {
      var last = lvls[lvls.length - 1];
      if (last.events.length !== t + 4) fail("D" + d + " boss traps " + last.events.length + " != " + (t + 4));
    }
    if (!SURGE_WORLDS.theme(d) || !SURGE_WORLDS.theme(d).name) fail("D" + d + " missing theme");
  }
  out("World generate/theme: OK");
  var prevWin = 99;
  var prevPress = 0;
  for (var qd = 1; qd <= 20; qd++) {
    var spec = SURGE_WORLDS.qteAction(qd, function () { return 0.5; });
    if (!spec || spec[0] !== "qte") fail("D" + qd + " qte action missing");
    else {
      if (!(spec[1] < prevWin)) fail("D" + qd + " qte window " + spec[1] + " did not get tighter");
      var presses = spec.length - 2;
      if (presses < prevPress) fail("D" + qd + " qte lost presses");
      if (qd === 1 && presses !== 1) fail("D1 qte presses " + presses);
      if (qd === 20 && (presses < 6 || spec[1] > 0.32)) fail("D20 qte stayed easy " + spec[1] + " x" + presses);
      prevWin = spec[1];
      prevPress = presses;
    }
  }
  for (var early = 1; early <= 2; early++) {
    SURGE_WORLDS.generate(early).forEach(function (lvl, i) {
      (lvl.events || []).forEach(function (ev) {
        (ev.do || []).forEach(function (a) {
          if (a[0] === "qte") fail("D" + early + " room " + i + " has a qte");
        });
      });
    });
  }
  var qteRooms = 0;
  var qteTotal = 0;
  var multi = 0;
  for (var qd2 = 3; qd2 <= 20; qd2++) {
    var pack = SURGE_WORLDS.generate(qd2);
    pack.forEach(function (lvl) {
      qteTotal++;
      var hits = 0;
      (lvl.events || []).forEach(function (ev) {
        (ev.do || []).forEach(function (a) { if (a[0] === "qte") hits++; });
      });
      if (hits > 1) multi++;
      if (hits) qteRooms++;
    });
  }
  var rate = qteTotal ? qteRooms / qteTotal : 0;
  if (multi) fail("qte stacked in " + multi + " rooms");
  if (rate < 0.06 || rate > 0.16) fail("qte rate " + rate.toFixed(3) + " (" + qteRooms + "/" + qteTotal + ")");
  else out("qte rate " + rate.toFixed(3) + " (" + qteRooms + "/" + qteTotal + ")");
}

var ACTIONS = {
  hole:1, fill:1, spikes:1, clearRowHazards:1, shake:1, say:1, sfx:1,
  reverse:1, gravity:1, moveDoor:1, chase:1, saw:1, queue:1,
  teleport:1, push:1, lock:1, laser:1, wind:1, platform:1, drop:1,
  hideDoor:1, showDoor:1, swapDoor:1, slow:1,
  dust:1, flash:1, whisper:1, glow:1, lie:1,
  slip:1, jumpCut:1, magnet:1, blink:1, clamp:1,
  echo:1, sticky:1, rift:1, blackout:1, heavy:1,
  stalker:1, drone:1, rocket:1, voidFog:1, watcher:1,
  sentry:1, swarm:1, phantom:1, huntLight:1, crushBot:1,
  qte:1,
  reaper:1, salvo:1, pincer:1, guillotine:1, abyss:1, eclipse:1, snare:1, orbitSaw:1,
  crossfire:1, leech:1, shardRain:1, wraith:1, mineLine:1, gravLock:1, seeker:1,
  collapse:1, barbedWind:1, mirrorBolt:1, pitBeast:1, judgment:1,
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
  if (!lvl.events || lvl.events.length !== 12) fail(tag + " expected 12 traps got " + (lvl.events && lvl.events.length));
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

if (SURGE_WORLDS && __GAME) {
  out("Playtesting shaft geometry (D4+)...");
  var savedLevels = window.LEVELS;
  var shaftN = 0;
  var lateN = 0;
  var ascendN = 0;
  var descendN = 0;
  var geomFail = [];
  var trapWins = 0;
  var trapDead = 0;
  var stairDeaths = 0;
  for (var sd = 4; sd <= 20; sd++) {
    var pack = SURGE_WORLDS.generate(sd);
    lateN += pack.length;
    for (var si = 0; si < pack.length; si++) {
      var lvl = pack[si];
      if (!lvl.shaft) continue;
      shaftN++;
      if (lvl.shaft === "ascend") ascendN++;
      else descendN++;
      var bare = {
        name: lvl.name,
        taunt: lvl.taunt || "NICE TRY",
        map: lvl.map,
        events: [],
        explodeCoins: false,
        crumbleIfStill: 0,
      };
      window.LEVELS = [bare];
      var width = lvl.map[0].length;
      var geo = __GAME.playtestLevel(0, 60 * (16 + Math.ceil(width / 3)));
      if (!geo.win) {
        geomFail.push(lvl.shaft + " D" + sd + " #" + si + " " + lvl.name
          + " dead=" + geo.dead + " " + (geo.reason || "stuck")
          + " x=" + geo.x + " y=" + geo.y + " f=" + geo.frames);
        continue;
      }
      window.LEVELS = [lvl];
      var trapped = __GAME.playtestLevel(0, 60 * (16 + Math.ceil(width / 3)));
      if (trapped.win) trapWins++;
      else if (trapped.dead) {
        trapDead++;
        var sx = (trapped.x || 0) / 32;
        if (sx >= lvl.surface.stairLo && sx <= lvl.surface.stairHi) stairDeaths++;
      }
    }
  }
  window.LEVELS = savedLevels;
  var rate = lateN ? shaftN / lateN : 0;
  out("shafts " + shaftN + "/" + lateN + " (" + (rate * 100).toFixed(1) + "%) ascend=" + ascendN + " descend=" + descendN);
  out("shaft traps: bot wins=" + trapWins + " deaths=" + trapDead + " died on stair=" + stairDeaths);
  if (rate < 0.18 || rate > 0.32) fail("shaft rate " + rate.toFixed(3));
  if (!ascendN || !descendN) fail("shafts missing a direction");
  geomFail.forEach(function (g) { fail("shaft geometry " + g); });
  if (!geomFail.length) out("shaft geometry: OK (" + shaftN + " rooms)");
}

out("---");
if (__TEST_ERRORS.length) {
  out("RESULT: FAIL (" + __TEST_ERRORS.length + " issues)");
  __TEST_ERRORS.forEach(function (e) { out(" - " + e); });
  throw new Error("tests failed: " + __TEST_ERRORS.length);
}
out("RESULT: PASS");
