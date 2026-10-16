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
    "TRUST ME": "Dust first. Then the floor leaves. I named it TRUST ME. Sorry.",
    "KEEP JUMPING": "The landing is already a gap. I know. Cruel.",
    "KNOCK KNOCK": "Right door is the joke. I watched people fall for it.",
    "WAIT FOR IT": "Ceiling teeth. Floor arrives at 1.9s. Patience hurts.",
    "SHINY": "Three coins over a pit. They explode. Greed got me too.",
    "BACKWARDS": "Left and right swap. I still flinch.",
    "CHECKERED": "Some bricks are paint. I die here showing people.",
    "BUZZ": "The saw by the door starts chasing. I'm weirdly proud.",
    "YEET": "Bounce pad, then lighter gravity. Stomach drop.",
    "UP IS DOWN": "Exit is on the ceiling. I almost softlocked myself.",
    "COME BACK": "The door slides away. Keep walking. Keep mad.",
    "FALL IN": "The door is in the hole. Jump. Feel wrong. Do it.",
    "DON'T STOP": "Standing still drops the bricks. Move. Please.",
    "PSYCH": "Fake door, then the walk back. My favorite betrayal.",
    "THROUGH": "Middle wall isn't there. Walk into it with me.",
    "LAST LAUGH": "Coins explode. Right door is fake. Again. I know."
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
  if (pack) {
    pack.DIMS.forEach((dim, i) => {
      const d = i + 1;
      const roomsN = pack.roomCount(d);
      const handTraps = d === 1 && window.HAND_LEVELS && window.HAND_LEVELS[0] && window.HAND_LEVELS[0].events
        ? window.HAND_LEVELS[0].events.length
        : 0;
      const traps = handTraps || pack.trapCount(d);
      const boss = d === 1 ? traps : traps + 4;
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
      const sigs = (pack.signatureTraps && pack.signatureTraps(d)) || [];
      const sigLine = sigs.length ? " · " + sigs.map((t) => t.label).join(" / ") : "";
      meta.textContent = roomsN + " rooms · " + traps + " traps" + (d > 1 ? " · core " + boss : "") + sigLine + " · " + dim.weather + " · " + dim.bpm + " bpm";
      card.append(pip, idx, who, meta);
      bins[Math.floor(i / 5)].appendChild(card);
    });
  }
})();
