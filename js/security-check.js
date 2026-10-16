/**
 * Security checks for Level Surge.
 *   node js/security-check.js
 *
 * Confirms untrusted localStorage cannot inject markup, pollute prototypes,
 * or carry unknown trap actions into the creator.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const fails = [];
function fail(s) { fails.push(s); console.log("FAIL: " + s); }
function ok(s) { console.log("OK: " + s); }
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }

function assert(cond, msg) { if (!cond) fail(msg); }

const game = read("js/game.js");
const creator = read("js/creator.js");
const index = read("index.html");
const about = read("about.html");
const aboutPage = read("js/about-page.js");

function flagInnerHTML(src, name) {
  src.split("\n").forEach(function (line, i) {
    if (!/innerHTML\s*(\+?=)/.test(line)) return;
    if (/innerHTML\s*=\s*""/.test(line) || /innerHTML\s*=\s*''/.test(line)) return;
    fail(name + ":" + (i + 1) + " writes innerHTML from data");
  });
}
flagInnerHTML(game, "game.js");
flagInnerHTML(creator, "creator.js");
assert(game.indexOf("SURGE_GUARD") >= 0, "game.js does not use SURGE_GUARD");
assert(creator.indexOf("SURGE_GUARD") >= 0, "creator.js does not use SURGE_GUARD");
assert(creator.indexOf("textContent = room.name") >= 0, "creator library does not render names as text");
assert(index.indexOf("js/guard.js") >= 0, "index.html does not load guard.js");
assert(/script-src 'self'/.test(index), "index.html CSP missing script-src 'self'");
assert(!/unsafe-inline/.test(index), "index.html CSP allows unsafe-inline");
assert(/script-src 'self'/.test(about), "about.html CSP missing script-src 'self'");
assert(!/<script\b(?![^>]*\bsrc\s*=)/i.test(about), "about.html still has an inline script");
assert(!/\$\{accent/.test(aboutPage), "about page interpolates accent into CSS");
assert(!/fonts\.googleapis|fonts\.gstatic/.test(index + about), "third-party font host remains");
assert(/font-src 'self'/.test(index) && /font-src 'self'/.test(about), "font-src is not limited to this site");
assert(index.indexOf("css/fonts.css") >= 0 && about.indexOf("css/fonts.css") >= 0, "local font stylesheet missing");
assert(about.indexOf("js/guard.js") >= 0, "about page does not load the frame guard");
assert(game.indexOf("__SURGE_TEST__") >= 0, "debug API is not limited to the test harness");
ok("static sinks and CSP");

const sandbox = { console: console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(read("js/guard.js"), sandbox, { filename: "guard.js" });
const G = sandbox.SURGE_GUARD;
assert(G, "guard did not install");

G.clearAudit();
const parsed = G.parseStore('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"unlockedDim":5,"bestDeaths":"<img src=x onerror=alert(1)>"}');
const save = G.sanitizeSave(parsed);
const merged = Object.assign({}, save, { runs: 1 });
assert(merged.unlockedDim === 5, "valid unlockedDim dropped");
assert(merged.runs === 1, "merge dropped runs");
assert(!merged.polluted, "save object inherited polluted");
assert(!Object.prototype.polluted, "Object.prototype polluted");
assert(typeof save.bestDeaths === "undefined", "html bestDeaths kept");
const audit = JSON.stringify(G.auditLog());
assert(/proto/.test(audit), "proto rejection was not logged");
assert(/save-drop/.test(audit), "bad death count was not logged");
assert(audit.indexOf("onerror") < 0 && audit.indexOf("<img") < 0, "audit log contains the payload");
ok("save parse rejects proto and markup");

const legacy = Object.assign({}, JSON.parse('{"__proto__":{"polluted":true}}'));
assert(legacy.polluted === true, "control: Object.assign still follows __proto__ on this engine");
assert(!Object.prototype.polluted, "control polluted Object.prototype");
ok("documented Object.assign __proto__ behavior");

const good = {
  unlockedDim: 3, lastDim: 3, lastRoom: 2, unlocked: 15,
  bestDeaths: 7, bestTime: 90, runs: 2, clears: 1,
  rooms: { 1: 15, 3: 2 },
  dimRecords: { 3: { bestDeaths: 7, bestTime: 90, shards: 1 } },
};
assert(JSON.stringify(G.sanitizeSave(good)) === JSON.stringify(G.sanitizeSave(G.sanitizeSave(good))), "save sanitize is not idempotent");
assert(G.sanitizeSave(good).rooms[1] === 15, "room progress dropped");
assert(G.plainLabel("DON'T STOP", 32) === "DON'T STOP", "apostrophe stripped from labels");
assert(G.plainLabel("<img src=x onerror=alert(1)>", 24).indexOf("<") < 0, "label kept a tag");
ok("valid saves round-trip");

G.clearAudit();
assert(G.parseStore("x".repeat(500001)) == null, "oversize JSON was parsed");
assert(/oversize/.test(JSON.stringify(G.auditLog())), "oversize was not logged");
assert(JSON.stringify(G.auditLog()).indexOf("xxxxx") < 0, "audit stored the oversize body");
ok("oversize storage rejected");

function kept(room, msg) {
  const out = G.sanitizeRoom(room, 0);
  assert(out && out.events.length === 1, msg + " event dropped");
  return out && out.events[0];
}
const jump = kept({
  name: "JUMP",
  events: [{
    if: { jump: true, xLess: 4.2, air: true }, once: true, delay: 0.05,
    do: [["fill", 2, 5, 4, 1, "v"], ["shake", 4], ["sfx", "spike"]],
  }],
}, "jump");
assert(jump && jump.delay === 0.05 && jump.if.xLess === 4.2 && jump.do[0][5] === "v", "jump trap changed");

const gate = kept({
  name: "GATE",
  events: [{
    if: { x: -2.2 }, once: true,
    do: [
      ["fill", 0, 9, 1, 1, "^"], ["sfx", "spike"], ["shake", 3],
      ["queue", 0.55, ["fill", 0, 9, 1, 1, "#"]],
    ],
  }],
}, "gate");
assert(gate && gate.if.x === -2.2 && gate.do[3][0] === "queue" && gate.do[3][2][5] === "#", "gate trap changed");

const flip = kept({
  name: "FLIP",
  events: [{
    if: { x: -0.2 }, once: true,
    do: [["reverse", true], ["flash", 0.05], ["sfx", "reverse"], ["queue", 0.22, ["reverse", false]]],
  }],
}, "flip");
assert(flip && flip.do[0][1] === true && flip.do[3][2][1] === false, "reverse bool changed");

const glow = kept({
  name: "GLOW",
  events: [{ if: { x: 3 }, once: true, quiet: true, do: [["glow", 1, 2, 3, 0.22]] }],
}, "glow");
assert(glow && glow.quiet === true, "quiet tell dropped");

const again = G.sanitizeRoom(G.sanitizeRoom({
  id: "room-1", name: "UNNAMED", taunt: "YOU BUILT THIS",
  map: ["S"], events: [{ if: { x: 1 }, once: true, do: [["shake", 1]] }],
}, 0), 0);
assert(JSON.stringify(again) === JSON.stringify(G.sanitizeRoom(again, 0)), "room sanitize is not idempotent");
ok("creator traps survive sanitizing");

const many = [];
for (let i = 0; i < 200; i++) many.push({ if: { x: 1 }, once: true, do: [["shake", 1]] });
const capped = G.sanitizeRoom({ name: "BIG", events: many }, 0);
assert(capped.events.length === 64, "event cap is " + (capped && capped.events.length));

let bomb = ["shake", 1];
for (let i = 0; i < 12; i++) bomb = ["queue", 0.1, bomb];
const bombed = G.sanitizeRoom({ name: "BOMB", events: [{ if: { x: 1 }, once: true, do: [bomb] }] }, 0);
assert(bombed.events.length === 0, "deep queue was kept");

const nasty = G.parseStore('{"rooms":[{"id":"evil","name":"<img src=x onerror=alert(1)>","taunt":"<script>alert(1)</script>","map":["S"],"events":[{"if":{"x":1,"__proto__":{"polluted":true}},"do":[["say","<img src=x onerror=alert(1)>"],["nope",1],["fill",0,0,1,1,"<img>"],["gravity",1e308]]}]}]}');
const rooms = G.sanitizeRooms(nasty.rooms);
const dumped = JSON.stringify(rooms);
assert(rooms.length === 1, "poison room dropped entirely");
assert(dumped.indexOf("<") < 0, "markup survived room sanitize");
assert(dumped.indexOf("nope") < 0, "unknown action kept");
assert(dumped.indexOf("1e308") < 0 && dumped.indexOf("1e+308") < 0, "huge gravity kept");
assert(!rooms[0].polluted && !Object.prototype.polluted, "room prototype polluted");
assert(rooms[0].events.length === 1 && rooms[0].events[0].do[0][0] === "say", "safe say action dropped");
assert(rooms[0].events[0].do[0][1].indexOf("<") < 0, "say text kept markup");
ok("poisoned creator room stripped");

const sealed = G.packProgress({ unlockedDim: 2, bestDeaths: 3, runs: 1, clears: 1 });
const opened = G.openProgress(sealed);
assert(opened.unlockedDim === 2 && opened.bestDeaths === 3 && opened.runs === 1, "sealed progress did not round-trip");
assert(!G.openProgress('{"unlockedDim":20,"bestDeaths":1}').unlockedDim, "unsigned progress was accepted");
const flipped = sealed.replace('"unlockedDim":2', '"unlockedDim":20');
assert(!G.openProgress(flipped).unlockedDim, "edited seal was accepted");
const migrated = G.readProgress('{"unlockedDim":5,"bestDeaths":2,"runs":1}');
assert(migrated.legacy && migrated.data.unlockedDim === 5 && migrated.data.bestDeaths === 2, "legacy progress was not migrated");
assert(migrated.encoded && migrated.encoded.indexOf('"m"') >= 0, "legacy progress was not resealed");
const tamperRead = G.readProgress(flipped);
assert(!tamperRead.data.unlockedDim && !tamperRead.legacy, "tampered seal was migrated as legacy");
const roomPack = G.packRooms([{ id: "ok", name: "DOOR", map: ["S"], events: [{ if: { x: 1 }, once: true, do: [["shake", 1]] }] }]);
assert(G.openRooms(roomPack).length === 1, "sealed creator room dropped");
assert(G.openRooms('{"rooms":[{"name":"<img src=x onerror=alert(1)>"}]}').length === 0, "unsigned creator room accepted");
sandbox.location = { hostname: "fryingroomba-blip.github.io", pathname: "/other-repo/index.html" };
assert(G.packProgress({ unlockedDim: 9 }) == null, "another path was allowed to seal progress");
assert(G.packRooms([{ name: "X" }]) == null, "another path was allowed to seal a room");
sandbox.location = { hostname: "fryingroomba-blip.github.io", pathname: "/" };
assert(G.packProgress({ unlockedDim: 9 }) == null, "the user-site root was allowed to seal progress");
sandbox.location = { hostname: "fryingroomba-blip.github.io", pathname: "/index.html" };
assert(G.packProgress({ unlockedDim: 9 }) == null, "the user-site index was allowed to seal progress");
sandbox.location = { hostname: "fryingroomba-blip.github.io", pathname: "/Level-Surge/" };
assert(G.packProgress({ unlockedDim: 2 }) && G.packProgress({ unlockedDim: 2 }).indexOf('"m"') >= 0, "the game path could not seal progress");
sandbox.location = { hostname: "fryingroomba-blip.github.io", pathname: "/level-surge/" };
assert(G.packProgress({ unlockedDim: 2 }), "lowercase game path could not seal progress");
sandbox.location = { hostname: "fryingroomba-blip.github.io", pathname: "/Level%20Surge/" };
assert(G.packProgress({ unlockedDim: 2 }), "encoded-space game path could not seal progress");
sandbox.location = { hostname: "127.0.0.1", pathname: "/" };
assert(G.packProgress({ unlockedDim: 1 }), "local preview could not seal progress");
delete sandbox.location;
ok("unsigned progress and foreign pages cannot seal");

const framed = {
  document: { documentElement: { innerHTML: "still-here" } },
  self: null,
  top: { other: true },
};
framed.self = framed;
framed.window = framed;
framed.globalThis = framed;
vm.createContext(framed);
vm.runInContext(read("js/guard.js"), framed, { filename: "guard.js" });
assert(!framed.SURGE_GUARD, "framed page received the guard API");
assert(framed.document.documentElement.innerHTML === "", "framed document was not cleared");
ok("framed page does not boot");

function El(tag, id) {
  this.tagName = (tag || "div").toUpperCase();
  this.id = id || "";
  this.className = "";
  this.children = [];
  this.textContent = "";
  this.value = "";
  this._html = "";
  this.style = {};
}
Object.defineProperty(El.prototype, "innerHTML", {
  get: function () { return this._html; },
  set: function (v) {
    this._html = String(v);
    if (this._html === "") this.children = [];
  },
});
Object.defineProperty(El.prototype, "classList", {
  get: function () {
    const self = this;
    return {
      add: function (c) { if (self.className.indexOf(c) < 0) self.className = (self.className + " " + c).trim(); },
      remove: function (c) { self.className = self.className.split(/\s+/).filter(function (x) { return x && x !== c; }).join(" "); },
      contains: function (c) { return self.className.split(/\s+/).indexOf(c) >= 0; },
    };
  },
});
El.prototype.appendChild = function (c) { this.children.push(c); return c; };
El.prototype.addEventListener = function () {};

const els = {};
function ensure(id, tag) {
  if (!els[id]) els[id] = new El(tag || "div", id);
  return els[id];
}
const ctx = {};
["fillRect", "beginPath", "moveTo", "lineTo", "fill", "stroke", "fillText"].forEach(function (n) { ctx[n] = function () {}; });
ensure("creator-map", "canvas").getContext = function () { return ctx; };
ensure("creator-map").width = 640;
ensure("creator-map").height = 240;

const store = {};
const dom = {
  console: console,
  document: {
    getElementById: function (id) { return ensure(id); },
    createElement: function (tag) { return new El(tag); },
  },
  localStorage: {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; },
  },
  navigator: {},
  addEventListener: function () {},
  setTimeout: function () { return 0; },
  clearTimeout: function () {},
  SURGE_GUARD: G,
};
dom.window = dom;
dom.globalThis = dom;
dom.__GAME = { setMode: function () {} };
vm.createContext(dom);
vm.runInContext(read("js/guard.js"), dom, { filename: "guard.js" });
store["level-surge-creator-v1"] = '{"rooms":[{"id":"evil","name":"<img src=x onerror=alert(1)>","taunt":"<script>alert(1)</script>","map":["S"],"events":[{"if":{"x":1},"once":true,"do":[["say","<img src=x onerror=alert(1)>"],["nope",1]]}]}]}';
vm.runInContext(read("js/creator.js"), dom, { filename: "creator.js" });
assert(dom.__CREATOR && dom.__CREATOR.open, "creator did not boot");
dom.__CREATOR.open();
const library = els["creator-library"];
let buttons = (library.children || []).filter(function (el) { return el.tagName === "BUTTON"; });
assert(buttons.length === 1, "legacy creator room was not migrated");
const storedUnsigned = store["level-surge-creator-v1"] || "";
assert(storedUnsigned.indexOf("<") < 0, "poison markup persisted in creator storage");
assert(storedUnsigned.indexOf('"m"') >= 0, "legacy creator room was not resealed");
buttons.forEach(function (btn) {
  assert(String(btn.innerHTML).indexOf("<") < 0, "migrated library button innerHTML contains markup");
});
store["level-surge-creator-v1"] = dom.SURGE_GUARD.packRooms([{
  id: "evil",
  name: "<img src=x onerror=alert(1)>",
  taunt: "<script>alert(1)</script>",
  map: ["S"],
  events: [{ if: { x: 1 }, once: true, do: [["say", "<img src=x onerror=alert(1)>"], ["nope", 1]] }],
}]);
dom.__CREATOR.open();
buttons = (library.children || []).filter(function (el) { return el.tagName === "BUTTON"; });
assert(buttons.length === 1, "sealed creator room did not render");
buttons.forEach(function (btn) {
  assert(String(btn.innerHTML).indexOf("<") < 0, "library button innerHTML contains markup");
  (btn.children || []).forEach(function (child) {
    assert(String(child.textContent).indexOf("<") < 0, "library text contains a tag");
  });
});
buttons[0].onclick();
const built = dom.__CREATOR.buildLevel();
const builtText = JSON.stringify(built);
assert(builtText.indexOf("<") < 0, "built room contains markup");
assert(builtText.indexOf("nope") < 0, "built room kept an unknown action");
assert(built.events[0].do.some(function (a) { return a[0] === "say"; }), "say action lost on load");
ok("creator library ignores unsigned rooms and renders sealed names as text");

console.log("---");
if (fails.length) {
  console.log("RESULT: FAIL (" + fails.length + ")");
  process.exit(1);
}
console.log("RESULT: PASS");
