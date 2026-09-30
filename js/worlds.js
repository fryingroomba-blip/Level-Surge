(function (root) {
  const W = 32;
  const pad = (s) => {
    s = String(s).replace(/ /g, ".");
    if (s.length < W) return s + ".".repeat(W - s.length);
    return s.slice(0, W);
  };
  const sky = () => pad("");
  const floor = () => pad("################################");

  const DIMS = [
    { name: "NULLSCAPE", lore: "The void learned your name.", weather: "shards", bpm: 128, root: 92.5, sky: ["#0b1018", "#07090f", "#04050a"], planet: ["#ffffff", "#7b93bc", "#1b2433"], needle: "#101624", edge: "rgba(160,190,230,0.22)", accent: [210, 225, 255], mul: "rgba(70,90,120,0.45)", brick: ["#4a4038", "#cfc1aa"] },
    { name: "ASHWELL", lore: "Every ember is a countdown.", weather: "ember", bpm: 122, root: 87.31, sky: ["#1a0c08", "#120806", "#070403"], planet: ["#ffd0a0", "#c45a28", "#3a1208"], needle: "#2a1410", edge: "rgba(255,140,70,0.28)", accent: [255, 120, 60], mul: "rgba(80,40,20,0.5)", brick: ["#5a3020", "#d4a080"] },
    { name: "FROSTBITE", lore: "Ice remembers every jump.", weather: "snow", bpm: 118, root: 98.00, sky: ["#0c1520", "#081018", "#040810"], planet: ["#e8f4ff", "#8ec4e8", "#1a3048"], needle: "#122030", edge: "rgba(180,220,255,0.3)", accent: [180, 220, 255], mul: "rgba(40,70,100,0.5)", brick: ["#3a4858", "#c0d4e4"] },
    { name: "BLOOMVOID", lore: "Pretty things bite first.", weather: "spores", bpm: 126, root: 103.83, sky: ["#14081a", "#0c0612", "#06040a"], planet: ["#ffd0ff", "#c060c8", "#3a1040"], needle: "#201028", edge: "rgba(220,120,255,0.28)", accent: [220, 120, 255], mul: "rgba(70,30,80,0.48)", brick: ["#4a2850", "#e0b0e8"] },
    { name: "IRON CLOCK", lore: "Time is another trap.", weather: "sparks", bpm: 132, root: 110.00, sky: ["#121410", "#0a0c0a", "#050605"], planet: ["#ffe8a0", "#c8a040", "#2a2410"], needle: "#1c1e14", edge: "rgba(220,200,80,0.26)", accent: [240, 210, 90], mul: "rgba(50,50,30,0.48)", brick: ["#4a4830", "#d4d0a0"] },
    { name: "TOXIC GUT", lore: "The air wants a taste.", weather: "rain", bpm: 124, root: 82.41, sky: ["#0a180c", "#061208", "#030804"], planet: ["#d8ffb0", "#50a030", "#102808"], needle: "#102010", edge: "rgba(140,255,90,0.26)", accent: [140, 255, 90], mul: "rgba(30,60,30,0.5)", brick: ["#304828", "#b8d890"] },
    { name: "MIRROR SEA", lore: "Left is a rumor.", weather: "shards", bpm: 120, root: 116.54, sky: ["#081018", "#060c14", "#03060c"], planet: ["#c8e8ff", "#4080c0", "#102030"], needle: "#101828", edge: "rgba(100,180,255,0.3)", accent: [100, 180, 255], mul: "rgba(30,50,80,0.5)", brick: ["#283848", "#a0c0d8"] },
    { name: "CINDER RAIL", lore: "The tracks were never safe.", weather: "ember", bpm: 136, root: 77.78, sky: ["#180c08", "#100805", "#080402"], planet: ["#ffb070", "#a03010", "#280808"], needle: "#241008", edge: "rgba(255,90,40,0.3)", accent: [255, 90, 40], mul: "rgba(70,25,15,0.52)", brick: ["#503020", "#e09060"] },
    { name: "STATIC GOD", lore: "The signal is hunting you.", weather: "static", bpm: 140, root: 123.47, sky: ["#101014", "#08080c", "#040406"], planet: ["#e0e0ff", "#8080d0", "#181830"], needle: "#181820", edge: "rgba(180,180,255,0.28)", accent: [180, 180, 255], mul: "rgba(40,40,70,0.5)", brick: ["#383848", "#c0c0e0"] },
    { name: "BONE ORBIT", lore: "Gravity filed a complaint.", weather: "shards", bpm: 114, root: 73.42, sky: ["#14100c", "#0c0a08", "#060504"], planet: ["#f0e0c8", "#a09070", "#282018"], needle: "#1c1810", edge: "rgba(230,210,170,0.26)", accent: [230, 210, 170], mul: "rgba(50,40,30,0.5)", brick: ["#4a4030", "#d8c8a8"] },
    { name: "DEEP GLASS", lore: "You can see the lie coming. You still die.", weather: "snow", bpm: 128, root: 130.81, sky: ["#08141c", "#061018", "#030810"], planet: ["#b0fff8", "#30a0a8", "#082028"], needle: "#0c2024", edge: "rgba(80,255,240,0.28)", accent: [80, 255, 240], mul: "rgba(20,50,55,0.5)", brick: ["#204048", "#90d8d8"] },
    { name: "HUNGER MOON", lore: "It only looks like a moon.", weather: "spores", bpm: 108, root: 69.30, sky: ["#140810", "#0c060a", "#060305"], planet: ["#ffd8c0", "#c04060", "#280810"], needle: "#201018", edge: "rgba(255,80,120,0.28)", accent: [255, 80, 120], mul: "rgba(70,20,40,0.5)", brick: ["#502030", "#e090a8"] },
    { name: "VIOLET WIRE", lore: "Every floor is a circuit.", weather: "sparks", bpm: 144, root: 138.59, sky: ["#10081a", "#0a0612", "#050308"], planet: ["#e8d0ff", "#8040e0", "#1a0830"], needle: "#180c28", edge: "rgba(180,100,255,0.3)", accent: [180, 100, 255], mul: "rgba(50,20,80,0.5)", brick: ["#382850", "#c8a0f0"] },
    { name: "SALT CATHEDRAL", lore: "Worship the gap.", weather: "snow", bpm: 112, root: 65.41, sky: ["#141210", "#0c0a0a", "#060504"], planet: ["#fff6e0", "#d0c090", "#302818"], needle: "#1c1a14", edge: "rgba(240,230,190,0.26)", accent: [240, 230, 190], mul: "rgba(50,45,35,0.48)", brick: ["#504838", "#e8dcc0"] },
    { name: "REDSHIFT", lore: "The closer you get, the further it is.", weather: "ember", bpm: 134, root: 146.83, sky: ["#1a0408", "#100306", "#080204"], planet: ["#ffb0b0", "#e02020", "#300808"], needle: "#28080c", edge: "rgba(255,40,40,0.32)", accent: [255, 40, 40], mul: "rgba(80,10,15,0.52)", brick: ["#581818", "#e08080"] },
    { name: "GHOSTGRID", lore: "Walls that aren't. Floors that were.", weather: "static", bpm: 126, root: 155.56, sky: ["#0c1014", "#080a0c", "#040506"], planet: ["#d0ffe8", "#40c090", "#0c2818"], needle: "#101c18", edge: "rgba(80,255,180,0.26)", accent: [80, 255, 180], mul: "rgba(20,50,40,0.5)", brick: ["#284038", "#a0e0c0"] },
    { name: "NIGHT NEEDLE", lore: "The sky is all spikes now.", weather: "shards", bpm: 138, root: 164.81, sky: ["#080814", "#050510", "#030308"], planet: ["#c8c8ff", "#5050c0", "#101028"], needle: "#101028", edge: "rgba(140,140,255,0.3)", accent: [140, 140, 255], mul: "rgba(30,30,70,0.52)", brick: ["#282848", "#a0a0e8"] },
    { name: "SOLAR GRAVE", lore: "Light that burns the jump.", weather: "sparks", bpm: 130, root: 174.61, sky: ["#1c1408", "#120e06", "#080603"], planet: ["#fff4c0", "#f0a020", "#3a2808"], needle: "#241c08", edge: "rgba(255,200,60,0.3)", accent: [255, 200, 60], mul: "rgba(70,50,15,0.5)", brick: ["#584820", "#f0d080"] },
    { name: "THE FOLD", lore: "You already died on this floor.", weather: "rain", bpm: 116, root: 185.00, sky: ["#0c0c14", "#080810", "#040408"], planet: ["#e0d0ff", "#7060b0", "#181428"], needle: "#141420", edge: "rgba(200,180,255,0.28)", accent: [200, 180, 255], mul: "rgba(40,35,70,0.52)", brick: ["#383850", "#c0b8e0"] },
    { name: "LAST LIGHT", lore: "The void wants a sequel.", weather: "shards", bpm: 148, root: 61.74, sky: ["#06060a", "#040408", "#020204"], planet: ["#ffffff", "#d0d8ff", "#101018"], needle: "#0c0c14", edge: "rgba(255,255,255,0.34)", accent: [255, 255, 255], mul: "rgba(20,20,40,0.55)", brick: ["#303040", "#e8e8f8"] },
  ];

  function roomCount(d) { return 15 + d; }
  function trapCount(d) {
    let n = 10;
    for (let i = 2; i <= d; i++) n += (i % 2 === 0 ? 2 : 3);
    return n;
  }
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function pick(r, arr) { return arr[(r() * arr.length) | 0]; }
  function ir(r, a, b) { return a + ((r() * (b - a + 1)) | 0); }
  function fr(r, a, b) { return a + r() * (b - a); }

  function sneakDelay(d, r, base) {
    return +(base + d * 0.035 + r() * 0.08).toFixed(3);
  }

  function makeMap(kind, r) {
    const rows = [];
    for (let i = 0; i < 8; i++) rows.push(sky());
    if (kind === 0) {
      rows.push(pad("S                             E"));
      rows.push(floor(), floor(), floor());
    } else if (kind === 1) {
      rows.push(pad("S                            E"));
      rows.push(pad("#####  ###    ====    #########"));
      rows.push(pad("#####^^...    ^^^^    #########"));
      rows.push(floor());
    } else if (kind === 2) {
      rows[5] = pad("E");
      rows[6] = pad("####");
      rows.push(pad("S                            F"));
      rows.push(floor(), floor(), floor());
    } else if (kind === 3) {
      rows.push(pad("S                             E"));
      rows.push(pad("####*###*###*###*###*###*#######"));
      rows.push(pad(".....^^^...^^^...^^^...^^^^^^^^^"));
      rows.push(floor());
    } else if (kind === 4) {
      rows[1] = pad("vvvvvvvv");
      rows.push(pad("......................##########"));
      rows.push(pad("S                     #       E"));
      rows.push(pad("##########B############"));
      rows.push(floor());
    } else if (kind === 5) {
      rows.push(pad("S                             E"));
      rows.push(floor());
      rows.push(pad("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^"));
      rows.push(floor());
    } else if (kind === 6) {
      rows[6] = pad(".............C");
      rows[7] = pad("...........C...C");
      rows.push(pad("S                             E"));
      rows.push(pad("########iiiiiiiiiiiiiiiiii######"));
      rows.push(pad("########^^^^^^^^^^^^^^^^^^......"));
      rows.push(floor());
    } else if (kind === 7) {
      rows.push(pad("S         **********          E"));
      rows.push(floor());
      rows.push(pad("##########^^^^^^^^^^############"));
      rows.push(floor());
    } else {
      rows.push(pad("S                          o  E"));
      rows.push(floor(), floor(), floor());
    }
    return rows;
  }

  function buildEvents(d, kind, r, boss) {
    const n = trapCount(d) + (boss ? 4 : 0);
    const sneak = 0.04 + d * 0.03;
    const events = [];
    const jumpY = kind === 4 ? 3 : 5;
    events.push({
      if: { jump: true, xLess: 6 + d * 0.15, air: true }, once: true, delay: sneakDelay(d, r, 0.04),
      do: [["fill", 1, jumpY, 16, 1, "v"], ["shake", 4], ["sfx", "spike"]],
    });
    const used = new Set(["jp"]);
    while (events.length < n) {
      const roll = r();
      const when = +(4.5 + r() * 22).toFixed(2);
      const hx = Math.max(6, Math.min(28, (when + 1 + r() * 3) | 0));
      if (roll < 0.12) {
        events.push({
          if: { x: when }, once: true, quiet: true,
          do: [["dust", hx, 9, 2 + (r() * 3) | 0], ["shake", 4], ["sfx", "crumble"]],
        });
      } else if (roll < 0.22) {
        events.push({
          if: { x: when }, once: true, quiet: true,
          do: [["glow", hx, 5, 5, 0.22 + sneak]],
        });
      } else if (roll < 0.4) {
        events.push({
          if: { x: when }, once: true, delay: sneakDelay(d, r, 0.16 + sneak),
          do: [["hole", hx, 9, 1 + (r() * 3) | 0, 1], ["spikes", hx, 10, 1 + (r() * 3) | 0], ["shake", 6], ["sfx", "crumble"]],
        });
      } else if (roll < 0.52) {
        const dir = r() < 0.5 ? 1 : -1;
        events.push({
          if: { x: when }, once: true, delay: sneakDelay(d, r, 0.35 + sneak),
          do: [["saw", dir > 0 ? -1 : 32, 8, dir * (2.2 + r()), 0]],
        });
      } else if (roll < 0.62) {
        events.push({
          if: { x: when }, once: true, delay: sneakDelay(d, r, 0.1 + sneak),
          do: [["laser", hx, 5, 4 + (r() * 4) | 0, 0.12 + sneak * 0.2], ["sfx", "spike"]],
        });
      } else if (roll < 0.7) {
        events.push({
          if: { jumpAfter: when, air: true }, once: true, delay: sneakDelay(d, r, 0.05),
          do: [["fill", hx, 5, 6 + (r() * 6) | 0, 1, "v"], ["sfx", "spike"]],
        });
      } else if (roll < 0.78) {
        events.push({
          if: { x: when }, once: true, delay: sneakDelay(d, r, 0.18),
          do: [["reverse", true], ["flash", 0.04], ["sfx", "reverse"], ["queue", 0.28 + r() * 0.3, ["reverse", false]]],
        });
      } else if (roll < 0.84) {
        events.push({
          if: { x: when }, once: true, delay: sneakDelay(d, r, 0.12),
          do: [["fill", Math.min(29, hx), 9, 1, 1, "^"], ["sfx", "spike"]],
        });
      } else if (roll < 0.9) {
        events.push({
          if: { time: 8 + r() * 10 }, once: true, delay: 0.3 + sneak,
          do: [["saw", r() < 0.5 ? -1 : 32, 8, r() < 0.5 ? 3 : -3, 0]],
        });
      } else if (roll < 0.95) {
        events.push({
          if: { x: when }, once: true, delay: sneakDelay(d, r, 0.2),
          do: [["push", fr(r, 0.6, 1.6) * (r() < 0.3 ? -1 : 1), r() < 0.2 ? -2 : 0]],
        });
      } else {
        events.push({
          if: { x: when, vxLess: 0.7, ground: true }, once: true, delay: 0.05,
          do: [["hole", hx, 9, 2, 1], ["spikes", hx, 10, 2], ["sfx", "crumble"]],
        });
      }
    }
    if (kind === 2) {
      events[events.length - 1] = {
        if: { door: "fake" }, once: true, delay: 0.15 + sneak,
        do: [["spikes", 14, 9, 3], ["saw", 8, 8, 2.4, 0], ["shake", 10], ["sfx", "spike"]],
      };
    }
    if (kind === 6) {
      events.push({
        if: { jumpAfter: 10, air: true }, once: true, delay: 0.08,
        do: [["fill", 8, 5, 14, 1, "v"], ["sfx", "spike"]],
      });
    }
    while (events.length > n) events.pop();
    while (events.length < n) {
      events.push({
        if: { x: 10 + events.length }, once: true, quiet: true,
        do: [["dust", 12, 9, 3], ["shake", 3]],
      });
    }
    return events.slice(0, n);
  }

  const NAMES = ["TRUST NONE", "STILL LIES", "SOFT TEETH", "FALSE LIGHT", "COLD OPEN", "SECOND FLOOR", "NO RAILING", "AFTERIMAGE", "LOW CEILING", "THE NUDGE", "EMPTY KIND", "SHIFT RIGHT", "BENEATH", "LATE SPIKE", "HUSH", "CROOKED", "UNNAMED", "AGAIN", "WITHOUT", "CORE"];
  const TAUNTS = ["THE FLOOR SAID BYE", "KEEP WALKING", "NOT A HINT", "YOU ASKED", "STILL NO", "LEFT IS WRONG", "JUMP TAX", "THE LIGHT LIED", "PATIENCE DIES", "NICE TRY"];

  function generate(d) {
    const dim = DIMS[d - 1] || DIMS[0];
    const count = roomCount(d);
    if (d === 1 && root.HAND_LEVELS && root.HAND_LEVELS.length) {
      return root.HAND_LEVELS.slice(0, count).map((lvl, i) => Object.assign({}, lvl, {
        dim: 1,
        boss: i === count - 1,
      }));
    }
    const levels = [];
    for (let i = 0; i < count; i++) levels.push(generateOne(d, i, i === count - 1));
    return levels;
  }

  function generateOne(d, i, boss) {
    const r = rng((d * 7919 + i * 104729 + 13) >>> 0);
    const kind = boss ? 2 : ir(r, 0, 8);
    const dim = DIMS[d - 1] || DIMS[0];
    return {
      name: boss ? dim.name + " CORE" : pick(r, NAMES) + (i > 8 ? " " + (i + 1) : ""),
      taunt: pick(r, TAUNTS),
      map: makeMap(kind, r),
      events: buildEvents(d, kind, r, boss),
      explodeCoins: kind === 6,
      crumbleIfStill: kind === 5 ? Math.max(0.18, 0.4 - d * 0.01) : 0,
      dim: d,
      boss: !!boss,
    };
  }

  function theme(d) { return DIMS[Math.max(0, Math.min(DIMS.length - 1, d - 1))]; }

  function chordsFor(rootHz) {
    const r = rootHz;
    return [
      [r, r * 1.18921, r * 1.49831, r * 2],
      [r * 0.79370, r, r * 1.18921, r * 1.58740],
      [r * 1.18921, r * 1.49831, r * 1.78180, r * 2.37841],
      [r * 0.89090, r * 1.12246, r * 1.33484, r * 1.78180],
    ];
  }

  root.SURGE_WORLDS = {
    DIMS, roomCount, trapCount, generate, theme, chordsFor, count: 20,
  };
  root.LEVELS = generate(1);
})(typeof window !== "undefined" ? window : globalThis);
