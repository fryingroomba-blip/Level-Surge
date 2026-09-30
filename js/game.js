(() => {
  const TILE = 32;
  let VIEW_W = 960;
  let VIEW_H = 540;
  const FIXED = 1 / 60;
  const ACTIONS = new Set([
    "hole", "fill", "spikes", "clearRowHazards", "shake", "say", "sfx",
    "reverse", "gravity", "moveDoor", "chase", "saw", "queue",
    "teleport", "push", "lock", "laser", "wind", "platform", "drop",
    "hideDoor", "showDoor", "swapDoor", "slow",
    "dust", "flash", "whisper", "glow", "lie",
  ]);

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    VIEW_W = Math.max(640, Math.floor(rect.width * dpr));
    VIEW_H = Math.max(360, Math.floor(rect.height * dpr));
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
  }
  fitCanvas();
  window.addEventListener("resize", fitCanvas);

  const hud = document.getElementById("hud");
  const titleScreen = document.getElementById("title-screen");
  const clearScreen = document.getElementById("clear-screen");
  const winScreen = document.getElementById("win-screen");
  const pauseScreen = document.getElementById("pause-screen");
  const levelsScreen = document.getElementById("levels-screen");
  const toastEl = document.getElementById("toast");
  const levelNumEl = document.getElementById("level-num");
  const levelNameEl = document.getElementById("level-name");
  const deathsEl = document.getElementById("deaths");
  const trapCountEl = document.getElementById("trap-count");
  const timerEl = document.getElementById("timer");
  const comboHud = document.getElementById("combo-hud");
  const muteBtn = document.getElementById("mute-btn");
  const pauseBtn = document.getElementById("pause-btn");
  const mobile = document.getElementById("mobile");

  const keys = new Set();
  const hold = { left: false, right: false, jump: false, dash: false };
  const dimNameEl = document.getElementById("dim-name");
  const pipsEl = document.getElementById("room-pips");
  const shardHud = document.getElementById("shard-hud");
  const dimCard = document.getElementById("dim-card");
  const dashBtn = document.getElementById("btn-dash");

  const audio = {
    ctx: null,
    muted: false,
    unlocked: false,
    master: null,
    drone: null,
    musicId: 0,
    beat: 0,
    musicGain: null,
    lastKick: 0,
    _nextNote: 0,
    _step: 0,
    theme: { bpm: 128, root: 92.5, dim: 1 },
    unlock() {
      if (this.unlocked) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.32;
      this.musicComp = this.ctx.createDynamicsCompressor();
      this.musicComp.threshold.value = -16;
      this.musicComp.knee.value = 10;
      this.musicComp.ratio.value = 3.6;
      this.musicComp.attack.value = 0.004;
      this.musicComp.release.value = 0.16;
      this.musicGain.connect(this.musicComp);
      this.musicComp.connect(this.master);
      this.unlocked = true;
      if (this.ctx.state === "suspended") this.ctx.resume();
      this.ambience();
      this.music();
    },
    dest() { return this.master || this.ctx.destination; },
    beep(freq, dur, type, vol, slide) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
      g.gain.setValueAtTime(vol || 0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.dest());
      o.start(t);
      o.stop(t + dur);
    },
    noise(dur, vol, freq) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const n = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
      const d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = this.ctx.createBufferSource();
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = freq || 900;
      s.buffer = n;
      g.gain.setValueAtTime(vol || 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(f);
      f.connect(g);
      g.connect(this.dest());
      s.start(t);
    },
    ambience() {
      if (!this.ctx || this.drone) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const o2 = this.ctx.createOscillator();
      const g2 = this.ctx.createGain();
      o.type = "sine";
      o.frequency.value = 38;
      g.gain.value = 0.014;
      o2.type = "triangle";
      o2.frequency.value = 76;
      g2.gain.value = 0.008;
      o.connect(g);
      g.connect(this.dest());
      o2.connect(g2);
      g2.connect(this.dest());
      o.start();
      o2.start();
      this.drone = { o, g, o2, g2 };
    },
    setMuted(on) {
      this.muted = on;
      if (this.drone) {
        this.drone.g.gain.value = on ? 0 : 0.014;
        if (this.drone.g2) this.drone.g2.gain.value = on ? 0 : 0.008;
      }
      if (this.musicGain && this.ctx) {
        this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.musicGain.gain.setTargetAtTime(on ? 0 : 0.32, this.ctx.currentTime, 0.04);
      }
    },
    voice(freq, t, dur, type, vol, slide) {
      if (!this.ctx || !this.musicGain) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(Math.max(20, freq), t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(this.musicGain);
      o.start(t);
      o.stop(t + dur + 0.03);
    },
    noiseHit(t, dur, vol, freq) {
      if (!this.ctx || !this.musicGain) return;
      const n = this.ctx.createBuffer(1, Math.max(1, this.ctx.sampleRate * dur), this.ctx.sampleRate);
      const d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = this.ctx.createBufferSource();
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = freq || 1200;
      s.buffer = n;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f);
      f.connect(g);
      g.connect(this.musicGain);
      s.start(t);
    },
    setTheme(d) {
      const pack = window.SURGE_WORLDS;
      const th = pack ? pack.theme(d) : null;
      this.theme = {
        bpm: th ? th.bpm : 128,
        root: th ? th.root : 92.5,
        dim: d || 1,
      };
    },
    restartMusic() {
      if (this.musicId) clearTimeout(this.musicId);
      this._musicOn = false;
      this._step = 0;
      if (this.unlocked && this.ctx) this.music();
    },
    playStep(step, t) {
      const LOOP_BARS = 96;
      const bar = Math.floor(step / 16) % LOOP_BARS;
      const s = step % 16;
      const heat = Math.min(1, (world.trapsFired || 0) / 8);
      const pack = window.SURGE_WORLDS;
      const rootHz = (this.theme && this.theme.root) || 92.5;
      const chords = pack && pack.chordsFor
        ? pack.chordsFor(rootHz)
        : [
          [92.50, 110.00, 138.59, 185.00],
          [73.42, 92.50, 110.00, 146.83],
          [110.00, 138.59, 164.81, 220.00],
          [82.41, 103.83, 123.47, 164.81],
        ];
      const ch = chords[bar % 4];
      const tune = rootHz / 92.5;
      const intro = bar < 8;
      const groove = bar >= 8 && bar < 16;
      const build1 = bar >= 16 && bar < 32;
      const dropA = bar >= 32 && bar < 48;
      const brk = bar >= 48 && bar < 56;
      const build2 = bar >= 56 && bar < 64;
      const dropB = bar >= 64 && bar < 80;
      const cool = bar >= 80 && bar < 88;
      const thin = bar >= 88 && bar < 92;
      const outro = bar >= 92;
      const drop = dropA || dropB;
      const body = groove || build1 || drop || build2 || cool;
      const sparseKick = intro || outro || thin || brk;
      const kickHits = drop || build2
        ? (dropB || heat > 0.45 ? [0, 4, 6, 8, 12] : [0, 4, 8, 12])
        : build1 || cool ? [0, 8]
        : sparseKick ? ((bar % 2 === 0) ? [0] : [])
        : [0, 8];
      if (kickHits.indexOf(s) !== -1) {
        this.voice(175, t, 0.22, "sine", 0.5, 34);
        this.voice(68, t, 0.09, "sine", 0.24);
        this.voice(980, t, 0.016, "square", 0.045, 180);
        this.lastKick = t;
      }
      if (body && (s === 4 || s === 12)) {
        this.noiseHit(t, 0.15, 0.2, 1500);
        this.voice(210, t, 0.09, "triangle", 0.11, 85);
      }
      if ((body || (brk && s % 4 === 0)) && s % 2 === 0 && !thin && !outro) {
        this.noiseHit(t, 0.028, s % 4 === 0 ? 0.05 : 0.03, 7200);
      }
      if (drop && s % 2 === 1) this.noiseHit(t, 0.016, dropB ? 0.028 : 0.02, 9800);
      if (s === 0 || (drop && (s === 6 || s === 10)) || (build1 && s === 8)) {
        this.voice(ch[0] / 2, t, drop ? 0.26 : 0.42, "sine", intro || outro ? 0.16 : 0.22);
      }
      if (drop && [0, 3, 6, 8, 11, 14].indexOf(s) !== -1) {
        this.voice(ch[0], t, 0.15, "triangle", 0.13, ch[0] * 0.96);
        this.voice(ch[0] * 2, t, 0.09, "sine", 0.045);
      }
      if (s === 0) {
        this.voice(ch[0], t, 1.9, "sine", intro || outro ? 0.058 : 0.05);
        this.voice(ch[2], t, 1.9, "sine", 0.034);
        this.voice(ch[1] * 2, t, 1.9, "triangle", 0.022);
        this.voice(ch[3], t, 1.9, "sine", 0.016);
      }
      if (drop || (build1 && bar >= 24) || (build2 && bar >= 60) || (cool && bar < 84)) {
        const arp = [ch[0] * 2, ch[1] * 2, ch[2] * 2, ch[3] * 2, ch[2] * 2, ch[1] * 2, ch[2] * 2, ch[0] * 4];
        this.voice(arp[s % 8], t, 0.09, "triangle", cool ? 0.035 : 0.055);
        if (dropB || heat > 0.25) this.voice(arp[s % 8] * 2, t, 0.055, "sine", 0.022);
      } else if ((groove || brk) && s % 4 === 0) {
        this.voice(ch[(s / 4) % 4] * 2, t, 0.14, "triangle", 0.04);
      }
      if (dropA && s % 2 === 0) {
        const lead = [369.99, 440.00, 554.37, 493.88, 440.00, 415.30, 440.00, 329.63];
        const f = lead[(s / 2) % 8] * tune;
        this.voice(f, t, 0.24, "sawtooth", 0.058);
        this.voice(f * 1.006, t, 0.24, "sawtooth", 0.032);
      }
      if (dropB && s % 2 === 0) {
        const lead = [554.37, 659.25, 739.99, 659.25, 587.33, 554.37, 493.88, 440.00];
        const f = lead[(s / 2) % 8] * tune;
        this.voice(f, t, 0.22, "sawtooth", 0.062);
        this.voice(f * 1.007, t, 0.22, "sawtooth", 0.034);
        this.voice(f * 0.5, t, 0.18, "triangle", 0.02);
      }
      if ((bar === 30 || bar === 31 || bar === 62 || bar === 63) && s >= 8) {
        const rise = s - 8;
        this.noiseHit(t, 0.1, 0.02 + rise * 0.012, 420);
        this.voice(180 + rise * 48, t, 0.12, "sawtooth", 0.03, 720);
      }
      if (s === 0 && (bar === 32 || bar === 64)) this.noiseHit(t, 0.35, 0.12, 280);
      if (bar === 95 && s >= 12) {
        this.voice(rootHz, t, 0.45, "sine", 0.04);
        this.voice(rootHz * 1.49831, t, 0.45, "sine", 0.024);
      }
    },
    music() {
      if (!this.ctx || this._musicOn) return;
      this._musicOn = true;
      this._nextNote = this.ctx.currentTime + 0.08;
      this._step = 0;
      const LOOP = 96 * 16;
      const root = this;
      const tick = () => {
        root.musicId = setTimeout(tick, 25);
        if (!root.ctx) return;
        if (root.muted) {
          root._nextNote = root.ctx.currentTime + 0.08;
          return;
        }
        if (mode !== "play" && mode !== "title" && mode !== "pause" && mode !== "levels") return;
        const now = root.ctx.currentTime;
        const bpm = (root.theme && root.theme.bpm) || 128;
        const sixteenth = 60 / bpm / 4;
        let guard = 0;
        while (root._nextNote < now + 0.16 && guard++ < 12) {
          root.playStep(root._step, root._nextNote);
          root._nextNote += sixteenth;
          root._step = (root._step + 1) % LOOP;
        }
      };
      tick();
    },
    play(name) {
      if (name === "jump") { this.beep(420, 0.09, "square", 0.05, 720); this.beep(210, 0.07, "triangle", 0.03); }
      if (name === "land") { this.beep(160, 0.05, "triangle", 0.04); this.noise(0.04, 0.05, 600); }
      if (name === "die") { this.noise(0.32, 0.2, 700); this.beep(240, 0.38, "sawtooth", 0.09, 42); this.beep(90, 0.4, "triangle", 0.05); }
      if (name === "win") { this.beep(523, 0.1, "square", 0.07); setTimeout(() => this.beep(659, 0.1, "square", 0.07), 80); setTimeout(() => this.beep(784, 0.22, "square", 0.08), 160); setTimeout(() => this.beep(1046, 0.28, "triangle", 0.05), 280); }
      if (name === "crumble") this.noise(0.2, 0.16, 500);
      if (name === "spike") this.beep(150, 0.16, "sawtooth", 0.08, 60);
      if (name === "saw") { this.beep(80, 0.22, "sawtooth", 0.07, 200); this.noise(0.12, 0.08, 300); }
      if (name === "reverse") { this.beep(300, 0.1, "triangle", 0.06, 140); this.beep(160, 0.14, "triangle", 0.05); }
      if (name === "coin") this.beep(880, 0.08, "square", 0.05, 1200);
      if (name === "trap") { this.beep(196, 0.07, "square", 0.05); this.beep(392, 0.1, "triangle", 0.04, 220); }
      if (name === "combo") { this.beep(660, 0.06, "square", 0.045); this.beep(990, 0.1, "triangle", 0.035, 1320); }
      if (name === "near") { this.beep(1400, 0.04, "sine", 0.03); this.noise(0.05, 0.04, 1800); }
      if (name === "pause") this.beep(220, 0.08, "triangle", 0.04);
      if (name === "fanfare") {
        this.beep(523, 0.1, "square", 0.07);
        setTimeout(() => this.beep(659, 0.1, "square", 0.07), 90);
        setTimeout(() => this.beep(784, 0.16, "square", 0.08), 180);
        setTimeout(() => this.beep(392, 0.35, "sawtooth", 0.07, 70), 420);
      }
      if (name === "laugh") {
        this.beep(220, 0.1, "square", 0.06, 360);
        setTimeout(() => this.beep(180, 0.1, "square", 0.06, 300), 120);
        setTimeout(() => this.beep(260, 0.16, "sawtooth", 0.05, 90), 240);
      }
      if (name === "fail") {
        this.beep(196, 0.18, "sawtooth", 0.08, 80);
        this.beep(98, 0.32, "triangle", 0.06);
        this.noise(0.2, 0.1, 400);
      }
      if (name === "trombone") {
        this.beep(246, 0.28, "sawtooth", 0.07, 140);
        setTimeout(() => this.beep(185, 0.45, "sawtooth", 0.07, 90), 260);
      }
      if (name === "slot") {
        this.beep(440, 0.05, "square", 0.04);
        setTimeout(() => this.beep(440, 0.05, "square", 0.04), 80);
        setTimeout(() => this.beep(440, 0.05, "square", 0.04), 160);
        setTimeout(() => this.beep(220, 0.2, "triangle", 0.05), 400);
      }
      if (name === "glitch") {
        this.noise(0.18, 0.14, 2200);
        this.beep(80, 0.12, "square", 0.05, 600);
        this.beep(900, 0.08, "square", 0.03, 100);
      }
      if (name === "type") {
        this.beep(880, 0.03, "square", 0.03);
        setTimeout(() => this.beep(720, 0.03, "square", 0.025), 70);
      }
      if (name === "tick") this.beep(1200, 0.03, "sine", 0.03);
      if (name === "dash") { this.noise(0.08, 0.1, 1400); this.beep(280, 0.12, "sawtooth", 0.05, 90); }
      if (name === "stinger") {
        this.beep(392, 0.12, "square", 0.07);
        setTimeout(() => this.beep(523, 0.12, "square", 0.07), 90);
        setTimeout(() => this.beep(784, 0.28, "triangle", 0.08), 180);
      }
      if (name === "shard") { this.beep(1320, 0.07, "sine", 0.05, 1760); this.beep(880, 0.1, "triangle", 0.03); }
    },
  };

  let mode = "title";
  let levelIndex = 0;
  let deaths = 0;
  let startedAt = 0;
  let acc = 0;
  let last = 0;
  let deathTimer = 0;
  let deathShow = null;
  let hitstop = 0;
  let lockTimer = 0;
  let slowmo = 1;
  let testMode = false;
  let botIx = 0;
  let botJump = false;
  let useBot = false;
  let combo = 0;
  let comboTimer = 0;
  let nearCool = 0;
  let introT = 0;
  let dimIntro = 0;
  let runTraps = 0;
  let dimIndex = 1;
  let shardsGot = 0;
  let deathGhost = null;
  let dashCool = 0;
  let dashT = 0;
  let nearFlare = 0;
  const camFX = { punch: 0, phase: 0 };
  const SAVE_KEY = "level-surge-v3";

  function loadSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") || {}; }
    catch (_) { return {}; }
  }
  function writeSave(patch) {
    const next = Object.assign(loadSave(), patch);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(next)); } catch (_) { /* ignore quota */ }
    return next;
  }
  function currentTheme() {
    const pack = window.SURGE_WORLDS;
    const cycling = (mode === "title" || mode === "levels") && dimIntro <= 0;
    const d = cycling ? 1 + Math.floor(performance.now() / 9000) % 20 : dimIndex;
    return pack ? pack.theme(d) : {
      name: "NULLSCAPE", lore: "", weather: "shards", bpm: 128, root: 92.5,
      sky: ["#0b1018", "#07090f", "#04050a"],
      planet: ["#ffffff", "#7b93bc", "#1b2433"],
      needle: "#101624", edge: "rgba(160,190,230,0.22)",
      accent: [210, 225, 255], mul: "rgba(70,90,120,0.45)",
      brick: ["#4a4038", "#cfc1aa"],
    };
  }

  function unlockLevel(i) {
    const s = loadSave();
    const rooms = Object.assign({}, s.rooms || {});
    rooms[dimIndex] = Math.max(rooms[dimIndex] || 0, i);
    writeSave({
      rooms,
      lastDim: dimIndex,
      lastRoom: i,
      unlockedDim: Math.max(s.unlockedDim || 1, dimIndex),
      unlocked: Math.max(s.unlocked || 0, i),
    });
  }

  function enterDimension(d, from) {
    dimIndex = Math.max(1, Math.min(20, d | 0));
    const pack = window.SURGE_WORLDS;
    if (pack) window.LEVELS = pack.generate(dimIndex);
    audio.setTheme(dimIndex);
    audio.restartMusic();
    shardsGot = 0;
    deathGhost = null;
    dimIntro = testMode ? 0 : 2.4;
    const th = pack ? pack.theme(dimIndex) : currentTheme();
    if (dimCard) {
      const numEl = document.getElementById("dim-card-num");
      const nameEl = document.getElementById("dim-card-name");
      const loreEl = document.getElementById("dim-card-lore");
      if (numEl) numEl.textContent = `DIMENSION ${dimIndex}`;
      if (nameEl) nameEl.textContent = th.name;
      if (loreEl) loreEl.textContent = th.lore || "";
      dimCard.classList.remove("hidden");
    }
    if (dashBtn) dashBtn.classList.toggle("hidden", dimIndex < 3);
    startGame(typeof from === "number" ? from : 0);
  }

  const world = {
    cols: 32, rows: 12, tiles: [],
    spawn: { x: 32, y: 200 },
    door: null, fakeDoor: null, doorHidden: false,
    saws: [], coins: [], particles: [], afterimages: [], lasers: [], platforms: [], drops: [],
    blood: [],
    events: [], queued: [], rules: {},
    time: 0, reverse: false, gravity: 0.55,
    shake: 0, flash: 0, jumped: false, maxX: 0, still: 0,
    taunt: "", name: "", doorOpened: false, trapsFired: 0,
    deathReason: "", squash: 0, wind: 0, chromatic: 0,
    jumps: 0, hudGlitch: 0, hudText: "",
  };

  const player = {
    x: 0, y: 0, w: 24, h: 28,
    vx: 0, vy: 0, onGround: false, facing: 1,
    dead: false, win: false, coyote: 0, buffer: 0,
    jumpHeld: false, anim: 0, bounceLock: 0, justLanded: false,
  };

  function padRow(s, cols) {
    if (s.length < cols) return s + ".".repeat(cols - s.length);
    return s.slice(0, cols);
  }

  function resetWorldExtras() {
    world.saws = [];
    world.coins = [];
    world.particles = [];
    world.afterimages = [];
    world.lasers = [];
    world.platforms = [];
    world.drops = [];
    world.queued = [];
    world.door = null;
    world.fakeDoor = null;
    world.doorHidden = false;
    world.doorOpened = false;
    world.trapsFired = 0;
    world.wind = 0;
    world.jumps = 0;
    world.hudGlitch = 0;
    world.hudText = "";
    world.blood = [];
    world.chromatic = 0;
    lockTimer = 0;
    slowmo = 1;
    deathShow = null;
  }

  function loadLevel(i) {
    const def = window.LEVELS[i];
    if (!def) throw new Error("Missing level " + i);
    const rows = def.map.map((r) => r);
    const cols = Math.max(...rows.map((r) => r.length));
    world.cols = cols;
    world.rows = rows.length;
    world.tiles = rows.map((r) => padRow(r.replace(/ /g, "."), cols).split(""));
    world.events = (def.events || []).map((e) => ({ ...e, fired: false }));
    world.rules = def;
    world.time = 0;
    world.reverse = !!def.reverse;
    world.gravity = def.gravity || 0.55;
    world.shake = 0;
    world.flash = 0;
    world.jumped = false;
    world.maxX = 0;
    world.still = 0;
    world.taunt = def.taunt || "NICE TRY";
    world.name = def.name;
    world.deathReason = "";
    world.squash = 0;
    resetWorldExtras();
    deathTimer = 0;

    for (let y = 0; y < world.rows; y++) {
      for (let x = 0; x < world.cols; x++) {
        const t = world.tiles[y][x];
        if (t === "S") {
          world.spawn = { x: x * TILE + 6, y: y * TILE + TILE - player.h };
          world.tiles[y][x] = ".";
        } else if (t === "E") {
          world.door = { x: x * TILE, y: y * TILE, fake: false };
        } else if (t === "F") {
          world.fakeDoor = { x: x * TILE, y: y * TILE, fake: true };
        } else if (t === "o") {
          world.saws.push({ x: x * TILE + 16, y: y * TILE + 16, vx: 0, vy: 0, chase: false, spin: 0 });
          world.tiles[y][x] = ".";
        } else if (t === "C") {
          world.coins.push({ x: x * TILE + 16, y: y * TILE + 16, dead: false });
          world.tiles[y][x] = ".";
        }
      }
    }
    spawnPlayer();
    if (toastEl) {
      toastEl.classList.remove("show", "whisper", "death");
      toastEl.textContent = "";
    }
    if (levelNumEl) levelNumEl.textContent = `${i + 1} / ${window.LEVELS.length}`;
    if (levelNameEl) levelNameEl.textContent = def.name;
    if (dimNameEl) {
      const th = currentTheme();
      dimNameEl.textContent = `D${dimIndex} ${th.name}`;
    }
    updatePips();
    if (deathsEl) deathsEl.textContent = `☠ ${deaths}`;
    introT = testMode ? 0 : 1.05;
    combo = 0;
    comboTimer = 0;
    if (!testMode) unlockLevel(i);
    updateHud();
    updateComboHud();
  }

  function updateHud() {
    if (trapCountEl) {
      if (world.hudText) {
        trapCountEl.textContent = world.hudText;
      } else if (world.hudGlitch > 0) {
        const glyphs = ["?", "¿", "!", "#", "0", "7", "/", "X"];
        let s = "";
        for (let i = 0; i < 4; i++) s += glyphs[(Math.random() * glyphs.length) | 0];
        trapCountEl.textContent = s;
      } else {
        trapCountEl.textContent = "????";
      }
    }
    if (timerEl) timerEl.textContent = world.time.toFixed(1);
    if (deathsEl) deathsEl.textContent = `☠ ${deaths}`;
    if (shardHud) {
      if (shardsGot > 0) {
        shardHud.classList.remove("hidden");
        shardHud.textContent = `✦ ${shardsGot}`;
      } else {
        shardHud.classList.add("hidden");
      }
    }
  }

  function updatePips() {
    if (!pipsEl || !window.LEVELS) return;
    pipsEl.innerHTML = "";
    const n = window.LEVELS.length;
    for (let i = 0; i < n; i++) {
      const d = document.createElement("i");
      if (i < levelIndex) d.className = "done";
      else if (i === levelIndex) d.className = "now";
      pipsEl.appendChild(d);
    }
  }

  function updateComboHud() {
    if (!comboHud) return;
    if (combo < 2 || player.dead) {
      comboHud.classList.add("hidden");
      return;
    }
    comboHud.classList.remove("hidden");
    comboHud.textContent = combo >= 10 ? "SURGE x79437924" : `SURGE x${combo}`;
    comboHud.style.animation = "none";
    void comboHud.offsetWidth;
    comboHud.style.animation = "";
  }

  function spawnPlayer() {
    player.x = world.spawn.x;
    player.y = world.spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.dead = false;
    player.win = false;
    player.onGround = false;
    player.coyote = 0;
    player.buffer = 0;
    player.bounceLock = 0;
    player.jumpHeld = false;
    player.justLanded = false;
    dashCool = 0;
    dashT = 0;
    world.still = 0;
    world.squash = 0;
  }

  function tileAt(px, py) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= world.cols || ty >= world.rows) return "#";
    return world.tiles[ty][tx];
  }

  function isSolid(t) {
    return t === "#" || t === "=" || t === "B" || t === "i" || t === "!";
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * speed;
      world.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 2,
        life: 0.4 + Math.random() * 0.55,
        color,
        size: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.4,
        kind: Math.random() < 0.45 ? "spark" : "square",
      });
    }
    if (world.particles.length > 220) world.particles.splice(0, world.particles.length - 220);
  }

  function dust(x, y, n) {
    for (let i = 0; i < n; i++) {
      world.particles.push({
        x: x + (Math.random() - 0.5) * 12,
        y,
        vx: (Math.random() - 0.5) * 2.2,
        vy: -Math.random() * 1.4,
        life: 0.25 + Math.random() * 0.25,
        color: "#c4b8a8",
        size: 2 + Math.random() * 2,
      });
    }
  }

  function say(text) {
    if (!player.dead || !toastEl || !text) return;
    toastEl.textContent = text;
    toastEl.classList.remove("whisper");
    toastEl.classList.add("show", "death");
    clearTimeout(say._t);
  }

  function whisper() {}

  const INSULTS = {
    spike: [
      "YOU SAW THE SPIKES",
      "THOSE WERE NOT DECORATION",
      "YOU WALKED ON PURPOSE",
      "FEET 1  ·  BRAIN 0",
      "SKILL ISSUE: THE FLOOR",
    ],
    ceiling: [
      "THAT JUMP WAS OPTIONAL",
      "THE CEILING WAS A HINT",
      "YOU JUMPED INTO THAT",
      "GRAVITY WAS HELPING",
      "UP WAS A BAD IDEA",
    ],
    jumpspike: [
      "YOU AIMED AT THE SPIKES",
      "THAT LANDING. WOW.",
      "THE FLOOR WAS SPIKES",
      "PARKOUR GRADE: SEE ME",
    ],
    saw: [
      "IT WAS SPINNING AT YOU",
      "THE SAW WAS NOT A HUG",
      "YOU WALKED INTO A BLADE",
      "IT SPINS. YOU DON'T.",
      "ROUND. SHARP. OBVIOUS.",
    ],
    laser: [
      "THE RED LINE WAS A HINT",
      "GLOWING MEANS DON'T",
      "YOU TOUCHED THE OBVIOUS",
      "LASERS ARE NOT A DARE",
    ],
    hole: [
      "THERE WAS NO FLOOR",
      "YOU FELL IN THE OBVIOUS",
      "AIR IS NOT A PLATFORM",
      "THE GAP WAS THE HINT",
      "HOLES GO DOWN. YOU TOO.",
    ],
    jumpfall: [
      "YOU JUMPED INTO NOTHING",
      "THAT JUMP HAD NO LANDING",
      "THE GAP WAS A GAP",
      "AIR TIME IS NOT A PLAN",
    ],
    teeth: [
      "YOU TRUSTED THE FAKE FLOOR",
      "IT LOOKED SOLID. IT LIED.",
      "YOU FOUND THE TEETH",
      "THE FLOOR FOOLED YOU",
    ],
    greed: [
      "YOU TOOK THE BAIT",
      "SHINY WON. YOU DIDN'T.",
      "THE COINS WERE THE TRAP",
      "GREED SPEEDRUN: SUCCESS",
    ],
    brick: [
      "A BRICK OUTPLAYED YOU",
      "HEAD VS BRICK. BRICK.",
      "YOU STOOD UNDER THAT",
      "THE BRICK HAD TIMING",
    ],
    fake: [
      "YOU BELIEVED THE FAKE",
      "WRONG DOOR. COME ON.",
      "THE OTHER ONE WAS REAL",
      "THAT DOOR WAS LYING",
    ],
    reverse: [
      "LEFT WAS RIGHT. MISS THAT?",
      "YOU DIDN'T NOTICE THE FLIP",
      "YOU WALKED THE WRONG WAY",
      "BACKWARDS. STILL WRONG.",
    ],
    still: [
      "STANDING IS NOT A PLAN",
      "THE LEVEL ASKED YOU TO MOVE",
      "AFK WAS THE TRAP",
      "MOSS ON YOUR SKILL",
    ],
    jump: [
      "YOU DIDN'T NEED TO JUMP",
      "WALKING WAS LEGAL",
      "THAT JUMP WAS THE TRAP",
      "THE GROUND WAS RIGHT THERE",
    ],
    generic: [
      "THAT WAS ON YOU",
      "SKILL ISSUE",
      "THE LEVEL ISN'T THE PROBLEM",
      "YES. THAT. AGAIN.",
      "TRY LOOKING NEXT TIME",
    ],
  };

  function pickInsult(kind) {
    const list = INSULTS[kind] || INSULTS.generic;
    return list[(deaths + (world.jumps || 0)) % list.length];
  }

  function deathKind(cause) {
    const midX = player.x + player.w / 2;
    const head = tileAt(midX, player.y + 4);
    const chest = tileAt(midX, player.y + player.h * 0.45);
    const feet = tileAt(midX, player.y + player.h - 3);
    const under = tileAt(midX, player.y + player.h + 1);
    const air = !player.onGround;
    const falling = player.vy * Math.sign(world.gravity || 1) > 1.2;
    const hz = (cause && "^v<>".includes(cause) ? cause : "") || head || chest || feet;
    if (cause === "TEST" || cause === "TEST2") return "generic";
    if (world.doorOpened === "fake") return "fake";
    if (cause === "SAW SAID HI") return "saw";
    if (cause === "BEAM") return "laser";
    if (cause === "GREED") return "greed";
    if (cause === "BRICK") return "brick";
    if (cause === "HIDDEN TEETH" || under === "!") return "teeth";
    if (cause === "VOID") {
      if (world.jumped && air) return "jumpfall";
      return "hole";
    }
    if (hz === "v" || head === "v") return "ceiling";
    if (hz === "<" || hz === ">") return "spike";
    if (hz === "^" || feet === "^" || under === "^") {
      if (air || falling) return "jumpspike";
      return "spike";
    }
    if (world.reverse) return "reverse";
    if ((world.still || 0) > 0.18) return "still";
    if (air && world.jumped) return "jump";
    if (!isSolid(under) && falling) return "hole";
    return "generic";
  }

  function deathCopy(cause) {
    if (cause === "TEST" || cause === "TEST2") return cause;
    return pickInsult(deathKind(cause));
  }

  function fxTiles(x, y, w, h, ch) {
    const hazard = ch === "^" || ch === "v" || ch === "<" || ch === ">";
    const color = hazard ? "#ff4a4a" : "#c4b8a8";
    const n = hazard ? 9 : 6;
    for (let yy = 0; yy < (h || 1); yy++) {
      for (let xx = 0; xx < (w || 1); xx++) {
        burst((x + xx) * TILE + 16, (y + yy) * TILE + 10, color, n, hazard ? 3.4 : 2.6);
      }
    }
  }

  function setTiles(x, y, w, h, ch) {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (yy >= 0 && yy < world.rows && xx >= 0 && xx < world.cols) {
          world.tiles[yy][xx] = ch;
        }
      }
    }
  }

  function runAction(a) {
    if (!a || !a.length) return;
    const type = a[0];
    if (!ACTIONS.has(type)) throw new Error("Unknown action " + type);
    if (type === "hole") {
      fxTiles(a[1], a[2], a[3], a[4], ".");
      setTiles(a[1], a[2], a[3], a[4], ".");
    }
    if (type === "fill") {
      if (a[5] === "^" || a[5] === "v" || a[5] === "." || a[5] === "<" || a[5] === ">") {
        fxTiles(a[1], a[2], a[3], a[4], a[5]);
      }
      setTiles(a[1], a[2], a[3], a[4], a[5]);
    }
    if (type === "spikes") {
      fxTiles(a[1], a[2], a[3], 1, "^");
      setTiles(a[1], a[2], a[3], 1, "^");
    }
    if (type === "clearRowHazards") {
      const y = a[1];
      for (let x = 0; x < world.cols; x++) {
        if ("^v<>".includes(world.tiles[y][x])) world.tiles[y][x] = ".";
      }
    }
    if (type === "shake") world.shake = a[1];
    if (type === "say") say(a[1]);
    if (type === "sfx") audio.play(a[1]);
    if (type === "reverse") world.reverse = a[1];
    if (type === "gravity") world.gravity = a[1];
    if (type === "moveDoor" && world.door) {
      world.door.x = a[1] * TILE;
      world.door.y = a[2] * TILE;
    }
    if (type === "chase") {
      const saw = world.saws[a[1]];
      if (saw) { saw.chase = true; saw.vx = -2.6; }
    }
    if (type === "saw") {
      world.saws.push({ x: a[1] * TILE + 16, y: a[2] * TILE + 16, vx: a[3] || 0, vy: a[4] || 0, chase: false, spin: 0 });
    }
    if (type === "queue") {
      world.queued.push({ at: world.time + a[1], do: a.slice(2) });
    }
    if (type === "teleport") {
      player.x = a[1] * TILE + 4;
      player.y = a[2] * TILE + TILE - player.h;
      player.vx = 0;
      player.vy = 0;
      burst(player.x + 12, player.y + 14, "#ff4a4a", 12, 4);
    }
    if (type === "push") {
      player.vx += a[1] || 0;
      player.vy += a[2] || 0;
    }
    if (type === "lock") lockTimer = a[1] || 0.4;
    if (type === "laser") {
      world.lasers.push({
        x: a[1] * TILE, y: a[2] * TILE + 12,
        w: (a[3] || 4) * TILE, h: 6, life: a[4] || 0.4, fake: false,
      });
      world.flash = 0.06;
    }
    if (type === "glow") {
      world.lasers.push({
        x: a[1] * TILE, y: a[2] * TILE + 12,
        w: (a[3] || 4) * TILE, h: 6, life: a[4] || 0.2, fake: true,
      });
    }
    if (type === "dust") fxTiles(a[1], a[2], a[3] || 1, a[4] || 1, ".");
    if (type === "flash") world.flash = a[1] || 0.08;
    if (type === "whisper") whisper(a[1]);
    if (type === "lie") world.hudText = a[1] || "????";
    if (type === "wind") world.wind = a[1] || 0;
    if (type === "platform") {
      world.platforms.push({
        x: a[1] * TILE, y: a[2] * TILE, w: (a[3] || 2) * TILE, h: 10,
        vx: a[4] || 1.2, min: a[5] * TILE, max: a[6] * TILE,
      });
    }
    if (type === "drop") {
      world.drops.push({ x: a[1] * TILE, y: a[2] * TILE, w: TILE, h: TILE, vy: 0 });
    }
    if (type === "hideDoor") world.doorHidden = true;
    if (type === "showDoor") world.doorHidden = false;
    if (type === "swapDoor" && world.door && world.fakeDoor) {
      const t = { x: world.door.x, y: world.door.y };
      world.door.x = world.fakeDoor.x; world.door.y = world.fakeDoor.y;
      world.fakeDoor.x = t.x; world.fakeDoor.y = t.y;
    }
    if (type === "slow") slowmo = a[1] || 0.45;
  }

  function matchEvent(ev) {
    const c = ev.if || {};
    if (c.x != null && player.x / TILE < c.x) return false;
    if (c.beenPast != null && world.maxX / TILE < c.beenPast) return false;
    if (c.xLess != null && player.x / TILE >= c.xLess) return false;
    if (c.time != null && world.time < c.time) return false;
    if (c.jump && !world.jumped) return false;
    if (c.before != null && world.time >= c.before) return false;
    if (c.jumpAfter != null) {
      if (!world.jumped || player.x / TILE < c.jumpAfter) return false;
    }
    if (c.door === "fake") return world.doorOpened === "fake";
    if (c.y != null && player.y / TILE < c.y) return false;
    if (c.land && !player.justLanded) return false;
    if (c.still != null && world.still < c.still) return false;
    if (c.air && player.onGround) return false;
    if (c.ground && !player.onGround) return false;
    if (c.falling && !(player.vy * Math.sign(world.gravity || 1) > 1.2)) return false;
    if (c.jumps != null && (world.jumps || 0) < c.jumps) return false;
    if (c.vxMin != null && Math.abs(player.vx) < c.vxMin) return false;
    if (c.vxLess != null && Math.abs(player.vx) >= c.vxLess) return false;
    if (c.zone) {
      const [zx, zy, zw, zh] = c.zone;
      if (!rectsOverlap(player, { x: zx * TILE, y: zy * TILE, w: zw * TILE, h: zh * TILE })) return false;
    }
    return true;
  }

  function triggerTrap(ev) {
    if (!ev.quiet) {
      world.trapsFired += 1;
      world.hudGlitch = 0.34;
      world.hudText = "";
      if (!player.dead && !player.win) {
        combo += 1;
        comboTimer = 2.4;
        runTraps += 1;
        camFX.punch = Math.max(camFX.punch, 5);
      }
    }
    for (const a of ev.do) runAction(a);
  }

  function tickEvents() {
    for (const ev of world.events) {
      if (ev.fired && ev.once !== false) continue;
      if (ev.armed != null) {
        if (world.time >= ev.armed) {
          ev.fired = true;
          triggerTrap(ev);
        }
        continue;
      }
      if (ev.hold) {
        if (matchEvent(ev)) ev.held = (ev.held || 0) + FIXED;
        else ev.held = 0;
        if ((ev.held || 0) < ev.hold) continue;
      } else if (!matchEvent(ev)) {
        continue;
      }
      if (ev.delay) {
        ev.armed = world.time + ev.delay;
        continue;
      }
      ev.fired = true;
      triggerTrap(ev);
    }
    for (const q of world.queued) {
      if (q.done || world.time < q.at) continue;
      q.done = true;
      for (const a of q.do) runAction(a);
    }
  }

  function crumbleUnderPlayer() {
    if (!player.onGround) return;
    const feet = [
      [player.x + 2, player.y + player.h + 1],
      [player.x + player.w - 2, player.y + player.h + 1],
    ];
    for (const [px, py] of feet) {
      const tx = Math.floor(px / TILE);
      const ty = Math.floor(py / TILE);
      if (ty >= 0 && ty < world.rows && tx >= 0 && tx < world.cols && world.tiles[ty][tx] === "=") {
        world.tiles[ty][tx] = ".";
        burst(tx * TILE + 16, ty * TILE + 8, "#c4b8a8", 8, 3);
        audio.play("crumble");
        world.shake = 5;
      }
    }
  }

  function stillCrumble() {
    const lim = world.rules.crumbleIfStill;
    if (!lim || !player.onGround || player.dead) return;
    if (Math.abs(player.vx) > 0.4) {
      world.still = 0;
      return;
    }
    world.still += FIXED;
    if (world.still > lim) {
      const tx = Math.floor((player.x + player.w / 2) / TILE);
      const ty = Math.floor((player.y + player.h + 1) / TILE);
      if (ty >= 0 && ty < world.rows && tx >= 0 && tx < world.cols && isSolid(world.tiles[ty][tx])) {
        world.tiles[ty][tx] = ".";
        burst(tx * TILE + 16, ty * TILE + 8, "#c4b8a8", 10, 3.5);
        audio.play("crumble");
        world.shake = 6;
        world.still = 0;
      }
    }
  }

  function moveAxis(dx, dy) {
    if (dx) {
      player.x += dx;
      const dir = Math.sign(dx);
      const edge = dir > 0 ? player.x + player.w : player.x;
      const samples = [player.y + 2, player.y + player.h / 2, player.y + player.h - 2];
      for (const sy of samples) {
        if (isSolid(tileAt(edge, sy))) {
          const tx = Math.floor(edge / TILE);
          player.x = dir > 0 ? tx * TILE - player.w : (tx + 1) * TILE;
          player.vx = 0;
          break;
        }
      }
    }
    if (dy) {
      player.y += dy;
      const dir = Math.sign(dy);
      const edge = dir > 0 ? player.y + player.h : player.y;
      const samples = [player.x + 2, player.x + player.w / 2, player.x + player.w - 2];
      let hit = false;
      for (const sx of samples) {
        if (isSolid(tileAt(sx, edge))) {
          const ty = Math.floor(edge / TILE);
          player.y = dir > 0 ? ty * TILE - player.h : (ty + 1) * TILE;
          if (dir * Math.sign(world.gravity) > 0) {
            if (!player.onGround) {
              audio.play("land");
              player.justLanded = true;
              world.squash = 0.22;
              camFX.punch = Math.max(camFX.punch, 3.5);
              dust(player.x + player.w / 2, player.y + player.h, 6);
            }
            player.onGround = true;
            player.coyote = 0.09;
          }
          player.vy = 0;
          hit = true;
          break;
        }
      }
      if (!hit && dir * Math.sign(world.gravity) > 0) player.onGround = false;
    }
  }

  function die(msg) {
    if (player.dead || player.win) return;
    player.dead = true;
    deaths += 1;
    deathGhost = { x: player.x, y: player.y, facing: player.facing };
    world.deathReason = deathCopy(msg);
    world.flash = 0.22;
    world.shake = 18;
    world.chromatic = 0.4;
    camFX.punch = 14;
    hitstop = testMode ? 0 : 0.09;
    combo = 0;
    comboTimer = 0;
    burst(player.x + player.w / 2, player.y + player.h / 2, "#e31b1b", 36, 7);
    burst(player.x + player.w / 2, player.y + 4, "#3a2010", 10, 3.4);
    burst(player.x + player.w / 2, player.y + player.h / 2, "#ffd24a", 8, 5);
    for (let i = 0; i < 10; i++) {
      world.blood.push({
        x: player.x + Math.random() * player.w,
        y: player.y + 8 + Math.random() * (player.h - 4),
        s: 3 + Math.random() * 11,
        a: 0.32 + Math.random() * 0.4,
      });
    }
    audio.play("die");
    updateHud();
    updateComboHud();
    if (testMode) return;
    startDeathRoast(deathKind(msg));
  }

  function roastApi() {
    return {
      FIXED, TILE, VIEW_W, VIEW_H,
      player, world, deaths,
      burst, dust,
      drawDevilBody, drawSpikePair, drawBrickFace, drawSaw, drawSkullMark, drawDoorShell,
      audio,
    };
  }

  function startDeathRoast(kind) {
    if (toastEl) {
      toastEl.classList.remove("show", "whisper", "death");
      toastEl.textContent = "";
    }
    let saw = world.saws[0] || { x: player.x + player.w / 2, y: player.y + player.h / 2 };
    let best = 1e12;
    for (const sw of world.saws) {
      const dx = sw.x - (player.x + player.w / 2);
      const dy = sw.y - (player.y + player.h / 2);
      const d = dx * dx + dy * dy;
      if (d < best) { best = d; saw = sw; }
    }
    const roast = window.DeathRoast;
    if (!roast) {
      say(world.deathReason);
      deathTimer = 1.12;
      return;
    }
    deathShow = roast.start(kind, {
      x: player.x,
      y: player.y,
      facing: player.facing,
      squash: world.squash,
      insult: world.deathReason,
      levelName: world.name,
      taunt: world.taunt,
      seed: (deaths * 17 + (player.x | 0) + levelIndex * 31 + kind.length * 9) >>> 0,
      sawX: saw.x,
      sawY: saw.y,
    });
    deathTimer = roast.DURATION;
  }

  function surgeRating(d, secs) {
    const raw = 79437924 * Math.max(1, 90 - d) * Math.max(1, 260 - secs);
    return raw.toLocaleString("en-US");
  }

  function winLevel() {
    if (player.win || player.dead) return;
    player.win = true;
    burst(player.x + 12, player.y + 10, "#f0c14b", 28, 5);
    burst(player.x + 12, player.y + 10, "#fff6d8", 12, 3);
    audio.play("win");
    if (!testMode) audio.play("stinger");
    if (testMode) return;
    mode = "clear";
    document.getElementById("clear-name").textContent = world.name;
    const clearStats = document.getElementById("clear-stats");
    if (clearStats) {
      clearStats.textContent = `${world.time.toFixed(1)}s · ☠ ${deaths} · SURGE x${Math.max(1, combo)}`;
    }
    clearScreen.classList.remove("hidden");
  }

  function nextLevel() {
    clearScreen.classList.add("hidden");
    levelIndex += 1;
    if (levelIndex >= window.LEVELS.length) {
      mode = "win";
      const secs = Math.round((performance.now() - startedAt) / 1000);
      const rating = surgeRating(deaths, secs);
      const prev = loadSave();
      const rec = Object.assign({}, prev.dimRecords || {});
      const cur = rec[dimIndex] || {};
      rec[dimIndex] = {
        bestDeaths: cur.bestDeaths == null ? deaths : Math.min(cur.bestDeaths, deaths),
        bestTime: cur.bestTime == null ? secs : Math.min(cur.bestTime, secs),
        shards: Math.max(cur.shards || 0, shardsGot),
      };
      const bestDeaths = rec[dimIndex].bestDeaths;
      const bestTime = rec[dimIndex].bestTime;
      const newBest = cur.bestDeaths == null || deaths < cur.bestDeaths || secs < (cur.bestTime || 1e9);
      const nextDim = Math.min(20, dimIndex + 1);
      writeSave({
        bestDeaths: prev.bestDeaths == null ? deaths : Math.min(prev.bestDeaths, deaths),
        bestTime: prev.bestTime == null ? secs : Math.min(prev.bestTime, secs),
        runs: (prev.runs || 0) + 1,
        clears: (prev.clears || 0) + 1,
        dimRecords: rec,
        unlockedDim: Math.max(prev.unlockedDim || 1, nextDim),
        lastDim: dimIndex >= 20 ? 20 : nextDim,
        lastRoom: 0,
        unlocked: window.LEVELS.length - 1,
      });
      const ratingEl = document.getElementById("win-rating");
      if (ratingEl) ratingEl.textContent = `SURGE RATING ${rating}×`;
      const th = window.SURGE_WORLDS ? window.SURGE_WORLDS.theme(dimIndex) : { name: "NULLSCAPE" };
      document.getElementById("win-stats").textContent =
        `${th.name} cleared · ${deaths} deaths · ${secs}s · ${runTraps} traps survived`;
      const bestEl = document.getElementById("win-best");
      if (bestEl) {
        bestEl.textContent = newBest
          ? `NEW BEST · ${bestDeaths} deaths · ${bestTime}s`
          : `best ${bestDeaths} deaths · ${bestTime}s`;
      }
      const nextBtn = document.getElementById("next-dim-btn");
      const againBtn = document.getElementById("again-btn");
      if (nextBtn) {
        if (dimIndex >= 20) {
          nextBtn.classList.add("hidden");
          if (againBtn) againBtn.textContent = "PLAY AGAIN";
        } else {
          nextBtn.classList.remove("hidden");
          nextBtn.textContent = `DIMENSION ${nextDim}`;
          if (againBtn) againBtn.textContent = "REPLAY WORLD";
        }
      }
      winScreen.classList.remove("hidden");
      hud.classList.add("hidden");
      return;
    }
    mode = "play";
    loadLevel(levelIndex);
  }

  function hazardAt(px, py) {
    const t = tileAt(px, py);
    return "^v<>".includes(t) ? t : "";
  }

  function tickPlayer() {
    if (player.dead || player.win) return;
    player.justLanded = false;

    let ix = 0;
    let jumpDown = false;
    if (useBot) {
      ix = botIx;
      jumpDown = botJump;
    } else {
      if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A") || hold.left) ix -= 1;
      if (keys.has("ArrowRight") || keys.has("d") || keys.has("D") || hold.right) ix += 1;
      jumpDown = keys.has(" ") || keys.has("ArrowUp") || keys.has("w") || keys.has("W") || hold.jump;
    }
    if (lockTimer > 0) { ix = 0; jumpDown = false; lockTimer -= FIXED; }

    if (world.reverse) ix *= -1;
    if (ix) player.facing = ix;
    const accel = player.onGround ? 0.9 : 0.58;
    if (ix) player.vx += ix * accel;
    else player.vx *= player.onGround ? 0.7 : 0.94;
    player.vx += world.wind;

    dashCool = Math.max(0, dashCool - FIXED);
    dashT = Math.max(0, dashT - FIXED);
    const wantDash = keys.has("Shift") || hold.dash;
    if (dimIndex >= 3 && wantDash && dashCool <= 0 && !player.dead) {
      const dir = ix || player.facing || 1;
      player.vx = dir * 9.2;
      player.vy *= 0.35;
      dashCool = 0.72;
      dashT = 0.16;
      audio.play("dash");
      burst(player.x + player.w / 2, player.y + player.h / 2, "#ffe8a0", 10, 4);
      camFX.punch = Math.max(camFX.punch, 6);
    }
    const cap = dashT > 0 ? 10 : 4.5;
    player.vx = Math.max(-cap, Math.min(cap, player.vx));

    if (jumpDown && !player.jumpHeld) player.buffer = 0.1;
    player.jumpHeld = jumpDown;
    if (player.onGround) player.coyote = 0.09;
    else player.coyote -= FIXED;
    player.buffer -= FIXED;
    player.bounceLock -= FIXED;
    world.squash = Math.max(0, world.squash - FIXED);

    const gSign = Math.sign(world.gravity) || 1;
    if (player.buffer > 0 && player.coyote > 0) {
      player.vy = -12.6 * gSign;
      player.onGround = false;
      player.coyote = 0;
      player.buffer = 0;
      world.jumped = true;
      world.jumps += 1;
      world.squash = 0.12;
      audio.play("jump");
      dust(player.x + player.w / 2, player.y + player.h, 4);
    }
    if (!jumpDown) {
      if (gSign > 0 && player.vy < -4) player.vy *= 0.55;
      if (gSign < 0 && player.vy > 4) player.vy *= 0.55;
    }

    player.vy += world.gravity;
    if (gSign > 0) player.vy = Math.min(player.vy, 13);
    else player.vy = Math.max(player.vy, -13);

    player.onGround = false;
    moveAxis(player.vx, 0);
    moveAxis(0, player.vy);
    if (player.x > world.maxX) world.maxX = player.x;

    if (Math.abs(player.vx) > 2.2 || !player.onGround) {
      world.afterimages.push({
        x: player.x, y: player.y, facing: player.facing, life: 0.16,
      });
    }

    const midX = player.x + player.w / 2;
    const feetY = player.y + player.h + 1;
    if (tileAt(midX, feetY) === "B" && player.bounceLock <= 0 && player.vy * gSign >= 0) {
      player.vy = -16 * gSign;
      player.onGround = false;
      player.bounceLock = 0.2;
      audio.play("jump");
      burst(midX, player.y + player.h, "#ffd27a", 10, 3);
    }

    crumbleUnderPlayer();
    stillCrumble();

    const body = [
      [player.x + 4, player.y + 6],
      [player.x + player.w - 4, player.y + 6],
      [player.x + 4, player.y + player.h - 3],
      [player.x + player.w - 4, player.y + player.h - 3],
      [midX, player.y + player.h / 2],
    ];
    for (const [hx, hy] of body) {
      const hz = hazardAt(hx, hy);
      if (hz) { die(hz); return; }
    }

    if (player.onGround && Math.abs(player.vx) > 2.6 && Math.random() < 0.18) {
      dust(player.x + player.w / 2, player.y + player.h, 1);
    }

    for (const saw of world.saws) {
      const dx = midX - saw.x;
      const dy = player.y + player.h / 2 - saw.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 15 * 15) { die("SAW SAID HI"); return; }
      if (d2 < 30 * 30 && nearCool <= 0) {
        nearCool = 0.4;
        burst((midX + saw.x) / 2, (player.y + 10 + saw.y) / 2, "#ffe0a0", 5, 2.8);
        if (!testMode) audio.play("near");
        camFX.punch = Math.max(camFX.punch, 3);
        nearFlare = 0.22;
      }
    }

    for (const laser of world.lasers) {
      if (laser.fake) continue;
      if (rectsOverlap(player, laser)) { die("BEAM"); return; }
    }

    for (const drop of world.drops) {
      if (rectsOverlap(player, drop)) { die("BRICK"); return; }
    }

    for (const coin of world.coins) {
      if (coin.dead) continue;
      const dx = midX - coin.x;
      const dy = player.y + 10 - coin.y;
      if (dx * dx + dy * dy < 16 * 16) {
        coin.dead = true;
        if (world.rules.explodeCoins) {
          burst(coin.x, coin.y, "#ffd24a", 16, 4);
          die("GREED");
          return;
        }
        audio.play("shard");
        shardsGot += 1;
        burst(coin.x, coin.y, "#ffd24a", 8, 3);
      }
    }

    const doorHit = (d) => d && !world.doorHidden && rectsOverlap(player, { x: d.x + 4, y: d.y + 2, w: 24, h: 30 });
    if (tileAt(midX, player.y + player.h + 1) === "!") { die("HIDDEN TEETH"); return; }

    if (doorHit(world.fakeDoor) && !world.doorOpened) {
      world.doorOpened = "fake";
      tickEvents();
      return;
    }
    if (doorHit(world.door)) {
      winLevel();
      return;
    }

    if (player.y > world.rows * TILE + 40 || player.y < -80) die("VOID");
    player.anim += Math.abs(player.vx) * 0.2;
  }

  function tickSaws() {
    for (const saw of world.saws) {
      saw.spin += 0.32;
      if (saw.chase && !player.dead) {
        const tx = player.x + player.w / 2;
        saw.vx += Math.sign(tx - saw.x) * 0.09;
        saw.vx = Math.max(-3.5, Math.min(3.5, saw.vx));
      }
      saw.x += saw.vx;
      saw.y += saw.vy;
    }
  }

  function tickLasers() {
    for (let i = world.lasers.length - 1; i >= 0; i--) {
      world.lasers[i].life -= FIXED;
      if (world.lasers[i].life <= 0) world.lasers.splice(i, 1);
    }
  }

  function tickPlatforms() {
    for (const p of world.platforms) {
      p.x += p.vx;
      if (p.x < p.min || p.x + p.w > p.max) p.vx *= -1;
      if (player.onGround && rectsOverlap(
        { x: player.x, y: player.y + player.h - 2, w: player.w, h: 6 },
        p
      )) player.x += p.vx;
    }
  }

  function tickDrops() {
    for (const d of world.drops) {
      d.vy += 0.4;
      d.y += d.vy;
    }
  }

  function tickParticles() {
    for (let i = world.particles.length - 1; i >= 0; i--) {
      const p = world.particles[i];
      p.vy += 0.25;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= FIXED;
      if (p.rot != null) p.rot += p.spin || 0;
      if (p.life <= 0) world.particles.splice(i, 1);
    }
    for (let i = world.afterimages.length - 1; i >= 0; i--) {
      world.afterimages[i].life -= FIXED;
      if (world.afterimages[i].life <= 0) world.afterimages.splice(i, 1);
    }
  }

  function camera() {
    const lw = world.cols * TILE;
    const lh = world.rows * TILE;
    const scale = Math.min(VIEW_W / (lw + 36), VIEW_H / (lh + 70));
    const ox = (VIEW_W - lw * scale) / 2;
    const oy = (VIEW_H - lh * scale) / 2 + 8;
    camFX.phase += 1.37;
    camFX.punch *= 0.82;
    const sx = world.shake ? Math.sin(camFX.phase * 1.7) * world.shake : 0;
    const sy = world.shake ? Math.cos(camFX.phase * 2.15) * world.shake * 0.72 : 0;
    if (deathShow) {
      const z = deathShow.zoom || 1;
      const cx = deathShow.x + player.w / 2;
      const cy = deathShow.y + player.h / 2;
      return {
        scale: scale * z,
        ox: VIEW_W / 2 - cx * scale * z + (deathShow.camX || 0) + sx,
        oy: VIEW_H / 2 - cy * scale * z + (deathShow.camY || 0) + sy + camFX.punch,
        rot: deathShow.camRot || 0,
      };
    }
    return { scale, ox: ox + sx, oy: oy + sy + camFX.punch, rot: 0 };
  }

  function hash(x, y) {
    return ((x * 17 + y * 31) >>> 0) % 7;
  }

  function themeBricks(t) {
    const th = currentTheme();
    const pair = th.brick || ["#4a4038", "#cfc1aa"];
    if (t === "=") return ["#6a5a48", "#b9a484"];
    if (t === "B") return ["#8a3a18", "#e07a3a"];
    return pair;
  }

  function drawBrickFace(px, py, body, lip, crumbly) {
    ctx.fillStyle = body;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = lip;
    ctx.fillRect(px, py, TILE, crumbly ? 4 : 6);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(px + 1, py + 1, TILE - 2, 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(px, py + TILE - 4, TILE, 4);
    ctx.fillRect(px + TILE - 3, py, 3, TILE);
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 16, py + 6);
    ctx.lineTo(px + 16, py + TILE);
    ctx.moveTo(px, py + 18);
    ctx.lineTo(px + TILE, py + 18);
    ctx.stroke();
    const n = hash(px / TILE, py / TILE);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(px + 4 + n, py + 9, 5, 3);
    ctx.fillRect(px + 20 - n, py + 22, 6, 2);
    if (crumbly) {
      ctx.fillStyle = "rgba(20,10,6,0.35)";
      ctx.fillRect(px + 7, py + 12, 4, 8);
      ctx.fillRect(px + 18, py + 8, 3, 10);
    }
  }

  function drawSpikePair(px, py, dir) {
    const pulse = 1 + Math.sin(world.time * 10 + px) * 0.04;
    for (let i = 0; i < 2; i++) {
      const bx = px + i * 16;
      ctx.save();
      ctx.translate(bx + 8, py + 16);
      ctx.scale(pulse, pulse);
      ctx.translate(-8, -16);
      ctx.fillStyle = "#1a120e";
      ctx.beginPath();
      if (dir === "up") {
        ctx.moveTo(0, TILE + 1); ctx.lineTo(8, 4); ctx.lineTo(16, TILE + 1);
      } else if (dir === "down") {
        ctx.moveTo(0, -1); ctx.lineTo(8, TILE - 4); ctx.lineTo(16, -1);
      } else if (dir === "left") {
        ctx.moveTo(TILE + 1, 0); ctx.lineTo(4, 8); ctx.lineTo(TILE + 1, 16);
      } else {
        ctx.moveTo(-1, 0); ctx.lineTo(TILE - 4, 8); ctx.lineTo(-1, 16);
      }
      ctx.fill();
      ctx.fillStyle = "#ece8e1";
      ctx.beginPath();
      if (dir === "up") {
        ctx.moveTo(2, TILE); ctx.lineTo(8, 3); ctx.lineTo(14, TILE);
      } else if (dir === "down") {
        ctx.moveTo(2, 0); ctx.lineTo(8, TILE - 3); ctx.lineTo(14, 0);
      } else if (dir === "left") {
        ctx.moveTo(TILE, 2); ctx.lineTo(3, 8); ctx.lineTo(TILE, 14);
      } else {
        ctx.moveTo(0, 2); ctx.lineTo(TILE - 3, 8); ctx.lineTo(0, 14);
      }
      ctx.fill();
      ctx.fillStyle = "#e31b1b";
      ctx.beginPath();
      if (dir === "up") {
        ctx.moveTo(6, 14); ctx.lineTo(8, 3); ctx.lineTo(10, 14);
      } else if (dir === "down") {
        ctx.moveTo(6, 18); ctx.lineTo(8, TILE - 3); ctx.lineTo(10, 18);
      } else {
        ctx.moveTo(8, 6); ctx.lineTo(3, 8); ctx.lineTo(8, 10);
      }
      ctx.fill();
      ctx.restore();
    }
  }

  function beatGlow() {
    if (audio.ctx && audio.lastKick) {
      const dt = audio.ctx.currentTime - audio.lastKick;
      return Math.max(0, Math.exp(-dt * 6.5));
    }
    const bpm = (audio.theme && audio.theme.bpm) || 128;
    const beat = (performance.now() / 1000) * (bpm / 60);
    return Math.pow(1 - (beat % 1), 3);
  }

  function frac(n) {
    const x = Math.sin(n * 127.1) * 43758.5453;
    return x - Math.floor(x);
  }

  function drawNeedleField(t, y0, count, hMin, hMax, speed, fill, edge, lean, seed) {
    const span = VIEW_W / count;
    const shift = (t * speed) % (span * 2);
    for (let i = -2; i <= count + 3; i++) {
      const n = frac(i * 19.17 + seed);
      const x = i * span - shift;
      const h = hMin + (hMax - hMin) * (0.4 + n * 0.6);
      const w = 6 + n * 18;
      const tipX = x + lean * h;
      ctx.beginPath();
      ctx.moveTo(x - w, y0 + 60);
      ctx.lineTo(tipX, y0 - h);
      ctx.lineTo(x + w, y0 + 60);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (edge) {
        ctx.strokeStyle = edge;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
  }

  function drawWeather(t, pulse, heat, weather, accent) {
    const [ar, ag, ab] = accent;
    if (weather === "ember") {
      for (let i = 0; i < 40; i++) {
        const n = frac(i * 5.7);
        const x = (frac(i * 11.3) * VIEW_W + t * (8 + n * 18)) % VIEW_W;
        const y = (VIEW_H + 40 - ((t * (30 + n * 50) + n * 400) % (VIEW_H + 80)));
        ctx.fillStyle = `rgba(${220 + n * 35},${80 + n * 80},40,${0.35 + n * 0.4})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.2 + n * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (weather === "snow") {
      for (let i = 0; i < 70; i++) {
        const n = frac(i * 8.1);
        const x = (frac(i * 3.9) * VIEW_W + Math.sin(t * 0.6 + i) * 18) % VIEW_W;
        const y = (t * (18 + n * 28) + n * 900) % (VIEW_H + 20);
        ctx.fillStyle = `rgba(230,240,255,${0.35 + n * 0.5})`;
        ctx.fillRect(x, y, n > 0.8 ? 3 : 1.4, n > 0.8 ? 3 : 1.4);
      }
    } else if (weather === "spores") {
      for (let i = 0; i < 36; i++) {
        const n = frac(i * 6.4);
        const x = (frac(i * 14.2) * VIEW_W + Math.sin(t * 0.4 + i) * 40) % VIEW_W;
        const y = (frac(i * 9.8) * VIEW_H + Math.cos(t * 0.3 + i) * 24) % VIEW_H;
        ctx.fillStyle = `rgba(${ar},${ag},${ab},${0.12 + n * 0.22})`;
        ctx.beginPath();
        ctx.arc(x, y, 3 + n * 6 + pulse * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (weather === "sparks") {
      for (let i = 0; i < 28; i++) {
        const n = frac(i * 4.4);
        const life = (t * (90 + n * 140) + n * 500) % (VIEW_H + 80);
        const x = frac(i * 17.1) * VIEW_W;
        ctx.strokeStyle = `rgba(255,${180 + n * 60},60,${0.5 + heat * 0.3})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, VIEW_H - life);
        ctx.lineTo(x + (n - 0.5) * 12, VIEW_H - life - 10 - n * 16);
        ctx.stroke();
      }
    } else if (weather === "rain") {
      ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.28)`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 90; i++) {
        const n = frac(i * 2.2);
        const x = (frac(i * 19) * VIEW_W + t * 40) % VIEW_W;
        const y = (t * (280 + n * 120) + n * 700) % (VIEW_H + 30);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 4, y + 12 + n * 10);
        ctx.stroke();
      }
    } else if (weather === "static") {
      if (((t * 24) | 0) % 7 === 0) {
        ctx.fillStyle = `rgba(${ar},${ag},${ab},0.05)`;
        for (let i = 0; i < 18; i++) {
          ctx.fillRect(frac(t * 9 + i) * VIEW_W, frac(t * 5 + i * 3) * VIEW_H, 40 + frac(i) * 80, 2);
        }
      }
    } else {
      for (let i = 0; i < 34; i++) {
        const n = frac(i * 7.3);
        const speed = 22 + n * 50;
        const life = (t * speed + n * 800) % (VIEW_H + 140);
        const x = frac(i * 21.9) * VIEW_W;
        const y = VIEW_H + 50 - life;
        const len = 8 + n * 22;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(0.15 + n * 0.5 + t * (0.2 + n * 0.4));
        ctx.fillStyle = n > 0.62 ? `rgba(${ar},${ag},${ab},0.72)` : `rgba(${ar},${ag},${ab},0.38)`;
        ctx.beginPath();
        ctx.moveTo(0, -len);
        ctx.lineTo(2.4, len);
        ctx.lineTo(-2.4, len);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawBackground() {
    const t = performance.now() / 1000;
    const pulse = beatGlow();
    const heat = Math.min(1, (world.trapsFired || 0) / 10);
    const th = currentTheme();
    const accent = th.accent || [210, 225, 255];
    const [ar, ag, ab] = accent;
    const skyCols = th.sky || ["#0b1018", "#07090f", "#04050a"];
    const planetCols = th.planet || ["#ffffff", "#7b93bc", "#1b2433"];

    const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, skyCols[0]);
    sky.addColorStop(0.42, skyCols[1]);
    sky.addColorStop(1, skyCols[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.fillStyle = `rgba(${ar},${ag},${ab},0.04)`;
    for (let b = 0; b < 3; b++) {
      const y = VIEW_H * (0.18 + b * 0.12) + Math.sin(t * 0.3 + b) * 10;
      ctx.beginPath();
      ctx.ellipse(VIEW_W * (0.35 + b * 0.18), y, VIEW_W * 0.42, 28 + pulse * 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const cx = VIEW_W * 0.76;
    const cy = VIEW_H * 0.2;
    const r = Math.min(VIEW_W, VIEW_H) * (0.118 + pulse * 0.012);

    const corona = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r * 4.4);
    corona.addColorStop(0, `rgba(${ar},${ag},${ab},${0.2 + pulse * 0.16})`);
    corona.addColorStop(0.22, `rgba(${ar},${ag},${ab},${0.1 + pulse * 0.08})`);
    corona.addColorStop(0.55, `rgba(${Math.round(ar * 0.4)},${Math.round(ag * 0.4)},${Math.round(ab * 0.5)},${0.05 + heat * 0.03})`);
    corona.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = corona;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.28 + k / 3) % 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r * (1.35 + ph * 4.2), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${ar},${ag},${ab},${(1 - ph) * (0.16 + pulse * 0.12)})`;
      ctx.lineWidth = 1.5 + pulse * 1.5;
      ctx.stroke();
    }

    const planet = ctx.createRadialGradient(cx - r * 0.32, cy - r * 0.38, r * 0.08, cx, cy, r);
    planet.addColorStop(0, planetCols[0]);
    planet.addColorStop(0.22, planetCols[0]);
    planet.addColorStop(0.55, planetCols[1]);
    planet.addColorStop(1, planetCols[2]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = planet;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + r * 0.22, cy + r * 0.12, r * 0.92, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(6,8,14,0.28)";
    ctx.fill();

    ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.18)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.04, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 8; i++) {
      const a = t * 0.32 + i * 0.785;
      const rr = r * (1.7 + 0.4 * Math.sin(t * 0.7 + i));
      const x = cx + Math.cos(a) * rr * 1.55;
      const y = cy + Math.sin(a) * rr * 0.42;
      const len = 9 + (i % 4) * 6;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + 1.2);
      ctx.fillStyle = i % 2 ? `rgba(${ar},${ag},${ab},0.55)` : `rgba(${ar},${ag},${ab},0.32)`;
      ctx.beginPath();
      ctx.moveTo(0, -len);
      ctx.lineTo(2.2, len * 0.7);
      ctx.lineTo(-2.2, len * 0.7);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = `rgba(${ar},${ag},${ab},0.72)`;
    for (let i = 0; i < 70; i++) {
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (1.3 + (i % 5) * 0.4) + i));
      const x = (frac(i * 13.7) * VIEW_W + t * (4 + (i % 6))) % VIEW_W;
      const y = frac(i * 9.1) * VIEW_H * 0.72;
      const sz = i % 11 === 0 ? 2.4 : 1.1;
      ctx.globalAlpha = tw;
      ctx.fillRect(x, y, sz, sz);
    }
    ctx.globalAlpha = 1;

    drawWeather(t, pulse, heat, th.weather || "shards", accent);

    const needle = th.needle || "#101624";
    const edge = th.edge || "rgba(160,190,230,0.22)";
    drawNeedleField(t, VIEW_H * 0.56, 13, 90, 250, 10, needle, edge, 0.08, 1.1);
    drawNeedleField(t, VIEW_H * 0.66, 17, 60, 180, 20, needle, edge, -0.05, 4.4);
    drawNeedleField(t, VIEW_H * 0.78, 21, 40, 130, 36, skyCols[2], edge, 0.04, 8.8);

    ctx.fillStyle = "rgba(8,10,16,0.55)";
    ctx.fillRect(0, VIEW_H * 0.86, VIEW_W, VIEW_H * 0.14);

    const bolt = (t * 0.19) % 11;
    if (bolt > 10.82) {
      const a = (bolt - 10.82) / 0.18;
      ctx.fillStyle = `rgba(${ar},${ag},${ab},${0.16 * (1 - a)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - a)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let bx = VIEW_W * (0.35 + frac(Math.floor(t * 3)) * 0.4);
      let by = 0;
      ctx.moveTo(bx, by);
      for (let k = 0; k < 6; k++) {
        bx += (frac(t * 9 + k) - 0.5) * 70;
        by += VIEW_H * 0.045 + k * 6;
        ctx.lineTo(bx, by);
      }
      ctx.lineTo(cx, cy);
      ctx.stroke();
    }

    if (pulse > 0.55) {
      ctx.fillStyle = `rgba(${ar},${ag},${ab},${(pulse - 0.55) * 0.12})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  function drawTile(t, x, y) {
    const px = x * TILE;
    const py = y * TILE;
    if (t === "#" || t === "=" || t === "B" || t === "!") {
      const pal = themeBricks(t);
      drawBrickFace(px, py, pal[0], pal[1], t === "=");
      if (t === "B") {
        ctx.fillStyle = "#ffd27a";
        ctx.fillRect(px + 7, py + 12, 18, 7);
        ctx.fillStyle = "#fff1b0";
        ctx.fillRect(px + 9, py + 13, 8, 2);
      }
      if (t === "!") {
        ctx.globalAlpha = 0.22 + Math.sin(world.time * 8 + x) * 0.08;
        drawSpikePair(px, py - 18, "up");
        ctx.globalAlpha = 1;
      }
    } else if (t === "*") {
      drawBrickFace(px, py, "#4a4038", "#cfc1aa", false);
    } else if (t === "^") drawSpikePair(px, py, "up");
    else if (t === "v") drawSpikePair(px, py, "down");
    else if (t === "<") drawSpikePair(px, py, "left");
    else if (t === ">") drawSpikePair(px, py, "right");
  }

  function drawDoorShell(x, y, fake) {
    const pulse = 0.55 + Math.sin(world.time * 5) * 0.45;
    ctx.save();
    ctx.fillStyle = `rgba(255, 50, 50, ${0.12 + pulse * 0.16})`;
    ctx.beginPath();
    ctx.arc(x + 18, y + 28, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a1608";
    ctx.fillRect(x - 3, y + 46, 42, 6);
    ctx.fillStyle = "#f0c14b";
    ctx.beginPath();
    ctx.moveTo(x - 2, y + 14);
    ctx.lineTo(x + 18, y - 8);
    ctx.lineTo(x + 38, y + 14);
    ctx.lineTo(x + 38, y + 50);
    ctx.lineTo(x - 2, y + 50);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = fake ? "#8a1a1a" : "#c41e1e";
    ctx.fillRect(x + 3, y + 10, 30, 38);
    ctx.fillStyle = "#7a1010";
    ctx.fillRect(x + 7, y + 16, 8, 10);
    ctx.fillRect(x + 21, y + 16, 8, 10);
    ctx.fillStyle = "#f7e08a";
    ctx.fillRect(x + 7, y + 16, 8, 2);
    ctx.fillRect(x + 21, y + 16, 8, 2);
    ctx.fillStyle = "#f0c14b";
    ctx.beginPath();
    ctx.arc(x + 27, y + 34, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff1a8";
    ctx.fillRect(x + 4, y + 10, 28, 3);
    ctx.restore();
  }

  function drawDoor(d) {
    if (!d || world.doorHidden) return;
    drawDoorShell(d.x - 2, d.y - 18, d.fake);
  }

  function drawSaw(saw) {
    ctx.save();
    ctx.translate(saw.x, saw.y);
    const pulse = saw.chase ? 0.34 : 0.2;
    ctx.fillStyle = `rgba(227,27,27,${pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, 22 + (saw.chase ? Math.sin(world.time * 14) * 2 : 0), 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(saw.spin);
    ctx.fillStyle = "#ece8e1";
    for (let i = 0; i < 14; i++) {
      ctx.rotate((Math.PI * 2) / 14);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(5, 17);
      ctx.lineTo(-5, 17);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.fillStyle = "#6b6560";
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "#e31b1b";
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff1a8";
    ctx.beginPath();
    ctx.arc(-1.5, -1.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSkullMark(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = "#f4ead8";
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#140808";
    ctx.beginPath();
    ctx.ellipse(-2.4, 0.4, 1.6, 2, 0, 0, Math.PI * 2);
    ctx.ellipse(2.4, 0.4, 1.6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDevilBody(ox, oy, facing, alpha, squash, opts) {
    opts = opts || {};
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(ox + player.w / 2, oy + player.h / 2);
    ctx.scale(facing < 0 ? -1 : 1, world.gravity < 0 ? -1 : 1);
    const sy = 1 - squash * 0.35;
    const sx = 1 + squash * 0.28;
    ctx.scale(sx, sy);
    ctx.translate(-player.w / 2, -player.h / 2);

    const demo = mode === "title" || mode === "levels";
    const gait = opts.gait != null ? opts.gait : (demo ? Math.sin(performance.now() / 90) : Math.sin(player.anim));
    const air = opts.air != null ? opts.air : (demo ? false : !player.onGround);
    const blink = opts.blink != null ? opts.blink : ((demo ? performance.now() / 1000 : world.time) % 3.4) < 0.09;

    ctx.shadowColor = "rgba(227,27,27,0.5)";
    ctx.shadowBlur = 14;
    ctx.strokeStyle = "#c41e1e";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(18, 16);
    ctx.quadraticCurveTo(28, 12 + gait * 3, 25, 24);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#2a1810";
    ctx.beginPath();
    ctx.moveTo(3, 9); ctx.lineTo(-1, -5); ctx.lineTo(5, -1); ctx.lineTo(8, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(21, 9); ctx.lineTo(26, -5); ctx.lineTo(19, -1); ctx.lineTo(16, 7);
    ctx.fill();
    ctx.fillStyle = "#e31b1b";
    ctx.beginPath();
    ctx.moveTo(3, 9); ctx.lineTo(1, -2); ctx.lineTo(5, 1);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(21, 9); ctx.lineTo(24, -2); ctx.lineTo(19, 1);
    ctx.fill();

    ctx.fillStyle = "#e31b1b";
    ctx.fillRect(1, 6, 22, 18);
    ctx.fillStyle = "#ff5a5a";
    ctx.fillRect(3, 8, 11, 5);
    ctx.fillStyle = "#b01414";
    ctx.fillRect(1, 21, 22, 7);

    const leg = air ? -2 : gait * 3.2;
    ctx.fillStyle = "#7a0e0e";
    ctx.fillRect(3, 24, 6, 5 + (air ? 1 : Math.max(0, -leg)));
    ctx.fillRect(15, 24, 6, 5 + (air ? 1 : Math.max(0, leg)));
    ctx.fillStyle = "#2a1810";
    ctx.fillRect(2, 27 + (air ? 1 : Math.max(0, -leg)), 7, 3);
    ctx.fillRect(14, 27 + (air ? 1 : Math.max(0, leg)), 7, 3);

    ctx.fillStyle = "#fff6d8";
    ctx.beginPath();
    ctx.ellipse(9, 14, 4.2, 5.2, 0, 0, Math.PI * 2);
    ctx.ellipse(16.4, 14, 4.2, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (blink) {
      ctx.fillStyle = "#140808";
      ctx.fillRect(6, 13.5, 6, 1.5);
      ctx.fillRect(13.5, 13.5, 6, 1.5);
    } else {
      ctx.fillStyle = "#140808";
      ctx.beginPath();
      ctx.ellipse(10 + (facing > 0 ? 0.6 : -0.2), 14.4, 1.5, 2, 0, 0, Math.PI * 2);
      ctx.ellipse(17.4 + (facing > 0 ? 0.6 : -0.2), 14.4, 1.5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e31b1b";
      ctx.fillRect(9.4, 13.2, 1, 1);
      ctx.fillRect(16.8, 13.2, 1, 1);
    }
    ctx.fillStyle = "#e31b1b";
    ctx.fillRect(8, 19.5, 9, 2);
    ctx.restore();
  }

  function drawContactShadows() {
    const blob = (x, y, rx, ry, a) => {
      ctx.fillStyle = `rgba(0,0,0,${a})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    if (!player.dead) blob(player.x + player.w / 2, player.y + player.h + 3, 13, 4.5, 0.38);
    for (const saw of world.saws) blob(saw.x, saw.y + 16, 12, 4, 0.32);
    for (const coin of world.coins) {
      if (!coin.dead) blob(coin.x, coin.y + 10, 6, 2.4, 0.22);
    }
    if (world.door && !world.doorHidden) blob(world.door.x + 16, world.door.y + 32, 10, 3.2, 0.28);
  }

  function drawLighting(view) {
    const th = currentTheme();
    const [ar, ag, ab] = th.accent || [210, 225, 255];
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = th.mul || "rgba(70,90,120,0.45)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();

    const toScreen = (wx, wy) => ({
      x: wx * view.scale + view.ox,
      y: wy * view.scale + view.oy,
    });
    const light = (wx, wy, radius, r, g, b, a) => {
      const p = toScreen(wx, wy);
      const rad = radius * view.scale;
      const grd = ctx.createRadialGradient(p.x, p.y, rad * 0.08, p.x, p.y, rad);
      grd.addColorStop(0, `rgba(${r},${g},${b},${a})`);
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(p.x - rad, p.y - rad, rad * 2, rad * 2);
    };

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (!player.dead) {
      light(player.x + player.w / 2, player.y + player.h / 2, dashT > 0 ? 220 : 160, ar, ag, ab, 0.32);
    }
    for (const saw of world.saws) light(saw.x, saw.y, 90, 255, 70, 40, 0.22);
    for (const l of world.lasers) {
      light(l.x + l.w / 2, l.y + l.h / 2, 110, l.fake ? 180 : 255, l.fake ? 220 : 80, l.fake ? 255 : 40, 0.28);
    }
    if (world.door && !world.doorHidden) light(world.door.x + 16, world.door.y + 8, 70, 255, 210, 80, 0.18);
    if (nearFlare > 0) {
      light(player.x + player.w / 2, player.y + 10, 240, 255, 240, 200, nearFlare * 1.4);
    }
    ctx.restore();
  }

  function drawDevil() {
    if (deathGhost && !player.dead) {
      const fade = 0.18 + Math.sin(world.time * 6) * 0.04;
      drawDevilBody(deathGhost.x, deathGhost.y, deathGhost.facing, fade, 0);
    }
    if (player.dead) return;
    for (const a of world.afterimages) {
      drawDevilBody(a.x, a.y, a.facing, Math.min(0.35, a.life * 1.4), 0);
    }
    const bob = player.onGround ? Math.sin(player.anim) * 1.4 : 0;
    drawDevilBody(player.x, player.y + bob, player.facing, 1, world.squash);
    const [ar, ag, ab] = (currentTheme().accent || [227, 27, 27]);
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = `rgb(${ar},${ag},${ab})`;
    ctx.fillRect(player.x, player.y + bob, player.w, player.h);
    ctx.restore();
  }

  function drawParticles() {
    for (const p of world.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      if (p.rot) ctx.rotate(p.rot);
      if (p.kind === "spark") {
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.45, 0);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size * 0.45, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawBlood() {
    for (const b of world.blood || []) {
      ctx.globalAlpha = b.a;
      ctx.fillStyle = "#6a0c0c";
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.s, b.s * 0.55, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawLasers() {
    for (const l of world.lasers) {
      const a = Math.min(1, l.life * 3);
      if (l.fake) {
        ctx.fillStyle = `rgba(180,210,255,${0.12 * a})`;
        ctx.fillRect(l.x - 4, l.y - 6, l.w + 8, l.h + 12);
        ctx.fillStyle = `rgba(230,240,255,${0.45 * a})`;
        ctx.fillRect(l.x, l.y, l.w, l.h);
        continue;
      }
      ctx.fillStyle = `rgba(255,40,40,${0.18 * a})`;
      ctx.fillRect(l.x - 4, l.y - 6, l.w + 8, l.h + 12);
      ctx.fillStyle = `rgba(255,210,210,${0.85 * a})`;
      ctx.fillRect(l.x, l.y, l.w, l.h);
    }
  }

  function drawOverlay() {
    if (world.flash > 0) {
      ctx.fillStyle = `rgba(227,27,27,${world.flash * 2})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (world.chromatic > 0) {
      ctx.fillStyle = `rgba(255,0,40,${world.chromatic * 0.22})`;
      ctx.fillRect(-5, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = `rgba(40,80,255,${world.chromatic * 0.18})`;
      ctx.fillRect(5, 0, VIEW_W, VIEW_H);
    }
    const glow = ctx.createRadialGradient(
      VIEW_W / 2 + (player.x - world.cols * 16) * 0.05,
      VIEW_H / 2, 80, VIEW_W / 2, VIEW_H / 2, 520
    );
    glow.addColorStop(0, "rgba(0,0,0,0)");
    glow.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (world.reverse) {
      ctx.fillStyle = "rgba(80,120,255,0.07)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (world.gravity < 0) {
      ctx.fillStyle = "rgba(160,40,180,0.06)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (world.wind) {
      ctx.strokeStyle = `rgba(244,234,216,${0.08 + Math.abs(world.wind) * 0.04})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const y = (i * 67 + world.time * 120) % VIEW_H;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(VIEW_W, y + world.wind * 18);
        ctx.stroke();
      }
    }
    if (nearFlare > 0) {
      ctx.fillStyle = `rgba(255,240,210,${nearFlare * 0.35})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (introT > 0 && mode === "play") {
      ctx.save();
      const a = introT > 0.7 ? 1 : introT / 0.7;
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(8,6,10,0.28)";
      ctx.fillRect(0, VIEW_H * 0.16, VIEW_W, 52);
      ctx.font = `800 ${Math.round(VIEW_W * 0.028)}px Rubik, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#f4ead8";
      ctx.letterSpacing = "0.28em";
      ctx.fillText(world.name, VIEW_W / 2, VIEW_H * 0.16 + 34);
      ctx.restore();
    }
  }

  function drawTitleDemo() {
    drawBackground();
    const t = performance.now() / 1000;
    const W = 960;
    const H = 540;
    const scale = Math.min(VIEW_W / W, VIEW_H / H);
    ctx.save();
    ctx.translate((VIEW_W - W * scale) / 2, (VIEW_H - H * scale) / 2);
    ctx.scale(scale, scale);
    const floorY = H * 0.78;
    const pal = themeBricks("#");
    for (let i = 0; i < Math.ceil(W / TILE) + 1; i++) {
      drawBrickFace(i * TILE, floorY, pal[0], pal[1], false);
    }
    const holeX = W * 0.52;
    if ((t % 5) > 2.2) {
      ctx.fillStyle = "#07050a";
      ctx.fillRect(holeX, floorY, 96, TILE);
      drawSpikePair(holeX, floorY + TILE, "up");
      drawSpikePair(holeX + 32, floorY + TILE, "up");
      drawSpikePair(holeX + 64, floorY + TILE, "up");
    }
    const walk = (t % 5) / 2.15;
    const px = W * 0.18 + Math.min(walk, 1) * W * 0.28;
    const py = floorY - 28 + ((t % 5) > 2.25 && walk > 1 ? (t % 5 - 2.25) * 90 : 0);
    drawDevilBody(px, py, 1, 1, (t % 5) > 2.2 && walk <= 1 ? 0.12 : 0);
    drawSaw({ x: px - 70, y: floorY - 18, spin: t * 8, chase: (t % 5) > 1.6 });
    ctx.restore();
    drawSkullMark(VIEW_W * 0.16, VIEW_H * 0.22, 1.6);
    drawSkullMark(VIEW_W * 0.84, VIEW_H * 0.2, 1.3);
    drawOverlay();
  }

  function render() {
    if (mode === "title" || mode === "levels") {
      drawTitleDemo();
      return;
    }
    drawBackground();
    const view = camera();
    ctx.save();
    if (view.rot) {
      ctx.translate(VIEW_W / 2, VIEW_H / 2);
      ctx.rotate(view.rot);
      ctx.translate(-VIEW_W / 2, -VIEW_H / 2);
    }
    ctx.translate(view.ox, view.oy);
    ctx.scale(view.scale, view.scale);
    drawContactShadows();
    for (let y = 0; y < world.rows; y++) {
      for (let x = 0; x < world.cols; x++) drawTile(world.tiles[y][x], x, y);
    }
    drawBlood();
    for (const p of world.platforms) {
      drawBrickFace(p.x, p.y, "#6a4030", "#e0b090", false);
    }
    for (const d of world.drops) drawBrickFace(d.x, d.y, "#5a3830", "#c0a080", false);
    drawDoor(world.door);
    drawDoor(world.fakeDoor);
    for (const coin of world.coins) {
      if (coin.dead) continue;
      const cy = coin.y + Math.sin(world.time * 6 + coin.x) * 2;
      const pulse = 6.5 + Math.sin(world.time * 8 + coin.x) * 0.6;
      ctx.fillStyle = "rgba(255, 210, 74, 0.28)";
      ctx.beginPath(); ctx.arc(coin.x, cy, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = world.rules.explodeCoins ? "#ff7a3a" : "#ffd24a";
      ctx.beginPath(); ctx.arc(coin.x, cy, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff6d8";
      ctx.beginPath(); ctx.arc(coin.x - 2, cy - 2, 2, 0, Math.PI * 2); ctx.fill();
    }
    drawLasers();
    for (const saw of world.saws) drawSaw(saw);
    drawDevil();
    if (deathShow && window.DeathRoast) window.DeathRoast.drawWorld(ctx, deathShow, roastApi());
    drawParticles();
    ctx.restore();
    drawLighting(view);
    drawOverlay();
    if (deathShow && window.DeathRoast) window.DeathRoast.drawScreen(ctx, deathShow, roastApi());
  }

  function step() {
    if (mode !== "play" && !testMode) return;
    if (hitstop > 0) { hitstop -= FIXED; return; }
    const steps = slowmo < 1 ? (Math.random() < slowmo ? 1 : 0) : 1;
    if (!steps && !testMode) {
      world.time += FIXED * slowmo;
      return;
    }
    world.time += FIXED;
    world.shake = Math.max(0, world.shake - 0.75);
    world.flash = Math.max(0, world.flash - FIXED);
    world.hudGlitch = Math.max(0, world.hudGlitch - FIXED);
    world.chromatic = Math.max(0, world.chromatic - FIXED * 1.6);
    introT = Math.max(0, introT - FIXED);
    dimIntro = Math.max(0, dimIntro - FIXED);
    if (dimIntro <= 0 && dimCard && !dimCard.classList.contains("hidden")) dimCard.classList.add("hidden");
    nearCool = Math.max(0, nearCool - FIXED);
    nearFlare = Math.max(0, nearFlare - FIXED);
    if (audio.lastKick && audio.ctx && audio.ctx.currentTime - audio.lastKick < 0.05) {
      camFX.punch = Math.max(camFX.punch, 2.2);
    }
    if (comboTimer > 0) {
      comboTimer -= FIXED;
      if (comboTimer <= 0) {
        combo = 0;
        updateComboHud();
      }
    }
    if (player.dead && deathTimer > 0) {
      deathTimer -= FIXED;
      tickParticles();
      tickSaws();
      if (deathShow && window.DeathRoast) window.DeathRoast.tick(deathShow, roastApi());
      if (deathTimer <= 0) {
        deathShow = null;
        loadLevel(levelIndex);
      }
      return;
    }
    tickPlayer();
    tickSaws();
    tickLasers();
    tickPlatforms();
    tickDrops();
    tickParticles();
    tickEvents();
    if (mode === "play") updateHud();
  }

  function loop(ts) {
    if (!last) last = ts;
    let dt = (ts - last) / 1000;
    last = ts;
    if (dt > 0.05) dt = 0.05;
    acc += dt;
    while (acc >= FIXED) {
      step();
      acc -= FIXED;
    }
    render();
    requestAnimationFrame(loop);
  }

  function startGame(from) {
    audio.unlock();
    const startAt = typeof from === "number" ? from : 0;
    titleScreen.classList.add("hidden");
    winScreen.classList.add("hidden");
    clearScreen.classList.add("hidden");
    if (pauseScreen) pauseScreen.classList.add("hidden");
    if (levelsScreen) levelsScreen.classList.add("hidden");
    if (dimCard && dimIntro <= 0) dimCard.classList.add("hidden");
    hud.classList.remove("hidden");
    if (window.matchMedia("(pointer: coarse)").matches) mobile.classList.remove("hidden");
    deaths = 0;
    combo = 0;
    comboTimer = 0;
    runTraps = 0;
    levelIndex = startAt;
    startedAt = performance.now();
    mode = "play";
    loadLevel(levelIndex);
  }

  function pauseGame() {
    if (mode !== "play" || deathShow) return;
    mode = "pause";
    if (pauseScreen) pauseScreen.classList.remove("hidden");
    const pauseName = document.getElementById("pause-name");
    if (pauseName) pauseName.textContent = world.name;
    audio.play("pause");
  }

  function resumeGame() {
    if (mode !== "pause") return;
    if (pauseScreen) pauseScreen.classList.add("hidden");
    mode = "play";
  }

  function quitToTitle() {
    if (pauseScreen) pauseScreen.classList.add("hidden");
    if (levelsScreen) levelsScreen.classList.add("hidden");
    if (dimCard) dimCard.classList.add("hidden");
    winScreen.classList.add("hidden");
    clearScreen.classList.add("hidden");
    hud.classList.add("hidden");
    mobile.classList.add("hidden");
    mode = "title";
    titleScreen.classList.remove("hidden");
    refreshRecords();
  }

  function refreshRecords() {
    const el = document.getElementById("records");
    if (!el) return;
    const s = loadSave();
    if (!s.runs && s.bestDeaths == null) {
      el.textContent = "";
      return;
    }
    const bits = [];
    if (s.unlockedDim) bits.push(`D${s.unlockedDim} / 20`);
    if (s.bestDeaths != null) bits.push(`${s.bestDeaths} best deaths`);
    if (s.bestTime != null) bits.push(`${s.bestTime}s best`);
    if (s.clears) bits.push(`${s.clears} clears`);
    el.textContent = bits.join(" · ");
  }

  function fillLevelGrid() {
    const grid = document.getElementById("level-grid");
    if (!grid || !window.SURGE_WORLDS) return;
    const unlocked = loadSave().unlockedDim || 1;
    const rec = loadSave().dimRecords || {};
    grid.innerHTML = "";
    grid.classList.add("world-grid");
    window.SURGE_WORLDS.DIMS.forEach((dim, i) => {
      const d = i + 1;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "level-cell world-cell";
      const locked = d > unlocked;
      b.disabled = locked;
      const rooms = window.SURGE_WORLDS.roomCount(d);
      const traps = window.SURGE_WORLDS.trapCount(d);
      const recLine = rec[d] ? ` · ${rec[d].bestDeaths}☠` : "";
      b.innerHTML = `<span class="n">D${String(d).padStart(2, "0")}</span><span class="nm">${locked ? "LOCKED" : dim.name}</span><span class="meta">${rooms} rooms · ${traps} traps${recLine}</span>`;
      b.onclick = () => enterDimension(d, 0);
      grid.appendChild(b);
    });
  }

  function showLevels() {
    audio.unlock();
    titleScreen.classList.add("hidden");
    if (levelsScreen) levelsScreen.classList.remove("hidden");
    mode = "levels";
    fillLevelGrid();
  }

  document.getElementById("play-btn").onclick = () => {
    const s = loadSave();
    enterDimension(s.lastDim || 1, s.lastRoom || 0);
  };
  document.getElementById("again-btn").onclick = () => enterDimension(dimIndex, 0);
  const nextDimBtn = document.getElementById("next-dim-btn");
  if (nextDimBtn) nextDimBtn.onclick = () => enterDimension(Math.min(20, dimIndex + 1), 0);
  const levelsBtn = document.getElementById("levels-btn");
  if (levelsBtn) levelsBtn.onclick = showLevels;
  const levelsBack = document.getElementById("levels-back");
  if (levelsBack) levelsBack.onclick = quitToTitle;
  const resumeBtn = document.getElementById("resume-btn");
  if (resumeBtn) resumeBtn.onclick = resumeGame;
  const retryBtn = document.getElementById("retry-btn");
  if (retryBtn) retryBtn.onclick = () => { if (pauseScreen) pauseScreen.classList.add("hidden"); mode = "play"; deathTimer = 0; loadLevel(levelIndex); };
  const quitBtn = document.getElementById("quit-btn");
  if (quitBtn) quitBtn.onclick = quitToTitle;
    if (pauseBtn) pauseBtn.onclick = () => {
      if (deathShow) return;
      if (mode === "play") pauseGame();
      else if (mode === "pause") resumeGame();
    };
  muteBtn.onclick = () => {
    audio.unlock();
    audio.setMuted(!audio.muted);
    muteBtn.textContent = audio.muted ? "🔇" : "🔊";
  };

  window.addEventListener("pointerdown", () => audio.unlock());
  window.addEventListener("keydown", (e) => {
    audio.unlock();
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    if (mode === "pause") {
      if (e.key === "Escape") resumeGame();
      return;
    }
    keys.add(e.key);
    if (mode === "title" && (e.key === "Enter" || e.key === " ")) {
      const s = loadSave();
      enterDimension(s.lastDim || 1, s.lastRoom || 0);
    }
    else if (mode === "levels" && e.key === "Escape") quitToTitle();
    else if (mode === "clear") nextLevel();
    else if (mode === "win" && e.key === "Enter") enterDimension(dimIndex >= 20 ? 1 : dimIndex + 1, 0);
    else if (mode === "play" && deathShow) {
      /* roast plays through; R and pause cannot cut it */
    }
    else if (mode === "play" && e.key === "Escape") pauseGame();
    else if (mode === "play" && (e.key === "r" || e.key === "R")) {
      deathTimer = 0;
      loadLevel(levelIndex);
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key));
  clearScreen.addEventListener("click", () => { if (mode === "clear") nextLevel(); });

  function bindHold(id, prop) {
    const el = document.getElementById(id);
    if (!el) return;
    const on = (e) => { e.preventDefault(); hold[prop] = true; audio.unlock(); };
    const off = (e) => { e.preventDefault(); hold[prop] = false; };
    el.addEventListener("touchstart", on, { passive: false });
    el.addEventListener("touchend", off);
    el.addEventListener("mousedown", on);
    el.addEventListener("mouseup", off);
    el.addEventListener("mouseleave", off);
  }
  bindHold("btn-left", "left");
  bindHold("btn-right", "right");
  bindHold("btn-jump", "jump");
  bindHold("btn-dash", "dash");

  function parseSol(sol) {
    if (!sol) return [];
    return String(sol).trim().split(/\s+/).map((tok) => {
      const m = tok.match(/^(JR|JL|J|R|L|W)(\d+)$/i);
      if (!m) return { ix: 0, jump: false, frames: 1 };
      const n = +m[2];
      const k = m[1].toUpperCase();
      if (k === "R") return { ix: 1, jump: false, frames: n };
      if (k === "L") return { ix: -1, jump: false, frames: n };
      if (k === "JR" || k === "J") return { ix: 1, jump: true, frames: n };
      if (k === "JL") return { ix: -1, jump: true, frames: n };
      return { ix: 0, jump: false, frames: n };
    });
  }

  function assert(cond, msg, bag) {
    if (!cond) bag.push(msg);
  }

  function unitTests() {
    const fails = [];
    assert(padRow("ab", 4) === "ab..", "padRow pads", fails);
    assert(padRow("abcdef", 4) === "abcd", "padRow slices", fails);
    const saved = { mode, levelIndex, deaths, testMode };
    testMode = true;
    loadLevel(0);
    assert(world.cols >= 30, "level width", fails);
    assert(!!world.door, "level 0 has door", fails);
    assert(Number.isFinite(player.x) && Number.isFinite(player.y), "spawn finite", fails);
    assert(isSolid("#") && isSolid("=") && isSolid("i") && isSolid("B"), "solids", fails);
    assert(!isSolid("*") && !isSolid(".") && !isSolid("^"), "non-solids", fails);
    assert(tileAt(-10, 0) === "#", "oob is solid", fails);
    assert(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), "overlap", fails);
    assert(!rectsOverlap({ x: 0, y: 0, w: 4, h: 4 }, { x: 8, y: 8, w: 4, h: 4 }), "no overlap", fails);
    const before = world.tiles[9][5];
    setTiles(5, 9, 1, 1, ".");
    assert(world.tiles[9][5] === ".", "setTiles writes", fails);
    world.tiles[9][5] = before;
    runAction(["shake", 4]);
    assert(world.shake === 4, "shake action", fails);
    runAction(["reverse", true]);
    assert(world.reverse === true, "reverse action", fails);
    runAction(["reverse", false]);
    runAction(["gravity", -0.55]);
    assert(world.gravity === -0.55, "gravity action", fails);
    runAction(["gravity", 0.55]);
    runAction(["saw", 3, 8, 1, 0]);
    assert(world.saws.length >= 1, "saw action", fails);
    runAction(["laser", 4, 7, 3, 0.2]);
    assert(world.lasers.length === 1, "laser action", fails);
    runAction(["push", 1, 0]);
    assert(player.vx !== 0, "push action", fails);
    runAction(["queue", 0.1, ["say", "Q"]]);
    assert(world.queued.length === 1, "queue action", fails);
    runAction(["dust", 2, 8, 2]);
    assert(world.particles.length > 4, "dust action", fails);
    runAction(["flash", 0.2]);
    assert(world.flash > 0, "flash action", fails);
    runAction(["glow", 4, 7, 3, 0.2]);
    assert(world.lasers.some((l) => l.fake), "glow action", fails);
    runAction(["lie", "NOPE"]);
    assert(world.hudText === "NOPE", "lie action", fails);
    runAction(["whisper", "ok"]);
    burst(10, 10, "#fff", 4, 2);
    assert(world.particles.length >= 4, "burst", fails);
    const ev = { if: { x: 0 }, fired: false, once: true, do: [["say", "T"]] };
    world.events.push(ev);
    matchEvent(ev);
    assert(matchEvent({ if: { x: 99 } }) === false, "match x gate", fails);
    assert(matchEvent({ if: { air: true } }) === !player.onGround, "air gate", fails);
    world.events = [{ if: { x: 0 }, delay: 0.25, once: true, fired: false, do: [["shake", 11]] }];
    world.shake = 0;
    step();
    assert(world.shake !== 11, "delay does not fire instantly", fails);
    die("TEST");
    assert(player.dead === true, "die sets dead", fails);
    const prevDeaths = deaths;
    die("TEST2");
    assert(deaths === prevDeaths, "die is idempotent", fails);
    assert(deathShow == null, "testMode skips roast", fails);
    assert(deathKind("SAW SAID HI") === "saw", "kind saw", fails);
    assert(deathKind("BEAM") === "laser", "kind laser", fails);
    assert(deathKind("GREED") === "greed", "kind greed", fails);
    assert(deathKind("BRICK") === "brick", "kind brick", fails);
    assert(deathKind("HIDDEN TEETH") === "teeth", "kind teeth", fails);
    if (window.DeathRoast) {
      const kinds = ["spike","ceiling","jumpspike","saw","laser","hole","jumpfall","teeth","greed","brick","fake","reverse","still","jump","generic"];
      for (const k of kinds) {
        try {
          const s = window.DeathRoast.start(k, {
            x: player.x, y: player.y, facing: 1, squash: 0,
            insult: "X", levelName: "T", taunt: "T", seed: 3,
            sawX: player.x, sawY: player.y,
          });
          for (let i = 0; i < 12; i++) window.DeathRoast.tick(s, roastApi());
          assert(s.t > 0, "roast ticks " + k, fails);
        } catch (e) {
          fails.push("roast " + k + ": " + e.message);
        }
      }
    }

    for (const type of ACTIONS) {
      try {
        if (type === "fill") runAction(["fill", 0, 0, 1, 1, "#"]);
        else if (type === "hole") runAction(["hole", 0, 0, 1, 1]);
        else if (type === "spikes") runAction(["spikes", 0, 0, 1]);
        else if (type === "clearRowHazards") runAction(["clearRowHazards", 0]);
        else if (type === "moveDoor") runAction(["moveDoor", 1, 8]);
        else if (type === "chase") runAction(["chase", 0]);
        else if (type === "teleport") runAction(["teleport", 1, 8]);
        else if (type === "platform") runAction(["platform", 2, 8, 2, 1, 1, 8]);
        else if (type === "drop") runAction(["drop", 2, 0]);
        else if (type === "slow") runAction(["slow", 1]);
        else if (type === "wind") runAction(["wind", 0]);
        else if (type === "lock") runAction(["lock", 0.01]);
        else if (type === "hideDoor") runAction(["hideDoor"]);
        else if (type === "showDoor") runAction(["showDoor"]);
        else if (type === "swapDoor") runAction(["swapDoor"]);
        else if (type === "say") runAction(["say", "ok"]);
        else if (type === "sfx") runAction(["sfx", "land"]);
        else if (type === "queue") runAction(["queue", 9, ["say", "late"]]);
        else if (type === "dust") runAction(["dust", 2, 8, 2]);
        else if (type === "flash") runAction(["flash", 0.01]);
        else if (type === "whisper") runAction(["whisper", "ok"]);
        else if (type === "glow") runAction(["glow", 4, 7, 3, 0.1]);
        else if (type === "lie") runAction(["lie", "??"]);
      } catch (e) {
        fails.push("action " + type + ": " + e.message);
      }
    }

    testMode = saved.testMode;
    deaths = saved.deaths;
    mode = saved.mode;
    if (saved.mode === "play") loadLevel(saved.levelIndex);
    return fails;
  }

  function smokeAllLevels() {
    const report = [];
    const saved = { mode, levelIndex, deaths, testMode };
    testMode = true;
    for (let i = 0; i < window.LEVELS.length; i++) {
      const def = window.LEVELS[i];
      const item = { i, name: def.name, ok: true, errors: [] };
      try {
        if (!def.events || !def.events.length) {
          item.errors.push("no traps");
        } else {
          const want = (window.SURGE_WORLDS && (def.dim || dimIndex))
            ? (def.dim === 1 || (!def.dim && dimIndex === 1) ? def.events.length : window.SURGE_WORLDS.trapCount(def.dim || dimIndex))
            : 10;
          if (def.dim > 1 && def.events.length !== window.SURGE_WORLDS.trapCount(def.dim)) {
            item.errors.push("expected " + window.SURGE_WORLDS.trapCount(def.dim) + " traps, got " + def.events.length);
          }
          if ((!def.dim || def.dim === 1) && def.events.length !== 10 && want === 10) {
            item.errors.push("expected 10 traps, got " + def.events.length);
          }
        }
        loadLevel(i);
        if (!world.door) item.errors.push("no real door");
        const under = tileAt(player.x + player.w / 2, player.y + player.h + 1);
        if (!isSolid(under) && under !== ".") item.errors.push("spawn tile odd: " + under);
        for (const ev of def.events) {
          for (const a of ev.do || []) {
            if (!ACTIONS.has(a[0]) && a[0] !== "queue") item.errors.push("bad action " + a[0]);
            if (a[0] === "queue") {
              for (const nested of a.slice(2)) {
                if (!ACTIONS.has(nested[0])) item.errors.push("bad queued action " + nested[0]);
              }
            }
          }
        }
        for (let f = 0; f < 40; f++) step();
        if (!Number.isFinite(player.x) || !Number.isFinite(player.y)) item.errors.push("NaN physics");
        loadLevel(i);
        for (const ev of world.events) {
          for (const a of ev.do) runAction(a);
        }
        if (!Number.isFinite(player.x)) item.errors.push("NaN after firing traps");
      } catch (e) {
        item.errors.push(e.message);
      }
      item.ok = item.errors.length === 0;
      report.push(item);
    }
    if (window.SURGE_WORLDS) {
      for (let d = 1; d <= 20; d++) {
        try {
          const lvls = window.SURGE_WORLDS.generate(d);
          const n = window.SURGE_WORLDS.roomCount(d);
          const t = window.SURGE_WORLDS.trapCount(d);
          if (lvls.length !== n) report.push({ i: "D" + d, name: "count", ok: false, errors: ["rooms " + lvls.length + " != " + n] });
          const last = lvls[lvls.length - 1];
          if (d > 1 && lvls[0].events.length !== t) {
            report.push({ i: "D" + d, name: lvls[0].name, ok: false, errors: ["traps " + lvls[0].events.length + " != " + t] });
          }
          if (d > 1 && last.events.length !== t + 4 && last.events.length !== t) {
            report.push({ i: "D" + d, name: last.name, ok: false, errors: ["boss traps " + last.events.length] });
          }
        } catch (e) {
          report.push({ i: "D" + d, name: "generate", ok: false, errors: [e.message] });
        }
      }
    }
    testMode = saved.testMode;
    deaths = saved.deaths;
    mode = saved.mode;
    if (saved.mode === "play") loadLevel(saved.levelIndex);
    else if (saved.mode === "title") {
      try { loadLevel(0); } catch (_) { /* title can stay unloaded */ }
    }
    return report;
  }

  function botThink() {
    const px = player.x + player.w / 2;
    const feet = player.y + player.h + 1;
    const wantDir = (() => {
      if (world.fakeDoor && world.doorOpened !== "fake" && world.maxX < (world.fakeDoor.x + 20)) {
        return Math.sign(world.fakeDoor.x + 10 - px) || 1;
      }
      if (world.door) return Math.sign(world.door.x + 10 - px) || 1;
      return 1;
    })();
    const ix = world.reverse ? -wantDir : wantDir;
    const probe = px + wantDir * 22;
    const probe2 = px + wantDir * 38;
    const floor1 = tileAt(probe, feet);
    const floor2 = tileAt(probe2, feet);
    const body1 = tileAt(probe, player.y + 10);
    const safeDrop = isSolid(tileAt(probe, feet + TILE)) || tileAt(probe, feet + TILE) === "i";
    const ceiling = tileAt(px, player.y - 8) === "v" || tileAt(probe, player.y - 8) === "v";
    const deadlyFloor = tileAt(px, feet) === "!" || tileAt(probe, feet) === "!";
    if (deadlyFloor) return { ix: 0, jump: false };
    let jump = false;
    const gap = (!isSolid(floor1) && floor1 !== "i") || floor1 === "^" || floor2 === "^" || (!isSolid(floor2) && floor2 !== "i");
    if (gap && !ceiling && !safeDrop) jump = true;
    if ((floor1 === "^" || body1 === "^") && !ceiling) jump = true;
    if (world.rules.explodeCoins) {
      for (const c of world.coins) {
        if (!c.dead && Math.abs(c.x - (px + wantDir * 20)) < 18 && Math.abs(c.y - (player.y + 8)) < 24) jump = false;
      }
    }
    return { ix, jump };
  }

  function playtestLevel(i) {
    const def = window.LEVELS[i];
    const saved = { mode, levelIndex, deaths, testMode };
    testMode = true;
    useBot = true;
    deaths = 0;
    mode = "play";
    loadLevel(i);
    let frames = 0;
    const max = 60 * 16;
    while (frames < max && !player.win && !player.dead) {
      const thought = botThink();
      botIx = thought.ix;
      botJump = thought.jump;
      step();
      frames += 1;
    }
    const result = {
      i,
      name: def.name,
      win: !!player.win,
      dead: !!player.dead,
      reason: world.deathReason,
      x: Math.round(player.x),
      frames,
      traps: world.trapsFired,
    };
    useBot = false;
    botIx = 0;
    botJump = false;
    testMode = saved.testMode;
    deaths = saved.deaths;
    mode = saved.mode;
    if (saved.mode === "play") loadLevel(saved.levelIndex);
    return result;
  }

  function playtestAll() {
    return window.LEVELS.map((_, i) => playtestLevel(i));
  }

  function playSolLevel(i, solOverride) {
    const def = window.LEVELS[i];
    const saved = { mode, levelIndex, deaths, testMode };
    testMode = true;
    useBot = true;
    deaths = 0;
    mode = "play";
    loadLevel(i);
    const steps = parseSol(solOverride || def.sol || "");
    let frames = 0;
    const max = 60 * 28;
    let si = 0;
    let left = steps.length ? steps[0].frames : 0;
    while (frames < max && !player.win && !player.dead) {
      if (si < steps.length) {
        botIx = steps[si].ix;
        botJump = steps[si].jump;
        left -= 1;
        if (left <= 0) {
          si += 1;
          left = si < steps.length ? steps[si].frames : 0;
        }
      } else {
        const thought = botThink();
        botIx = thought.ix;
        botJump = thought.jump;
      }
      step();
      frames += 1;
    }
    const result = {
      i,
      name: def.name,
      win: !!player.win,
      dead: !!player.dead,
      reason: world.deathReason || "",
      x: Math.round(player.x),
      y: Math.round(player.y),
      frames,
      maxX: Math.round(world.maxX),
      traps: world.trapsFired,
      sol: solOverride || def.sol || "",
    };
    useBot = false;
    botIx = 0;
    botJump = false;
    testMode = saved.testMode;
    deaths = saved.deaths;
    mode = saved.mode;
    if (saved.mode === "play") loadLevel(saved.levelIndex);
    return result;
  }

  function playSolAll() {
    return window.LEVELS.map((_, i) => playSolLevel(i));
  }

  function searchSol(i, tries) {
    const base = [
      "R80 JR18 R40 JR16 R40 JR16 R50",
      "R90 JR20 R50 JR18 R60",
      "R70 JR16 R30 JR16 R30 JR16 R50",
      "R100 JR18 R80",
      "R60 JR18 R25 JR18 R25 JR18 R40",
      "W120 R80 JR18 R40 JR16 R50",
      "W130 R90 JR20 R50 JR16 R40",
      "R80 JR18 R50 W10 L80 W40 JL22 L30 R20",
      "R90 JR18 R60 W8 L90 W40 JL24 L25 R25",
      "R55 R40 JR16 R40 JR16 R50",
      "R40 JR14 R20 R70 JR16 R40",
      "R50 JR16 R40 R90 JR18 R40",
      "R70 R50 R60",
      "R55 JR18 R45 JR16 R70",
      "R85 JR16 R55 W8 L85 JL22 L20 R20",
      "R40 JR16 R30 JR20 R50 W8 L30 JL28 L40 R20",
      "R45 JR16 R20 R80 JR18 R30",
      "R35 JR14 R25 JR18 R40 JR16 R50",
    ];
    const def = window.LEVELS[i];
    if (def.sol) base.unshift(def.sol);
    const max = tries || base.length;
    for (let t = 0; t < max && t < base.length; t++) {
      const r = playSolLevel(i, base[t]);
      if (r.win) return Object.assign(r, { found: base[t] });
    }
    // Brute a few walk/jump timings for straight levels
    const walks = [50, 60, 70, 80, 90, 100, 110];
    const jumps = [14, 16, 18, 20, 22];
    for (const w of walks) {
      for (const j of jumps) {
        const sol = `R${w} JR${j} R40 JR${j} R40 JR${j} R60`;
        const r = playSolLevel(i, sol);
        if (r.win) return Object.assign(r, { found: sol });
      }
    }
    for (const w of walks) {
      const sol = `W120 R${w} JR18 R50 JR16 R60`;
      const r = playSolLevel(i, sol);
      if (r.win) return Object.assign(r, { found: sol });
    }
    for (const w of [70, 80, 90, 100]) {
      for (const back of [60, 70, 80, 90]) {
        for (const wait of [20, 36, 48, 60]) {
          const sol = `R${w} JR18 R40 W8 L${back} W${wait} JL22 L25 R25`;
          const r = playSolLevel(i, sol);
          if (r.win) return Object.assign(r, { found: sol });
        }
      }
    }
    return playSolLevel(i);
  }

  function searchSolAll() {
    return window.LEVELS.map((_, i) => {
      const r = searchSol(i);
      return {
        i: r.i, name: r.name, win: r.win, dead: r.dead, reason: r.reason,
        found: r.found || null, sol: r.sol, x: r.x, frames: r.frames,
      };
    });
  }

  function runSelfTest() {
    const units = unitTests();
    const smoke = smokeAllLevels();
    const play = playtestAll();
    const sols = playSolAll();
    return {
      units,
      unitOk: units.length === 0,
      smoke,
      smokeOk: smoke.every((s) => s.ok),
      play,
      playWins: play.filter((p) => p.win).length,
      sols,
      solWins: sols.filter((p) => p.win).length,
    };
  }

  window.__GAME = {
    hold, keys, player, world, loadLevel, startGame, enterDimension, step, die, winLevel,
    runAction, matchEvent, tileAt, isSolid, setTiles, parseSol, deathKind,
    unitTests, smokeAllLevels, playtestLevel, playtestAll, playSolLevel, playSolAll,
    searchSol, searchSolAll, runSelfTest,
  };

  refreshRecords();
  requestAnimationFrame(loop);
})();
