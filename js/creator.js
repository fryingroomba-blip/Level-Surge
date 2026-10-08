(() => {
  const COLS = 32;
  const ROWS = 12;
  const STORE_KEY = "level-surge-creator-v1";

  const BRUSHES = [
    { id: ".", label: "·", tip: "Air" },
    { id: "#", label: "#", tip: "Solid" },
    { id: "=", label: "=", tip: "Crumble" },
    { id: "*", label: "*", tip: "Fake wall" },
    { id: "^", label: "^", tip: "Spikes up" },
    { id: "v", label: "v", tip: "Spikes down" },
    { id: "B", label: "B", tip: "Bounce" },
    { id: "!", label: "!", tip: "Hidden teeth" },
    { id: "o", label: "o", tip: "Saw" },
    { id: "C", label: "C", tip: "Shard" },
    { id: "S", label: "S", tip: "Spawn" },
    { id: "E", label: "E", tip: "Exit" },
    { id: "F", label: "F", tip: "Fake door" },
  ];

  const COLORS = {
    ".": "#0b1018",
    "#": "#4a4038",
    "=": "#6a5a48",
    "*": "rgba(74,64,56,0.45)",
    "^": "#e31b1b",
    v: "#e31b1b",
    B: "#8a3a18",
    "!": "#cfc1aa",
    o: "#d8d8e0",
    C: "#ffd24a",
    S: "#5ad070",
    E: "#f0c14b",
    F: "#8a7030",
    i: "#2a3038",
  };

  const TRAP_KINDS = [
    {
      id: "jump",
      name: "Jump tax",
      quiet: false,
      build: () => ({
        if: { jump: true, xLess: 4.2, air: true }, once: true, delay: 0.05,
        do: [["fill", 2, 5, 4, 1, "v"], ["shake", 4], ["sfx", "spike"]],
      }),
    },
    {
      id: "gate",
      name: "Floor teeth",
      quiet: false,
      build: (x, y) => ({
        if: { x: +(x - 2.2).toFixed(2) }, once: true,
        do: [
          ["fill", x, y, 1, 1, "^"], ["sfx", "spike"], ["shake", 3],
          ["queue", 0.55, ["fill", x, y, 1, 1, "#"]],
        ],
      }),
    },
    {
      id: "hole",
      name: "Sink",
      quiet: false,
      build: (x, y) => ({
        if: { x: +(x - 2.2).toFixed(2) }, once: true,
        do: [["hole", x, y, 1, 1], ["spikes", x, Math.min(11, y + 1), 1], ["shake", 5], ["sfx", "crumble"]],
      }),
    },
    {
      id: "laser",
      name: "Beam",
      quiet: false,
      build: (x, y) => ({
        if: { x: +(x - 2.8).toFixed(2) }, once: true,
        do: [["laser", Math.max(0, x - 1), Math.max(1, y - 1), 3, 0.36], ["sfx", "spike"]],
      }),
    },
    {
      id: "saw",
      name: "Late saw",
      quiet: false,
      build: (x, y) => ({
        if: { x: +(x - 2.0).toFixed(2) }, once: true,
        do: [["saw", Math.min(31, x + 5), Math.max(1, y - 1), -2.1, 0]],
      }),
    },
    {
      id: "reverse",
      name: "Flip",
      quiet: false,
      build: (x) => ({
        if: { x: +(x - 0.2).toFixed(2) }, once: true,
        do: [
          ["reverse", true], ["flash", 0.05], ["sfx", "reverse"],
          ["queue", 0.22, ["reverse", false]],
        ],
      }),
    },
    {
      id: "hang",
      name: "Ceiling bite",
      quiet: false,
      build: (x) => ({
        if: { jumpAfter: Math.max(2, x - 4), air: true }, once: true, delay: 0.06,
        do: [["fill", Math.max(1, x - 2), 4, 6, 1, "v"], ["sfx", "spike"], ["shake", 4]],
      }),
    },
    {
      id: "dust",
      name: "Fake dust",
      quiet: true,
      build: (x, y) => ({
        if: { x: +x.toFixed(2) }, once: true, quiet: true,
        do: [["dust", x, y, 2], ["shake", 2], ["sfx", "crumble"]],
      }),
    },
    {
      id: "glow",
      name: "Fake glow",
      quiet: true,
      build: (x, y) => ({
        if: { x: +x.toFixed(2) }, once: true, quiet: true,
        do: [["glow", Math.max(1, x - 1), Math.max(2, y - 3), 3, 0.22]],
      }),
    },
  ];

  const screen = document.getElementById("creator-screen");
  const canvas = document.getElementById("creator-map");
  if (!screen || !canvas) return;
  const ctx = canvas.getContext("2d");
  const brushBox = document.getElementById("creator-brushes");
  const kindBox = document.getElementById("creator-trap-kinds");
  const trapList = document.getElementById("creator-trap-list");
  const library = document.getElementById("creator-library");
  const nameEl = document.getElementById("creator-name");
  const tauntEl = document.getElementById("creator-taunt");
  const statusEl = document.getElementById("creator-status");

  let brush = "#";
  let trapKind = "gate";
  let painting = false;
  let map = blankMap();
  let traps = [];
  let editId = null;

  function blankMap() {
    const rows = [];
    for (let y = 0; y < ROWS; y++) {
      const row = [];
      for (let x = 0; x < COLS; x++) {
        if (y >= 9) row.push("#");
        else row.push(".");
      }
      rows.push(row);
    }
    rows[8][1] = "S";
    rows[8][30] = "E";
    return rows;
  }

  function cloneMap(src) {
    return src.map((r) => r.slice());
  }

  function surfaceY(x) {
    for (let y = 0; y < ROWS; y++) {
      const t = map[y][x];
      if (t === "#" || t === "=" || t === "i") return y;
    }
    return 9;
  }

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function loadStore() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return Array.isArray(raw.rooms) ? raw.rooms : [];
    } catch (_) {
      return [];
    }
  }

  function writeStore(rooms) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ rooms }));
    } catch (_) {
      setStatus("Could not save (storage full?)");
    }
  }

  function ensureUniqueMarks() {
    let spawn = false;
    let exit = false;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (map[y][x] === "S") {
          if (spawn) map[y][x] = ".";
          else spawn = true;
        }
        if (map[y][x] === "E") {
          if (exit) map[y][x] = ".";
          else exit = true;
        }
      }
    }
    if (!spawn) map[8][1] = "S";
    if (!exit) map[8][30] = "E";
  }

  function buildLevel() {
    ensureUniqueMarks();
    const name = ((nameEl && nameEl.value) || "UNNAMED").trim().toUpperCase() || "UNNAMED";
    const taunt = ((tauntEl && tauntEl.value) || "YOU BUILT THIS").trim().toUpperCase() || "YOU BUILT THIS";
    return {
      id: editId || ("room-" + Date.now().toString(36)),
      name,
      taunt,
      map: map.map((r) => r.join("")),
      events: traps.map((t) => JSON.parse(JSON.stringify(t.event))),
      explodeCoins: false,
      crumbleIfStill: 0,
      dim: 1,
      creator: true,
    };
  }

  function applyLevel(lvl) {
    editId = lvl.id || null;
    if (nameEl) nameEl.value = lvl.name || "UNNAMED";
    if (tauntEl) tauntEl.value = lvl.taunt || "YOU BUILT THIS";
    const rows = (lvl.map || []).map((r) => String(r).replace(/ /g, "."));
    map = blankMap();
    for (let y = 0; y < ROWS; y++) {
      const src = rows[y] || "";
      for (let x = 0; x < COLS; x++) {
        map[y][x] = src[x] || (y >= 9 ? "#" : ".");
      }
    }
    ensureUniqueMarks();
    traps = (lvl.events || []).map((ev, i) => ({
      id: "t" + i + "-" + Math.random().toString(36).slice(2, 6),
      kind: guessKind(ev),
      event: JSON.parse(JSON.stringify(ev)),
    }));
    draw();
    renderTraps();
    renderLibrary();
  }

  function guessKind(ev) {
    const a0 = ((ev.do || [])[0] || [])[0];
    if (ev.if && ev.if.jump) return "jump";
    if (ev.if && ev.if.jumpAfter != null) return "hang";
    if (ev.quiet && a0 === "glow") return "glow";
    if (ev.quiet) return "dust";
    if (a0 === "hole") return "hole";
    if (a0 === "laser") return "laser";
    if (a0 === "saw") return "saw";
    if (a0 === "reverse") return "reverse";
    if (a0 === "fill") return "gate";
    return "gate";
  }

  function paintAt(clientX, clientY, erase) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * COLS);
    const y = Math.floor(((clientY - rect.top) / rect.height) * ROWS);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
    const tile = erase ? "." : brush;
    if (tile === "S" || tile === "E") {
      for (let yy = 0; yy < ROWS; yy++) {
        for (let xx = 0; xx < COLS; xx++) {
          if (map[yy][xx] === tile) map[yy][xx] = ".";
        }
      }
    }
    map[y][x] = tile;
    draw();
  }

  function cellFromEvent(ev) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((ev.clientX - rect.left) / rect.width) * COLS);
    const y = Math.floor(((ev.clientY - rect.top) / rect.height) * ROWS);
    return { x, y };
  }

  function addTrapAt(x) {
    if (x < 0 || x >= COLS) return;
    const kind = TRAP_KINDS.find((k) => k.id === trapKind) || TRAP_KINDS[1];
    const y = surfaceY(x);
    const event = kind.build(x, y);
    traps.push({
      id: "t" + Date.now().toString(36),
      kind: kind.id,
      event,
    });
    renderTraps();
    setStatus(`${kind.name} @ ${x}`);
  }

  function draw() {
    const tw = canvas.width / COLS;
    const th = canvas.height / ROWS;
    ctx.fillStyle = "#07090f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = map[y][x];
        const px = x * tw;
        const py = y * th;
        ctx.fillStyle = COLORS[t] || "#333";
        if (t === ".") {
          if ((x + y) % 2 === 0) {
            ctx.fillStyle = "#0d121c";
            ctx.fillRect(px, py, tw, th);
          }
          continue;
        }
        ctx.fillRect(px + 0.5, py + 0.5, tw - 1, th - 1);
        if (t === "#" || t === "=") {
          ctx.fillStyle = t === "=" ? "#b9a484" : "#cfc1aa";
          ctx.fillRect(px + 0.5, py + 0.5, tw - 1, 3);
        }
        if (t === "^" || t === "v") {
          ctx.fillStyle = "#f4ead8";
          ctx.beginPath();
          if (t === "^") {
            ctx.moveTo(px + 2, py + th - 2);
            ctx.lineTo(px + tw / 2, py + 2);
            ctx.lineTo(px + tw - 2, py + th - 2);
          } else {
            ctx.moveTo(px + 2, py + 2);
            ctx.lineTo(px + tw / 2, py + th - 2);
            ctx.lineTo(px + tw - 2, py + 2);
          }
          ctx.fill();
        }
        if ("SEFBoC!".includes(t)) {
          ctx.fillStyle = "#0a080c";
          ctx.font = "bold 10px Rubik, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(t, px + tw / 2, py + th / 2 + 0.5);
        }
      }
    }
    // trap markers
    ctx.globalAlpha = 0.85;
    for (const t of traps) {
      const x = markerX(t.event);
      if (x == null) continue;
      const px = x * tw + tw / 2;
      ctx.fillStyle = t.event.quiet ? "#9a8c7a" : "#ffd27a";
      ctx.beginPath();
      ctx.moveTo(px, 4);
      ctx.lineTo(px - 4, 12);
      ctx.lineTo(px + 4, 12);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(244,234,216,0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * tw, 0);
      ctx.lineTo(x * tw, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * th);
      ctx.lineTo(canvas.width, y * th);
      ctx.stroke();
    }
  }

  function markerX(ev) {
    if (!ev) return null;
    const a = (ev.do || []).find((d) => ["fill", "hole", "laser", "saw", "dust", "glow"].includes(d[0]));
    if (a && typeof a[1] === "number") {
      const x = a[0] === "laser" ? (a[1] | 0) + 1 : (a[1] | 0);
      return Math.max(0, Math.min(COLS - 1, x));
    }
    if (ev.if && ev.if.x != null) return Math.max(0, Math.min(COLS - 1, Math.round(ev.if.x)));
    if (ev.if && ev.if.xLess != null) return Math.max(0, Math.min(COLS - 1, Math.round(ev.if.xLess)));
    if (ev.if && ev.if.jumpAfter != null) return Math.max(0, Math.min(COLS - 1, Math.round(ev.if.jumpAfter + 2)));
    return null;
  }

  function renderBrushes() {
    if (!brushBox) return;
    brushBox.innerHTML = "";
    BRUSHES.forEach((b) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "creator-brush" + (brush === b.id && !trapKind ? " on" : "");
      btn.textContent = b.label;
      btn.title = b.tip;
      btn.onclick = () => {
        brush = b.id;
        trapKind = null;
        renderBrushes();
        renderKinds();
        setStatus(b.tip);
      };
      brushBox.appendChild(btn);
    });
  }

  function renderKinds() {
    if (!kindBox) return;
    kindBox.innerHTML = "";
    TRAP_KINDS.forEach((k) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "creator-kind" + (trapKind === k.id ? " on" : "");
      btn.textContent = k.name;
      btn.onclick = () => {
        trapKind = k.id;
        renderKinds();
        renderBrushes();
        setStatus(`Trap: ${k.name} — click a column`);
      };
      kindBox.appendChild(btn);
    });
  }

  function renderTraps() {
    if (!trapList) return;
    trapList.innerHTML = "";
    if (!traps.length) {
      const empty = document.createElement("span");
      empty.className = "hint";
      empty.textContent = "No traps yet.";
      trapList.appendChild(empty);
      draw();
      return;
    }
    traps.forEach((t, i) => {
      const kind = TRAP_KINDS.find((k) => k.id === t.kind);
      const x = markerX(t.event);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "creator-trap-chip" + (t.event.quiet ? " quiet" : "");
      btn.textContent = `${kind ? kind.name : t.kind}${x != null ? " @" + x : ""} ✕`;
      btn.title = "Remove trap";
      btn.onclick = () => {
        traps.splice(i, 1);
        renderTraps();
        setStatus("Trap removed");
      };
      trapList.appendChild(btn);
    });
    draw();
  }

  function renderLibrary() {
    if (!library) return;
    library.innerHTML = "";
    const rooms = loadStore();
    if (!rooms.length) {
      const empty = document.createElement("span");
      empty.className = "hint";
      empty.textContent = "No saved rooms.";
      library.appendChild(empty);
      return;
    }
    rooms.forEach((room) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "creator-lib-item";
      const n = (room.events || []).length;
      btn.innerHTML = `${room.name || "UNNAMED"}<span class="meta">${n} traps · load / hold to delete</span>`;
      btn.onclick = () => {
        applyLevel(room);
        setStatus(`Loaded ${room.name}`);
      };
      let holdTimer = null;
      btn.addEventListener("pointerdown", () => {
        holdTimer = setTimeout(() => {
          const next = loadStore().filter((r) => r.id !== room.id);
          writeStore(next);
          if (editId === room.id) editId = null;
          renderLibrary();
          setStatus(`Deleted ${room.name}`);
        }, 700);
      });
      const clearHold = () => { if (holdTimer) clearTimeout(holdTimer); holdTimer = null; };
      btn.addEventListener("pointerup", clearHold);
      btn.addEventListener("pointerleave", clearHold);
      library.appendChild(btn);
    });
  }

  function openCreator() {
    const title = document.getElementById("title-screen");
    const levels = document.getElementById("levels-screen");
    if (title) title.classList.add("hidden");
    if (levels) levels.classList.add("hidden");
    screen.classList.remove("hidden");
    if (window.__GAME && typeof window.__GAME.setMode === "function") {
      window.__GAME.setMode("creator");
    }
    renderBrushes();
    renderKinds();
    renderTraps();
    renderLibrary();
    draw();
    setStatus("Paint tiles · pick a trap · click the map");
  }

  function closeCreator() {
    screen.classList.add("hidden");
    const title = document.getElementById("title-screen");
    if (title) title.classList.remove("hidden");
    if (window.__GAME && typeof window.__GAME.setMode === "function") {
      window.__GAME.setMode("title");
    }
  }

  function saveRoom() {
    const lvl = buildLevel();
    const rooms = loadStore();
    const idx = rooms.findIndex((r) => r.id === lvl.id);
    if (idx >= 0) rooms[idx] = lvl;
    else rooms.unshift(lvl);
    editId = lvl.id;
    writeStore(rooms.slice(0, 40));
    renderLibrary();
    setStatus(`Saved ${lvl.name}`);
  }

  function testRoom() {
    const lvl = buildLevel();
    const g = window.__GAME;
    if (!g || typeof g.playCustom !== "function") {
      setStatus("Game not ready");
      return;
    }
    g.playCustom([lvl], {
      dim: 1,
      testMode: true,
      onExit: (info) => {
        openCreator();
        if (info && info.reason === "clear") {
          setStatus(`Cleared in ${info.time.toFixed(1)}s · ☠ ${info.deaths}`);
        } else {
          setStatus("Back in creator");
        }
      },
    });
  }

  function exportJson() {
    const lvl = buildLevel();
    const text = JSON.stringify({
      name: lvl.name,
      taunt: lvl.taunt,
      map: lvl.map,
      events: lvl.events,
    }, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => setStatus("JSON copied"),
        () => setStatus("Copy failed — check console")
      );
    } else {
      console.log(text);
      setStatus("JSON printed to console");
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    if (trapKind) {
      const { x } = cellFromEvent(e);
      addTrapAt(x);
      return;
    }
    painting = true;
    paintAt(e.clientX, e.clientY, e.button === 2 || e.altKey);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!painting || trapKind) return;
    paintAt(e.clientX, e.clientY, e.buttons === 2 || e.altKey);
  });
  canvas.addEventListener("pointerup", () => { painting = false; });
  canvas.addEventListener("pointercancel", () => { painting = false; });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  const creatorBtn = document.getElementById("creator-btn");
  if (creatorBtn) creatorBtn.onclick = openCreator;
  const backBtn = document.getElementById("creator-back");
  if (backBtn) backBtn.onclick = closeCreator;
  const saveBtn = document.getElementById("creator-save");
  if (saveBtn) saveBtn.onclick = saveRoom;
  const testBtn = document.getElementById("creator-test");
  if (testBtn) testBtn.onclick = testRoom;
  const newBtn = document.getElementById("creator-new");
  if (newBtn) {
    newBtn.onclick = () => {
      editId = null;
      map = blankMap();
      traps = [];
      if (nameEl) nameEl.value = "UNNAMED";
      if (tauntEl) tauntEl.value = "YOU BUILT THIS";
      draw();
      renderTraps();
      setStatus("New room");
    };
  }
  const exportBtn = document.getElementById("creator-export");
  if (exportBtn) exportBtn.onclick = exportJson;

  window.addEventListener("keydown", (e) => {
    if (screen.classList.contains("hidden")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeCreator();
    }
  });

  try { draw(); } catch (_) { /* canvas optional at boot */ }

  window.__CREATOR = {
    open: openCreator,
    close: closeCreator,
    buildLevel,
    applyLevel,
  };
})();
