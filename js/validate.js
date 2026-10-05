const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load(file, sandbox) {
  const src = fs.readFileSync(path.join(__dirname, file), "utf8");
  vm.runInContext(src, sandbox);
}

const sandbox = { window: {}, globalThis: {} };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
load("levels.js", sandbox);
load("worlds.js", sandbox);

const HAND = sandbox.HAND_LEVELS || sandbox.window.HAND_LEVELS;
const WORLDS = sandbox.SURGE_WORLDS || sandbox.window.SURGE_WORLDS;
const LEVELS = sandbox.LEVELS || sandbox.window.LEVELS;

const ACTIONS = new Set([
  "hole", "fill", "spikes", "clearRowHazards", "shake", "say", "sfx",
  "reverse", "gravity", "moveDoor", "chase", "saw", "queue",
  "teleport", "push", "lock", "laser", "wind", "platform", "drop",
  "hideDoor", "showDoor", "swapDoor", "slow",
  "dust", "flash", "whisper", "glow", "lie",
]);
const IF_KEYS = new Set([
  "x", "beenPast", "xLess", "time", "jump", "before", "jumpAfter",
  "door", "y", "land", "still", "zone",
  "air", "ground", "falling", "jumps", "vxMin", "vxLess",
]);

const errors = [];
if (!HAND || !HAND.length) errors.push("No HAND_LEVELS loaded");
if (!WORLDS) errors.push("No SURGE_WORLDS loaded");
if (!LEVELS || !LEVELS.length) errors.push("No LEVELS loaded");

function checkLevel(lvl, tag, trapWant) {
  if (!lvl.name) errors.push(`${tag}: missing name`);
  if (!lvl.taunt) errors.push(`${tag}: missing taunt`);
  if (!Array.isArray(lvl.map) || lvl.map.length < 8) errors.push(`${tag}: map too small`);
  if (!Array.isArray(lvl.events) || lvl.events.length !== trapWant) {
    errors.push(`${tag}: expected ${trapWant} traps, got ${lvl.events ? lvl.events.length : 0}`);
  }
  const width = Math.max(...lvl.map.map((r) => r.length));
  const height = lvl.map.length;
  const grid = lvl.map.map((r) => (r.replace(/ /g, ".") + ".".repeat(width)).slice(0, width));
  const joined = grid.join("");
  if (!joined.includes("S")) errors.push(`${tag}: missing spawn S`);
  if (!joined.includes("E") && !JSON.stringify(lvl.events).includes("moveDoor")) {
    errors.push(`${tag}: missing exit E`);
  }
  (lvl.events || []).forEach((ev, ei) => {
    Object.keys(ev.if || {}).forEach((k) => {
      if (!IF_KEYS.has(k)) errors.push(`${tag} trap ${ei}: unknown if.${k}`);
    });
    const walk = (a, pth) => {
      if (!Array.isArray(a) || !a.length) {
        errors.push(`${tag} trap ${ei}${pth}: empty action`);
        return;
      }
      if (!ACTIONS.has(a[0])) errors.push(`${tag} trap ${ei}${pth}: unknown action ${a[0]}`);
      if (["hole", "fill", "spikes", "laser", "saw", "moveDoor", "teleport"].includes(a[0])) {
        const x = a[1], y = a[2];
        if (typeof x === "number" && (x < -1 || x >= width + 2)) {
          errors.push(`${tag} trap ${ei}${pth}: x ${x} out of ${width}`);
        }
        if (typeof y === "number" && (y < -1 || y >= height + 2)) {
          errors.push(`${tag} trap ${ei}${pth}: y ${y} out of ${height}`);
        }
      }
      if (a[0] === "queue") a.slice(2).forEach((n, ni) => walk(n, `${pth}.queue${ni}`));
    };
    (ev.do || []).forEach((a, ai) => walk(a, `.${ai}`));
  });
}

(HAND || []).forEach((lvl, i) => checkLevel(lvl, `#${i + 1} ${lvl.name || "?"}`, 10));

if (WORLDS) {
  if (WORLDS.count !== 20 || WORLDS.DIMS.length !== 20) errors.push("Need 20 dimensions");
  for (let d = 1; d <= 20; d++) {
    const n = WORLDS.roomCount(d);
    const t = WORLDS.trapCount(d);
    if (n !== 15 + d) errors.push(`D${d} rooms ${n} != ${15 + d}`);
    if (d > 1 && t <= WORLDS.trapCount(d - 1)) errors.push(`D${d} traps did not increase`);
    const lvls = WORLDS.generate(d);
    if (lvls.length !== n) errors.push(`D${d} generated ${lvls.length} rooms`);
    const sample = lvls[0];
    const last = lvls[lvls.length - 1];
    const wantFirst = d === 1 ? 10 : t;
    checkLevel(sample, `D${d} ${sample.name}`, wantFirst);
    checkLevel(last, `D${d} ${last.name}`, d === 1 ? 10 : t + 4);
    if (d > 1) {
      lvls.forEach((lvl) => {
        if (!lvl.surface) return;
        const floor = lvl.surface.slice();
        (lvl.events || []).forEach((ev) => {
          (ev.do || []).forEach((a) => {
            if (a[0] === "hole" && a[1] >= 0 && a[1] < floor.length) floor[a[1]] = -1;
          });
        });
        if (floor[1] < 0 || floor[30] < 0) errors.push(`D${d} ${lvl.name}: hole ate spawn or door`);
        let run = 0;
        let max = 0;
        floor.forEach((cell) => {
          if (cell < 0) { run += 1; if (run > max) max = run; }
          else run = 0;
        });
        if (max > 3) errors.push(`D${d} ${lvl.name}: open gap ${max} is wider than a jump`);
      });
    }
    const th = WORLDS.theme(d);
    if (!th || !th.name || !th.sky || !th.weather) errors.push(`D${d} missing theme`);
  }
  if (WORLDS.trapCount(1) !== 10) errors.push("D1 should have 10 traps");
  if (WORLDS.trapCount(2) !== 12) errors.push("D2 should have 12 traps");
  if (WORLDS.trapCount(3) !== 15) errors.push("D3 should have 15 traps");
}

if (errors.length) {
  console.error("LEVEL VALIDATE FAIL");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}
console.log(`LEVEL VALIDATE OK · ${HAND.length} handmade · 20 worlds · D20=${WORLDS.roomCount(20)} rooms / ${WORLDS.trapCount(20)} traps`);
