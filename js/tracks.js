/**
 * 20 dimension soundtracks — each is a different STYLE engine, not a retune.
 * game.js dispatches playStep by track.style; shared drum/pad skeletons are gone.
 */
(function (root) {
  const TRACKS = [
    {
      // 1 NULLSCAPE — cold ambient void (almost no drums)
      id: "voidPulse",
      style: "voidAmbient",
      prog: [[0, 7, 12], [5, 12, 17], [3, 10, 15], [7, 14, 19]],
      scale: [0, 2, 3, 5, 7, 8, 10],
      motif: [0, 7, 12, 7, 3, 10, 15, 10],
    },
    {
      // 2 ASHWELL — industrial foundry (metal noise + stomps)
      id: "emberForge",
      style: "industrial",
      prog: [[0, 1, 6], [0, 3, 6], [1, 6, 7], [0, 6, 11]],
      scale: [0, 1, 3, 6, 7],
      motif: [0, 0, 1, 3, 0, 6, 3, 1],
    },
    {
      // 3 FROSTBITE — 3/4 waltz of ice bells
      id: "frostWaltz",
      style: "waltz",
      prog: [[0, 3, 7, 12], [8, 12, 15], [5, 8, 12], [3, 7, 10]],
      scale: [0, 2, 3, 5, 7, 9, 10],
      motif: [7, 5, 3, 2, 0, 2, 5, 7],
    },
    {
      // 4 BLOOMVOID — psychedelic spore drift (no kick, swirling pad)
      id: "sporeBloom",
      style: "psychedelic",
      prog: [[0, 4, 7, 11], [2, 6, 9, 14], [5, 9, 12, 16], [4, 7, 11, 14]],
      scale: [0, 2, 4, 6, 7, 9, 11],
      motif: [0, 4, 6, 9, 7, 4, 2, 6],
    },
    {
      // 5 IRON CLOCK — clockwork techno + tick
      id: "ironClock",
      style: "techno",
      prog: [[0, 4, 7], [0, 5, 7], [2, 5, 9], [5, 7, 11]],
      scale: [0, 2, 4, 5, 7, 9, 11],
      motif: [0, 2, 4, 5, 7, 5, 4, 2],
    },
    {
      // 6 TOXIC GUT — swamp dub / reggae skank
      id: "toxicDub",
      style: "dub",
      prog: [[0, 3, 7, 10], [0, 5, 7, 10], [3, 7, 10], [5, 8, 12]],
      scale: [0, 3, 5, 7, 10],
      motif: [0, 3, 5, 7, 5, 3, 0, 5],
    },
    {
      // 7 MIRROR SEA — liquid reverse-wave ambient
      id: "mirrorTide",
      style: "liquid",
      prog: [[0, 5, 7, 12], [2, 7, 9, 14], [5, 9, 12], [7, 12, 14]],
      scale: [0, 2, 4, 5, 7, 9, 11],
      motif: [12, 9, 7, 5, 4, 2, 0, 4],
    },
    {
      // 8 CINDER RAIL — train gallop + whistle
      id: "cinderRail",
      style: "train",
      prog: [[0, 3, 7], [0, 3, 6], [5, 8, 12], [7, 10, 14]],
      scale: [0, 3, 5, 7, 10],
      motif: [7, 10, 12, 10, 7, 5, 3, 0],
    },
    {
      // 9 STATIC GOD — broken glitch / signal noise
      id: "staticGod",
      style: "glitch",
      prog: [[0, 1, 6], [0, 6, 7], [1, 4, 7], [2, 5, 8]],
      scale: [0, 1, 4, 6, 7, 10],
      motif: [0, 6, 1, 7, 4, 10, 0, 1],
    },
    {
      // 10 BONE ORBIT — ritual hollow drums + fifths
      id: "boneOrbit",
      style: "ritual",
      prog: [[0, 7, 12], [0, 5, 12], [2, 7, 14], [0, 7, 17]],
      scale: [0, 2, 3, 5, 7, 10],
      motif: [0, 0, 7, 0, 5, 7, 12, 7],
    },
    {
      // 11 DEEP GLASS — crystal chimes only (no kick/bass)
      id: "deepGlass",
      style: "crystal",
      prog: [[0, 4, 7, 11], [5, 9, 12, 16], [7, 11, 14], [2, 5, 9]],
      scale: [0, 2, 4, 6, 7, 9, 11],
      motif: [11, 9, 7, 4, 2, 4, 7, 9],
    },
    {
      // 12 HUNGER MOON — horror music-box lullaby
      id: "hungerLullaby",
      style: "lullaby",
      prog: [[0, 3, 6], [1, 4, 7], [3, 6, 10], [0, 3, 8]],
      scale: [0, 1, 3, 4, 7, 8],
      motif: [0, 1, 0, 3, 1, 0, 4, 3, 0, 1, 3, 8],
    },
    {
      // 13 VIOLET WIRE — acid 303 line + dry kick
      id: "violetAcid",
      style: "acid",
      prog: [[0, 3, 7], [0, 5, 7], [1, 5, 8], [3, 7, 10]],
      scale: [0, 1, 3, 5, 7, 8, 10],
      motif: [0, 1, 3, 5, 7, 8, 10, 8, 7, 5, 3, 1, 0, 3, 5, 7],
    },
    {
      // 14 SALT CATHEDRAL — sacred organ, no groove
      id: "saltChoir",
      style: "organ",
      prog: [[0, 7, 12, 16], [5, 12, 17, 21], [3, 10, 15, 19], [7, 14, 19, 24]],
      scale: [0, 2, 4, 5, 7, 9, 11],
      motif: [0, 4, 7, 12, 7, 4, 0, 7],
    },
    {
      // 15 REDSHIFT — jungle / breakbeat storm
      id: "redBreak",
      style: "jungle",
      prog: [[0, 3, 7], [0, 3, 6], [5, 8, 11], [7, 10, 14]],
      scale: [0, 1, 3, 5, 7, 8, 10],
      motif: [0, 3, 5, 7, 10, 7, 5, 3],
    },
    {
      // 16 GHOSTGRID — NES chiptune square melody
      id: "ghostChip",
      style: "chip",
      prog: [[0, 4, 7], [5, 9, 12], [3, 7, 10], [7, 11, 14]],
      scale: [0, 2, 4, 5, 7, 9, 11],
      motif: [0, 2, 4, 5, 7, 5, 4, 2, 0, 4, 7, 9, 7, 4, 2, 0],
    },
    {
      // 17 NIGHT NEEDLE — near-silence + sparse needles
      id: "nightNeedle",
      style: "needle",
      prog: [[0, 7], [1, 8], [3, 10], [5, 12]],
      scale: [0, 1, 3, 5, 7, 8, 10],
      motif: [24, 19, 27, 15, 22, 12, 19, 8],
    },
    {
      // 18 SOLAR GRAVE — bright doom power-chords
      id: "solarGrave",
      style: "doom",
      prog: [[0, 7, 12], [0, 5, 10], [3, 7, 12], [5, 10, 15]],
      scale: [0, 2, 3, 5, 7, 8, 10],
      motif: [0, 0, 3, 0, 5, 3, 0, 7],
    },
    {
      // 19 THE FOLD — 7/8 recursive odd meter
      id: "theFold",
      style: "fold",
      prog: [[0, 3, 7], [2, 5, 9], [5, 8, 12], [3, 7, 10]],
      scale: [0, 2, 3, 5, 7, 8, 10],
      motif: [0, 2, 3, 5, 7, 5, 3, 2, 0, 3, 5, 7, 10, 7],
    },
    {
      // 20 LAST LIGHT — marching fanfare ascent
      id: "lastLight",
      style: "fanfare",
      prog: [[0, 4, 7, 11], [5, 9, 12], [7, 11, 14], [0, 5, 7, 12]],
      scale: [0, 2, 4, 5, 7, 9, 11],
      motif: [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0, 7],
    },
  ];

  // One fight theme per boss. Bed picks a different arrangement engine so fights
  // don't all share the same rush skeleton — only tempo/key.
  const BOSSES = [
    { bed: "rush", bpm: 174, root: 196, wave: "square", kick: [0, 4, 8, 12], hat: 2, bassStep: 2, bass: [0, 0, 3, 0, 7, 0, 10, 7], lead: [0, 3, 7, 10, 12, 10, 7, 3] },
    { bed: "stomp", bpm: 148, root: 82, wave: "sawtooth", kick: [0, 6, 8, 14], hat: 4, bassStep: 2, bass: [0, 0, -2, 0, 5, 3, 0, -2], lead: [0, -2, 3, 5, 3, 0, 7, 5] },
    { bed: "glass", bpm: 126, root: 233, wave: "sine", kick: [0, 6, 10], hat: 0, bassStep: 4, bass: [0, 3, 7, 3], lead: [12, 14, 15, 19, 15, 14] },
    { bed: "drip", bpm: 96, root: 155, wave: "triangle", kick: [0, 3, 8, 11], hat: 3, bassStep: 2, bass: [0, 2, 5, 7, 5, 2], lead: [7, 9, 12, 9, 5, 4, 2, 0] },
    { bed: "grind", bpm: 188, root: 110, wave: "square", kick: [0, 2, 4, 6, 8, 10, 12, 14], hat: 1, bassStep: 2, bass: [0, 0, 1, 0, 6, 6, 1, 0], lead: [0, 1, 6, 1, 0, 6, 8, 6] },
    { bed: "crawl", bpm: 88, root: 73, wave: "sine", kick: [0, 8], hat: 8, bassStep: 4, bass: [0, -5, 2, -2], lead: [0, 2, -1, 5, 2, -5] },
    { bed: "pulse", bpm: 160, root: 246, wave: "triangle", kick: [2, 6, 10, 14], hat: 2, bassStep: 2, bass: [7, 0, 7, 3, 10, 7, 3, 0], lead: [12, 7, 15, 10, 19, 12, 7, 15] },
    { bed: "rail", bpm: 168, root: 98, wave: "sawtooth", kick: [0, 3, 4, 8, 11, 12], hat: 2, bassStep: 2, bass: [0, 0, 5, 7, 5, 0, 10, 7], lead: [0, 5, 7, 12, 10, 7, 5, 0] },
    { bed: "needle", bpm: 192, root: 261, wave: "square", kick: [0, 1, 4, 7, 8, 11, 13], hat: 1, bassStep: 1, bass: [0, 1, 0, 6, 0, 1, 7, 6], lead: [12, 13, 18, 13, 12, 6, 13, 18] },
    { bed: "choir", bpm: 66, root: 65, wave: "sine", kick: [0], hat: 0, bassStep: 8, bass: [0, -5], lead: [0, 3, 7, 12, 7, 3] },
    { bed: "glass", bpm: 118, root: 311, wave: "triangle", kick: [0, 8], hat: 2, bassStep: 4, bass: [0, 7, 11, 7], lead: [12, 16, 19, 24, 19, 16, 12, 7] },
    { bed: "drip", bpm: 60, root: 55, wave: "sawtooth", kick: [0, 10], hat: 0, bassStep: 4, bass: [0, 1, -1, 5], lead: [-12, 0, 1, 5, 1, 0] },
    { bed: "needle", bpm: 154, root: 185, wave: "square", kick: [0, 4, 7, 8, 12], hat: 1, bassStep: 1, bass: [0, 3, 7, 10, 7, 3, 0, 10], lead: [12, 15, 19, 22, 19, 15, 12, 10] },
    { bed: "choir", bpm: 76, root: 87, wave: "sine", kick: [0, 8], hat: 0, bassStep: 4, bass: [0, 5, 7, 12], lead: [0, 4, 7, 12, 16, 12, 7, 4] },
    { bed: "rush", bpm: 204, root: 146, wave: "sawtooth", kick: [0, 2, 4, 6, 8, 10, 12, 14], hat: 1, bassStep: 2, bass: [0, 1, 0, 6, 7, 6, 1, 0], lead: [12, 13, 18, 19, 18, 13, 12, 6] },
    { bed: "crawl", bpm: 104, root: 174, wave: "triangle", kick: [4, 12], hat: 4, bassStep: 4, bass: [0, 7, 3, 10], lead: [12, 15, 7, 19, 15, 12, 7, 3] },
    { bed: "stomp", bpm: 80, root: 130, wave: "sine", kick: [0, 12], hat: 0, bassStep: 8, bass: [0, 7], lead: [24, 19, 16, 12, 16, 19] },
    { bed: "pulse", bpm: 142, root: 207, wave: "square", kick: [0, 4, 6, 8, 12, 14], hat: 2, bassStep: 2, bass: [0, 4, 7, 11, 7, 4, 0, 11], lead: [0, 4, 7, 12, 16, 12, 7, 4] },
    { bed: "grind", bpm: 136, root: 103, wave: "triangle", kick: [0, 3, 6, 10, 13], hat: 3, bassStep: 2, bass: [0, 1, 5, 6, 10, 6, 5, 1], lead: [0, 5, 6, 10, 13, 10, 6, 5] },
    { bed: "final", bpm: 92, root: 49, wave: "sine", kick: [0, 8], hat: 0, bassStep: 4, bass: [0, 5, 7, 12, 7, 5], lead: [0, 7, 12, 16, 19, 16, 12, 7] },
  ];

  function musicFor(d) {
    const i = Math.max(0, Math.min(TRACKS.length - 1, (d || 1) - 1));
    return TRACKS[i];
  }

  function bossMusic(d) {
    const i = Math.max(0, Math.min(BOSSES.length - 1, (d || 1) - 1));
    return BOSSES[i];
  }

  function chordsFor(rootHz, d) {
    const tr = musicFor(d || 1);
    return tr.prog.map((intervals) => intervals.map((st) => rootHz * Math.pow(2, st / 12)));
  }

  root.SURGE_TRACKS = { TRACKS, BOSSES, musicFor, bossMusic, chordsFor, count: TRACKS.length };
})(typeof window !== "undefined" ? window : globalThis);
