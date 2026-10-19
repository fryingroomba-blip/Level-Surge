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
  "slip", "jumpCut", "magnet", "blink", "clamp",
  "echo", "sticky", "rift", "blackout", "heavy",
  "stalker", "drone", "rocket", "voidFog", "watcher",
  "sentry", "swarm", "phantom", "huntLight", "crushBot",
  "qte",
  "reaper", "salvo", "pincer", "guillotine", "abyss", "eclipse", "snare", "orbitSaw",
    "crossfire", "leech", "shardRain", "wraith", "mineLine", "gravLock", "seeker",
    "collapse", "barbedWind", "mirrorBolt", "pitBeast", "judgment",
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

(HAND || []).forEach((lvl, i) => checkLevel(lvl, `#${i + 1} ${lvl.name || "?"}`, (lvl.events || []).length));

if (WORLDS) {
  if (WORLDS.count !== 20 || WORLDS.DIMS.length !== 20) errors.push("Need 20 dimensions");
  for (let d = 1; d <= 20; d++) {
    const n = WORLDS.roomCount(d);
    const t = WORLDS.trapCount(d);
    const expectN = 15 + d + (d === 1 ? 1 : 0);
    if (n !== expectN) errors.push(`D${d} rooms ${n} != ${expectN}`);
    if (d > 1 && t <= WORLDS.trapCount(d - 1)) errors.push(`D${d} traps did not increase`);
    const lvls = WORLDS.generate(d);
    if (lvls.length !== n) errors.push(`D${d} generated ${lvls.length} rooms`);
    const sample = lvls[0];
    const last = lvls[lvls.length - 1];
    const wantFirst = d === 1 ? ((HAND[0] && HAND[0].events && HAND[0].events.length) || 0) : t;
    checkLevel(sample, `D${d} ${sample.name}`, wantFirst);
    const bossN = WORLDS.bossTrapCount ? WORLDS.bossTrapCount(d) : t * (d >= 18 ? 4 : d >= 8 ? 3 : 2);
    checkLevel(last, `D${d} ${last.name}`, bossN);
    lvls.forEach((lvl) => {
      const width = (lvl.map && lvl.map[0] && lvl.map[0].length) || WORLDS.stageWidth(d);
      if (d > 1 && width !== WORLDS.stageWidth(d)) {
        errors.push(`D${d} ${lvl.name}: width ${width} != ${WORLDS.stageWidth(d)}`);
      }
      const floor = (lvl.surface ? lvl.surface.slice() : (WORLDS.surfaceFromMap ? WORLDS.surfaceFromMap(lvl.map) : []));
      if (!floor.length) return;
      (lvl.events || []).forEach((ev) => {
        (ev.do || []).forEach((a) => {
          if (a[0] === "hole" && a[1] >= 0 && a[1] < floor.length) floor[a[1]] = -1;
        });
      });
      const doorAt = floor.length - 2;
      if (floor[1] < 0 || floor[doorAt] < 0) errors.push(`D${d} ${lvl.name}: hole ate spawn or door`);
      let run = 0;
      let max = 0;
      floor.forEach((cell) => {
        if (cell < 0) { run += 1; if (run > max) max = run; }
        else run = 0;
      });
      if (max > 3) errors.push(`D${d} ${lvl.name}: open gap ${max} is wider than a jump`);
    });
    let shafts = 0;
    let ascents = 0;
    let descents = 0;
    lvls.forEach((lvl) => {
      if (d < 4 && lvl.shaft) errors.push(`D${d} ${lvl.name}: shaft before dimension 4`);
      if (lvl.boss && lvl.shaft) errors.push(`D${d} ${lvl.name}: boss is a shaft`);
      if (!lvl.shaft) {
        if (d > 1 && lvl.map.length !== 12) errors.push(`D${d} ${lvl.name}: corridor height ${lvl.map.length}`);
        return;
      }
      shafts += 1;
      if (lvl.shaft === "ascend") ascents += 1;
      else if (lvl.shaft === "descend") descents += 1;
      else errors.push(`D${d} ${lvl.name}: unknown shaft ${lvl.shaft}`);
      const s = lvl.surface || [];
      const dy = (s[1] || 0) - (s[s.length - 2] || 0);
      if (lvl.shaft === "ascend" && dy < 6) errors.push(`D${d} ${lvl.name}: ascent only rises ${dy}`);
      if (lvl.shaft === "descend" && dy > -6) errors.push(`D${d} ${lvl.name}: descent only drops ${-dy}`);
      if (lvl.map.length <= 12) errors.push(`D${d} ${lvl.name}: shaft is not taller than a corridor`);
      for (let x = 1; x < s.length; x++) {
        if (s[x] < 0 || s[x - 1] < 0) continue;
        if (Math.abs(s[x] - s[x - 1]) > 1) errors.push(`D${d} ${lvl.name}: step ${Math.abs(s[x] - s[x - 1])} at ${x}`);
      }
      const lo = s.stairLo;
      const hi = s.stairHi;
      if (!(lo >= 0) || !(hi > lo)) errors.push(`D${d} ${lvl.name}: stair span missing`);
      (lvl.events || []).forEach((ev) => {
        const walk = (a) => {
          if (!Array.isArray(a)) return;
          if (a[0] === "queue") {
            a.slice(2).forEach(walk);
            return;
          }
          if ((a[0] === "hole" || a[0] === "fill" || a[0] === "spikes") && a[1] >= lo && a[1] <= hi) {
            errors.push(`D${d} ${lvl.name}: ${a[0]} on the stair at ${a[1]}`);
          }
        };
        (ev.do || []).forEach(walk);
      });
    });
    if (d >= 4) {
      const rate = shafts / lvls.length;
      if (rate < 0.15 || rate > 0.36) errors.push(`D${d}: shaft rate ${rate.toFixed(3)} (${shafts}/${lvls.length})`);
      if (!ascents || !descents) errors.push(`D${d}: shafts ascend ${ascents} descend ${descents}`);
    } else if (shafts) {
      errors.push(`D${d}: ${shafts} shafts`);
    }
    if (d > 1) {
      const labels = (WORLDS.signatureTraps(d) || []).map((t) => t.label);
      let sigRooms = 0;
      let bossFakeOk = true;
      lvls.forEach((lvl) => {
        const text = JSON.stringify(lvl.events || []);
        if (labels.length && labels.every((lab) => text.indexOf(lab) >= 0)) sigRooms += 1;
        if (lvl.boss && (lvl.map || []).join("").indexOf("F") >= 0) bossFakeOk = false;
      });
      if (labels.length && sigRooms < lvls.length) {
        errors.push(`D${d}: signature traps in ${sigRooms}/${lvls.length} rooms`);
      }
      if (!bossFakeOk) errors.push(`D${d}: boss room still has a fake door`);
    }
    let fourRooms = 0;
    let repeatRooms = 0;
    let apexRooms = 0;
    const APEX_NAMES = new Set(["reaper", "salvo", "pincer", "guillotine", "abyss", "eclipse", "snare", "orbitSaw", "crossfire", "leech", "shardRain", "wraith", "mineLine", "gravLock", "seeker", "collapse", "barbedWind", "mirrorBolt", "pitBeast", "judgment"]);
    lvls.forEach((lvl) => {
      let multi = 0;
      let fours = 0;
      (lvl.events || []).forEach((ev) => {
        const t = ev.times || 1;
        if (t > WORLDS.activationCap(d)) errors.push(`D${d} ${lvl.name}: trap activates ${t} times`);
        if (d < 3 && t > 1) errors.push(`D${d} ${lvl.name}: repeat before dimension 3`);
        if (t > 1) multi += 1;
        if (t >= 4) fours += 1;
        if (t > 1 && !(ev.rearm >= 1 && ev.rearm <= 2)) {
          errors.push(`D${d} ${lvl.name}: bad rearm ${ev.rearm}`);
        }
      });
      if (multi > 5) errors.push(`D${d} ${lvl.name}: ${multi} repeating traps (max 5)`);
      if (multi && multi >= (lvl.events || []).length) errors.push(`D${d} ${lvl.name}: every trap repeats`);
      if (fours > 1) errors.push(`D${d} ${lvl.name}: ${fours} traps hit the repeat cap`);
      let apexHit = false;
      (lvl.events || []).forEach((ev) => {
        (ev.do || []).forEach((a) => {
          if (APEX_NAMES.has(a[0])) apexHit = true;
        });
      });
      if (apexHit) apexRooms += 1;
      if (multi) repeatRooms += 1;
      if (fours) fourRooms += 1;
    });
    if (d >= 10 && apexRooms < lvls.length) errors.push(`D${d} apex in ${apexRooms}/${lvls.length} rooms`);
    if (d < 8 && apexRooms) errors.push(`D${d} placed ${apexRooms} apex rooms too early`);
    if (d >= 3 && repeatRooms === 0) errors.push(`D${d}: no repeating traps`);
    if (fourRooms > Math.ceil(lvls.length * 0.28)) {
      errors.push(`D${d}: 4-activation traps in ${fourRooms}/${lvls.length} rooms`);
    }
    const th = WORLDS.theme(d);
    if (!th || !th.name || !th.sky || !th.weather) errors.push(`D${d} missing theme`);
  }
  if (WORLDS.trapCount(1) !== 10) errors.push("D1 should have 10 traps");
  if (WORLDS.trapCount(2) !== 22) errors.push("D2 should have 22 traps");
  if (WORLDS.trapCount(3) !== 35) errors.push("D3 should have 35 traps");
  if (WORLDS.stageWidth(2) !== 37 || WORLDS.stageWidth(10) !== 77 || WORLDS.stageWidth(20) !== 127) {
    errors.push("stage width is not +5 blocks per dimension");
  }
  if (WORLDS.activationCap(1) !== 4 || WORLDS.activationCap(10) !== 94) {
    errors.push("activation cap is not +10 per dimension");
  }
}

if (errors.length) {
  console.error("LEVEL VALIDATE FAIL");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}
console.log(`LEVEL VALIDATE OK · ${HAND.length} handmade · 20 worlds · D20=${WORLDS.roomCount(20)} rooms / ${WORLDS.trapCount(20)} traps`);
