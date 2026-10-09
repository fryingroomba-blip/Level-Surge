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

  // Two signature trap types per dimension. Families reuse placement rules;
  // build() owns the unique answer each world brings.
  const DIM_SIG = [
    [ // 1 NULLSCAPE
      { id: "voidPull", family: "wind", label: "VOID PULL" },
      { id: "nullGate", family: "gate", label: "NULL GATE" },
    ],
    [ // 2 ASHWELL
      { id: "emberDrop", family: "drop", label: "EMBER DROP" },
      { id: "cinderTeeth", family: "gate", label: "CINDER TEETH" },
    ],
    [ // 3 FROSTBITE
      { id: "iceLock", family: "lock", label: "ICE LOCK" },
      { id: "frostBite", family: "side", label: "FROST BITE" },
    ],
    [ // 4 BLOOMVOID
      { id: "sporeGust", family: "push", label: "SPORE GUST" },
      { id: "petalSaw", family: "saw", label: "PETAL SAW" },
    ],
    [ // 5 IRON CLOCK
      { id: "tickGate", family: "gate", label: "TICK GATE" },
      { id: "rewind", family: "reverse", label: "REWIND" },
    ],
    [ // 6 TOXIC GUT
      { id: "acidSink", family: "hole", label: "ACID SINK" },
      { id: "gutWind", family: "wind", label: "GUT WIND" },
    ],
    [ // 7 MIRROR SEA
      { id: "hardFlip", family: "reverse", label: "HARD FLIP" },
      { id: "mirageBeam", family: "laser", label: "MIRAGE BEAM" },
    ],
    [ // 8 CINDER RAIL
      { id: "railSaw", family: "saw", label: "RAIL SAW" },
      { id: "sparkZap", family: "laser", label: "SPARK ZAP" },
    ],
    [ // 9 STATIC GOD
      { id: "staticLock", family: "lock", label: "STATIC LOCK" },
      { id: "signalBeam", family: "laser", label: "SIGNAL BEAM" },
    ],
    [ // 10 BONE ORBIT
      { id: "orbitKick", family: "gravity", label: "ORBIT KICK" },
      { id: "boneSaw", family: "saw", label: "BONE SAW" },
    ],
    [ // 11 DEEP GLASS
      { id: "glassCrack", family: "hole", label: "GLASS CRACK" },
      { id: "clearBeam", family: "laser", label: "CLEAR BEAM" },
    ],
    [ // 12 HUNGER MOON
      { id: "biteGate", family: "gate", label: "BITE GATE" },
      { id: "lureSaw", family: "saw", label: "LURE SAW" },
    ],
    [ // 13 VIOLET WIRE
      { id: "wireZap", family: "laser", label: "WIRE ZAP" },
      { id: "circuitPull", family: "push", label: "CIRCUIT PULL" },
    ],
    [ // 14 SALT CATHEDRAL
      { id: "pillarDrop", family: "drop", label: "PILLAR DROP" },
      { id: "worshipGap", family: "hole", label: "WORSHIP GAP" },
    ],
    [ // 15 REDSHIFT
      { id: "stretchBeam", family: "laser", label: "STRETCH BEAM" },
      { id: "recoil", family: "push", label: "RECOIL" },
    ],
    [ // 16 GHOSTGRID
      { id: "phantomFloor", family: "gate", label: "PHANTOM FLOOR" },
      { id: "phaseLock", family: "lock", label: "PHASE LOCK" },
    ],
    [ // 17 NIGHT NEEDLE
      { id: "needleRain", family: "ceiling", label: "NEEDLE RAIN" },
      { id: "pinGate", family: "gate", label: "PIN GATE" },
    ],
    [ // 18 SOLAR GRAVE
      { id: "sunBurst", family: "laser", label: "SUN BURST" },
      { id: "burnFloor", family: "gate", label: "BURN FLOOR" },
    ],
    [ // 19 THE FOLD
      { id: "foldNudge", family: "teleport", label: "FOLD NUDGE" },
      { id: "echoSaw", family: "saw", label: "ECHO SAW" },
    ],
    [ // 20 LAST LIGHT
      { id: "lastGate", family: "gate", label: "LAST GATE" },
      { id: "voidChase", family: "saw", label: "VOID CHASE" },
    ],
  ];

  function signatureTraps(d) {
    return (DIM_SIG[Math.max(0, Math.min(DIM_SIG.length - 1, d - 1))] || []).map((t) => ({
      id: t.id, label: t.label, family: t.family,
    }));
  }

  function buildSig(id, x, y, late) {
    const lead = late ? 1.55 : 1.85;
    const up = late ? 0.72 : 0.85;
    if (id === "voidPull") {
      return {
        if: { x: +(x - 0.4).toFixed(2) }, once: true,
        do: [["wind", -0.55], ["shake", 3], ["sfx", "reverse"], ["queue", late ? 0.55 : 0.7, ["wind", 0]]],
      };
    }
    if (id === "nullGate") {
      return {
        if: { x: +(x - lead).toFixed(2) }, once: true,
        do: [
          ["fill", x, y, 1, 1, "^"], ["fill", x, Math.max(2, y - 3), 1, 1, "v"],
          ["sfx", "spike"], ["shake", 4],
          ["queue", up, ["fill", x, y, 1, 1, "#"], ["fill", x, Math.max(2, y - 3), 1, 1, "."]],
        ],
      };
    }
    if (id === "emberDrop") {
      return {
        if: { x: +(x - 1.6).toFixed(2) }, once: true,
        do: [["drop", x, Math.max(1, y - 5)], ["sfx", "crumble"], ["shake", 5]],
      };
    }
    if (id === "cinderTeeth") {
      return {
        if: { x: +(x - lead).toFixed(2) }, once: true,
        do: [
          ["fill", x, y, 2, 1, "^"], ["sfx", "spike"], ["shake", 4],
          ["queue", late ? 0.42 : 0.52, ["fill", x, y, 2, 1, "#"]],
        ],
      };
    }
    if (id === "iceLock") {
      return {
        if: { x: +x.toFixed(2) }, once: true,
        do: [["lock", late ? 0.38 : 0.48], ["flash", 0.05], ["sfx", "land"], ["shake", 3]],
      };
    }
    if (id === "frostBite") {
      return {
        if: { x: +(x - 1.4).toFixed(2) }, once: true,
        do: [
          ["fill", x, y - 1, 1, 1, ">"], ["fill", x + 1, y - 1, 1, 1, "<"],
          ["sfx", "spike"], ["shake", 4],
          ["queue", late ? 0.55 : 0.7, ["fill", x, y - 1, 1, 1, "."], ["fill", x + 1, y - 1, 1, 1, "."]],
        ],
      };
    }
    if (id === "sporeGust") {
      return {
        if: { x: +x.toFixed(2) }, once: true,
        do: [["push", late ? -0.95 : -0.75, -1.1], ["glow", x - 1, y - 2, 3, 0.2], ["sfx", "jump"], ["shake", 3]],
      };
    }
    if (id === "petalSaw") {
      return {
        if: { x: +(x - 2.0).toFixed(2) }, once: true,
        do: [["saw", Math.min(30, x + 4), y - 1, late ? -2.4 : -2.1, 0], ["sfx", "saw"]],
      };
    }
    if (id === "tickGate") {
      return {
        if: { x: +(x - lead - 0.35).toFixed(2) }, once: true, delay: late ? 0.28 : 0.36,
        do: [
          ["fill", x, y, 1, 1, "^"], ["sfx", "spike"], ["shake", 3],
          ["queue", up, ["fill", x, y, 1, 1, "#"]],
        ],
      };
    }
    if (id === "rewind") {
      return {
        if: { x: +(x - 0.15).toFixed(2) }, once: true,
        do: [
          ["reverse", true], ["flash", 0.04], ["sfx", "reverse"],
          ["queue", late ? 0.32 : 0.26, ["reverse", false]],
        ],
      };
    }
    if (id === "acidSink") {
      return {
        if: { x: +(x - lead).toFixed(2) }, once: true,
        do: [
          ["hole", x, y, 1, 1], ["spikes", x, Math.min(11, y + 1), 1],
          ["shake", 6], ["sfx", "crumble"],
          ["queue", late ? 0.85 : 1.05, ["fill", x, y, 1, 1, "#"], ["fill", x, Math.min(11, y + 1), 1, 1, "#"]],
        ],
      };
    }
    if (id === "gutWind") {
      return {
        if: { x: +(x - 0.3).toFixed(2) }, once: true,
        do: [["wind", 0.7], ["shake", 3], ["sfx", "reverse"], ["queue", late ? 0.5 : 0.65, ["wind", 0]]],
      };
    }
    if (id === "hardFlip") {
      return {
        if: { x: +(x - 0.2).toFixed(2) }, once: true,
        do: [
          ["reverse", true], ["flash", 0.06], ["sfx", "reverse"], ["lie", "LEFT?"],
          ["queue", late ? 0.4 : 0.34, ["reverse", false], ["lie", ""]],
        ],
      };
    }
    if (id === "mirageBeam") {
      return {
        if: { x: +(x - 2.8).toFixed(2) }, once: true,
        do: [
          ["glow", x - 1, y - 1, 3, 0.28], ["sfx", "near"],
          ["queue", 0.22, ["laser", x - 1, y - 1, 3, late ? 0.34 : 0.28], ["sfx", "spike"]],
        ],
      };
    }
    if (id === "railSaw") {
      return {
        if: { x: +(x - 2.2).toFixed(2) }, once: true,
        do: [["saw", Math.max(0, x - 5), y - 1, late ? 2.9 : 2.55, 0], ["sfx", "saw"]],
      };
    }
    if (id === "sparkZap") {
      return {
        if: { x: +(x - 2.6).toFixed(2) }, once: true,
        do: [["laser", x - 1, y - 1, 2, late ? 0.28 : 0.22], ["flash", 0.05], ["sfx", "spike"]],
      };
    }
    if (id === "staticLock") {
      return {
        if: { x: +x.toFixed(2) }, once: true,
        do: [["lock", late ? 0.42 : 0.52], ["flash", 0.08], ["sfx", "glitch"], ["shake", 5], ["lie", "NO"]],
      };
    }
    if (id === "signalBeam") {
      return {
        if: { x: +(x - 3.0).toFixed(2) }, once: true,
        do: [
          ["laser", x - 2, y - 1, 4, late ? 0.3 : 0.24], ["sfx", "spike"],
          ["queue", 0.18, ["laser", x - 1, y - 2, 3, 0.16]],
        ],
      };
    }
    if (id === "orbitKick") {
      return {
        if: { x: +(x - 0.2).toFixed(2) }, once: true,
        do: [
          ["gravity", -0.55], ["flash", 0.06], ["sfx", "reverse"],
          ["queue", late ? 0.45 : 0.55, ["gravity", 0.55]],
        ],
      };
    }
    if (id === "boneSaw") {
      return {
        if: { x: +(x - 1.8).toFixed(2) }, once: true,
        do: [["saw", Math.min(30, x + 3), Math.max(2, y - 3), late ? -2.1 : -1.85, 0.35], ["sfx", "saw"]],
      };
    }
    if (id === "glassCrack") {
      return {
        if: { x: +(x - 1.5).toFixed(2) }, once: true,
        do: [
          ["dust", x, y, 2], ["shake", 4], ["sfx", "crumble"],
          ["queue", 0.2, ["hole", x, y, 1, 1], ["spikes", x, Math.min(11, y + 1), 1]],
        ],
      };
    }
    if (id === "clearBeam") {
      return {
        if: { x: +(x - 3.0).toFixed(2) }, once: true,
        do: [["laser", x - 1, y - 1, 3, late ? 0.4 : 0.34], ["sfx", "spike"]],
      };
    }
    if (id === "biteGate") {
      return {
        if: { x: +(x - lead).toFixed(2) }, once: true,
        do: [
          ["fill", x, y, 2, 1, "^"], ["sfx", "spike"], ["shake", 5],
          ["queue", late ? 0.4 : 0.48, ["fill", x, y, 2, 1, "#"]],
        ],
      };
    }
    if (id === "lureSaw") {
      return {
        if: { x: +(x - 2.0).toFixed(2) }, once: true,
        do: [
          ["saw", Math.min(29, x + 6), y - 1, late ? -2.9 : -2.55, 0], ["sfx", "saw"],
          ["queue", 0.35, ["chase", 0]],
        ],
      };
    }
    if (id === "wireZap") {
      return {
        if: { x: +(x - 2.4).toFixed(2) }, once: true,
        do: [
          ["laser", x, y - 1, 1, late ? 0.36 : 0.3], ["sfx", "spike"],
          ["queue", 0.14, ["laser", x + 1, y - 1, 1, 0.22]],
        ],
      };
    }
    if (id === "circuitPull") {
      return {
        if: { x: +x.toFixed(2) }, once: true,
        do: [["push", late ? 1.15 : 0.95, 0], ["flash", 0.04], ["sfx", "dash"], ["shake", 3]],
      };
    }
    if (id === "pillarDrop") {
      return {
        if: { x: +(x - 1.4).toFixed(2) }, once: true,
        do: [["drop", x, Math.max(0, y - 6)], ["sfx", "crumble"], ["shake", 6]],
      };
    }
    if (id === "worshipGap") {
      return {
        if: { x: +(x - lead).toFixed(2) }, once: true,
        do: [["hole", x, y, 1, 1], ["spikes", x, Math.min(11, y + 1), 1], ["shake", 5], ["sfx", "crumble"]],
      };
    }
    if (id === "stretchBeam") {
      return {
        if: { x: +(x - 3.4).toFixed(2) }, once: true,
        do: [["laser", x - 2, y - 1, 5, late ? 0.32 : 0.26], ["sfx", "spike"]],
      };
    }
    if (id === "recoil") {
      return {
        if: { x: +x.toFixed(2) }, once: true,
        do: [["push", late ? -1.25 : -1.05, 0], ["shake", 4], ["sfx", "land"]],
      };
    }
    if (id === "phantomFloor") {
      return {
        if: { x: +(x - lead).toFixed(2) }, once: true,
        do: [
          ["fill", x, y, 1, 1, "."], ["shake", 3], ["sfx", "crumble"],
          ["queue", late ? 0.55 : 0.7, ["fill", x, y, 1, 1, "#"]],
        ],
      };
    }
    if (id === "phaseLock") {
      return {
        if: { x: +x.toFixed(2) }, once: true,
        do: [["lock", late ? 0.35 : 0.45], ["glow", x - 1, y - 2, 3, 0.18], ["sfx", "glitch"]],
      };
    }
    if (id === "needleRain") {
      return {
        if: { x: +(x - 1.2).toFixed(2) }, once: true,
        do: [
          ["fill", x - 1, Math.max(2, y - 4), 3, 1, "v"], ["sfx", "spike"], ["shake", 5],
          ["queue", late ? 0.55 : 0.7, ["fill", x - 1, Math.max(2, y - 4), 3, 1, "."]],
        ],
      };
    }
    if (id === "pinGate") {
      return {
        if: { x: +(x - lead).toFixed(2) }, once: true,
        do: [
          ["fill", x, y, 1, 1, "^"], ["sfx", "spike"], ["shake", 3],
          ["queue", up * 0.85, ["fill", x, y, 1, 1, "#"]],
        ],
      };
    }
    if (id === "sunBurst") {
      return {
        if: { x: +(x - 2.5).toFixed(2) }, once: true,
        do: [["flash", 0.1], ["laser", x - 1, y - 1, 3, late ? 0.28 : 0.22], ["sfx", "spike"], ["shake", 4]],
      };
    }
    if (id === "burnFloor") {
      return {
        if: { x: +(x - lead).toFixed(2) }, once: true,
        do: [
          ["fill", x, y, 2, 1, "^"], ["sfx", "spike"], ["shake", 4],
          ["queue", late ? 0.45 : 0.55, ["fill", x, y, 2, 1, "#"]],
        ],
      };
    }
    if (id === "foldNudge") {
      return {
        if: { x: +(x - 0.1).toFixed(2) }, once: true,
        do: [
          ["teleport", Math.max(8, x - 2), y - 1], ["flash", 0.06], ["sfx", "dash"], ["shake", 4],
        ],
      };
    }
    if (id === "echoSaw") {
      return {
        if: { x: +(x - 2.1).toFixed(2) }, once: true,
        do: [
          ["saw", Math.min(30, x + 5), y - 1, late ? -2.2 : -1.9, 0], ["sfx", "saw"],
          ["queue", 0.35, ["saw", Math.max(0, x - 4), y - 1, late ? 2.0 : 1.75, 0]],
        ],
      };
    }
    if (id === "lastGate") {
      return {
        if: { x: +(x - lead).toFixed(2) }, once: true,
        do: [
          ["fill", x, y, 1, 1, "^"], ["fill", x + 1, y, 1, 1, "^"],
          ["sfx", "spike"], ["shake", 5],
          ["queue", late ? 0.38 : 0.46, ["fill", x, y, 2, 1, "#"]],
        ],
      };
    }
    if (id === "voidChase") {
      return {
        if: { x: +(x - 2.3).toFixed(2) }, once: true,
        do: [
          ["saw", Math.min(30, x + 6), y - 1, late ? -3.0 : -2.7, 0], ["sfx", "saw"],
          ["queue", 0.28, ["chase", 0]],
        ],
      };
    }
    return null;
  }
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function pick(r, arr) { return arr[(r() * arr.length) | 0]; }

  const LAYOUTS = ["RIDGE", "GAPS", "CLIMB", "TRENCH", "SHELF", "STEPS", "POCKETS", "BRIDGE"];

  function canStep(surface, from, to) {
    if (surface[from] < 0 || surface[to] < 0) return false;
    const dist = Math.abs(to - from);
    if (dist < 1 || dist > 4) return false;
    const dy = surface[from] - surface[to];
    return dy <= 3 && dy >= -6;
  }

  function reachable(surface, spawnX, doorX) {
    const W = surface.length;
    const seen = new Set([spawnX]);
    const q = [spawnX];
    while (q.length) {
      const x = q.pop();
      if (x === doorX) return true;
      for (let nx = 0; nx < W; nx++) {
        if (seen.has(nx) || !canStep(surface, x, nx)) continue;
        seen.add(nx);
        q.push(nx);
      }
    }
    return false;
  }

  // Rank tiles by how hard they are to avoid on a spawn→door clear.
  // Near-pit tiles score low on purpose: buildEvents refuses them so jumps stay clearable.
  function pathHeat(surface, spawnX, doorX) {
    const W = surface.length;
    const heat = new Array(W).fill(0);
    const parent = new Array(W).fill(-1);
    const dist = new Array(W).fill(Infinity);
    dist[spawnX] = 0;
    const q = [spawnX];
    for (let qi = 0; qi < q.length; qi++) {
      const x = q[qi];
      for (let nx = 0; nx < W; nx++) {
        if (!canStep(surface, x, nx)) continue;
        const nd = dist[x] + 1;
        if (nd < dist[nx]) {
          dist[nx] = nd;
          parent[nx] = x;
          q.push(nx);
        }
      }
    }
    if (!Number.isFinite(dist[doorX])) {
      for (let x = 0; x < W; x++) if (surface[x] >= 0) heat[x] = 1;
      return heat;
    }

    // Backward reachability from the door through the jump graph.
    const toDoor = new Array(W).fill(false);
    const bq = [doorX];
    toDoor[doorX] = true;
    for (let bi = 0; bi < bq.length; bi++) {
      const x = bq[bi];
      for (let nx = 0; nx < W; nx++) {
        if (toDoor[nx] || !canStep(surface, nx, x)) continue;
        toDoor[nx] = true;
        bq.push(nx);
      }
    }

    // Primary shortest path (player's default rightward line).
    const onShort = new Array(W).fill(false);
    for (let cur = doorX; cur >= 0; cur = parent[cur]) {
      onShort[cur] = true;
      if (cur === spawnX) break;
    }

    function distToPit(x) {
      let best = 99;
      for (let i = 0; i < W; i++) {
        if (surface[i] < 0) best = Math.min(best, Math.abs(i - x));
      }
      return best;
    }

    for (let x = 0; x < W; x++) {
      if (surface[x] < 0 || !toDoor[x] || !Number.isFinite(dist[x])) continue;
      heat[x] += 3;
      if (onShort[x]) heat[x] += 6;
      // Mid-run corridor (neither spawn scramble nor door hush)
      const t = dist[x] / Math.max(1, dist[doorX]);
      if (t > 0.2 && t < 0.85) heat[x] += 3;

      const dPit = distToPit(x);
      // Approach runway just outside the trap exclusion ring — player commits here.
      if (dPit >= 5 && dPit <= 7) heat[x] += 5;
      else if (dPit < 5) heat[x] -= 4;

      let runL = 0, runR = 0;
      for (let i = x - 1; i >= 0 && surface[i] >= 0; i--) runL += 1;
      for (let i = x + 1; i < W && surface[i] >= 0; i++) runR += 1;
      if (runL + runR <= 5) heat[x] += 2;
      if (x > 0 && x < W - 1 && surface[x - 1] === surface[x] && surface[x + 1] === surface[x]) {
        heat[x] += 2;
      }
    }

    heat[spawnX] = 0;
    heat[doorX] = 0;
    if (spawnX + 1 < W) heat[spawnX + 1] = Math.min(heat[spawnX + 1], 0);
    if (spawnX + 2 < W) heat[spawnX + 2] = Math.min(heat[spawnX + 2], 1);
    if (doorX - 1 >= 0) heat[doorX - 1] = Math.min(heat[doorX - 1], 1);
    return heat;
  }

  function terrain(d, room, r) {
    const W = 32;
    const surface = new Array(W);
    let y = 7 + (room % 3);
    const pitChance = 0.06 + (room % 5) * 0.012 + (d >= 14 ? 0.04 : d >= 7 ? 0.02 : 0);
    for (let x = 0; x < W; x++) {
      if (x > 4 && x < 27 && r() < pitChance) {
        surface[x] = -1;
        if (r() < 0.55 && x + 1 < 27) {
          x += 1;
          surface[x] = -1;
        }
        continue;
      }
      const roll = r();
      const climb = room % 2 === 0 ? 0.22 : 0.14;
      if (x > 0 && surface[x - 1] !== -1) {
        if (roll < climb && y > 5) y -= 1;
        else if (roll > 0.82 && y < 9) y += 1;
      }
      if ((d + room) % 6 === 2 && x > 18) y = Math.max(5, y - (x % 7 === 0 ? 1 : 0));
      if ((d + room) % 6 === 4 && x > 8 && x < 16) y = Math.min(9, y + (x % 5 === 0 ? 1 : 0));
      surface[x] = Math.max(5, Math.min(9, y));
    }
    for (let x = 0; x < W; x++) {
      if (x < 3 || x > 28) surface[x] = surface[x] < 0 ? 9 : surface[x];
    }
    let run = 0;
    for (let x = 0; x < W; x++) {
      if (surface[x] < 0) {
        run += 1;
        if (run > 2) surface[x] = 9;
      } else run = 0;
    }
    for (let x = 1; x < W - 1; x++) {
      if (surface[x] < 0 || surface[x - 1] >= 0) continue;
      let end = x;
      while (end < W && surface[end] >= 0) end += 1;
      if (end - x >= 2 || end >= W || surface[end] >= 0) continue;
      surface[end] = surface[x];
    }
    for (let x = 1; x < W; x++) {
      if (surface[x] < 0 || surface[x - 1] < 0) continue;
      const dy = surface[x] - surface[x - 1];
      if (dy > 1) surface[x] = surface[x - 1] + 1;
      if (dy < -1) surface[x] = surface[x - 1] - 1;
    }
    surface[1] = surface[1] < 0 ? 9 : surface[1];
    surface[30] = surface[30] < 0 ? surface[29] < 0 ? 9 : surface[29] : surface[30];
    if (!reachable(surface, 1, 30)) {
      for (let x = 0; x < W; x++) if (surface[x] < 0) surface[x] = 9;
      for (let x = 1; x < W; x++) {
        const dy = surface[x] - surface[x - 1];
        if (dy > 1) surface[x] = surface[x - 1] + 1;
        if (dy < -1) surface[x] = surface[x - 1] - 1;
      }
    }
    let runway = 8;
    for (let x = 7; x < 14; x++) if (surface[x] >= 0) { runway = surface[x]; break; }
    for (let x = 0; x <= 6; x++) surface[x] = runway;
    for (let x = 1; x < W - 1; x++) {
      if (surface[x] >= 0 || surface[x - 1] < 0) continue;
      let end = x;
      while (end < W && surface[end] < 0) end += 1;
      const before = surface[x - 1];
      const before2 = surface[x - 2];
      const after = end < W ? surface[end] : -1;
      const after2 = end + 1 < W ? surface[end + 1] : after;
      const approach = before >= 0 && before2 === before;
      const landing = after >= 0 && after2 === after && Math.abs(after - before) <= 1;
      if (!approach || !landing) {
        for (let i = x; i < end; i++) surface[i] = before;
      }
    }
    return surface;
  }

  function paintRoom(surface, d, room, r, boss) {
    const H = 12;
    const W = surface.length;
    const g = Array.from({ length: H }, () => Array(W).fill("."));
    for (let x = 0; x < W; x++) {
      if (surface[x] < 0) {
        g[10][x] = "^";
        g[11][x] = "#";
        continue;
      }
      for (let y = surface[x]; y < H; y++) g[y][x] = "#";
    }
    g[surface[1] - 1][1] = "S";
    g[surface[30] - 1][30] = "E";
    const lip = 2 + ((d + room) % 3);
    for (let x = 0; x < W; x++) {
      const nearGap = (x > 0 && surface[x - 1] < 0) || (x + 1 < W && surface[x + 1] < 0)
        || (x > 1 && surface[x - 2] < 0) || (x + 2 < W && surface[x + 2] < 0);
      const headroom = surface[x] - lip;
      if (!nearGap && surface[x] >= 8 && headroom >= 6 && r() < 0.16 && x % (3 + (room % 3)) === 0) {
        g[lip][x] = "v";
      }
    }
    if ((room + d) % 4 === 1) {
      const bx = 8 + ((room * 3 + d) % 14);
      if (surface[bx] >= 0 && g[surface[bx] - 1][bx] === ".") g[surface[bx]][bx] = "B";
    }
    if ((room + d) % 5 === 2) {
      const cx = 6 + ((room * 2) % 12);
      if (surface[cx] === 9) g[9][cx] = "=";
    }
    if (boss) {
      const fy = surface[13] >= 0 ? surface[13] : 8;
      const py = Math.max(2, fy - 3);
      g[py][12] = "#";
      g[py][13] = "#";
      g[py][14] = "#";
      if (py > 0) g[py - 1][13] = "F";
    }
    g[surface[1] - 1][1] = "S";
    g[surface[30] - 1][30] = "E";
    return g.map((row) => row.join(""));
  }

  function buildEvents(d, surface, boss, room) {
    const n = trapCount(d) + (boss ? 4 : 0);
    const events = [];
    const realAt = [];
    const late = d >= 12;
    const mid = d >= 6;
    // Tight packing: short threats can sit nearly adjacent; long ones keep a small buffer.
    const gapLong = late ? 2 : 3;
    const gapShort = late ? 1 : 2;
    // Spend most of the trap budget on real hits, not quiet dust/glow.
    const budget = Math.min(n - 1, (late ? 14 : mid ? 12 : 9) + Math.floor(d / 2));
    const sigs = DIM_SIG[Math.max(0, Math.min(DIM_SIG.length - 1, d - 1))] || [];
    const caps = {
      gate: late ? 6 : mid ? 5 : 4,
      hole: late ? 5 : mid ? 4 : 3,
      laser: late ? 4 : mid ? 3 : 2,
      saw: late ? 5 : mid ? 4 : 3,
      reverse: d >= 6 ? 2 : 0,
      push: mid ? 3 : 2,
      drop: late ? 3 : 2,
      lock: late ? 3 : 2,
      wind: late ? 3 : 2,
      side: late ? 3 : 2,
      ceiling: late ? 3 : 2,
      gravity: d >= 5 ? 2 : 0,
      teleport: d >= 10 ? 2 : 0,
      sig: 2,
    };
    const used = {
      gate: 0, hole: 0, laser: 0, saw: 0, reverse: 0, push: 0,
      drop: 0, lock: 0, wind: 0, side: 0, ceiling: 0, gravity: 0, teleport: 0, sig: 0,
    };
    const roster = [
      ["gate", "hole", "saw", "gate", "hole", "reverse", "push"],
      ["hole", "gate", "saw", "hole", "gate", "laser", "push"],
      ["saw", "gate", "hole", "saw", "gate", "reverse", "laser"],
      ["gate", "saw", "hole", "push", "gate", "hole", "reverse"],
      ["hole", "saw", "gate", "hole", "saw", "gate", "laser"],
      ["gate", "hole", "push", "gate", "saw", "hole", "reverse"],
    ];
    const order = roster[(room + d) % roster.length];
    const bounceX = (room + d) % 4 === 1 ? 8 + ((room * 3 + d) % 14) : -1;
    const crumbleX = (room + d) % 5 === 2 ? 6 + ((room * 2) % 12) : -1;
    const LONG = { hole: 1, laser: 1, saw: 1, drop: 1, ceiling: 1, side: 1, teleport: 1 };

    function span(x, dir) {
      let count = 0;
      for (let i = x + dir; i >= 0 && i < surface.length; i += dir) {
        if (surface[i] < 0) break;
        count += 1;
      }
      return count;
    }

    function gapWidth(x) {
      let L = x;
      let R = x;
      while (L > 0 && (L === x || surface[L] < 0)) L -= 1;
      while (R < surface.length - 1 && (R === x || surface[R] < 0)) R += 1;
      const start = surface[L] >= 0 && L !== x ? L + 1 : L;
      const end = surface[R] >= 0 && R !== x ? R - 1 : R;
      return end - start + 1;
    }

    function nearPit(x, dist) {
      for (let i = -dist; i <= dist; i++) {
        const k = x + i;
        if (k >= 0 && k < surface.length && surface[k] < 0) return true;
      }
      return false;
    }

    function busy(x, type) {
      const long = !!LONG[type];
      for (let i = 0; i < realAt.length; i++) {
        const prev = realAt[i];
        const prevLong = !!LONG[prev.t];
        // Only long↔long threats need the bigger gap. Everything else packs tight.
        const need = long && prevLong ? gapLong : gapShort;
        if (Math.abs(prev.x - x) < need) return true;
      }
      return false;
    }

    function flat(x) {
      return surface[x - 1] === surface[x] && surface[x + 1] === surface[x];
    }

    function allowsFamily(x, family, forSig) {
      if (x < 8 || x > 25 || surface[x] < 0) return false;
      if (busy(x, family)) return false;
      if (nearPit(x, LONG[family] ? 2 : 1)) return false;
      // Signature traps always get at least one slot of their family.
      const max = forSig ? Math.max(1, caps[family] || 0) : (caps[family] || 0);
      if (used[family] >= max) return false;
      const L = span(x, -1);
      const R = span(x, 1);
      const y = surface[x];
      const nearFlat = Math.abs((surface[x - 1] ?? y) - y) <= 1 && Math.abs((surface[x + 1] ?? y) - y) <= 1;
      if (family === "gate") return L >= 1 && R >= 1 && nearFlat;
      if (family === "hole") return gapWidth(x) <= 4 && L >= 1 && R >= 1;
      if (family === "laser") return L >= 1 && R >= 1 && nearFlat;
      if (family === "saw") return y >= 3 && L + R >= 2;
      if (family === "reverse") return L >= 2 && R >= 2;
      if (family === "push") return Math.max(L, R) >= 1;
      if (family === "drop") return y >= 4 && L >= 1 && R >= 1;
      if (family === "lock") return L >= 1 && R >= 1;
      if (family === "wind") return L + R >= 3;
      if (family === "side") return x <= 24 && surface[x + 1] >= 0 && L >= 1 && R >= 1;
      if (family === "ceiling") return y >= 4 && L >= 1 && R >= 1;
      if (family === "gravity") return L >= 2 && R >= 2;
      if (family === "teleport") return L >= 1 && R >= 1 && x >= 10;
      return false;
    }

    function allows(x, type) {
      return allowsFamily(x, type, false);
    }

    function commit(x, type) {
      if (events.length >= n || !allows(x, type)) return false;
      const y = surface[x];
      if (type === "gate") {
        const wide = mid && x < 24 && surface[x + 1] === y && span(x, 1) >= 4;
        const w = wide ? 2 : 1;
        const lead = late ? 1.35 : 1.65;
        const up = wide ? (late ? 0.58 : 0.7) : (late ? 0.52 : 0.65);
        events.push({
          if: { x: +(x - lead).toFixed(2) }, once: true,
          do: [
            ["fill", x, y, w, 1, "^"], ["sfx", "spike"], ["shake", 4],
            ["queue", up, ["fill", x, y, w, 1, "#"]],
          ],
        });
      } else if (type === "hole") {
        events.push({
          if: { x: +(x - (late ? 1.35 : 1.65)).toFixed(2) }, once: true,
          do: [["hole", x, y, 1, 1], ["spikes", x, Math.min(11, y + 1), 1], ["shake", 6], ["sfx", "crumble"]],
        });
      } else if (type === "laser") {
        events.push({
          if: { x: +(x - 2.1).toFixed(2) }, once: true,
          do: [["laser", x - 1, y - 1, 3, late ? 0.62 : 0.52], ["sfx", "spike"]],
        });
      } else if (type === "saw") {
        events.push({
          if: { x: +(x - 1.45).toFixed(2) }, once: true,
          do: [["saw", Math.min(29, x + 5), y - 1, late ? -3.1 : -2.7, 0], ["sfx", "saw"]],
        });
      } else if (type === "reverse") {
        events.push({
          if: { x: +(x - 0.15).toFixed(2) }, once: true,
          do: [
            ["reverse", true], ["flash", 0.05], ["sfx", "reverse"],
            ["queue", late ? 0.42 : 0.32, ["reverse", false]],
          ],
        });
      } else if (type === "push") {
        const dir = span(x, 1) >= span(x, -1) ? 1 : -1;
        events.push({
          if: { x: +x.toFixed(2) }, once: true,
          do: [["push", +(1.05 * dir).toFixed(2), 0], ["shake", 3]],
        });
      } else if (type === "drop") {
        events.push({
          if: { x: +(x - 1.4).toFixed(2) }, once: true,
          do: [["drop", x, Math.max(1, y - 5)], ["sfx", "crumble"], ["shake", 5]],
        });
      } else if (type === "lock") {
        events.push({
          if: { x: +x.toFixed(2) }, once: true,
          do: [["lock", late ? 0.42 : 0.52], ["flash", 0.05], ["sfx", "land"], ["shake", 3]],
        });
      } else if (type === "wind") {
        const dir = x > 16 ? -1 : 1;
        events.push({
          if: { x: +(x - 0.3).toFixed(2) }, once: true,
          do: [["wind", +(0.75 * dir).toFixed(2)], ["shake", 3], ["sfx", "reverse"],
            ["queue", late ? 0.5 : 0.65, ["wind", 0]]],
        });
      } else if (type === "side") {
        events.push({
          if: { x: +(x - 1.3).toFixed(2) }, once: true,
          do: [
            ["fill", x, y - 1, 1, 1, ">"], ["fill", Math.min(30, x + 1), y - 1, 1, 1, "<"],
            ["sfx", "spike"], ["shake", 4],
            ["queue", late ? 0.5 : 0.65,
              ["fill", x, y - 1, 1, 1, "."], ["fill", Math.min(30, x + 1), y - 1, 1, 1, "."]],
          ],
        });
      } else if (type === "ceiling") {
        events.push({
          if: { x: +(x - 1.2).toFixed(2) }, once: true,
          do: [
            ["fill", x, Math.max(2, y - 3), 2, 1, "v"], ["sfx", "spike"], ["shake", 4],
            ["queue", late ? 0.55 : 0.7, ["fill", x, Math.max(2, y - 3), 2, 1, "."]],
          ],
        });
      } else if (type === "gravity") {
        events.push({
          if: { x: +(x - 0.2).toFixed(2) }, once: true,
          do: [
            ["gravity", -0.55], ["flash", 0.05], ["sfx", "reverse"],
            ["queue", late ? 0.45 : 0.55, ["gravity", 0.55]],
          ],
        });
      } else if (type === "teleport") {
        events.push({
          if: { x: +(x - 0.5).toFixed(2) }, once: true,
          do: [["teleport", Math.max(8, x - 3), y - 1], ["flash", 0.06], ["sfx", "dash"], ["shake", 4]],
        });
      } else return false;
      realAt.push({ x, t: type });
      used[type] += 1;
      return true;
    }

    function commitSig(x, sig) {
      if (events.length >= n || used.sig >= caps.sig) return false;
      if (!allowsFamily(x, sig.family, true)) return false;
      const y = surface[x];
      const ev = buildSig(sig.id, x, y, late);
      if (!ev) return false;
      events.push(ev);
      realAt.push({ x, t: sig.family, id: sig.id });
      used[sig.family] += 1;
      used.sig += 1;
      return true;
    }

    const head = surface[1] >= 0 ? surface[1] : 8;
    events.push({
      if: { jump: true, xLess: 4.2, air: true }, once: true, delay: 0.05,
      do: [["fill", 2, Math.max(2, head - 3), 4, 1, "v"], ["shake", 4], ["sfx", "spike"]],
    });

    const heat = pathHeat(surface, 1, 30);
    const hot = [];
    for (let c = 8; c <= 25; c++) {
      if (surface[c] < 0 || heat[c] <= 0) continue;
      hot.push(c);
    }
    hot.sort((a, b) => heat[b] - heat[a] || a - b);

    // Place this world's two signature traps first so they actually show up.
    for (let si = 0; si < sigs.length && used.sig < 2 && events.length < n; si++) {
      const sig = sigs[(si + room) % sigs.length];
      let placed = false;
      for (let hi = 0; hi < hot.length; hi++) {
        if (commitSig(hot[hi], sig)) { placed = true; break; }
      }
      if (!placed) {
        for (let c = 8; c <= 25; c++) {
          if (commitSig(c, sig)) break;
        }
      }
    }

    let cursor = (room + d) % order.length;
    for (let hi = 0; hi < hot.length && realAt.length < budget && events.length < n; hi++) {
      const c = hot[hi];
      for (let k = 0; k < order.length; k++) {
        const type = order[(cursor + k) % order.length];
        if (!commit(c, type)) continue;
        cursor = (cursor + k + 1) % order.length;
        break;
      }
    }
    // Second pass: retry every column so spacing still packs after the first hits land.
    if (realAt.length < budget) {
      for (let c = 8; c <= 25 && realAt.length < budget && events.length < n; c++) {
        for (let k = 0; k < order.length; k++) {
          const type = order[(cursor + k) % order.length];
          if (!commit(c, type)) continue;
          cursor = (cursor + k + 1) % order.length;
          break;
        }
      }
    }
    // Last resort: force any armed trap family onto leftover legal tiles.
    if (realAt.length < budget) {
      const force = ["gate", "saw", "hole", "laser", "push", "drop", "lock", "wind", "side", "ceiling", "reverse", "gravity", "teleport"];
      for (let c = 8; c <= 25 && realAt.length < budget && events.length < n; c++) {
        for (let fi = 0; fi < force.length; fi++) {
          if (commit(c, force[fi])) break;
        }
      }
    }
    // Still short? Ignore near-pit / flat rules — only spacing + caps.
    if (realAt.length < budget) {
      const force = ["gate", "push", "saw", "lock", "wind", "hole"];
      for (let c = 8; c <= 25 && realAt.length < budget && events.length < n; c++) {
        if (surface[c] < 0 || busy(c, "gate")) continue;
        for (let fi = 0; fi < force.length; fi++) {
          const type = force[fi];
          if ((caps[type] || 0) <= used[type]) continue;
          const y = surface[c];
          if (type === "gate") {
            events.push({
              if: { x: +(c - 1.4).toFixed(2) }, once: true,
              do: [["fill", c, y, 1, 1, "^"], ["sfx", "spike"], ["shake", 4],
                ["queue", late ? 0.55 : 0.7, ["fill", c, y, 1, 1, "#"]]],
            });
          } else if (type === "push") {
            events.push({
              if: { x: +c.toFixed(2) }, once: true,
              do: [["push", 1.0, 0], ["shake", 3]],
            });
          } else if (type === "saw") {
            events.push({
              if: { x: +(c - 1.3).toFixed(2) }, once: true,
              do: [["saw", Math.min(29, c + 4), y - 1, late ? -3.0 : -2.6, 0], ["sfx", "saw"]],
            });
          } else if (type === "lock") {
            events.push({
              if: { x: +c.toFixed(2) }, once: true,
              do: [["lock", late ? 0.4 : 0.5], ["sfx", "land"], ["shake", 3]],
            });
          } else if (type === "wind") {
            events.push({
              if: { x: +(c - 0.2).toFixed(2) }, once: true,
              do: [["wind", -0.7], ["sfx", "reverse"], ["queue", 0.55, ["wind", 0]]],
            });
          } else if (type === "hole") {
            events.push({
              if: { x: +(c - 1.4).toFixed(2) }, once: true,
              do: [["hole", c, y, 1, 1], ["spikes", c, Math.min(11, y + 1), 1], ["shake", 6], ["sfx", "crumble"]],
            });
          } else continue;
          realAt.push({ x: c, t: type });
          used[type] += 1;
          break;
        }
      }
    }

    // Fake tells ride the same route so bait sits where the player already looks.
    const tells = [];
    const seenTell = new Set();
    function pushTell(x) {
      if (x < 4 || x > 28 || seenTell.has(x)) return;
      seenTell.add(x);
      tells.push(x);
    }
    for (let i = 0; i < realAt.length; i++) pushTell(realAt[i].x - 1);
    const bait = hot.slice().sort((a, b) => heat[b] - heat[a]);
    for (let i = 0; i < bait.length; i++) pushTell(bait[i]);
    for (let x = 5; x <= 28; x++) pushTell(x);
    if (!tells.length) tells.push(8);
    let ti = 0;
    let guard = 0;
    while (events.length < n && guard++ < 300) {
      const x = tells[ti % tells.length];
      ti += 1;
      const y = surface[x] >= 0 ? surface[x] : 9;
      const flavor = (x + events.length + d + room) % 11;
      if (flavor === 0) {
        events.push({
          if: { x: +x.toFixed(2) }, once: true, quiet: true,
          do: [["glow", Math.max(1, x - 1), Math.max(2, y - 3), 2, 0.16]],
        });
      } else if (flavor === 1) {
        events.push({
          if: { x: +x.toFixed(2) }, once: true, quiet: true,
          do: [["flash", 0.05], ["shake", 2]],
        });
      } else if (flavor === 2) {
        events.push({
          if: { x: +x.toFixed(2) }, once: true, quiet: true,
          do: [["lie", ["????", "SAFE", "JUMP", "WAIT"][(x + events.length + d) % 4]]],
        });
      } else {
        events.push({
          if: { x: +x.toFixed(2) }, once: true, quiet: true,
          do: [["dust", x, y, 2], ["shake", 2], ["sfx", "crumble"]],
        });
      }
    }

    if (boss && events.length) {
      let idx = events.length - 1;
      for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].quiet) { idx = i; break; }
      }
      const fy = surface[13] >= 0 ? surface[13] : 8;
      const py = Math.max(2, fy - 3);
      events[idx] = {
        if: { door: "fake" }, once: true, delay: 0.1,
        do: [
          ["fill", 12, py, 3, 1, "^"],
          ["saw", 8, py, 1.6, 0],
          ["shake", 7],
          ["sfx", "spike"],
          ["queue", 0.48, ["fill", 12, py, 3, 1, "#"]],
        ],
      };
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
    const dim = DIMS[d - 1] || DIMS[0];
    const surface = terrain(d, i, r);
    const layout = LAYOUTS[(d + i) % LAYOUTS.length];
    return {
      name: boss ? dim.name + " CORE" : dim.name + " " + layout + " " + (i + 1),
      taunt: pick(r, TAUNTS),
      map: paintRoom(surface, d, i, r, boss),
      events: buildEvents(d, surface, boss, i),
      explodeCoins: false,
      crumbleIfStill: 0,
      dim: d,
      boss: !!boss,
      layout,
      surface,
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
    DIMS, roomCount, trapCount, signatureTraps, generate, theme, chordsFor, reachable, pathHeat, count: 20,
  };
  root.LEVELS = generate(1);
})(typeof window !== "undefined" ? window : globalThis);
