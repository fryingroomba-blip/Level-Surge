(function (root) {
  const W = 32;
  const pad = (s) => {
    s = String(s).replace(/ /g, ".");
    if (s.length < W) return s + ".".repeat(W - s.length);
    return s.slice(0, W);
  };
  const sky = () => pad("");

  const jumpPunish = (xLess = 4.2, y = 3) => ({
    if: { jump: true, xLess, air: true }, once: true, delay: 0.05, do: [
      ["fill", 1, y, 10, 1, "v"], ["shake", 5], ["sfx", "spike"],
    ],
  });
  const sink = (when, hx, w = 2, delay = 0.22, fy = 9) => ({
    if: { x: when }, once: true, delay, do: [
      ["hole", hx, fy, w, 1], ["spikes", hx, fy + 1, w], ["shake", 7], ["sfx", "crumble"],
    ],
  });
  const fakeCrack = (when, hx = 8, w = 4) => ({
    if: { x: when }, once: true, quiet: true, do: [
      ["dust", hx, 9, w], ["shake", 5], ["sfx", "crumble"],
    ],
  });
  const sneakSaw = (when, sx, sy, vx, delay = 0.52) => ({
    if: { x: when }, once: true, delay, do: [
      ["saw", sx, sy, vx, 0],
    ],
  });
  const slice = (when, x, y = 7, w = 6, delay = 0.18) => ({
    if: { x: when }, once: true, delay, do: [
      ["laser", x, y, w, 0.14], ["sfx", "spike"],
    ],
  });
  const ghostBeam = (when, x, y = 5, w = 6) => ({
    if: { x: when }, once: true, quiet: true, do: [
      ["glow", x, y, w, 0.28],
    ],
  });
  const flip = (when, hold = 0.34) => ({
    if: { x: when }, once: true, delay: 0.2, do: [
      ["reverse", true], ["flash", 0.04], ["sfx", "reverse"],
      ["queue", hold, ["reverse", false]],
    ],
  });
  const doorPop = (when, sx, delay = 0.16, sy = 9) => ({
    if: { x: when }, once: true, delay, do: [
      ["fill", sx, sy, 1, 1, "^"], ["shake", 4], ["sfx", "spike"],
    ],
  });
  const lateSaw = (t, sx, sy, vx) => ({
    if: { time: t }, once: true, delay: 0.4, do: [
      ["saw", sx, sy, vx, 0],
    ],
  });
  const hangSpikes = (after, x, w = 8, y = 3) => ({
    if: { jumpAfter: after, air: true }, once: true, delay: 0.06, do: [
      ["fill", x, y, w, 1, "v"], ["sfx", "spike"], ["shake", 4],
    ],
  });
  // Rare hard traps — used sparingly in handmade rooms.
  const iceSheet = (when, dur = 1.05) => ({
    if: { x: when, ground: true }, once: true, do: [
      ["slip", dur], ["sfx", "reverse"], ["lie", "ICE"],
    ],
  });
  const weakLegs = (when, mul = 0.55, dur = 1.2) => ({
    if: { x: when }, once: true, do: [
      ["jumpCut", mul, dur], ["sfx", "land"], ["lie", "HEAVY LEGS"],
    ],
  });
  const jawBite = (when, x, y = 9, hold = 0.48) => ({
    if: { x: when }, once: true, do: [
      ["clamp", x, y, hold], ["lie", "JAWS"],
    ],
  });
  const ghostEcho = (when, delay = 0.58) => ({
    if: { x: when }, once: true, do: [["echo", delay]],
  });
  const tarPad = (when, dur = 0.55) => ({
    if: { x: when }, once: true, do: [
      ["sticky", dur], ["sfx", "land"], ["lie", "TAR"],
    ],
  });
  const blindSpot = (when, dur = 1.2) => ({
    if: { x: when }, once: true, do: [
      ["blackout", dur], ["sfx", "glitch"], ["lie", "BLIND"],
    ],
  });
  const crushWeight = (when, mul = 1.5, dur = 1.0) => ({
    if: { x: when }, once: true, do: [
      ["heavy", mul, dur], ["sfx", "land"], ["lie", "CRUSH"],
    ],
  });
  const pullBack = (when, tx, str = 0.16, dur = 0.85) => ({
    if: { x: when }, once: true, do: [
      ["magnet", tx, str, dur], ["sfx", "reverse"], ["lie", "PULL"],
    ],
  });
  const phantomFloor = (when, x, y = 9, w = 2, dur = 0.85) => ({
    if: { x: when }, once: true, do: [
      ["blink", x, y, w, 1, dur], ["lie", "GONE"],
    ],
  });
  const hungryFloor = (when, dur = 1.05) => ({
    if: { x: when }, once: true, do: [
      ["rift", dur], ["lie", "HUNGRY"],
    ],
  });
  // Entity / horror traps — scarier, technical, even rarer.
  const wakeStalker = (when, dist = 95, life = 2.7, speed = 3.15) => ({
    if: { x: when }, once: true, do: [
      ["stalker", dist, life, speed], ["lie", "IT SEES YOU"],
    ],
  });
  const callDrone = (when, x, y = 3, life = 3.1) => ({
    if: { x: when }, once: true, do: [
      ["drone", x, y, life], ["lie", "TARGET LOCKED"],
    ],
  });
  const launchRocket = (when, fromRight = 1, y = 7, life = 2.4) => ({
    if: { x: when }, once: true, do: [
      ["rocket", fromRight, y, life, 0.06], ["lie", "INCOMING"],
    ],
  });
  const risingFog = (when, dur = 2.0) => ({
    if: { x: when }, once: true, do: [
      ["voidFog", dur], ["lie", "FOG RISING"],
    ],
  });
  const openEye = (when, x, y = 2, life = 2.8) => ({
    if: { x: when }, once: true, do: [
      ["watcher", x, y, life], ["lie", "WATCHING"],
    ],
  });
  const wallSentry = (when, side = 1, y = 8, life = 2.6) => ({
    if: { x: when }, once: true, do: [
      ["sentry", side, y, life], ["lie", "SENTRY"],
    ],
  });
  const batSwarm = (when, y = 6, dir = 1, n = 5) => ({
    if: { x: when }, once: true, do: [
      ["swarm", y, dir, n], ["lie", "SWARM"],
    ],
  });
  const mirrorGhost = (when, life = 2.4) => ({
    if: { x: when }, once: true, do: [
      ["phantom", life], ["lie", "NOT YOU"],
    ],
  });
  const stayLit = (when, dur = 2.2, r = 84) => ({
    if: { x: when }, once: true, do: [
      ["huntLight", dur, r], ["lie", "STAY LIT"],
    ],
  });
  const stompBot = (when, x, life = 2.0, floorY = 9) => ({
    if: { x: when }, once: true, do: [
      ["crushBot", x, life, floorY], ["lie", "STOMP"],
    ],
  });

  root.HAND_LEVELS = [
    {
      name: "TRUST ME",
      taunt: "THE FLOOR SAID BYE",
      sol: "R50 JR14 R40 JR14 R40 JR14 R60",
      map: [
        sky(), sky(), sky(), sky(), sky(), sky(), sky(), sky(),
        pad("S                             E"),
        pad("################################"),
        pad("################################"),
        pad("################################"),
      ],
      events: [
        jumpPunish(),
        fakeCrack(5.4, 10, 3),
        { if: { x: 9.6 }, once: true, delay: 0.18, do: [
          ["fill", 11, 9, 1, 1, "^"], ["sfx", "spike"],
          ["queue", 0.42, ["fill", 11, 9, 1, 1, "#"]],
        ]},
        sink(12.7, 14, 3, 0.24),
        hangSpikes(13, 12, 8),
        sneakSaw(14.8, -1, 8, 2.6, 0.75),
        { if: { x: 17.2 }, once: true, quiet: true, do: [
          ["queue", 9.5, ["saw", 32, 8, -2.6, 0]],
        ]},
        sink(19.5, 21, 2, 0.2),
        slice(21.6, 22),
        { if: { x: 24.1 }, once: true, delay: 0.16, do: [
          ["hole", 26, 9, 2, 1], ["spikes", 26, 10, 2], ["shake", 6], ["sfx", "crumble"],
          ["queue", 0.7, ["fill", 29, 9, 1, 1, "^"], ["sfx", "spike"]],
        ]},
      ],
    },
    {
      name: "KEEP JUMPING",
      taunt: "LANDING IS OPTIONAL",
      sol: "R18 JR14 R30 JR22 R30",
      map: [
        sky(), sky(), sky(), sky(), sky(), sky(), sky(), sky(),
        pad("S                            E"),
        pad("#####  ###    ====    #########"),
        pad("#####^^...    ^^^^    #########"),
        pad("################################"),
      ],
      events: [
        jumpPunish(),
        { if: { x: 9.1 }, once: true, delay: 0.16, do: [
          ["fill", 11, 8, 1, 1, "^"], ["sfx", "spike"],
        ]},
        sneakSaw(6.4, -1, 8, 2.4, 0.7),
        hangSpikes(14.5, 16, 6),
        sink(19.2, 22, 2, 0.2),
        { if: { x: 21.4 }, once: true, quiet: true, do: [
          ["glow", 18, 5, 5, 0.28],
          ["queue", 8.5, ["saw", 32, 8, -2.6, 0]],
        ]},
        flip(23.6, 0.3),
        { if: { x: 11.2 }, once: true, delay: 0.26, do: [["push", 0, -2.4]] },
        slice(17.4, 18),
        doorPop(26.8, 28, 0.14),
      ],
    },
    {
      name: "KNOCK KNOCK",
      taunt: "WRONG DOOR",
      sol: "R55 JR18 R50 JR18 R80 W40 L170 JL16 L50",
      map: [
        sky(), sky(), sky(), sky(), sky(),
        pad("E"),
        pad("####"),
        sky(),
        pad("S                            F"),
        pad("################################"),
        pad("################################"),
        pad("################################"),
      ],
      events: [
        { if: { jump: true, xLess: 4.2, air: true, before: 2.2 }, once: true, delay: 0.05, do: [
          ["fill", 1, 5, 16, 1, "v"], ["shake", 5], ["sfx", "spike"],
        ]},
        sink(7.3, 10, 2, 0.2),
        { if: { x: 12.5 }, once: true, delay: 0.2, do: [
          ["laser", 11, 7, 5, 0.22], ["sfx", "spike"], ["shake", 4],
        ]},
        slice(17.2, 18),
        sink(19.4, 22, 2, 0.18),
        { if: { door: "fake" }, once: true, delay: 0.12, do: [
          ["spikes", 15, 9, 4], ["shake", 12], ["sfx", "spike"],
          ["queue", 0.55, ["fill", 15, 9, 4, 1, "#"]],
          ["queue", 0.22, ["fill", 10, 9, 2, 1, "#"], ["fill", 10, 10, 2, 1, "#"], ["fill", 22, 9, 2, 1, "#"], ["fill", 22, 10, 2, 1, "#"]],
        ]},
        { if: { beenPast: 24, xLess: 16 }, once: true, delay: 0.45, do: [
          ["saw", 34, 8, -2.9, 0], ["sfx", "saw"],
        ]},
        { if: { beenPast: 24, xLess: 11 }, once: true, do: [
          ["fill", 1, 5, 11, 1, "."],
          ["fill", 0, 7, 12, 1, "."],
          ["fill", 12, 5, 8, 1, "v"],
          ["fill", 12, 7, 8, 1, "v"],
          ["sfx", "spike"],
          ["shake", 6],
        ]},
        { if: { beenPast: 24, xLess: 5.2, ground: true }, once: true, quiet: true, do: [
          ["dust", 5, 9, 2],
        ]},
        { if: { beenPast: 24, xLess: 3 }, once: true, quiet: true, do: [
          ["dust", 1, 9, 2], ["shake", 2],
        ]},
      ],
    },
    {
      name: "WAIT FOR IT",
      taunt: "PATIENCE, DEMON",
      sol: "W130 R90 JR20 R50 JR16 R40",
      map: [
        sky(), sky(), sky(), sky(), sky(), sky(), sky(),
        pad("vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv"),
        pad("S                            E"),
        pad("###!!!!!!!!!!!!!!!!!!!!!!!!#####"),
        pad("################################"),
        pad("################################"),
      ],
      events: [
        { if: { jump: true, before: 1.9 }, once: true, delay: 0.05, do: [
          ["fill", 0, 6, 16, 1, "v"], ["shake", 8], ["sfx", "spike"],
        ]},
        { if: { time: 1.9 }, once: true, do: [
          ["fill", 3, 9, 24, 1, "#"],
          ["fill", 0, 7, 32, 1, "."],
          ["sfx", "crumble"],
        ]},
        fakeCrack(8.2, 12, 3),
        sink(9.6, 12, 2, 0.26),
        sneakSaw(14.8, 32, 8, -2.4, 0.9),
        openEye(16.6, 18, 2, 2.6),
        slice(17.4, 18),
        flip(21.3, 0.28),
        sink(24.4, 26, 2, 0.2),
        risingFog(26.8, 1.55),
      ],
    },
    {
      name: "SHINY",
      taunt: "GREED IS A PIT",
      explodeCoins: true,
      sol: "R110 R40 JR14 R40 JR14 R50",
      map: [
        sky(), sky(), sky(), sky(), sky(), sky(),
        pad(".............C"),
        pad("...........C...C"),
        pad("S                             E"),
        pad("########iiiiiiiiiiiiiiiiii######"),
        pad("########^^^^^^^^^^^^^^^^^^......"),
        pad("################################"),
      ],
      events: [
        jumpPunish(10),
        { if: { x: 7.4 }, once: true, quiet: true, do: [
          ["queue", 9.5, ["saw", 32, 8, -2.5, 0]],
        ]},
        { if: { x: 10.6 }, once: true, delay: 0.3, do: [["push", 0.85, 0]] },
        hangSpikes(10, 8, 14),
        sneakSaw(17.8, 5, 8, 2.2, 0.7),
        sink(19.6, 22, 2, 0.22),
        callDrone(20.4, 21, 3, 2.8),
        slice(21.1, 21),
        flip(23.5, 0.28),
        doorPop(27.4, 29, 0.14),
      ],
    },
    {
      name: "BACKWARDS",
      taunt: "LEFT IS RIGHT NOW",
      sol: "R28 JR14 R21 JR18 R50 JR18 R60",
      map: [
        sky(),
        pad("######........................"),
        pad("######............######......"),
        sky(), sky(), sky(), sky(), sky(),
        pad("S                             E"),
        pad("################################"),
        pad("################################"),
        pad("################################"),
      ],
      events: [
        jumpPunish(),
        fakeCrack(4.8, 8, 3),
        sink(5.6, 8, 2, 0.2),
        { if: { x: 10.3 }, once: true, delay: 0.28, do: [
          ["reverse", true], ["flash", 0.05], ["sfx", "reverse"],
          ["queue", 0.55, ["reverse", false]],
        ]},
        iceSheet(14.2, 1.0),
        sneakSaw(13.2, 1, 8, 2.2, 0.65),
        hangSpikes(15.4, 16, 8),
        sink(17.4, 20, 2, 0.2),
        slice(21.3, 22),
        mirrorGhost(23.8, 2.0),
      ],
    },
    {
      name: "CHECKERED",
      taunt: "LOOKS SOLID",
      sol: "R26 JR14 R26 JR14 R26 JR14 R26 JR14 R26 JR14 R26 JR14 R26 JR14 R80",
      map: [
        sky(), sky(), sky(), sky(), sky(), sky(), sky(), sky(),
        pad("S                             E"),
        pad("####*###*###*###*###*###*#######"),
        pad(".....^^^...^^^...^^^...^^^^^^^^^"),
        pad("################################"),
      ],
      events: [
        jumpPunish(3.5, 3),
        fakeCrack(5.1),
        sneakSaw(5.8, -1, 8, 2.1, 0.7),
        { if: { x: 9.2 }, once: true, delay: 0.22, do: [
          ["hole", 11, 9, 1, 1], ["spikes", 11, 10, 1], ["sfx", "crumble"], ["shake", 5],
        ]},
        hangSpikes(11.5, 12, 8),
        ghostBeam(13.6, 14, 5, 4),
        // Jaws snap ahead of the player so a clean jump clears them.
        jawBite(14.8, 17, 9, 0.38),
        flip(18.3, 0.28),
        sink(26.2, 28, 1, 0.16),
        doorPop(23.6, 25, 0.14),
      ],
    },
    {
      name: "BUZZ",
      taunt: "IT LIKES YOU",
      sol: "R60 JR18 R25 JR18 R25 JR18 R40",
      map: [
        sky(), sky(), sky(), sky(), sky(), sky(), sky(), sky(),
        pad("S                          o  E"),
        pad("################################"),
        pad("################################"),
        pad("################################"),
      ],
      events: [
        jumpPunish(),
        sink(6.4, 9, 2, 0.2),
        { if: { x: 11.2 }, once: true, delay: 0.24, do: [
          ["reverse", true], ["sfx", "reverse"],
          ["queue", 0.45, ["reverse", false]],
        ]},
        sneakSaw(12.8, -1, 7, 2.0, 0.55),
        crushWeight(14.0, 1.45, 0.9),
        { if: { x: 15.1 }, once: true, delay: 0.55, do: [["chase", 0]] },
        // Blink a tile the player can hop — short so a jump clears it.
        phantomFloor(17.8, 20, 9, 1, 0.55),
        sink(19.3, 22, 2, 0.2),
        launchRocket(22.4, 1, 7, 2.3),
        doorPop(26.4, 28, 0.14),
      ],
    },
    {
      name: "YEET",
      taunt: "TOO MUCH BOUNCE",
      sol: "R80 JR18 R40 JR16 R40 JR16 R50",
      map: [
        sky(), sky(), sky(), sky(), sky(), sky(), sky(), sky(),
        pad("S                             E"),
        pad("##########B####..###############"),
        pad("##############^^################"),
        pad("################################"),
      ],
      events: [
        fakeCrack(6.5),
        jumpPunish(4.2, 3),
        { if: { x: 9.0 }, once: true, delay: 0.14, do: [
          ["fill", 11, 4, 3, 1, "v"], ["shake", 5], ["sfx", "spike"],
        ]},
        sneakSaw(11.2, -2, 8, 2.1, 0.7),
        slice(14.6, 14, 6, 5, 0.14),
        hangSpikes(16.2, 15, 7),
        ghostEcho(17.4, 0.7),
        { if: { x: 18.8 }, once: true, delay: 0.16, do: [
          ["fill", 20, 8, 1, 1, "^"], ["sfx", "spike"], ["shake", 4],
          ["queue", 0.55, ["fill", 20, 8, 1, 1, "."]],
        ]},
        batSwarm(23.2, 5, -1, 4),
        doorPop(27.2, 29, 0.12),
      ],
    },
    {
      name: "UP IS DOWN",
      taunt: "GRAVITY QUIT",
      sol: "R48 JR22 R100 JR8 R90",
      map: [
        pad("################################"),
        pad(".............................E"),
        pad("##..........................##"),
        sky(), sky(), sky(), sky(),
        pad("S"),
        pad("########..######################"),
        pad("########^^######################"),
        pad("################################"),
        pad("################################"),
      ],
      events: [
        { if: { jump: true, xLess: 3.5, air: true }, once: true, delay: 0.05, do: [
          ["saw", -1, 7, 2.2, 0], ["sfx", "saw"],
        ]},
        fakeCrack(6.2, 4, 2),
        { if: { x: 12.4 }, once: true, delay: 0.12, do: [
          ["gravity", -0.55], ["flash", 0.08], ["sfx", "reverse"],
        ]},
        ghostBeam(8.4, 6, 5, 4),
        { if: { x: 24.2 }, once: true, delay: 0.2, do: [
          ["saw", 33, 1, -0.85, 0], ["sfx", "saw"],
        ]},
        flip(16.2, 0.22),
        slice(18.5, 4, 4, 3, 0.2),
        { if: { x: 20.2 }, once: true, delay: 0.06, do: [
          ["fill", 22, 1, 2, 1, "v"], ["sfx", "spike"], ["shake", 4],
        ]},
        { if: { x: 23 }, once: true, quiet: true, do: [
          ["dust", 22, 2, 2], ["shake", 3],
        ]},
        lateSaw(9, -1, 1, 1.55),
      ],
    },
    {
      name: "COME BACK",
      taunt: "KEEP WALKING",
      sol: "W120 R50 JR18 R50 JR16 R60",
      map: [
        sky(), sky(), sky(), sky(), sky(), sky(), sky(), sky(),
        pad("S                     E"),
        pad("################################"),
        pad("################################"),
        pad("################################"),
      ],
      events: [
        jumpPunish(),
        sink(6.4, 9, 2, 0.2),
        { if: { x: 10.4 }, once: true, delay: 0.22, do: [["push", 0.85, 0]] },
        { if: { x: 13.2 }, once: true, delay: 0.18, do: [
          ["moveDoor", 29, 8], ["hole", 16, 9, 3, 1], ["spikes", 16, 10, 3],
          ["shake", 8], ["sfx", "crumble"],
        ]},
        pullBack(17.0, 10, 0.12, 0.65),
        sneakSaw(18.8, 10, 8, 2.75, 0.42),
        hungryFloor(21.2, 0.7),
        { if: { x: 23.1 }, once: true, delay: 0.2, do: [
          ["reverse", true], ["sfx", "reverse"],
          ["queue", 0.5, ["reverse", false]],
        ]},
        wakeStalker(23.8, 110, 2.2, 2.95),
        doorPop(27.2, 28, 0.14),
      ],
    },
    {
      name: "FALL IN",
      taunt: "THE HOLE IS KIND",
      sol: "R70 R40 R60",
      map: [
        sky(), sky(), sky(), sky(), sky(), sky(),
        pad("vvvvvvvvvvvvvvvvvvvv"),
        sky(),
        pad("S"),
        pad("################################"),
        pad("##########       E#############"),
        pad("##########iiiiiiii##############"),
        pad("##########^^^^^^^^##############"),
      ],
      events: [
        jumpPunish(10, 6),
        fakeCrack(5.8),
        { if: { x: 8.2 }, once: true, delay: 0.16, do: [
          ["hole", 10, 9, 6, 1], ["shake", 8], ["sfx", "crumble"],
        ]},
        hangSpikes(10, 8, 16, 6),
        sneakSaw(11.2, 2, 8, 2.25, 0.36),
        flip(15.3, 0.32),
        { if: { x: 13.4 }, once: true, delay: 0.2, do: [
          ["laser", 20, 8, 3, 0.16], ["sfx", "spike"],
        ]},
        { if: { x: 17.2 }, once: true, delay: 0.18, do: [
          ["fill", 19, 10, 1, 1, "^"], ["sfx", "spike"],
        ]},
        { if: { time: 3.4, xLess: 9 }, once: true, delay: 0.2, do: [
          ["saw", -1, 8, 2.85, 0],
        ]},
        launchRocket(7.2, 1, 7, 2.2),
      ],
    },
    {
      name: "DON'T STOP",
      taunt: "STANDING IS DYING",
      crumbleIfStill: 0.4,
      sol: "R45 JR16 R20 R80 JR18 R30",
      map: [
        sky(), sky(), sky(), sky(), sky(), sky(), sky(), sky(),
        pad("S                             E"),
        pad("################################"),
        pad("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^"),
        pad("################################"),
      ],
      events: [
        jumpPunish(),
        { if: { x: 5.6, vxLess: 0.55, ground: true }, once: true, delay: 0.06, do: [
          ["hole", 6, 9, 2, 1], ["spikes", 6, 10, 2], ["sfx", "crumble"],
        ]},
        sink(6.5, 9, 2, 0.18),
        sneakSaw(11.2, -1, 8, 2.95, 0.32),
        tarPad(12.4, 0.35),
        { if: { x: 13.4 }, once: true, delay: 0.16, do: [["push", 1.45, 0]] },
        { if: { x: 15.2 }, once: true, delay: 0.22, do: [
          ["reverse", true], ["sfx", "reverse"],
          ["queue", 0.5, ["reverse", false]],
        ]},
        stayLit(17.6, 1.85, 92),
        sink(22.4, 24, 2, 0.16),
        doorPop(26.4, 28, 0.12),
      ],
    },
    {
      name: "PSYCH",
      taunt: "THE LONG WAY BACK",
      sol: "W30 R70 JR12 R50 JR12 R60",
      map: [
        pad("vvvvvv......................"),
        sky(),
        pad("................######"),
        sky(), sky(),
        pad("E"),
        pad("##########"),
        sky(),
        pad("S                            F"),
        pad("################################"),
        pad("################################"),
        pad("################################"),
      ],
      events: [
        jumpPunish(),
        sink(8.3, 11, 2, 0.2),
        { if: { x: 13.4 }, once: true, delay: 0.2, do: [
          ["laser", 12, 7, 5, 0.22], ["sfx", "spike"], ["shake", 4],
        ]},
        ghostBeam(17.8, 18, 5, 5),
        slice(18.6, 19),
        sink(20.2, 22, 2, 0.18),
        { if: { door: "fake" }, once: true, delay: 0.12, do: [
          ["spikes", 14, 9, 4], ["shake", 12], ["sfx", "spike"],
          ["queue", 0.55, ["fill", 14, 9, 4, 1, "#"]],
          ["queue", 0.22, ["fill", 11, 9, 2, 1, "#"], ["fill", 11, 10, 2, 1, "#"], ["fill", 22, 9, 2, 1, "#"], ["fill", 22, 10, 2, 1, "#"]],
        ]},
        { if: { beenPast: 24, xLess: 16 }, once: true, delay: 0.45, do: [
          ["saw", 34, 8, -2.9, 0], ["sfx", "saw"],
        ]},
        { if: { beenPast: 24, xLess: 14 }, once: true, do: [
          ["blackout", 1.15], ["sfx", "glitch"], ["lie", "BLIND"],
        ]},
        { if: { beenPast: 24, xLess: 7 }, once: true, delay: 0.1, do: [
          ["fill", 0, 7, 5, 1, "v"],
          ["sfx", "spike"],
          ["queue", 0.28,
            ["fill", 0, 7, 5, 1, "."],
            ["fill", 2, 5, 12, 1, "."],
            ["fill", 4, 8, 2, 1, "#"],
            ["moveDoor", 4, 8],
            ["shake", 8],
            ["sfx", "crumble"],
          ],
        ]},
      ],
    },
    {
      name: "THROUGH",
      taunt: "WALLS ARE A RUMOR",
      sol: "R100 R40 JR12 R40 JR12 R50",
      map: [
        sky(), sky(), sky(), sky(), sky(), sky(), sky(), sky(),
        pad("S         **********          E"),
        pad("################################"),
        pad("##########^^^^^^^^^^############"),
        pad("################################"),
      ],
      events: [
        jumpPunish(),
        fakeCrack(7.2),
        hangSpikes(9.5, 10, 10),
        sneakSaw(10.2, 2, 8, 2.55, 0.4),
        blindSpot(12.8, 1.1),
        slice(14.1, 14),
        wallSentry(18.4, 1, 7, 2.1),
        sink(19.3, 22, 2, 0.2),
        { if: { x: 24.2 }, once: true, delay: 0.22, do: [
          ["reverse", true], ["sfx", "reverse"],
          ["queue", 0.45, ["reverse", false]],
        ]},
        doorPop(27.4, 29, 0.14),
      ],
    },
    {
      name: "LAST LAUGH",
      taunt: "THE LEVEL WINS",
      explodeCoins: true,
      sol: "R55 JR18 R50 JR18 R80 W40 L160 W55 L30",
      map: [
        sky(), sky(),
        pad("......C.................C....."),
        sky(), sky(),
        pad("E"),
        pad("####"),
        sky(),
        pad("S      *                      F"),
        pad("################################"),
        pad("################################"),
        pad("################################"),
      ],
      events: [
        jumpPunish(7),
        fakeCrack(5.3, 8, 3),
        sink(7.3, 10, 2, 0.2),
        { if: { x: 12.8 }, once: true, delay: 0.2, do: [
          ["laser", 11, 7, 5, 0.22], ["sfx", "spike"], ["shake", 4],
        ]},
        slice(17.2, 18),
        sink(19.4, 22, 2, 0.18),
        { if: { door: "fake" }, once: true, delay: 0.12, do: [
          ["spikes", 15, 9, 4], ["shake", 12], ["sfx", "spike"],
          ["queue", 0.55, ["fill", 15, 9, 4, 1, "#"]],
          ["queue", 0.22, ["fill", 10, 9, 2, 1, "#"], ["fill", 10, 10, 2, 1, "#"], ["fill", 22, 9, 2, 1, "#"], ["fill", 22, 10, 2, 1, "#"]],
        ]},
        { if: { beenPast: 24, xLess: 16 }, once: true, delay: 0.45, do: [
          ["saw", 34, 8, -2.9, 0], ["sfx", "saw"],
        ]},
        { if: { beenPast: 24, xLess: 13 }, once: true, do: [
          ["crushBot", 10, 2.0, 9], ["sfx", "near"], ["lie", "STOMP"],
        ]},
        { if: { beenPast: 24, xLess: 7 }, once: true, delay: 0.1, do: [
          ["fill", 0, 7, 5, 1, "v"],
          ["sfx", "spike"],
          ["queue", 0.28,
            ["fill", 0, 7, 5, 1, "."],
            ["fill", 2, 5, 10, 1, "."],
            ["fill", 4, 8, 2, 1, "#"],
            ["moveDoor", 4, 8],
            ["shake", 8],
            ["sfx", "crumble"],
          ],
        ]},
      ],
    },
  ];
  root.LEVELS = root.HAND_LEVELS;
})(typeof window !== "undefined" ? window : globalThis);
