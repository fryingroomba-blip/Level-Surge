// Boss fights for worlds 2–20. Null keeps his own fight in game.js.
// This file is the variety pass: each world gets its own attacks, a move
// style that changes with the phase, and a planner that will not mash the
// same heavy twice. Later phases add attacks. They do not just go faster.
(function (root) {
  const TYPES = {
    seek: 1, lob: 1, columns: 1, fan: 1, dash: 1, ring: 1, rain: 1, lane: 1,
    pull: 1, blink: 1, saw: 1, guard: 1, beat: 1, mirror: 1, orbit: 1, crack: 1,
    lunge: 1, band: 1, pillar: 1, wisp: 1, shade: 1, seam: 1, wave: 1,
  };
  const ROLES = { air: 1, camp: 1, run: 1, door: 1, any: 1 };
  const DODGE = { sidestep: 1, jump: 1, lane: 1, none: 1 };

  function A(id, phase, type, wind, cool, heavy, role, dodge, say, dead, extra) {
    const act = {
      id: id, phase: phase, type: type, wind: wind, cool: cool,
      heavy: !!heavy, role: role, dodge: dodge, say: say, dead: dead || "",
    };
    if (extra) {
      for (const k in extra) act[k] = extra[k];
    }
    return act;
  }

  function mv(id, y, amp, freq, stiff, patrol, flag) {
    return {
      id: id, y: y, amp: amp, freq: freq, stiff: stiff,
      patrol: patrol, flag: flag || "",
    };
  }

  // phase 0 is the opening. 1 arrives once the door has moved a bit.
  // 2 is the last stretch, and it is a different set of tricks.
  const KITS = [
    {
      dim: 2, look: "ember", sig: "coal",
      lines: { strain: "The coals woke up.", desperate: "No cool floor left." },
      move: {
        open: mv("skim", 96, 8, 0.55, 0.04, 0.38),
        strain: mv("hop", 130, 42, 1.35, 0.07, 0.5),
        desperate: mv("low", 68, 6, 1.8, 0.09, 0.82),
      },
      acts: [
        A("ember", 0, "lob", 0.5, 2.1, false, "run", "sidestep", "Heads. Not yours.", "you caught it.", { lead: 3 }),
        A("teeth", 0, "columns", 0.56, 2.6, true, "run", "lane", "The floor's hot.", "you stood in it.", { gap: 3, count: 5 }),
        A("vent", 1, "fan", 0.44, 1.9, false, "air", "sidestep", "Three ways. Hot.", "you ran at it."),
        A("coal", 1, "dash", 0.54, 2.8, true, "camp", "jump", "I'm coming low.", "should've jumped.", { slip: 0 }),
        A("stomp", 2, "wave", 0.58, 3.1, true, "camp", "jump", "Two tiles over.", "the slam. jump.", { max: 124 }),
      ],
    },
    {
      dim: 3, look: "ice", sig: "skate",
      lines: { strain: "It's slicker now.", desperate: "I can't feel my hands." },
      move: {
        open: mv("slide", 108, 6, 0.4, 0.03, 0.55),
        strain: mv("drift", 86, 14, 0.7, 0.045, 0.4),
        desperate: mv("skate", 72, 4, 1.1, 0.08, 0.9, "trail"),
      },
      acts: [
        A("cube", 0, "seek", 0.46, 1.8, false, "any", "sidestep", "One cube.", "the cube."),
        A("hail", 0, "rain", 0.52, 2.3, false, "run", "lane", "Snow. Not on you.", "you waited.", { gap: 3, count: 6 }),
        A("skate", 1, "dash", 0.52, 2.7, true, "camp", "jump", "I slide. Jump.", "ice is low.", { slip: 0.75 }),
        A("rime", 1, "lane", 0.48, 2.0, false, "run", "jump", "On the ice. Jump.", "too low.", { gap: 3 }),
        A("frost", 2, "columns", 0.6, 2.8, true, "camp", "lane", "Leave the shine.", "you left it.", { gap: 3, count: 6, cover: "move" }),
      ],
    },
    {
      dim: 4, look: "petal", sig: "gust",
      lines: { strain: "Pretty got mean.", desperate: "Petals are done." },
      move: {
        open: mv("bob", 156, 26, 0.8, 0.035, 0.42),
        strain: mv("petal", 124, 48, 1.2, 0.05, 0.48),
        desperate: mv("dive", 84, 18, 1.6, 0.08, 0.6),
      },
      acts: [
        A("pollen", 0, "rain", 0.5, 2.2, false, "run", "lane", "Don't inhale.", "pollen. gross.", { gap: 3, count: 5 }),
        A("petal", 0, "saw", 0.5, 2.4, false, "any", "jump", "The saw's pretty.", "the petal."),
        A("gust", 1, "pull", 0.55, 2.6, true, "door", "sidestep", "Wind. Fight it.", "the gust."),
        A("wreath", 1, "ring", 0.46, 2.1, false, "air", "sidestep", "Step out.", "wreath closed."),
        A("canopy", 2, "lob", 0.52, 2.2, false, "run", "sidestep", "From the canopy.", "the canopy.", { lead: 4 }),
      ],
    },
    {
      dim: 5, look: "gear", sig: "rewind",
      lines: { strain: "You're late again.", desperate: "The clock's angry." },
      move: {
        open: mv("tick", 118, 4, 2, 0.06, 0.34, "beat"),
        strain: mv("pend", 100, 22, 0.9, 0.05, 0.46),
        desperate: mv("rush", 78, 8, 1.4, 0.1, 0.7, "beat"),
      },
      acts: [
        A("tick", 0, "seek", 0.48, 1.8, false, "any", "sidestep", "On the beat.", "on the tick."),
        A("pendulum", 0, "lane", 0.5, 2.1, false, "run", "jump", "Low gear. Jump.", "low gear."),
        A("rewind", 1, "beat", 0.7, 3.2, true, "run", "sidestep", "I flipped you.", "wrong second.", { reverse: 0.28 }),
        A("chime", 1, "fan", 0.44, 2.0, false, "air", "sidestep", "Three ticks.", "three ticks."),
        A("noon", 2, "wave", 0.58, 3.0, true, "camp", "jump", "Noon. Jump it.", "noon dropped.", { max: 118 }),
      ],
    },
    {
      dim: 6, look: "bile", sig: "pool",
      lines: { strain: "Stomach's turning.", desperate: "I'm still hungry." },
      move: {
        open: mv("lurch", 112, 10, 0.35, 0.03, 0.3),
        strain: mv("sag", 82, 16, 0.8, 0.05, 0.4),
        desperate: mv("heave", 64, 20, 1.3, 0.07, 0.55),
      },
      acts: [
        A("spit", 0, "seek", 0.44, 1.8, false, "any", "sidestep", "Ptoo.", "you ate it."),
        A("pool", 0, "columns", 0.52, 2.4, true, "camp", "jump", "Jump the bile.", "too low.", { gap: 2, count: 3, low: true, home: true }),
        A("heave", 1, "lob", 0.5, 2.2, false, "run", "sidestep", "I heaved one.", "I heaved.", { lead: 3 }),
        A("burp", 1, "ring", 0.46, 2.2, false, "air", "sidestep", "Leave the burp.", "the burp."),
        A("drip", 2, "rain", 0.5, 2.3, false, "run", "lane", "Drips. Move.", "you stood.", { gap: 3, count: 6 }),
      ],
    },
    {
      dim: 7, look: "mirror", sig: "mirror",
      lines: { strain: "Stop copying me.", desperate: "Both of me now." },
      move: {
        open: mv("copy", 120, 8, 0.6, 0.04, 0.2, "mirror"),
        strain: mv("echo", 96, 12, 0.9, 0.05, 0.2, "mirror"),
        desperate: mv("split", 88, 6, 0.7, 0.06, 0.2, "twin"),
      },
      acts: [
        A("sea", 0, "lane", 0.48, 2.0, false, "run", "jump", "Your low line.", "you floored you."),
        A("mirror", 0, "mirror", 0.5, 2.0, false, "any", "sidestep", "From the other you.", "you shot you."),
        A("copy", 1, "fan", 0.46, 2.1, false, "air", "sidestep", "Your fan. Bad.", "you fanned.", { echo: true }),
        A("tide", 1, "rain", 0.52, 2.3, false, "run", "lane", "Your rain.", "you rained.", { gap: 3, count: 5 }),
        A("loop", 2, "ring", 0.48, 2.2, false, "camp", "sidestep", "Your ring.", "you ringed you."),
      ],
    },
    {
      dim: 8, look: "coal", sig: "train",
      lines: { strain: "Express doesn't stop.", desperate: "Brakes are gone." },
      move: {
        open: mv("rail", 78, 0, 0.5, 0.08, 0.85, "rail"),
        strain: mv("express", 70, 0, 0.8, 0.12, 0.9, "rail"),
        desperate: mv("brake", 96, 0, 0.4, 0.05, 0.5, "rail"),
      },
      acts: [
        A("cinder", 0, "lob", 0.48, 2.0, false, "run", "sidestep", "A coal.", "the coal.", { lead: 3 }),
        A("spark", 0, "columns", 0.54, 2.5, true, "run", "lane", "Between the cars.", "cinders.", { gap: 3, count: 4 }),
        A("cutter", 1, "saw", 0.5, 2.4, false, "any", "jump", "On the rail.", "on the rail."),
        A("train", 1, "dash", 0.56, 2.9, true, "camp", "jump", "Train. Jump.", "the train."),
        A("stack", 2, "rain", 0.5, 2.2, false, "air", "lane", "From the stack.", "the stack.", { gap: 3, count: 6 }),
      ],
    },
    {
      dim: 9, look: "spark", sig: "blink",
      lines: { strain: "Signal's worse.", desperate: "No bars. Still here." },
      move: {
        open: mv("jitter", 124, 10, 1.2, 0.04, 0.5, "jitter"),
        strain: mv("scan", 140, 18, 0.7, 0.05, 0.55),
        desperate: mv("glitch", 100, 8, 1.8, 0.06, 0.6, "jitter"),
      },
      acts: [
        A("crackle", 0, "seek", 0.44, 1.8, false, "any", "sidestep", "A spark.", "the spark."),
        A("snow", 0, "rain", 0.52, 2.3, false, "run", "lane", "Dead pixel. Step.", "the snow.", { gap: 3, count: 5 }),
        A("blink", 1, "blink", 0.5, 2.6, true, "camp", "sidestep", "New channel.", "antenna."),
        A("halo", 1, "ring", 0.46, 2.1, false, "air", "sidestep", "A halo. Leave it.", "the halo."),
        A("burst", 2, "fan", 0.44, 2.0, false, "air", "sidestep", "A burst. Cover.", "the burst."),
      ],
    },
    {
      dim: 10, look: "bone", sig: "moon",
      lines: { strain: "Gravity's bored.", desperate: "The moon let go." },
      move: {
        open: mv("orbit", 150, 34, 0.45, 0.03, 0.42, "orbit"),
        strain: mv("moon", 130, 48, 0.7, 0.04, 0.5, "orbit"),
        desperate: mv("drop", 76, 12, 1.1, 0.06, 0.35),
      },
      acts: [
        A("bone", 0, "seek", 0.46, 1.9, false, "any", "sidestep", "A bone.", "the bone."),
        A("rib", 0, "lane", 0.5, 2.1, false, "run", "jump", "Along the ground.", "ground bone."),
        A("moon", 1, "orbit", 0.58, 3.0, true, "air", "sidestep", "Gravity quit.", "the moon.", { grav: 0.3 }),
        A("grave", 1, "ring", 0.48, 2.2, false, "camp", "sidestep", "A ring of them.", "the ring."),
        A("ribs", 2, "rain", 0.52, 2.4, false, "run", "lane", "Rain of ribs.", "rib rain.", { gap: 3, count: 6 }),
      ],
    },
    {
      dim: 11, look: "shard", sig: "crack",
      lines: { strain: "I can hear the crack.", desperate: "I'm all cracks." },
      move: {
        open: mv("still", 118, 3, 0.4, 0.02, 0.15),
        strain: mv("crack", 100, 10, 0.8, 0.04, 0.3),
        desperate: mv("shatter", 82, 8, 1.5, 0.09, 0.65, "trail"),
      },
      acts: [
        A("sliver", 0, "seek", 0.5, 2.0, false, "any", "sidestep", "A sliver. Tiny.", "the sliver.", { speed: 2.3 }),
        A("cut", 0, "fan", 0.46, 2.1, false, "air", "sidestep", "A fan. It cuts.", "the fan."),
        A("crack", 1, "crack", 0.85, 3.0, true, "run", "sidestep", "You can see it.", "the pane."),
        A("pane", 1, "ring", 0.5, 2.3, false, "camp", "sidestep", "A pane around me.", "the pane."),
        A("sprinkle", 2, "rain", 0.52, 2.2, false, "run", "lane", "A sprinkle. Mean.", "sprinkle.", { gap: 3, count: 5 }),
      ],
    },
    {
      dim: 12, look: "bite", sig: "lunge",
      lines: { strain: "Still hungry.", desperate: "You're the plate." },
      move: {
        open: mv("stalk", 150, 10, 0.5, 0.05, 0.2, "stalk"),
        strain: mv("loom", 110, 16, 0.8, 0.06, 0.2, "stalk"),
        desperate: mv("chomp", 72, 8, 1.2, 0.08, 0.25, "stalk"),
      },
      acts: [
        A("chomp", 0, "seek", 0.44, 1.8, false, "any", "sidestep", "A bite.", "the bite."),
        A("crumbs", 0, "rain", 0.5, 2.2, false, "run", "lane", "Crumbs. Don't stand.", "crumbs.", { gap: 3, count: 5 }),
        A("lure", 1, "saw", 0.5, 2.5, false, "door", "jump", "Not the food.", "the tongue.", { away: true }),
        A("lunge", 1, "lunge", 0.48, 2.6, true, "camp", "jump", "I'm coming.", "you stood."),
        A("maw", 2, "ring", 0.5, 2.3, false, "air", "sidestep", "Around. I'm the hole.", "around you."),
      ],
    },
    {
      dim: 13, look: "zap", sig: "live",
      lines: { strain: "It's live.", desperate: "Fuse should've popped." },
      move: {
        open: mv("wire", 200, 6, 0.6, 0.05, 0.7, "rail"),
        strain: mv("arc", 140, 20, 1.0, 0.06, 0.45),
        desperate: mv("short", 84, 8, 1.6, 0.09, 0.6),
      },
      acts: [
        A("zap", 0, "seek", 0.44, 1.8, false, "any", "sidestep", "A zap.", "zapped."),
        A("coil", 0, "ring", 0.48, 2.2, false, "camp", "sidestep", "A coil. Step out.", "the coil."),
        A("fork", 1, "fan", 0.44, 2.0, false, "air", "sidestep", "A fork. Pick wrong.", "the fork."),
        A("live", 1, "band", 0.52, 2.5, true, "air", "sidestep", "Don't jump.", "the wire.", { high: true }),
        A("ground", 2, "band", 0.54, 2.6, true, "camp", "jump", "Feet up.", "the wire.", { high: false, home: true }),
      ],
    },
    {
      dim: 14, look: "salt", sig: "pillar",
      lines: { strain: "Quiet's over.", desperate: "The hymn's loud." },
      move: {
        open: mv("walk", 126, 6, 0.35, 0.025, 0.28),
        strain: mv("aisle", 104, 10, 0.6, 0.04, 0.4),
        desperate: mv("hymn", 80, 14, 1.0, 0.055, 0.5),
      },
      acts: [
        A("grain", 0, "seek", 0.48, 1.9, false, "any", "sidestep", "A grain.", "a grain.", { speed: 2.6 }),
        A("hymn", 0, "ring", 0.56, 2.4, false, "camp", "sidestep", "A halo. Leave it.", "the halo.", { speed: 2.2 }),
        A("aisle", 1, "columns", 0.58, 2.6, true, "run", "lane", "The aisle. Walk it.", "aisle was open.", { gap: 4, count: 5 }),
        A("pillar", 1, "pillar", 0.55, 2.7, true, "run", "sidestep", "From the vault.", "the vault.", { lead: 3 }),
        A("vault", 2, "rain", 0.52, 2.3, false, "air", "lane", "Falling salt.", "the fall.", { gap: 3, count: 5 }),
      ],
    },
    {
      dim: 15, look: "red", sig: "flick",
      lines: { strain: "Too slow.", desperate: "Even I'm late." },
      move: {
        open: mv("streak", 112, 8, 1.1, 0.1, 0.75, "trail"),
        strain: mv("after", 90, 6, 1.4, 0.11, 0.8, "trail"),
        desperate: mv("flick", 74, 4, 1.8, 0.08, 0.7, "jitter"),
      },
      acts: [
        A("flick", 0, "seek", 0.72, 2.2, false, "any", "sidestep", "Fast. The line first.", "too slow.", { speed: 5.5 }),
        A("red", 0, "rain", 0.54, 2.3, false, "run", "lane", "Red rain.", "red rain.", { gap: 3, count: 5 }),
        A("after", 1, "dash", 0.5, 2.6, true, "camp", "jump", "Blink, then jump.", "you blinked."),
        A("redring", 1, "ring", 0.46, 2.1, false, "air", "sidestep", "A red ring.", "the ring."),
        A("shift", 2, "blink", 0.52, 2.5, true, "camp", "sidestep", "I already left.", "the flick."),
      ],
    },
    {
      dim: 16, look: "wisp", sig: "wisp",
      lines: { strain: "Boo. Again.", desperate: "I'm barely here." },
      move: {
        open: mv("fade", 140, 12, 0.5, 0.03, 0.45, "jitter"),
        strain: mv("drift", 150, 28, 0.7, 0.035, 0.5),
        desperate: mv("grid", 96, 8, 1.1, 0.06, 0.4),
      },
      acts: [
        A("sigh", 0, "seek", 0.5, 2.0, false, "any", "sidestep", "A sigh. It hits.", "the sigh.", { speed: 2.4 }),
        A("wisp", 0, "wisp", 0.48, 2.2, false, "run", "sidestep", "A wisp.", "the wisp."),
        A("grid", 1, "columns", 0.6, 2.7, true, "camp", "lane", "The empty bit.", "empty was safe.", { gap: 4, count: 5 }),
        A("loop", 1, "ring", 0.5, 2.3, false, "air", "sidestep", "A loop. Step out.", "the loop."),
        A("drift", 2, "rain", 0.52, 2.3, false, "run", "lane", "A drift.", "the drift.", { gap: 4, count: 5 }),
      ],
    },
    {
      dim: 17, look: "needle", sig: "sky",
      lines: { strain: "More points.", desperate: "The sky's all needles." },
      move: {
        open: mv("hang", 210, 8, 0.45, 0.03, 0.35),
        strain: mv("dip", 130, 24, 0.9, 0.05, 0.4),
        desperate: mv("crown", 78, 6, 1.3, 0.07, 0.55),
      },
      acts: [
        A("jab", 0, "seek", 0.44, 1.8, false, "any", "sidestep", "A jab. Small.", "the jab."),
        A("hem", 0, "lane", 0.48, 2.0, false, "run", "jump", "Along the hem.", "the hem."),
        A("sky", 1, "shade", 0.66, 2.9, true, "camp", "lane", "Between the points.", "the rain.", { gap: 4, count: 8, cover: "move" }),
        A("crown", 1, "ring", 0.48, 2.2, false, "air", "sidestep", "A crown. Duck.", "the crown."),
        A("pins", 2, "rain", 0.54, 2.4, false, "run", "lane", "A rain of them.", "the rain.", { gap: 3, count: 7 }),
      ],
    },
    {
      dim: 18, look: "ray", sig: "shade",
      lines: { strain: "Squint.", desperate: "I'm burnt out." },
      move: {
        open: mv("solar", 146, 30, 0.5, 0.035, 0.4, "orbit"),
        strain: mv("flare", 110, 16, 0.9, 0.05, 0.45),
        desperate: mv("burn", 74, 8, 1.4, 0.08, 0.6),
      },
      acts: [
        A("ray", 0, "seek", 0.48, 1.9, false, "any", "sidestep", "A ray.", "the ray."),
        A("flare", 0, "fan", 0.46, 2.1, false, "air", "sidestep", "A flare.", "the flare."),
        A("shade", 1, "shade", 0.66, 2.9, true, "camp", "lane", "The shade. Use it.", "shade was there.", { gap: 4, count: 7, cover: "move" }),
        A("shower", 1, "rain", 0.52, 2.3, false, "run", "lane", "A shower.", "the shower.", { gap: 3, count: 5 }),
        A("burn", 2, "wave", 0.58, 3.0, true, "camp", "jump", "Along the ground.", "the ground.", { max: 130 }),
      ],
    },
    {
      dim: 19, look: "fold", sig: "seam",
      lines: { strain: "Which one.", desperate: "Both of us." },
      move: {
        open: mv("twin", 120, 8, 0.45, 0.04, 0.2, "twin"),
        strain: mv("crease", 100, 12, 0.7, 0.05, 0.2, "twin"),
        desperate: mv("both", 86, 6, 0.8, 0.06, 0.2, "mirror"),
      },
      acts: [
        A("us", 0, "seek", 0.46, 1.9, false, "any", "sidestep", "Us.", "us."),
        A("seam", 0, "seam", 0.52, 2.3, false, "camp", "lane", "The seam. Step.", "seam was open."),
        A("echo", 1, "saw", 0.52, 2.5, true, "door", "jump", "From the crease.", "the crease.", { echo: true }),
        A("crease", 1, "columns", 0.58, 2.6, true, "run", "lane", "Along the fold.", "the fold.", { gap: 3, count: 5 }),
        A("both", 2, "fan", 0.48, 2.2, false, "air", "sidestep", "Three of us.", "three of us.", { echo: true }),
      ],
    },
    {
      dim: 20, look: "star", sig: "plea",
      lines: { strain: "Please don't.", desperate: "I can't hold it." },
      move: {
        open: mv("nervous", 150, 14, 0.7, 0.03, 0.32),
        strain: mv("shake", 120, 30, 2.1, 0.045, 0.4),
        desperate: mv("plea", 88, 8, 1.0, 0.035, 0.28),
      },
      acts: [
        A("tremble", 0, "seek", 0.6, 2.1, false, "any", "sidestep", "Last shot. Move.", "last shot.", { speed: 2.5 }),
        A("white", 0, "rain", 0.56, 2.4, false, "run", "lane", "Last rain.", "last rain.", { gap: 4, count: 5 }),
        A("plea", 1, "guard", 0.5, 2.4, false, "door", "none", "Please. Back up.", ""),
        A("mercy", 1, "shade", 0.7, 3.0, true, "camp", "lane", "Last gap. Take it.", "gap was last.", { gap: 5, count: 6, cover: "move" }),
        A("sorry", 2, "ring", 0.6, 2.5, false, "air", "sidestep", "Last ring.", "last ring.", { speed: 2.3 }),
      ],
    },
  ];

  const BY = {};
  for (let i = 0; i < KITS.length; i++) BY[KITS[i].dim] = KITS[i];

  function kit(dim) { return BY[dim | 0] || null; }

  function act(k, id) {
    if (!k || !k.acts) return null;
    for (let i = 0; i < k.acts.length; i++) if (k.acts[i].id === id) return k.acts[i];
    return null;
  }

  function rankOf(bandName) {
    if (bandName === "desperate") return 2;
    if (bandName === "strain") return 1;
    return 0;
  }

  // Later worlds meet the last phase a little sooner. The phase is new
  // attacks, so this is not a hidden speed bump.
  function band(moves, goal, dim) {
    const u = (moves || 0) / Math.max(1, goal || 1);
    const late = dim >= 18 ? 0.58 : dim >= 8 ? 0.64 : 0.72;
    if (u >= late) return "desperate";
    if (u >= 0.36) return "strain";
    return "open";
  }

  function pool(k, bandName, cool, now) {
    const rank = rankOf(bandName);
    const out = [];
    const acts = (k && k.acts) || [];
    for (let i = 0; i < acts.length; i++) {
      const a = acts[i];
      if (a.phase > rank) continue;
      if (cool && cool[a.id] > now) continue;
      out.push(a);
    }
    return out;
  }

  function wind(a, bandName) {
    let w = a.wind;
    if (bandName === "strain") w *= 0.96;
    if (bandName === "desperate") w *= 0.9;
    let floor = a.heavy ? 0.46 : 0.34;
    if (a.cover === "move") floor = Math.max(floor, 0.58);
    return Math.max(floor, w);
  }

  function gapAfter(a, bandName) {
    let g = a.heavy ? 0.52 : 0.34;
    if (bandName === "desperate") g = Math.max(0.3, g - 0.04);
    return g;
  }

  function rest(bandName) {
    if (bandName === "desperate") return 0.34;
    if (bandName === "strain") return 0.44;
    return 0.56;
  }

  function byId(list, id) {
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  // Three tells, then a breath. No two heavies in a row. The signature
  // attack is forced into the last phase so that phase cannot be a remix.
  function build(k, ctx) {
    ctx = ctx || {};
    const bandName = ctx.band || "open";
    let bag = pool(k, bandName, ctx.cool, ctx.now || 0);
    if (!bag.length) bag = pool(k, bandName, null, 0);
    if (!bag.length) bag = (k.acts || []).slice(0, 2);
    const plan = [];
    let last = ctx.last || "";
    let prevHeavy = false;
    const rand = ctx.rand || Math.random;
    for (let n = 0; n < 3; n++) {
      let choices = [];
      for (let i = 0; i < bag.length; i++) {
        const a = bag[i];
        if (a.id === last) continue;
        if (prevHeavy && a.heavy) continue;
        choices.push(a);
      }
      if (!choices.length) {
        for (let i = 0; i < bag.length; i++) if (bag[i].id !== last) choices.push(bag[i]);
      }
      if (!choices.length) choices = bag.slice();
      const role = ctx.role || "any";
      const prefer = [];
      for (let i = 0; i < choices.length; i++) {
        if (choices[i].role === role || choices[i].role === "any") prefer.push(choices[i]);
      }
      const use = prefer.length ? prefer : choices;
      const pick = use[Math.min(use.length - 1, Math.floor(rand() * use.length))] || use[0];
      plan.push(pick.id);
      last = pick.id;
      prevHeavy = !!pick.heavy;
    }
    if (bandName === "desperate" && k.sig && plan.indexOf(k.sig) < 0) {
      const sig = byId(bag, k.sig) || byId(k.acts, k.sig);
      if (sig) {
        let slot = 1;
        const left = byId(bag, plan[0]) || byId(k.acts, plan[0]);
        const right = byId(bag, plan[2]) || byId(k.acts, plan[2]);
        if (sig.heavy && left && left.heavy) slot = (right && right.heavy) ? 0 : 2;
        if (sig.heavy && slot === 2 && right && right.heavy) slot = 0;
        plan[slot] = sig.id;
        if (plan[0] === plan[1] && bag.length > 1) {
          for (let i = 0; i < bag.length; i++) {
            if (bag[i].id !== plan[0] && !(sig.heavy && bag[i].heavy && slot === 0)) {
              plan[slot === 0 ? 1 : 0] = bag[i].id;
              break;
            }
          }
        }
      }
    }
    return plan;
  }

  function say(dim, kind) {
    const k = kit(dim);
    if (!k) return "";
    if (k.lines && k.lines[kind]) return k.lines[kind];
    const a = act(k, kind);
    return a ? a.say : "";
  }

  function line(dim, id, dead) {
    const a = act(kit(dim), id);
    if (!a) return "";
    return dead ? (a.dead || "") : (a.say || "");
  }

  function review(k) {
    const issues = [];
    const bad = (m) => issues.push(m);
    if (!k) return ["missing"];
    if (!k.look) bad("no look");
    if (!k.sig || !act(k, k.sig)) bad("sig");
    if (!k.lines || !k.lines.strain || !k.lines.desperate) bad("phase lines");
    if (k.lines && k.lines.strain && k.lines.strain.length > 42) bad("strain long");
    if (k.lines && k.lines.desperate && k.lines.desperate.length > 42) bad("desperate long");
    const moves = k.move || {};
    if (!moves.open || !moves.strain || !moves.desperate) bad("moves");
    else if (moves.open.id === moves.strain.id || moves.strain.id === moves.desperate.id || moves.open.id === moves.desperate.id) {
      bad("move ids repeat");
    }
    if (!k.acts || k.acts.length < 5) bad("acts");
    const ids = {};
    let p0 = 0;
    let p1 = 0;
    let p2 = 0;
    (k.acts || []).forEach((a) => {
      if (ids[a.id]) bad("dup " + a.id);
      ids[a.id] = 1;
      if (a.phase === 0) p0 += 1;
      else if (a.phase === 1) p1 += 1;
      else if (a.phase === 2) p2 += 1;
      else bad("phase " + a.id);
      if (!TYPES[a.type]) bad("type " + a.id);
      if (!ROLES[a.role]) bad("role " + a.id);
      if (!DODGE[a.dodge]) bad("dodge " + a.id);
      if (!(a.wind >= 0.4)) bad("wind " + a.id);
      if (a.heavy && !(a.wind >= 0.48)) bad("heavy wind " + a.id);
      if (a.cover === "move" && !(a.wind >= 0.58)) bad("move wind " + a.id);
      if (!(a.cool >= 1.6)) bad("cool " + a.id);
      if (!a.say || a.say.length > 42) bad("say " + a.id);
      if (a.type !== "guard" && (!a.dead || a.dead.length > 22)) bad("dead " + a.id);
      if (wind(a, "desperate") < 0.34) bad("floor " + a.id);
      if (a.cover === "move" && wind(a, "desperate") < 0.58) bad("move floor " + a.id);
      if (gapAfter(a, "desperate") < 0.3) bad("gap " + a.id);
      if (a.dodge === "jump" && a.type === "columns" && !a.low) bad("jump column " + a.id);
      if (a.dodge === "none" && a.type !== "guard") bad("none " + a.id);
    });
    if (p0 < 2 || p1 < 1 || p2 < 1) bad("phase spread");
    const openIds = pool(k, "open").map((a) => a.id);
    const lateIds = pool(k, "desperate").map((a) => a.id);
    if (lateIds.length <= openIds.length) bad("late pool");
    const added = lateIds.filter((id) => openIds.indexOf(id) < 0);
    if (added.length < 2) bad("late adds");
    return issues;
  }

  function audit() {
    const issues = [];
    const sigs = {};
    const looks = {};
    const triples = {};
    const sequences = {};
    const types = {};
    if (KITS.length !== 19) issues.push("count " + KITS.length);
    KITS.forEach((k) => {
      review(k).forEach((m) => issues.push("D" + k.dim + " " + m));
      if (sigs[k.sig]) issues.push("sig shared " + k.sig);
      sigs[k.sig] = k.dim;
      if (looks[k.look]) issues.push("look shared " + k.look);
      looks[k.look] = k.dim;
      const triple = k.move.open.id + ">" + k.move.strain.id + ">" + k.move.desperate.id;
      if (triples[triple]) issues.push("move shared " + triple);
      triples[triple] = k.dim;
      const seq = k.acts.map((a) => a.id).join(",");
      if (sequences[seq]) issues.push("acts shared " + seq);
      sequences[seq] = k.dim;
      const typeSeq = k.acts.map((a) => a.type).join(",");
      if (types[typeSeq]) issues.push("types shared D" + k.dim + " " + typeSeq);
      types[typeSeq] = k.dim;
      if (k.dim < 2 || k.dim > 20) issues.push("dim " + k.dim);
    });
    for (let d = 2; d <= 20; d++) if (!BY[d]) issues.push("missing " + d);
    return issues;
  }

  root.SURGE_BOSS_KITS = {
    kit: kit,
    act: act,
    say: say,
    line: line,
    band: band,
    pool: pool,
    wind: wind,
    gapAfter: gapAfter,
    rest: rest,
    build: build,
    review: review,
    audit: audit,
    all: KITS,
    TYPES: Object.keys(TYPES),
  };
})(typeof window !== "undefined" ? window : globalThis);
