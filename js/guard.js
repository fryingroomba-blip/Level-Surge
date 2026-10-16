/* Client-side boundary for storage this page did not write.
   Unsigned progress is ignored. Sealing only runs on this game's own pages. */
(function (root) {
  var framed = false;
  try {
    framed = !!(root && root.top && root.self && root.top !== root.self);
  } catch (_) {
    framed = true;
  }
  if (framed) {
    try { root.document.documentElement.innerHTML = ""; } catch (_) {}
    return;
  }

  const MAX_JSON = 500000;
  const MAX_ROOMS = 40;
  const MAX_EVENTS = 64;
  const MAX_ACTIONS = 8;
  const MAX_DEPTH = 3;
  const COLS = 32;
  const ROWS = 12;
  const TILES = new Set([".", "#", "=", "*", "^", "v", "B", "!", "o", "C", "S", "E", "F", "i", "<", ">"]);
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
  const BOOL_IF = new Set(["jump", "land", "air", "ground", "falling"]);
  const audit = [];

  function note(code) {
    if (audit.length >= 50) audit.shift();
    audit.push({ code: String(code), t: Date.now() });
  }

  function parseStore(text) {
    if (text == null || text === "") return null;
    const s = String(text);
    if (s.length > MAX_JSON) {
      note("oversize");
      return null;
    }
    try {
      return JSON.parse(s, function (key, value) {
        if (key === "__proto__" || key === "prototype" || key === "constructor") {
          note("proto");
          return undefined;
        }
        return value;
      });
    } catch (_) {
      note("parse");
      return null;
    }
  }

  function plainLabel(value, max) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/[^A-Za-z0-9 !?'.,-]/g, "")
      .trim()
      .slice(0, max);
  }

  function intIn(v, min, max) {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    const n = Math.round(v);
    if (n < min || n > max) return null;
    return n;
  }

  function numIn(v, min, max) {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    if (v < min || v > max) return null;
    return v;
  }

  function putInt(raw, out, key, min, max) {
    if (raw[key] == null) return;
    const n = intIn(raw[key], min, max);
    if (n == null) note("save-drop");
    else out[key] = n;
  }

  function sanitizeSave(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      if (raw != null) note("save-shape");
      return {};
    }
    const out = {};
    putInt(raw, out, "unlockedDim", 1, 20);
    putInt(raw, out, "lastDim", 1, 20);
    putInt(raw, out, "lastRoom", 0, 40);
    putInt(raw, out, "unlocked", 0, 40);
    putInt(raw, out, "bestDeaths", 0, 1000000);
    putInt(raw, out, "bestTime", 0, 1000000);
    putInt(raw, out, "runs", 0, 10000000);
    putInt(raw, out, "clears", 0, 10000000);

    if (raw.rooms != null) {
      if (typeof raw.rooms !== "object" || Array.isArray(raw.rooms)) note("save-drop");
      else {
        const rooms = {};
        Object.keys(raw.rooms).forEach(function (k) {
          if (!/^(?:[1-9]|1\d|20)$/.test(k)) {
            note("save-drop");
            return;
          }
          const n = intIn(raw.rooms[k], 0, 40);
          if (n == null) note("save-drop");
          else rooms[k] = n;
        });
        out.rooms = rooms;
      }
    }

    if (raw.dimRecords != null) {
      if (typeof raw.dimRecords !== "object" || Array.isArray(raw.dimRecords)) note("save-drop");
      else {
        const rec = {};
        Object.keys(raw.dimRecords).forEach(function (k) {
          if (!/^(?:[1-9]|1\d|20)$/.test(k)) {
            note("save-drop");
            return;
          }
          const row = raw.dimRecords[k];
          if (!row || typeof row !== "object" || Array.isArray(row)) {
            note("save-drop");
            return;
          }
          const item = {};
          const bd = row.bestDeaths == null ? null : intIn(row.bestDeaths, 0, 1000000);
          const bt = row.bestTime == null ? null : intIn(row.bestTime, 0, 1000000);
          const sh = row.shards == null ? null : intIn(row.shards, 0, 1000000);
          if (row.bestDeaths != null && bd == null) note("save-drop");
          if (row.bestTime != null && bt == null) note("save-drop");
          if (row.shards != null && sh == null) note("save-drop");
          if (bd != null) item.bestDeaths = bd;
          if (bt != null) item.bestTime = bt;
          if (sh != null) item.shards = sh;
          if (bd != null || bt != null || sh != null) rec[k] = item;
        });
        out.dimRecords = rec;
      }
    }
    return out;
  }

  function sanitizeMap(map) {
    const src = Array.isArray(map) ? map : [];
    const rows = [];
    for (let y = 0; y < ROWS; y++) {
      const row = String(src[y] == null ? "" : src[y]).replace(/ /g, ".");
      let out = "";
      for (let x = 0; x < COLS; x++) {
        const ch = row[x] || (y >= 9 ? "#" : ".");
        out += TILES.has(ch) ? ch : ".";
      }
      rows.push(out);
    }
    let spawn = -1;
    let exit = -1;
    for (let y = 0; y < ROWS; y++) {
      const chars = rows[y].split("");
      for (let x = 0; x < COLS; x++) {
        if (chars[x] === "S") {
          if (spawn >= 0) chars[x] = ".";
          else spawn = y * COLS + x;
        } else if (chars[x] === "E") {
          if (exit >= 0) chars[x] = ".";
          else exit = y * COLS + x;
        }
      }
      rows[y] = chars.join("");
    }
    if (spawn < 0) {
      const chars = rows[8].split("");
      chars[1] = "S";
      rows[8] = chars.join("");
    }
    if (exit < 0) {
      const chars = rows[8].split("");
      chars[30] = "E";
      rows[8] = chars.join("");
    }
    return rows;
  }

  function sanitizeAction(a, depth) {
    if (!Array.isArray(a) || !a.length) return null;
    const type = a[0];
    if (typeof type !== "string" || !ACTIONS.has(type)) return null;
    if (type === "queue") {
      if (depth >= MAX_DEPTH) return null;
      const delay = numIn(a[1], 0, 30);
      if (delay == null) return null;
      const nested = [];
      const rest = a.slice(2, 2 + MAX_ACTIONS);
      for (let i = 0; i < rest.length; i++) {
        const child = sanitizeAction(rest[i], depth + 1);
        if (child) nested.push(child);
        else note("event-drop");
      }
      if (!nested.length) return null;
      return ["queue", delay].concat(nested);
    }
    const args = [type];
    const limit = Math.min(a.length, 8);
    for (let i = 1; i < limit; i++) {
      const v = a[i];
      if (typeof v === "number") {
        const n = numIn(v, -8, 96);
        if (n == null) return null;
        args.push(n);
      } else if (typeof v === "boolean") {
        if (type === "reverse" && i === 1) args.push(v);
        else return null;
      } else if (typeof v === "string") {
        if ((type === "fill" || type === "spikes") && v.length === 1 && TILES.has(v)) args.push(v);
        else if (type === "sfx" && /^[a-z0-9_-]{1,24}$/i.test(v)) args.push(v);
        else if (type === "say" || type === "lie" || type === "whisper") args.push(plainLabel(v, 48) || "....");
        else return null;
      } else return null;
    }
    return args;
  }

  function sanitizeEvent(ev) {
    if (!ev || typeof ev !== "object" || Array.isArray(ev)) return null;
    if (!Array.isArray(ev.do)) return null;
    const out = { once: ev.once !== false, do: [] };
    if (ev.quiet === true) out.quiet = true;
    if (ev.delay != null) {
      const delay = numIn(ev.delay, 0, 30);
      if (delay == null) return null;
      if (delay > 0) out.delay = delay;
    }
    if (ev.hold != null) {
      const hold = numIn(ev.hold, 0, 30);
      if (hold == null) return null;
      out.hold = hold;
    }
    const cond = {};
    if (ev.if != null) {
      if (typeof ev.if !== "object" || Array.isArray(ev.if)) return null;
      Object.keys(ev.if).forEach(function (k) {
        if (!IF_KEYS.has(k)) {
          note("event-drop");
          return;
        }
        const v = ev.if[k];
        if (BOOL_IF.has(k)) {
          if (v === true) cond[k] = true;
          else note("event-drop");
          return;
        }
        if (k === "door") {
          if (v === "fake" || v === "real") cond[k] = v;
          else note("event-drop");
          return;
        }
        if (k === "zone") {
          if (!Array.isArray(v) || v.length !== 4) {
            note("event-drop");
            return;
          }
          const z = [];
          for (let i = 0; i < 4; i++) {
            const n = numIn(v[i], -8, 96);
            if (n == null) {
              note("event-drop");
              return;
            }
            z.push(n);
          }
          if (z.length === 4) cond[k] = z;
          return;
        }
        const n = numIn(v, -8, 96);
        if (n == null) note("event-drop");
        else cond[k] = n;
      });
    }
    out.if = cond;
    const actions = ev.do.slice(0, MAX_ACTIONS);
    if (ev.do.length > MAX_ACTIONS) note("event-drop");
    for (let i = 0; i < actions.length; i++) {
      const clean = sanitizeAction(actions[i], 0);
      if (clean) out.do.push(clean);
      else note("event-drop");
    }
    if (!out.do.length) return null;
    return out;
  }

  function cleanId(id, index) {
    const s = String(id == null ? "" : id).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
    return s || ("room-" + index);
  }

  function sanitizeRoom(raw, index) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const events = [];
    const src = Array.isArray(raw.events) ? raw.events : [];
    if (src.length > MAX_EVENTS) note("event-drop");
    const slice = src.slice(0, MAX_EVENTS);
    for (let i = 0; i < slice.length; i++) {
      const ev = sanitizeEvent(slice[i]);
      if (ev) events.push(ev);
      else note("event-drop");
    }
    return {
      id: cleanId(raw.id, index || 0),
      name: plainLabel(raw.name, 24) || "UNNAMED",
      taunt: plainLabel(raw.taunt, 32) || "YOU BUILT THIS",
      map: sanitizeMap(raw.map),
      events: events,
      explodeCoins: false,
      crumbleIfStill: 0,
      dim: 1,
      creator: true,
    };
  }

  function sanitizeRooms(list) {
    if (!Array.isArray(list)) {
      if (list != null) note("room-shape");
      return [];
    }
    const out = [];
    const seen = {};
    const cap = Math.min(list.length, MAX_ROOMS);
    if (list.length > MAX_ROOMS) note("room-drop");
    for (let i = 0; i < cap; i++) {
      const room = sanitizeRoom(list[i], i);
      if (!room) {
        note("room-drop");
        continue;
      }
      if (seen[room.id]) room.id = room.id + "-" + i;
      seen[room.id] = 1;
      out.push(room);
    }
    return out;
  }

  const K256 = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  function rotr(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }

  function sha256(bytes) {
    const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const data = bytes.slice();
    const bitHi = Math.floor((bytes.length * 8) / 0x100000000);
    const bitLo = (bytes.length * 8) >>> 0;
    data.push(0x80);
    while ((data.length % 64) !== 56) data.push(0);
    for (let s = 3; s >= 0; s--) data.push((bitHi >>> (s * 8)) & 255);
    for (let s = 3; s >= 0; s--) data.push((bitLo >>> (s * 8)) & 255);
    for (let off = 0; off < data.length; off += 64) {
      const w = [];
      for (let i = 0; i < 16; i++) {
        w[i] = ((data[off + i * 4] << 24) | (data[off + i * 4 + 1] << 16) | (data[off + i * 4 + 2] << 8) | data[off + i * 4 + 3]) >>> 0;
      }
      for (let j = 16; j < 64; j++) {
        const s0 = (rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3)) >>> 0;
        const s1 = (rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10)) >>> 0;
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
      }
      let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (let t = 0; t < 64; t++) {
        const s1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
        const ch = ((e & f) ^ ((~e) & g)) >>> 0;
        const temp1 = (hh + s1 + ch + K256[t] + w[t]) >>> 0;
        const s0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
        const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        const temp2 = (s0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    const out = [];
    for (let z = 0; z < 8; z++) {
      out.push((h[z] >>> 24) & 255, (h[z] >>> 16) & 255, (h[z] >>> 8) & 255, h[z] & 255);
    }
    return out;
  }

  function utf8(text) {
    const out = [];
    const s = String(text);
    for (let i = 0; i < s.length; i++) {
      let c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        const n = s.charCodeAt(i + 1);
        if (n >= 0xdc00 && n <= 0xdfff) {
          c = 0x10000 + ((c - 0xd800) << 10) + (n - 0xdc00);
          i++;
        }
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    return out;
  }

  function hex(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
    return s;
  }

  function hmacSha256(keyBytes, message) {
    let key = keyBytes.slice();
    if (key.length > 64) key = sha256(key);
    while (key.length < 64) key.push(0);
    const ipad = [];
    const opad = [];
    for (let i = 0; i < 64; i++) {
      ipad.push(key[i] ^ 0x36);
      opad.push(key[i] ^ 0x5c);
    }
    return sha256(opad.concat(sha256(ipad.concat(utf8(message)))));
  }

  function macEqual(a, b) {
    if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  function canonical(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value == null ? null : value);
    if (Array.isArray(value)) {
      let s = "[";
      for (let i = 0; i < value.length; i++) {
        if (i) s += ",";
        s += canonical(value[i]);
      }
      return s + "]";
    }
    const keys = Object.keys(value).sort();
    let s = "{";
    for (let i = 0; i < keys.length; i++) {
      if (i) s += ",";
      s += JSON.stringify(keys[i]) + ":" + canonical(value[keys[i]]);
    }
    return s + "}";
  }

  const progressKey = sha256(utf8("level-surge-progress-v1"));
  if (hex(sha256(utf8("abc"))) !== "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad") {
    throw new Error("sha256");
  }

  function pageMayPersist() {
    let loc = null;
    try { loc = root.location; } catch (_) { return true; }
    if (!loc || loc.pathname == null || loc.pathname === "") return true;
    const p = String(loc.pathname);
    const host = loc.hostname != null ? String(loc.hostname) : "";
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") return true;
    if (loc.protocol === "file:") return true;
    let decoded = p;
    try { decoded = decodeURIComponent(p); } catch (_) { decoded = p; }
    const compact = decoded.toLowerCase().replace(/\s+/g, "-");
    if (compact.indexOf("/level-surge/") >= 0 || /\/level-surge$/.test(compact)) return true;
    if (/level-surge/.test(compact) && /\/(?:index|about)\.html$/.test(compact)) return true;
    return false;
  }

  function isLegacyEnvelope(raw) {
    return !!(raw && typeof raw === "object" && !Array.isArray(raw)
      && raw.v == null && typeof raw.m !== "string" && raw.d == null);
  }

  function packSealed(purpose, body) {
    if (!pageMayPersist()) return null;
    const mac = hex(hmacSha256(progressKey, purpose + "\n" + canonical(body)));
    return JSON.stringify({ v: 1, d: body, m: mac });
  }

  function openSealed(text, purpose, revive) {
    if (text == null || text === "") return revive(null);
    const raw = parseStore(text);
    if (!raw || raw.v !== 1 || typeof raw.m !== "string" || !raw.d || typeof raw.d !== "object") {
      note("seal");
      return revive(null);
    }
    const data = revive(raw.d);
    const mac = hex(hmacSha256(progressKey, purpose + "\n" + canonical(data)));
    if (!macEqual(mac, raw.m)) {
      note("seal");
      return revive(null);
    }
    return data;
  }

  function packProgress(data) {
    return packSealed("progress", sanitizeSave(data));
  }

  function openProgress(text) {
    if (text == null || text === "") return {};
    return openSealed(text, "progress", sanitizeSave);
  }

  function packRooms(rooms) {
    return packSealed("rooms", { rooms: sanitizeRooms(rooms) });
  }

  function openRooms(text) {
    if (text == null || text === "") return [];
    const data = openSealed(text, "rooms", function (d) {
      return { rooms: sanitizeRooms(d && d.rooms) };
    });
    return data.rooms || [];
  }

  /* Game read path: valid seal wins; else one-time migrate pre-guard JSON.
     Tampered seals are never treated as legacy. */
  function readProgress(text) {
    if (text == null || text === "") {
      return { data: {}, encoded: packProgress({}), legacy: false, ok: true };
    }
    const sealed = openProgress(text);
    if (sealed && typeof sealed === "object" && Object.keys(sealed).length) {
      return { data: sealed, encoded: packProgress(sealed), legacy: false, ok: true };
    }
    const raw = parseStore(text);
    if (isLegacyEnvelope(raw)) {
      const data = sanitizeSave(raw);
      return { data: data, encoded: packProgress(data), legacy: true, ok: true };
    }
    return { data: {}, encoded: packProgress({}), legacy: false, ok: false };
  }

  function readRooms(text) {
    if (text == null || text === "") {
      return { rooms: [], encoded: packRooms([]), legacy: false, ok: true };
    }
    const sealed = openRooms(text);
    if (sealed && sealed.length) {
      return { rooms: sealed, encoded: packRooms(sealed), legacy: false, ok: true };
    }
    const raw = parseStore(text);
    if (isLegacyEnvelope(raw)) {
      const rooms = sanitizeRooms(raw.rooms);
      return { rooms: rooms, encoded: packRooms(rooms), legacy: true, ok: true };
    }
    if (Array.isArray(raw)) {
      const rooms = sanitizeRooms(raw);
      return { rooms: rooms, encoded: packRooms(rooms), legacy: true, ok: true };
    }
    return { rooms: [], encoded: packRooms([]), legacy: false, ok: false };
  }

  root.SURGE_GUARD = {
    parseStore: parseStore,
    sanitizeSave: sanitizeSave,
    sanitizeRoom: sanitizeRoom,
    sanitizeRooms: sanitizeRooms,
    plainLabel: plainLabel,
    packProgress: packProgress,
    openProgress: openProgress,
    packRooms: packRooms,
    openRooms: openRooms,
    readProgress: readProgress,
    readRooms: readRooms,
    auditLog: function () { return audit.map(function (e) { return { code: e.code, t: e.t }; }); },
    clearAudit: function () { audit.length = 0; },
  };
})(typeof window !== "undefined" ? window : globalThis);
