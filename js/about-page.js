(function () {
  const GLYPH = {
    A: "img/glyphs/a.svg?v=8",
    D: "img/glyphs/d.svg?v=8",
    R: "img/glyphs/r.svg?v=8",
    S: "img/glyphs/s.svg?v=8",
    G: "img/logo-g.svg"
  };

  function channel(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(255, x | 0));
  }

  function rgb(accent) {
    const a = accent || [227, 27, 27];
    return "rgb(" + channel(a[0]) + "," + channel(a[1]) + "," + channel(a[2]) + ")";
  }

  document.querySelectorAll("h2[data-letters]").forEach((el) => {
    const allow = new Set(el.dataset.letters.split(""));
    const used = new Set();
    const text = el.textContent.trim();
    el.setAttribute("aria-label", text);
    el.textContent = "";
    let buf = "";
    const flush = () => {
      if (!buf) return;
      const s = document.createElement("span");
      s.textContent = buf;
      el.append(s);
      buf = "";
    };
    for (const ch of text) {
      if (ch === " ") {
        flush();
        const sp = document.createElement("span");
        sp.className = "sp";
        el.append(sp);
        continue;
      }
      if (allow.has(ch) && GLYPH[ch] && !used.has(ch)) {
        used.add(ch);
        flush();
        const g = document.createElement("span");
        g.className = "glyph" + (ch === "A" ? " horn" : "");
        const img = document.createElement("img");
        img.src = GLYPH[ch];
        img.alt = "";
        g.append(img);
        el.append(g);
      } else buf += ch;
    }
    flush();
  });

  const NOTES = {
    "TRUST ME": "Dust, then the floor leaves.",
    "KEEP JUMPING": "The landing is already a hole.",
    "KNOCK KNOCK": "The door on the right is fake.",
    "WAIT FOR IT": "Ceiling spikes. The floor comes back at 1.9 seconds.",
    "SHINY": "Three coins over spikes. They blow up.",
    "BACKWARDS": "Left and right swap for a second.",
    "CHECKERED": "Some of the bricks are just paint.",
    "BUZZ": "The saw by the door starts following you.",
    "YEET": "The pad throws you, then gravity gets light.",
    "UP IS DOWN": "The door is on the ceiling.",
    "COME BACK": "The door slides away while you walk.",
    "FALL IN": "The door is down in the hole.",
    "DON'T STOP": "Stand still for 0.4 seconds and the floor drops.",
    "PSYCH": "Fake door. Then you walk back.",
    "THROUGH": "The wall in the middle is paint.",
    "LAST LAUGH": "The coins blow up, and the right door is fake again."
  };

  const rooms = document.getElementById("room-list");
  (window.HAND_LEVELS || []).forEach((level, i) => {
    const card = document.createElement("article");
    card.className = "room";
    const name = document.createElement("strong");
    name.textContent = level.name;
    const num = document.createElement("span");
    num.className = "num";
    num.textContent = String(i + 1).padStart(2, "0");
    const note = document.createElement("p");
    note.textContent = (NOTES[level.name] ? NOTES[level.name] + " · " : "") + (level.taunt || "");
    card.append(num, name, note);
    rooms.appendChild(card);
  });

  const pack = window.SURGE_WORLDS;
  const bins = [
    document.getElementById("world-a"),
    document.getElementById("world-b"),
    document.getElementById("world-c"),
    document.getElementById("world-d")
  ];
  function apexHint(d) {
    if (d < 8) return "—";
    if (d < 10) return "~1/8";
    const tier = 1 + Math.floor((d - 10) / 3);
    return String(tier) + "±";
  }

  function rareCap(d) {
    if (d >= 10) return 2;
    if (d >= 2) return 1;
    return 0;
  }

  function entityCap(d) {
    if (d >= 10) return 2;
    if (d >= 5) return 1;
    return 0;
  }

  if (pack) {
    pack.DIMS.forEach((dim, i) => {
      const d = i + 1;
      const roomsN = pack.roomCount(d);
      const traps = pack.trapCount(d);
      const boss = traps + 4;
      const color = rgb(dim.accent);
      const card = document.createElement("article");
      card.className = "world";
      const pip = document.createElement("i");
      pip.style.background = color;
      pip.style.boxShadow = "0 0 8px " + color;
      const idx = document.createElement("span");
      idx.className = "idx";
      idx.textContent = "D" + String(d).padStart(2, "0");
      const who = document.createElement("div");
      who.className = "who";
      const name = document.createElement("strong");
      name.textContent = dim.name;
      const lore = document.createElement("span");
      lore.className = "lore";
      lore.textContent = dim.lore;
      who.append(name, lore);
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = d === 1
        ? roomsN + " rooms · handmade"
        : roomsN + " rooms · " + traps + " traps · last room " + boss;
      card.append(pip, idx, who, meta);
      bins[Math.floor(i / 5)].appendChild(card);
    });

    const scaleBody = document.querySelector("#scale-table tbody");
    if (scaleBody) {
      pack.DIMS.forEach((dim, i) => {
        const d = i + 1;
        const roomsN = pack.roomCount(d);
        const traps = pack.trapCount(d);
        const width = pack.stageWidth ? pack.stageWidth(d) : 32 + 5 * Math.max(0, d - 1);
        const act = pack.activationCap ? pack.activationCap(d) : 4 + 10 * Math.max(0, d - 1);
        const sigs = (pack.signatureTraps && pack.signatureTraps(d)) || [];
        const tr = document.createElement("tr");
        const cells = [
          "D" + String(d).padStart(2, "0"),
          String(roomsN),
          String(width),
          String(traps),
          d === 1 ? "—" : String(traps + 4),
          String(act),
          String(rareCap(d)),
          String(entityCap(d)),
          apexHint(d),
          sigs.map((t) => t.label).join(" / ") || "—",
        ];
        cells.forEach((text, ci) => {
          const td = document.createElement("td");
          if (ci === cells.length - 1) td.className = "sig";
          td.textContent = text;
          tr.appendChild(td);
        });
        scaleBody.appendChild(tr);
      });
    }

    const sigList = document.getElementById("sig-list");
    if (sigList) {
      pack.DIMS.forEach((dim, i) => {
        const d = i + 1;
        const sigs = (pack.signatureTraps && pack.signatureTraps(d)) || [];
        if (!sigs.length) return;
        const li = document.createElement("li");
        const b = document.createElement("b");
        b.textContent = "D" + String(d).padStart(2, "0");
        const em = document.createElement("em");
        em.textContent = dim.name + " — " + sigs.map((t) => t.label + " (" + t.family + ")").join(" · ");
        li.append(b, em);
        sigList.appendChild(li);
      });
    }
  }

  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
  const props = document.querySelectorAll(".edge-stage .prop");
  const hair = document.getElementById("scroll-hair");
  const navLinks = [];
  document.querySelectorAll(".nav a[href^='#']").forEach((a) => {
    const sec = document.getElementById(a.getAttribute("href").slice(1));
    if (sec) navLinks.push({ a, sec });
  });

  function placeProps() {
    const y = window.scrollY || 0;
    const scale = small ? 0.72 : 1;
    props.forEach((el) => {
      if (reduced) return;
      const depth = Number(el.getAttribute("data-depth")) || 0;
      const bob = Math.sin(y * 0.008 + depth * 4) * 5;
      const shift = y * depth * 0.06 + bob;
      el.style.transform = "translate3d(0," + shift.toFixed(1) + "px,0) scale(" + scale + ")";
    });
    if (hair) {
      const full = document.documentElement.scrollHeight - window.innerHeight;
      const p = full > 0 ? Math.min(1, y / full) : 0;
      hair.style.width = (p * 100).toFixed(2) + "%";
    }
    const mark = y + 140;
    let current = navLinks[0];
    navLinks.forEach((item) => {
      if (item.sec.offsetTop <= mark) current = item;
    });
    navLinks.forEach((item) => item.a.classList.toggle("on", item === current));
  }

  let propQueued = false;
  function queueProps() {
    if (propQueued) return;
    propQueued = true;
    window.requestAnimationFrame(() => {
      propQueued = false;
      placeProps();
    });
  }
  window.addEventListener("scroll", queueProps, { passive: true });
  placeProps();
})();
