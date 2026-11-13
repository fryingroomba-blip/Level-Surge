/* Scroll world behind the sideshow lesson. The About page is not this screen. */
(function () {
  const screen = document.getElementById("sideshow-screen");
  const canvas = document.getElementById("sideshow-world");
  const scroller = document.getElementById("sideshow-scroll");
  if (!screen || !canvas || !scroller || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const KEY = "level-surge-sideshow-looks";
  const HEX = /^#[0-9a-fA-F]{6}$/;

  function hex(v, fallback) {
    return HEX.test(String(v || "")) ? String(v).toLowerCase() : fallback;
  }
  function num(v, min, max, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  }
  function label(v, fallback) {
    const s = String(v == null ? "" : v).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 24);
    return s || fallback;
  }
  function idOf(v) {
    return String(v || "").replace(/[^a-z0-9-]/g, "").slice(0, 24);
  }

  const PRESETS = [
    { id: "nullscape", name: "NULLSCAPE", sky: ["#1a1020", "#100c14", "#07060a"], accent: "#e31b1b", second: "#ffd27a", ink: "#f4ead8", arch: "brick", weather: "shards", follow: 0.12, motes: 0.5 },
    { id: "kiln", name: "FUTURISTIC KILN", sky: ["#2a120c", "#140806", "#0a0504"], accent: "#ff5a18", second: "#ffc56a", ink: "#ffe7d0", arch: "kiln", weather: "ash", follow: 0.16, motes: 0.7 },
    { id: "nave", name: "MINIMAL NAVE", sky: ["#16324c", "#0e2233", "#08141e"], accent: "#9ed0f0", second: "#f4fbff", ink: "#f4fbff", arch: "nave", weather: "snow", follow: 0.08, motes: 0.3 },
    { id: "court", name: "ENCHANTED COURT", sky: ["#2a1038", "#14081c", "#0c0612"], accent: "#c45cff", second: "#f0c6ff", ink: "#ffe6ff", arch: "grove", weather: "pollen", follow: 0.1, motes: 0.6 },
    { id: "glass", name: "UNDERWATER GLASS", sky: ["#0c3048", "#082030", "#041018"], accent: "#3ec8c0", second: "#d8fff8", ink: "#e7fff8", arch: "reef", weather: "bubbles", follow: 0.09, motes: 0.45 },
    { id: "signal", name: "ABSTRACT SIGNAL", sky: ["#14180c", "#0c1008", "#070806"], accent: "#d6e24a", second: "#f6ffb0", ink: "#f8ffd8", arch: "grid", weather: "static", follow: 0.2, motes: 0.35 },
    { id: "doors", name: "CELESTIAL DOORS", sky: ["#241808", "#120c08", "#0a0808"], accent: "#f0c14b", second: "#fff6e8", ink: "#fff6e8", arch: "spire", weather: "dust", follow: 0.11, motes: 0.4 },
  ];

  function clean(raw, builtIn) {
    const src = raw && typeof raw === "object" ? raw : {};
    const sky = Array.isArray(src.sky) ? src.sky : [];
    const base = PRESETS[0];
    return {
      id: idOf(src.id) || (builtIn ? base.id : "custom"),
      name: label(src.name, base.name),
      builtIn: !!builtIn,
      sky: [hex(sky[0], base.sky[0]), hex(sky[1], base.sky[1]), hex(sky[2], base.sky[2])],
      accent: hex(src.accent, base.accent),
      second: hex(src.second, base.second),
      ink: hex(src.ink, base.ink),
      arch: ["brick", "kiln", "nave", "grove", "reef", "grid", "spire"].indexOf(src.arch) >= 0 ? src.arch : "brick",
      weather: ["shards", "ash", "snow", "pollen", "bubbles", "static", "dust"].indexOf(src.weather) >= 0 ? src.weather : "shards",
      follow: num(src.follow, 0.04, 0.4, 0.12),
      motes: num(src.motes, 0, 1, 0.5),
    };
  }

  function loadCustom() {
    let text = "";
    try { text = localStorage.getItem(KEY) || ""; } catch (_) { return []; }
    if (!text || text.length > 40000) return [];
    try {
      const data = JSON.parse(text, function (key, value) {
        if (key === "__proto__" || key === "prototype" || key === "constructor") return undefined;
        return value;
      });
      if (!Array.isArray(data)) return [];
      return data.slice(0, 8).map(function (row) { return clean(row, false); })
        .filter(function (row) { return !PRESETS.some(function (p) { return p.id === row.id; }); });
    } catch (_) { return []; }
  }
  function persist(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 8))); } catch (_) { /* quota */ }
  }
  function allLooks() {
    return PRESETS.map(function (p) { return clean(p, true); }).concat(loadCustom());
  }

  let look = clean(PRESETS[0], true);
  let reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  let w = 1;
  let h = 1;
  let cam = 0;
  const pointer = { x: 0.7, y: 0.4, on: false };

  function applyLook() {
    screen.style.setProperty("--side-accent", look.accent);
    screen.style.setProperty("--side-ink", look.ink);
    screen.style.setProperty("--side-gold", look.second);
  }

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const rect = screen.getBoundingClientRect();
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function progress() {
    const max = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
    return scroller.scrollTop / max;
  }

  function rgba(color, a) {
    const n = parseInt(color.slice(1), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  function mark() {
    const cards = scroller.querySelectorAll(".sideshow-platform");
    const line = scroller.scrollTop + scroller.clientHeight * 0.28;
    let best = 0;
    let bestD = 1e9;
    for (let i = 0; i < cards.length; i++) {
      const d = Math.abs(cards[i].offsetTop - line);
      cards[i].classList.toggle("is-near", false);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (cards[best]) cards[best].classList.add("is-near");
    const count = document.getElementById("sideshow-count");
    if (count) count.textContent = (best + 1) + " / " + cards.length;
  }

  const shards = [];
  const FACES = ["#2f7dff", "#ff2d6a", "#ff4fd0", "#ff6a22", "#9fd6ff"];

  function seedShard(s, i) {
    const cols = 8;
    const rows = 6;
    const n = cols * rows;
    const k = i % n;
    const layer = Math.floor(i / n);
    s.x = ((k % cols) + 0.5) / cols + ((layer % 2) ? 0.06 : -0.02);
    s.y = (Math.floor(k / cols) + 0.5) / rows + (layer ? 0.07 : 0);
    s.size = layer ? 0.16 : 0.28;
    s.rot = ((i * 17) % 360) * Math.PI / 180;
    s.spin = ((i % 2) ? 1 : -1) * 0.0015;
    s.face = FACES[i % FACES.length];
    s.streak = i % 11 === 0;
    return s;
  }

  function tri(ax, ay, bx, by, cx, cy, fill) {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function crystal(s, bright) {
    const S = Math.min(w, h) * s.size * (1 + bright * 0.05);
    ctx.save();
    ctx.translate(s.x * w, s.y * h);
    ctx.rotate(s.rot);
    ctx.globalAlpha = 1;
    tri(0, -S, S * 0.86, S * 0.05, 0, S * 0.15, "#140c18");
    tri(0, -S, -S * 0.78, S * 0.22, 0, S * 0.15, "#0c1024");
    tri(0, S * 0.15, S * 0.7, S * 0.92, -S * 0.42, S * 0.8, "#1a0a16");
    ctx.globalAlpha = 0.55 + bright * 0.45;
    tri(0, -S * 0.82, S * 0.38, -S * 0.02, 0, S * 0.22, s.face);
    ctx.globalAlpha = 0.35 + bright * 0.5;
    tri(-S * 0.08, -S * 0.2, -S * 0.55, S * 0.35, 0, S * 0.15, s.face);
    ctx.globalAlpha = 0.7 + bright * 0.3;
    ctx.strokeStyle = bright > 0.45 ? "#f4fbff" : s.face;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(0, -S);
    ctx.lineTo(S * 0.86, S * 0.05);
    ctx.lineTo(S * 0.7, S * 0.92);
    ctx.lineTo(-S * 0.78, S * 0.22);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = s.streak ? 0.55 + bright * 0.45 : bright * 0.9;
    if (s.streak || bright > 0.5) {
      ctx.strokeStyle = "#ff5a1a";
      ctx.lineWidth = 2.2 + bright * 2.2;
      ctx.beginPath();
      ctx.moveTo(-S * 0.12, -S * 0.62);
      ctx.lineTo(S * 0.48, S * 0.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShards() {
    const count = reduced ? 48 : 96;
    while (shards.length < count) shards.push(seedShard({}, shards.length));
    if (shards.length > count) shards.length = count;
    ctx.fillStyle = "#05030a";
    ctx.fillRect(0, 0, w, h);
    const mx = pointer.x * w;
    const my = pointer.y * h;
    for (let i = 0; i < shards.length; i++) {
      const s = shards[i];
      if (!reduced) s.rot += s.spin;
      let bright = 0.16;
      if (pointer.on) {
        const dist = Math.hypot(mx - s.x * w, my - s.y * h);
        const reach = Math.min(w, h) * s.size * 0.85;
        if (dist < reach) bright = 0.16 + (1 - dist / reach) * 0.84;
      }
      crystal(s, bright);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (screen.classList.contains("hidden") || document.hidden) return;
    const t = (now || 0) / 1000;
    const p = progress();
    cam += ((p - cam) * (reduced ? 1 : 0.08));
    drawShards();
    mark();
  }

  function paintPresets() {
    const box = document.getElementById("sideshow-presets");
    const name = document.getElementById("sideshow-name");
    const accent = document.getElementById("sideshow-accent");
    const second = document.getElementById("sideshow-second");
    const follow = document.getElementById("sideshow-follow");
    const motesInput = document.getElementById("sideshow-motes");
    const still = document.getElementById("sideshow-still");
    if (!box) return;
    box.textContent = "";
    name.value = look.name;
    accent.value = look.accent;
    second.value = look.second;
    follow.value = String(look.follow);
    motesInput.value = String(look.motes);
    still.checked = reduced;
    allLooks().forEach(function (item) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ghost-btn";
      btn.textContent = item.name;
      if (item.id === look.id) btn.style.borderColor = look.accent;
      btn.addEventListener("click", function () {
        const found = allLooks().filter(function (row) { return row.id === item.id; })[0];
        look = clean(found, !!found.builtIn);
        applyLook();
        paintPresets();
      });
      box.appendChild(btn);
    });
  }

  function readForm() {
    look = clean({
      id: look.builtIn ? "c" + Date.now() : look.id,
      name: document.getElementById("sideshow-name").value,
      sky: look.sky,
      accent: document.getElementById("sideshow-accent").value,
      second: document.getElementById("sideshow-second").value,
      ink: look.ink,
      arch: look.arch,
      weather: look.weather,
      follow: document.getElementById("sideshow-follow").value,
      motes: document.getElementById("sideshow-motes").value,
    }, false);
    applyLook();
  }

  const lookBtn = document.getElementById("sideshow-look");
  const panel = document.getElementById("sideshow-looks");
  if (lookBtn && panel) {
    lookBtn.addEventListener("click", function () {
      const hidden = panel.classList.toggle("hidden");
      lookBtn.setAttribute("aria-expanded", hidden ? "false" : "true");
    });
  }
  ["sideshow-name", "sideshow-accent", "sideshow-second", "sideshow-follow", "sideshow-motes"].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", readForm);
  });
  const still = document.getElementById("sideshow-still");
  if (still) still.addEventListener("change", function () { reduced = still.checked; });
  document.getElementById("sideshow-save").addEventListener("click", function () {
    readForm();
    const list = loadCustom().filter(function (row) { return row.id !== look.id; });
    list.unshift(look);
    persist(list);
    paintPresets();
  });
  document.getElementById("sideshow-copy").addEventListener("click", function () {
    readForm();
    look = clean(look, false);
    look.id = idOf("c" + Date.now());
    look.name = label(look.name + " COPY", "COPY");
    look.builtIn = false;
    const list = loadCustom();
    list.unshift(look);
    persist(list);
    applyLook();
    paintPresets();
  });
  document.getElementById("sideshow-delete").addEventListener("click", function () {
    if (look.builtIn) return;
    persist(loadCustom().filter(function (row) { return row.id !== look.id; }));
    look = clean(PRESETS[0], true);
    applyLook();
    paintPresets();
  });

  screen.addEventListener("pointermove", function (e) {
    const rect = screen.getBoundingClientRect();
    pointer.x = (e.clientX - rect.left) / Math.max(1, rect.width);
    pointer.y = (e.clientY - rect.top) / Math.max(1, rect.height);
    pointer.on = true;
  });
  screen.addEventListener("pointerleave", function () { pointer.on = false; });
  scroller.addEventListener("scroll", mark);
  window.addEventListener("resize", fit);
  function stage(parent, bits) {
    const box = document.createElement("div");
    box.className = "lie-stage";
    bits.forEach(function (bit) {
      const el = document.createElement(bit.text ? "span" : "i");
      el.className = bit.cls;
      if (bit.text) el.textContent = bit.text;
      if (bit.left) el.style.left = bit.left;
      box.appendChild(el);
    });
    parent.insertBefore(box, parent.firstChild);
  }
  function row(cls, n, left0, step) {
    const out = [];
    for (let i = 0; i < n; i++) out.push({ cls: cls, left: (left0 + i * step) + "px" });
    return out;
  }
  const lessons = {
    "side-open": [{ cls: "lie-floor" }, { cls: "lie-cube" }, { cls: "lie-door real" }, { cls: "lie-cap", text: "EXIT", left: "78%" }],
    "side-job": [{ cls: "lie-floor" }, { cls: "lie-skull" }, { cls: "lie-door real" }, { cls: "lie-cap", text: "SAME ROOM", left: "8px" }],
    "side-door": [{ cls: "lie-floor" }, { cls: "lie-door fake", left: "18%" }, { cls: "lie-cap", text: "FAKE", left: "18%" }, { cls: "lie-door real" }, { cls: "lie-cap", text: "REAL", left: "78%" }],
    "side-watch": [{ cls: "lie-floor" }, { cls: "lie-brick", left: "42%" }, { cls: "lie-cap", text: "0.4s", left: "42%" }],
    "side-answer": [{ cls: "lie-floor" }].concat(row("lie-spike", 4, 24, 18)).concat([{ cls: "lie-saw", left: "62%" }, { cls: "lie-beam" }]),
    "side-bar": [{ cls: "lie-floor" }].concat(row("lie-pip", 5, 16, 16)).concat([{ cls: "lie-cap", text: "????", left: "120px" }]),
    "side-hands": [{ cls: "lie-floor" }, { cls: "lie-cube" }, { cls: "lie-cap", text: "SHIFT", left: "46%" }],
    "side-handmade": [{ cls: "lie-floor" }].concat(row("lie-tick", 16, 12, 16)),
    "side-growth": [{ cls: "lie-floor" }].concat(row("lie-tile", 6, 12, 28)).concat([{ cls: "lie-door real" }]),
    "side-tiers": [{ cls: "lie-floor" }, { cls: "lie-cap tier", text: "RARE", left: "8px" }, { cls: "lie-cap tier", text: "HORROR", left: "34%" }, { cls: "lie-cap tier", text: "APEX", left: "66%" }],
    "side-boss": [{ cls: "lie-floor" }, { cls: "lie-cube" }, { cls: "lie-door jump" }, { cls: "lie-cap", text: "30s", left: "46%" }],
    "side-sound": [{ cls: "lie-floor" }, { cls: "lie-bar", left: "16px" }, { cls: "lie-bar", left: "28px" }, { cls: "lie-bar", left: "40px" }, { cls: "lie-cap", text: "MUTE", left: "64px" }],
  };
  Object.keys(lessons).forEach(function (id) {
    const node = document.getElementById(id);
    if (node) stage(node, lessons[id]);
  });
  scroller.querySelectorAll(".lie-pip").forEach(function (el, i) { el.style.animationDelay = (i * 0.25) + "s"; if (i === 2) el.classList.add("on"); });
  scroller.querySelectorAll(".lie-bar").forEach(function (el, i) { el.style.height = (16 + i * 10) + "px"; el.style.animationDelay = (i * 0.12) + "s"; });
  scroller.querySelectorAll(".lie-tile").forEach(function (el, i) { el.style.animationDelay = (i * 0.12) + "s"; });

  applyLook();
  paintPresets();
  fit();
  mark();
  window.SURGE_SIDESHOW = Object.freeze({
    wake: function () { fit(); mark(); },
  });
  requestAnimationFrame(frame);
})();
