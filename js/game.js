(() => {
  const TILE = 32;
  let VIEW_W = 960;
  let VIEW_H = 540;
  const FIXED = 1 / 60;
  // Scratch boxes reused on hit/draw hot paths so boss fights don't allocate every frame.
  const HIT = { x: 0, y: 0, w: 0, h: 0 };
  const HAND_PT = { x: 0, y: 0 };
  const RIBBON_N = 10;
  const RIBBON_PTS = [];
  for (let ri = 0; ri <= RIBBON_N; ri++) RIBBON_PTS.push({ x: 0, y: 0, nx: 0, ny: 0, w: 0 });
  const SIDE_PAIR = [-1, 1];
  const ACTIONS = new Set([
    "hole", "fill", "spikes", "clearRowHazards", "shake", "say", "sfx",
    "reverse", "gravity", "moveDoor", "chase", "saw", "queue",
    "teleport", "push", "lock", "laser", "wind", "platform", "drop",
    "hideDoor", "showDoor", "swapDoor", "slow",
    "dust", "flash", "whisper", "glow", "lie",
    // Rare hard traps — sparse placement only.
    "slip", "jumpCut", "magnet", "blink", "clamp",
    "echo", "sticky", "rift", "blackout", "heavy",
    // Entity / horror traps — even rarer, technical.
    "stalker", "drone", "rocket", "voidFog", "watcher",
    "sentry", "swarm", "phantom", "huntLight", "crushBot",
    "qte",
    // Apex traps. Harder than the horror set, and common from dimension 10.
    "reaper", "salvo", "pincer", "guillotine", "abyss", "eclipse", "snare", "orbitSaw",
    "crossfire", "leech", "shardRain", "wraith", "mineLine", "gravLock", "seeker",
    "collapse", "barbedWind", "mirrorBolt", "pitBeast", "judgment",
  ]);

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const lightCookieCache = new Map();
  let brickShadeBake = null;
  const doorGradCache = { key: "", aura: null, panel: null, x: 0, y: 0 };

  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    // Cap DPR at 2 — keep retina sharpness without 3x pixel blowups.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextW = Math.max(640, Math.floor(rect.width * dpr));
    const nextH = Math.max(360, Math.floor(rect.height * dpr));
    if (nextW === VIEW_W && nextH === VIEW_H && canvas.width === nextW && canvas.height === nextH) return;
    VIEW_W = nextW;
    VIEW_H = nextH;
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    if (window.SURGE_VOID && window.SURGE_VOID.invalidate) window.SURGE_VOID.invalidate();
    brickShadeBake = null;
    lightCookieCache.clear();
    doorGradCache.key = "";
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
  const BIND_DEFAULTS = {
    left: ["ArrowLeft", "KeyA"],
    right: ["ArrowRight", "KeyD"],
    jump: ["Space", "ArrowUp", "KeyW"],
    dash: ["ShiftLeft", "ShiftRight"],
    retry: ["KeyR"],
    pause: ["Escape"],
    mute: ["KeyM"],
  };
  const BIND_LABELS = {
    left: "LEFT",
    right: "RIGHT",
    jump: "JUMP",
    dash: "DASH",
    retry: "RETRY",
    pause: "PAUSE",
    mute: "MUTE",
  };
  let binds = null;
  let bindCapture = null;
  let settingsReturn = "title";
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
      this.ensureBus();
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
      if (on) this.silenceSpace();
    },
    // Stacked colors. Each kind is one instrument, not a new rhythm.
    inst(freq, t, dur, kind, vol) {
      const v = vol || 0.05;
      let f = Math.max(28, freq);
      let home = 0;
      const held = kind === "pad" || kind === "choir" || kind === "organ";
      if (held && this._suspend && dur >= 0.45) {
        home = f;
        f = f * Math.pow(2, 2 / 12);
      }
      const land = (partial) => (home ? partial * home / (f) : 0);
      if (kind === "bell") {
        this.tone(f, t, dur * 0.8, "sine", v, 0, 0.01);
        this.tone(f * 2.01, t, dur * 0.45, "sine", v * 0.28, 0, 0.008);
        this.tone(f * 2.97, t, dur * 0.25, "triangle", v * 0.1, 0, 0.006);
      } else if (kind === "organ") {
        this.tone(f, t, dur, "sine", v, land(f), 0.06);
        this.tone(f * 2, t, dur, "sine", v * 0.34, land(f * 2), 0.07);
        this.tone(f * 3, t, dur, "sine", v * 0.12, land(f * 3), 0.08);
      } else if (kind === "bass") {
        this.tone(f, t, dur, "sine", v, 0, 0.015);
        this.tone(f * 2, t, dur * 0.6, "triangle", v * 0.18, 0, 0.02);
      } else if (kind === "pluck") {
        this.voice(f, t, dur * 0.35, "triangle", v);
        this.voice(f * 2, t, dur * 0.16, "sine", v * 0.16);
      } else if (kind === "brass") {
        this.tone(f * 1.04, t, dur, "sawtooth", v * 0.48, f, 0.05);
        this.tone(f * 1.5, t, dur * 0.8, "triangle", v * 0.2, 0, 0.06);
      } else if (kind === "choir") {
        this.tone(f, t, dur, "sine", v * 0.6, land(f), 0.14);
        this.tone(f * 1.006, t, dur, "sine", v * 0.36, land(f * 1.006), 0.16);
        this.tone(f * 1.498, t, dur, "triangle", v * 0.14, land(f * 1.498), 0.18);
      } else if (kind === "chip") {
        this.voice(f, t, dur, "square", v * 0.85);
        this.tone(f * 2, t, dur * 0.4, "triangle", v * 0.12, 0, 0.01);
      } else if (kind === "glass") {
        this.tone(f, t, dur, "sine", v, 0, 0.02);
        this.tone(f * 2.003, t, dur * 0.55, "sine", v * 0.22, 0, 0.015);
      } else {
        this.tone(f, t, dur, "sine", v, land(f), 0.18);
        this.tone(f * 1.004, t, dur, "triangle", v * 0.36, land(f * 1.004), 0.2);
      }
    },
    tone(freq, t, dur, type, vol, slide, attack) {
      if (!this.ctx || !this.musicGain) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const peak = Math.max(0.0002, vol || 0.05);
      const span = this.gridDur(Math.max(0.02, dur || 0));
      const atk = Math.min(span * 0.45, Math.max(0.004, attack || 0.02));
      const holdAt = t + atk + (span - atk) * 0.55;
      const end = t + span;
      o.type = type || "sine";
      o.frequency.setValueAtTime(Math.max(20, freq), t);
      if (slide && end > t) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), end);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + atk);
      if (holdAt > t + atk && holdAt < end) g.gain.setValueAtTime(peak * 0.82, holdAt);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      o.connect(g);
      g.connect(this.musicGain);
      o.start(t);
      o.stop(end + 0.04);
    },
    voice(freq, t, dur, type, vol, slide) {
      if (!this.ctx || !this.musicGain) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || "sine";
      const end = t + this.gridDur(Math.max(0.02, dur || 0));
      o.frequency.setValueAtTime(Math.max(20, freq), t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), end);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      o.connect(g);
      g.connect(this.musicGain);
      o.start(t);
      o.stop(end + 0.03);
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
      const trackPack = window.SURGE_TRACKS;
      const track = trackPack ? trackPack.musicFor(d) : null;
      this.theme = {
        bpm: th ? th.bpm : 128,
        root: th ? th.root : 92.5,
        dim: d || 1,
        track: track || null,
      };
      this._prevCh = null;
      if (this.drone && this.ctx && th) {
        const base = Math.max(28, (th.root || 92.5) * 0.35);
        try {
          this.drone.o.frequency.setTargetAtTime(base, this.ctx.currentTime, 0.2);
          this.drone.o2.frequency.setTargetAtTime(base * 2, this.ctx.currentTime, 0.2);
        } catch (_) { /* ignore */ }
      }
    },
    restartMusic() {
      // Keep the running clock so a new world or boss stays on the same pulse.
      if (this._musicOn && this.musicId) return;
      if (this.musicId) clearTimeout(this.musicId);
      this._musicOn = false;
      this._step = 0;
      this._prevCh = null;
      if (this.unlocked && this.ctx) this.music();
    },
    hzFrom(rootHz, semitone) {
      return rootHz * Math.pow(2, semitone / 12);
    },
    // Note length in seconds, snapped so the release lands on a beat.
    gridDur(dur) {
      const bpm = (this.theme && this.theme.bpm) || 128;
      const six = this._six || (60 / bpm / 4);
      if (!(dur > 0)) return six * 0.9;
      const steps = dur / six;
      if (steps <= 2.25) return Math.min(dur, six * 1.85);
      let beats = Math.round(steps / 4);
      if (beats < 1) beats = 1;
      if (beats > 4) beats = 4;
      return beats * 4 * six * 0.92;
    },
    // Walk the mode so a phrase stays in key instead of jumping by raw semitones.
    scaleWalk(semi, steps, scale) {
      const pcs = (scale && scale.length) ? scale : [0, 2, 3, 5, 7];
      const norm = [];
      for (let k = 0; k < pcs.length; k++) norm.push(((pcs[k] % 12) + 12) % 12);
      const rounded = Math.round(semi);
      const pc = ((rounded % 12) + 12) % 12;
      let idx = 0;
      let best = 99;
      for (let k = 0; k < norm.length; k++) {
        const d = Math.min(Math.abs(norm[k] - pc), 12 - Math.abs(norm[k] - pc));
        if (d < best) { best = d; idx = k; }
      }
      const dest = norm[(idx + (steps | 0) + norm.length * 8) % norm.length];
      let out = Math.floor(rounded / 12) * 12 + dest;
      while (out - rounded > 6) out -= 12;
      while (rounded - out > 6) out += 12;
      return out;
    },
    // Keep each chord tone near where that voice already was.
    leadVoices(ch) {
      const prev = this._prevCh;
      const next = ch.map((f, i) => {
        let cand = f;
        if (prev && prev[i]) {
          let best = f;
          let bestD = Infinity;
          for (let k = -2; k <= 2; k++) {
            const q = f * Math.pow(2, k);
            if (q < 48 || q > 1600) continue;
            const d = Math.abs(Math.log(q / prev[i]));
            if (d < bestD) { bestD = d; best = q; }
          }
          cand = best;
        }
        if (i === 0) {
          while (cand > 150) cand *= 0.5;
          while (cand < 42) cand *= 2;
        }
        return cand;
      });
      this._prevCh = next;
      return next;
    },
    // Drone stays put while the chords move: a pedal, fifth then octave.
    pedal(rootHz, t, bar) {
      if (!this.drone || !this.ctx) return;
      const root = Math.max(28, Math.min(86, rootHz * (rootHz > 190 ? 0.25 : 0.5)));
      const upper = (bar % 8 < 4) ? root * 1.498 : root * 2;
      try {
        this.drone.o.frequency.setTargetAtTime(root, t, 0.28);
        this.drone.o2.frequency.setTargetAtTime(Math.min(220, upper), t, 0.4);
      } catch (_) { /* ignore */ }
    },
    // Contrary step, snapped into the mode so the answer belongs to the tune.
    contrary(motif, bar, scale) {
      const n = motif.length || 1;
      const i = ((bar % n) + n) % n;
      const cur = +motif[i] || 0;
      const prev = +motif[(i - 1 + n) % n] || 0;
      const raw = prev - (cur - prev);
      const pcs = (scale && scale.length) ? scale : motif.map((x) => ((+x % 12) + 12) % 12);
      const pc = ((raw % 12) + 12) % 12;
      let best = pcs[0];
      let bestD = 99;
      for (let k = 0; k < pcs.length; k++) {
        const p = ((pcs[k] % 12) + 12) % 12;
        const d = Math.min(Math.abs(p - pc), 12 - Math.abs(p - pc));
        if (d < bestD) { bestD = d; best = p; }
      }
      let semi = Math.round((cur - 3) / 12) * 12 + best;
      while (semi > cur - 1) semi -= 12;
      while (semi < cur - 14) semi += 12;
      return semi;
    },
    // One answer under the lead, then its echo. No extra drums.
    weave(c, rootHz, motif, scale) {
      const s = c.s;
      const bar = c.bar;
      const line = motif || c.motif;
      if (!line || !line.length) return;
      const semi = this.contrary(line, bar, scale);
      const phrase = bar % 8;
      if (s === 5) {
        const f = this.hzFrom(rootHz, semi + 12);
        if (phrase === 7) this.tone(f * Math.pow(2, 1 / 12), c.t, 0.28, "sine", 0.018, f, 0.04);
        else this.inst(f, c.t, 0.26, "bell", 0.018);
      } else if (s === 13 && bar % 2 === 1) {
        this.inst(this.hzFrom(rootHz, semi), c.t, 0.4, "glass", 0.012);
      } else if (s === 15 && phrase === 7 && scale && c.track && c.track.prog) {
        const next = c.track.prog[(bar + 1) % c.track.prog.length];
        this.inst(this.hzFrom(rootHz, (next[0] || 0) - 12), c.t, 0.2, "bass", 0.035);
      }
    },
    playStep(step, t) {
      this._six = 60 / (((this.theme && this.theme.bpm) || 128)) / 4;
      const rootHz = (this.theme && this.theme.root) || 92.5;
      const dim = (this.theme && this.theme.dim) || 1;
      const track = (this.theme && this.theme.track)
        || (window.SURGE_TRACKS && window.SURGE_TRACKS.musicFor(dim))
        || { style: "voidAmbient", prog: [[0, 7, 12]], scale: [0, 2, 3, 5, 7], motif: [0, 7, 12, 7] };
      const style = track.style || "voidAmbient";
      const bar = Math.floor(step / 16);
      const s = step % 16;
      const heat = Math.min(1, (world.trapsFired || 0) / 8);
      let ch;
      if (window.SURGE_TRACKS) ch = window.SURGE_TRACKS.chordsFor(rootHz, dim)[bar % track.prog.length].slice();
      else ch = [rootHz, rootHz * 1.189, rootHz * 1.498, rootHz * 2];
      const turn = bar % 4;
      if (turn === 1 && ch.length > 2) ch = [ch[1], ch[2], ch[0] * 2];
      else if (turn === 2 && ch.length > 1) ch = [ch[0], ch[2] || ch[1] * 1.5, (ch[1] || ch[0]) * 2];
      else if (turn === 3) ch = [ch[0], (ch[2] || ch[1] || ch[0] * 1.5), (ch[1] || ch[0] * 1.25) * 2];
      ch = this.leadVoices(ch);
      this._suspend = bar % 8 === 7;
      const rawMotif = track.motif || [0, 2, 4, 5];
      const ph = ((bar % 8) + 8) % 8;
      const walk = ph < 2 ? 0 : ph < 4 ? 1 : ph < 6 ? 2 : -1;
      const motif = [];
      for (let mi = 0; mi < rawMotif.length; mi++) {
        const src = rawMotif[(mi + (ph >= 4 ? 1 : 0)) % rawMotif.length];
        motif.push(this.scaleWalk(src, walk, track.scale));
      }
      const ctx = { step, t, bar, s, rootHz, ch, track, heat, scale: track.scale || [0, 2, 3, 5, 7], motif };
      if (this.theme && this.theme.boss) {
        ctx.boss = this.theme.bossTrack
          || (window.SURGE_TRACKS && window.SURGE_TRACKS.bossMusic(dim))
          || null;
        const bossRoot = (ctx.boss && ctx.boss.root) || rootHz;
        if (s === 0) this.pedal(bossRoot, t, bar);
        if (this.theme.rage) {
          this._trk.bossRage.call(this, ctx);
        } else {
          const bed = (ctx.boss && ctx.boss.bed) || "rush";
          const bedFn = this._trk["boss_" + bed] || this._trk.boss_rush || this._trk.bossRush;
          bedFn.call(this, ctx);
        }
        // No world-motif weave — that made every fight sound like the same room.
        return;
      }
      if (s === 0) this.pedal(rootHz, t, bar);
      const fn = this._trk[style] || this._trk.voidAmbient;
      fn.call(this, ctx);
      if (!(track.style === "needle" && s === 15)) this.weave(ctx, rootHz, motif, ctx.scale);
    },
    playBossBed(c) {
      const t = c.t;
      const s = c.s;
      const bar = c.bar;
      const rootHz = c.rootHz;
      const final = !!(this.theme && this.theme.final);
      if (s % 8 === 0) {
        this.voice(final ? 40 : 50, t, 0.34, "sine", final ? 0.48 : 0.32, 18);
        this.noiseHit(t, 0.08, final ? 0.12 : 0.07, final ? 220 : 460);
      }
      if (s === 6 || s === 14) this.noiseHit(t, 0.05, 0.1, final ? 1400 : 2800);
      if (s === 0) this.voice(rootHz * 0.5, t, final ? 1.6 : 0.42, "sawtooth", final ? 0.09 : 0.05);
      if (!final && s === 4) this.voice(rootHz * 1.5, t, 0.14, "square", 0.045);
      if (final && (s === 0 || s === 8)) {
        this.voice(rootHz * 2, t, 1.7, "sine", 0.05);
        this.voice(rootHz * 3, t, 1.2, "triangle", 0.022);
        if (bar % 4 === 3 && s === 8) this.voice(rootHz * 4, t, 0.8, "sine", 0.03);
      }
    },
    // Each style is a different piece of music — not shared drum/pad skeletons.
    _trk: {
      // Null / rush bosses: four-on-the-floor, chip lead.
      boss_rush(c) {
        const t = c.t;
        const s = c.s;
        const bar = c.bar;
        const b = c.boss || {};
        const root = b.root || 196;
        const kicks = b.kick || [0, 4, 8, 12];
        const wave = b.wave || "square";
        if (kicks.indexOf(s) >= 0) {
          this.voice(Math.max(40, root * 0.45), t, 0.09, "sine", 0.46, 42);
          this.noiseHit(t, 0.04, 0.1, 140 + (root % 90));
        }
        const hat = b.hat || 0;
        if (hat > 2 && s % hat === hat - 1) this.noiseHit(t, 0.02, 0.04, 7000);
        const bass = b.bass || [0, 0, 3, 7];
        const bassStep = b.bassStep || 2;
        const color = wave === "sine" ? "bell" : wave === "triangle" ? "pluck" : wave === "sawtooth" ? "brass" : "chip";
        if (s === 0) {
          this.inst(root * 0.5, t, 1.4, "pad", 0.035);
          this.inst(root * 0.75, t, 1.4, "pad", 0.02);
        }
        if (s % bassStep === 0) {
          const f = this.hzFrom(root, bass[(s / bassStep + bar) % bass.length] - 12);
          this.inst(f, t, 0.12 + bassStep * 0.02, "bass", 0.11);
        }
        const lead = b.lead || [0, 3, 7, 10];
        if (s % 4 === 0) {
          const f = this.hzFrom(root, lead[((s / 4) + bar) % lead.length] + 12);
          this.inst(f, t, 0.28, color, 0.045);
        } else if (s % 4 === 2) {
          const idx = ((s / 4) + bar) % lead.length;
          const axis = lead[0];
          const inv = axis - (lead[idx] - axis);
          const f = this.hzFrom(root, inv + 12);
          this.inst(f, t, 0.16, color === "bell" ? "glass" : "pluck", 0.022);
        } else if (bar % 8 === 7 && s === 1) {
          const idx = bar % lead.length;
          const f = this.hzFrom(root, lead[idx] + 12);
          this.inst(f, t, 0.12, "glass", 0.016);
        }
      },
      bossRush(c) { this._trk.boss_rush.call(this, c); },
      // Sparse, slow, long tones.
      boss_crawl(c) {
        const t = c.t, s = c.s, bar = c.bar, b = c.boss || {};
        const root = b.root || 82;
        const lead = b.lead || [0, -2, 3, 5];
        if (s === 0 || s === 8) {
          this.voice(Math.max(32, root * 0.4), t, 0.28, "sine", 0.42, 18);
          this.noiseHit(t, 0.12, 0.08, 180);
        }
        if (s === 0) {
          this.inst(root * 0.5, t, 3.2, "choir", 0.05);
          this.inst(root, t, 2.8, "pad", 0.03);
        }
        if (s === 4 || s === 12) {
          const f = this.hzFrom(root, lead[(bar + (s === 12 ? 2 : 0)) % lead.length]);
          this.inst(f, t, 1.4, "organ", 0.035);
        }
        if (s === 10 && bar % 2 === 1) this.inst(this.hzFrom(root, lead[bar % lead.length] + 12), t, 0.9, "bell", 0.02);
      },
      // Heavy offbeat stomps, brass hits.
      boss_stomp(c) {
        const t = c.t, s = c.s, bar = c.bar, b = c.boss || {};
        const root = b.root || 110;
        const kicks = b.kick || [0, 6, 8, 14];
        const lead = b.lead || [0, 1, 6, 1];
        if (kicks.indexOf(s) >= 0) {
          this.voice(Math.max(36, root * 0.35), t, 0.16, "sine", 0.55, 26);
          this.noiseHit(t, 0.1, 0.18, 320);
        }
        if (s === 4 || s === 12) this.noiseHit(t, 0.08, 0.12, 1400);
        if (s % 4 === 0) {
          const f = this.hzFrom(root, (b.bass || [0, 0, 5, 7])[(s / 4 + bar) % 4] - 12);
          this.inst(f, t, 0.22, "bass", 0.14);
        }
        if (s === 2 || s === 10) {
          this.inst(this.hzFrom(root, lead[(bar + s) % lead.length] + 7), t, 0.2, "brass", 0.05);
        }
        if (s === 0) this.inst(root * 0.5, t, 1.2, "pad", 0.025);
      },
      // Syncopated pulse, triangle plucks.
      boss_pulse(c) {
        const t = c.t, s = c.s, bar = c.bar, b = c.boss || {};
        const root = b.root || 246;
        const lead = b.lead || [12, 7, 15, 10];
        const kicks = b.kick || [2, 6, 10, 14];
        if (kicks.indexOf(s) >= 0) {
          this.voice(Math.max(40, root * 0.42), t, 0.06, "sine", 0.4, 50);
          this.noiseHit(t, 0.025, 0.06, 900);
        }
        if (s % 2 === 0) {
          const f = this.hzFrom(root, (b.bass || [7, 0, 7, 3])[(s / 2 + bar) % 4] - 12);
          this.inst(f, t, 0.08, "bass", 0.09);
        }
        if (s % 2 === 0) {
          this.inst(this.hzFrom(root, lead[((s / 2) + bar) % lead.length]), t, 0.14, "pluck", 0.04);
        }
        if (s === 1 && bar % 4 === 3) this.inst(this.hzFrom(root, lead[0] + 19), t, 0.35, "glass", 0.02);
      },
      // Cold bells, almost no kick.
      boss_glass(c) {
        const t = c.t, s = c.s, bar = c.bar, b = c.boss || {};
        const root = b.root || 233;
        const lead = b.lead || [12, 14, 15, 19];
        if (s === 0) {
          this.inst(root * 0.5, t, 3.4, "pad", 0.04);
          this.inst(root, t, 2.6, "choir", 0.028);
        }
        if (s === 0 || s === 8) this.noiseHit(t, 0.06, 0.04, 240);
        if (s === 0 || s === 6 || s === 10) {
          this.inst(this.hzFrom(root, lead[(bar + s) % lead.length]), t, 1.1, "bell", 0.045);
        }
        if (s === 12) this.inst(this.hzFrom(root, lead[bar % lead.length] + 7), t, 0.8, "glass", 0.03);
        if (s === 4 && bar % 2 === 0) this.inst(root * 0.75, t, 1.6, "organ", 0.018);
      },
      // Train / rail: off-grid hats, saw grit.
      boss_rail(c) {
        const t = c.t, s = c.s, bar = c.bar, b = c.boss || {};
        const root = b.root || 98;
        const lead = b.lead || [0, 5, 7, 12];
        const kicks = b.kick || [0, 3, 4, 8, 11, 12];
        if (kicks.indexOf(s) >= 0) {
          this.voice(Math.max(40, root * 0.48), t, 0.08, "sine", 0.48, 38);
          this.noiseHit(t, 0.035, 0.09, 500);
        }
        if (s % 2 === 1) this.noiseHit(t, 0.015, 0.035, 6500);
        if (s % 2 === 0) {
          const f = this.hzFrom(root, (b.bass || [0, 0, 5, 7])[(s / 2 + bar) % 4] - 12);
          this.inst(f, t, 0.1, "bass", 0.12);
        }
        if (s % 4 === 0) this.inst(this.hzFrom(root, lead[((s / 4) + bar) % lead.length] + 12), t, 0.18, "brass", 0.04);
        if (s === 7 || s === 15) this.inst(this.hzFrom(root, lead[bar % lead.length] + 19), t, 0.1, "chip", 0.02);
      },
      // Static / needle: thin ticks, high square.
      boss_needle(c) {
        const t = c.t, s = c.s, bar = c.bar, b = c.boss || {};
        const root = b.root || 261;
        const lead = b.lead || [12, 13, 18, 13];
        if (s === 0 || s === 8) this.voice(Math.max(48, root * 0.35), t, 0.12, "sine", 0.32, 60);
        if (s % 2 === 1) this.noiseHit(t, 0.012, 0.03, 8000);
        if (s % 2 === 0) {
          const f = this.hzFrom(root, (b.bass || [0, 1, 0, 6])[(s / 2 + bar) % 4] - 12);
          this.inst(f, t, 0.06, "bass", 0.08);
          this.inst(this.hzFrom(root, lead[((s / 2) + bar) % lead.length] + 12), t, 0.08, "chip", 0.035);
        }
        if (s === 5 || s === 13) this.inst(this.hzFrom(root, lead[0] + 24), t, 0.05, "glass", 0.018);
      },
      // Choir / hymn: pads and fifths.
      boss_choir(c) {
        const t = c.t, s = c.s, bar = c.bar, b = c.boss || {};
        const root = b.root || 65;
        const lead = b.lead || [0, 3, 7, 12];
        if (s === 0) {
          this.inst(root * 0.5, t, 3.8, "choir", 0.06);
          this.inst(root * 0.75, t, 3.4, "pad", 0.04);
          this.inst(root, t, 3.0, "organ", 0.025);
        }
        if (s === 0 || s === 8) {
          this.voice(Math.max(30, root * 0.4), t, 0.35, "sine", 0.38, 14);
          this.noiseHit(t, 0.1, 0.06, 160);
        }
        if (s === 4 || s === 12) {
          this.inst(this.hzFrom(root, lead[(bar + (s === 12 ? 2 : 0)) % lead.length] + 12), t, 1.5, "bell", 0.03);
        }
        if (s === 10 && bar % 4 === 2) this.inst(this.hzFrom(root, 19), t, 1.1, "glass", 0.018);
      },
      // Grind / industrial grit.
      boss_grind(c) {
        const t = c.t, s = c.s, bar = c.bar, b = c.boss || {};
        const root = b.root || 110;
        const lead = b.lead || [0, 1, 6, 1];
        const kicks = b.kick || [0, 2, 4, 6, 8, 10, 12, 14];
        if (kicks.indexOf(s) >= 0) {
          this.voice(Math.max(36, root * 0.4), t, 0.07, "sine", 0.5, 48);
          this.noiseHit(t, 0.04, 0.12, 280);
        }
        if (s % 2 === 0) {
          const f = this.hzFrom(root, (b.bass || [0, 0, 1, 0])[(s / 2 + bar) % 4] - 12);
          this.inst(f, t, 0.09, "bass", 0.13);
        }
        if (s % 4 === 0) this.inst(this.hzFrom(root, lead[((s / 4) + bar) % lead.length] + 7), t, 0.16, "brass", 0.045);
        if (s === 3 || s === 11) this.noiseHit(t, 0.06, 0.1, 1800);
        if (s === 0) this.inst(root * 0.5, t, 1.0, "pad", 0.02);
      },
      // Drip / spore: soft kicks, falling intervals.
      boss_drip(c) {
        const t = c.t, s = c.s, bar = c.bar, b = c.boss || {};
        const root = b.root || 87;
        const lead = b.lead || [0, 2, -1, 5];
        if (s === 0 || s === 8) {
          this.voice(Math.max(34, root * 0.42), t, 0.2, "sine", 0.4, 22);
          this.noiseHit(t, 0.08, 0.06, 220);
        }
        if (s === 0) this.inst(root * 0.5, t, 3.0, "pad", 0.035);
        const drops = [2, 6, 10, 14];
        if (drops.indexOf(s) >= 0) {
          const i = drops.indexOf(s);
          this.inst(this.hzFrom(root, lead[(bar + i) % lead.length] + 12 - i * 2), t, 0.55, "bell", 0.035);
        }
        if (s === 11) this.inst(this.hzFrom(root, lead[0] + 7), t, 0.9, "glass", 0.02);
      },
      // Last Light: slow, heavy, final.
      boss_final(c) {
        const t = c.t, s = c.s, bar = c.bar, b = c.boss || {};
        const root = b.root || 49;
        const lead = b.lead || [0, 7, 12, 16];
        if (s === 0 || s === 8) {
          this.voice(Math.max(28, root * 0.45), t, 0.4, "sine", 0.52, 16);
          this.noiseHit(t, 0.14, 0.1, 140);
        }
        if (s === 0) {
          this.inst(root * 0.5, t, 3.6, "choir", 0.07);
          this.inst(root, t, 3.2, "pad", 0.045);
          this.inst(root * 1.5, t, 2.4, "organ", 0.022);
        }
        if (s === 4 || s === 12) {
          this.inst(this.hzFrom(root, lead[(bar + (s === 12 ? 1 : 0)) % lead.length] + 12), t, 1.6, "bell", 0.035);
        }
        if (bar % 4 === 3 && s === 8) this.inst(this.hzFrom(root, 24), t, 1.2, "glass", 0.025);
        if (s === 6 || s === 14) this.noiseHit(t, 0.05, 0.08, 900);
      },
      // Null enrage: denser kicks, lead up an octave.
      bossRage(c) {
        const t = c.t;
        const s = c.s;
        const bar = c.bar;
        const b = c.boss || {};
        const root = (b.root || 196) * 1.122;
        const kicks = b.kick || [0, 4, 8, 12];
        const wave = b.wave || "square";
        if (kicks.indexOf(s) >= 0) {
          this.voice(Math.max(36, root * 0.4), t, 0.07, "sine", 0.5, 55);
          this.noiseHit(t, 0.03, 0.1, 120);
        }
        const color = wave === "sine" ? "bell" : wave === "triangle" ? "pluck" : "brass";
        if (s === 0) this.inst(root * 0.5, t, 0.9, "choir", 0.04);
        const bass = b.bass || [0, 1, 0, 6];
        if (s % 2 === 0) {
          const f = this.hzFrom(root, bass[(s / 2 + bar) % bass.length] - 12);
          this.inst(f, t, 0.1, "bass", 0.13);
        }
        if (s % 4 === 0) {
          const lead = b.lead || [12, 15, 19];
          const lf = this.hzFrom(root, lead[((s / 4) + bar) % lead.length] + 12);
          this.inst(lf, t, 0.18, color, 0.06);
        } else if (s % 4 === 2) {
          const lead = b.lead || [12, 15, 19];
          const idx = ((s / 4) + bar) % lead.length;
          const inv = lead[0] - (lead[idx] - lead[0]);
          this.inst(this.hzFrom(root, inv + 12), t, 0.12, "pluck", 0.02);
        }
      },
      voidAmbient(c) {
        const { t, s, bar, ch, rootHz, motif } = c;
        if (s === 0) {
          this.inst(ch[0] / 2, t, 3.6, "choir", 0.07);
          this.inst(ch[1] || ch[0] * 1.5, t, 3.4, "pad", 0.04);
        }
        if (s === 0) this.inst(this.hzFrom(rootHz, motif[bar % motif.length] + 24), t, 1.4, "bell", 0.03);
        if (s === 8) this.inst((ch[2] || ch[1] || ch[0] * 1.5), t, 1.3, "glass", 0.026);
        if (s === 12 && bar % 2 === 0) this.inst(ch[0], t, 1.1, "organ", 0.02);
      },
      industrial(c) {
        const { t, s, bar, ch } = c;
        const stomps = [0, 6, 8, 11];
        if (stomps.indexOf(s) >= 0) {
          this.voice(70, t, 0.18, "sine", 0.55, 28);
          this.noiseHit(t, 0.08, 0.2, 400);
        }
        if (s === 4 || s === 12) this.noiseHit(t, 0.08, 0.14, 1600);
        if (s === 0) {
          this.inst(ch[0] / 2, t, 0.7, "bass", 0.12);
          this.inst(ch[0], t, 0.5, "brass", 0.04);
        }
        if (s === 8) this.inst((ch[1] || ch[0] * 1.25) / 2, t, 0.45, "brass", 0.035);
        if (stomps.indexOf(s) >= 0 && s !== 0) {
          this.inst(this.hzFrom(c.rootHz, c.motif[(bar + s) % c.motif.length] + 12), t, 0.2, "pluck", 0.03);
        }
      },
      waltz(c) {
        // 3/4 feel inside 16: accents on 0, 6, 10 (and wrap)
        const { t, s, bar, ch, rootHz, motif } = c;
        const beat = s % 12;
        if (beat === 0) {
          this.voice(90, t, 0.2, "sine", 0.32, 40);
          this.inst(ch[0], t, 1.2, "organ", 0.04);
          this.inst(ch[1] || ch[0] * 1.25, t, 1.2, "choir", 0.025);
        }
        if (beat === 0 || beat === 4 || beat === 8) {
          const f = this.hzFrom(rootHz, motif[(Math.floor(s / 4) + bar) % motif.length] + 24);
          this.inst(f, t, 0.65, beat === 0 ? "bell" : "glass", 0.036);
        }
        if (s === 0) this.inst(ch[0] / 2, t, 1.5, "bass", 0.08);
      },
      psychedelic(c) {
        const { t, s, bar, ch, rootHz, motif } = c;
        if (s === 0) {
          this.inst(ch[0], t, 2.4, "choir", 0.045);
          this.inst(ch[2] || ch[0] * 1.5, t, 2.2, "pad", 0.028);
        }
        if (s === 3 || s === 7 || s === 11 || s === 14) {
          const f = this.hzFrom(rootHz, motif[(s + bar) % motif.length] + 19);
          this.inst(f, t, 0.28, "bell", 0.032);
        }
        if (s === 8) this.inst((ch[1] || ch[0] * 1.25), t, 1.1, "glass", 0.024);
      },
      techno(c) {
        const { t, s, bar, ch, rootHz, motif, heat } = c;
        // 4-on-floor
        if (s % 4 === 0) {
          this.voice(180, t, 0.2, "sine", 0.5, 30);
          this.voice(60, t, 0.12, "sine", 0.25);
        }
        if (s === 4 || s === 12) this.noiseHit(t, 0.06, 0.1, 2200);
        if (s % 4 === 0) {
          this.inst(ch[0] / 2, t, 0.2, "bass", 0.1);
          this.voice(1800, t, 0.015, "square", 0.025);
        }
        if (s % 4 === 2) {
          const f = this.hzFrom(rootHz, motif[(s / 2 + bar) % motif.length] + 12);
          this.inst(f, t, 0.14, "chip", 0.04);
        }
      },
      dub(c) {
        const { t, s, ch, rootHz, motif, bar } = c;
        if (s === 0 || s === 9) this.voice(55, t, 0.35, "sine", 0.45, 28);
        if (s === 4) {
          this.noiseHit(t, 0.16, 0.14, 1400);
          this.voice(200, t, 0.1, "triangle", 0.08, 80);
        }
        // Offbeat skank chords
        if (s === 2 || s === 6 || s === 10 || s === 14) {
          this.inst(ch[0] * 2, t, 0.16, "pluck", 0.04);
          this.inst((ch[1] || ch[0] * 1.2) * 2, t, 0.16, "organ", 0.025);
        }
        if (s === 0) this.inst(ch[0] / 2, t, 0.9, "bass", 0.12);
        if (s === 8) {
          const f = this.hzFrom(rootHz, motif[bar % motif.length] + 12);
          this.inst(f, t, 0.55, "bell", 0.035);
          this.inst(f * 0.5, t, 0.7, "choir", 0.02);
        }
      },
      liquid(c) {
        const { t, s, bar, ch, rootHz, motif } = c;
        if (s === 0) {
          this.inst(ch[0], t, 2.6, "pad", 0.04);
          this.inst(ch[0] * 1.498, t, 2.4, "choir", 0.022);
        }
        if (s === 2 || s === 10) this.inst(ch[0] / 2, t, 0.9, "bass", 0.07);
        if (s === 0) this.inst(this.hzFrom(rootHz, motif[bar % motif.length] + 24), t, 1.1, "glass", 0.03);
        if (s === 8) this.inst(this.hzFrom(rootHz, motif[(bar + 1) % motif.length] + 19), t, 0.9, "bell", 0.026);
      },
      train(c) {
        const { t, s, bar, ch, rootHz, motif } = c;
        // Gallop: X-x-X X-x-X
        if (s % 4 === 0 || s % 4 === 3) {
          this.voice(140, t, 0.1, "sine", s % 4 === 0 ? 0.45 : 0.28, 35);
          this.noiseHit(t, 0.03, 0.08, 1200);
        }
        if (s === 4 || s === 12) this.noiseHit(t, 0.08, 0.16, 2000);
        if (s % 4 === 0) this.inst(ch[0] / 2, t, 0.22, "bass", 0.09);
        if (s === 0) {
          const f = this.hzFrom(rootHz, motif[bar % motif.length] + 24);
          this.inst(f, t, 0.7, "brass", 0.04);
        }
        if (s === 8) this.inst(this.hzFrom(rootHz, motif[(bar + 2) % motif.length] + 12), t, 0.4, "bell", 0.028);
      },
      glitch(c) {
        const { t, s, bar, ch, rootHz, motif } = c;
        const hits = [0, 3, 7, 11, 14];
        if (s === 0) this.inst(ch[0] / 2, t, 0.45, "bass", 0.1);
        if (hits.indexOf(s) >= 0) {
          const f = this.hzFrom(rootHz, motif[(s + bar) % motif.length] + 12);
          this.inst(f, t, 0.1, "chip", 0.05);
          if (s === 0 || s === 7) this.noiseHit(t, 0.04, 0.08, 1800);
        }
        if (s === 8) this.inst(ch[1] || ch[0] * 1.5, t, 0.35, "glass", 0.025);
      },
      ritual(c) {
        const { t, s, bar, ch, rootHz, motif } = c;
        if (s === 0) {
          this.voice(48, t, 0.5, "sine", 0.5, 22);
          this.noiseHit(t, 0.2, 0.15, 300);
          this.inst(ch[0] / 2, t, 3.2, "choir", 0.06);
          this.inst(ch[1] || ch[0] * 1.5, t, 2.8, "organ", 0.03);
        }
        if (s === 8 && bar % 2 === 1) this.voice(40, t, 0.35, "sine", 0.28, 20);
        if (s === 0) this.inst(this.hzFrom(rootHz, motif[bar % motif.length] + 12), t, 1.5, "bell", 0.032);
        if (s === 8) this.inst(this.hzFrom(rootHz, motif[(bar + 3) % motif.length] + 12), t, 1.2, "glass", 0.024);
      },
      crystal(c) {
        const { t, s, bar, rootHz, motif, ch } = c;
        // No kick, no bass — only glass
        if (s === 0 || s === 6 || s === 12) {
          const f = this.hzFrom(rootHz, motif[(s + bar) % motif.length] + 24);
          this.inst(f, t, 0.7, "glass", 0.036);
        }
        if (s === 0) {
          this.inst(ch[0] * 2, t, 1.8, "organ", 0.025);
          this.inst((ch[1] || ch[0] * 1.25), t, 1.6, "choir", 0.02);
        }
        if (s === 8) this.inst((ch[2] || ch[0] * 1.5) * 2, t, 1.2, "bell", 0.022);
      },
      lullaby(c) {
        const { t, s, bar, rootHz, motif, ch } = c;
        if (s === 0) this.inst(ch[0] / 2, t, 2.8, "choir", 0.05);
        if (s % 4 === 0) {
          const deg = motif[(Math.floor(s / 2) + bar) % motif.length];
          this.inst(this.hzFrom(rootHz, deg + 24), t, 0.45, "bell", 0.034);
        }
        if (s === 8) this.inst(ch[1] || ch[0] * 1.2, t, 0.8, "glass", 0.02);
        if (bar % 4 === 3 && s === 10) this.inst(this.hzFrom(rootHz, 1 + 24), t, 0.6, "pluck", 0.025);
      },
      acid(c) {
        const { t, s, ch, rootHz, motif, heat } = c;
        if (s % 4 === 0) this.voice(165, t, 0.18, "sine", 0.48, 32);
        if (s === 4 || s === 12) this.noiseHit(t, 0.05, 0.08, 2200);
        if (s === 0) {
          this.inst(ch[0] / 2, t, 0.7, "bass", 0.1);
          this.inst(ch[0], t, 1.2, "pad", 0.025);
        }
        if (s % 2 === 0) {
          const deg = motif[(s / 2 + (c.bar || 0)) % motif.length];
          const next = motif[(s / 2 + 1) % motif.length];
          const f = this.hzFrom(rootHz, deg);
          this.voice(f, t, 0.16, "sawtooth", 0.06, this.hzFrom(rootHz, next));
        }
        if (s === 8) this.inst(this.hzFrom(rootHz, motif[(c.bar || 0) % motif.length] + 12), t, 0.3, "pluck", 0.03);
      },
      organ(c) {
        const { t, s, ch, rootHz, motif, bar } = c;
        if (s === 0) {
          this.inst(ch[0], t, 3.4, "organ", 0.055);
          this.inst(ch[1] || ch[0] * 1.5, t, 3.4, "organ", 0.032);
          if (ch[2]) this.inst(ch[2], t, 3.2, "choir", 0.022);
          this.inst(ch[0] / 2, t, 3.4, "bass", 0.07);
          this.voice(55, t, 0.35, "sine", 0.16, 30);
        }
        if (s === 8) this.inst(this.hzFrom(rootHz, motif[bar % motif.length] + 24), t, 1.2, "bell", 0.024);
      },
      jungle(c) {
        const { t, s, bar, ch, rootHz, motif, heat } = c;
        const kicks = [0, 3, 8, 10];
        const snares = [4, 7, 12, 15];
        if (kicks.indexOf(s) >= 0) {
          this.voice(190, t, 0.14, "sine", 0.5, 28);
          this.voice(50, t, 0.1, "sine", 0.3);
        }
        if (snares.indexOf(s) >= 0) {
          this.noiseHit(t, 0.1, 0.22 + heat * 0.05, 2800);
          this.voice(220, t, 0.05, "triangle", 0.1, 90);
        }
        if (s === 0 || s === 8) this.inst(ch[0] / 2, t, 0.28, "bass", 0.1);
        if (snares.indexOf(s) >= 0) {
          const f = this.hzFrom(rootHz, motif[(s + bar) % motif.length] + 12);
          this.inst(f, t, 0.14, "brass", 0.035);
        }
      },
      chip(c) {
        const { t, s, bar, rootHz, motif, ch } = c;
        // Arp bass + square lead — no pads, no noise hats
        if (s % 4 === 0) {
          const deg = motif[(s + bar) % motif.length];
          const f = this.hzFrom(rootHz, deg + 12);
          this.inst(f, t, 0.18, "chip", 0.05);
          this.inst(f * 1.26, t, 0.16, "pluck", 0.02);
        }
        if (s % 4 === 2) this.inst(ch[0] / 2, t, 0.14, "bass", 0.07);
        if (s === 8) this.inst(this.hzFrom(rootHz, motif[(bar + 3) % motif.length] + 19), t, 0.22, "bell", 0.025);
      },
      needle(c) {
        const { t, s, bar, rootHz, motif, ch } = c;
        if (s === 0 && bar % 2 === 0) this.inst(ch[0] / 2, t, 3.2, "choir", 0.04);
        if (s === 4 || (bar % 2 === 1 && s === 12)) {
          const f = this.hzFrom(rootHz, motif[(bar + s) % motif.length] + 24);
          this.inst(f, t, 0.35, "glass", 0.04);
        }
        if (s === 12) this.inst((ch[1] || ch[0] * 1.5), t, 0.8, "bell", 0.02);
      },
      doom(c) {
        const { t, s, bar, ch, rootHz, motif } = c;
        if (s === 0 || s === 8) {
          this.voice(70, t, 0.35, "sine", 0.5, 25);
          this.noiseHit(t, 0.12, 0.18, 600);
          // Power chord
          this.inst(ch[0], t, 1.1, "brass", 0.05);
          this.inst(ch[0] * 1.5, t, 1.1, "organ", 0.03);
        }
        if (s === 8) this.inst(this.hzFrom(rootHz, motif[bar % motif.length] + 12), t, 0.6, "bell", 0.028);
      },
      fold(c) {
        // 7/8 cycle: 14 sixteenths then 2 rest
        const { t, s, bar, ch, rootHz, motif } = c;
        const cell = (bar * 16 + s) % 14;
        if (cell === 0 || cell === 4 || cell === 8) {
          this.voice(120, t, 0.12, "sine", 0.4, 35);
        }
        if (cell === 0 || cell === 6) {
          const f = this.hzFrom(rootHz, motif[cell % motif.length] + 12);
          this.inst(f, t, 0.28, "pluck", 0.04);
        }
        if (cell === 10) this.inst(this.hzFrom(rootHz, motif[(cell + 3) % motif.length] + 12), t, 0.24, "bell", 0.028);
        if (cell === 0) this.inst(ch[0] / 2, t, 0.6, "bass", 0.09);
        if (bar % 2 === 1 && cell === 0) this.inst(ch[0] * 2, t, 0.8, "choir", 0.025);
      },
      fanfare(c) {
        const { t, s, bar, ch, rootHz, motif } = c;
        // March: kick on 0/8, snare 4/12
        if (s === 0 || s === 8) this.voice(160, t, 0.18, "sine", 0.45, 30);
        if (s === 4 || s === 12) {
          this.noiseHit(t, 0.1, 0.2, 2400);
          this.voice(300, t, 0.06, "triangle", 0.08);
        }
        if (s % 4 === 0) {
          const deg = motif[(s / 4 + bar) % motif.length];
          const f = this.hzFrom(rootHz, deg + 12);
          this.inst(f, t, 0.32, "brass", 0.045);
          this.inst(f * 1.5, t, 0.28, "organ", 0.022);
        }
        if (s === 0) {
          this.inst(ch[0], t, 1.1, "choir", 0.035);
          this.inst(ch[0] / 2, t, 0.8, "bass", 0.07);
        }
        if (s === 8) this.inst((ch[1] || ch[0] * 1.25), t, 0.6, "bell", 0.024);
      },
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
        if (mode !== "play" && mode !== "title" && mode !== "pause" && mode !== "levels" && mode !== "clear" && mode !== "win" && mode !== "sideshow") return;
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
      if (name === "step") this.noise(0.045, 0.04, 380);
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
      if (name === "bossIn") {
        this.beep(98, 0.2, "sawtooth", 0.08, 48);
        this.noise(0.18, 0.12, 360);
        setTimeout(() => this.beep(196, 0.24, "triangle", 0.05), 110);
      }
      if (name === "bossGrab") {
        this.noise(0.12, 0.12, 640);
        this.beep(170, 0.08, "square", 0.06, 80);
      }
      if (name === "bossDrop") {
        this.beep(480, 0.26, "sine", 0.05, 80);
        this.noise(0.16, 0.07, 280);
      }
      if (name === "bossLand") {
        this.beep(78, 0.18, "sine", 0.09, 36);
        this.noise(0.16, 0.14, 220);
      }
      if (name === "bossShot") {
        this.beep(620, 0.05, "square", 0.05, 240);
        this.noise(0.05, 0.07, 1700);
      }
      if (name === "bossTell") {
        this.beep(740, 0.07, "sine", 0.04, 420);
        this.noise(0.04, 0.03, 2200);
      }
      if (name === "bossHeavy") {
        this.beep(150, 0.18, "sawtooth", 0.07, 55);
        this.noise(0.12, 0.08, 280);
      }
      if (name === "bossFall") {
        this.beep(280, 0.42, "sawtooth", 0.07, 50);
        this.noise(0.28, 0.12, 420);
      }
      if (name === "bossBoom") {
        this.noise(0.5, 0.24, 240);
        this.beep(62, 0.55, "sine", 0.11, 28);
        this.beep(160, 0.2, "square", 0.05, 40);
      }
      if (name === "whoosh") {
        this.noise(0.42, 0.11, 420);
        this.beep(70, 0.55, "sine", 0.06, 36);
        this.beep(196, 0.32, "triangle", 0.035, 90);
      }
      if (name === "award") {
        [392, 523, 659, 784, 1046].forEach((f, i) => {
          setTimeout(() => this.beep(f, i === 4 ? 0.55 : 0.18, "triangle", 0.07), i * 120);
        });
        setTimeout(() => this.beep(196, 0.7, "sine", 0.05), 280);
        setTimeout(() => this.noise(0.25, 0.05, 1800), 160);
      }
    },
    // Continuous voices for things that keep moving. Related hazards share a
    // timbre: blades buzz, stone rattles, jets roar, beams sing, hunters thump.
    spacePresets: {
      saw: { reach: 700, peak: 0.07, filter: 2600, layers: [
        { osc: "sawtooth", freq: 74, vol: 0.62, lfo: 24, depth: 20 },
        { noise: 1700, vol: 0.32 },
      ]},
      platform: { reach: 620, peak: 0.05, filter: 780, layers: [
        { osc: "triangle", freq: 46, vol: 0.7, lfo: 3, depth: 5 },
        { noise: 220, vol: 0.4, ampLfo: 5.5, ampDepth: 0.7 },
      ]},
      brick: { reach: 680, peak: 0.06, filter: 1700, layers: [
        { osc: "sine", freq: 190, vol: 0.5 },
        { noise: 480, vol: 0.38 },
      ]},
      rocket: { reach: 860, peak: 0.08, filter: 980, layers: [
        { osc: "sawtooth", freq: 58, vol: 0.55, lfo: 13, depth: 12 },
        { noise: 380, vol: 0.72 },
      ]},
      laser: { reach: 660, peak: 0.055, filter: 5200, layers: [
        { osc: "sine", freq: 760, vol: 0.48 },
        { osc: "square", freq: 1520, vol: 0.12 },
      ]},
      glow: { reach: 520, peak: 0.022, filter: 2400, layers: [
        { osc: "sine", freq: 520, vol: 0.4 },
      ]},
      bolt: { reach: 640, peak: 0.05, filter: 4400, layers: [
        { osc: "square", freq: 540, vol: 0.42, lfo: 34, depth: 90 },
        { noise: 3400, vol: 0.3 },
      ]},
      sweep: { reach: 760, peak: 0.06, filter: 3000, layers: [
        { osc: "sawtooth", freq: 200, vol: 0.34 },
        { osc: "sine", freq: 1200, vol: 0.28 },
      ]},
      drone: { reach: 720, peak: 0.058, filter: 2100, layers: [
        { osc: "triangle", freq: 126, vol: 0.55, lfo: 22, depth: 16 },
        { noise: 1400, vol: 0.28 },
      ]},
      seeker: { reach: 740, peak: 0.06, filter: 2700, layers: [
        { osc: "sawtooth", freq: 172, vol: 0.4, lfo: 17, depth: 14 },
        { osc: "sine", freq: 688, vol: 0.16 },
      ]},
      sentry: { reach: 640, peak: 0.042, filter: 1500, layers: [
        { osc: "square", freq: 92, vol: 0.36, ampLfo: 7, ampDepth: 0.55 },
        { noise: 460, vol: 0.18 },
      ]},
      watcher: { reach: 680, peak: 0.048, filter: 3400, layers: [
        { osc: "sine", freq: 210, vol: 0.5 },
        { osc: "triangle", freq: 420, vol: 0.16 },
      ]},
      stalker: { reach: 800, peak: 0.072, filter: 520, layers: [
        { osc: "sine", freq: 40, vol: 0.85, ampLfo: 1.7, ampDepth: 0.72 },
        { osc: "triangle", freq: 80, vol: 0.22 },
      ]},
      reaper: { reach: 860, peak: 0.078, filter: 420, layers: [
        { osc: "sine", freq: 30, vol: 0.9, ampLfo: 2.5, ampDepth: 0.75 },
        { osc: "sawtooth", freq: 60, vol: 0.12 },
      ]},
      phantom: { reach: 700, peak: 0.046, filter: 1900, layers: [
        { osc: "sine", freq: 286, vol: 0.4 },
        { osc: "sine", freq: 304, vol: 0.32 },
      ]},
      wraith: { reach: 740, peak: 0.05, filter: 2300, layers: [
        { osc: "sine", freq: 420, vol: 0.36 },
        { noise: 760, vol: 0.2 },
      ]},
      swarm: { reach: 540, peak: 0.02, filter: 3600, layers: [
        { osc: "sawtooth", freq: 490, vol: 0.45, lfo: 38, depth: 36 },
        { osc: "square", freq: 740, vol: 0.18 },
      ]},
      crushWarn: { reach: 780, peak: 0.062, filter: 860, layers: [
        { osc: "square", freq: 132, vol: 0.38, ampLfo: 5.2, ampDepth: 0.82 },
        { osc: "sine", freq: 66, vol: 0.48 },
      ]},
      crushFall: { reach: 820, peak: 0.08, filter: 640, layers: [
        { noise: 280, vol: 0.75 },
        { osc: "sine", freq: 84, vol: 0.4 },
      ]},
    },
    ensureBus() {
      if (!this.ctx || this.spaceGain) return;
      this.spaceGain = this.ctx.createGain();
      this.spaceGain.gain.value = 1;
      this.spaceGain.connect(this.master || this.ctx.destination);
      this._live = [];
      this._bind = new WeakMap();
    },
    noiseBuf() {
      if (this._noiseBuf) return this._noiseBuf;
      const len = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._noiseBuf = buf;
      return buf;
    },
    beginSpace() { this._stamp = (this._stamp || 0) + 1; },
    endSpace() {
      const live = this._live;
      if (!live || !live.length) return;
      const stamp = this._stamp;
      const keep = [];
      for (let i = 0; i < live.length; i++) {
        const tone = live[i];
        if (tone.stamp === stamp && !tone.dead) keep.push(tone);
        else this.killTone(tone);
      }
      this._live = keep;
    },
    silenceSpace() {
      const live = this._live;
      if (!live) return;
      for (let i = 0; i < live.length; i++) this.killTone(live[i]);
      this._live = [];
    },
    killTone(tone) {
      if (!tone || tone.dead || !this.ctx) return;
      tone.dead = true;
      const t = this.ctx.currentTime;
      try {
        tone.out.gain.cancelScheduledValues(t);
        tone.out.gain.setTargetAtTime(0.0001, t, 0.02);
      } catch (_) { /* already stopped */ }
      const stopAt = t + 0.08;
      for (let i = 0; i < tone.nodes.length; i++) {
        try { tone.nodes[i].stop(stopAt); } catch (_) { /* already stopped */ }
      }
    },
    makeTone(name, spec) {
      const ctx = this.ctx;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = spec.filter;
      filter.Q.value = 0.7;
      let panner = null;
      try { panner = ctx.createStereoPanner(); } catch (_) { panner = null; }
      const out = ctx.createGain();
      out.gain.value = 0.0001;
      if (panner) { filter.connect(panner); panner.connect(out); }
      else filter.connect(out);
      out.connect(this.spaceGain);
      const nodes = [];
      const oscs = [];
      for (let i = 0; i < spec.layers.length; i++) {
        const layer = spec.layers[i];
        const amp = ctx.createGain();
        amp.gain.value = layer.vol;
        amp.connect(filter);
        if (layer.noise) {
          const src = ctx.createBufferSource();
          src.buffer = this.noiseBuf();
          src.loop = true;
          const bp = ctx.createBiquadFilter();
          bp.type = "bandpass";
          bp.frequency.value = layer.noise;
          bp.Q.value = 0.8;
          src.connect(bp);
          bp.connect(amp);
          src.start();
          nodes.push(src);
        } else {
          const osc = ctx.createOscillator();
          osc.type = layer.osc || "sine";
          const base = layer.freq * (0.97 + Math.random() * 0.06);
          osc.frequency.value = base;
          if (layer.lfo) {
            const lfo = ctx.createOscillator();
            const lg = ctx.createGain();
            lfo.frequency.value = layer.lfo;
            lg.gain.value = layer.depth || 8;
            lfo.connect(lg);
            lg.connect(osc.frequency);
            lfo.start();
            nodes.push(lfo);
          }
          osc.connect(amp);
          osc.start();
          nodes.push(osc);
          oscs.push({ osc, base });
        }
        if (layer.ampLfo) {
          const lfo = ctx.createOscillator();
          const lg = ctx.createGain();
          lfo.frequency.value = layer.ampLfo;
          lg.gain.value = layer.vol * (layer.ampDepth || 0.5);
          lfo.connect(lg);
          lg.connect(amp.gain);
          lfo.start();
          nodes.push(lfo);
        }
      }
      return { name, out, filter, panner, nodes, oscs, stamp: this._stamp || 0, dead: false };
    },
    hear(obj, name, x, y, opts) {
      if (!this.ctx || this.muted || testMode || !obj) return;
      const spec = this.spacePresets[name];
      if (!spec || !player) return;
      this.ensureBus();
      let tone = this._bind.get(obj);
      if (!tone || tone.dead || tone.name !== name) {
        if (tone) this.killTone(tone);
        tone = this.makeTone(name, spec);
        this._bind.set(obj, tone);
        this._live.push(tone);
      }
      tone.stamp = this._stamp;
      const dx = x - (player.x + player.w / 2);
      const dy = y - (player.y + player.h / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const near = Math.max(0, 1 - dist / spec.reach);
      const amount = Math.pow(near, 1.4);
      const now = this.ctx.currentTime;
      tone.out.gain.setTargetAtTime(Math.max(0.0001, amount * spec.peak), now, 0.045);
      tone.filter.frequency.setTargetAtTime(240 + near * (spec.filter - 240), now, 0.06);
      if (tone.panner) tone.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, dx / 300)), now, 0.05);
      const rate = opts && opts.rate ? opts.rate : 1;
      if (Math.abs(rate - 1) > 0.02) {
        for (let i = 0; i < tone.oscs.length; i++) {
          tone.oscs[i].osc.frequency.setTargetAtTime(Math.max(20, tone.oscs[i].base * rate), now, 0.05);
        }
      }
    },
  };

  let mode = "title";
  let levelIndex = 0;
  let deaths = 0;
  let startedAt = 0;
  let clockOut = 0;
  let clockOutAt = 0;
  let timerShown = "";
  let pipMark = "";
  let acc = 0;
  let last = 0;
  let deathTimer = 0;
  let deathShow = null;
  let hitstop = 0;
  let lockTimer = 0;
  let slowmo = 1;
  let stickyNext = 0;
  let testMode = false;
  let creatorReturn = null;
  let creatorPlay = false;
  let botIx = 0;
  let botJump = false;
  let useBot = false;
  let combo = 0;
  let comboTimer = 0;
  let nearCool = 0;
  let introT = 0;
  let dimIntro = 0;
  let roomFade = 0;
  let clearBloom = 0;
  let lastView = { scale: 1, ox: 0, oy: 0, rot: 0 };
  let camSmoothX = null;
  let camSmoothY = null;
  let runTraps = 0;
  let dimIndex = 1;
  let shardsGot = 0;
  let dashCool = 0;
  let dashT = 0;
  let dashDir = 1;
  let dashHeld = false;
  let nearFlare = 0;
  const camFX = { punch: 0, phase: 0 };
  const SAVE_KEY = "level-surge-v3";

  function loadSave() {
    const G = window.SURGE_GUARD;
    if (!G || !G.readProgress) return {};
    let text = null;
    try { text = localStorage.getItem(SAVE_KEY); } catch (_) { return {}; }
    const got = G.readProgress(text);
    const encoded = got.encoded;
    if (encoded && (got.legacy || got.ok === false || (text != null && text !== encoded))) {
      try { localStorage.setItem(SAVE_KEY, encoded); } catch (_) { /* quota */ }
    }
    return got.data || {};
  }
  function writeSave(patch) {
    const G = window.SURGE_GUARD;
    if (!G || !G.packProgress || !G.capProgress) return {};
    const prev = loadSave();
    const merged = G.sanitizeSave(Object.assign({}, prev, G.sanitizeSave(patch || {})));
    const next = G.capProgress(prev, merged);
    const encoded = G.packProgress(next);
    try { if (encoded) localStorage.setItem(SAVE_KEY, encoded); } catch (_) { /* quota */ }
    return next;
  }
  let themeCacheKey = "";
  let themeCacheVal = null;
  function currentTheme() {
    const pack = window.SURGE_WORLDS;
    const cycling = (mode === "title" || mode === "levels") && dimIntro <= 0;
    const d = cycling ? 1 + Math.floor(performance.now() / 9000) % 20 : dimIndex;
    const key = (cycling ? "c" : "p") + d;
    if (themeCacheKey === key && themeCacheVal) return themeCacheVal;
    const th = pack ? pack.theme(d) : {
      name: "NULLSCAPE", lore: "", weather: "shards", bpm: 128, root: 92.5,
      sky: ["#0b1018", "#07090f", "#04050a"],
      planet: ["#ffffff", "#7b93bc", "#1b2433"],
      needle: "#101624", edge: "rgba(160,190,230,0.22)",
      accent: [210, 225, 255], mul: "rgba(70,90,120,0.45)",
      brick: ["#4a4038", "#cfc1aa"],
    };
    themeCacheKey = key;
    themeCacheVal = th;
    return th;
  }

  function unlockLevel(i) {
    const s = loadSave();
    const rooms = Object.assign({}, s.rooms || {});
    const prevRoom = rooms[dimIndex] != null ? rooms[dimIndex] : 0;
    rooms[dimIndex] = Math.max(prevRoom, i);
    const prevUnlocked = s.unlocked != null ? s.unlocked : 0;
    writeSave({
      rooms,
      lastDim: dimIndex,
      lastRoom: i,
      unlockedDim: Math.max(s.unlockedDim != null ? s.unlockedDim : 1, dimIndex),
      unlocked: Math.max(prevUnlocked, i),
    });
  }

  const MIND_KEY = "level-surge-mind";
  let mindSnap = null;
  let roomHabit = null;

  function blankMindLocal() {
    const pack = window.SURGE_WORLDS;
    return pack && pack.blankMind ? pack.blankMind() : { dash: 0, jump: 0, rush: 0, camp: 0, ground: 0, deaths: {} };
  }

  function loadMind() {
    const blank = blankMindLocal();
    const G = window.SURGE_GUARD;
    if (!G || !G.openBlob) return blank;
    let text = null;
    try { text = localStorage.getItem(MIND_KEY); } catch (_) { return blank; }
    const data = G.openBlob("mind", text);
    if (!data) return blank;
    const out = blankMindLocal();
    ["dash", "jump", "rush", "camp", "ground"].forEach((k) => {
      if (typeof data[k] === "number") out[k] = data[k];
    });
    out.deaths = Object.assign({}, data.deaths || {});
    return out;
  }

  function saveMind(mind) {
    const G = window.SURGE_GUARD;
    if (!G || !G.packBlob) return;
    const encoded = G.packBlob("mind", mind);
    try { if (encoded) localStorage.setItem(MIND_KEY, encoded); } catch (_) { /* quota */ }
  }

  function resetRoomHabit() {
    roomHabit = {
      dashes: 0,
      air: 0,
      ground: 0,
      stillPeak: 0,
      started: 0,
    };
  }

  function tickRoomHabit() {
    if (!roomHabit || player.dead || player.win || testMode) return;
    if (player.onGround) {
      roomHabit.ground += FIXED;
      if (Math.abs(player.vx) < 0.35) roomHabit.stillPeak = Math.max(roomHabit.stillPeak, world.still || 0);
    } else {
      roomHabit.air += FIXED;
    }
  }

  function deathHabitTag(msg) {
    const s = String(msg || world.deathReason || "").toLowerCase();
    if (/saw|orbit|bone|petal|lure|chase|rail/.test(s)) return "saw";
    if (/spike|gate|teeth|bite|pin|burn/.test(s)) return "spike";
    if (/laser|beam|zap|spark|wire|sun|stretch|mirage|signal|clear/.test(s)) return "laser";
    if (/hole|pit|fall|void|crack|sink|worship|abyss/.test(s)) return "hole";
    if (/qte/.test(s)) return "qte";
    if (/boss|null|ash|door/.test(s)) return "boss";
    if (/lock|ice|static|phase/.test(s)) return "lock";
    return "other";
  }

  function blendMind(mind, sample, weight) {
    const w = Math.max(0.08, Math.min(0.55, weight || 0.22));
    const keys = ["dash", "jump", "rush", "camp", "ground"];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const next = (+sample[k] || 0);
      mind[k] = Math.min(8, mind[k] * (1 - w) + next * w);
    }
    return mind;
  }

  function sampleRoomHabit(cleared) {
    const t = Math.max(0.35, world.time || 0.35);
    const jumps = world.jumps || 0;
    const dashes = roomHabit ? roomHabit.dashes : 0;
    const air = roomHabit ? roomHabit.air : 0;
    const ground = roomHabit ? roomHabit.ground : 0;
    const still = roomHabit ? roomHabit.stillPeak : 0;
    const span = Math.max(1, world.cols * TILE * 0.55);
    const speed = (world.maxX || 0) / Math.max(0.4, t);
    return {
      dash: Math.min(3, dashes / Math.max(1, t * 0.55) + (dashes > 2 ? 0.35 : 0)),
      jump: Math.min(3, jumps / Math.max(1, t * 0.7) + air / Math.max(1, t) * 1.1),
      rush: Math.min(3, (speed / 90) + (cleared && t < 14 ? 0.8 : 0) + ((world.maxX || 0) > span ? 0.25 : 0)),
      camp: Math.min(3, still * 1.6 + (ground > t * 0.72 && Math.abs(player.vx) < 0.2 ? 0.4 : 0)),
      ground: Math.min(3, (ground / Math.max(1, t)) * 1.4 + (jumps <= 1 ? 0.45 : 0)),
    };
  }

  function recordMindSample(kind, msg) {
    if (testMode || creatorPlay) return;
    if (!roomHabit) return;
    const mind = loadMind();
    const cleared = kind === "clear";
    blendMind(mind, sampleRoomHabit(cleared), cleared ? 0.28 : 0.16);
    if (kind === "death") {
      const tag = deathHabitTag(msg);
      mind.deaths[tag] = Math.min(40, (mind.deaths[tag] || 0) + 1);
      if (tag === "saw" || tag === "spike") mind.rush = Math.min(8, mind.rush + 0.08);
      if (tag === "hole") mind.ground = Math.min(8, mind.ground + 0.1);
      if (tag === "lock") mind.dash = Math.min(8, mind.dash + 0.12);
    }
    saveMind(mind);
    mindSnap = mind;
  }

  function enterDimension(d, from) {
    dimIndex = Math.max(1, Math.min(20, d | 0));
    const pack = window.SURGE_WORLDS;
    mindSnap = loadMind();
    if (pack) window.LEVELS = pack.generate(dimIndex, mindSnap);
    audio.setTheme(dimIndex);
    audio.restartMusic();
    shardsGot = 0;
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
    if (!testMode) audio.play("whoosh");
    startGame(typeof from === "number" ? from : 0);
  }

  const world = {
    cols: 32, rows: 12, tiles: [],
    spawn: { x: 32, y: 200 },
    door: null, fakeDoor: null, doorHidden: false,
    saws: [], coins: [], particles: [], afterimages: [], lasers: [], platforms: [], drops: [],
    entities: [],
    blood: [],
    rings: [],
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
    lean: 0, visSq: 0, bob: 0, ghostT: 0,
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
    world.rings = [];
    world.chromatic = 0;
    world.slipT = 0;
    world.jumpMul = 1;
    world.jumpMulT = 0;
    world.magnet = null;
    world.blackout = 0;
    world.blackoutMax = 0;
    world.riftUntil = 0;
    world.riftNext = 0;
    world.riftGap = 0;
    world.heavyT = 0;
    world.heavyMul = 1;
    world.baseGravity = 0.55;
    world.restores = [];
    world.entities = [];
    world.voidFog = 0;
    world.voidFogUntil = 0;
    world.huntLight = null;
    world.qte = null;
    world.boss = null;
    world.bossShots = [];
    world.nullBeams = [];
    world.bossFog = 0;
    world.bossPad = null;
    world.bossFloor = null;
    world.bossSpikes = {};
    world.bossZones = [];
    world.bossCast = false;
    world.bossCause = "";
    world.scenery = [];
    world.fore = [];
    lockTimer = 0;
    slowmo = 1;
    stickyNext = 0;
    deathShow = null;
  }

  function loadLevel(i) {
    const def = window.LEVELS[i];
    if (!def) throw new Error("Missing level " + i);
    const rows = def.map.map((r) => r);
    const cols = Math.max(...rows.map((r) => r.length));
    world.cols = cols;
    world.tiles = rows.map((r) => padRow(r.replace(/ /g, "."), cols).split(""));
    world.rows = world.tiles.length;
    world.events = def.boss ? [] : (def.events || []).map((e) => ({ ...e, fired: false }));
    world.rules = def;
    world.time = 0;
    camSmoothX = null;
    camSmoothY = null;
    world.reverse = !!def.reverse;
    world.gravity = def.gravity || 0.55;
    world.shake = 0;
    world.flash = 0;
    world.whiteFlash = 0;
    world.jumped = false;
    world.maxX = 0;
    world.still = 0;
    world.taunt = def.taunt || "NICE TRY";
    world.name = def.name;
    world.deathReason = "";
    world.squash = 0;
    resetWorldExtras();
    world.baseGravity = world.gravity;
    deathTimer = 0;

    for (let y = 0; y < world.rows; y++) {
      for (let x = 0; x < world.cols; x++) {
        let t = world.tiles[y][x];
        if (def.boss && "^v<>oF".includes(t)) {
          world.tiles[y][x] = ".";
          continue;
        }
        if (def.boss && t === "!") {
          world.tiles[y][x] = "#";
          continue;
        }
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
    if (!testMode && !def.boss && def.mindHabit && levelIndex === 0 && dimIndex >= 15) {
      world.events = world.events || [];
      world.events.unshift({
        if: { time: 0.55 }, once: true, quiet: true, fired: false,
        do: [["lie", def.taunt || "nice try"]],
      });
    }
    world.boss = null;
    world.bossPad = null;
    world.bossFloor = null;
    if (def.boss && world.door) {
      const dim = def.dim || dimIndex || 1;
      world.bossShots = [];
      // Pin room ambience (fires / glow) to the opening pad — never follow door or boss.
      world.bossPad = { x: world.door.x, y: world.door.y };
      world.bossFloor = world.door.y + TILE;
      world.boss = {
        dim,
        x: dim === 1 ? world.cols * TILE * 0.5 : Math.max(120, Math.min(Math.max(120, world.cols * TILE - 120), world.door.x + 16)),
        y: dim === 1 ? 88 : 42,
        attack: 0,
        lastDoorX: world.door.x,
        moves: 0,
        goal: dim === 1 ? 7 : (window.SURGE_WORLDS && window.SURGE_WORLDS.bossDoorMoves
          ? window.SURGE_WORLDS.bossDoorMoves(dim) : 7),
        phase: !useBot ? "intro" : "fight",
        mood: 0,
        atkCd: dim === 1 ? 0.85 : 0.42,
        doorCd: 0.38,
        tell: null,
        beat: 0,
        fallVy: 0,
        rot: 0,
        boom: 0,
        seed: (((dim * 9973 + 13) >>> 0) || 1),
        dropping: false,
        drop: null,
        say: null,
        saidHi: false,
        saidClose: false,
        saidBored: false,
        fightAt: useBot ? 0 : null,
        wander: 0,
        wanderY: 110,
        wanderUntil: 0,
        slip: 0,
        face: dim === 1 ? "sleep" : "fight",
        gaze: 0,
        bars: !useBot ? 1 : 0,
        flash: 0,
        introT: 0,
        nvx: 1.7,
        nvy: 0,
        hot: false,
        raged: false,
        rageAge: 0,
        rageFire: 0,
        snatch: null,
        drive: null,
        wave: null,
        half: null,
        gap: 0,
        rest: 0.32,
        plan: null,
        planI: 0,
        cool: {},
        shoveCd: 0,
        fog: 0,
        safeX: 0,
        safeW: 0,
        band: "open",
        arrive: dim === 1 ? 0 : 1.05,
        rush: null,
        echo: null,
        look: dim === 1 ? "null" : "",
      };
      if (dim !== 1 && window.SURGE_BOSS_KITS && window.SURGE_BOSS_KITS.kit) {
        const kit = window.SURGE_BOSS_KITS.kit(dim);
        if (kit) world.boss.look = kit.look || "";
      }
      world.nullBeams = [];
      world.bossZones = [];
      world.bossFog = 0;
    }
    syncBossMusic(def);
    buildRoomScenery();
    if (toastEl) {
      toastEl.classList.remove("show", "whisper", "death");
      toastEl.textContent = "";
    }
    if (levelNumEl) levelNumEl.textContent = `${i + 1} / ${window.LEVELS.length}`;
    if (levelNameEl) levelNameEl.textContent = def.name;
    if (dimNameEl) {
      if (creatorPlay) dimNameEl.textContent = "CREATOR";
      else {
        const th = currentTheme();
        dimNameEl.textContent = `D${dimIndex} ${th.name}`;
      }
    }
    updatePips();
    if (deathsEl) deathsEl.textContent = `DEAD ${deaths}`;
    introT = testMode ? 0 : (dimIntro > 0.5 ? dimIntro + 0.9 : 1.05);
    roomFade = testMode ? 0 : 0.72;
    clearBloom = 0;
    combo = 0;
    comboTimer = 0;
    if (!testMode) unlockLevel(i);
    timerShown = "";
    releaseClock();
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
    if (timerEl) {
      const label = world.time.toFixed(1);
      if (label !== timerShown) {
        timerShown = label;
        timerEl.textContent = label;
      }
    }
    if (dashBtn && dimIndex >= 3) dashBtn.classList.toggle("cooling", dashCool > 0);
    if (deathsEl) deathsEl.textContent = `DEAD ${deaths}`;
    if (shardHud) {
      if (shardsGot > 0) {
        shardHud.classList.remove("hidden");
        shardHud.textContent = `SHARDS ${shardsGot}`;
      } else {
        shardHud.classList.add("hidden");
      }
    }
  }

  function updatePips() {
    if (!pipsEl || !window.LEVELS) return;
    const n = window.LEVELS.length;
    const mark = dimIndex + ":" + levelIndex + ":" + n;
    if (pipMark === mark && pipsEl.childElementCount === n) return;
    pipMark = mark;
    pipsEl.innerHTML = "";
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
    dashDir = 1;
    dashHeld = false;
    player.lean = 0;
    player.bob = 0;
    player.visSq = 0;
    resetRoomHabit();
    player.anim = 0;
    player.airTime = 0;
    world.still = 0;
    world.squash = 0;
  }

  function parkClock() {
    if (!clockOutAt) clockOutAt = performance.now();
  }

  function releaseClock() {
    if (!clockOutAt) return;
    clockOut += performance.now() - clockOutAt;
    clockOutAt = 0;
  }

  function runSeconds() {
    let extra = clockOut;
    if (clockOutAt) extra += performance.now() - clockOutAt;
    return Math.max(0, Math.round((performance.now() - startedAt - extra) / 1000));
  }

  function releaseInput() {
    keys.clear();
    hold.left = hold.right = hold.jump = hold.dash = false;
    dashHeld = false;
  }

  function fadeStains() {
    const blood = world.blood;
    if (!blood || !blood.length) return;
    for (let i = blood.length - 1; i >= 0; i--) {
      blood[i].a -= FIXED * 0.045;
      if (blood[i].a <= 0.05) blood.splice(i, 1);
    }
  }

  function tileAt(px, py) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    const rows = world.tiles || [];
    if (tx < 0 || ty < 0 || tx >= world.cols || ty >= rows.length) return "#";
    const row = rows[ty];
    if (!row) return "#";
    return row[tx];
  }

  function writeTile(tx, ty, ch) {
    const row = world.tiles && world.tiles[ty];
    if (!row || tx < 0 || ty < 0 || tx >= world.cols || ty >= world.tiles.length) return false;
    row[tx] = ch;
    return true;
  }

  function isSolid(t) {
    return t === "#" || t === "=" || t === "B" || t === "i" || t === "!";
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  const PART_POOL = [];
  const RING_POOL = [];
  const AFTER_POOL = [];
  const SHOT_POOL = [];
  const GHOST_POOL = [];
  function allocPart() {
    return PART_POOL.length ? PART_POOL.pop() : {};
  }
  function freePart(p) {
    if (PART_POOL.length < 360) PART_POOL.push(p);
  }
  function allocRing() {
    return RING_POOL.length ? RING_POOL.pop() : {};
  }
  function freeRing(r) {
    if (RING_POOL.length < 40) RING_POOL.push(r);
  }
  function allocAfter() {
    return AFTER_POOL.length ? AFTER_POOL.pop() : {};
  }
  function freeAfter(a) {
    if (AFTER_POOL.length < 48) AFTER_POOL.push(a);
  }
  function allocShot() {
    return SHOT_POOL.length ? SHOT_POOL.pop() : {};
  }
  function freeShot(s) {
    if (SHOT_POOL.length < 64) SHOT_POOL.push(s);
  }
  function allocGhost() {
    return GHOST_POOL.length ? GHOST_POOL.pop() : {};
  }
  function freeGhost(g) {
    if (GHOST_POOL.length < 32) GHOST_POOL.push(g);
  }
  // Hot-path removal: swap with last then pop (avoids splice shifts).
  function swapRemove(arr, i) {
    const last = arr.length - 1;
    const item = arr[i];
    arr[i] = arr[last];
    arr.pop();
    return item;
  }
  function ensureBrickShade() {
    if (brickShadeBake) return brickShadeBake;
    if (typeof document === "undefined" || !document.createElement) return null;
    const c = document.createElement("canvas");
    if (!c.getContext) return null;
    c.width = TILE;
    c.height = TILE;
    const g = c.getContext("2d");
    const shade = g.createLinearGradient(0, 0, TILE, 0);
    shade.addColorStop(0, "rgba(255,255,255,0.07)");
    shade.addColorStop(0.45, "rgba(255,255,255,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.22)");
    g.fillStyle = shade;
    g.fillRect(0, 0, TILE, TILE);
    brickShadeBake = c;
    return c;
  }
  function lightCookie(r, g, b) {
    const key = (r | 0) + "," + (g | 0) + "," + (b | 0);
    let c = lightCookieCache.get(key);
    if (c) return c;
    if (typeof document === "undefined" || !document.createElement) return null;
    const N = 128;
    c = document.createElement("canvas");
    if (!c.getContext) return null;
    c.width = N;
    c.height = N;
    const x = c.getContext("2d");
    const grd = x.createRadialGradient(N * 0.5, N * 0.5, N * 0.04, N * 0.5, N * 0.5, N * 0.5);
    grd.addColorStop(0, "rgba(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + ",1)");
    grd.addColorStop(1, "rgba(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + ",0)");
    x.fillStyle = grd;
    x.fillRect(0, 0, N, N);
    if (lightCookieCache.size > 48) lightCookieCache.clear();
    lightCookieCache.set(key, c);
    return c;
  }
  function trimParticles() {
    const bag = world.particles;
    if (bag.length <= 280) return;
    const drop = bag.length - 280;
    for (let i = 0; i < drop; i++) freePart(bag[i]);
    for (let i = 0; i < 280; i++) bag[i] = bag[i + drop];
    bag.length = 280;
  }

  function fxAccent() {
    return (currentTheme().accent || [210, 225, 255]);
  }
  function fxDustInk() {
    const brick = (currentTheme().brick || ["#4a4038", "#cfc1aa"])[1] || "#c4b8a8";
    return brick;
  }
  function fxAccentRgb(a) {
    const c = fxAccent();
    return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a == null ? 0.85 : a})`;
  }

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.28 + Math.random() * 0.85);
      const life = 0.26 + Math.random() * 0.38;
      const p = allocPart();
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s - speed * 0.22;
      p.drag = 0.94; p.grav = 0.12;
      p.life = life; p.max = life;
      p.color = color;
      p.size = 1.2 + Math.random() * 2.2;
      p.kind = Math.random() < 0.62 ? "streak" : (Math.random() < 0.55 ? "spark" : "mote");
      p.rot = null; p.spin = 0;
      world.particles.push(p);
    }
    trimParticles();
  }

  function shock(x, y, color) {
    if (!world.rings) world.rings = [];
    const ink = color || "rgba(244,234,216,0.75)";
    while (world.rings.length > 22) freeRing(world.rings.shift());
    const a = allocRing();
    a.x = x; a.y = y; a.r = 3; a.vr = 240; a.drag = 0.78;
    a.life = 0.32; a.max = 0.32; a.w = 2.2; a.soft = false; a.color = ink;
    world.rings.push(a);
    const b = allocRing();
    b.x = x; b.y = y; b.r = 2; b.vr = 96; b.drag = 0.9;
    b.life = 0.46; b.max = 0.46; b.w = 6; b.soft = true; b.color = ink;
    world.rings.push(b);
  }

  function dust(x, y, n, kick) {
    kick = kick || 0;
    const ink = fxDustInk();
    const [ar, ag, ab] = fxAccent();
    for (let i = 0; i < n; i++) {
      const life = 0.22 + Math.random() * 0.24;
      const p = allocPart();
      p.x = x + (Math.random() - 0.5) * 10;
      p.y = y;
      p.vx = (Math.random() - 0.5) * 1.4 - kick * 0.8;
      p.vy = -0.25 - Math.random() * 0.7;
      p.drag = 0.9; p.grav = 0.05;
      p.life = life; p.max = life;
      p.color = Math.random() < 0.22
        ? `rgba(${ar},${ag},${ab},0.7)`
        : ink;
      p.size = 1.4 + Math.random() * 1.8;
      p.kind = Math.random() < 0.75 ? "streak" : "mote";
      p.rot = null; p.spin = 0;
      world.particles.push(p);
    }
    trimParticles();
  }

  function puff(x, y, n, color) {
    const ink = color || fxAccentRgb(0.35);
    for (let i = 0; i < n; i++) {
      const life = 0.28 + Math.random() * 0.34;
      const p = allocPart();
      p.x = x + (Math.random() - 0.5) * 12;
      p.y = y - Math.random() * 4;
      p.vx = (Math.random() - 0.5) * 0.9;
      p.vy = -0.35 - Math.random() * 0.55;
      p.drag = 0.93; p.grav = -0.015;
      p.life = life; p.max = life;
      p.color = ink;
      p.size = 3.5 + Math.random() * 5.5;
      p.kind = "smoke";
      p.rot = null; p.spin = 0;
      world.particles.push(p);
    }
    trimParticles();
  }

  function ember(x, y, n) {
    const [ar, ag, ab] = fxAccent();
    for (let i = 0; i < n; i++) {
      const life = 0.35 + Math.random() * 0.45;
      const p = allocPart();
      p.x = x + (Math.random() - 0.5) * 8;
      p.y = y;
      p.vx = (Math.random() - 0.5) * 0.7;
      p.vy = -0.6 - Math.random() * 1.2;
      p.drag = 0.96; p.grav = -0.03;
      p.life = life; p.max = life;
      p.color = `rgba(${Math.min(255, ar + 40)},${Math.min(255, ag + 20)},${ab | 0},0.9)`;
      p.size = 1.2 + Math.random() * 1.8;
      p.kind = "ember";
      p.rot = null; p.spin = 0;
      world.particles.push(p);
    }
    trimParticles();
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
      "the spikes aren't here for decoration you know.",
      "you saw them. you walked on them anyway.",
      "those points were the whole joke.",
      "feet went first. brain showed up late.",
      "i put those there. you found them with your shoes.",
    ],
    ceiling: [
      "that jump was optional. the ceiling wasn't.",
      "the spikes up there were a hint, you know.",
      "you jumped into that on purpose.",
      "gravity was already doing the work.",
      "up was a bad idea and i watched you do it.",
    ],
    jumpspike: [
      "you aimed at the spikes. i'm not even mad.",
      "that landing. wow. truly a choice.",
      "the floor was spikes and you still picked it.",
      "parkour grade: see me after class.",
    ],
    saw: [
      "it was spinning at you the whole time.",
      "you hugged the blade. bold.",
      "you walked into a saw. a saw.",
      "the teeth kept going. you didn't.",
      "round, sharp, loud. you still tried.",
    ],
    laser: [
      "the red line was the hint.",
      "if it's glowing, that's usually a don't.",
      "you touched the obvious one.",
      "the beam cut you. that's the job.",
    ],
    hole: [
      "there was no floor. you checked.",
      "you fell in the obvious hole.",
      "you stood where the floor used to be.",
      "the gap was right there. you took it.",
      "holes go down. so did you.",
    ],
    jumpfall: [
      "you jumped into nothing. impressive.",
      "that jump had no landing. i checked.",
      "the gap was a gap. sorry.",
      "no floor under that one. you looked.",
    ],
    teeth: [
      "you trusted the fake floor. classic.",
      "it looked solid. i lied.",
      "you found the teeth. congrats.",
      "the floor got you. that one's a little on me.",
    ],
    greed: [
      "you took the bait. the shiny one.",
      "shiny won. you didn't. fair.",
      "those coins were the trap. i still grab them too.",
      "greed speedrun. you got the time.",
    ],
    brick: [
      "a brick beat you. a brick.",
      "head versus brick. brick again.",
      "you stood under that. i would have moved.",
      "the brick had better timing than you.",
    ],
    fake: [
      "you believed the fake door. come on.",
      "wrong door. the other one was right there.",
      "that door was lying. i made it that way.",
      "people run right, so i put the joke there.",
    ],
    reverse: [
      "left was right for a second. you missed it.",
      "you didn't notice the flip. i did.",
      "you walked the wrong way with confidence.",
      "backwards, and still the wrong backwards.",
    ],
    still: [
      "you stood there. the floor left.",
      "don't stop means move. you didn't.",
      "standing still was the trap. you nailed it.",
      "moss on your skill. i'm kidding. mostly.",
    ],
    jump: [
      "you didn't need to jump. the ground was fine.",
      "you could've just walked.",
      "that jump was the trap. you paid it.",
      "the ground was right there. you left it.",
    ],
    stalker: [
      "it followed you. you kept going straight.",
      "it caught up. it had time.",
      "you were the thing it wanted.",
      "don't look back. you kind of did.",
    ],
    drone: [
      "the drone had you. red light and everything.",
      "it saw you. robots are rude like that.",
      "that shot doesn't miss. i tested it.",
      "red light means run. you admired it.",
    ],
    rocket: [
      "that was a missile. you can tell by the boom.",
      "you can't outrun that one. i tried.",
      "incoming was the whole warning.",
      "jump the boom next time. or don't.",
    ],
    fog: [
      "the dark bites. you stood in it.",
      "the fog doesn't care how careful you felt.",
      "you stood in it and it came up.",
      "the fog hit your feet. the floor was fine.",
    ],
    watcher: [
      "it saw you. freezing was a choice.",
      "the eye was on you the whole time.",
      "you froze. it liked that.",
      "the eye won. it usually does.",
    ],
    sentry: [
      "the turret said no.",
      "you walked into the arc.",
      "the wall has a gun now. sorry.",
      "it was on. you were the target.",
    ],
    swarm: [
      "they found you. there were a lot of them.",
      "too many teeth. i got carried away.",
      "the air bit back.",
      "swarm one, you zero.",
    ],
    phantom: [
      "that one had your face and better timing.",
      "your ghost won the fight.",
      "you lost to you. rough.",
      "it wore your face. rude of me.",
    ],
    light: [
      "the light moved. you didn't.",
      "you stepped out and the dark was waiting.",
      "the safe circle left. you stayed.",
      "you left the circle. it noticed.",
    ],
    crush: [
      "the robot said sit.",
      "you were under that. bad spot.",
      "heavy. literally.",
      "stomp. that was the whole move.",
    ],
    qte: [
      "too slow on the letter.",
      "that key was the trap.",
      "the prompt won. you blinked.",
      "you missed the key. it was right there.",
    ],
    generic: [
      "that was on you.",
      "skill issue. i'm not sorry.",
      "you did that.",
      "yes. that. again.",
      "try looking next time. or don't.",
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
    if (cause && String(cause).indexOf("BOSS ") === 0) return "boss";
    if (cause === "QTE") return "qte";
    if (world.doorOpened === "fake") return "fake";
    if (cause === "SAW SAID HI") return "saw";
    if (cause === "BEAM") return "laser";
    if (cause === "GREED") return "greed";
    if (cause === "BRICK") return "brick";
    if (cause === "HIDDEN TEETH" || under === "!") return "teeth";
    if (cause === "STALKER") return "stalker";
    if (cause === "DRONE") return "drone";
    if (cause === "ROCKET") return "rocket";
    if (cause === "FOG") return "fog";
    if (cause === "WATCHER") return "watcher";
    if (cause === "SENTRY") return "sentry";
    if (cause === "SWARM") return "swarm";
    if (cause === "PHANTOM") return "phantom";
    if (cause === "LIGHT") return "light";
    if (cause === "CRUSHBOT") return "crush";
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
    if (cause && String(cause).indexOf("BOSS ") === 0) return bossDeathLine(cause);
    return pickInsult(deathKind(cause));
  }

  function fxTiles(x, y, w, h, ch, force) {
    const hazard = ch === "^" || ch === "v" || ch === "<" || ch === ">";
    const color = hazard ? "#ff4a4a" : "#c4b8a8";
    const n = hazard ? 9 : 6;
    for (let yy = 0; yy < (h || 1); yy++) {
      for (let xx = 0; xx < (w || 1); xx++) {
        const tx = x + xx;
        const ty = y + yy;
        if (ty < 0 || tx < 0 || ty >= (world.tiles || []).length || tx >= world.cols) continue;
        if (!world.tiles[ty]) continue;
        if (!force && world.tiles[ty][tx] === ch) continue;
        burst(tx * TILE + 16, ty * TILE + 10, color, n, hazard ? 3.4 : 2.6);
      }
    }
  }

  function setTiles(x, y, w, h, ch) {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) writeTile(xx, yy, ch);
    }
  }

  const ENTITY_MIN_DIM = {
    stalker: 5, drone: 5, rocket: 5, watcher: 5, sentry: 5, swarm: 5,
    phantom: 5, crushBot: 5, voidFog: 9, huntLight: 10,
  };
  const APEX_MIN_DIM = 8;
  const APEX_ACTION = {
    reaper: 1, salvo: 1, pincer: 1, guillotine: 1, abyss: 1, eclipse: 1, snare: 1,
    orbitSaw: 1, crossfire: 1, leech: 1, shardRain: 1, wraith: 1, mineLine: 1,
    gravLock: 1, seeker: 1, collapse: 1, barbedWind: 1, mirrorBolt: 1, pitBeast: 1,
    judgment: 1,
  };

  function runAction(a) {
    if (!a || !a.length) return;
    const type = a[0];
    if (!ACTIONS.has(type)) throw new Error("Unknown action " + type);
    const dimNow = dimIndex || 1;
    if (type === "blackout" && dimNow < 3) return;
    if (ENTITY_MIN_DIM[type] != null && dimNow < ENTITY_MIN_DIM[type]) return;
    if (APEX_ACTION[type] && dimNow < APEX_MIN_DIM) return;
    if (type === "hole") {
      fxTiles(a[1], a[2], a[3], a[4], ".");
      setTiles(a[1], a[2], a[3], a[4], ".");
    }
    if (type === "fill") {
      if (a[5] === "^" || a[5] === "v" || a[5] === "." || a[5] === "<" || a[5] === ">") {
        fxTiles(a[1], a[2], a[3], a[4], a[5]);
      }
      setTiles(a[1], a[2], a[3], a[4], a[5]);
      if (world.bossCast && "^v<>".includes(a[5])) {
        ownBossTiles(a[1] | 0, a[2] | 0, a[3] || 1, a[4] || 1, world.bossCause || "BOSS SPIKE", world.bossHold || 0.55);
      }
    }
    if (type === "spikes") {
      fxTiles(a[1], a[2], a[3], 1, "^");
      setTiles(a[1], a[2], a[3], 1, "^");
      if (world.bossCast) ownBossTiles(a[1] | 0, a[2] | 0, a[3] || 1, 1, world.bossCause || "BOSS SPIKE", world.bossHold || 0.55);
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
      const dx = a[1] | 0;
      const dy = a[2] | 0;
      world.door.x = dx * TILE;
      world.door.y = dy * TILE;
      // Clear solids on the standing row only — never dig out the floor under the door.
      for (let ox = 0; ox < 2; ox++) {
        const tx = dx + ox;
        if (dy < 0 || dy >= world.rows || tx < 0 || tx >= world.cols) continue;
        if (isSolid(world.tiles[dy][tx])) world.tiles[dy][tx] = ".";
      }
    }
    if (type === "chase") {
      const saw = world.saws[a[1]];
      if (saw) { saw.chase = true; saw.vx = -2.6; }
    }
    if (type === "saw") {
      world.saws.push({
        x: a[1] * TILE + 16, y: a[2] * TILE + 16, vx: a[3] || 0, vy: a[4] || 0,
        chase: false, spin: 0, boss: !!world.bossCast, age: 0,
      });
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
        boss: !!world.bossCast,
      });
      world.flash = 0.06;
    }
    if (type === "glow") {
      world.lasers.push({
        x: a[1] * TILE, y: a[2] * TILE + 12,
        w: (a[3] || 4) * TILE, h: 6, life: a[4] || 0.2, fake: true,
      });
    }
    if (type === "dust") fxTiles(a[1], a[2], a[3] || 1, a[4] || 1, ".", true);
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
      world.drops.push({ x: a[1] * TILE, y: a[2] * TILE, w: TILE, h: TILE, vy: 0, boss: !!world.bossCast });
    }
    if (type === "hideDoor") world.doorHidden = true;
    if (type === "showDoor") world.doorHidden = false;
    if (type === "swapDoor" && world.door && world.fakeDoor) {
      const t = { x: world.door.x, y: world.door.y };
      world.door.x = world.fakeDoor.x; world.door.y = world.fakeDoor.y;
      world.fakeDoor.x = t.x; world.fakeDoor.y = t.y;
    }
    if (type === "slow") slowmo = a[1] || 0.45;
    if (type === "slip") {
      world.slipT = Math.max(world.slipT || 0, a[1] || 1.15);
      world.flash = Math.max(world.flash, 0.04);
    }
    if (type === "jumpCut") {
      world.jumpMul = a[1] == null ? 0.52 : a[1];
      world.jumpMulT = a[2] || 1.35;
      world.hudText = world.hudText || "HEAVY LEGS";
    }
    if (type === "magnet") {
      world.magnet = {
        x: (a[1] == null ? player.x / TILE : a[1]) * TILE + 16,
        str: a[2] == null ? 0.16 : a[2],
        until: world.time + (a[3] || 1.1),
      };
      world.shake = Math.max(world.shake, 3);
    }
    if (type === "blink") {
      const bx = a[1] | 0, by = a[2] | 0, bw = a[3] || 2, bh = a[4] || 1;
      const dur = a[5] || 0.85;
      const cells = [];
      for (let yy = 0; yy < bh; yy++) {
        for (let xx = 0; xx < bw; xx++) {
          const tx = bx + xx, ty = by + yy;
          if (ty < 0 || ty >= (world.tiles || []).length || tx < 0 || tx >= world.cols || !world.tiles[ty]) continue;
          cells.push([tx, ty, world.tiles[ty][tx]]);
          world.tiles[ty][tx] = ".";
        }
      }
      fxTiles(bx, by, bw, bh, ".", true);
      world.restores.push({ at: world.time + dur, cells });
      world.shake = Math.max(world.shake, 4);
      audio.play("crumble");
    }
    if (type === "clamp") {
      const cx = a[1] | 0;
      const cy = a[2] | 0;
      const hold = a[3] || 0.48;
      const cells = [];
      const spots = [[cx, cy, "^"], [cx, Math.max(0, cy - 3), "v"]];
      for (const [tx, ty, ch] of spots) {
        if (ty < 0 || ty >= (world.tiles || []).length || tx < 0 || tx >= world.cols || !world.tiles[ty]) continue;
        cells.push([tx, ty, world.tiles[ty][tx]]);
        world.tiles[ty][tx] = ch;
        fxTiles(tx, ty, 1, 1, ch);
        if (world.bossCast) ownBossTiles(tx, ty, 1, 1, world.bossCause || "BOSS CLAMP", hold);
      }
      world.restores.push({ at: world.time + hold, cells });
      world.shake = Math.max(world.shake, 6);
      audio.play("spike");
    }
    if (type === "echo") {
      const delay = a[1] || 0.55;
      const sx = player.x / TILE;
      const sy = Math.max(0, (player.y + 8) / TILE);
      const dir = player.facing >= 0 ? -2.4 : 2.4;
      world.queued.push({
        at: world.time + delay,
        do: [["saw", sx, sy, dir, 0], ["sfx", "saw"], ["shake", 4]],
      });
      world.hudText = world.hudText || "ECHO";
    }
    if (type === "sticky") {
      stickyNext = Math.max(stickyNext, a[1] || 0.55);
      world.hudText = world.hudText || "TAR";
    }
    if (type === "rift") {
      world.riftUntil = Math.max(world.riftUntil || 0, world.time + (a[1] || 1.4));
      world.riftNext = world.time;
      world.riftGap = 0;
      world.shake = Math.max(world.shake, 5);
      audio.play("crumble");
    }
    if (type === "blackout") {
      const dur = a[1] || 11.5;
      world.blackout = Math.max(world.blackout || 0, dur);
      world.blackoutMax = Math.max(world.blackoutMax || 0, world.blackout);
      world.flash = 0.22;
      world.chromatic = Math.max(world.chromatic || 0, 0.55);
      world.shake = Math.max(world.shake, 7);
      world.hudGlitch = Math.max(world.hudGlitch || 0, 1.4);
      audio.play("glitch");
    }
    if (type === "heavy") {
      world.heavyMul = a[1] == null ? 1.55 : a[1];
      world.heavyT = a[2] || 1.2;
      world.gravity = world.baseGravity * world.heavyMul;
      world.shake = Math.max(world.shake, 4);
    }
    // Entity / horror traps
    if (type === "stalker") {
      const px = player.x + player.w / 2;
      world.entities.push({
        kind: "stalker",
        x: px - player.facing * (a[1] || 90),
        y: player.y + 4,
        w: 22, h: 26,
        vx: 0, life: a[2] || 3.2,
        speed: a[3] || 3.35,
      });
      world.hudText = "IT SEES YOU";
      world.shake = Math.max(world.shake, 5);
      audio.play("near");
    }
    if (type === "drone") {
      world.entities.push({
        kind: "drone",
        x: (a[1] != null ? a[1] : player.x / TILE + 2) * TILE,
        y: (a[2] != null ? a[2] : 3) * TILE + 10,
        w: 20, h: 14,
        life: a[3] || 3.6,
        fireAt: world.time + 0.55,
        spin: 0,
      });
      world.hudText = "DRONE ONLINE";
      audio.play("near");
    }
    if (type === "rocket") {
      const fromRight = (a[1] == null ? 1 : a[1]) >= 0;
      const y = (a[2] != null ? a[2] : (player.y + 8) / TILE) * TILE;
      world.entities.push({
        kind: "rocket",
        x: fromRight ? world.cols * TILE + 20 : -20,
        y,
        w: 28, h: 12,
        vx: fromRight ? -4.2 : 4.2,
        vy: 0,
        life: a[3] || 2.8,
        home: a[4] == null ? 0.07 : a[4],
        boss: !!world.bossCast,
      });
      world.hudText = "INCOMING";
      world.shake = Math.max(world.shake, 4);
      audio.play("saw");
    }
    if (type === "voidFog") {
      world.voidFogUntil = Math.max(world.voidFogUntil || 0, world.time + (a[1] || 2.4));
      world.voidFog = Math.max(world.voidFog || 0, 0.15);
      world.hudText = "FOG RISING";
      world.chromatic = Math.max(world.chromatic, 0.25);
      audio.play("glitch");
    }
    if (type === "watcher") {
      world.entities.push({
        kind: "watcher",
        x: (a[1] != null ? a[1] : Math.floor(player.x / TILE) + 3) * TILE + 16,
        y: (a[2] != null ? a[2] : 2) * TILE + 16,
        w: 18, h: 18,
        life: a[3] || 3.2,
        charge: 0,
        open: 0,
      });
      world.hudText = "WATCHING";
      audio.play("near");
    }
    if (type === "sentry") {
      const side = a[1] == null ? 1 : a[1];
      world.entities.push({
        kind: "sentry",
        x: (side >= 0 ? Math.min(world.cols - 1, 30) : 1) * TILE + 8,
        y: (a[2] != null ? a[2] : Math.floor((player.y + 8) / TILE)) * TILE + 4,
        w: 18, h: 22,
        side,
        life: a[3] || 3.0,
        fireAt: world.time + 0.35,
      });
      world.hudText = "SENTRY";
      audio.play("spike");
    }
    if (type === "swarm") {
      const y = (a[1] != null ? a[1] : 6) * TILE;
      const dir = a[2] == null ? 1 : a[2];
      const n = a[3] || 5;
      for (let i = 0; i < n; i++) {
        world.entities.push({
          kind: "swarm",
          x: dir > 0 ? -30 - i * 28 : world.cols * TILE + 30 + i * 28,
          y: y + Math.sin(i * 1.2) * 18,
          w: 12, h: 10,
          vx: dir * (3.4 + i * 0.08),
          phase: i * 0.9,
          life: 2.6,
        });
      }
      world.hudText = "SWARM";
      audio.play("near");
    }
    if (type === "phantom") {
      const ahead = player.facing >= 0 ? 1 : -1;
      world.entities.push({
        kind: "phantom",
        x: player.x + ahead * 140,
        y: player.y,
        w: player.w, h: player.h,
        vx: -ahead * 3.1,
        life: a[1] || 2.8,
        facing: -ahead,
      });
      world.hudText = "NOT YOU";
      world.flash = Math.max(world.flash, 0.08);
      audio.play("glitch");
    }
    if (type === "huntLight") {
      world.huntLight = {
        until: world.time + (a[1] || 2.6),
        x: player.x + player.w / 2,
        vx: (player.facing || 1) * 2.2,
        cold: 0,
        r: a[2] || 78,
      };
      world.hudText = "STAY LIT";
      world.chromatic = Math.max(world.chromatic, 0.2);
      audio.play("glitch");
    }
    if (type === "crushBot") {
      const tx = a[1] != null ? a[1] : Math.floor((player.x + player.w / 2) / TILE);
      world.entities.push({
        kind: "crushBot",
        x: tx * TILE,
        y: -40,
        w: 36, h: 48,
        life: a[2] || 2.2,
        state: "warn",
        warnT: 0.45,
        stompY: (a[3] != null ? a[3] : 5) * TILE,
        hit: false,
      });
      world.hudText = "STOMP INCOMING";
      world.shake = Math.max(world.shake, 3);
      audio.play("near");
    }
    if (type === "qte") armQte(a);
    if (APEX_KINDS.has(type)) runApex(type, a);
  }

  const APEX_KINDS = new Set([
    "reaper", "salvo", "pincer", "guillotine", "abyss", "eclipse", "snare", "orbitSaw",
    "crossfire", "leech", "shardRain", "wraith", "mineLine", "gravLock", "seeker",
    "collapse", "barbedWind", "mirrorBolt", "pitBeast", "judgment",
  ]);

  function laterHazard(tx, ty, when, hold, ch) {
    tx = tx | 0;
    ty = ty | 0;
    if (ty < 0 || ty >= world.rows || tx < 0 || tx >= world.cols) return;
    const prev = world.tiles[ty][tx];
    world.queued.push({
      at: world.time + when,
      do: [["fill", tx, ty, 1, 1, ch], ["sfx", "spike"], ["shake", 3]],
    });
    world.restores.push({ at: world.time + when + hold, cells: [[tx, ty, prev]] });
  }

  function runApex(type, a) {
    const x = a[1] | 0;
    const y = a[2] | 0;
    if (type === "reaper") {
      const speed = a[1] || 5.2;
      const life = a[2] || 2.3;
      const behind = player.facing >= 0 ? -1 : 1;
      world.entities.push({
        kind: "reaper",
        x: player.x + behind * 120,
        y: player.y + 2,
        w: 26, h: 34,
        vx: 0,
        life,
        speed,
      });
      world.shake = Math.max(world.shake, 6);
      audio.play("near");
    } else if (type === "salvo") {
      const fy = a[1] | 0 || 8;
      [0, 0.28, 0.56].forEach((delay, i) => {
        const row = fy - (i === 1 ? 2 : i === 2 ? 1 : 0);
        world.queued.push({
          at: world.time + delay,
          do: [["rocket", i === 2 ? 0 : 1, Math.max(2, row), 2.4, 0.05]],
        });
      });
      world.shake = Math.max(world.shake, 4);
      audio.play("saw");
    } else if (type === "pincer") {
      const fy = (a[2] | 0) || 8;
      world.saws.push({ x: Math.max(1, x - 7) * TILE, y: fy * TILE - 8, vx: 2.8, vy: 0, chase: false, spin: 0 });
      world.saws.push({ x: Math.min(world.cols - 1, x + 7) * TILE, y: fy * TILE - 8, vx: -2.8, vy: 0, chase: false, spin: 0 });
      audio.play("saw");
    } else if (type === "guillotine") {
      const w = a[3] || 3;
      const row = Math.max(1, y - 3);
      for (let i = 0; i < w; i++) laterHazard(x + i, row, 0.22, 0.5, "v");
      world.shake = Math.max(world.shake, 3);
    } else if (type === "abyss") {
      const w = a[3] || 3;
      const dur = a[4] || 0.4;
      const cells = [];
      for (let i = 0; i < w; i++) {
        const tx = x + i;
        if (tx < 0 || tx >= world.cols || y < 0 || y >= world.rows) continue;
        cells.push([tx, y, world.tiles[y][tx]]);
        world.tiles[y][tx] = ".";
        if (y + 1 < world.rows) {
          cells.push([tx, y + 1, world.tiles[y + 1][tx]]);
          world.tiles[y + 1][tx] = "^";
        }
      }
      fxTiles(x, y, w, 1, ".", true);
      if (cells.length) world.restores.push({ at: world.time + dur, cells });
      world.shake = Math.max(world.shake, 7);
      audio.play("crumble");
    } else if (type === "eclipse") {
      const dur = a[1] || 1.7;
      world.blackout = Math.max(world.blackout || 0, dur);
      world.blackoutMax = Math.max(world.blackoutMax || 0, world.blackout);
      world.huntLight = {
        until: world.time + dur,
        x: player.x + player.w / 2,
        vx: (player.facing || 1) * 3.6,
        cold: 0,
        r: a[2] || 46,
      };
      world.chromatic = Math.max(world.chromatic, 0.35);
      audio.play("glitch");
    } else if (type === "snare") {
      lockTimer = Math.max(lockTimer, 0.26);
      laterHazard(x, y, 0.12, a[3] || 0.42, "^");
      world.shake = Math.max(world.shake, 4);
      audio.play("spike");
    } else if (type === "orbitSaw") {
      const fy = (a[2] | 0) || 8;
      const baseY = fy * TILE - 16;
      world.saws.push({
        x: (a[1] != null ? a[1] : 8) * TILE,
        y: baseY,
        baseY,
        vx: a[3] || -2.6,
        vy: 0,
        orbit: 20,
        phase: 0,
        chase: false,
        spin: 0,
      });
      audio.play("saw");
    } else if (type === "crossfire") {
      const fy = Math.max(2, y - 1);
      const spawn = (tileX, side, delay) => {
        world.entities.push({
          kind: "sentry",
          x: tileX * TILE + 8,
          y: fy * TILE,
          w: 18, h: 22,
          side,
          life: 2.6,
          fireAt: world.time + delay,
          gap: 1.15,
        });
      };
      spawn(Math.max(1, x - 5), -1, 0.12);
      spawn(Math.min(world.cols - 2, x + 5), 1, 0.82);
      audio.play("spike");
    } else if (type === "leech") {
      world.magnet = {
        x: Math.max(2, x - 4) * TILE + 16,
        str: 0.34,
        until: world.time + 0.72,
      };
      laterHazard(x, y, 0.18, 0.4, "^");
      world.shake = Math.max(world.shake, 4);
      audio.play("reverse");
    } else if (type === "shardRain") {
      [0, 1, 4, 5].forEach((i) => {
        world.drops.push({ x: (x + i) * TILE, y: TILE * 1.2, w: TILE - 4, h: TILE - 4, vy: 0.6 });
      });
      world.shake = Math.max(world.shake, 3);
      audio.play("crumble");
    } else if (type === "wraith") {
      const ahead = player.facing >= 0 ? 1 : -1;
      world.entities.push({
        kind: "wraith",
        x: player.x + ahead * 130,
        y: player.y,
        w: player.w + 4,
        h: player.h + 6,
        vx: -ahead * 4.8,
        life: a[1] || 2.2,
      });
      world.flash = Math.max(world.flash, 0.08);
      audio.play("glitch");
    } else if (type === "mineLine") {
      const n = a[3] || 4;
      for (let i = 0; i < n; i++) laterHazard(x + i, y, 0.08 + i * 0.16, 0.32, "^");
      audio.play("spike");
    } else if (type === "gravLock") {
      const dur = a[1] || 0.85;
      world.gravity = -0.7;
      world.jumpMul = 0.42;
      world.jumpMulT = dur;
      world.queued.push({
        at: world.time + dur,
        do: [["gravity", world.baseGravity || 0.55]],
      });
      world.flash = Math.max(world.flash, 0.06);
      audio.play("reverse");
    } else if (type === "seeker") {
      world.entities.push({
        kind: "seeker",
        x: (a[1] != null ? a[1] : 8) * TILE,
        y: Math.max(1, (a[2] | 0) - 5) * TILE + 6,
        w: 22, h: 14,
        life: a[3] || 3.1,
        fireAt: world.time + 0.4,
        spin: 0,
      });
      audio.play("near");
    } else if (type === "collapse") {
      [0, 2].forEach((i) => {
        world.entities.push({
          kind: "crushBot",
          x: (x + i) * TILE,
          y: -36,
          w: 34, h: 46,
          life: 2.4,
          state: "warn",
          warnT: 0.62,
          stompY: y * TILE,
          hit: false,
        });
      });
      world.shake = Math.max(world.shake, 3);
      audio.play("near");
    } else if (type === "barbedWind") {
      const back = x > world.cols / 2 ? 1 : -1;
      world.wind = 1.15 * back;
      world.queued.push({ at: world.time + 0.62, do: [["wind", 0]] });
      laterHazard(x + (back < 0 ? -1 : 1), Math.max(1, y - 1), 0.08, 0.5, back < 0 ? ">" : "<");
      audio.play("reverse");
    } else if (type === "mirrorBolt") {
      const dur = a[2] || 0.48;
      const fy = a[1] | 0 || 8;
      world.reverse = true;
      world.queued.push({ at: world.time + dur, do: [["reverse", false]] });
      world.queued.push({
        at: world.time + 0.08,
        do: [["rocket", 1, Math.max(2, fy - 1), 2.2, 0.04]],
      });
      world.flash = 0.06;
      audio.play("reverse");
    } else if (type === "pitBeast") {
      const dur = a[1] || 1.25;
      world.riftUntil = Math.max(world.riftUntil || 0, world.time + dur);
      world.riftNext = world.time;
      world.riftGap = 0.16;
      world.entities.push({
        kind: "reaper",
        x: player.x - (player.facing || 1) * 140,
        y: player.y + 2,
        w: 26, h: 34,
        vx: 0,
        life: dur + 0.4,
        speed: a[2] || 4.1,
      });
      world.shake = Math.max(world.shake, 6);
      audio.play("crumble");
    } else if (type === "judgment") {
      const speed = a[3] || 2.8;
      world.entities.push({
        kind: "sweep",
        x: Math.max(0, x - 1) * TILE,
        y: y * TILE - 18,
        w: 34, h: 8,
        vx: speed,
        maxX: Math.min(world.cols - 1, x + 6) * TILE,
        life: 1.8,
      });
      audio.play("spike");
    }
  }

  function qteFeel(win, nkeys) {
    const blind = Math.min(win * 0.32, Math.max(0, (1.05 - win) * 0.22));
    return {
      blind,
      strict: true,
      flicker: win < 0.5 || nkeys >= 4,
      lock: win >= 0.85 && nkeys <= 2,
      windup: win >= 0.95 ? 0.28 : win >= 0.6 ? 0.12 : 0,
      slop: 0,
    };
  }

  function armQte(a) {
    const win = Math.max(0.16, Math.min(1.6, Number(a[1]) || 0.8));
    const keys = [];
    for (let i = 2; i < a.length && keys.length < 6; i++) {
      const code = a[i] | 0;
      if (code < 65 || code > 90) continue;
      const ch = String.fromCharCode(code);
      if ("WASDR".includes(ch)) continue;
      keys.push(ch);
    }
    if (!keys.length) keys.push("J");
    const feel = qteFeel(win, keys.length);
    world.qte = {
      keys,
      index: 0,
      window: win,
      left: feel.windup || win,
      phase: feel.windup > 0 ? "arm" : "go",
      blind: feel.blind,
      strict: feel.strict,
      flicker: feel.flicker,
      lock: feel.lock,
      windup: feel.windup,
      slop: feel.slop,
      box: null,
    };
    world.hudText = feel.windup > 0 ? "READY" : "NOW";
    world.shake = Math.max(world.shake, 4);
    world.flash = Math.max(world.flash, 0.05);
    audio.play("glitch");
  }

  function pressQte(key) {
    const q = world.qte;
    if (!q || player.dead || player.win || q.phase !== "go") return false;
    const got = String(key || "").toUpperCase();
    if (got !== q.keys[q.index]) {
      if (got.length === 1 && got >= "A" && got <= "Z") failQte();
      return false;
    }
    q.index += 1;
    audio.play("type");
    world.shake = Math.max(world.shake, 2);
    if (q.index >= q.keys.length) {
      world.qte = null;
      world.hudText = "CLEAN";
      world.flash = Math.max(world.flash, 0.08);
      audio.play("combo");
      return true;
    }
    const feel = qteFeel(q.window, q.keys.length);
    q.left = q.window;
    q.slop = feel.slop;
    world.hudText = "NOW";
    return true;
  }

  function failQte() {
    if (!world.qte || player.dead) return;
    world.qte = null;
    world.hudText = "MISS";
    die("QTE");
  }

  function tickQte() {
    const q = world.qte;
    if (!q || player.dead || player.win) return;
    q.left -= FIXED;
    if (q.phase === "arm") {
      if (q.left > 0) return;
      q.phase = "go";
      q.left = q.window;
      q.slop = qteFeel(q.window, q.keys.length).slop;
      world.hudText = "NOW";
      audio.play("tick");
      return;
    }
    if (q.left > 0) return;
    failQte();
  }

  function drawQte() {
    const q = world.qte;
    if (!q || player.dead || mode !== "play") {
      if (q) q.box = null;
      return;
    }
    const w = Math.min(420, Math.max(240, VIEW_W * 0.34));
    const h = Math.min(230, Math.max(168, VIEW_H * 0.36));
    const x = (VIEW_W - w) / 2;
    const y = Math.max(16, VIEW_H * 0.16);
    q.box = { x, y, w, h };
    const urgent = q.phase === "go" && q.left < q.window * 0.33;
    const flick = q.flicker && Math.sin(world.time * 36) > 0;
    ctx.save();
    ctx.fillStyle = "rgba(6,4,8,0.82)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = urgent || flick ? "#ff4040" : "#f0c14b";
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e7c56a";
    ctx.font = `800 ${Math.max(13, Math.round(w * 0.07))}px Rubik, sans-serif`;
    const label = q.phase === "arm"
      ? "GET READY"
      : (q.keys.length > 1 ? `PRESS  ${q.index + 1}/${q.keys.length}` : "PRESS");
    ctx.fillText(label, x + w / 2, y + h * 0.22);
    let glyph = "";
    if (q.phase === "arm") glyph = Math.sin(world.time * 8) > 0 ? "!" : "";
    else glyph = (q.window - q.left) >= q.blind ? q.keys[q.index] : "?";
    ctx.fillStyle = urgent ? "#ff5a5a" : "#fff6d0";
    ctx.font = `800 ${Math.max(54, Math.round(w * 0.28))}px Bungee, Rubik, sans-serif`;
    ctx.fillText(glyph, x + w / 2, y + h * 0.52);
    const frac = q.phase === "arm"
      ? Math.max(0, q.left / Math.max(0.01, q.windup))
      : Math.max(0, q.left / q.window);
    const barX = x + w * 0.12;
    const barW = w * 0.76;
    const barY = y + h * 0.78;
    ctx.fillStyle = "#2a2018";
    ctx.fillRect(barX, barY, barW, 8);
    ctx.fillStyle = urgent ? "#ff4040" : "#f0c14b";
    ctx.fillRect(barX, barY, barW * Math.min(1, frac), 8);
    ctx.fillStyle = "#c4b8a4";
    ctx.font = `700 ${Math.max(11, Math.round(w * 0.045))}px Rubik, sans-serif`;
    ctx.fillText("OR TAP", x + w / 2, y + h * 0.92);
    ctx.restore();
  }

  function tickRareEffects() {
    if (world.slipT > 0) world.slipT = Math.max(0, world.slipT - FIXED);
    if (world.jumpMulT > 0) {
      world.jumpMulT = Math.max(0, world.jumpMulT - FIXED);
      if (world.jumpMulT <= 0) world.jumpMul = 1;
    }
    if (world.magnet && world.time >= world.magnet.until) world.magnet = null;
    if (world.blackout > 0) {
      world.blackout = Math.max(0, world.blackout - FIXED);
      if (world.blackout <= 0) world.blackoutMax = 0;
    }
    if (world.heavyT > 0) {
      world.heavyT = Math.max(0, world.heavyT - FIXED);
      if (world.heavyT <= 0) {
        world.heavyMul = 1;
        world.gravity = world.baseGravity;
      }
    }
    for (const r of world.restores || []) {
      if (r.done || world.time < r.at) continue;
      r.done = true;
      for (const [tx, ty, ch] of r.cells) {
        if (ty >= 0 && ty < world.rows && tx >= 0 && tx < world.cols) world.tiles[ty][tx] = ch;
      }
    }
    if (world.voidFogUntil && world.time < world.voidFogUntil) {
      world.voidFog = Math.min(0.58, (world.voidFog || 0) + FIXED * 0.16);
    } else if ((world.voidFog || 0) > 0) {
      world.voidFog = Math.max(0, world.voidFog - FIXED * 0.45);
    }
    if (world.huntLight && world.time >= world.huntLight.until) world.huntLight = null;

    if (world.riftUntil && world.time >= world.riftUntil) world.riftGap = 0;
    if (world.riftUntil && world.time < world.riftUntil && world.time >= (world.riftNext || 0)) {
      world.riftNext = world.time + (world.riftGap || 0.32);
      const tx = Math.floor((player.x + player.w / 2) / TILE);
      const doorTx = world.door ? Math.floor(world.door.x / TILE) : 99;
      if (tx >= 5 && tx <= world.cols - 4 && Math.abs(tx - doorTx) > 2) {
        let ty = -1;
        for (let y = 0; y < world.rows; y++) {
          if (isSolid(world.tiles[y][tx])) { ty = y; break; }
        }
        // Prefer the floor under the player.
        const feet = Math.floor((player.y + player.h + 1) / TILE);
        if (feet >= 0 && feet < world.rows && isSolid(world.tiles[feet][tx])) ty = feet;
        if (ty >= 0) {
          const cells = [[tx, ty, world.tiles[ty][tx]]];
          if (ty + 1 < world.rows) cells.push([tx, ty + 1, world.tiles[ty + 1][tx]]);
          world.tiles[ty][tx] = ".";
          if (ty + 1 < world.rows) world.tiles[ty + 1][tx] = "^";
          fxTiles(tx, ty, 1, 1, ".");
          world.restores.push({ at: world.time + 0.75, cells });
          world.shake = Math.max(world.shake, 3);
        }
      }
    }
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
    ev.uses = (ev.uses || 0) + 1;
    if (ev.uses < trapLimit(ev)) {
      const gap = ev.rearm > 0 ? ev.rearm : 1.35;
      ev.rearmAt = world.time + gap;
    }
  }

  function trapLimit(ev) {
    let n = ev.times > 1 ? ev.times : 1;
    if (ev.once === false && n < 2) n = 2;
    const cap = window.SURGE_WORLDS && window.SURGE_WORLDS.activationCap
      ? window.SURGE_WORLDS.activationCap(dimIndex || 1)
      : 4;
    if (n > cap) n = cap;
    return n;
  }

  function ownBossTiles(x, y, w, h, cause, hold) {
    world.bossSpikes = world.bossSpikes || {};
    const until = world.time + (hold || 0.55);
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        world.bossSpikes[(x + xx) + "," + (y + yy)] = { until, cause: cause || "BOSS SPIKE" };
      }
    }
  }

  function bossTileCause(px, py) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    const rec = world.bossSpikes && world.bossSpikes[tx + "," + ty];
    if (!rec || world.time > rec.until) return "";
    return rec.cause || "BOSS SPIKE";
  }

  function bossHoldsDoor() {
    const b = world.boss;
    // Door stays shut for the whole fight. It only opens once the boss is gone.
    return !!(b && b.phase !== "gone");
  }

  function bossBlastHits() {
    const b = world.boss;
    if (!b || b.phase !== "boom" || player.dead || player.win) return false;
    const big = b.dim === 1;
    if (b.boom > (big ? 0.7 : 0.46)) return false;
    const rad = big ? Math.min(250, 70 + b.boom * 520) : Math.min(156, 52 + b.boom * 380);
    const dx = (player.x + player.w / 2) - b.x;
    const dy = (player.y + player.h / 2) - (b.y + 30);
    return dx * dx + dy * dy < rad * rad;
  }

  const BOSS_SPEED = 2.2 * 2;

  function bossSpeed(dim) {
    return BOSS_SPEED * (1 + Math.min(0.22, ((dim || 1) - 1) * 0.01));
  }

  function bossTalk(kind, force) {
    const b = world.boss;
    if (!b) return;
    // Dim 2+ bosses stay silent. Null keeps the talk.
    if ((b.dim || 1) >= 2) return;
    const pack = window.SURGE_BOSS_VOICE;
    if (!pack) return;
    const v = pack.voice(b.dim || 1);
    if (!v) return;
    if (b.say && b.say.age < b.say.life - 0.05 && !force) return;
    let text = "";
    const kits = window.SURGE_BOSS_KITS;
    if (b.dim === 1 && NULL_SAY[kind]) text = nullPick(NULL_SAY[kind]);
    else if (kits && kits.say && kits.say(b.dim, kind)) text = kits.say(b.dim, kind);
    else if (kind === "hi") text = v.hi;
    else if (kind === "close") text = v.close;
    else if (kind === "bored") text = v.bored;
    else if (kind === "fall") text = v.fall;
    else if (kind === "tired") text = v.tired;
    else {
      const i = (pack.IDS || []).indexOf(kind);
      text = i >= 0 && v.shots ? v.shots[i] : "";
    }
    if (!text) return;
    b.say = {
      text,
      name: v.name,
      color: v.color,
      ink: (b.mood || 0) >= 0.7 ? "#ffc2a4" : v.ink,
      life: 2.5,
      age: 0,
    };
  }

  const NULL_DEAD = {
    spin: ["the oval got you.", "it slid into you.", "left, right, you.", "that bright one."],
    shot: ["too many ovals.", "the burst got you.", "you ate the fan.", "eleven was rude."],
    pound: ["you didn't jump.", "the slam. jump.", "feet stayed down."],
    half: ["wrong half.", "that side. run.", "I lit your half."],
    needles: ["those lines.", "the skinny ones.", "you stood in one."],
    magnet: ["I pulled. You stayed.", "the pull won.", "come here failed."],
    drive: ["should've jumped.", "I ran the floor.", "dash got your feet."],
    shove: ["off my door.", "too close.", "I shoved. Sorry."],
    storm: ["the fog had gaps.", "bright lane. missed.", "fog ate you."],
    pop: ["it broke on you.", "the split got you.", "four more. oops."],
  };
  const NULL_SAY = {
    hi: [
      "You made it. I didn't bet on that.",
      "Hi. I hoped the floor would end this.",
      "Oh. You're actually here.",
      "Wait. I know your jumps.",
      "Don't walk up. I'm nervous.",
      "I rehearsed a speech. Forgot it.",
    ],
    close: [
      "No. Stay back. Door's going.",
      "I'm throwing it. Look away.",
      "Hands off. I mean that.",
      "The flames have the door.",
      "Not your door. Mine. Sorry.",
    ],
    bored: [
      "Thirty seconds. Get off my door.",
      "I counted to thirty. Move.",
      "You've hugged that door long enough.",
      "Thirty. I'm bored and scared.",
    ],
    fall: [
      "Not by you. Way over there.",
      "I put it somewhere rude.",
      "Door's gone. Go find it.",
      "Far side. I panicked.",
    ],
    tired: [
      "I can't. I'm done.",
      "Arms gave out. You win.",
      "Okay. I quit. Happy?",
      "I'm out of fire.",
    ],
    back: [
      "I got scared.",
      "That was mean. Sorry.",
      "I flinched. You didn't.",
      "My bad. Mostly.",
    ],
  };

  function nullPick(bag) {
    if (!bag) return "";
    if (typeof bag === "string") return bag;
    const b = world.boss;
    if (!b || !bag.length) return bag[0] || "";
    let i = Math.floor(bossRand(b) * bag.length);
    if (bag.length > 1 && bag[i] === b.lastLine) i = (i + 1) % bag.length;
    b.lastLine = bag[i];
    return bag[i];
  }
  const NULL_IDS = ["spin", "shot", "pound", "half", "needles", "magnet", "drive", "pop", "storm", "shove"];
  const NULL_LASER = { half: 1, needles: 1, storm: 1 };
  const NULL_UNLOCK = [
    [0, "spin"], [0, "shot"], [0, "pop"],
    [2, "pound"],
    [3, "half"],
    [4, "needles"],
    [5, "magnet"],
    [6, "drive"],
    [7, "storm"],
    [8, "shove"],
  ];
  const NULL_COOL = { shot: 4.5, pound: 60, magnet: 34, drive: 95, half: 180, needles: 22, storm: 80 };

  function bossDeathLine(cause) {
    const id = String(cause || "").replace(/^BOSS\s+/, "").toLowerCase();
    const d = (world.boss && world.boss.dim) || dimIndex || 1;
    const pack = window.SURGE_BOSS_VOICE;
    if (id === "boom") return d >= 2 ? "it blew." : "I fell on you.";
    const kits = window.SURGE_BOSS_KITS;
    // Dim 2+ still use short cause labels (not dialogue). No first-person talk.
    if (kits && kits.line) {
      const kitLine = kits.line(d, id, true);
      if (kitLine) return kitLine.length <= 22 ? kitLine : kitLine.slice(0, 22);
    }
    if (d === 1 && NULL_DEAD[id]) {
      const text = nullPick(NULL_DEAD[id]);
      return text.length <= 22 ? text : text.slice(0, 22);
    }
    if (d >= 2) return "the boss got you.";
    if (pack && pack.line) {
      const text = pack.line(d, id, true);
      if (text) return text.length <= 22 ? text : text.slice(0, 22);
    }
    return "hey. you stayed.";
  }

  function bossRand(b) {
    b.seed = (Math.imul(b.seed || 1, 1664525) + 1013904223) >>> 0;
    return b.seed / 4294967296;
  }

  function bossReaching(b) {
    if (!b || b.dim === 1 || !world.door) return false;
    if (b.dropping) return true;
    if (b.tell || b.rush || b.wave) return false;
    if (world.bossZones && world.bossZones.length) return false;
    if (world.bossShots && world.bossShots.length) return false;
    return b.phase === "fight" && bossNearDoor() && b.doorCd < 0.55 && (b.moves || 0) < (b.goal || 1);
  }

  function bossNearDoor() {
    if (!world.door) return false;
    const dx = (player.x + player.w / 2) - (world.door.x + 16);
    const dy = (player.y + player.h / 2) - (world.door.y + 16);
    const reach = 3.2 * TILE;
    return dx * dx + dy * dy < reach * reach;
  }

  function bossPickPad(b, spec) {
    const surface = (world.rules && world.rules.surface) || [];
    const pads = [];
    for (let x = 6; x <= surface.length - 4; x += 4) {
      if (surface[x] >= 0) pads.push({ x, y: surface[x] - 1 });
    }
    const doorTile = world.door ? world.door.x / TILE : -99;
    let pool = pads.filter((p) => {
      if (Math.abs(p.x - doorTile) < 1) return false;
      const away = Math.abs(p.x - spec.away);
      if (away < spec.min || away > spec.max) return false;
      if (spec.from != null) {
        const hop = Math.abs(p.x - spec.from);
        if (hop < spec.fromMin || hop > spec.fromMax) return false;
      }
      return true;
    });
    if (!pool.length && spec.loose) {
      pool = pads.filter((p) => Math.abs(p.x - spec.away) >= Math.min(6, spec.min) && Math.abs(p.x - doorTile) >= 1);
    }
    if (!pool.length && spec.loose) {
      // Last pad: farthest free tile from the player. The failsafe must fire.
      pool = pads.filter((p) => Math.abs(p.x - doorTile) >= 1);
      pool.sort((a, c) => Math.abs(c.x - spec.away) - Math.abs(a.x - spec.away));
      return pool[0] || null;
    }
    if (!pool.length) return null;
    pool.sort((a, c) => Math.abs(c.x - doorTile) - Math.abs(a.x - doorTile));
    const far = pool.slice(0, Math.max(1, Math.ceil(pool.length / 2)));
    return far[Math.floor(bossRand(b) * far.length)];
  }

  function bossFightAge(b) {
    if (!b) return world.time;
    if (b.phase === "intro") return 0;
    // Cutscenes stamp fightAt when the movie ends. Tests and bot skips leave it null and use world.time.
    if (b.fightAt == null) return world.time;
    return Math.max(0, world.time - b.fightAt);
  }

  function bossBeginFight(b) {
    if (!b) return;
    b.phase = "fight";
    b.fightAt = world.time;
    b.bars = 0;
    b.flash = 0;
    // Cutscene lines stay in the cutscene. Fight starts quiet until enrage.
    b.say = null;
    b.saidHi = true;
  }

  // Thirty seconds into the fight: warn first, then the door leaves on a short fuse.
  function bossArmBored(b) {
    if (!b || b.saidBored) return;
    b.saidBored = true;
    bossTalk("bored", true);
    b.doorCd = Math.max(b.doorCd || 0, 1.25);
    b.attack = Math.max(b.attack || 0, 0.55);
  }

  function bossFailDrop(b) {
    if (!b || b.dropping || b.moves >= b.goal) return false;
    const away = (player.x + player.w / 2) / TILE;
    const pad = bossPickPad(b, { away: away, min: 8, max: 16, loose: true });
    if (!pad) {
      b.doorCd = 0.2;
      return false;
    }
    bossStartDrop(b, pad);
    b.doorCd = 1.05;
    return true;
  }

  function bossClearHazards(b) {
    if (!b) return;
    b.drive = null;
    b.wave = null;
    b.half = null;
    b.rush = null;
    b.tell = null;
    b.snatch = null;
    b.echo = null;
    b.lane = null;
    b.fog = 0;
    b.safeW = 0;
    world.nullBeams = [];
    world.bossFog = 0;
    world.magnet = null;
    world.bossZones = [];
    world.bossShots = [];
    world.bossSpikes = {};
    if (world.drops && world.drops.length) {
      let n = 0;
      for (let i = 0; i < world.drops.length; i++) {
        if (world.drops[i].boss) continue;
        if (n !== i) world.drops[n] = world.drops[i];
        n += 1;
      }
      world.drops.length = n;
    }
    if (world.saws && world.saws.length) {
      let n = 0;
      for (let i = 0; i < world.saws.length; i++) {
        if (world.saws[i].boss) continue;
        if (n !== i) world.saws[n] = world.saws[i];
        n += 1;
      }
      world.saws.length = n;
    }
  }

  function bossMarkSpent(b) {
    b.mood = b.goal ? Math.min(1, b.moves / b.goal) : 0;
    if (b.moves < b.goal || b.phase !== "fight") return;
    b.phase = "rage";
    b.rageUntil = world.time + 0.72;
    b.mood = 1;
    b.attack = Math.max(b.attack, 0.8);
    // Null stops ticking fight logic in rage; freeze-clear so beams/drive can't softlock the door.
    if (b.dim === 1) bossClearHazards(b);
    bossTalk("tired", true);
  }

  function syncBossMusic(def) {
    const want = !!(def && def.boss);
    if (!audio.theme) audio.setTheme(dimIndex);
    const was = !!audio.theme.boss;
    if (want) {
      const dim = (def.dim || dimIndex) | 0;
      const final = dim >= 20;
      const boss = (window.SURGE_TRACKS && window.SURGE_TRACKS.bossMusic(dim)) || { bpm: 174, root: 196 };
      audio.theme.boss = true;
      audio.theme.final = final;
      audio.theme.rage = false;
      audio.theme.bossTrack = boss;
      audio.theme.bpm = boss.bpm;
      audio.theme.root = boss.root;
      if (audio.drone && audio.ctx) {
        const base = Math.max(24, audio.theme.root * 0.35);
        try {
          audio.drone.o.frequency.setTargetAtTime(base, audio.ctx.currentTime, 0.25);
          audio.drone.o2.frequency.setTargetAtTime(base * 2, audio.ctx.currentTime, 0.25);
        } catch (_) { /* ignore */ }
      }
    } else if (was) audio.setTheme(dimIndex);
    if (want !== was) audio.restartMusic();
    if (want) audio.play("bossIn");
  }

  function bossCruise(b) {
    const minX = 150;
    const maxX = Math.max(minX + 40, world.cols * TILE - 150);
    const minY = 64;
    const maxY = Math.max(minY + 20, (world.door ? world.door.y : 280) - 70);
    const dim = b.dim || 1;
    if (!b.wander || world.time >= (b.wanderUntil || 0)) {
      const px = player.x + player.w / 2;
      let tx = minX + bossRand(b) * (maxX - minX);
      if (Math.abs(tx - px) < TILE * 5) tx = px < (minX + maxX) * 0.5 ? maxX - 30 : minX + 30;
      if (dim % 5 === 0) {
        tx = (minX + maxX) * 0.5 + Math.sin(world.time * 0.85 + dim) * (maxX - minX) * 0.46;
      }
      if (dim >= 20) tx = (b.x < (minX + maxX) * 0.5) ? maxX - 20 : minX + 20;
      b.wander = Math.max(minX, Math.min(maxX, tx));
      b.wanderY = minY + bossRand(b) * (maxY - minY);
      const hop = dim >= 20 ? 1.7 : (dim % 2 === 0 ? 0.55 : 1.05);
      b.wanderUntil = world.time + hop + bossRand(b) * 0.7;
    }
    let gx = b.wander;
    let gy = b.wanderY;
    if (b.attack > 0.25 && world.door) {
      gx = world.door.x + 16;
      gy = Math.max(minY, world.door.y - 100);
    }
    gy += Math.sin(world.time * (1.15 + dim * 0.06) + (b.mood || 0) * 2) * (dim % 3 === 0 ? 16 : 9);
    const stiff = dim >= 20 ? 0.028 : (dim % 2 === 0 ? 0.055 : 0.034);
    bossGlide(b, Math.max(minX, Math.min(maxX, gx)), Math.max(minY, Math.min(maxY, gy)), stiff, 0.18);
  }

  function bossGlide(b, tx, ty, stiff, damp) {
    if (b.mvx == null) b.mvx = 0;
    if (b.mvy == null) b.mvy = 0;
    b.mvx += (tx - b.x) * stiff - b.mvx * damp;
    b.mvy += (ty - b.y) * stiff - b.mvy * damp;
    const cap = 6.4;
    const sp = Math.hypot(b.mvx, b.mvy) || 1;
    if (sp > cap) { b.mvx *= cap / sp; b.mvy *= cap / sp; }
    const ox = b.x;
    b.x += b.mvx;
    b.y += b.mvy;
    b.slip = b.x - ox;
  }

  function bossYoink(b, pad) {
    world.door.x = pad.x * TILE;
    world.door.y = pad.y * TILE;
    b.lastDoorX = world.door.x;
    b.moves += 1;
    b.attack = Math.max(b.attack, 0.66);
    const accent = (currentTheme().accent || [255, 200, 120]);
    shock(world.door.x + 16, world.door.y + 16, `rgba(${accent[0] | 0},${accent[1] | 0},${accent[2] | 0},0.85)`);
    burst(world.door.x + 16, world.door.y + 18, `rgb(${accent[0] | 0},${accent[1] | 0},${accent[2] | 0})`, 14, 3);
    audio.play("bossGrab");
    if (!b.saidClose) { b.saidClose = true; bossTalk("close", true); }
    bossMarkSpent(b);
  }

  function bossStartDrop(b, pad) {
    b.dropping = true;
    b.drop = {
      x: pad.x * TILE,
      y: pad.y * TILE,
      from: Math.max(16, pad.y * TILE - 260),
      t: 0,
    };
    world.door.x = b.drop.x;
    world.door.y = b.drop.from;
    b.attack = Math.max(b.attack, 0.4);
    audio.play("bossDrop");
    if (b.dim === 1) {
      b.punch = Math.max(b.punch || 0, 0.85);
      world.shake = Math.max(world.shake || 0, 8);
    }
    bossTalk("fall", true);
  }

  function bossFinishDrop(b) {
    world.door.x = b.drop.x;
    world.door.y = b.drop.y;
    b.dropping = false;
    b.drop = null;
    b.lastDoorX = world.door.x;
    b.moves += 1;
    burst(world.door.x + 16, world.door.y + 20, "#fff6d0", 12, 3);
    audio.play("bossLand");
    bossMarkSpent(b);
  }

  function bossSpawnShot(shot) {
    if (!world.bossShots) world.bossShots = [];
    const nullShot = NULL_IDS.indexOf(shot.kind) >= 0;
    if (shot.kit) {
      if (world.bossShots.length >= 24) return;
    } else if (!nullShot && world.bossShots.length >= 16) {
      freeShot(world.bossShots.shift());
    }
    if (nullShot && world.bossShots.length >= 48) return;
    const box = allocShot();
    box.x = shot.x;
    box.y = shot.y;
    box.w = shot.w || 16;
    box.h = shot.h || 16;
    box.vx = shot.vx || 0;
    box.vy = shot.vy || 0;
    box.grav = shot.grav || 0;
    box.life = shot.life == null ? 2.2 : shot.life;
    box.maxLife = shot.life == null ? 2.2 : shot.life;
    box.delay = shot.delay || 0;
    box.kind = shot.kind || "bolt";
    box.look = shot.look || "";
    box.weave = shot.weave || 0;
    box.kit = shot.kit || 0;
    box.wob = 0;
    if (rectsOverlap(player, box)) { freeShot(box); return; }
    world.bossShots.push(box);
  }

  function bossAimPoint() {
    const tell = (world.boss && world.boss.tell) || {};
    return {
      px: tell.px != null ? tell.px : player.x + player.w / 2,
      py: tell.py != null ? tell.py : player.y + player.h * 0.45,
      feet: tell.feet != null ? tell.feet : player.y + player.h - 10,
      face: tell.face || Math.sign(player.vx) || player.facing || 1,
    };
  }

  function bossPattern(id) {
    const b = world.boss;
    if (!b) return;
    const dim = b.dim || 1;
    const spd = bossSpeed(dim);
    const aim = bossAimPoint();
    const px = aim.px;
    const py = aim.py;
    const feet = aim.feet;
    const face = aim.face || 1;
    const dir = dim % 2 === 0 ? -1 : 1;
    const ang = Math.atan2(py - (b.y + 20), (px - b.x) || 0.001);
    const surface = (world.rules && world.rules.surface) || [];
    audio.play("bossShot");

    if (id === "bolt") {
      bossSpawnShot({
        x: b.x - 8, y: b.y + 12,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, kind: "bolt",
      });
    } else if (id === "pair") {
      const gap = 28 + (dim % 5) * 6;
      const from = px - dir * 140;
      bossSpawnShot({ x: from, y: feet - 2, vx: dir * spd, vy: 0, kind: "pair" });
      bossSpawnShot({ x: from + dir * gap, y: feet - 2, vx: dir * spd, vy: 0, kind: "pair" });
    } else if (id === "fan") {
      const spread = 0.28 + (dim % 4) * 0.06;
      for (let i = -1; i <= 1; i++) {
        const a = ang + i * spread;
        bossSpawnShot({
          x: b.x - 8 + Math.cos(a) * 36,
          y: b.y + 16 + Math.sin(a) * 36,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          kind: "fan",
        });
      }
    } else if (id === "lob") {
      let tx = Math.round(px / TILE) + face * (3 + (dim % 2));
      const ptx = Math.round(px / TILE);
      if (tx < 3 || tx > world.cols - 4) tx = ptx + (ptx < world.cols / 2 ? 3 : -3);
      if (Math.abs(tx - ptx) < 2) tx = ptx + 3;
      tx = Math.max(3, Math.min(world.cols - 4, tx));
      const landX = tx * TILE + 8;
      const landY = ((surface[tx] > 0 ? surface[tx] : 9) - 1) * TILE;
      const n = 36;
      const grav = 0.22;
      const x0 = landX - face * 48;
      const y0 = 36;
      bossSpawnShot({
        x: x0, y: y0,
        vx: (landX - x0) / n,
        vy: (landY - y0 - grav * n * (n - 1) / 2) / n,
        grav, kind: "lob", life: 1.5,
      });
    } else if (id === "rain") {
      const want = 4 + (dim % 3);
      const ptx = Math.round(px / TILE);
      let made = 0;
      for (let i = -5; i <= 5 && made < want; i++) {
        if (Math.abs(i) <= 1) continue;
        const tx = ptx + i;
        if (tx < 2 || tx > world.cols - 3) continue;
        bossSpawnShot({ x: tx * TILE + 8, y: 18, vx: 0, vy: spd, w: 14, h: 14, kind: "rain" });
        made += 1;
      }
    } else if (id === "sweep") {
      const gapTile = Math.round(px / TILE) + dir * 2;
      for (let i = 0; i < 7; i++) {
        const tx = (dir > 0 ? 2 : world.cols - 3) + dir * i;
        if (Math.abs(tx - gapTile) <= 1) continue;
        if (tx < 1 || tx > world.cols - 2) continue;
        bossSpawnShot({ x: tx * TILE + 6, y: py - 8, vx: dir * spd, vy: 0, w: 18, h: 16, kind: "sweep" });
      }
    } else if (id === "line") {
      const from = Math.max(2, Math.min(world.cols - 3, Math.round(px / TILE) - face * 8));
      for (let i = 0; i < 3; i++) {
        const tx = from - face * i * 2;
        if (tx < 1 || tx > world.cols - 2) continue;
        bossSpawnShot({ x: tx * TILE, y: feet - 2, vx: face * spd, vy: 0, kind: "line" });
      }
    } else if (id === "ring") {
      const n = 6 + (dim % 3);
      const open = Math.atan2(py - b.y, px - b.x);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        let dlt = Math.abs(a - open);
        if (dlt > Math.PI) dlt = Math.PI * 2 - dlt;
        if (dlt < 0.7) continue;
        bossSpawnShot({
          x: b.x + Math.cos(a) * 48 - 8,
          y: b.y + Math.sin(a) * 48,
          vx: Math.cos(a) * spd * 0.9,
          vy: Math.sin(a) * spd * 0.9,
          kind: "ring",
        });
      }
    } else if (id === "slam") {
      const lead = 2 + (dim % 2);
      let tx = Math.round(px / TILE) + face * lead;
      if (Math.abs(tx - Math.round(px / TILE)) < 2) tx += face * 2;
      tx = Math.max(2, Math.min(world.cols - 3, tx));
      bossSpawnShot({ x: tx * TILE + 4, y: 16, vx: 0, vy: spd, w: 22, h: 22, kind: "slam" });
    } else if (id === "spit") {
      const gap = 22 + (dim % 4) * 4;
      bossSpawnShot({
        x: b.x - 8, y: b.y + 18,
        vx: Math.cos(ang) * spd * 1.15,
        vy: Math.sin(ang) * spd * 1.15,
        kind: "spit",
      });
      bossSpawnShot({
        x: b.x - 8 + Math.cos(ang + 1.2) * gap,
        y: b.y + 18 + Math.sin(ang + 1.2) * 10,
        vx: Math.cos(ang) * spd * 1.15,
        vy: Math.sin(ang) * spd * 1.15,
        delay: 0.12,
        kind: "spit",
      });
    }
  }

  function bossArm(b) {
    const ids = (window.SURGE_WORLDS && window.SURGE_WORLDS.bossAttackIds)
      ? window.SURGE_WORLDS.bossAttackIds()
      : ["bolt", "pair", "fan", "lob", "rain", "sweep", "line", "ring", "slam", "spit"];
    const jumping = player.vy < -1.5;
    const running = Math.abs(player.vx) > 1.1;
    const camping = player.onGround && Math.abs(player.vx) < 0.45;
    let id = ids[b.beat % ids.length];
    b.beat += 1;
    if (jumping && b.beat % 3 === 0) id = b.beat % 2 === 0 ? "pair" : "fan";
    else if (running && b.beat % 3 === 1) id = b.beat % 2 === 0 ? "sweep" : "line";
    else if (camping && b.beat % 3 === 2) id = b.beat % 2 === 0 ? "slam" : "rain";
    const px = player.x + player.w / 2;
    const py = player.y + player.h * 0.45;
    b.tell = {
      id,
      until: world.time + 0.16,
      tx: Math.max(1, Math.min(world.cols - 2, Math.round(px / TILE))),
      ty: Math.max(1, Math.min(world.rows - 2, Math.round(py / TILE))),
      tw: id === "sweep" ? 3 : 1,
      th: 1,
      px,
      py,
      feet: player.y + player.h - 10,
      face: Math.sign(player.vx) || player.facing || 1,
    };
    b.atkCd = 0.34 + (1 - (b.mood || 0)) * 0.12;
    bossTalk(id, false);
  }

  function tickBossShots() {
    if (!world.bossShots) world.bossShots = [];
    for (let i = world.bossShots.length - 1; i >= 0; i--) {
      const s = world.bossShots[i];
      if (s.delay > 0) {
        s.delay -= FIXED;
        if (s.delay <= 0 && rectsOverlap(player, s)) {
          const push = player.w + s.w + 10;
          s.x += (s.x + s.w / 2 >= player.x + player.w / 2) ? push : -push;
        }
        continue;
      }
      s.vy += s.grav || 0;
      if (s.weave) {
        const age = (s.maxLife || 2.2) - s.life;
        s.x += s.vx;
        s.y += s.vy + Math.sin(age * 5.2) * 1.15;
      } else if (s.kind === "spin") {
        const age = 2.4 - s.life;
        const wob = Math.sin(age * 6.5) * 48;
        s.x += s.vx + (wob - (s.wob || 0));
        s.wob = wob;
        s.y += s.vy;
      } else {
        s.x += s.vx;
        s.y += s.vy;
      }
      s.life -= FIXED;
      if (s.life <= 0 || s.y > world.rows * TILE + 40 || s.x < -80 || s.x > world.cols * TILE + 80 || s.y < -120) {
        freeShot(swapRemove(world.bossShots, i));
      }
    }
  }

  function nullFloorY() {
    return world.door ? world.door.y + TILE : (world.rows - 3) * TILE;
  }

  // Aesthetic only. Boss-room fires/glow stay on the opening pad, not live door/boss.
  function bossAmbienceFloor() {
    if (world.bossFloor != null) return world.bossFloor;
    return nullFloorY();
  }

  function bossAmbiencePad() {
    return world.bossPad || world.door;
  }

  function nullReadyPool(b) {
    const moves = b.moves || 0;
    const cool = b.cool || {};
    const pool = [];
    for (let i = 0; i < NULL_UNLOCK.length; i++) {
      const need = NULL_UNLOCK[i][0];
      const id = NULL_UNLOCK[i][1];
      if (moves < need) continue;
      if (cool[id] && cool[id] > world.time) continue;
      pool.push(id);
    }
    return pool.length ? pool : ["spin", "pop"];
  }

  function nullBuildPlan(b) {
    const pool = nullReadyPool(b);
    const free = ["spin", "pop"];
    const n = Math.min(5, 3 + (b.moves | 0));
    const plan = [];
    let last = "";
    let stormed = false;
    const spent = {};
    for (let i = 0; i < n; i++) {
      let id = pool[Math.floor(bossRand(b) * pool.length)];
      let guard = 0;
      while (guard++ < 12 && (id === last || spent[id] || (id === "storm" && stormed) || (NULL_LASER[id] && NULL_LASER[last]))) {
        id = pool[Math.floor(bossRand(b) * pool.length)];
      }
      if (NULL_COOL[id] && spent[id]) id = free[i % 2];
      if (NULL_COOL[id]) spent[id] = 1;
      if (id === "storm") stormed = true;
      plan.push(id);
      last = id;
    }
    return plan;
  }

  function nullArm(b, id) {
    const px = player.x + player.w / 2;
    const py = player.y + player.h * 0.45;
    const floor = nullFloorY();
    const side = px < world.cols * TILE * 0.5 ? -1 : 1;
    // Null used to snap attacks in under a beat. Give a real read.
    const wind = b.hot ? 0.28 : 0.46;
    b.tell = {
      id,
      until: world.time + wind,
      px, py,
      feet: player.y + player.h - 10,
      face: Math.sign(player.vx) || player.facing || 1,
      side,
      tx: Math.max(2, Math.min(world.cols - 3, Math.round(px / TILE) + side)),
      ty: Math.max(1, Math.round((floor - TILE) / TILE)),
      tw: id === "half" ? Math.floor(world.cols / 2) : (id === "needles" ? 3 : 1),
      th: 1,
    };
    bossTalk(id, false);
  }

  function nullAdvance(b) {
    if (b.dropping || b.snatch || b.drive) return;
    if (b.rest > 0) { b.rest -= FIXED; return; }
    if (b.gap > 0) { b.gap -= FIXED; return; }
    if (!b.plan || b.planI >= b.plan.length) {
      if (b.plan && b.plan.length) {
        b.plan = null;
        b.rest = b.hot ? 0.55 : 0.9;
        return;
      }
      b.plan = nullBuildPlan(b);
      b.planI = 0;
    }
    const nextId = b.plan[b.planI];
    if (b.cool && b.cool[nextId] > world.time) { b.planI += 1; return; }
    if (NULL_LASER[nextId] && (b.half || (world.nullBeams && world.nullBeams.length))) return;
    nullArm(b, b.plan[b.planI++]);
  }

  function nullAddBeam(x, w, warn, life, cause) {
    if (!world.nullBeams) world.nullBeams = [];
    if (world.nullBeams.length >= 64) return;
    world.nullBeams.push({
      x: Math.max(0, x),
      w,
      warn,
      life,
      cause: cause || "NEEDLES",
    });
  }

  function nullCast(b, id) {
    if (NULL_COOL[id]) {
      if (!b.cool) b.cool = {};
      b.cool[id] = world.time + NULL_COOL[id];
    }
    const tell = b.tell || {};
    const px = tell.px != null ? tell.px : player.x + player.w / 2;
    const py = tell.py != null ? tell.py : player.y + player.h * 0.45;
    const spd = (b.hot ? 9.4 : 7.8);
    const ang = Math.atan2(py - (b.y + 10), (px - b.x) || 0.001);
    audio.play("bossShot");
    if (id === "spin") {
      bossSpawnShot({
        x: b.x - 10, y: b.y - 10, w: 20, h: 20,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        life: 2.4, kind: "spin",
      });
    } else if (id === "shot") {
      const down = Math.PI / 2;
      const spread = 140 * Math.PI / 180;
      for (let i = 0; i < 11; i++) {
        const a = down - spread / 2 + bossRand(b) * spread;
        bossSpawnShot({
          x: b.x - 8 + Math.cos(a) * 28,
          y: b.y - 8 + Math.sin(a) * 28,
          w: 14, h: 14,
          vx: Math.cos(a) * (b.hot ? 7.1 : 5.8),
          vy: Math.sin(a) * (b.hot ? 7.1 : 5.8),
          life: 2.1, kind: "shot",
        });
      }
    } else if (id === "pound") {
      const tile = tell.tx || Math.round(px / TILE);
      b.wave = {
        x: tile * TILE + TILE / 2,
        warn: b.hot ? 0.28 : 0.4,
        live: 0,
        r: 8,
      };
    } else if (id === "half") {
      b.half = { side: tell.side || 1, t: 0, reach: world.cols * TILE * 0.42, hot: false, warn: b.hot ? 1.65 : 1.85 };
    } else if (id === "needles") {
      const n = 5 + Math.floor(bossRand(b) * 6);
      const origin = Math.round(px / TILE);
      let made = 0;
      for (let i = 0; i < n; i++) {
        const tx = origin + (i - Math.floor(n / 2)) * 5;
        if (tx < 1 || tx > world.cols - 4) continue;
        nullAddBeam(tx * TILE, TILE * 3, made * 0.25, b.hot ? 0.18 : 0.24, "NEEDLES");
        made += 1;
      }
    } else if (id === "magnet") {
      const dir = Math.sign(b.x - px) || 1;
      world.magnet = {
        x: px + dir * 120,
        y: nullFloorY() - 46,
        until: world.time + (b.hot ? 0.72 : 0.95),
        str: b.hot ? 0.34 : 0.26,
      };
    } else if (id === "drive") {
      const dir = tell.side || 1;
      const start = dir > 0 ? TILE * 2 : world.cols * TILE - TILE * 2;
      b.drive = { t: 0, warn: b.hot ? 0.55 : 0.78, dir, x: start, live: false };
      b.x = start;
    } else if (id === "pop") {
      bossSpawnShot({
        x: b.x - 12, y: b.y - 12, w: 24, h: 24,
        vx: Math.cos(ang) * 3.2, vy: Math.sin(ang) * 3.2,
        life: 0.7, kind: "pop",
      });
    } else if (id === "storm") {
      const origin = Math.round(px / TILE);
      const dir = bossRand(b) < 0.5 ? -1 : 1;
      let lane = origin + dir * (3 + Math.floor(bossRand(b) * 5));
      lane = Math.max(2, Math.min(world.cols - 6, lane));
      b.safeX = lane * TILE;
      b.safeW = TILE * 4;
      b.fog = 1;
      let made = 0;
      let guard = 0;
      while (made < 50 && guard++ < 220) {
        const tx = 1 + Math.floor(bossRand(b) * (world.cols - 2));
        if (tx >= lane && tx <= lane + 3) continue;
        const wait = made < 30 ? made * 0.25 : 30 * 0.25 + (made - 30) * 0.1;
        nullAddBeam(tx * TILE, TILE, wait, 0.22, "STORM");
        made += 1;
      }
    } else if (id === "shove") {
      nullShove(b);
    }
    b.gap = b.hot ? 0.4 : 0.62;
    const heavy = id === "pound" || id === "half" || id === "storm" || id === "drive";
    b.punch = Math.max(b.punch || 0, heavy ? 0.8 : 0.42);
    world.shake = Math.max(world.shake || 0, heavy ? 11 : 3);
  }

  function nullShove(b) {
    const doorMid = world.door.x + 16;
    const mid = player.x + player.w / 2;
    const away = mid < doorMid ? -1 : 1;
    player.vx = away * 7.4;
    player.vy = -8.4;
    b.shoveCd = 0.85;
    audio.play("bossGrab");
    bossTalk("shove", true);
  }

  function nullPopIfDue() {
    const shots = world.bossShots || [];
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      if (s.kind !== "pop" || s.life > 0.08) continue;
      const cx = s.x + s.w / 2;
      const cy = s.y + s.h / 2;
      const aim = Math.atan2((player.y + 14) - cy, (player.x + 12) - cx);
      for (let k = 0; k < 4; k++) {
        const a = aim + Math.PI / 2 + k * (Math.PI / 2);
        bossSpawnShot({
          x: cx - 7, y: cy - 7, w: 14, h: 14,
          vx: Math.cos(a) * 3.6, vy: Math.sin(a) * 3.6,
          life: 1.3, kind: "shot",
        });
      }
      swapRemove(shots, i);
    }
  }

  function tickNullBeams() {
    const list = world.nullBeams || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const bm = list[i];
      if (bm.warn > 0) bm.warn -= FIXED;
      if (bm.warn <= 0) {
        if (!bm.blast) {
          bm.blast = 0.01;
          world.shake = Math.max(world.shake || 0, bm.cause === "STORM" ? 8 : 5);
          if (world.boss) world.boss.punch = Math.max(world.boss.punch || 0, 0.35);
        } else if (bm.blast < 1) {
          bm.blast = Math.min(1, bm.blast + FIXED * 4);
        }
        bm.life -= FIXED;
        if (bm.life <= 0) swapRemove(list, i);
      }
    }
  }

  function nullCue(b, key, text, life) {
    if (b[key]) return;
    b[key] = true;
    const pack = window.SURGE_BOSS_VOICE;
    if (!pack || !pack.voice) return;
    const v = pack.voice(1);
    if (!v) return;
    b.say = {
      text: text,
      name: v.name,
      color: v.color,
      ink: v.ink,
      life: life || 3.4,
      age: 0,
    };
  }

  // One opening per boss. Letterbox, feet locked, three lines, then a go line.
  // The bubble is gone once the bars lift.
  const BOSS_SCENE = {
    2: { motion: "rise", lines: ["It's hot. That was the idea.", "Stay off the grate.", "This door cooks with me."], go: "Come get burned." },
    3: { motion: "drop", lines: ["Cold. Don't touch the metal.", "I heard you slip.", "The door sticks. So will you."], go: "Move, or freeze." },
    4: { motion: "swing", lines: ["Pretty, and it bites. Hi.", "Don't sniff the middle.", "The door's in my vines."], go: "Pick a fight." },
    5: { motion: "swing", lines: ["You're late. Four seconds.", "I counted. You crawled.", "Not your minute."], go: "Tick. Your turn." },
    6: { motion: "heave", lines: ["Ew. You came in anyway.", "I can hear you.", "That's my mouth. Out."], go: "Fine. I'm hungry." },
    7: { motion: "right", lines: ["That's your face. Rude.", "Stop standing like me.", "Stop copying my door."], go: "I go first." },
    8: { motion: "right", lines: ["No ticket. Keep walking.", "I don't brake for you.", "Door's in the tender."], go: "Express. Move." },
    9: { motion: "drop", lines: ["Kssht. You're the noise.", "Hold still. Bad signal.", "Door's on the wrong channel."], go: "I'm not hanging up." },
    10: { motion: "drop", lines: ["Rattling. You woke me.", "Bones first. Then you.", "Not your door, meat."], go: "Fetch. If you can." },
    11: { motion: "left", lines: ["Careful. I crack easy.", "Don't tap the pane.", "Don't lean on it."], go: "I'm already cracked." },
    12: { motion: "heave", lines: ["Hungry. You're not food. Yet.", "I can smell the door.", "Door's not for sale."], go: "Open wide. I mean me." },
    13: { motion: "drop", lines: ["Buzzing. Don't grab live.", "The pole's awake.", "Hands off the live one."], go: "Your turn. It's hot." },
    14: { motion: "rise", lines: ["Quiet in here. You aren't.", "I was mid hymn.", "I said quiet. Back."], go: "Hymn's over. Fight." },
    15: { motion: "streak", lines: ["Too slow. I already left.", "I lapped this room.", "Way too close. Late."], go: "Try to keep up." },
    16: { motion: "drop", lines: ["Boo. Sorry. Hi.", "I live in the corner.", "That's my square. Boo."], go: "Your move. I'm here." },
    17: { motion: "rise", lines: ["Poke. That was hello.", "Points go up. You don't.", "Pointy door. Mine."], go: "Mind the points." },
    18: { motion: "drop", lines: ["Bright. Squint or don't.", "I warmed the floor.", "You'll burn. Back up."], go: "Shade's the only friend." },
    19: { motion: "left", lines: ["Which me. Both said hi.", "We unfold when we want.", "Both of us said no."], go: "We go together." },
    20: { motion: "drop", lines: ["Last room. I'm nervous too.", "I saved the worst light.", "Please don't. Not yet."], go: "Okay. Last try." },
  };

  function sceneSay(b, text, life) {
    if (!b || (b.dim || 1) >= 2) return;
    const pack = window.SURGE_BOSS_VOICE;
    const v = pack && pack.voice ? pack.voice(b.dim || 1) : null;
    if (!v || !text) return;
    b.say = {
      text: text,
      name: v.name,
      color: v.color,
      ink: v.ink,
      life: life || 3.1,
      age: 0,
    };
    b.saidHi = true;
  }

  function introStage() {
    const fit = Math.min(world.cols, 32) * TILE + 36;
    const focus = player.x + player.w / 2;
    const lw = world.cols * TILE;
    let left = 0;
    let right = lw;
    if (world.cols > 32) {
      left = focus - fit * 0.38;
      const maxCam = Math.max(0, lw - fit);
      if (left < 0) left = 0;
      if (left > maxCam) left = maxCam;
      right = left + fit;
    }
    const doorX = world.door ? world.door.x + 16 : (left + right) / 2;
    const dir = Math.sign(doorX - focus) || 1;
    let x = focus + dir * Math.min(240, fit * 0.28);
    const pad = 110;
    if (x < left + pad) x = left + pad;
    if (x > right - pad) x = right - pad;
    return { x: x, left: left, right: right, doorX: doorX, sky: 86 };
  }

  function placeIntro(b, motion, k, stage) {
    const ease = 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
    const sky = stage.sky;
    const floor = world.door ? world.door.y - 8 : 260;
    const home = stage.x;
    const span = Math.min(170, (stage.right - stage.left) * 0.2);
    if (motion === "rise") {
      b.x = home;
      b.y = floor + (sky - floor) * ease;
    } else if (motion === "heave") {
      b.x = home + Math.sin(k * 9) * 12;
      b.y = floor + 24 + (sky - floor - 24) * ease;
    } else if (motion === "swing") {
      b.x = home + Math.sin(k * Math.PI) * span;
      b.y = sky - 24 + ease * 24;
    } else if (motion === "left") {
      b.x = (stage.left - 36) + (home - (stage.left - 36)) * ease;
      b.y = sky;
    } else if (motion === "right") {
      b.x = (stage.right + 36) + (home - (stage.right + 36)) * ease;
      b.y = sky;
    } else if (motion === "streak") {
      b.x = (stage.left - 80) + (home - (stage.left - 80)) * Math.min(1, ease * 1.4);
      b.y = sky + 6;
    } else {
      b.x = home;
      b.y = -48 + (sky + 48) * ease;
    }
  }

  function tickKitIntro(b) {
    b.introT += FIXED;
    const u = b.introT;
    const scene = BOSS_SCENE[b.dim] || BOSS_SCENE[2];
    const stage = introStage();
    const marks = [1.35, 3.7, 6.2];
    for (let i = 0; i < marks.length; i++) {
      if (u > marks[i] && !b["said" + i]) {
        b["said" + i] = true;
        sceneSay(b, scene.lines[i], 2.9);
      }
    }
    if (u < 2.7) {
      const k = u / 2.7;
      b.face = "look";
      b.bars = u < 0.35 ? 1 : Math.max(0.2, 1 - (u - 0.35) * 1.05);
      b.flash = Math.max(0, 0.75 - u);
      placeIntro(b, scene.motion, k, stage);
      b.gaze = Math.sign(stage.x - b.x) || 1;
      if (u > 0.4 && !b.heardIn) { b.heardIn = true; audio.play("bossIn"); }
    } else if (u < 5.4) {
      b.face = "look";
      b.bars = 0.2;
      b.flash = 0;
      const toward = (player.x + player.w / 2) > b.x ? 1 : -1;
      b.gaze = toward;
      b.x += ((stage.x - toward * 28) - b.x) * 0.08;
      b.y += ((stage.sky - 6) - b.y) * 0.08;
    } else if (u < 8.3) {
      b.face = "scared";
      b.bars = 0.18;
      b.attack = 0.88;
      const lean = Math.sign(stage.doorX - stage.x) || 1;
      b.gaze = lean;
      b.x += ((stage.x + lean * 64) - b.x) * 0.07;
      b.y += ((stage.sky - 14) - b.y) * 0.08;
    } else if (u < 10.6) {
      const k = (u - 8.3) / 2.3;
      b.face = "fight";
      b.attack = 0.25;
      b.bars = Math.max(0, (1 - k) * 0.5);
      b.flash = k < 0.18 ? 0.45 : 0;
      b.x += (stage.x - b.x) * 0.08;
      b.y += (stage.sky - b.y) * 0.08;
    } else {
      bossBeginFight(b);
      b.face = "fight";
      b.attack = 0;
      b.doorCd = 0.6;
      b.rest = 0.55;
      b.gap = 0.3;
      b.arrive = 0;
      b.plan = null;
      audio.play("stinger");
    }
  }

  function tickNullIntro(b) {
    b.introT += FIXED;
    const u = b.introT;
    const sky = 40;
    const mid = world.cols * TILE * 0.5;
    tickDoorDrop(b);
    if (u < 3.05) {
      b.face = "sleep";
      b.x = mid;
      b.y = sky + Math.sin(u * 1.4) * 8;
      b.bars = Math.max(0.16, 1 - u / 1.5);
      b.flash = Math.max(0, 0.85 - u * 1.4);
      b.gaze = 0;
    } else if (u < 6.6) {
      b.face = "look";
      b.gaze = Math.sin((u - 3.05) * 1.7);
      b.x = mid + b.gaze * 48;
      b.y = sky + Math.sin(u * 1.6) * 7;
      b.bars = 0.22;
      b.flash = 0;
      if (u > 3.4 && !b.heardIn) { b.heardIn = true; audio.play("bossIn"); }
      if (u > 4.3) nullCue(b, "saidHi", ".....", 3.1);
    } else if (u < 9.4) {
      b.face = "scared";
      const toward = player.x + player.w / 2 > b.x ? 1 : -1;
      b.gaze = toward;
      b.x += ((mid - toward * 80) - b.x) * 0.05;
      b.y += ((sky - 10) - b.y) * 0.08;
      b.bars = 0.2;
      if (u > 6.8) nullCue(b, "saidScare", "OH! You're here already!?", 3.2);
    } else if (u < 16.6) {
      b.face = "scared";
      const gx = world.door.x + 16;
      b.x += (gx - b.x) * 0.04;
      b.y += (sky - b.y) * 0.1;
      b.gaze = Math.sign(gx - b.x) || b.gaze;
      b.attack = 0.92;
      b.slip = (gx - b.x) * 0.015;
      b.bars = 0.18;
      if (u > 9.7) nullCue(b, "saidDoor", "If you want to get this door..", 3.3);
      if (u > 14.4 && !b.introThrew) {
        b.introThrew = true;
        const away = (player.x + player.w / 2) / TILE;
        const pad = bossPickPad(b, {
          away, min: 10, max: 40,
          from: world.door.x / TILE, fromMin: 12, fromMax: 26,
        });
        if (pad) bossStartDrop(b, pad);
        nullCue(b, "saidThrow", "You're going to have beat me for it.", 3.2);
      }
    } else if (u < 22.2) {
      b.face = "tired";
      b.bars = 0.16;
      nullHover(b);
      if (u > 17.1) nullCue(b, "saidRest", "Man.. I should have slept earlier...", 3.4);
    } else if (u < 28) {
      const k = (u - 22.2) / 5.8;
      b.face = "fight";
      b.bars = k < 0.4 ? 0.2 + k * 1.5 : Math.max(0, (1 - k) * 0.7);
      b.flash = k < 0.25 ? 0.62 : 0;
      nullHover(b);
      if (u > 22.8) nullCue(b, "saidGo", "No matter. I can beat you half asleep.", 3.2);
    } else {
      bossBeginFight(b);
      b.face = "fight";
      b.doorCd = 0.32;
      b.rest = 0.7;
      b.gap = 0;
      b.plan = null;
      audio.play("stinger");
    }
  }

  function tickDoorDrop(b) {
    if (!(b.dropping && b.drop)) return;
    if (b.phase !== "fight" && b.phase !== "rage" && b.phase !== "intro") return;
    b.drop.t += FIXED;
    const u = Math.min(1, b.drop.t / 0.36);
    const e = 1 - Math.pow(1 - u, 3);
    world.door.x = b.drop.x;
    world.door.y = b.drop.from + (b.drop.y - b.drop.from) * e;
    if (u >= 1) bossFinishDrop(b);
  }

  function nullHover(b) {
    const minX = 130;
    const maxX = Math.max(minX + 40, world.cols * TILE - 130);
    const minY = 18;
    const maxY = Math.max(minY + 36, (world.door ? world.door.y : 280) - 120);
    if (!Number.isFinite(b.nvx)) b.nvx = 1.7;
    if (!Number.isFinite(b.nvy)) b.nvy = 0;
    if (!Number.isFinite(b.y)) b.y = minY + 24;
    const cruise = (b.hot ? 2.6 : 1.85) * Math.sign(b.nvx || 1);
    b.nvx += (cruise - b.nvx) * 0.04 + Math.sin(world.time * 0.65) * 0.01;
    if (b.x < minX + 70) b.nvx += 0.08;
    if (b.x > maxX - 70) b.nvx -= 0.08;
    const cap = b.hot ? 3.1 : 2.35;
    b.nvx = Math.max(-cap, Math.min(cap, b.nvx));
    const hover = minY + 12 + Math.sin(world.time * 1.25) * 8 + Math.cos(world.time * 0.47) * 3;
    const nvy = b.nvy;
    b.nvy = nvy + (hover - b.y) * 0.018 - nvy * 0.12;
    const ox = b.x;
    b.x += b.nvx;
    b.y += b.nvy;
    if (b.x < minX) { b.x = minX; b.nvx = Math.abs(b.nvx) * 0.72; }
    if (b.x > maxX) { b.x = maxX; b.nvx = -Math.abs(b.nvx) * 0.72; }
    if (b.y < minY) { b.y = minY; b.nvy *= 0.4; }
    if (b.y > maxY) { b.y = maxY; b.nvy *= 0.4; }
    b.slip = b.x - ox;
    b.gaze = b.nvx >= 0 ? 1 : -1;
  }

  function tickNullSnatch(b) {
    if (!b.snatch || !world.door) return;
    b.snatch.t += FIXED;
    nullHover(b);
    const gx = world.door.x + 16;
    b.x += (gx - b.x) * 0.03;
    b.gaze = Math.sign(gx - b.x) || b.gaze;
    b.face = "scared";
    b.attack = 0.95;
    if (b.snatch.t > 0.62) {
      const away = (player.x + player.w / 2) / TILE;
      let pad = bossPickPad(b, {
        away, min: 10, max: 40,
        from: world.door.x / TILE, fromMin: 12, fromMax: 26,
      });
      // After the 30s failsafe, never softlock on a tight pad miss.
      if (!pad && b.saidBored) pad = bossPickPad(b, { away: away, min: 8, max: 16, loose: true });
      if (pad) bossStartDrop(b, pad);
      else b.doorCd = 0.4;
      b.snatch = null;
      b.face = b.hot ? "mad" : "fight";
      if (!b.saidClose) { b.saidClose = true; bossTalk("close", true); }
    }
  }

  function tickNullDrive(b) {
    if (!b.drive) return;
    const d = b.drive;
    const floor = nullFloorY();
    d.t += FIXED;
    // Ride low so the sweep reads as a floor strike.
    b.y += (floor - 30 - b.y) * 0.22;
    b.x = d.x;
    b.face = "mad";
    if (!d.live) {
      if (d.t >= d.warn) {
        d.live = true;
        world.shake = Math.max(world.shake || 0, 12);
        b.punch = Math.max(b.punch || 0, 0.65);
        audio.play("dash");
      }
      return;
    }
    d.x += d.dir * (b.hot ? 33.6 : 27.2);
    b.x = d.x;
    b.slip = d.dir * 4;
    if (d.x < -40 || d.x > world.cols * TILE + 40) b.drive = null;
  }

  function tickNullWave(b) {
    if (!b.wave) return;
    const land = nullFloorY() - 40;
    if (!b.wave.landed) {
      b.x += (b.wave.x - b.x) * 0.18;
      if (b.wave.warn > 0) {
        b.wave.warn -= FIXED;
        const gy = Math.max(64, (world.door ? world.door.y : land) - 150);
        b.y += (gy - b.y) * 0.14;
        return;
      }
      b.y += (land - b.y) * 0.35;
      if (Math.abs(b.y - land) > 6) return;
      b.y = land;
      b.x = b.wave.x;
      b.wave.landed = true;
      world.shake = Math.max(world.shake || 0, 18);
      b.punch = Math.max(b.punch || 0, 0.9);
    }
    b.y = land;
    b.wave.live += FIXED;
    b.wave.r = Math.min(280, 20 + b.wave.live * 820);
    if (b.wave.live > 0.42) b.wave = null;
  }

  function tickNullHalf(b) {
    if (!b.half) return;
    const h = b.half;
    h.t += FIXED;
    h.reach = world.cols * TILE * 0.42;
    if (h.t < h.warn) return;
    if (!h.hot) {
      world.shake = Math.max(world.shake || 0, 14);
      b.punch = Math.max(b.punch || 0, 0.7);
    }
    h.hot = true;
    if (h.t > h.warn + 0.5) b.half = null;
  }

  function tickNullGhosts(b) {
    if (!b.ghosts) return;
    for (let i = b.ghosts.length - 1; i >= 0; i--) {
      const g = b.ghosts[i];
      g.x += (g.vx || 0) * 0.18;
      g.y += (g.vy || 0) * 0.18;
      g.life -= FIXED;
      if (g.life <= 0) freeGhost(swapRemove(b.ghosts, i));
    }
  }

  function nullEnrageMusic() {
    if (!audio.theme || audio.theme.final) return;
    const boss = audio.theme.bossTrack
      || (window.SURGE_TRACKS && window.SURGE_TRACKS.bossMusic(audio.theme.dim || dimIndex))
      || { bpm: audio.theme.bpm || 174, root: audio.theme.root || 196 };
    audio.theme.rage = true;
    audio.theme.bpm = Math.round(boss.bpm * 1.2);
    audio.theme.root = boss.root * 1.122;
  }

  // Aesthetic only. Pink fire and blown ash sit behind the fight; they never hit.
  function nullEnrageBurst(b) {
    if (!b || b.raged) return;
    b.raged = true;
    b.rageAge = 0;
    b.rageFire = 0;
    const pack = window.SURGE_BOSS_VOICE;
    const v = pack && pack.voice ? pack.voice(1) : null;
    b.say = {
      text: "OH MY GOD JUST DIE ALREADY",
      name: (v && v.name) || "NULL",
      color: (v && v.color) || "#fe1f6f",
      ink: "#fff0f6",
      life: 3.6,
      age: 0,
      rage: true,
    };
    world.shake = Math.max(world.shake || 0, 22);
    camFX.punch = Math.max(camFX.punch || 0, 10);
    world.whiteFlash = 1;
    world.flash = Math.max(world.flash || 0, 0.08);
    const floor = bossAmbienceFloor();
    const W = (world.cols || 32) * TILE;
    for (let i = 0; i < 48; i++) {
      const life = 0.55 + Math.random() * 0.7;
      const p = allocPart();
      p.x = Math.random() * W;
      p.y = floor - Math.random() * 40;
      p.vx = (Math.random() < 0.5 ? -1 : 1) * (4.5 + Math.random() * 7.5);
      p.vy = -1.2 - Math.random() * 4.2;
      p.drag = 0.97;
      p.grav = -0.02;
      p.life = life;
      p.max = life;
      p.color = Math.random() < 0.45
        ? "rgba(254, 31, 111, 0.55)"
        : "rgba(255, 160, 200, 0.42)";
      p.size = 2.2 + Math.random() * 4.5;
      p.kind = Math.random() < 0.55 ? "smoke" : "ember";
      p.rot = null;
      p.spin = 0;
      world.particles.push(p);
    }
    trimParticles();
    audio.play("stinger");
  }

  function tickNullRageAura(b) {
    if (!b || !b.hot) return;
    b.rageAge = (b.rageAge || 0) + FIXED;
    const spread = Math.min(1, b.rageAge / 1.15);
    b.rageFire = spread;
    const floor = bossAmbienceFloor();
    const W = (world.cols || 32) * TILE;
    // Continuous pink ash blown hard across the room. Visual only. Stationary floor.
    const n = b.rageAge < 1.4 ? 5 : 2;
    for (let i = 0; i < n; i++) {
      const life = 0.4 + Math.random() * 0.55;
      const p = allocPart();
      p.x = Math.random() * W;
      p.y = floor - Math.random() * (30 + spread * 90);
      const dir = Math.sin(world.time * 1.7 + i) >= 0 ? 1 : -1;
      p.vx = dir * (3.2 + Math.random() * 6.8 + spread * 2.2);
      p.vy = -0.6 - Math.random() * 2.8;
      p.drag = 0.985;
      p.grav = -0.015;
      p.life = life;
      p.max = life;
      p.color = Math.random() < 0.5
        ? "rgba(254, 31, 111, 0.38)"
        : "rgba(255, 190, 220, 0.32)";
      p.size = 1.6 + Math.random() * 3.8;
      p.kind = Math.random() < 0.6 ? "smoke" : (Math.random() < 0.5 ? "ember" : "streak");
      p.rot = null;
      p.spin = 0;
      world.particles.push(p);
    }
    trimParticles();
  }

  function drawNullRageAura(b) {
    if (!b || !b.hot || b.phase === "gone" || b.phase === "boom") return;
    const floor = bossAmbienceFloor();
    const W = (world.cols || 32) * TILE;
    const t = world.time || 0;
    const spread = Math.max(0.08, b.rageFire || 0);
    const tongues = Math.max(8, Math.floor(10 + spread * 22));
    const reach = W * (0.28 + spread * 0.72);
    const left = Math.max(0, W * 0.5 - reach / 2);
    ctx.save();
    // Floor wash grows across the arena pad. Stationary — no hitbox, no boss track.
    ctx.globalAlpha = 0.16 + spread * 0.28;
    const wash = ctx.createLinearGradient(0, floor - 70, 0, floor + 8);
    wash.addColorStop(0, "rgba(254, 31, 111, 0)");
    wash.addColorStop(0.55, "rgba(254, 31, 111, 0.35)");
    wash.addColorStop(1, "rgba(40, 0, 18, 0.55)");
    ctx.fillStyle = wash;
    ctx.fillRect(left, floor - 70, reach, 78);
    for (let i = 0; i < tongues; i++) {
      const u = tongues <= 1 ? 0.5 : i / (tongues - 1);
      const x = left + u * reach;
      const seed = i * 1.7 + (b.rageAge || 0);
      const h = (22 + (i % 5) * 8 + Math.sin(t * 14 + seed) * 10) * (0.55 + spread * 0.7);
      const w = 7 + (i % 3) * 3;
      const wob = Math.sin(t * 16 + seed) * 4;
      ctx.globalAlpha = 0.28 + spread * 0.45;
      ctx.fillStyle = "#fe1f6f";
      ctx.beginPath();
      ctx.moveTo(x - w + wob, floor);
      ctx.quadraticCurveTo(x + wob * 0.4, floor - h * 0.55, x + wob * 0.2, floor - h);
      ctx.quadraticCurveTo(x + w * 0.2 - wob * 0.3, floor - h * 0.5, x + w - wob, floor);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.35 + spread * 0.35;
      ctx.fillStyle = "#fff0f6";
      ctx.beginPath();
      ctx.moveTo(x - w * 0.28 + wob * 0.3, floor);
      ctx.quadraticCurveTo(x, floor - h * 0.55, x, floor - h * 0.72);
      ctx.quadraticCurveTo(x + w * 0.1, floor - h * 0.4, x + w * 0.28 - wob * 0.2, floor);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function nullTrail(b, fastDash) {
    tickNullGhosts(b);
    const px = b.trailX;
    const py = b.trailY;
    b.trailX = b.x;
    b.trailY = b.y;
    if (px == null || py == null) return;
    const moved = Math.hypot(b.x - px, b.y - py);
    const fast = !!fastDash || moved > 1.2 || Math.abs(b.y - py) > 2;
    b.ghostT = (b.ghostT || 0) + FIXED;
    if (!fastDash && moved < 2.4) return;
    if (!fast || b.ghostT <= (fastDash ? 0.05 : 0.12)) return;
    b.ghostT = 0;
    if (!b.ghosts) b.ghosts = [];
    const life = 0.42;
    const g = allocGhost();
    g.x = px; g.y = py; g.life = life; g.max = life;
    g.vx = b.x - px; g.vy = b.y - py;
    g.rot = b.rot || 0; g.slip = b.slip || 0;
    g.face = b.face; g.gaze = b.gaze || 0; g.grab = b.visGrab || 0;
    g.dim = b.dim || 1;
    b.ghosts.push(g);
    if (b.ghosts.length > 7) freeGhost(b.ghosts.shift());
  }

  function tickNullFight(b) {
    if (nullStormOn()) b.fog = 1;
    else if (b.fog > 0) b.fog = Math.max(0, b.fog - FIXED * 0.85);
    if (b.fog <= 0) b.safeW = 0;
    world.bossFog = b.fog || 0;
    tickNullBeams();
    nullPopIfDue();
    tickNullDrive(b);
    tickNullWave(b);
    tickNullHalf(b);
    if (b.shoveCd > 0) b.shoveCd -= FIXED;
    if (b.snatch) tickNullSnatch(b);
    else if (b.drive || b.wave) { /* body is committed */ }
    else nullHover(b);

    const age = bossFightAge(b);
    if (age >= 30) bossArmBored(b);
    if (!b.dropping && !b.snatch && b.moves < b.goal && b.doorCd <= 0 && bossNearDoor()) {
      b.snatch = { t: 0, stage: "dash" };
      b.attack = Math.max(b.attack, 0.7);
    } else if (!b.snatch && !b.dropping) {
      b.doorCd -= FIXED;
    }
    if ((b.moves || 0) >= 4) {
      if (!b.hot) {
        nullEnrageMusic();
        nullEnrageBurst(b);
      }
      b.hot = true;
      tickNullRageAura(b);
    }

    if (b.tell && world.time >= b.tell.until) {
      const id = b.tell.id;
      if (NULL_IDS.indexOf(id) >= 0) nullCast(b, id);
      else bossPattern(id);
      b.tell = null;
      b.face = b.hot ? "mad" : "fight";
    } else if ((b.atkCd || 0) > 0) b.atkCd -= FIXED;
    else if (!b.tell) nullAdvance(b);

    if (b.snatch || b.dropping) b.face = "scared";
    else if (b.drive || (b.wave && b.wave.warn <= 0 && b.wave.live > 0)) b.face = "mad";
    else if (b.tell) b.face = b.hot ? "mad" : (b.tell.id === "storm" || b.tell.id === "pound" ? "scared" : "look");
    else if (b.hot) b.face = "mad";
    else if (b.mood > 0.72) b.face = "tired";
    else b.face = "fight";
  }


  function kitAim() {
    const px = player.x + player.w / 2;
    const py = player.y + player.h * 0.45;
    const face = Math.sign(player.vx) || player.facing || 1;
    const floor = nullFloorY();
    const cols = world.cols || 32;
    let ptx = Math.floor(px / TILE);
    if (ptx < 2) ptx = 2;
    if (ptx > cols - 3) ptx = cols - 3;
    return { px: px, py: py, face: face, feet: player.y + player.h - 6, ptx: ptx, floor: floor, cols: cols };
  }

  function kitAngDiff(a, b) {
    let d = Math.abs(a - b);
    if (d > Math.PI) d = Math.PI * 2 - d;
    return d;
  }

  function kitShot(act, look, x, y, vx, vy, extra) {
    const s = {
      x: x, y: y, w: 14, h: 14,
      vx: vx || 0, vy: vy || 0, grav: 0,
      life: 2.1, delay: 0, kind: act.id, look: look, kit: 1, weave: 0,
    };
    if (extra) {
      for (const k in extra) s[k] = extra[k];
    }
    return s;
  }

  function kitZone(act, x, y, w, h, life) {
    return {
      x: x, y: y, w: w, h: h,
      warn: 0.04,
      life: life == null ? 0.28 : life,
      cause: act.id,
    };
  }

  function kitLane(aim, act) {
    const gap = Math.max(2, act.gap || 3);
    const cols = aim.cols;
    let lane;
    if (act.cover === "move") {
      let dir = aim.face || 1;
      if (aim.ptx < 8) dir = 1;
      if (aim.ptx > cols - 8) dir = -1;
      lane = aim.ptx + dir * 3;
    } else {
      lane = aim.ptx - Math.floor((gap - 1) / 2);
    }
    if (lane < 2) lane = 2;
    if (lane > cols - gap - 2) lane = Math.max(2, cols - gap - 2);
    if (act.cover === "move" && aim.ptx >= lane && aim.ptx < lane + gap) {
      if (aim.ptx + 3 + gap <= cols - 2) lane = aim.ptx + 3;
      else lane = Math.max(2, aim.ptx - 2 - gap);
    }
    return { lane: lane, gap: gap, x: lane * TILE, w: gap * TILE };
  }

  function kitColumns(act, aim) {
    const spec = kitLane(aim, act);
    const zones = [];
    const count = act.count || 5;
    const safeHere = act.cover !== "move" && !act.home;
    for (let i = 0; i < aim.cols * 2 && zones.length < count; i++) {
      const step = Math.ceil(i / 2);
      const tx = aim.ptx + (i % 2 === 0 ? 1 : -1) * step;
      if (tx < 2 || tx > aim.cols - 3) continue;
      if (!act.home && tx >= spec.lane && tx < spec.lane + spec.gap) continue;
      if (safeHere && tx === aim.ptx) continue;
      let crowded = false;
      for (let z = 0; z < zones.length; z++) {
        if (Math.abs(zones[z].tx - tx) < 2) crowded = true;
      }
      if (crowded) continue;
      const low = !!act.low;
      const zone = kitZone(act, tx * TILE, low ? aim.floor - 20 : 0, TILE, low ? 20 : aim.floor, low ? 0.62 : 0.26);
      zone.tx = tx;
      zones.push(zone);
    }
    if (act.home && act.low) {
      let has = false;
      for (let z = 0; z < zones.length; z++) if (zones[z].tx === aim.ptx) has = true;
      if (!has) {
        const zone = kitZone(act, aim.ptx * TILE, aim.floor - 20, TILE, 20, 0.62);
        zone.tx = aim.ptx;
        zones.unshift(zone);
      }
    }
    if (act.cover === "move") {
      const onLane = aim.ptx >= spec.lane && aim.ptx < spec.lane + spec.gap;
      let has = false;
      for (let z = 0; z < zones.length; z++) if (zones[z].tx === aim.ptx) has = true;
      if (!onLane && !has) {
        const zone = kitZone(act, aim.ptx * TILE, 0, TILE, aim.floor, 0.26);
        zone.tx = aim.ptx;
        zones.push(zone);
      }
    }
    return { zones: zones, lane: act.home ? null : { x: spec.x, w: spec.w } };
  }

  function kitAside(aim, tiles) {
    let tx = aim.ptx + (aim.face || 1) * tiles;
    if (tx < 3 || tx > aim.cols - 4) tx = aim.ptx - (aim.face || 1) * tiles;
    tx = Math.max(2, Math.min(aim.cols - 3, tx));
    if (tx === aim.ptx) tx = Math.min(aim.cols - 3, aim.ptx + tiles);
    return tx;
  }

  function kitPreview(b, act, aim) {
    const look = (window.SURGE_BOSS_KITS.kit(b.dim) || {}).look || "";
    const preview = { shots: [], zones: [], lane: null, fx: {}, aim: { px: aim.px, py: aim.py } };
    const spd = act.speed || 3.15;
    if (act.type === "seek" || act.type === "wisp") {
      const ang = Math.atan2(aim.py - (b.y + 8), (aim.px - b.x) || 0.01);
      const v = act.type === "wisp" ? 1.45 : spd;
      preview.shots.push(kitShot(act, look, b.x - 7, b.y + 4, Math.cos(ang) * v, Math.sin(ang) * v, {
        weave: act.type === "wisp" ? 1 : 0,
        life: act.type === "wisp" ? 2.6 : 2.1,
      }));
    } else if (act.type === "lob") {
      let tx = kitAside(aim, act.lead || 3);
      const landX = tx * TILE + 8;
      const landY = aim.floor - 18;
      const n = 42;
      const grav = 0.16;
      const y0 = 24;
      preview.shots.push(kitShot(act, look, landX, y0, 0, (landY - y0 - grav * n * (n - 1) / 2) / n, {
        grav: grav, life: 1.35, w: 16, h: 16,
      }));
      preview.mark = { x: tx * TILE + 4, y: aim.floor - 18, w: 24, h: 16 };
    } else if (act.type === "columns" || act.type === "shade") {
      const made = kitColumns(act, aim);
      preview.zones = made.zones;
      preview.lane = made.lane;
    } else if (act.type === "fan") {
      const origins = [{ x: b.x, y: b.y }];
      if (act.echo) origins.push({ x: aim.cols * TILE - b.x, y: b.y });
      for (let o = 0; o < origins.length; o++) {
        const ang = Math.atan2(aim.py - (origins[o].y + 8), (aim.px - origins[o].x) || 0.01);
        for (let i = -1; i <= 1; i++) {
          const a = ang + i * 0.48;
          preview.shots.push(kitShot(act, look, origins[o].x - 7 + Math.cos(a) * 20, origins[o].y + 6 + Math.sin(a) * 20, Math.cos(a) * 3.05, Math.sin(a) * 3.05));
        }
      }
    } else if (act.type === "dash" || act.type === "lunge") {
      const mid = aim.cols * TILE * 0.5;
      let dir = aim.px < mid ? -1 : 1;
      let x = dir > 0 ? 28 : aim.cols * TILE - 28;
      let dist = aim.cols * TILE;
      if (act.type === "lunge") {
        dir = Math.sign(aim.px - b.x) || aim.face || 1;
        x = b.x;
        dist = 6 * TILE;
      }
      const rush = {
        x: x, dir: dir, y: aim.floor - 18, w: 46, h: 18,
        speed: act.type === "lunge" ? 6.4 : 6.1,
        dist: dist, cause: act.id,
        warn: act.type === "lunge" ? 0.38 : 0.48,
        gone: 0, live: false,
      };
      const body = { x: player.x, y: player.y, w: player.w, h: player.h };
      for (let n = 0; n < 6; n++) {
        const box = { x: rush.x - rush.w / 2, y: rush.y, w: rush.w, h: rush.h };
        if (!rectsOverlap(body, box)) break;
        rush.x -= rush.dir * 48;
      }
      preview.rush = rush;
      if (act.slip) preview.fx.slip = act.slip;
    } else if (act.type === "ring" || act.type === "orbit") {
      const n = act.type === "orbit" ? 8 : 7;
      const open = Math.atan2(aim.py - b.y, (aim.px - b.x) || 0.01) + (act.type === "orbit" ? 0.95 : 1.05);
      const v = act.speed || (act.type === "orbit" ? 2.45 : 2.7);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        if (kitAngDiff(a, open) < (act.type === "orbit" ? 0.7 : 0.9)) continue;
        preview.shots.push(kitShot(act, look, b.x + Math.cos(a) * 34 - 7, b.y + Math.sin(a) * 34, Math.cos(a) * v, Math.sin(a) * v));
      }
      preview.fx.safeAng = open;
      if (act.grav) preview.fx.grav = act.grav;
    } else if (act.type === "rain") {
      const spec = kitLane(aim, act);
      const count = act.count || 5;
      for (let i = 0; i < aim.cols * 2 && preview.shots.length < count; i++) {
        const step = Math.ceil(i / 2) + 2;
        const tx = aim.ptx + (i % 2 === 0 ? 1 : -1) * step;
        if (tx < 2 || tx > aim.cols - 3) continue;
        if (tx >= spec.lane && tx < spec.lane + spec.gap) continue;
        preview.shots.push(kitShot(act, look, tx * TILE + 9, 12, 0, act.speed || 3.5, { life: 2.4 }));
      }
      preview.lane = { x: spec.x, w: spec.w };
    } else if (act.type === "lane") {
      const dir = aim.px < aim.cols * TILE * 0.5 ? 1 : -1;
      const start = dir > 0 ? Math.max(TILE, aim.px - TILE * 8) : Math.min(aim.cols * TILE - TILE, aim.px + TILE * 8);
      for (let i = 0; i < 6; i++) {
        const x = start - dir * i * 42;
        if (Math.abs((x + 8) - aim.px) < 30) continue;
        if (x < 8 || x > aim.cols * TILE - 8) continue;
        preview.shots.push(kitShot(act, look, x, aim.floor - 18, dir * 3.35, 0, { w: 16, h: 12, life: 2.3 }));
      }
      preview.mark = { x: TILE, y: aim.floor - 20, w: (aim.cols - 2) * TILE, h: 14 };
    } else if (act.type === "pull") {
      const tx = kitAside(aim, 4);
      preview.zones.push(kitZone(act, tx * TILE, 0, TILE, aim.floor, 0.3));
      preview.fx.magnet = { x: tx * TILE + 16, y: aim.floor - 48 };
      preview.mark = { x: tx * TILE, y: aim.floor - 16, w: TILE, h: 14 };
    } else if (act.type === "blink") {
      let dest = aim.px + (aim.face || 1) * TILE * 5;
      if (dest < 90) dest = 90;
      if (dest > aim.cols * TILE - 90) dest = aim.cols * TILE - 90;
      if (Math.abs(dest - aim.px) < 120) dest = aim.px + (aim.ptx < aim.cols / 2 ? 180 : -180);
      preview.fx.blink = dest;
      const tx = kitAside(aim, 3);
      preview.zones.push(kitZone(act, tx * TILE, 0, TILE, aim.floor, 0.28));
    } else if (act.type === "saw") {
      const high = !!act.away;
      // Low saws sit in a standing body. High ones clear a jump's underside.
      const y = high ? aim.floor - 78 : aim.floor - 22;
      let dir = aim.px < aim.cols * TILE * 0.5 ? 1 : -1;
      let x = dir > 0 ? 48 : aim.cols * TILE - 48;
      if (act.away && world.door) {
        dir = (world.door.x + 16) < aim.px ? -1 : 1;
        x = aim.px - dir * 78;
      }
      preview.saw = { x: x, y: y, vx: dir * 2.15, life: 2.35, cause: act.id };
      if (act.echo) {
        preview.saw2 = { x: aim.cols * TILE - x, y: y, vx: -dir * 2.15, life: 2.35, cause: act.id };
      }
      preview.mark = { x: TILE, y: y - 16, w: (aim.cols - 2) * TILE, h: 8 };
    } else if (act.type === "guard") {
      preview.fx.guard = 1;
    } else if (act.type === "beat") {
      let tx = aim.ptx - (aim.face || 1) * 4;
      tx = Math.max(2, Math.min(aim.cols - 3, tx));
      if (tx === aim.ptx) tx = Math.min(aim.cols - 3, aim.ptx + 4);
      preview.zones.push(kitZone(act, tx * TILE, 0, TILE, aim.floor, 0.26));
      if (act.reverse) preview.fx.reverse = act.reverse;
    } else if (act.type === "mirror") {
      let x = aim.cols * TILE - aim.px;
      const y = aim.py - 8;
      if (Math.abs(x - aim.px) < 100) x = aim.px < aim.cols * TILE * 0.5 ? aim.px + 180 : aim.px - 180;
      const ang = Math.atan2(aim.py - y, (aim.px - x) || 0.01);
      preview.shots.push(kitShot(act, look, x, y, Math.cos(ang) * 3.2, Math.sin(ang) * 3.2));
      preview.fx.mirror = x;
    } else if (act.type === "crack") {
      const tx = kitAside(aim, 3);
      preview.zones.push(kitZone(act, tx * TILE, 0, TILE * 2, aim.floor, 0.36));
    } else if (act.type === "band") {
      if (act.high) {
        // Above a standing head, inside a full jump. A flat ceiling never meets the player.
        preview.zones.push(kitZone(act, 0, Math.max(28, aim.floor - 158), aim.cols * TILE, 22, 0.55));
      } else {
        preview.zones.push(kitZone(act, 0, aim.floor - 22, aim.cols * TILE, 22, 0.34));
      }
    } else if (act.type === "pillar") {
      const tx = kitAside(aim, act.lead || 3);
      preview.drop = { x: tx * TILE, y: 18, w: TILE, h: TILE, life: 1.55, cause: act.id };
      preview.mark = { x: tx * TILE, y: aim.floor - 16, w: TILE, h: 14 };
    } else if (act.type === "seam") {
      for (let s = 0; s < 2; s++) {
        const tx = aim.ptx + (s === 0 ? -3 : 3);
        if (tx < 2 || tx > aim.cols - 3) continue;
        preview.shots.push(kitShot(act, look, tx * TILE + 8, 16, 0, 3.15, { life: 2.2 }));
      }
      preview.lane = { x: (aim.ptx - 1) * TILE, w: TILE * 3 };
    } else if (act.type === "wave") {
      let x = aim.px + (aim.face || 1) * TILE * 2;
      if (x < TILE * 3) x = TILE * 3;
      if (x > aim.cols * TILE - TILE * 3) x = aim.cols * TILE - TILE * 3;
      preview.wave = { x: x, y: aim.floor - 8, warn: 0.12, max: act.max || 120, cause: act.id, live: 0, r: 8, hot: false };
    }
    const kept = [];
    for (let i = 0; i < preview.shots.length; i++) {
      if (!rectsOverlap(player, preview.shots[i])) kept.push(preview.shots[i]);
    }
    preview.shots = kept;
    return preview;
  }

  function kitRole() {
    if (!player.onGround && player.vy < -1.2) return "air";
    if (bossNearDoor()) return "door";
    if (player.onGround && Math.abs(player.vx) < 0.4) return "camp";
    if (Math.abs(player.vx) > 1.05) return "run";
    return "any";
  }

  function kitBusy(b) {
    if (b.rush) return true;
    if (b.wave) return true;
    const zones = world.bossZones || [];
    for (let i = 0; i < zones.length; i++) if (zones[i].h > 40) return true;
    return false;
  }

  function kitArm(b, act) {
    const pack = window.SURGE_BOSS_KITS;
    const aim = kitAim();
    const preview = kitPreview(b, act, aim);
    const wind = pack.wind(act, b.band || "open");
    b.tell = {
      id: act.id,
      type: act.type,
      heavy: !!act.heavy,
      until: world.time + wind,
      preview: preview,
      tx: aim.ptx,
      ty: Math.max(1, Math.floor(aim.floor / TILE) - 1),
      tw: act.type === "band" ? Math.max(1, aim.cols - 2) : 1,
      th: 1,
      px: aim.px,
      py: aim.py,
      feet: aim.feet,
      face: aim.face,
    };
    audio.play(act.heavy ? "bossHeavy" : "bossTell");
    bossTalk(act.id, false);
    b.attack = Math.max(b.attack || 0, act.heavy ? 0.8 : 0.5);
  }

  function kitGuard(b) {
    // Door is locked until the boss falls. No knockback on approach.
    if (!world.door) return;
    b.attack = Math.max(b.attack || 0, 0.45);
    b.guarded = true;
  }

  function kitCast(b, tell) {
    const pack = window.SURGE_BOSS_KITS;
    const k = pack.kit(b.dim);
    const act = pack.act(k, tell.id);
    if (!act) return;
    const p = tell.preview || {};
    audio.play(act.heavy ? "bossHeavy" : "bossShot");
    world.shake = Math.max(world.shake || 0, act.heavy ? 9 : 4);
    b.punch = Math.max(b.punch || 0, act.heavy ? 0.7 : 0.35);
    const shots = p.shots || [];
    for (let i = 0; i < shots.length; i++) bossSpawnShot(shots[i]);
    if (!world.bossZones) world.bossZones = [];
    const zones = p.zones || [];
    for (let i = 0; i < zones.length; i++) {
      if (world.bossZones.length >= 18) break;
      world.bossZones.push({
        x: zones[i].x, y: zones[i].y, w: zones[i].w, h: zones[i].h,
        warn: zones[i].warn, life: zones[i].life, cause: zones[i].cause,
      });
    }
    if (p.rush) {
      b.rush = {
        x: p.rush.x, dir: p.rush.dir, y: p.rush.y, w: p.rush.w, h: p.rush.h,
        speed: p.rush.speed, dist: p.rush.dist, cause: p.rush.cause,
        warn: p.rush.warn > 0 ? p.rush.warn : 0.48,
        gone: 0, live: false,
      };
    }
    if (p.wave) b.wave = { x: p.wave.x, y: p.wave.y, warn: p.wave.warn, max: p.wave.max, cause: p.wave.cause, live: 0, r: 8, hot: false };
    if (p.drop) world.drops.push({ x: p.drop.x, y: p.drop.y, w: p.drop.w, h: p.drop.h, vy: 0, life: p.drop.life, boss: true, cause: p.drop.cause });
    if (p.saw) world.saws.push({ x: p.saw.x, y: p.saw.y, vx: p.saw.vx, vy: 0, chase: false, spin: 0, boss: true, life: p.saw.life, cause: p.saw.cause });
    if (p.saw2) world.saws.push({ x: p.saw2.x, y: p.saw2.y, vx: p.saw2.vx, vy: 0, chase: false, spin: 0, boss: true, life: p.saw2.life, cause: p.saw2.cause });
    const fx = p.fx || {};
    if (fx.blink != null) { b.x = fx.blink; b.mvx = 0; }
    if (fx.magnet) world.magnet = { x: fx.magnet.x, y: fx.magnet.y, until: world.time + 0.42, str: 0.18 };
    if (fx.reverse) { world.reverse = true; b.flipUntil = world.time + fx.reverse; }
    if (fx.grav) { b.gravWas = world.gravity; world.gravity = fx.grav; b.gravUntil = world.time + 0.85; }
    if (fx.slip) world.slipT = Math.max(world.slipT || 0, fx.slip);
    if (fx.guard) kitGuard(b);
    if (fx.mirror != null) b.echo = { x: fx.mirror, y: b.y, life: 0.7 };
    if (p.lane) b.lane = { x: p.lane.x, w: p.lane.w, until: world.time + 0.95 };
    if (!b.cool) b.cool = {};
    b.cool[act.id] = world.time + act.cool;
    b.gap = pack.gapAfter(act, b.band || "open");
    b.attack = Math.max(b.attack || 0, 0.7);
  }

  function kitAdvance(b, k) {
    const pack = window.SURGE_BOSS_KITS;
    if (b.rest > 0) { b.rest -= FIXED; return; }
    if (b.gap > 0) { b.gap -= FIXED; return; }
    if (!b.plan || b.planI >= b.plan.length) {
      if (b.plan && b.plan.length) {
        b.plan = null;
        b.rest = pack.rest(b.band || "open");
        return;
      }
      b.plan = pack.build(k, {
        band: b.band || "open",
        role: kitRole(),
        rand: function () { return bossRand(b); },
        last: b.lastAct || "",
        cool: b.cool || {},
        now: world.time,
      });
      b.planI = 0;
      if (!b.plan || !b.plan.length) { b.rest = 0.4; return; }
    }
    const id = b.plan[b.planI];
    const act = pack.act(k, id);
    if (!act) { b.planI += 1; return; }
    if (b.cool && b.cool[id] > world.time) { b.planI += 1; return; }
    if (act.heavy && kitBusy(b)) return;
    b.planI += 1;
    b.lastAct = id;
    kitArm(b, act);
  }

  function kitTrail(b) {
    const px = b.trailX;
    const py = b.trailY;
    b.trailX = b.x;
    b.trailY = b.y;
    if (px == null || py == null) return;
    const moved = Math.hypot(b.x - px, b.y - py);
    // Standing still must not stack solid copies on the live boss.
    if (moved < 2.4) return;
    b.ghostT = (b.ghostT || 0) + FIXED;
    if (b.ghostT < 0.12) return;
    b.ghostT = 0;
    if (!b.ghosts) b.ghosts = [];
    const kg = allocGhost();
    kg.x = px; kg.y = py; kg.life = 0.38; kg.max = 0.38;
    kg.dim = b.dim; kg.face = b.face;
    kg.gaze = b.gaze != null ? b.gaze : 1;
    kg.grab = b.visGrab || 0; kg.rot = b.rot || 0; kg.slip = b.slip || 0;
    kg.vx = b.x - px; kg.vy = b.y - py;
    b.ghosts.push(kg);
    if (b.ghosts.length > 8) freeGhost(b.ghosts.shift());
  }

  function clearBossGhosts(b) {
    if (!b || !b.ghosts || !b.ghosts.length) return;
    for (let i = 0; i < b.ghosts.length; i++) freeGhost(b.ghosts[i]);
    b.ghosts.length = 0;
  }

  function kitMove(b, mv) {
    if (!mv || !world.door) return;
    if (b.ghosts && b.ghosts.length) {
      for (let i = b.ghosts.length - 1; i >= 0; i--) {
        b.ghosts[i].life -= FIXED;
        if (b.ghosts[i].life <= 0) freeGhost(swapRemove(b.ghosts, i));
      }
    }
    const floor = world.door.y;
    const minX = 110;
    const maxX = Math.max(minX + 40, world.cols * TILE - 110);
    const mid = (minX + maxX) * 0.5;
    const span = (maxX - minX) * (mv.patrol || 0.4);
    let tx = mid + Math.sin(world.time * (mv.freq || 0.8) + b.dim) * span;
    let ty = floor - (mv.y || 120) + Math.sin(world.time * (mv.freq || 1) * 1.7 + 1.2) * (mv.amp || 10);
    if (mv.flag === "mirror") tx = world.cols * TILE - (player.x + player.w / 2);
    else if (mv.flag === "twin") tx = Math.sin(world.time * 0.55 + b.dim) > 0 ? minX + 50 : maxX - 50;
    else if (mv.flag === "stalk") tx = player.x + player.w / 2 - (player.facing || 1) * 130;
    else if (mv.flag === "orbit") {
      const ang = world.time * (mv.freq || 0.6);
      tx = mid + Math.cos(ang) * span;
      ty = (floor - 150) + Math.sin(ang) * (mv.amp || 30);
    } else if (mv.flag === "jitter") {
      if (!b.hopAt || world.time >= b.hopAt) {
        b.hopAt = world.time + 0.9;
        b.jx = minX + bossRand(b) * (maxX - minX);
        b.jy = floor - (mv.y || 120);
      }
      tx = b.jx;
      ty = b.jy;
    } else if (mv.flag === "beat") {
      const step = Math.floor(world.time * 2);
      const spanX = Math.max(1, maxX - minX);
      tx = minX + ((step * 113 + b.dim * 37) % spanX);
    } else if (mv.flag === "rail") {
      ty = floor - (mv.y || 80);
    }
    // Wide rooms scroll. Keep the body inside the view or the fight is a voice from offscreen.
    const px = player.x + player.w / 2;
    const leash = 320;
    if (Math.abs(tx - px) > leash) {
      const roomMid = (minX + maxX) * 0.5;
      const rel = (tx - roomMid) / Math.max(1, (maxX - minX) * 0.5);
      tx = px + Math.max(-1, Math.min(1, rel)) * leash;
    }
    if (tx < minX) tx = minX;
    if (tx > maxX) tx = maxX;
    if (ty < 36) ty = 36;
    if (ty > floor - 56) ty = floor - 56;
    bossGlide(b, tx, ty, mv.stiff || 0.04, 0.16);
    b.gaze = (b.mvx || 0) >= 0 ? 1 : -1;
    if (mv.flag === "trail" || b.band === "desperate") kitTrail(b);
  }

  function tickKitRush(b) {
    const r = b.rush;
    if (!r) return;
    if (r.warn > 0) { r.warn -= FIXED; return; }
    if (!r.live) {
      r.live = true;
      audio.play("dash");
      world.shake = Math.max(world.shake || 0, 6);
    }
    r.x += r.dir * r.speed;
    r.gone = (r.gone || 0) + r.speed;
    if (r.x < -80 || r.x > world.cols * TILE + 80 || (r.dist && r.gone > r.dist)) b.rush = null;
  }

  function tickKitWave(b) {
    const w = b.wave;
    if (!w) return;
    if (w.warn > 0) { w.warn -= FIXED; return; }
    if (!w.hot) {
      w.hot = true;
      w.live = 0;
      audio.play("bossLand");
      world.shake = Math.max(world.shake || 0, 8);
    }
    w.live += FIXED;
    w.r = Math.min(w.max || 120, 18 + w.live * 460);
    if (w.live > 0.4) b.wave = null;
  }

  function tickKitHazards(b) {
    const zones = world.bossZones || [];
    let popped = false;
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i];
      if (z.warn > 0) z.warn -= FIXED;
      else {
        if (!z.hot) {
          z.hot = true;
          if (!popped) {
            popped = true;
            audio.play("spike");
            world.shake = Math.max(world.shake || 0, 5);
          }
        }
        z.life -= FIXED;
        if (z.life <= 0) swapRemove(zones, i);
      }
    }
    tickKitRush(b);
    tickKitWave(b);
    if (b.echo) {
      b.echo.life -= FIXED;
      if (b.echo.life <= 0) b.echo = null;
    }
    if (b.windUntil && world.time >= b.windUntil) { world.wind = 0; b.windUntil = 0; }
    if (b.flipUntil && world.time >= b.flipUntil) { world.reverse = false; b.flipUntil = 0; }
    if (b.gravUntil && world.time >= b.gravUntil) {
      world.gravity = b.gravWas || world.baseGravity || 0.55;
      b.gravUntil = 0;
    }
    if (b.lane && world.time > b.lane.until) b.lane = null;
  }

  function tickKitDoor(b) {
    const age = bossFightAge(b);
    if (age >= 30) bossArmBored(b);
    if (!b.dropping && b.phase === "fight" && age < 30 && bossNearDoor() && b.doorCd < 0.28 && b.moves < b.goal) {
      b.attack = Math.max(b.attack, 0.45);
    }
    if (!b.dropping && b.phase === "fight" && b.moves < b.goal) {
      b.doorCd -= FIXED;
      if (b.doorCd <= 0) {
        if (age >= 30) {
          bossFailDrop(b);
        } else if (bossNearDoor()) {
          const away = (player.x + player.w / 2) / TILE;
          const pad = bossPickPad(b, {
            away: away, min: 5, max: 40,
            from: world.door.x / TILE, fromMin: 10, fromMax: 16,
          });
          if (pad) { bossYoink(b, pad); b.doorCd = 0.36; }
          else b.doorCd = 0.35;
        }
      }
    }
  }

  function tickKitFight(b) {
    const pack = window.SURGE_BOSS_KITS;
    const k = pack && pack.kit(b.dim);
    if (!k) {
      bossCruise(b);
      tickKitDoor(b);
      return;
    }
    if ((b.arrive || 0) > 0) {
      b.arrive -= FIXED;
      const ty = (world.door ? world.door.y : 280) - 150;
      b.y += (ty - b.y) * 0.07;
      b.x += (world.cols * TILE * 0.5 - b.x) * 0.04;
      b.face = "look";
      b.attack = Math.max(b.attack || 0, 0.35);
      return;
    }
    if (!b.band) b.band = "open";
    const next = pack.band(b.moves || 0, b.goal || 1, b.dim);
    if (b.band !== next) {
      b.band = next;
      b.plan = null;
      b.planI = 0;
      b.flash = 0.45;
      if (next === "desperate" && audio.theme && !audio.theme.final) audio.theme.rage = true;
      bossTalk(next, true);
    }
    const u = (b.moves || 0) / Math.max(1, b.goal || 1);
    b.mood = b.band === "desperate" ? 1 : b.band === "strain" ? Math.max(u, 0.55) : u;
    const style = (k.move && k.move[b.band]) || k.move.open;
    if (!(b.rush && b.rush.live)) kitMove(b, style);
    tickKitDoor(b);
    tickKitHazards(b);
    if (b.phase !== "fight" || b.dropping) return;
    if (b.tell && world.time >= b.tell.until) {
      kitCast(b, b.tell);
      b.tell = null;
    } else if (!b.tell) kitAdvance(b, k);
    if (b.tell && b.tell.heavy) b.face = "scared";
    else if (b.band === "desperate") b.face = "mad";
    else if (b.band === "strain") b.face = "tired";
    else if (!b.tell) b.face = "fight";
    else b.face = "look";
    if (b.flash > 0) b.flash = Math.max(0, b.flash - FIXED);
  }

  function kitHurt(b) {
    if (!b || player.dead || player.win) return false;
    if (b.phase !== "fight" && b.phase !== "rage") return false;
    const zones = world.bossZones || [];
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      if (z.warn > 0) continue;
      if (rectsOverlap(player, z)) {
        die("BOSS " + String(z.cause || "spike").toUpperCase());
        return true;
      }
    }
    if (b.rush && b.rush.live) {
      const r = b.rush;
      HIT.x = r.x - r.w / 2; HIT.y = r.y; HIT.w = r.w; HIT.h = r.h;
      if (rectsOverlap(player, HIT)) {
        die("BOSS " + String(r.cause || "dash").toUpperCase());
        return true;
      }
    }
    if (b.wave && b.wave.hot && b.wave.live > 0) {
      const floor = nullFloorY();
      const mid = player.x + player.w / 2;
      if (player.y + player.h > floor - 22 && Math.abs(mid - b.wave.x) < b.wave.r) {
        die("BOSS " + String(b.wave.cause || "wave").toUpperCase());
        return true;
      }
    }
    return false;
  }


  function tickBoss() {
    const b = world.boss;
    if (!b || !world.door || player.dead || player.win) return;
    tickBossShots();
    if (b.punch > 0) b.punch = Math.max(0, b.punch - FIXED * 1.8);
    if (b.say) {
      b.say.age += FIXED;
      if (b.say.age >= b.say.life) b.say = null;
    }
    if (b.phase === "intro") {
      if (b.dim === 1) tickNullIntro(b);
      else tickKitIntro(b);
      nullBossPose(b);
      if (b.dim === 1) nullTrail(b, false);
      return;
    }
    if (!b.saidHi) b.saidHi = true;
    tickDoorDrop(b);

    if (b.phase === "fight" || b.phase === "rage") {
      if (b.dim === 1 && b.phase === "fight") {
        tickNullFight(b);
      } else if (b.dim !== 1) {
        tickKitFight(b);
      }
      if (b.phase === "rage" && world.time >= (b.rageUntil || 0)) {
        b.phase = "fall";
        clearBossGhosts(b);
        bossClearHazards(b);
        b.fallVy = -3.1;
        b.mood = 1;
        b.face = "tired";
        world.wind = 0;
        if (b.flipUntil) { world.reverse = false; b.flipUntil = 0; }
        if (b.gravUntil) {
          world.gravity = b.gravWas || world.baseGravity || 0.55;
          b.gravUntil = 0;
        }
        audio.play("bossFall");
        bossTalk("fall", true);
      }
    } else if (b.phase === "fall") {
      b.fallVy = Math.min(9.5, (b.fallVy || 0) + 0.32);
      b.y += b.fallVy;
      b.rot += 0.075;
      b.mood = 1;
      if (b.y >= world.door.y - 8) {
        b.y = world.door.y - 8;
        b.phase = "boom";
        b.boom = 0;
        world.shake = b.dim === 1 ? 28 : 18;
        world.flash = 0.2;
        burst(b.x, b.y + 20, "#ffd24a", 28, 6);
        burst(b.x, b.y + 20, "#e31b1b", 18, 4.5);
        audio.play("bossBoom");
      }
    } else if (b.phase === "boom") {
      b.boom += FIXED;
      if (bossBlastHits()) die("BOSS BOOM");
      if (b.boom > 0.92) {
        b.phase = "gone";
        clearBossGhosts(b);
        world.wind = 0;
      }
    }
    nullBossPose(b);
    if (b.dim === 1 && b.phase !== "gone" && b.phase !== "boom") {
      nullTrail(b, !!(b.drive && b.drive.live));
    }
  }

  function nullBossPose(b) {
    if (b.attack > 0) b.attack -= FIXED;
    const grabNow = b.attack > 0.72 ? 1 : (b.attack > 0 ? Math.sin(Math.max(0, Math.min(1, 1 - b.attack / 0.72)) * Math.PI) : 0);
    b.visGrab = (b.visGrab || 0) + (grabNow - (b.visGrab || 0)) * 0.28;
    const leanNow = Math.max(-0.22, Math.min(0.22, (b.slip || 0) * 0.045));
    b.visLean = (b.visLean || 0) + (leanNow - (b.visLean || 0)) * 0.18;
    if (b.dim === 1 && (b.visGrab || 0) > 0.4 && world.door) {
      b.emberT = (b.emberT || 0) + FIXED;
      if (b.emberT > 0.045) {
        b.emberT = 0;
        for (let si = 0; si < 2; si++) {
          const side = SIDE_PAIR[si];
          const hand = nullHandPoint(b, world.time, b.visGrab || 0, side, HAND_PT);
          const life = 0.28;
          const p = allocPart();
          p.x = hand.x; p.y = hand.y;
          p.vx = (world.door.x + 16 - b.x) * 0.04 + side * 0.6;
          p.vy = (world.door.y - b.y) * 0.04;
          p.drag = 0.9; p.grav = 0; p.life = life; p.max = life;
          p.color = side < 0 ? "#ff2f86" : "#ffd6ea";
          p.size = 2.4; p.kind = "spark";
          p.rot = null; p.spin = 0;
          world.particles.push(p);
        }
        trimParticles();
      }
    }
  }


  function drawKitShot(s, col) {
    const look = s.look || "";
    const rw = Math.max(6, s.w * 0.46);
    const rh = Math.max(5, s.h * 0.4);
    ctx.save();
    ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
    ctx.fillStyle = col;
    ctx.strokeStyle = "#fff6e8";
    ctx.lineWidth = 2;
    if (look === "ember" || look === "coal" || look === "ray") {
      ctx.rotate(world.time * (look === "ray" ? 4 : 8));
      ctx.beginPath();
      ctx.arc(0, 0, rw, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = look === "coal" ? "#1a0e0c" : "#fff1c8";
      ctx.beginPath();
      ctx.arc(-rw * 0.15, -rw * 0.15, rw * 0.38, 0, Math.PI * 2);
      ctx.fill();
      if (look === "ray") {
        ctx.strokeStyle = "#fff6d0";
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(rw * 0.5, 0);
          ctx.lineTo(rw * 1.15, 0);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = look === "coal" ? "#ff5a28" : "#ffb45a";
        ctx.beginPath();
        ctx.moveTo(-rw * 0.2, rw * 0.2);
        ctx.lineTo(0, -rw * 0.55);
        ctx.lineTo(rw * 0.28, rw * 0.1);
        ctx.fill();
      }
    } else if (look === "ice" || look === "shard" || look === "salt") {
      ctx.rotate(world.time * 2 + (look === "salt" ? 0.4 : 0));
      ctx.beginPath();
      ctx.moveTo(0, -rh);
      ctx.lineTo(rw * 0.7, 0);
      ctx.lineTo(0, rh);
      ctx.lineTo(-rw * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(0, -rh * 0.45);
      ctx.lineTo(rw * 0.28, 0);
      ctx.lineTo(0, rh * 0.2);
      ctx.closePath();
      ctx.fill();
      if (look === "salt") {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(rw * 0.2, -rh * 0.1);
        ctx.lineTo(rw * 0.7, -rh * 0.7);
        ctx.lineTo(rw * 0.55, rh * 0.15);
        ctx.fill();
      }
    } else if (look === "petal" || look === "wisp") {
      ctx.globalAlpha = look === "wisp" ? 0.78 : 1;
      ctx.rotate(world.time * 3);
      ctx.beginPath();
      ctx.ellipse(0, 0, rw, rh * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, rw * 0.72, rh * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = look === "wisp" ? "rgba(255,255,255,0.7)" : "#ffe6a8";
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(2, rw * 0.22), 0, Math.PI * 2);
      ctx.fill();
    } else if (look === "gear") {
      ctx.rotate(world.time * 6);
      ctx.beginPath();
      ctx.arc(0, 0, rw * 0.62, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.fillRect(rw * 0.35, -2.2, rw * 0.55, 4.4);
      }
      ctx.fillStyle = "#6a5018";
      ctx.beginPath();
      ctx.arc(0, 0, rw * 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (look === "bile") {
      ctx.beginPath();
      ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8ffc0";
      ctx.beginPath();
      ctx.ellipse(-rw * 0.25, -rh * 0.25, rw * 0.28, rh * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-2, rh * 0.4);
      ctx.lineTo(1, rh * 1.05);
      ctx.lineTo(4, rh * 0.35);
      ctx.fill();
    } else if (look === "bite") {
      ctx.beginPath();
      ctx.ellipse(0, 0, rw, rh * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(-rw * 0.45, -rh * 0.1);
      ctx.lineTo(-rw * 0.1, -rh * 0.7);
      ctx.lineTo(rw * 0.15, -rh * 0.05);
      ctx.lineTo(rw * 0.45, -rh * 0.65);
      ctx.lineTo(rw * 0.5, rh * 0.15);
      ctx.fill();
    } else if (look === "mirror" || look === "fold") {
      ctx.rotate(look === "fold" ? 0.3 : world.time);
      ctx.beginPath();
      ctx.moveTo(0, -rh);
      ctx.lineTo(rw, 0);
      ctx.lineTo(0, rh);
      ctx.lineTo(-rw, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.moveTo(-rw * 0.15, -rh * 0.45);
      ctx.lineTo(rw * 0.15, -rh * 0.1);
      ctx.lineTo(-rw * 0.05, rh * 0.05);
      ctx.fill();
    } else if (look === "spark" || look === "zap") {
      ctx.beginPath();
      ctx.moveTo(-rw, rh * 0.2);
      ctx.lineTo(-rw * 0.15, -rh);
      ctx.lineTo(rw * 0.05, rh * 0.05);
      ctx.lineTo(rw, -rh * 0.35);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-rw * 0.15, -rh * 0.2, 2.2, 0, Math.PI * 2);
      ctx.fill();
      if (look === "zap") {
        ctx.beginPath();
        ctx.moveTo(-rw * 0.2, rh * 0.1);
        ctx.lineTo(rw * 0.45, rh * 0.7);
        ctx.stroke();
      }
    } else if (look === "bone") {
      ctx.rotate(0.5);
      ctx.fillRect(-rw, -2.4, rw * 2, 4.8);
      ctx.beginPath();
      ctx.arc(-rw, 0, 4.2, 0, Math.PI * 2);
      ctx.arc(rw, 0, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#b8a484";
      ctx.fillRect(-rw * 0.2, -1.2, rw * 0.4, 2.4);
    } else if (look === "needle") {
      ctx.rotate(0.6);
      ctx.fillRect(-rw, -1.3, rw * 2, 2.6);
      ctx.beginPath();
      ctx.moveTo(rw, -3.5);
      ctx.lineTo(rw + 7, 0);
      ctx.lineTo(rw, 3.5);
      ctx.fill();
      ctx.strokeStyle = "#ff8aa0";
      ctx.beginPath();
      ctx.arc(-rw * 0.2, 0, 4, 0.4, 2.4);
      ctx.stroke();
    } else if (look === "red") {
      ctx.rotate(Math.atan2(s.vy || 0.01, s.vx || 1));
      ctx.globalAlpha = 0.35;
      ctx.fillRect(-rw * 1.6, -rh * 0.35, rw, rh * 0.7);
      ctx.globalAlpha = 0.6;
      ctx.fillRect(-rw * 0.9, -rh * 0.45, rw * 0.7, rh * 0.9);
      ctx.globalAlpha = 1;
      ctx.fillRect(-rw * 0.2, -rh * 0.55, rw * 1.1, rh * 1.1);
      ctx.fillStyle = "#fff";
      ctx.fillRect(rw * 0.35, -rh * 0.2, rw * 0.35, rh * 0.4);
    } else if (look === "star") {
      ctx.rotate(world.time * 3);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const rad = i % 2 ? rw : rw * 0.4;
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(a) * rad;
        const y = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(0, 0, rw * 0.22, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
    }
    ctx.restore();
  }

  function kitStamp(look, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#fff6e8";
    ctx.strokeStyle = "#fff6e8";
    ctx.lineWidth = 2;
    if (look === "gear") {
      ctx.rotate(world.time * 4);
      ctx.fillRect(-s, -2, s * 2, 4);
      ctx.fillRect(-2, -s, 4, s * 2);
    } else if (look === "ice" || look === "shard" || look === "salt" || look === "mirror" || look === "fold") {
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s, 0);
      ctx.closePath();
      ctx.stroke();
    } else if (look === "spark" || look === "zap") {
      ctx.beginPath();
      ctx.moveTo(-s, s * 0.4);
      ctx.lineTo(0, -s);
      ctx.lineTo(s * 0.2, s * 0.1);
      ctx.lineTo(s, -s * 0.3);
      ctx.stroke();
    } else if (look === "bone" || look === "needle") {
      ctx.fillRect(-s, -1.5, s * 2, 3);
      ctx.beginPath();
      ctx.arc(-s, 0, 3, 0, Math.PI * 2);
      ctx.arc(s, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (look === "star" || look === "ray") {
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.3, -s * 0.3);
      ctx.lineTo(s, 0);
      ctx.lineTo(s * 0.3, s * 0.3);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.3, s * 0.3);
      ctx.lineTo(-s, 0);
      ctx.lineTo(-s * 0.3, -s * 0.3);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(3, s * 0.55), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawKitFx(b, col) {
    const floor = world.door ? world.door.y + TILE : world.rows * TILE;
    const preview = b.tell && b.tell.preview;
    ctx.save();
    if ((b.flash || 0) > 0.02) {
      ctx.globalAlpha = Math.min(0.28, b.flash * 0.45);
      ctx.fillStyle = col;
      ctx.fillRect(0, 0, world.cols * TILE, floor);
    }
    if (b.band === "desperate" || b.band === "strain") {
      ctx.globalAlpha = b.band === "desperate" ? 0.45 : 0.22;
      ctx.strokeStyle = col;
      ctx.lineWidth = b.band === "desperate" ? 3 : 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.band === "desperate" ? 46 : 34, world.time * 2, world.time * 2 + 1.4);
      ctx.stroke();
    }
    const zones = world.bossZones || [];
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      ctx.globalAlpha = z.warn > 0 ? 0.22 : 0.5;
      ctx.fillStyle = z.warn > 0 ? "#fff6e8" : col;
      ctx.fillRect(z.x, z.y, z.w, z.h);
      if (z.warn > 0) {
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = "#fff6e8";
        ctx.lineWidth = 2;
        ctx.strokeRect(z.x + 2, z.y + 2, Math.max(4, z.w - 4), Math.max(4, z.h - 4));
      }
      if (z.w >= 24 && z.h >= 16) {
        ctx.globalAlpha = z.warn > 0 ? 0.85 : 0.95;
        kitStamp(b.look, z.x + z.w / 2, z.y + z.h / 2, Math.max(4, Math.min(10, z.w * 0.12, z.h * 0.28)));
      }
    }
    const lane = (preview && preview.lane) || b.lane;
    if (lane && lane.w > 0) {
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = "#fff6e8";
      ctx.fillRect(lane.x, floor - 10, lane.w, 8);
    }
    if (preview && preview.mark) {
      const m = preview.mark;
      ctx.globalAlpha = 0.45 + Math.sin(world.time * 24) * 0.2;
      ctx.strokeStyle = "#fff6e8";
      ctx.lineWidth = 2;
      ctx.strokeRect(m.x, m.y, m.w, m.h);
    }
    const rush = (preview && preview.rush) || b.rush;
    if (rush) {
      const left = rush.dir > 0 ? rush.x : rush.x - rush.dist;
      ctx.globalAlpha = rush.live ? 0.55 : 0.28;
      ctx.fillStyle = col;
      ctx.fillRect(left, rush.y, rush.dist, rush.h);
      if (rush.live) {
        ctx.globalAlpha = 0.9;
        ctx.fillRect(rush.x - rush.w / 2, rush.y, rush.w, rush.h);
        ctx.fillStyle = "#fff6e8";
        const nose = rush.x + rush.dir * (rush.w / 2);
        ctx.beginPath();
        ctx.moveTo(nose + rush.dir * 14, rush.y + rush.h / 2);
        ctx.lineTo(nose, rush.y - 2);
        ctx.lineTo(nose, rush.y + rush.h + 2);
        ctx.closePath();
        ctx.fill();
      }
    }
    const wave = b.wave || (preview && preview.wave);
    if (wave) {
      const rad = wave.hot ? wave.r : 16;
      ctx.globalAlpha = wave.hot ? 0.7 : 0.35;
      ctx.strokeStyle = "#fff6e8";
      ctx.fillStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(wave.x, floor - 6, Math.max(12, rad), wave.hot ? 14 : 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = wave.hot ? 0.9 : 0.55;
      const crest = Math.max(12, rad);
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(wave.x + i * crest * 0.28, floor - 8);
        ctx.lineTo(wave.x + i * crest * 0.28, floor - 16 - (i === 0 ? 6 : 0));
        ctx.stroke();
      }
    }
    if (preview && preview.fx && preview.fx.blink != null) {
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(preview.fx.blink, b.y, 22, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (preview && preview.shots) {
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = "#fff6e8";
      ctx.lineWidth = 2;
      for (let i = 0; i < preview.shots.length; i++) {
        const s = preview.shots[i];
        ctx.beginPath();
        ctx.moveTo(s.x + s.w / 2, s.y + s.h / 2);
        if (s.grav && preview.mark) {
          ctx.lineTo(preview.mark.x + preview.mark.w / 2, preview.mark.y + preview.mark.h / 2);
        } else {
          ctx.lineTo(s.x + s.w / 2 + (s.vx || 0) * 10, s.y + s.h / 2 + (s.vy || 0) * 10);
        }
        ctx.stroke();
      }
    }
    if (b.echo) {
      ctx.globalAlpha = Math.max(0, b.echo.life);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(b.echo.x, b.echo.y, 16, 0, Math.PI * 2);
      ctx.fill();
      kitStamp(b.look, b.echo.x, b.echo.y, 8);
    }
    ctx.restore();
  }


  function drawBossShots(col) {
    const shots = world.bossShots || [];
    if (!shots.length) return;
    ctx.save();
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i];
      if (s.delay > 0) continue;
      if (s.look) {
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = col;
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.restore();
        drawKitShot(s, col);
        continue;
      }
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(2, Math.min(s.w, s.h) * 0.45);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(s.x + s.w / 2 - s.vx * 2.4, s.y + s.h / 2 - s.vy * 2.4);
      ctx.lineTo(s.x + s.w / 2, s.y + s.h / 2);
      ctx.stroke();
      if (s.kind === "spin" || s.kind === "shot" || s.kind === "pop") {
        ctx.save();
        ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
        ctx.rotate(world.time * (s.kind === "spin" ? 14 : 7) + i);
        const pulse = s.kind === "spin" ? 1 + Math.sin(world.time * 18) * 0.14 : 1;
        const rw = s.w * (s.kind === "spin" ? 0.62 : 0.52) * pulse;
        const rh = s.h * (s.kind === "spin" ? 0.46 : 0.44) * pulse;
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = "#fe92b8";
        ctx.beginPath();
        ctx.ellipse(0, 0, rw * 1.45, rh * 1.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#fe1f6f";
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff0f6";
        ctx.beginPath();
        ctx.ellipse(-rw * 0.12, -rh * 0.16, rw * 0.36, rh * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }
      ctx.globalAlpha = 0.95;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = "#fff6e8";
      ctx.fillRect(s.x + 3, s.y + 3, Math.max(4, s.w * 0.35), Math.max(4, s.h * 0.35));
    }
    ctx.restore();
  }

  function nullStormOn() {
    const list = world.nullBeams || [];
    for (let i = 0; i < list.length; i++) if (list[i].cause === "STORM") return true;
    return false;
  }

  function drawNullFog(b) {
    const amt = b.fog || 0;
    if (amt <= 0.04) return;
    const W = world.cols * TILE;
    const H = world.rows * TILE;
    const floor = world.door ? world.door.y + TILE : H;
    const lane = b.safeW > 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    if (lane) ctx.rect(b.safeX, 0, b.safeW, H);
    // Solid bands (no per-frame gradients). evenodd digs the safe lane out of the fog.
    if (typeof ctx.clip === "function") ctx.clip("evenodd");
    ctx.globalAlpha = 0.42 + amt * 0.46;
    ctx.fillStyle = "#16040e";
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.22 + amt * 0.28;
    for (let i = 0; i < 4; i++) {
      const drift = world.time * (22 + i * 9) + i * 110;
      const y = ((drift % (H + 90)) - 45);
      ctx.fillStyle = i % 2 ? "#ffaad2" : "#780830";
      ctx.fillRect(-20, y, W + 40, 28);
      ctx.globalAlpha = 0.12 + amt * 0.18;
      ctx.fillRect(-20, y + 28, W + 40, 36);
      ctx.globalAlpha = 0.22 + amt * 0.28;
    }
    ctx.restore();
    if (!lane) return;
    const x = b.safeX;
    const w = b.safeW;
    ctx.save();
    ctx.globalAlpha = 0.5 + amt * 0.4;
    ctx.fillStyle = "#12040c";
    ctx.fillRect(x - 36, 0, 36, H);
    ctx.fillRect(x + w, 0, 36, H);
    ctx.globalAlpha = 0.16 + amt * 0.22;
    ctx.fillStyle = "#ffd6ea";
    ctx.fillRect(x + 6, 0, Math.max(8, w - 12), floor);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#fff6e8";
    ctx.fillRect(x, floor - 10, w, 8);
    ctx.restore();
  }

  function drawFlameColumn(x, w, floor, hot, seed) {
    const t = world.time || 0;
    const steps = 7;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, floor);
    for (let i = 0; i <= steps; i++) {
      const yy = floor - (floor * i / steps);
      const wob = Math.sin(t * 13 + i * 0.9 + seed) * (hot ? w * 0.18 : w * 0.08);
      ctx.lineTo(x + wob, yy);
    }
    ctx.quadraticCurveTo(x + w * 0.5, -16 - Math.sin(t * 9 + seed) * 8, x + w, 0);
    for (let i = steps; i >= 0; i--) {
      const yy = floor - (floor * i / steps);
      const wob = Math.sin(t * 13 + i * 0.9 + seed + 2.1) * (hot ? w * 0.18 : w * 0.08);
      ctx.lineTo(x + w + wob, yy);
    }
    ctx.closePath();
    ctx.fillStyle = hot ? "#fe1f6f" : "rgba(254, 146, 184, 0.55)";
    ctx.globalAlpha = hot ? 0.88 : 0.32;
    ctx.fill();
    ctx.globalAlpha = hot ? 0.7 : 0.28;
    ctx.fillStyle = "#fff0f6";
    ctx.fillRect(x + w * 0.38, 8, Math.max(3, w * 0.22), floor - 16);
    ctx.fillStyle = "#fe92b8";
    ctx.globalAlpha = hot ? 0.9 : 0.4;
    const tip = 10 + Math.sin(t * 16 + seed) * 6;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, floor - 6, w * 0.42, tip, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawNullFx(b) {
    drawNullFog(b);
    const floor = world.door ? world.door.y + TILE : world.rows * TILE;
    const beams = world.nullBeams || [];
    for (let i = 0; i < beams.length; i++) {
      const bm = beams[i];
      const hot = bm.warn <= 0;
      drawFlameColumn(bm.x, bm.w, floor, hot, i * 1.7);
      if (bm.blast > 0 && bm.blast < 1) {
        const p = bm.blast;
        const rad = 8 + p * (bm.cause === "STORM" ? 62 : 40);
        const cx = bm.x + bm.w / 2;
        ctx.save();
        ctx.globalAlpha = 0.85 * (1 - p);
        ctx.strokeStyle = "#fff0f6";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(cx, floor - 2, rad, rad * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(254, 31, 111, " + (0.45 * (1 - p)) + ")";
        ctx.beginPath();
        ctx.ellipse(cx, floor - 2, rad * 0.45, rad * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    if (b.half) {
      const w = b.half.reach || world.cols * TILE * 0.42;
      const x = b.half.side < 0 ? 0 : world.cols * TILE - w;
      const hot = !!b.half.hot;
      ctx.save();
      ctx.globalAlpha = hot ? 0.28 : 0.12;
      ctx.fillStyle = "#7a1038";
      ctx.fillRect(x, 0, w, floor);
      ctx.restore();
      const tongues = Math.max(5, Math.floor(w / 48));
      for (let i = 0; i < tongues; i++) {
        const tx = x + (i + 0.35) * (w / tongues);
        drawFlameColumn(tx, 22, floor, hot, i * 0.8);
      }
    }
    if (b.wave) {
      ctx.save();
      ctx.globalAlpha = b.wave.live > 0 ? 0.85 : 0.4;
      ctx.fillStyle = "#fe1f6f";
      const ww = b.wave.live > 0 ? b.wave.r : 24;
      ctx.beginPath();
      ctx.ellipse(b.wave.x, floor - 6, ww, b.wave.live > 0 ? 16 : 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff0f6";
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.ellipse(b.wave.x, floor - 6, ww * 0.55, b.wave.live > 0 ? 6 : 3, 0, 0, Math.PI * 2);
      ctx.fill();
      if (b.wave.live > 0) {
        ctx.globalAlpha = Math.max(0.15, 0.7 - b.wave.live);
        ctx.strokeStyle = "#fff6e8";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(b.wave.x, floor - 4, b.wave.r, 22 + b.wave.live * 30, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (world.magnet && world.time < world.magnet.until && b.phase === "fight") {
      ctx.save();
      ctx.translate(world.magnet.x, world.magnet.y);
      ctx.rotate(world.time * 3);
      ctx.fillStyle = "#fe1f6f";
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff0f6";
      ctx.beginPath();
      ctx.ellipse(-2, -1, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (b.drive) {
      const d = b.drive;
      const hot = !!d.live;
      ctx.save();
      ctx.globalAlpha = hot ? 0.55 : 0.22 + Math.sin(world.time * 22) * 0.1;
      ctx.fillStyle = hot ? "#fe1f6f" : "#fff0f6";
      ctx.fillRect(0, floor - 18, world.cols * TILE, 16);
      ctx.globalAlpha = hot ? 0.9 : 0.55;
      ctx.fillStyle = "#fff6e8";
      ctx.fillRect(d.x - 30, floor - 20, 60, 18);
      if (!hot) {
        // Chevron marks instead of fillText — no font measure/churn on the warn frames.
        const pulse = 0.55 + Math.sin(world.time * 18) * 0.35;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = "#fff6e8";
        const base = floor - 34;
        for (let i = 0; i < 3; i++) {
          const y = base - i * 10;
          ctx.beginPath();
          ctx.moveTo(d.x, y);
          ctx.lineTo(d.x - 10, y + 8);
          ctx.lineTo(d.x - 4, y + 8);
          ctx.lineTo(d.x - 4, y + 14);
          ctx.lineTo(d.x + 4, y + 14);
          ctx.lineTo(d.x + 4, y + 8);
          ctx.lineTo(d.x + 10, y + 8);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }
    drawNullRageAura(b);
  }

  function drawNullBars() {
    const b = world.boss;
    if (!b || b.dim !== 1) return;
    const bars = b.bars || 0;
    const flash = Math.max(b.flash || 0, b.punch || 0);
    if (bars <= 0.01 && flash <= 0.01) return;
    ctx.save();
    if (bars > 0.01) {
      const h = Math.min(VIEW_H * 0.28, 28 + bars * 90);
      ctx.fillStyle = "#07060a";
      ctx.fillRect(0, 0, VIEW_W, h);
      ctx.fillRect(0, VIEW_H - h, VIEW_W, h);
    }
    if (flash > 0.01) {
      const pulse = 0.72 + Math.sin((world.time || 0) * 34) * 0.28;
      const a = Math.min(0.9, flash) * pulse;
      ctx.globalAlpha = a * 0.55;
      ctx.fillStyle = "#14000a";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = a * 0.28;
      ctx.fillStyle = "#ff2f86";
      ctx.fillRect(VIEW_W * 0.12, VIEW_H * 0.08, VIEW_W * 0.76, VIEW_H * 0.72);
      ctx.globalAlpha = a * 0.16;
      ctx.fillStyle = "#ffd6e8";
      ctx.fillRect(VIEW_W * 0.28, VIEW_H * 0.18, VIEW_W * 0.44, VIEW_H * 0.42);
      ctx.globalAlpha = Math.min(0.55, a * 0.5);
      for (let i = 0; i < 6; i++) {
        const y = ((world.time * (180 + i * 40) + i * 97) % (VIEW_H + 48)) - 24;
        const thick = 1 + (i % 3);
        ctx.fillStyle = i % 2 ? "#ff4d9a" : "#ffe0ee";
        ctx.fillRect(-20, y, VIEW_W + 40, thick);
      }
      ctx.globalAlpha = Math.min(0.35, a * 0.4);
      ctx.strokeStyle = "#ffd0e6";
      ctx.lineWidth = 8 + a * 18;
      ctx.strokeRect(12, 12, VIEW_W - 24, VIEW_H - 24);
    }
    ctx.restore();
  }

  function layoutBossSay(say) {
    if (!say) return;
    if (say._fitText === say.text && say._fitTw && !!say._fitRage === !!say.rage) return;
    const text = say.text || "";
    if (say.rage) {
      let size = 44;
      ctx.font = "800 " + size + "px Bungee, sans-serif";
      while (size > 26 && ctx.measureText(text).width > VIEW_W - 36) {
        size -= 1;
        ctx.font = "800 " + size + "px Bungee, sans-serif";
      }
      say._fitSize = size;
      say._fitTw = Math.min(VIEW_W - 24, ctx.measureText(text).width + 36);
      say._fitText = text;
      say._fitFont = "800 " + size + "px Bungee, sans-serif";
      say._fitRage = true;
      return;
    }
    ctx.font = "800 22px Bungee, sans-serif";
    let size = 22;
    while (size > 14 && ctx.measureText(text).width > 420) {
      size -= 1;
      ctx.font = "800 " + size + "px Bungee, sans-serif";
    }
    say._fitSize = size;
    say._fitTw = Math.max(160, Math.min(480, ctx.measureText(text).width + 28));
    say._fitText = text;
    say._fitFont = "800 " + size + "px Bungee, sans-serif";
    say._fitRage = false;
  }

  function drawBossTalk() {
    const b = world.boss;
    const say = b && b.say;
    if (!say || say.age >= say.life || deathShow || player.win) return;
    if (player.dead && b.phase !== "intro") return;
    const left = say.life - say.age;
    const text = say.text || "";
    layoutBossSay(say);
    const size = say._fitSize || 22;
    const tw = say._fitTw || 160;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, left * 4));
    if (say.rage) {
      const shake = Math.min(14, (world.shake || 0) + (left > 2.4 ? 10 : 4));
      const jx = Math.sin((world.time || 0) * 62) * shake * 0.55;
      const jy = Math.cos((world.time || 0) * 78) * shake * 0.35;
      const x = Math.max(8, (VIEW_W - tw) / 2) + jx;
      const y = VIEW_H * 0.28 + jy;
      const th = size + 36;
      ctx.fillStyle = "rgba(12, 0, 8, 0.82)";
      ctx.fillRect(x, y, tw, th);
      ctx.strokeStyle = "#fe1f6f";
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 2, y + 2, tw - 4, th - 4);
      ctx.font = "700 12px Rubik, sans-serif";
      ctx.fillStyle = say.color || "#fe1f6f";
      ctx.fillText(say.name || "NULL", x + 16, y + 18);
      ctx.font = say._fitFont || ("800 " + size + "px Bungee, sans-serif");
      ctx.fillStyle = say.ink || "#fff0f6";
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.fillText(text, x + 16, y + 18 + size);
      ctx.shadowBlur = 0;
      ctx.restore();
      return;
    }
    const x = Math.max(16, (VIEW_W - tw) / 2);
    const bars = (world.boss && world.boss.bars) || 0;
    const barH = bars > 0.01 ? Math.min(VIEW_H * 0.28, 28 + bars * 90) : 0;
    const y = Math.max(62, barH + 16);
    ctx.fillStyle = "rgba(8, 6, 12, 0.9)";
    ctx.fillRect(x, y, tw, 52);
    ctx.strokeStyle = say.color || "#fff";
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 2, y + 2, tw - 4, 48);
    ctx.font = "700 13px Rubik, sans-serif";
    ctx.fillStyle = say.color || "#fff";
    ctx.fillText(say.name || "", x + 14, y + 18);
    ctx.font = say._fitFont || ("800 " + size + "px Bungee, sans-serif");
    ctx.fillStyle = say.ink || "#fff6e8";
    ctx.fillText(text, x + 14, y + 42);
    ctx.restore();
  }

  function tickEvents() {
    if (world.boss && world.boss.phase === "intro") return;
    for (const ev of world.events) {
      if (ev.rearmAt != null && world.time >= ev.rearmAt) {
        ev.rearmAt = null;
        ev.fired = false;
        ev.armed = null;
        ev.held = 0;
      }
      if (ev.fired) continue;
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
    const queued = world.queued;
    let qLive = 0;
    for (let qi = 0; qi < queued.length; qi++) {
      const q = queued[qi];
      if (q.done) continue;
      if (world.time >= q.at) {
        q.done = true;
        for (let ai = 0; ai < q.do.length; ai++) runAction(q.do[ai]);
        continue;
      }
      if (qLive !== qi) queued[qLive] = q;
      qLive += 1;
    }
    if (qLive < queued.length) queued.length = qLive;

    const restores = world.restores;
    if (restores && restores.length > 48) {
      let rLive = 0;
      for (let ri = 0; ri < restores.length; ri++) {
        const r = restores[ri];
        if (r.done) continue;
        if (rLive !== ri) restores[rLive] = r;
        rLive += 1;
      }
      restores.length = rLive;
    }
  }

  function crumbleUnderPlayer() {
    if (!player.onGround) return;
    const feet = [
      [player.x + 2, player.y + player.h + 1],
      [player.x + player.w - 2, player.y + player.h + 1],
    ];
    for (const [px, py] of feet) {
      if (tileAt(px, py) !== "=") continue;
      const tx = Math.floor(px / TILE);
      const ty = Math.floor(py / TILE);
      if (!writeTile(tx, ty, ".")) continue;
      burst(tx * TILE + 16, ty * TILE + 8, "#c4b8a8", 8, 3);
      audio.play("crumble");
      world.shake = 5;
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
      if (!isSolid(tileAt(tx * TILE + 16, ty * TILE + 16))) return;
      if (!writeTile(tx, ty, ".")) return;
      burst(tx * TILE + 16, ty * TILE + 8, "#c4b8a8", 10, 3.5);
      audio.play("crumble");
      world.shake = 6;
      world.still = 0;
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
            if (!player.wasOnGround && (player.airTime || 0) > 0.08 && Math.abs(player.vy) > 2.2) {
              audio.play("land");
              player.justLanded = true;
              const impact = Math.min(1.7, Math.abs(player.vy) / 7.5);
              world.squash = 0.32 + impact * 0.22;
              camFX.punch = Math.max(camFX.punch, 3.2 + impact * 3.4);
              const feetX = player.x + player.w / 2;
              const feetY = player.y + player.h;
              dust(feetX, feetY, Math.round(5 + impact * 8), 0.35 + impact * 0.4);
              shock(feetX, feetY, fxAccentRgb(0.55 + impact * 0.3));
              puff(feetX, feetY - 2, Math.round(2 + impact * 3), fxAccentRgb(0.28));
              if (impact > 0.55) burst(feetX, feetY - 2, "#fff6d8", Math.round(3 + impact * 4), 1.8 + impact);
              if (impact > 1.05) {
                world.shake = Math.max(world.shake, 2 + impact);
                ember(feetX, feetY - 4, 3);
              }
              if (stickyNext > 0) {
                lockTimer = Math.max(lockTimer, stickyNext);
                stickyNext = 0;
                world.shake = Math.max(world.shake, 3);
                audio.play("land");
              }
            }
            player.onGround = true;
            player.airTime = 0;
            player.coyote = 0.12;
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
    world.qte = null;
    player.dead = true;
    deaths += 1;
    world.deathReason = deathCopy(msg);
    recordMindSample("death", msg);
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
    if (!world.blood) world.blood = [];
    for (let i = 0; i < 10; i++) {
      world.blood.push({
        x: player.x + Math.random() * player.w,
        y: player.y + 8 + Math.random() * (player.h - 4),
        s: 3 + Math.random() * 11,
        a: 0.32 + Math.random() * 0.4,
      });
    }
    if (world.blood.length > 48) {
      const drop = world.blood.length - 48;
      for (let bi = 0; bi < 48; bi++) world.blood[bi] = world.blood[bi + drop];
      world.blood.length = 48;
    }
    audio.play("die");
    if (!testMode && !creatorPlay) parkClock();
    updateHud();
    updateComboHud();
    if (creatorPlay) {
      say(world.deathReason);
      deathTimer = 0.85;
      return;
    }
    const trailerOn = window.SURGE_TRAILER && window.SURGE_TRAILER.on;
    const trailerRoast = trailerOn && window.SURGE_TRAILER.wantsRoast;
    if (testMode && !trailerRoast) {
      if (trailerOn) deathTimer = 6;
      return;
    }
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
      bossReply: (kind === "boss" && world.boss && (world.boss.dim || 1) < 2 && window.SURGE_BOSS_VOICE)
        ? ((window.SURGE_BOSS_VOICE.voice(world.boss.dim || 1) || {}).back || "")
        : "",
      bossInk: (kind === "boss" && world.boss && (world.boss.dim || 1) < 2 && window.SURGE_BOSS_VOICE)
        ? ((window.SURGE_BOSS_VOICE.voice(world.boss.dim || 1) || {}).ink || "")
        : "",
      bossColor: (kind === "boss" && world.boss && (world.boss.dim || 1) < 2 && window.SURGE_BOSS_VOICE)
        ? ((window.SURGE_BOSS_VOICE.voice(world.boss.dim || 1) || {}).color || "")
        : "",
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
    hold.jump = false;
    hold.dash = false;
    player.jumpHeld = false;
    player.buffer = 0;
    const jumpCodes = (binds && binds.jump) || BIND_DEFAULTS.jump;
    for (let ji = 0; ji < jumpCodes.length; ji++) keys.delete(jumpCodes[ji]);
    player.win = true;
    recordMindSample("clear");
    burst(player.x + 12, player.y + 10, "#f0c14b", 28, 5);
    burst(player.x + 12, player.y + 10, "#fff6d8", 12, 3);
    audio.play("win");
    if (!testMode) audio.play("stinger");
    clearBloom = 1;
    shock(player.x + player.w / 2, player.y + player.h / 2, "rgba(255,210,120,0.9)");
    if (creatorReturn) {
      const cb = creatorReturn;
      creatorReturn = null;
      creatorPlay = false;
      testMode = false;
      setTimeout(() => {
        leavePlayUi();
        mode = "creator";
        cb({ reason: "clear", deaths, time: world.time });
      }, 480);
      return;
    }
    if (testMode) return;
    dimIntro = 0;
    if (dimCard) dimCard.classList.add("hidden");
    mode = "clear";
    document.getElementById("clear-name").textContent = world.name;
    const clearStats = document.getElementById("clear-stats");
    if (clearStats) {
      clearStats.textContent = `${world.time.toFixed(1)}s · DEAD ${deaths} · SURGE x${Math.max(1, combo)}`;
    }
    clearScreen.classList.remove("hidden");
  }

  function nextLevel() {
    clearScreen.classList.add("hidden");
    levelIndex += 1;
    if (levelIndex >= window.LEVELS.length) {
      mode = "win";
      dimIntro = 0;
      if (dimCard) dimCard.classList.add("hidden");
      const secs = runSeconds();
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
      if (!testMode) audio.play("award");
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
    if (!player.onGround) player.airTime = (player.airTime || 0) + FIXED;
    tickRoomHabit();

    let ix = 0;
    let jumpDown = false;
    if (useBot) {
      ix = botIx;
      jumpDown = botJump;
    } else {
    if (bindHeld("left") || hold.left) ix -= 1;
    if (bindHeld("right") || hold.right) ix += 1;
      jumpDown = bindHeld("jump") || hold.jump;
    }
    if (window.SURGE_TRAILER && window.SURGE_TRAILER.lock) {
      ix = 0;
      jumpDown = false;
      hold.dash = false;
    }
    if (!useBot && world.boss && world.boss.phase === "intro") {
      ix = 0;
      jumpDown = false;
      player.vx = 0;
    }
    if (lockTimer > 0) { ix = 0; jumpDown = false; lockTimer -= FIXED; }
    if (world.qte && world.qte.lock) { ix = 0; jumpDown = false; }

    if (world.reverse) ix *= -1;
    if (ix) player.facing = ix;
    const icy = (world.slipT || 0) > 0;
    const dashing = dashT > 0;
    const accel = player.onGround ? (icy ? 0.42 : 0.9) : 0.58;
    if (dashing) {
      /* keep dash momentum; light air steer only */
      if (ix && Math.sign(ix) === Math.sign(dashDir)) player.vx += ix * 0.15;
      player.vx = dashDir * Math.max(Math.abs(player.vx), 9.2);
    } else if (ix) {
      player.vx += ix * accel;
    } else {
      player.vx *= player.onGround ? (icy ? 0.96 : 0.7) : 0.94;
    }
    if (!dashing) {
      player.vx += world.wind;
      if (world.magnet && world.time < world.magnet.until) {
        const pull = Math.sign(world.magnet.x - (player.x + player.w / 2)) * (world.magnet.str || 0.16);
        player.vx += pull;
      }
    }
    if (!ix && player.onGround && !icy && !dashing && Math.abs(player.vx) < 0.35) player.vx = 0;

    dashCool = Math.max(0, dashCool - FIXED);
    dashT = Math.max(0, dashT - FIXED);
    const wantDash = bindHeld("dash") || hold.dash;
    const dashEdge = wantDash && !dashHeld;
    dashHeld = wantDash;
    if (
      dimIndex >= 3 && dashEdge && dashCool <= 0 && !player.dead &&
      lockTimer <= 0 && !(world.qte && world.qte.lock) &&
      !(world.boss && world.boss.phase === "intro")
    ) {
      dashDir = ix || player.facing || 1;
      player.facing = dashDir;
      player.vx = dashDir * 9.2;
      player.vy *= 0.35;
      dashCool = 0.72;
      dashT = 0.16;
      if (roomHabit) roomHabit.dashes += 1;
      world.squash = -0.28;
      audio.play("dash");
      burst(player.x + player.w / 2, player.y + player.h / 2, "#ffe8a0", 12, 5);
      burst(player.x + player.w / 2, player.y + player.h / 2, fxAccentRgb(0.95), 6, 4.2);
      shock(player.x + player.w / 2, player.y + player.h / 2, "rgba(255,232,170,0.85)");
      puff(player.x + player.w / 2 - dashDir * 8, player.y + player.h / 2, 4, "rgba(255,232,170,0.35)");
      ember(player.x + player.w / 2, player.y + player.h / 2, 4);
      camFX.punch = Math.max(camFX.punch, 6);
    } else if (
      dimIndex >= 3 && dashEdge && dashCool > 0 && !player.dead && !testMode &&
      lockTimer <= 0 && !(world.boss && world.boss.phase === "intro")
    ) {
      audio.play("tick");
    }
    const cap = dashT > 0 ? 10 : 4.5;
    player.vx = Math.max(-cap, Math.min(cap, player.vx));

    if (jumpDown && !player.jumpHeld) player.buffer = 0.13;
    player.jumpHeld = jumpDown;
    if (player.onGround) player.coyote = 0.12;
    else player.coyote -= FIXED;
    player.buffer -= FIXED;
    player.bounceLock -= FIXED;
    if (world.squash > 0) world.squash = Math.max(0, world.squash - FIXED * 1.35);
    else if (world.squash < 0) world.squash = Math.min(0, world.squash + FIXED * 2.1);

    const gSign = Math.sign(world.gravity) || 1;
    if (player.buffer > 0 && player.coyote > 0) {
      const jMul = world.jumpMulT > 0 ? (world.jumpMul || 1) : 1;
      player.vy = -12.6 * gSign * jMul;
      player.onGround = false;
      player.coyote = 0;
      player.buffer = 0;
      world.jumped = true;
      world.jumps += 1;
      world.squash = -0.36;
      audio.play("jump");
      dust(player.x + player.w / 2, player.y + player.h, 5, player.facing * 0.35);
      shock(player.x + player.w / 2, player.y + player.h, fxAccentRgb(0.45));
      burst(player.x + player.w / 2, player.y + player.h - 2, fxAccentRgb(0.9), 3, 2.1);
      camFX.punch = Math.max(camFX.punch, 2.4);
    }
    if (!jumpDown) {
      if (gSign > 0 && player.vy < -4) player.vy *= 0.55;
      if (gSign < 0 && player.vy > 4) player.vy *= 0.55;
    }

    player.vy += world.gravity;
    if (gSign > 0) player.vy = Math.min(player.vy, 13);
    else player.vy = Math.max(player.vy, -13);

    player.wasOnGround = player.onGround;
    player.onGround = false;
    const xBefore = player.x;
    moveAxis(player.vx, 0);
    moveAxis(0, player.vy);
    const movedX = player.x - xBefore;
    if (player.x > world.maxX) world.maxX = player.x;

    player.ghostT = (player.ghostT || 0) + FIXED;
    const fast = dashT > 0 || Math.abs(movedX) > 2.4 || (!player.onGround && Math.abs(player.vy) > 4.2);
    if (fast && player.ghostT > (dashT > 0 ? 0.05 : 0.11)) {
      player.ghostT = 0;
      const life = dashT > 0 ? 0.26 : 0.4;
      const a = allocAfter();
      a.x = player.x; a.y = player.y; a.facing = player.facing;
      a.life = life; a.max = life; a.vx = player.vx; a.vy = player.vy;
      a.anim = player.anim; a.lean = player.lean || 0; a.sq = player.visSq || 0; a.bob = player.bob || 0;
      world.afterimages.push(a);
      if (world.afterimages.length > 28) freeAfter(world.afterimages.shift());
    }

    const midX = player.x + player.w / 2;
    const feetY = player.y + player.h + 1;
    if (tileAt(midX, feetY) === "B" && player.bounceLock <= 0 && player.vy * gSign >= 0) {
      player.vy = -16 * gSign;
      player.onGround = false;
      player.bounceLock = 0.2;
      audio.play("jump");
      burst(midX, player.y + player.h, "#ffd27a", 10, 3);
      burst(midX, player.y + player.h, fxAccentRgb(0.9), 5, 2.6);
      shock(midX, player.y + player.h, "rgba(255,210,122,0.9)");
      puff(midX, player.y + player.h - 4, 3, "rgba(255,210,122,0.35)");
      ember(midX, player.y + player.h - 6, 3);
      camFX.punch = Math.max(camFX.punch, 4);
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
      if (hz) { die(bossTileCause(hx, hy) || hz); return; }
    }

    const leanTarget = Math.max(-0.28, Math.min(0.28,
      player.vx * 0.035 + (player.onGround ? 0 : player.vy * 0.012)));
    player.lean += (leanTarget - player.lean) * 0.28;
    const airSq = player.onGround
      ? 0
      : (player.vy < -1 ? -0.16 : Math.min(0.2, player.vy * 0.018));
    player.visSq += ((world.squash || 0) + airSq - player.visSq) * 0.42;
    const stride = Math.min(1, Math.abs(player.vx) / 3.4);
    const bobTarget = player.onGround
      ? Math.abs(Math.sin(player.anim)) * -2.1 * stride
      : (player.vy < 0 ? -1.4 : 0.4);
    player.bob += (bobTarget - player.bob) * 0.4;

    player.stepCool = Math.max(0, (player.stepCool || 0) - FIXED);
    if (ix && player.onGround && Math.abs(movedX) > 0.35) {
      player.anim += Math.abs(movedX) * 0.38;
      if (!player.justLanded && player.stepCool <= 0) {
        player.stepCool = 0.16;
        dust(player.x + player.w / 2, player.y + player.h, 2, Math.sign(ix) * 0.9);
        if (!testMode) audio.play("step");
      }
    }

    for (const saw of world.saws) {
      const dx = midX - saw.x;
      const dy = player.y + player.h / 2 - saw.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 15 * 15) { die(saw.boss ? ("BOSS " + String(saw.cause || "saw").toUpperCase()) : "SAW SAID HI"); return; }
      if (!(world.boss && world.boss.phase === "intro") && d2 < 30 * 30 && nearCool <= 0) {
        nearCool = 0.4;
        burst((midX + saw.x) / 2, (player.y + 10 + saw.y) / 2, "#ffe0a0", 5, 2.8);
        if (!testMode) audio.play("near");
        camFX.punch = Math.max(camFX.punch, 3);
        nearFlare = 0.22;
      }
    }

    for (const laser of world.lasers) {
      if (laser.fake) continue;
      if (rectsOverlap(player, laser)) { die(laser.boss ? "BOSS BEAM" : "BEAM"); return; }
    }

    if (world.bossShots) {
      for (let si = 0; si < world.bossShots.length; si++) {
        const shot = world.bossShots[si];
        if (shot.delay > 0) continue;
        if (rectsOverlap(player, shot)) {
          die("BOSS " + String(shot.kind || "bolt").toUpperCase());
          return;
        }
        if (nearCool <= 0 && world.boss && world.boss.dim !== 1) {
          const dx = (shot.x + shot.w / 2) - midX;
          const dy = (shot.y + shot.h / 2) - (player.y + player.h / 2);
          const near = dx * dx + dy * dy;
          if (near < 36 * 36) {
            nearCool = 0.35;
            nearFlare = 0.18;
            if (!testMode) audio.play("near");
          }
        }
      }
    }

    if (world.boss && world.boss.dim !== 1 && kitHurt(world.boss)) return;

    if (world.boss && world.boss.dim === 1 && !player.dead) {
      const nb = world.boss;
      if (nb.phase === "fight" || nb.phase === "rage") {
        const mid = player.x + player.w / 2;
        const floor = world.door ? world.door.y + TILE : player.y + player.h;
        if (nb.drive && nb.drive.live) {
          HIT.x = nb.x - 28; HIT.y = floor - 20; HIT.w = 56; HIT.h = 20;
          if (rectsOverlap(player, HIT)) {
            die("BOSS DRIVE");
            return;
          }
        }
        if (nb.wave && nb.wave.live > 0 && player.y + player.h > floor - 22 && Math.abs(mid - nb.wave.x) < nb.wave.r) {
          die("BOSS POUND");
          return;
        }
        if (nb.half && nb.half.hot) {
          const bad = nb.half.side < 0 ? mid < nb.half.reach : mid > world.cols * TILE - nb.half.reach;
          if (bad) { die("BOSS HALF"); return; }
        }
        const beams = world.nullBeams || [];
        for (let bi = 0; bi < beams.length; bi++) {
          const bm = beams[bi];
          if (bm.warn > 0) continue;
          if (player.x + player.w > bm.x && player.x < bm.x + bm.w) {
            die("BOSS " + (bm.cause || "NEEDLES"));
            return;
          }
        }
      }
    }

    for (const drop of world.drops) {
      if (rectsOverlap(player, drop)) { die(drop.boss ? ("BOSS " + String(drop.cause || "drop").toUpperCase()) : "BRICK"); return; }
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

    const doorHit = (d) => {
      if (!d || world.doorHidden) return false;
      HIT.x = d.x + 4; HIT.y = d.y + 2; HIT.w = 24; HIT.h = 30;
      return rectsOverlap(player, HIT);
    };
    if (bossBlastHits()) { die("BOSS BOOM"); return; }
    if (tileAt(midX, player.y + player.h + 1) === "!") { die("HIDDEN TEETH"); return; }

    if (doorHit(world.fakeDoor) && !world.doorOpened) {
      world.doorOpened = "fake";
      tickEvents();
      return;
    }
    if (doorHit(world.door) && !bossHoldsDoor()) {
      winLevel();
      return;
    }

    if (player.y > world.rows * TILE + 40 || player.y < -80) die("VOID");
  }

  function tickSaws() {
    for (let i = world.saws.length - 1; i >= 0; i--) {
      const saw = world.saws[i];
      if (saw.life != null) {
        saw.life -= FIXED;
        if (saw.life <= 0) { swapRemove(world.saws, i); continue; }
      }
      saw.spin += 0.32;
      if (saw.chase && !player.dead) {
        const tx = player.x + player.w / 2;
        saw.vx += Math.sign(tx - saw.x) * 0.09;
        saw.vx = Math.max(-3.5, Math.min(3.5, saw.vx));
      }
      saw.x += saw.vx;
      if (saw.orbit) {
        saw.phase = (saw.phase || 0) + FIXED * 6.5;
        saw.y = saw.baseY + Math.sin(saw.phase) * saw.orbit;
      } else saw.y += saw.vy;
      audio.hear(saw, "saw", saw.x, saw.y, {
        rate: 0.84 + Math.min(0.5, Math.hypot(saw.vx, saw.vy) / 5),
      });
    }
  }

  function tickLasers() {
    for (let i = world.lasers.length - 1; i >= 0; i--) {
      const laser = world.lasers[i];
      laser.life -= FIXED;
      if (laser.life <= 0) { swapRemove(world.lasers, i); continue; }
      audio.hear(laser, laser.fake ? "glow" : "laser", laser.x + laser.w / 2, laser.y + laser.h / 2);
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
      audio.hear(p, "platform", p.x + p.w / 2, p.y + p.h / 2, {
        rate: 0.86 + Math.min(0.4, Math.abs(p.vx) / 3),
      });
    }
  }

  function tickDrops() {
    for (let i = world.drops.length - 1; i >= 0; i--) {
      const d = world.drops[i];
      d.vy += 0.4;
      d.y += d.vy;
      if (d.life != null) {
        d.life -= FIXED;
        if (d.life <= 0 || d.y > world.rows * TILE + 24) {
          swapRemove(world.drops, i);
          continue;
        }
      }
      audio.hear(d, "brick", d.x + d.w / 2, d.y + d.h / 2, {
        rate: 0.7 + Math.min(1.5, Math.abs(d.vy) / 8),
      });
    }
  }

  function hearEntity(e) {
    let name = e.kind;
    const opts = {};
    if (e.kind === "crushBot") {
      name = (e.state === "fall" || e.state === "slam") ? "crushFall" : "crushWarn";
      if (e.state === "fall") opts.rate = 0.75 + Math.min(1.3, (e.vy || 0) / 9);
    } else if (e.kind === "watcher") {
      opts.rate = 1 + Math.min(1.2, (e.charge || 0) * 2.4);
    } else if (e.kind === "rocket") {
      opts.rate = 0.92 + Math.min(0.35, Math.abs(e.vx || 0) / 14);
    }
    audio.hear(e, name, e.x + (e.w || 0) / 2, e.y + (e.h || 0) / 2, opts);
  }

  function entityHit(e, pad) {
    pad = pad || 0;
    return rectsOverlap(player, {
      x: e.x - pad, y: e.y - pad, w: (e.w || 16) + pad * 2, h: (e.h || 16) + pad * 2,
    });
  }

  function tickEntities() {
    const midX = player.x + player.w / 2;
    const midY = player.y + player.h / 2;

    if ((world.voidFog || 0) > 0.05) {
      const fogTop = world.rows * TILE - world.voidFog * world.rows * TILE;
      if (player.y + player.h > fogTop + 6) { die("FOG"); return; }
    }

    if (world.huntLight && world.time < world.huntLight.until) {
      const hl = world.huntLight;
      hl.x += hl.vx;
      if (hl.x < 40 || hl.x > world.cols * TILE - 40) hl.vx *= -1;
      const dx = midX - hl.x;
      const dy = midY - (player.onGround ? player.y + 4 : midY);
      const inLight = dx * dx + dy * dy < hl.r * hl.r;
      if (!inLight) {
        hl.cold += FIXED;
        if (hl.cold > 0.55) { die("LIGHT"); return; }
      } else hl.cold = Math.max(0, hl.cold - FIXED * 1.4);
    }

    for (let i = world.entities.length - 1; i >= 0; i--) {
      const e = world.entities[i];
      e.life -= FIXED;
      if (e.life <= 0) { swapRemove(world.entities, i); continue; }

      if (e.kind === "stalker") {
        const tx = midX;
        const dir = Math.sign(tx - (e.x + e.w / 2)) || 1;
        e.vx += dir * 0.18;
        e.vx = Math.max(-e.speed, Math.min(e.speed, e.vx));
        e.x += e.vx;
        e.y += (player.y + 4 - e.y) * 0.08;
        if (entityHit(e, -2)) { die("STALKER"); return; }
      } else if (e.kind === "drone") {
        e.spin += 0.2;
        const tx = midX;
        e.x += Math.sign(tx - e.x) * 1.35;
        if (world.time >= e.fireAt) {
          e.fireAt = world.time + 1.05;
          // Short warning beam — dodge sideways, don't stand under it.
          world.lasers.push({
            x: e.x - 3, y: e.y + 12, w: 8, h: Math.min(120, world.rows * TILE - e.y - 12),
            life: 0.14, fake: false,
          });
          audio.play("spike");
          world.shake = Math.max(world.shake, 3);
        }
        if (entityHit(e, 2)) { die("DRONE"); return; }
      } else if (e.kind === "rocket") {
        const ty = midY - (e.y + e.h / 2);
        e.vy += Math.sign(ty) * (e.home || 0.07);
        e.vy = Math.max(-2.2, Math.min(2.2, e.vy));
        e.x += e.vx;
        e.y += e.vy;
        if (entityHit(e, 1)) { die(e.boss ? "BOSS ROCKET" : "ROCKET"); return; }
      } else if (e.kind === "watcher") {
        e.open = Math.min(1, e.open + FIXED * 2);
        const still = Math.abs(player.vx) < 0.45 && player.onGround;
        const inView = Math.abs(midX - e.x) < 140 && player.y > e.y;
        if (still && inView) {
          e.charge += FIXED;
          if (e.charge > 0.42) {
            world.lasers.push({
              x: Math.min(e.x, midX) - 4,
              y: e.y,
              w: Math.abs(midX - e.x) + 8,
              h: 5,
              life: 0.2, fake: false,
            });
            e.charge = 0;
            audio.play("spike");
            world.shake = Math.max(world.shake, 5);
          }
        } else e.charge = Math.max(0, e.charge - FIXED * 1.5);
      } else if (e.kind === "sentry") {
        if (world.time >= e.fireAt) {
          e.fireAt = world.time + (e.gap || 0.95);
          const boltW = 52;
          world.entities.push({
            kind: "bolt",
            x: e.side >= 0 ? e.x - boltW : e.x + e.w,
            y: e.y + 8,
            w: boltW, h: 5,
            vx: e.side >= 0 ? -4.6 : 4.6,
            life: 0.7,
          });
          audio.play("spike");
        }
        if (entityHit(e, 0)) { die("SENTRY"); return; }
      } else if (e.kind === "bolt") {
        e.x += e.vx;
        // Jump clears chest-high bolts.
        if (player.y + player.h * 0.55 > e.y && entityHit(e, 0)) { die("SENTRY"); return; }
      } else if (e.kind === "swarm") {
        e.phase += FIXED * 8;
        e.x += e.vx;
        e.y += Math.sin(e.phase) * 1.4;
        // Crouch-height swarm — jump over.
        if (player.y + player.h > e.y + 2 && entityHit(e, -1)) { die("SWARM"); return; }
      } else if (e.kind === "phantom") {
        e.x += e.vx * 0.92;
        e.y += (player.y - e.y) * 0.1;
        // Jump clears the ghost — standing into it is the fail.
        if (player.onGround && entityHit(e, -2)) { die("PHANTOM"); return; }
      } else if (e.kind === "crushBot") {
        if (e.state === "warn") {
          e.warnT -= FIXED;
          if (Math.random() < 0.35) dust(e.x + e.w / 2, e.stompY + 30, 2);
          if (e.warnT <= 0) {
            e.state = "fall";
            e.vy = 0;
          }
        } else if (e.state === "fall") {
          e.vy = (e.vy || 0) + 0.85;
          e.y += e.vy;
          if (e.y + e.h >= e.stompY) {
            e.y = e.stompY - e.h;
            e.state = "slam";
            e.life = Math.min(e.life, 0.55);
            world.shake = Math.max(world.shake, 12);
            audio.play("crumble");
            burst(e.x + e.w / 2, e.y + e.h, "#8a7060", 14, 4);
          }
        }
        if ((e.state === "fall" || e.state === "slam") && entityHit(e, 2)) {
          die("CRUSHBOT");
          return;
        }

      } else if (e.kind === "reaper") {
        const tx = midX;
        const dir = Math.sign(tx - (e.x + e.w / 2)) || 1;
        e.vx += dir * 0.22;
        e.vx = Math.max(-e.speed, Math.min(e.speed, e.vx));
        e.x += e.vx;
        e.y += (player.y + 2 - e.y) * 0.12;
        if (entityHit(e, 0)) { die("STALKER"); return; }
      } else if (e.kind === "wraith") {
        e.x += e.vx;
        e.y += (player.y - e.y) * 0.16;
        if (entityHit(e, 0)) { die("PHANTOM"); return; }
      } else if (e.kind === "seeker") {
        e.spin = (e.spin || 0) + 0.2;
        e.x += Math.sign(midX - (e.x + e.w / 2)) * 1.7;
        if (world.time >= e.fireAt) {
          e.fireAt = world.time + 0.85;
          world.lasers.push({
            x: e.x - 78, y: e.y + 3, w: 176, h: 7, life: 0.1, fake: false,
          });
          audio.play("spike");
        }
        if (entityHit(e, 1)) { die("DRONE"); return; }
      } else if (e.kind === "sweep") {
        e.x += e.vx;
        if (e.x >= e.maxX) e.life = 0;
        if (entityHit(e, 0)) { die("BEAM"); return; }
      }
      if (e.life > 0) hearEntity(e);
    }
  }

  function tickAmbientFx() {
    if (mode !== "play" || player.dead || player.win || testMode) return;
    if (world.particles.length > 220) return;
    const weather = (currentTheme().weather || "shards");
    const [ar, ag, ab] = fxAccent();
    const wind = world.wind || 0;
    // Sparse theme motes around the player so rooms feel alive.
    if (Math.random() < (weather === "spores" || weather === "ember" ? 0.22 : 0.12)) {
      const p = allocPart();
      p.x = player.x + (Math.random() - 0.5) * 180;
      p.y = player.y + (Math.random() - 0.5) * 110;
      p.vx = (Math.random() - 0.5) * 0.35 + wind * 0.4;
      p.vy = weather === "ember" || weather === "sparks"
        ? -0.35 - Math.random() * 0.5
        : (Math.random() - 0.5) * 0.3;
      p.drag = 0.98;
      p.grav = weather === "ember" ? -0.02 : (weather === "snow" || weather === "rain" ? 0.04 : 0.01);
      const life = 0.5 + Math.random() * 0.7;
      p.life = life; p.max = life;
      p.color = `rgba(${ar},${ag},${ab},${weather === "ember" ? 0.75 : 0.45})`;
      p.size = weather === "spores" ? 2.2 + Math.random() * 2.4 : 1.1 + Math.random() * 1.6;
      p.kind = weather === "ember" || weather === "sparks" ? "ember" : "mote";
      p.rot = null; p.spin = 0;
      world.particles.push(p);
    }
    // Lamppost / hanging lamp sparkle.
    const bag = world.scenery || [];
    for (let i = 0; i < bag.length; i++) {
      const sp = bag[i];
      if (sp.kind !== "lamppost" && sp.kind !== "lamp" && sp.kind !== "bulb") continue;
      if (Math.random() > 0.04) continue;
      const s = sp.s || 1;
      const lx = sp.kind === "lamppost" ? sp.x + 14 * s : sp.x;
      const ly = sp.kind === "lamppost" ? sp.y - 42 * s : (sp.float ? sp.y : sp.y + 16 * s);
      if (Math.abs(lx - (player.x + 8)) > 260) continue;
      ember(lx, ly, 1);
    }
  }

  function tickParticles() {
    tickAmbientFx();
    const bag = world.particles;
    let n = 0;
    for (let i = 0; i < bag.length; i++) {
      const p = bag[i];
      const drag = p.drag != null ? p.drag : 0.985;
      p.vx *= drag;
      p.vy *= drag;
      p.vy += p.grav != null ? p.grav : 0.16;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= FIXED;
      if (p.rot != null) p.rot += p.spin || 0;
      if (p.life > 0) {
        if (n !== i) bag[n] = p;
        n += 1;
      } else freePart(p);
    }
    bag.length = n;
    if (world.rings) {
      const rings = world.rings;
      let rn = 0;
      for (let i = 0; i < rings.length; i++) {
        const ring = rings[i];
        ring.vr *= ring.drag != null ? ring.drag : 0.9;
        ring.r += ring.vr * FIXED;
        ring.life -= FIXED;
        if (ring.life > 0) {
          if (rn !== i) rings[rn] = ring;
          rn += 1;
        } else freeRing(ring);
      }
      rings.length = rn;
    }
    const after = world.afterimages;
    let an = 0;
    for (let i = 0; i < after.length; i++) {
      const a = after[i];
      a.x += (a.vx || 0) * 0.18;
      a.y += (a.vy || 0) * 0.18;
      a.life -= FIXED;
      if (a.life > 0) {
        if (an !== i) after[an] = a;
        an += 1;
      } else freeAfter(a);
    }
    after.length = an;
  }

  function camera() {
    const lw = world.cols * TILE;
    const lh = world.rows * TILE;
    const fitCols = Math.min(world.cols, 32);
    // Shaft rooms are taller than a corridor. Fit the usual 12 rows so the
    // player stays the same size, then follow them if the map is actually taller
    // than the view.
    const fitRows = Math.min(world.rows, 12);
    const scaleW = VIEW_W / (fitCols * TILE + 36);
    const scaleH = VIEW_H / (fitRows * TILE + 70);
    // Tall/narrow windows: keep the room wide enough to play. Don't shrink to a strip.
    const scale = VIEW_H > VIEW_W * 1.25 ? Math.min(scaleW, scaleH * 1.35) : Math.min(scaleW, scaleH);
    let oy = (VIEW_H - lh * scale) / 2 + 8;
    if (VIEW_H > lh * scale + 120) oy = Math.max(48, Math.min(oy, VIEW_H - lh * scale - 56));
    let ox = (VIEW_W - Math.min(lw, fitCols * TILE) * scale) / 2;
    if (world.cols > 32) {
      const focus = player.x + player.w / 2 + player.vx * 11;
      const viewW = VIEW_W / scale;
      let cam = focus - viewW * 0.38;
      const maxCam = Math.max(0, lw - viewW);
      if (cam < 0) cam = 0;
      if (cam > maxCam) cam = maxCam;
      if (camSmoothX == null) camSmoothX = cam;
      camSmoothX += (cam - camSmoothX) * 0.22;
      ox = -camSmoothX * scale;
    }
    if (world.rows > 12) {
      const viewH = VIEW_H / scale;
      if (lh > viewH) {
        const focusY = player.y + player.h * 0.45 + player.vy * 4;
        let camY = focusY - viewH * 0.62;
        const maxCamY = lh - viewH;
        if (camY < 0) camY = 0;
        if (camY > maxCamY) camY = maxCamY;
        if (camSmoothY == null) camSmoothY = camY;
        camSmoothY += (camY - camSmoothY) * 0.22;
        oy = -camSmoothY * scale;
      }
    }
    camFX.phase += 0.72;
    camFX.punch *= 0.9;
    const shake = world.shake || 0;
    const sx = shake ? Math.sin(camFX.phase * 1.15) * shake * 0.55 : 0;
    const sy = shake ? Math.cos(camFX.phase * 1.55) * shake * 0.38 : 0;
    if (deathShow) {
      const z = deathShow.zoom || 1;
      const cx = deathShow.x + player.w / 2;
      const cy = deathShow.y + player.h / 2;
      lastView = {
        scale: scale * z,
        ox: VIEW_W / 2 - cx * scale * z + (deathShow.camX || 0) + sx,
        oy: VIEW_H / 2 - cy * scale * z + (deathShow.camY || 0) + sy + camFX.punch,
        rot: deathShow.camRot || 0,
      };
      return lastView;
    }
    lastView = { scale, ox: ox + sx, oy: oy + sy + camFX.punch, rot: 0 };
    return lastView;
  }

  function hash(x, y) {
    return ((x * 17 + y * 31) >>> 0) % 7;
  }

  function themeBricks(t) {
    const th = currentTheme();
    const pair = th.brick || ["#4a4038", "#cfc1aa"];
    if (t === "=") return ["#6a5a48", "#b9a484"];
    if (t === "B") return ["#8a3a18", "#e07a3a"];
    if (t === "i") return ["#3a4a62", "#b8d4f0"];
    return pair;
  }

  function drawBrickFace(px, py, body, lip, crumbly) {
    const n = hash(px / TILE, py / TILE);
    // Base slab
    ctx.fillStyle = body;
    ctx.fillRect(px, py, TILE, TILE);
    // Soft vertical shade — baked once, drawn every brick (same look, no per-brick gradient).
    const shade = ensureBrickShade();
    if (shade) ctx.drawImage(shade, px, py);
    else {
      const g = ctx.createLinearGradient(px, py, px + TILE, py);
      g.addColorStop(0, "rgba(255,255,255,0.07)");
      g.addColorStop(0.45, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(0,0,0,0.22)");
      ctx.fillStyle = g;
      ctx.fillRect(px, py, TILE, TILE);
    }
    // Top walk lip
    const lipH = crumbly ? 5 : 7;
    ctx.fillStyle = lip;
    ctx.fillRect(px, py, TILE, lipH);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(px + 1, py + 1, TILE - 2, 2);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(px, py + lipH - 1, TILE, 1);
    // Bottom / right occlusion
    ctx.fillStyle = "rgba(0,0,0,0.34)";
    ctx.fillRect(px, py + TILE - 5, TILE, 5);
    ctx.fillRect(px + TILE - 4, py, 4, TILE);
    // Left rim light
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(px, py, 2, TILE);
    // Mortar
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 16, py + lipH);
    ctx.lineTo(px + 16, py + TILE);
    ctx.moveTo(px + 1, py + 19);
    ctx.lineTo(px + TILE - 1, py + 19);
    ctx.stroke();
    // Surface grit
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.fillRect(px + 3 + n, py + 10, 4, 2);
    ctx.fillRect(px + 19 - (n % 3), py + 23, 5, 2);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(px + 10 + (n % 2), py + 14, 3, 2);
    if (crumbly) {
      ctx.strokeStyle = "rgba(20,10,6,0.55)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px + 6, py + 9);
      ctx.lineTo(px + 10, py + 20);
      ctx.lineTo(px + 8, py + 28);
      ctx.moveTo(px + 20, py + 8);
      ctx.lineTo(px + 24, py + 18);
      ctx.stroke();
      ctx.fillStyle = "rgba(20,10,6,0.4)";
      ctx.fillRect(px + 12, py + 15, 3, 7);
    }
  }

  function drawIceFace(px, py) {
    const pal = themeBricks("i");
    drawBrickFace(px, py, pal[0], pal[1], false);
    ctx.fillStyle = "rgba(180,220,255,0.22)";
    ctx.fillRect(px + 2, py + 8, TILE - 4, TILE - 12);
    ctx.strokeStyle = "rgba(240,250,255,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 6, py + 12);
    ctx.lineTo(px + 14, py + 20);
    ctx.moveTo(px + 18, py + 10);
    ctx.lineTo(px + 26, py + 22);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(px + 4, py + 2, 8, 2);
  }

  function drawBouncePad(px, py) {
    const pal = themeBricks("B");
    drawBrickFace(px, py, pal[0], pal[1], false);
    const bounce = 1 + Math.sin(world.time * 9 + px) * 0.08;
    ctx.save();
    ctx.translate(px + 16, py + 18);
    ctx.scale(1, bounce);
    ctx.fillStyle = "#ffd27a";
    ctx.fillRect(-11, -5, 22, 10);
    ctx.fillStyle = "#fff1b0";
    ctx.fillRect(-8, -3, 10, 2);
    ctx.fillStyle = "#c45a18";
    ctx.fillRect(-9, 2, 18, 2);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,200,120,0.45)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px + 8, py + 24);
    ctx.quadraticCurveTo(px + 12, py + 20, px + 16, py + 24);
    ctx.quadraticCurveTo(px + 20, py + 28, px + 24, py + 24);
    ctx.stroke();
  }

  function drawSpikeOne(bx, by, dir, pulse) {
    ctx.save();
    ctx.translate(bx + 8, by + 16);
    ctx.scale(pulse, pulse);
    ctx.translate(-8, -16);
    // Shadow body
    ctx.fillStyle = "#120c0a";
    ctx.beginPath();
    if (dir === "up") { ctx.moveTo(0, TILE + 1); ctx.lineTo(8, 2); ctx.lineTo(16, TILE + 1); }
    else if (dir === "down") { ctx.moveTo(0, -1); ctx.lineTo(8, TILE - 2); ctx.lineTo(16, -1); }
    else if (dir === "left") { ctx.moveTo(TILE + 1, 0); ctx.lineTo(2, 8); ctx.lineTo(TILE + 1, 16); }
    else { ctx.moveTo(-1, 0); ctx.lineTo(TILE - 2, 8); ctx.lineTo(-1, 16); }
    ctx.fill();
    // Metal face
    ctx.fillStyle = "#efe8df";
    ctx.beginPath();
    if (dir === "up") { ctx.moveTo(2.5, TILE - 1); ctx.lineTo(8, 4); ctx.lineTo(13.5, TILE - 1); }
    else if (dir === "down") { ctx.moveTo(2.5, 1); ctx.lineTo(8, TILE - 4); ctx.lineTo(13.5, 1); }
    else if (dir === "left") { ctx.moveTo(TILE - 1, 2.5); ctx.lineTo(4, 8); ctx.lineTo(TILE - 1, 13.5); }
    else { ctx.moveTo(1, 2.5); ctx.lineTo(TILE - 4, 8); ctx.lineTo(1, 13.5); }
    ctx.fill();
    // Inner bevel
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    if (dir === "up") { ctx.moveTo(4, TILE - 2); ctx.lineTo(8, 7); ctx.lineTo(8.8, TILE - 2); }
    else if (dir === "down") { ctx.moveTo(4, 2); ctx.lineTo(8, TILE - 7); ctx.lineTo(8.8, 2); }
    else { ctx.moveTo(8, 4); ctx.lineTo(7, 8); ctx.lineTo(8, 12); }
    ctx.fill();
    // Blood tip
    ctx.fillStyle = "#e31b1b";
    ctx.beginPath();
    if (dir === "up") { ctx.moveTo(6.2, 13); ctx.lineTo(8, 3); ctx.lineTo(9.8, 13); }
    else if (dir === "down") { ctx.moveTo(6.2, 19); ctx.lineTo(8, TILE - 3); ctx.lineTo(9.8, 19); }
    else if (dir === "left") { ctx.moveTo(13, 6.2); ctx.lineTo(3, 8); ctx.lineTo(13, 9.8); }
    else { ctx.moveTo(3, 6.2); ctx.lineTo(TILE - 3, 8); ctx.lineTo(3, 9.8); }
    ctx.fill();
    // Base collar
    ctx.fillStyle = "#2a2018";
    if (dir === "up") ctx.fillRect(1, TILE - 4, 14, 3);
    else if (dir === "down") ctx.fillRect(1, 1, 14, 3);
    else if (dir === "left") ctx.fillRect(TILE - 4, 1, 3, 14);
    else ctx.fillRect(1, 1, 3, 14);
    ctx.restore();
  }

  function drawSpikePair(px, py, dir) {
    const pulse = 1 + Math.sin(world.time * 10 + px * 0.2) * 0.035;
    drawSpikeOne(px, py, dir, pulse);
    drawSpikeOne(px + 16, py, dir, pulse);
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
    const wind = (world && world.wind) || 0;
    if (weather === "ember") {
      for (let i = 0; i < 48; i++) {
        const n = frac(i * 5.7);
        const x = (frac(i * 11.3) * VIEW_W + t * (8 + n * 18) + wind * 30) % VIEW_W;
        const y = (VIEW_H + 40 - ((t * (30 + n * 50) + n * 400) % (VIEW_H + 80)));
        const a = 0.28 + n * 0.4 + pulse * 0.12;
        ctx.fillStyle = `rgba(${220 + n * 35},${80 + n * 80},40,${a})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.2 + n * 2.2 + pulse * 0.4, 0, Math.PI * 2);
        ctx.fill();
        if (n > 0.72) {
          ctx.globalAlpha = a * 0.35;
          ctx.beginPath();
          ctx.arc(x, y, 4 + n * 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    } else if (weather === "snow") {
      for (let i = 0; i < 78; i++) {
        const n = frac(i * 8.1);
        const drift = Math.sin(t * 0.6 + i) * 18 + wind * 40;
        const x = (frac(i * 3.9) * VIEW_W + drift) % VIEW_W;
        const y = (t * (18 + n * 28) + n * 900) % (VIEW_H + 20);
        ctx.fillStyle = `rgba(230,240,255,${0.3 + n * 0.5})`;
        const s = n > 0.8 ? 3 : 1.4;
        ctx.fillRect(x, y, s, s);
        if (n > 0.9) {
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.fillRect(x - 1, y - 1, 1, 1);
        }
      }
    } else if (weather === "spores") {
      for (let i = 0; i < 42; i++) {
        const n = frac(i * 6.4);
        const x = (frac(i * 14.2) * VIEW_W + Math.sin(t * 0.4 + i) * 40 + wind * 20) % VIEW_W;
        const y = (frac(i * 9.8) * VIEW_H + Math.cos(t * 0.3 + i) * 24) % VIEW_H;
        ctx.fillStyle = `rgba(${ar},${ag},${ab},${0.1 + n * 0.22 + pulse * 0.05})`;
        ctx.beginPath();
        ctx.arc(x, y, 3 + n * 6 + pulse * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (weather === "sparks") {
      for (let i = 0; i < 34; i++) {
        const n = frac(i * 4.4);
        const life = (t * (90 + n * 140) + n * 500) % (VIEW_H + 80);
        const x = (frac(i * 17.1) * VIEW_W + wind * 20) % VIEW_W;
        ctx.strokeStyle = `rgba(255,${180 + n * 60},60,${0.45 + heat * 0.35 + pulse * 0.1})`;
        ctx.lineWidth = 1.2 + (n > 0.8 ? 0.6 : 0);
        ctx.beginPath();
        ctx.moveTo(x, VIEW_H - life);
        ctx.lineTo(x + (n - 0.5) * 12, VIEW_H - life - 10 - n * 16);
        ctx.stroke();
      }
    } else if (weather === "rain") {
      ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.28)`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 100; i++) {
        const n = frac(i * 2.2);
        const x = (frac(i * 19) * VIEW_W + t * (40 + wind * 50)) % VIEW_W;
        const y = (t * (280 + n * 120) + n * 700) % (VIEW_H + 30);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 4 + wind * 2, y + 12 + n * 10);
        ctx.stroke();
      }
      // Ground splash ticks near the bottom band.
      ctx.fillStyle = `rgba(${ar},${ag},${ab},0.18)`;
      for (let i = 0; i < 12; i++) {
        const n = frac(i * 7.7 + t * 3);
        if (n > 0.55) continue;
        const x = frac(i * 13.1 + t * 0.4) * VIEW_W;
        ctx.fillRect(x, VIEW_H - 18 - n * 8, 2, 2);
      }
    } else if (weather === "static") {
      if (((t * 24) | 0) % 7 === 0) {
        ctx.fillStyle = `rgba(${ar},${ag},${ab},0.05)`;
        for (let i = 0; i < 18; i++) {
          ctx.fillRect(frac(t * 9 + i) * VIEW_W, frac(t * 5 + i * 3) * VIEW_H, 40 + frac(i) * 80, 2);
        }
      }
      if (((t * 11) | 0) % 13 === 0) {
        ctx.fillStyle = `rgba(${ar},${ag},${ab},0.04)`;
        ctx.fillRect(0, frac(t * 2.3) * VIEW_H, VIEW_W, 3);
      }
    } else {
      for (let i = 0; i < 40; i++) {
        const n = frac(i * 7.3);
        const speed = 22 + n * 50;
        const life = (t * speed + n * 800) % (VIEW_H + 140);
        const x = (frac(i * 21.9) * VIEW_W + wind * 25) % VIEW_W;
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
    // Trap heat + later dims push the void into a denser trip.
    const dim = world.dim || 1;
    const trip = Math.min(0.85, 0.32 + heat * 0.28 + Math.max(0, dim - 1) * 0.015);
    if (window.SURGE_VOID && window.SURGE_VOID.draw) {
      const titleIdle = mode === "title" || mode === "levels";
      window.SURGE_VOID.draw({
        ctx, w: VIEW_W, h: VIEW_H, t, theme: th, pulse, heat, trip,
        floorShade: true, bolt: true,
        // Title: reuse cached sky frames while dim/theme unchanged (~20Hz refresh).
        reuseMs: titleIdle ? 50 : 0,
      });
      return;
    }
    // Fallback if void-sky.js failed to load.
    const skyCols = th.sky || ["#0b1018", "#07090f", "#04050a"];
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, skyCols[0]);
    sky.addColorStop(1, skyCols[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function drawTile(t, x, y) {
    const px = x * TILE;
    const py = y * TILE;
    if (t === "i") {
      drawIceFace(px, py);
      return;
    }
    if (t === "#" || t === "=" || t === "B" || t === "!") {
      if (t === "B") drawBouncePad(px, py);
      else {
        const pal = themeBricks(t);
        drawBrickFace(px, py, pal[0], pal[1], t === "=");
      }
      if (t === "!") {
        ctx.globalAlpha = 0.18 + Math.sin(world.time * 8 + x) * 0.1;
        drawSpikePair(px, py - 18, "up");
        ctx.globalAlpha = 1;
      }
    } else if (t === "*") {
      // Hollow bait block — thinner, ghosted edges
      ctx.fillStyle = "rgba(74,64,56,0.55)";
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      ctx.strokeStyle = "rgba(207,193,170,0.45)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(px + 5, py + 5, TILE - 10, 3);
    } else if (t === "^") drawSpikePair(px, py, "up");
    else if (t === "v") drawSpikePair(px, py, "down");
    else if (t === "<") drawSpikePair(px, py, "left");
    else if (t === ">") drawSpikePair(px, py, "right");
  }

  function drawDoorShell(x, y, fake) {
    const pulseT = mode === "play" ? world.time : performance.now() / 1000;
    const pulse = 0.55 + Math.sin(pulseT * 5) * 0.45;
    const qPulse = (pulse * 20) | 0;
    ctx.save();
    // Aura — reuse gradient when door pose / pulse bucket unchanged.
    const auraKey = x + "," + y + "," + (fake ? 1 : 0) + "," + qPulse;
    let aura = doorGradCache.aura;
    if (doorGradCache.key !== auraKey || doorGradCache.x !== x || doorGradCache.y !== y) {
      aura = ctx.createRadialGradient(x + 18, y + 28, 6, x + 18, y + 28, 34);
      aura.addColorStop(0, fake ? `rgba(255,80,80,${0.2 + pulse * 0.12})` : `rgba(255,200,80,${0.18 + pulse * 0.14})`);
      aura.addColorStop(1, "rgba(0,0,0,0)");
      const panel = ctx.createLinearGradient(x + 3, y + 10, x + 33, y + 48);
      panel.addColorStop(0, "rgba(255,255,255,0.12)");
      panel.addColorStop(0.5, "rgba(0,0,0,0)");
      panel.addColorStop(1, "rgba(0,0,0,0.28)");
      doorGradCache.key = auraKey;
      doorGradCache.aura = aura;
      doorGradCache.panel = panel;
      doorGradCache.x = x;
      doorGradCache.y = y;
    }
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(x + 18, y + 28, 34, 0, Math.PI * 2);
    ctx.fill();
    // Pedestal
    ctx.fillStyle = "#1a1008";
    ctx.fillRect(x - 4, y + 46, 44, 7);
    ctx.fillStyle = "#3a2814";
    ctx.fillRect(x - 2, y + 46, 40, 3);
    // Frame / roof
    ctx.fillStyle = "#e8c25a";
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 14);
    ctx.lineTo(x + 18, y - 10);
    ctx.lineTo(x + 39, y + 14);
    ctx.lineTo(x + 39, y + 50);
    ctx.lineTo(x - 3, y + 50);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.moveTo(x - 1, y + 14);
    ctx.lineTo(x + 18, y - 6);
    ctx.lineTo(x + 20, y + 14);
    ctx.closePath();
    ctx.fill();
    // Door face
    ctx.fillStyle = fake ? "#6e1414" : "#c41e1e";
    ctx.fillRect(x + 3, y + 10, 30, 38);
    ctx.fillStyle = doorGradCache.panel;
    ctx.fillRect(x + 3, y + 10, 30, 38);
    // Windows
    ctx.fillStyle = "#4a0c0c";
    ctx.fillRect(x + 7, y + 15, 8, 11);
    ctx.fillRect(x + 21, y + 15, 8, 11);
    ctx.fillStyle = fake ? "rgba(255,120,80,0.35)" : "rgba(255,230,140,0.55)";
    ctx.fillRect(x + 8, y + 16, 6, 3);
    ctx.fillRect(x + 22, y + 16, 6, 3);
    // Trim + knob
    ctx.fillStyle = "#fff1a8";
    ctx.fillRect(x + 4, y + 10, 28, 3);
    ctx.fillStyle = "#f0c14b";
    ctx.beginPath();
    ctx.arc(x + 27, y + 34, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff6d0";
    ctx.beginPath();
    ctx.arc(x + 26.4, y + 33.4, 1, 0, Math.PI * 2);
    ctx.fill();
    // Rivets
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(x + 5, y + 44, 2, 2);
    ctx.fillRect(x + 29, y + 44, 2, 2);
    if (fake) {
      ctx.strokeStyle = "rgba(255,60,60,0.45)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(x + 4, y + 12, 28, 34);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // Afterimages only. Newest copy is already faint, then it eases out to nothing.
  function trailAlpha(life, max) {
    const u = max > 0 ? life / max : 0;
    if (u <= 0) return 0;
    const t = u > 1 ? 1 : u;
    return 0.2 * t * t;
  }

  function drawNullGhost(g, t, accent, look, S, alpha) {
    if (alpha <= 0.01) return;
    const pack = window.SURGE_BOSS_FORMS;
    if (!pack || !pack.paint) return;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.translate(g.x, g.y);
    ctx.rotate(g.rot || 0);
    ctx.scale(S / 200, S / 200);
    // Low-alpha trails blit a cached silhouette; the live boss still paints full animated form.
    if (pack.paintCached) {
      pack.paintCached(ctx, g.dim || 1, t, g.grab || 0, accent, look, {
        face: g.face || "fight",
        phase: "fight",
      }, alpha);
    } else {
      ctx.globalAlpha = alpha;
      pack.paint(ctx, g.dim || 1, t, g.grab || 0, accent, look, {
        face: g.face || "fight",
        phase: "fight",
      });
    }
    ctx.restore();
  }

  function drawBoss() {
    const b = world.boss;
    if (!b || !world.door) return;
    const door = world.door;
    const pack = window.SURGE_WORLDS;
    const th = (pack && pack.theme && pack.theme(b.dim || 1)) || currentTheme();
    const accent = th.accent || [255, 196, 120];
    const t = world.time || 0;
    const grab = b.visGrab || 0;
    const ar = accent[0] | 0;
    const ag = accent[1] | 0;
    const ab = accent[2] | 0;
    if (b._colR !== ar || b._colG !== ag || b._colB !== ab || !b._col) {
      b._colR = ar; b._colG = ag; b._colB = ab;
      b._col = "rgb(" + ar + "," + ag + "," + ab + ")";
    }
    const col = b._col;
    const S = b.dim === 1 ? 270 : 248;
    const phase = b.phase || "fight";
    drawBossShots(b.dim === 1 ? "#ff2f86" : col);
    if (b.dim === 1) drawNullFx(b);
    else drawKitFx(b, col);

    if (phase === "gone") {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "#1a0c08";
      ctx.fillRect(b.x - 36, door.y + TILE - 10, 72, 8);
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(b.x - 10, door.y + TILE - 16, 8, 8);
      ctx.fillRect(b.x + 6, door.y + TILE - 14, 6, 6);
      ctx.restore();
      return;
    }

    if (phase === "boom") {
      const rad = b.dim === 1 ? Math.min(250, 70 + b.boom * 520) : Math.min(156, 52 + b.boom * 380);
      const n = 10;
      ctx.save();
      ctx.fillStyle = col;
      ctx.globalAlpha = Math.max(0.15, 1 - b.boom);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + b.boom * 6;
        const s = 16 + (i % 3) * 10;
        const x = b.x + Math.cos(a) * rad;
        const y = b.y + 20 + Math.sin(a) * rad * 0.62;
        if (b.dim === 1) {
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        } else {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(a + i);
          kitStamp(b.look, 0, 0, s * 0.38);
          ctx.restore();
        }
      }
      ctx.fillStyle = "#fff6d0";
      ctx.globalAlpha = Math.max(0, 1 - b.boom * 1.4);
      ctx.fillRect(b.x - 18, b.y + 4, 36, 36);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(b.x, door.y + TILE - 3, 62, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (b.tell && !b.tell.preview) {
      const pulse = 0.4 + Math.sin(t * 30) * 0.4;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = "#fff6d0";
      ctx.lineWidth = 3;
      ctx.strokeRect(b.tell.tx * TILE + 3, b.tell.ty * TILE + 3, (b.tell.tw || 1) * TILE - 6, (b.tell.th || 1) * TILE - 6);
      ctx.restore();
    }

    if ((phase === "fight" || phase === "rage") && Math.abs(b.slip || 0) > 0.45) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.35, Math.abs(b.slip) * 0.12);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(b.x - (b.slip || 0) * 4, b.y + 28, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const reaching = bossReaching(b);
    if (b.dim !== 1 && reaching) {
      ctx.save();
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.22 + grab * 0.65;
      ctx.lineWidth = 3 + grab * 5;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + 36);
      const mx = (b.x + door.x + 16) * 0.5 + Math.sin(t * 16) * 8 * Math.max(grab, 0.15);
      const my = (b.y + 36 + door.y) * 0.5 + 10;
      ctx.quadraticCurveTo(mx, my, door.x + 16, door.y + 8);
      ctx.stroke();
      ctx.restore();
    }

    if (b.attack > 0.15 && (b.dim === 1 || reaching)) {
      ctx.save();
      ctx.globalAlpha = 0.35 + b.attack * 0.45;
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.strokeRect(door.x - 6, door.y - 8, 44, 52);
      ctx.restore();
    }

    if (reaching) {
      const gx = b.x + (door.x + 16 - b.x) * grab;
      const gy = b.y + 24 + (door.y + 6 - b.y) * grab;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(Math.sin(t * 22) * 0.18);
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.92;
      const look = b.look || "";
      ctx.beginPath();
      if (b.dim === 1 || !look) {
        ctx.moveTo(-18, 2);
        ctx.lineTo(-8, -16);
        ctx.lineTo(0, -4);
        ctx.lineTo(8, -16);
        ctx.lineTo(18, 2);
        ctx.lineTo(0, 12);
      } else if (look === "petal" || look === "wisp") {
        ctx.moveTo(-16, 6);
        ctx.quadraticCurveTo(-20, -14, -4, -8);
        ctx.quadraticCurveTo(0, -20, 4, -8);
        ctx.quadraticCurveTo(20, -14, 16, 6);
        ctx.lineTo(0, 12);
      } else if (look === "gear") {
        ctx.moveTo(-16, 4);
        ctx.lineTo(-16, -12);
        ctx.lineTo(-8, -12);
        ctx.lineTo(-8, -2);
        ctx.lineTo(8, -2);
        ctx.lineTo(8, -12);
        ctx.lineTo(16, -12);
        ctx.lineTo(16, 4);
        ctx.lineTo(0, 12);
      } else if (look === "ice" || look === "shard" || look === "salt") {
        ctx.moveTo(0, -18);
        ctx.lineTo(8, -4);
        ctx.lineTo(16, 6);
        ctx.lineTo(0, 12);
        ctx.lineTo(-16, 6);
        ctx.lineTo(-8, -4);
      } else if (look === "spark" || look === "zap") {
        ctx.moveTo(-14, 8);
        ctx.lineTo(-4, -16);
        ctx.lineTo(0, -2);
        ctx.lineTo(6, -14);
        ctx.lineTo(14, 6);
        ctx.lineTo(0, 12);
      } else if (look === "bone" || look === "needle") {
        ctx.moveTo(-14, 2);
        ctx.lineTo(-18, -8);
        ctx.lineTo(-6, -6);
        ctx.lineTo(0, -16);
        ctx.lineTo(6, -6);
        ctx.lineTo(18, -8);
        ctx.lineTo(14, 2);
        ctx.lineTo(0, 12);
      } else if (look === "red" || look === "star" || look === "ray") {
        ctx.moveTo(-6, 8);
        ctx.lineTo(0, -18);
        ctx.lineTo(6, 8);
        ctx.lineTo(18, 4);
        ctx.lineTo(0, 14);
        ctx.lineTo(-18, 4);
      } else {
        ctx.moveTo(-18, 2);
        ctx.lineTo(-8, -16);
        ctx.lineTo(0, -4);
        ctx.lineTo(8, -16);
        ctx.lineTo(18, 2);
        ctx.lineTo(0, 12);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const flameBoss = (b.dim | 0) === 1;
    if (b.ghosts && b.ghosts.length) {
      const look = b.dim === 1 ? (b.gaze || 0) : (door.x + 16 >= b.x ? 1 : -1);
      for (let i = 0; i < b.ghosts.length; i++) {
        const g = b.ghosts[i];
        drawNullGhost(g, t, accent, g.gaze != null ? g.gaze : look, S, trailAlpha(g.life, g.max));
      }
    }

    ctx.save();
    const jitter = flameBoss ? 0 : (b.mood || 0) * Math.sin(t * 11) * 2.2;
    ctx.translate(b.x + jitter, b.y + (flameBoss ? grab * 6 : grab * 18) + Math.sin(t * 1.35) * (flameBoss ? 1.2 : 4));
    ctx.rotate((b.rot || 0) + (b.visLean || 0));
    const squash = 1 + grab * 0.16 + (phase === "rage" ? 0.1 : 0);
    const sag = phase === "fall" ? 0.22 : 0;
    const smear = flameBoss ? Math.max(-0.16, Math.min(0.22, (b.slip || 0) * 0.035)) : 0;
    ctx.scale((S / 200) * squash * (1 + Math.abs(smear)), (S / 200) * (1 - grab * 0.08 - sag) * (1 - Math.abs(smear) * 0.55));
    paintBossBody(b.dim || 1, t, grab, accent, b.dim === 1 ? (b.gaze || 0) : (door.x + 16 >= b.x ? 1 : -1));
    ctx.restore();
    if (flameBoss && grab > 0.12 && (phase === "intro" || phase === "fight" || phase === "rage")) {
      drawNullHands(b, door, t, grab);
    }
  }

  function nullHandPoint(b, t, grab, side, out) {
    const sc = 270 / 200;
    const phase = side < 0 ? 0 : 1.7;
    const lift = Math.sin(t * 6.8 + phase) * 7 + (b.face === "scared" ? -12 : 0) + grab * 10;
    const pt = out || HAND_PT;
    pt.x = b.x + side * 1.05 * 58 * sc;
    pt.y = b.y + grab * 6 + (0.32 * 58 + lift) * sc;
    return pt;
  }

  function drawFlameRibbon(x0, y0, cx, cy, x1, y1, width) {
    const n = RIBBON_N;
    const pts = RIBBON_PTS;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
      const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
      const t2 = Math.min(1, t + 0.08);
      const u2 = 1 - t2;
      const x2 = u2 * u2 * x0 + 2 * u2 * t2 * cx + t2 * t2 * x1;
      const y2 = u2 * u2 * y0 + 2 * u2 * t2 * cy + t2 * t2 * y1;
      const len = Math.hypot(x2 - x, y2 - y) || 1;
      const p = pts[i];
      p.x = x;
      p.y = y;
      p.nx = -(y2 - y) / len;
      p.ny = (x2 - x) / len;
      p.w = width * (0.28 + (1 - t) * 0.9);
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x + pts[0].nx * pts[0].w, pts[0].y + pts[0].ny * pts[0].w);
    for (let i = 1; i <= n; i++) ctx.lineTo(pts[i].x + pts[i].nx * pts[i].w, pts[i].y + pts[i].ny * pts[i].w);
    for (let i = n; i >= 0; i--) ctx.lineTo(pts[i].x - pts[i].nx * pts[i].w, pts[i].y - pts[i].ny * pts[i].w);
    ctx.closePath();
    ctx.fill();
  }

  function drawNullHands(b, door, t, grab) {
    const x1 = door.x + 16;
    const y1 = door.y + 10;
    ctx.save();
    for (let si = 0; si < 2; si++) {
      const side = SIDE_PAIR[si];
      const handPt = nullHandPoint(b, t, grab, side, HAND_PT);
      const hx = handPt.x;
      const hy = handPt.y;
      const wob = Math.sin(t * 16 + side) * 18;
      const cx = (hx + x1) * 0.5 + wob * side;
      const cy = (hy + y1) * 0.5 + 20;
      ctx.fillStyle = "#fe92b8";
      ctx.globalAlpha = 0.55;
      drawFlameRibbon(hx, hy, cx, cy, x1, y1, 16);
      ctx.fillStyle = "#fe1f6f";
      ctx.globalAlpha = 0.72;
      drawFlameRibbon(hx, hy, cx, cy + 6, x1, y1, 8);
      ctx.fillStyle = "#fff0f6";
      ctx.globalAlpha = 0.5;
      drawFlameRibbon(hx, hy, cx, cy + 4, x1, y1, 3.2);
    }
    ctx.restore();
  }

  function paintBossBody(dim, t, grab, accent, look) {
    const pack = window.SURGE_BOSS_FORMS;
    if (!pack || !pack.paint) return;
    pack.paint(ctx, dim | 0, t, grab, accent, look, world.boss);
  }

  function drawDoor(d) {
    if (!d || world.doorHidden) return;
    let pop = 1;
    if (!d.fake && !player.dead && mode === "play") {
      const dx = (player.x + player.w / 2) - (d.x + 16);
      const dy = (player.y + 10) - (d.y + 8);
      const dist = Math.sqrt(dx * dx + dy * dy);
      pop = 1 + Math.max(0, 1 - dist / 150) * 0.14;
    }
    const ax = d.x + 16;
    const ay = d.y + 8;
    ctx.save();
    let flyX = 1;
    let flyY = 1;
    const drop = world.boss && world.boss.dropping && world.boss.drop && d === world.door;
    if (drop) {
      flyX = 0.82;
      flyY = 1.28;
    }
    ctx.translate(ax, ay);
    ctx.scale(pop * flyX, pop * flyY);
    ctx.translate(-ax, -ay);
    drawDoorShell(d.x - 2, d.y - 18, d.fake);
    ctx.restore();
  }


  function drawApexEntity(e) {
    if (e.kind === "reaper") {
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;
      ctx.save();
      ctx.fillStyle = "rgba(20,0,8,0.35)";
      ctx.beginPath();
      ctx.ellipse(cx, e.y + e.h + 2, 16, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#14060c";
      ctx.beginPath();
      ctx.moveTo(cx - 12, e.y + e.h);
      ctx.quadraticCurveTo(cx - 18, cy, cx - 6, e.y + 6);
      ctx.quadraticCurveTo(cx, e.y - 8, cx + 8, e.y + 4);
      ctx.quadraticCurveTo(cx + 16, cy + 4, cx + 10, e.y + e.h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#2a1018";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + 8, cy);
      ctx.quadraticCurveTo(cx + 26, cy - 18, cx + 8, cy - 22);
      ctx.stroke();
      ctx.fillStyle = "#c8c8d0";
      ctx.beginPath();
      ctx.arc(cx + 8, cy - 22, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff2a2a";
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(cx - 2, cy - 2, 2.2, 0, Math.PI * 2);
      ctx.arc(cx + 5, cy - 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return true;
    }
    if (e.kind === "wraith") {
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = "#d8e4ff";
      ctx.beginPath();
      ctx.ellipse(e.x + e.w / 2, e.y + 12, 10, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#eef3ff";
      ctx.fillRect(e.x + 4, e.y + 16, e.w - 8, e.h - 16);
      ctx.fillStyle = "#1a2030";
      ctx.fillRect(e.x + 7, e.y + 10, 3, 5);
      ctx.fillRect(e.x + e.w - 11, e.y + 10, 3, 5);
      ctx.restore();
      return true;
    }
    if (e.kind === "seeker") {
      ctx.save();
      ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
      ctx.fillStyle = "#241838";
      ctx.fillRect(-14, -6, 28, 12);
      ctx.fillStyle = "#6a40c8";
      ctx.fillRect(-10, -4, 20, 4);
      ctx.fillStyle = "#ff40e0";
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(0, 1, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(180,80,255,0.45)";
      ctx.beginPath();
      ctx.moveTo(-22, -8);
      ctx.lineTo(22, -8);
      ctx.stroke();
      ctx.restore();
      return true;
    }
    if (e.kind === "sweep") {
      ctx.save();
      ctx.fillStyle = "rgba(255,40,40,0.85)";
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.fillRect(e.x, e.y, e.w, e.h);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff1a8";
      ctx.fillRect(e.x + 4, e.y + 2, e.w - 8, 2);
      ctx.restore();
      return true;
    }
    return false;
  }

  function drawEntities() {
    for (const e of world.entities) {
      if (drawApexEntity(e)) continue;
      if (e.kind === "stalker") {
        const cx = e.x + e.w / 2;
        const cy = e.y + e.h / 2;
        const wobble = Math.sin(world.time * 8 + e.x) * 1.5;
        ctx.save();
        // Smoke trail
        ctx.fillStyle = "rgba(40,0,20,0.35)";
        ctx.beginPath();
        ctx.ellipse(cx - 10, cy + 4, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "#14060c";
        ctx.beginPath();
        ctx.moveTo(cx - 11, cy + 10 + wobble);
        ctx.quadraticCurveTo(cx - 16, cy - 4, cx - 4, cy - 12);
        ctx.quadraticCurveTo(cx + 2, cy - 16, cx + 8, cy - 10);
        ctx.quadraticCurveTo(cx + 16, cy - 2, cx + 12, cy + 12 + wobble);
        ctx.quadraticCurveTo(cx + 2, cy + 16, cx - 11, cy + 10 + wobble);
        ctx.fill();
        // Horn nubs
        ctx.fillStyle = "#2a1018";
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy - 10); ctx.lineTo(cx - 9, cy - 18); ctx.lineTo(cx - 2, cy - 12);
        ctx.moveTo(cx + 4, cy - 10); ctx.lineTo(cx + 9, cy - 18); ctx.lineTo(cx + 1, cy - 12);
        ctx.fill();
        // Eyes
        const eyePulse = 2.2 + Math.sin(world.time * 14) * 0.4;
        ctx.fillStyle = "#ff2a2a";
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(cx - 4, cy - 2, eyePulse, 0, Math.PI * 2);
        ctx.arc(cx + 5, cy - 2, eyePulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff0f0";
        ctx.fillRect(cx - 5, cy - 3, 1.5, 1.5);
        ctx.fillRect(cx + 4, cy - 3, 1.5, 1.5);
        ctx.fillStyle = "rgba(227,27,27,0.28)";
        ctx.beginPath();
        ctx.ellipse(cx, e.y + e.h + 3, 15, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (e.kind === "drone") {
        ctx.save();
        ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
        ctx.rotate(Math.sin(e.spin) * 0.1);
        // Rotor blur
        ctx.strokeStyle = "rgba(180,200,220,0.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-22, -7); ctx.lineTo(22, -7);
        ctx.moveTo(-18, -10); ctx.lineTo(18, -4);
        ctx.stroke();
        // Body shell
        ctx.fillStyle = "#2a3038";
        ctx.beginPath();
        ctx.moveTo(-13, -5); ctx.lineTo(13, -5); ctx.lineTo(11, 7); ctx.lineTo(-11, 7);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#5a6570";
        ctx.fillRect(-10, -3, 20, 4);
        // Lens
        ctx.fillStyle = "#1a0808";
        ctx.beginPath();
        ctx.arc(0, 2, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff3030";
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(0, 2, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(-0.8, 1.2, 0.8, 0, Math.PI * 2);
        ctx.fill();
        // Antenna
        ctx.strokeStyle = "#8a95a0";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(8, -5); ctx.lineTo(12, -12);
        ctx.stroke();
        ctx.fillStyle = "#e31b1b";
        ctx.beginPath();
        ctx.arc(12, -12, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (e.kind === "rocket") {
        ctx.save();
        ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
        ctx.rotate(Math.atan2(e.vy || 0, e.vx || 1));
        // Exhaust
        const flicker = 0.7 + Math.sin(world.time * 40) * 0.3;
        ctx.fillStyle = `rgba(255,140,40,${0.55 * flicker})`;
        ctx.beginPath();
        ctx.moveTo(-14, 0); ctx.lineTo(-28 - flicker * 6, -5); ctx.lineTo(-28 - flicker * 6, 5);
        ctx.fill();
        ctx.fillStyle = `rgba(255,230,120,${0.7 * flicker})`;
        ctx.beginPath();
        ctx.moveTo(-14, 0); ctx.lineTo(-22 - flicker * 3, -2.5); ctx.lineTo(-22 - flicker * 3, 2.5);
        ctx.fill();
        // Body
        ctx.fillStyle = "#d8cfc2";
        ctx.fillRect(-14, -5, 22, 10);
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(-12, -4, 16, 3);
        ctx.fillStyle = "#6a6560";
        ctx.fillRect(-4, -5, 3, 10);
        // Nose
        ctx.fillStyle = "#e31b1b";
        ctx.beginPath();
        ctx.moveTo(8, -5); ctx.lineTo(18, 0); ctx.lineTo(8, 5);
        ctx.fill();
        ctx.fillStyle = "#ff6a6a";
        ctx.beginPath();
        ctx.moveTo(8, -3); ctx.lineTo(14, 0); ctx.lineTo(8, 1);
        ctx.fill();
        // Fins
        ctx.fillStyle = "#8a4030";
        ctx.beginPath();
        ctx.moveTo(-10, -5); ctx.lineTo(-16, -11); ctx.lineTo(-6, -5);
        ctx.moveTo(-10, 5); ctx.lineTo(-16, 11); ctx.lineTo(-6, 5);
        ctx.fill();
        ctx.restore();
      } else if (e.kind === "watcher") {
        const open = 0.28 + e.open * 0.72;
        const mad = e.charge > 0.2;
        ctx.save();
        ctx.translate(e.x, e.y);
        // Lid / socket
        ctx.fillStyle = "#1a0e0e";
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 9 * open + 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#3a2020";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 8 * open + 1, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Globe
        ctx.fillStyle = mad ? "#ff3a3a" : "#f4ead8";
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 4.5 * open, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#140808";
        ctx.beginPath();
        ctx.ellipse(Math.sin(world.time * 2) * 1.2, 0.3, 2.4, 2.8 * open, 0, 0, Math.PI * 2);
        ctx.fill();
        if (mad) {
          ctx.strokeStyle = `rgba(255,60,60,${0.4 + e.charge * 0.6})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, 18 + e.charge * 12, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      } else if (e.kind === "sentry") {
        ctx.save();
        const facingLeft = e.side >= 0;
        // Mount plate
        ctx.fillStyle = "#2a2e36";
        ctx.fillRect(e.x - 2, e.y + 2, e.w + 4, e.h - 2);
        ctx.fillStyle = "#4a5160";
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fillRect(e.x + 2, e.y + 2, e.w - 4, 4);
        // Optic
        ctx.fillStyle = "#1a1e24";
        ctx.fillRect(e.x + 3, e.y + 5, 12, 8);
        ctx.fillStyle = "#ff3030";
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(e.x + 9, e.y + 9, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Barrel
        const bx = facingLeft ? e.x - 10 : e.x + e.w;
        ctx.fillStyle = "#6a7080";
        ctx.fillRect(bx, e.y + 8, 10, 5);
        ctx.fillStyle = "#e31b1b";
        ctx.fillRect(facingLeft ? bx : bx + 7, e.y + 9, 3, 3);
        // Rivets
        ctx.fillStyle = "#8a90a0";
        ctx.fillRect(e.x + 2, e.y + e.h - 5, 2, 2);
        ctx.fillRect(e.x + e.w - 4, e.y + e.h - 5, 2, 2);
        ctx.restore();
      } else if (e.kind === "bolt") {
        const a = Math.min(1, e.life * 2);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = "rgba(255,60,60,0.25)";
        ctx.fillRect(e.x - 2, e.y - 3, e.w + 4, e.h + 6);
        ctx.fillStyle = "#ff6a6a";
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff2f2";
        ctx.fillRect(e.x + 2, e.y + 1, e.w - 4, 2);
        ctx.restore();
      } else if (e.kind === "swarm") {
        const flap = Math.sin(e.phase * 2) * 5;
        ctx.save();
        ctx.translate(e.x + 6, e.y + 5);
        // Wings
        ctx.fillStyle = "rgba(80,20,40,0.55)";
        ctx.beginPath();
        ctx.ellipse(-7, -2 + flap * 0.2, 7, 3.5, -0.4, 0, Math.PI * 2);
        ctx.ellipse(7, -2 - flap * 0.2, 7, 3.5, 0.4, 0, Math.PI * 2);
        ctx.fill();
        // Body
        ctx.fillStyle = "#1a0810";
        ctx.beginPath();
        ctx.ellipse(0, 0, 5.5, 3.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff2a2a";
        ctx.beginPath();
        ctx.arc(-1.5, -0.5, 1.2, 0, Math.PI * 2);
        ctx.arc(1.5, -0.5, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (e.kind === "phantom") {
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(world.time * 6) * 0.08;
        drawDevilBody(e.x, e.y, e.facing || 1, 0.75, 0, {
          gait: Math.sin(world.time * 10),
          air: false,
          blink: (world.time % 0.5) < 0.12,
        });
        ctx.strokeStyle = "rgba(160,210,255,0.55)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(e.x - 2, e.y - 2, e.w + 4, e.h + 4);
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(160,210,255,0.12)";
        ctx.fillRect(e.x - 2, e.y - 2, e.w + 4, e.h + 4);
        ctx.restore();
      } else if (e.kind === "crushBot") {
        if (e.state === "warn") {
          ctx.fillStyle = `rgba(227,27,27,${0.12 + Math.sin(world.time * 22) * 0.1})`;
          ctx.fillRect(e.x - 6, e.stompY - 5, e.w + 12, 10);
          ctx.strokeStyle = "rgba(255,80,80,0.75)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 4]);
          ctx.strokeRect(e.x - 2, 2, e.w + 4, e.stompY - 2);
          ctx.setLineDash([]);
        }
        ctx.save();
        // Body chassis
        ctx.fillStyle = "#2e323c";
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.fillStyle = "#4a5160";
        ctx.fillRect(e.x + 3, e.y + 3, e.w - 6, 10);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(e.x + 3, e.y + 3, e.w - 6, 3);
        // Eyes
        ctx.fillStyle = "#e31b1b";
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.fillRect(e.x + 7, e.y + 12, 7, 5);
        ctx.fillRect(e.x + e.w - 14, e.y + 12, 7, 5);
        ctx.shadowBlur = 0;
        // Jaw / foot
        ctx.fillStyle = "#1a1e24";
        ctx.fillRect(e.x + 2, e.y + e.h - 12, e.w - 4, 12);
        ctx.fillStyle = "#6a7080";
        ctx.fillRect(e.x + 4, e.y + e.h - 8, e.w - 8, 5);
        ctx.fillStyle = "#e31b1b";
        ctx.fillRect(e.x + 6, e.y + e.h - 5, e.w - 12, 2);
        // Side pistons
        ctx.fillStyle = "#8a90a0";
        ctx.fillRect(e.x - 3, e.y + 16, 3, 18);
        ctx.fillRect(e.x + e.w, e.y + 16, 3, 18);
        ctx.restore();
      }
    }
  }

  function drawBossDrop(d) {
    const look = (world.boss && world.boss.look) || "";
    const x = d.x;
    const y = d.y;
    const w = d.w;
    const h = d.h;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.fillStyle = "#fff6e8";
    if (look === "salt") {
      ctx.fillStyle = "#f4ecd4";
      ctx.beginPath();
      ctx.moveTo(-w * 0.28, h * 0.46);
      ctx.lineTo(-w * 0.18, -h * 0.48);
      ctx.lineTo(w * 0.18, -h * 0.48);
      ctx.lineTo(w * 0.28, h * 0.46);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#c8b98a";
      ctx.fillRect(-w * 0.34, -h * 0.5, w * 0.68, h * 0.16);
      ctx.fillRect(-w * 0.38, h * 0.28, w * 0.76, h * 0.2);
    } else if (look === "ember" || look === "coal" || look === "ray") {
      ctx.fillStyle = look === "ray" ? "#ffd15a" : "#ff5a18";
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.48);
      ctx.lineTo(w * 0.36, h * 0.1);
      ctx.lineTo(w * 0.16, h * 0.46);
      ctx.lineTo(-w * 0.2, h * 0.4);
      ctx.lineTo(-w * 0.38, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff1c8";
      ctx.beginPath();
      ctx.arc(-w * 0.08, -h * 0.08, Math.max(3, w * 0.12), 0, Math.PI * 2);
      ctx.fill();
    } else if (look === "ice" || look === "shard") {
      ctx.fillStyle = "#e7f6ff";
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.5);
      ctx.lineTo(w * 0.32, h * 0.1);
      ctx.lineTo(0, h * 0.48);
      ctx.lineTo(-w * 0.32, h * 0.05);
      ctx.closePath();
      ctx.fill();
    } else if (look === "fold") {
      ctx.fillStyle = "#e4d8ff";
      ctx.beginPath();
      ctx.moveTo(-w * 0.4, -h * 0.2);
      ctx.lineTo(w * 0.1, -h * 0.48);
      ctx.lineTo(w * 0.42, h * 0.1);
      ctx.lineTo(-w * 0.05, h * 0.46);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#6c5c9a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-w * 0.15, -h * 0.34);
      ctx.lineTo(w * 0.18, h * 0.28);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#fff6e8";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      kitStamp(look, 0, 0, Math.min(w, h) * 0.28);
    }
    ctx.restore();
  }

  function drawBossSaw(saw) {
    const look = (world.boss && world.boss.look) || "";
    ctx.save();
    ctx.translate(saw.x, saw.y);
    ctx.rotate(saw.spin || world.time * 6);
    if (look === "petal") {
      ctx.fillStyle = "#e7a0ff";
      for (let i = 0; i < 6; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.ellipse(0, 12, 5, 9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ffe6a8";
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (look === "fold") {
      ctx.fillStyle = "#e4d8ff";
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(6, 16);
        ctx.lineTo(-6, 16);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = "#6c5c9a";
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (look === "bite") {
      ctx.fillStyle = "#e07088";
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(-2, 8);
        ctx.lineTo(0, 16);
        ctx.lineTo(2, 8);
        ctx.fill();
      }
    } else if (look === "coal" || look === "ember") {
      ctx.fillStyle = "#3a241c";
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff5a28";
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(-2, 8);
        ctx.lineTo(0, 18);
        ctx.lineTo(2, 8);
        ctx.fill();
      }
      ctx.fillStyle = "#fff1c8";
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.restore();
      drawSaw(saw);
      return;
    }
    ctx.restore();
  }

  function drawSaw(saw) {
    ctx.save();
    ctx.translate(saw.x, saw.y);
    const chasePulse = saw.chase ? Math.sin(world.time * 14) * 2 : 0;
    const pulse = saw.chase ? 0.38 : 0.2;
    // Danger aura
    const aura = ctx.createRadialGradient(0, 0, 6, 0, 0, 24 + chasePulse);
    aura.addColorStop(0, `rgba(227,27,27,${pulse})`);
    aura.addColorStop(1, "rgba(227,27,27,0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 24 + chasePulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(saw.spin);
    // Teeth
    for (let i = 0; i < 16; i++) {
      ctx.rotate((Math.PI * 2) / 16);
      ctx.fillStyle = i % 2 ? "#f2ebe3" : "#d8d0c6";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(4.5, 15);
      ctx.lineTo(0, 19);
      ctx.lineTo(-4.5, 15);
      ctx.fill();
      ctx.fillStyle = "#e31b1b";
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.lineTo(1.6, 18.5);
      ctx.lineTo(-1.6, 18.5);
      ctx.fill();
    }
    // Hub
    ctx.fillStyle = "#3a3632";
    ctx.beginPath();
    ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6b6560";
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e31b1b";
    ctx.beginPath();
    ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff1a8";
    ctx.beginPath();
    ctx.arc(-1.4, -1.4, 1.3, 0, Math.PI * 2);
    ctx.fill();
    // Bolt marks
    ctx.fillStyle = "#2a2622";
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 5.2, Math.sin(a) * 5.2, 1, 0, Math.PI * 2);
      ctx.fill();
    }
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
    const lean = opts.lean != null ? opts.lean : 0;
    if (lean) ctx.rotate(Math.max(-0.38, Math.min(0.38, lean)));
    const stretch = Math.abs(opts.stretch || 0);
    ctx.scale((facing < 0 ? -1 : 1) * (1 + stretch), (world.gravity < 0 ? -1 : 1) * (1 - stretch * 0.35));
    let sq = squash;
    const sy = 1 - sq * 0.5;
    const sx = 1 + sq * 0.34;
    ctx.scale(sx, sy);
    ctx.translate(-player.w / 2, -player.h / 2);

    const demo = mode === "title" || mode === "levels";
    const gait = opts.gait != null ? opts.gait : (demo ? Math.sin(performance.now() / 140) : Math.sin(player.anim));
    const air = opts.air != null ? opts.air : (demo ? false : !player.onGround);
    const vy = opts.vy != null ? opts.vy : (demo ? 0 : player.vy);
    const speed = opts.speed != null ? opts.speed : (demo ? 3.2 : Math.abs(player.vx || 0));
    const blink = opts.blink != null ? opts.blink : ((demo ? performance.now() / 1000 : world.time) % 3.4) < 0.09;

    // Horns
    ctx.fillStyle = "#1a100c";
    ctx.beginPath();
    ctx.moveTo(3, 9); ctx.lineTo(-2, -7); ctx.lineTo(6, -1); ctx.lineTo(8, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(21, 9); ctx.lineTo(27, -7); ctx.lineTo(18, -1); ctx.lineTo(16, 7);
    ctx.fill();
    ctx.fillStyle = "#e31b1b";
    ctx.beginPath();
    ctx.moveTo(3.5, 8); ctx.lineTo(0.5, -3); ctx.lineTo(5.5, 1);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(20.5, 8); ctx.lineTo(24.5, -3); ctx.lineTo(18.5, 1);
    ctx.fill();

    // Body with volume
    ctx.fillStyle = "#d01818";
    ctx.fillRect(1, 6, 22, 18);
    ctx.fillStyle = "#ff5a5a";
    ctx.fillRect(3, 7, 12, 6);
    ctx.fillStyle = "#9a1010";
    ctx.fillRect(1, 20, 22, 8);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(16, 8, 7, 16);

    // Same cubes and hooves. They just step opposite each other, and tuck or drop in the air.
    const stride = Math.min(1, speed / 3.2);
    const step = air ? 0 : gait * 6 * Math.max(stride, stride > 0.08 ? 0.35 : 0);
    let handL = 15 + step;
    let handR = 15 - step;
    let hoofL = Math.max(-4, Math.min(4, -step * 0.7));
    let hoofR = Math.max(-4, Math.min(4, step * 0.7));
    let shinL = Math.max(0, -step * 0.4);
    let shinR = Math.max(0, step * 0.4);
    if (air) {
      if (vy < -1.2) {
        handL = 6; handR = 8; hoofL = -5; hoofR = -4; shinL = 0; shinR = 0;
      } else if (vy > 1.4) {
        handL = 13; handR = 17; hoofL = 2; hoofR = 3; shinL = 2; shinR = 1;
      } else {
        handL = 8; handR = 10; hoofL = -3; hoofR = -2; shinL = 0; shinR = 0;
      }
    } else if (stride < 0.12) {
      handL = 16; handR = 17; hoofL = 0; hoofR = 0; shinL = 0; shinR = 0;
    }
    ctx.fillStyle = "#e31b1b";
    ctx.fillRect(-5, handL, 6, 6);
    ctx.fillRect(23, handR, 6, 6);
    ctx.fillStyle = "#ff5a5a";
    ctx.fillRect(-4, handL + 1, 2.5, 2.5);
    ctx.fillRect(24, handR + 1, 2.5, 2.5);

    ctx.fillStyle = "#7a0e0e";
    ctx.fillRect(3, 23, 6, 6 + shinL);
    ctx.fillRect(15, 23, 6, 6 + shinR);
    ctx.fillStyle = "#1a100c";
    ctx.fillRect(2, 26 + hoofL, 8, 4);
    ctx.fillRect(14, 26 + hoofR, 8, 4);
    ctx.fillStyle = "#e31b1b";
    ctx.fillRect(2, 29 + hoofL, 3, 1.5);
    ctx.fillRect(14, 29 + hoofR, 3, 1.5);

    // Eyes
    ctx.fillStyle = "#fff6d8";
    ctx.beginPath();
    ctx.ellipse(9, 14, 4.4, 5.4, 0, 0, Math.PI * 2);
    ctx.ellipse(16.5, 14, 4.4, 5.4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (blink) {
      ctx.fillStyle = "#140808";
      ctx.fillRect(5.5, 13.5, 7, 1.6);
      ctx.fillRect(13.2, 13.5, 7, 1.6);
    } else {
      const look = facing > 0 ? 0.7 : -0.3;
      ctx.fillStyle = "#140808";
      ctx.beginPath();
      ctx.ellipse(10 + look, 14.5, 1.6, 2.1, 0, 0, Math.PI * 2);
      ctx.ellipse(17.5 + look, 14.5, 1.6, 2.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e31b1b";
      ctx.fillRect(9.5, 13.3, 1.2, 1.2);
      ctx.fillRect(17, 13.3, 1.2, 1.2);
      ctx.fillStyle = "#fff";
      ctx.fillRect(9.2, 13, 0.8, 0.8);
      ctx.fillRect(16.7, 13, 0.8, 0.8);
    }
    // Grin
    ctx.fillStyle = "#8a0c0c";
    ctx.fillRect(8, 19.2, 9, 2.4);
    ctx.restore();
  }

  function drawContactShadows() {
    const blob = (x, y, rx, ry, a) => {
      ctx.fillStyle = `rgba(0,0,0,${a})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    if (!player.dead) {
      const airK = player.onGround ? 1 : Math.max(0.35, 1 - Math.min(1, Math.abs(player.vy) / 12));
      blob(player.x + player.w / 2, player.y + player.h + 3, 13 * airK, 4.5 * airK, 0.4 * airK);
    }
    for (const saw of world.saws) blob(saw.x, saw.y + 16, 13, 4.2, 0.34);
    for (const coin of world.coins) {
      if (!coin.dead) blob(coin.x, coin.y + 10, 6, 2.4, 0.22);
    }
    if (world.door && !world.doorHidden) blob(world.door.x + 16, world.door.y + 32, 11, 3.4, 0.3);
    for (const e of world.entities || []) {
      if (e.kind === "bolt") continue;
      blob(e.x + (e.w || 16) / 2, e.y + (e.h || 16) + 2, 10, 3.2, 0.28);
    }
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
      const cookie = lightCookie(r, g, b);
      if (cookie) {
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = a;
        ctx.drawImage(cookie, p.x - rad, p.y - rad, rad * 2, rad * 2);
        ctx.globalAlpha = prev;
        return;
      }
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
    for (const e of world.entities || []) {
      if (e.kind === "stalker") light(e.x + e.w / 2, e.y + e.h / 2, 70, 180, 20, 40, 0.28);
      else if (e.kind === "drone") light(e.x + e.w / 2, e.y + e.h / 2, 60, 255, 60, 60, 0.3);
      else if (e.kind === "rocket") light(e.x + e.w / 2, e.y + e.h / 2, 55, 255, 140, 40, 0.35);
      else if (e.kind === "watcher") light(e.x, e.y, 50, 255, 40, 40, 0.25 + (e.charge || 0) * 0.4);
      else if (e.kind === "sentry" || e.kind === "bolt") light(e.x + (e.w || 0) / 2, e.y + 8, 45, 255, 70, 50, 0.28);
      else if (e.kind === "swarm") light(e.x + 6, e.y + 4, 28, 200, 40, 60, 0.18);
      else if (e.kind === "phantom") light(e.x + e.w / 2, e.y + e.h / 2, 55, 140, 200, 255, 0.22);
      else if (e.kind === "crushBot") light(e.x + e.w / 2, e.y + e.h / 2, 80, 255, 50, 40, 0.3);
      else if (e.kind === "reaper") light(e.x + e.w / 2, e.y + e.h / 2, 80, 180, 20, 40, 0.32);
      else if (e.kind === "wraith") light(e.x + e.w / 2, e.y + 10, 60, 180, 200, 255, 0.24);
      else if (e.kind === "seeker") light(e.x + e.w / 2, e.y + 6, 70, 200, 60, 255, 0.3);
      else if (e.kind === "sweep") light(e.x + e.w / 2, e.y + 4, 50, 255, 40, 40, 0.35);
    }
    for (const l of world.lasers) {
      light(l.x + l.w / 2, l.y + l.h / 2, 110, l.fake ? 180 : 255, l.fake ? 220 : 80, l.fake ? 255 : 40, 0.28);
    }
    if (world.door && !world.doorHidden) {
      const pad = bossAmbiencePad();
      light(pad.x + 16, pad.y + 8, 70, 255, 210, 80, 0.18);
    }
    // Scenery lamps / lampposts breathe with the theme accent.
    const scenery = world.scenery || [];
    for (let i = 0; i < scenery.length; i++) {
      const sp = scenery[i];
      if (sp.kind !== "lamppost" && sp.kind !== "lamp" && sp.kind !== "bulb") continue;
      const flicker = 0.82 + Math.sin((world.time || 0) * 6.5 + (sp.phase || 0)) * 0.14
        + Math.sin((world.time || 0) * 17 + (sp.phase || 0) * 2) * 0.04;
      const s = sp.s || 1;
      let lx = sp.x;
      let ly = sp.y;
      let rad = 64;
      if (sp.kind === "lamppost") {
        lx = sp.x + 14 * s * (sp.face < 0 ? -1 : 1);
        ly = sp.y - 42 * s;
        rad = 78;
      } else if (sp.role === "float" || sp.float) {
        ly = sp.y;
        rad = 58;
      } else {
        ly = sp.y + 18 * s;
        rad = 62;
      }
      light(lx, ly, rad, ar, ag, ab, 0.12 * flicker);
    }
    if (nearFlare > 0) {
      light(player.x + player.w / 2, player.y + 10, 240, 255, 240, 200, nearFlare * 1.4);
    }
    ctx.restore();
  }

  function drawDevil() {
    if (player.dead) return;
    for (const a of world.afterimages) {
      drawDevilBody(a.x, a.y + (a.bob || 0), a.facing, trailAlpha(a.life, a.max), a.sq || 0, {
        lean: a.lean || 0,
        gait: Math.sin(a.anim || 0),
        air: Math.abs(a.vy || 0) > 1.4,
        vy: a.vy || 0,
        speed: Math.abs(a.vx || 0),
      });
    }
    const dashStretch = dashT > 0 ? 0.42 : Math.max(-0.08, Math.min(0.16, player.vx * 0.02));
    drawDevilBody(player.x, player.y + (player.bob || 0), player.facing, 1, player.visSq || 0, {
      lean: player.lean || 0,
      stretch: dashStretch,
      vy: player.vy,
      speed: Math.abs(player.vx || 0),
    });
    const [ar, ag, ab] = (currentTheme().accent || [227, 27, 27]);
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = `rgb(${ar},${ag},${ab})`;
    ctx.fillRect(player.x, player.y + (player.bob || 0), player.w, player.h);
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    ctx.lineCap = "round";
    for (const p of world.particles) {
      const u = p.max ? Math.max(0, p.life / p.max) : Math.max(0, p.life);
      ctx.globalAlpha = Math.pow(u, 0.72);
      ctx.strokeStyle = p.color;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      if (p.kind === "streak") {
        const len = Math.min(14, 3 + Math.hypot(p.vx, p.vy) * 1.3);
        const ang = Math.atan2(p.vy, p.vx);
        ctx.rotate(ang);
        ctx.lineWidth = Math.max(1, p.size * u);
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.lineTo(len * 0.25, 0);
        ctx.stroke();
        ctx.rotate(-ang);
      } else if (p.kind === "spark") {
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.4, 0);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size * 0.4, 0);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === "smoke") {
        const r = p.size * (0.7 + (1 - u) * 0.9);
        ctx.globalAlpha = Math.pow(u, 1.1) * 0.45;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(1.5, r), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "ember") {
        ctx.globalAlpha = Math.pow(u, 0.55);
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.8, p.size * u), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = Math.pow(u, 0.8) * 0.35;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "mote") {
        ctx.globalAlpha = Math.pow(u, 0.85) * 0.7;
        ctx.fillRect(-p.size * 0.4, -p.size * 0.4, p.size * 0.8, p.size * 0.8);
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.translate(-p.x, -p.y);
    }
    for (const ring of world.rings || []) {
      const u = Math.max(0, ring.life / (ring.max || 0.3));
      ctx.globalAlpha = (ring.soft ? 0.28 : 0.85) * Math.pow(u, 1.15);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = (ring.w || 2) * (0.35 + u);
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, Math.max(1, ring.r), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
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
    for (let li = 0; li < world.lasers.length; li++) {
      const l = world.lasers[li];
      const a = Math.min(1, l.life * 3);
      const flicker = 0.85 + Math.sin(world.time * 48 + l.x) * 0.15;
      if (l.fake) {
        ctx.globalAlpha = 0.1 * a;
        ctx.fillStyle = "#a0c8ff";
        ctx.fillRect(l.x - 5, l.y - 6, l.w + 10, l.h + 12);
        ctx.globalAlpha = 0.35 * a;
        ctx.fillStyle = "#d2e6ff";
        ctx.fillRect(l.x, l.y, l.w, l.h);
        ctx.globalAlpha = 0.25 * a;
        ctx.fillStyle = "#fff";
        ctx.fillRect(l.x + 1, l.y + 1, Math.max(1, l.w - 2), Math.max(1, Math.min(2, l.h - 2)));
        continue;
      }
      ctx.globalAlpha = 0.2 * a * flicker;
      ctx.fillStyle = "#ff2828";
      ctx.fillRect(l.x - 6, l.y - 6, l.w + 12, l.h + 12);
      ctx.globalAlpha = 0.45 * a;
      ctx.fillStyle = "#ff5050";
      ctx.fillRect(l.x - 2, l.y - 2, l.w + 4, l.h + 4);
      ctx.globalAlpha = 0.92 * a * flicker;
      ctx.fillStyle = "#ffe6e6";
      ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.globalAlpha = 0.7 * a;
      ctx.fillStyle = "#fff";
      if (l.w >= l.h) ctx.fillRect(l.x + 1, l.y + Math.max(0, l.h / 2 - 1), Math.max(1, l.w - 2), 2);
      else ctx.fillRect(l.x + Math.max(0, l.w / 2 - 1), l.y + 1, 2, Math.max(1, l.h - 2));
    }
    ctx.globalAlpha = 1;
  }

  function drawOverlay() {
    if ((world.whiteFlash || 0) > 0) {
      const a = Math.min(1, world.whiteFlash);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.restore();
    }
    if (world.flash > 0) {
      const a = Math.min(0.55, world.flash * 1.6);
      const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.15, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.72);
      g.addColorStop(0, `rgba(255,236,220,${a * 0.35})`);
      g.addColorStop(1, `rgba(227,27,27,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if ((world.blackout || 0) > 0) {
      const rem = world.blackout;
      const max = Math.max(rem, world.blackoutMax || rem);
      const elapsed = Math.max(0, max - rem);
      // Stutter: dark/lit/dark… then settle. Outro: flicker then lights return.
      const stutter = (t, pulses, darkSec, litSec, afterOn) => {
        let u = t;
        for (let i = 0; i < pulses; i++) {
          if (u < darkSec) return 1;
          u -= darkSec;
          if (u < litSec) return 0.05;
          u -= litSec;
        }
        return afterOn ? 1 : 0;
      };
      let darkMul = 1;
      const intro = 1.25;
      const outro = 1.05;
      if (elapsed < intro) darkMul = stutter(elapsed, 4, 0.13, 0.1, true);
      else if (rem < outro) darkMul = stutter(outro - rem, 3, 0.14, 0.12, false);
      if (darkMul > 0.08) {
        const view = camera();
        const px = (player.x + player.w / 2) * view.scale + view.ox;
        const py = (player.y + player.h / 2) * view.scale + view.oy;
        const pulse = 0.06 + Math.sin(world.time * 14) * 0.05;
        const a = Math.min(0.995, 0.92 + Math.min(rem, 8) * 0.01 + pulse) * darkMul;
        const sight = Math.max(4, 9 - Math.min(rem, 5) * 0.9);
        const reach = Math.max(VIEW_W, VIEW_H) * 0.55;
        const g = ctx.createRadialGradient(px, py, sight, px, py, reach);
        g.addColorStop(0, "rgba(0,0,0,0.08)");
        g.addColorStop(0.08, `rgba(0,0,0,${a * 0.72})`);
        g.addColorStop(0.22, `rgba(0,0,0,${a * 0.94})`);
        g.addColorStop(0.55, `rgba(0,0,0,${a})`);
        g.addColorStop(1, `rgba(0,0,0,${a})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.fillStyle = `rgba(4,0,8,${(0.42 + pulse * 1.4) * darkMul})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.fillStyle = `rgba(20,0,28,${(0.16 + Math.sin(world.time * 22) * 0.08) * darkMul})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H * 0.18);
        ctx.fillRect(0, VIEW_H * 0.82, VIEW_W, VIEW_H * 0.18);
      }
    }
    if (world.huntLight && world.time < world.huntLight.until) {
      const view = camera();
      const hx = world.huntLight.x * view.scale + view.ox;
      const hy = (player.y + 8) * view.scale + view.oy;
      const r = world.huntLight.r * view.scale;
      ctx.fillStyle = `rgba(0,0,0,${0.78 + world.huntLight.cold * 0.2})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      const spot = ctx.createRadialGradient(hx, hy, r * 0.15, hx, hy, r);
      spot.addColorStop(0, "rgba(0,0,0,1)");
      spot.addColorStop(0.7, "rgba(0,0,0,0.85)");
      spot.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = spot;
      ctx.beginPath();
      ctx.arc(hx, hy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = `rgba(255,220,140,${0.35 + Math.sin(world.time * 12) * 0.1})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy, r * 0.92, 0, Math.PI * 2);
      ctx.stroke();
    }
    if ((world.voidFog || 0) > 0.02) {
      const view = camera();
      const fogTop = (world.rows * TILE - world.voidFog * world.rows * TILE) * view.scale + view.oy;
      const grad = ctx.createLinearGradient(0, fogTop - 40, 0, VIEW_H);
      grad.addColorStop(0, "rgba(20,0,30,0)");
      grad.addColorStop(0.25, `rgba(40,0,50,${0.35 + world.voidFog * 0.3})`);
      grad.addColorStop(1, `rgba(10,0,16,${0.75 + world.voidFog * 0.2})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, Math.max(0, fogTop - 40), VIEW_W, VIEW_H);
      ctx.fillStyle = `rgba(120,40,160,${0.08 + Math.sin(world.time * 6) * 0.03})`;
      for (let i = 0; i < 6; i++) {
        const wx = ((i * 97 + world.time * 40) % (VIEW_W + 40)) - 20;
        ctx.beginPath();
        ctx.ellipse(wx, fogTop + 20 + (i % 3) * 18, 28, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      }
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
    drawCinema();
    if (roomFade > 0.02 && mode === "play" && !player.dead) {
      ctx.fillStyle = `rgba(5,4,3,${roomFade})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (deathShow && deathShow.t >= 0.55 && mode === "play" && !testMode) {
      const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
      ctx.save();
      ctx.font = "800 13px Rubik, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "rgba(244,234,216,0.78)";
      ctx.fillText(coarse ? "TAP" : "R", VIEW_W / 2, VIEW_H - 18);
      ctx.restore();
    }
  }

  function drawSpeedLines() {
    if (dashT <= 0 || player.dead || mode !== "play") return;
    const view = lastView;
    const a = Math.min(1, dashT / 0.16);
    const dir = dashDir || player.facing || 1;
    const px = (player.x + player.w / 2) * view.scale + view.ox;
    const py = (player.y + player.h * 0.45) * view.scale + view.oy;
    const [ar, ag, ab] = fxAccent();
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const off = (i - 3.5) * 6.2 * view.scale;
      const len = (20 + i * 10) * a * view.scale;
      ctx.strokeStyle = i % 2 ? "#ffe8a0" : `rgb(${ar},${ag},${ab})`;
      ctx.globalAlpha = a * (0.1 + (1 - Math.abs(i - 3.5) / 4.5) * 0.45);
      ctx.lineWidth = Math.max(1, (i === 3 || i === 4 ? 2.3 : 1.15) * view.scale);
      ctx.beginPath();
      ctx.moveTo(px - dir * 8 * view.scale, py + off);
      ctx.lineTo(px - dir * (8 * view.scale + len), py + off * 0.28);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDoorPull() {
    if (mode !== "play" || !world.door || world.doorHidden || player.dead || player.win) return;
    const dx = (player.x + player.w / 2) - (world.door.x + 16);
    const dy = (player.y + 10) - (world.door.y + 8);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 170) return;
    const k = 1 - dist / 170;
    const view = lastView;
    const px = (world.door.x + 16) * view.scale + view.ox;
    const py = (world.door.y + 8) * view.scale + view.oy;
    const rad = (70 + k * 90) * view.scale;
    const g = ctx.createRadialGradient(px, py, 6, px, py, Math.max(8, rad));
    g.addColorStop(0, `rgba(255,210,120,${0.2 * k})`);
    g.addColorStop(1, "rgba(255,210,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }

  function drawCinema() {
    if (mode === "creator") return;
    if (clearBloom > 0) {
      ctx.fillStyle = `rgba(255,214,140,${clearBloom * 0.22})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    drawDoorPull();
    drawSpeedLines();
    if (window.SURGE_FINISH && !testMode && mode === "play") window.SURGE_FINISH.paint(ctx, finishSnap());
  }

  function finishSnap() {
    const th = currentTheme();
    let near = 0;
    if (mode === "play" && world.door && !world.doorHidden && !player.dead) {
      const dx = (player.x + player.w / 2) - (world.door.x + 16);
      const dy = (player.y + 10) - (world.door.y + 8);
      const dist = Math.sqrt(dx * dx + dy * dy);
      near = dist < 220 ? 1 - dist / 220 : 0;
    }
    return {
      w: VIEW_W, h: VIEW_H, mode,
      t: world.time || 0,
      now: performance.now(),
      combo, deaths,
      traps: world.trapsFired || 0,
      reverse: !!world.reverse,
      wind: world.wind || 0,
      grav: world.gravity,
      shake: world.shake || 0,
      flash: world.flash || 0,
      dash: dashT,
      dashReady: dimIndex >= 3 && dashCool <= 0,
      ground: !!player.onGround,
      vx: player.vx, vy: player.vy,
      weather: th.weather || "",
      accent: th.accent || [227, 27, 27],
      dim: dimIndex,
      intro: introT,
      win: !!player.win,
      dead: !!player.dead,
      clear: clearBloom,
      near,
    };
  }

  function drawDashReady() {
    if (dimIndex < 3 || mode !== "play" || player.dead || player.win) return;
    const t = dashCool <= 0 ? 1 : 1 - Math.min(1, dashCool / 0.72);
    ctx.save();
    ctx.translate(player.x + player.w / 2, player.y - 8);
    ctx.strokeStyle = t >= 1 ? "rgba(255,226,150,0.95)" : "rgba(255,226,150,0.3)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, 5.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.04, t));
    ctx.stroke();
    if (t >= 1) {
      ctx.fillStyle = "rgba(255,226,150,0.95)";
      ctx.fillRect(-1.1, -1.1, 2.2, 2.2);
    }
    ctx.restore();
  }

  function drawTitleShard(x, y, spin) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.fillStyle = "rgba(255,210,74,0.28)";
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd24a";
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, -1);
    ctx.lineTo(3, 6);
    ctx.lineTo(-3, 6);
    ctx.lineTo(-5, -1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff6c8";
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(2, -1);
    ctx.lineTo(0, 2);
    ctx.lineTo(-1.4, -1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawTitleDemo() {
    drawBackground();
    const t = performance.now() / 1000;
    const pal = themeBricks("#");
    const accent = (currentTheme().accent || [210, 220, 255]);
    const ar = accent[0];
    const ag = accent[1];
    const ab = accent[2];
    const sc = Math.max(2.2, Math.min(VIEW_W / 720, VIEW_H / 420));
    const W = VIEW_W / sc;
    const H = VIEW_H / sc;
    const floorY = H * (mode === "levels" ? 0.92 : 0.8);
    const doorX = W * 0.86;
    const driftX = Math.sin(t * 0.12) * 6;
    const driftY = Math.cos(t * 0.09) * 3;
    ctx.save();
    ctx.scale(sc, sc);
    ctx.translate(driftX, driftY);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const x = doorX - 4 + i * 16 + Math.sin(t * 0.25 + i) * 4;
      ctx.fillStyle = `rgba(255,214,150,${0.045 + i * 0.012})`;
      ctx.beginPath();
      ctx.moveTo(x, -20);
      ctx.lineTo(x + 14, -20);
      ctx.lineTo(x + 36, floorY);
      ctx.lineTo(x + 8, floorY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    const brick = (x, y) => drawBrickFace(x, y, pal[0], pal[1], false);
    ctx.save();
    ctx.globalAlpha = 0.42;
    const farY = H * 0.16;
    for (let i = -1; i < 4; i++) brick(i * TILE - 8, farY);
    for (let i = 0; i < 4; i++) brick(W - (i + 1) * TILE, farY - TILE);
    ctx.restore();

    const tower = (x, h) => {
      for (let i = 1; i <= h; i++) brick(x, floorY - i * TILE);
    };
    tower(0, 2);
    tower(TILE, 1);
    tower(W - TILE, 2);
    drawSpikePair(0, floorY - TILE * 3, "up");

    const islands = [
      { x: W * 0.03, y: H * 0.36, n: 3, ph: 0.2 },
      { x: W * 0.8, y: H * 0.28, n: 3, ph: 1.4 },
    ];
    for (const isl of islands) {
      const bob = Math.sin(t * 1.1 + isl.ph) * 7;
      for (let i = 0; i < isl.n; i++) brick(isl.x + i * TILE, isl.y + bob);
      drawTitleShard(isl.x + TILE, isl.y + bob - 16, Math.sin(t * 0.9 + isl.ph) * 0.4);
    }

    const cols = Math.ceil(W / TILE) + 3;
    const depth = Math.ceil((H - floorY) / TILE) + 2;
    const hole = Math.max(2, Math.floor(W * 0.16 / TILE));
    const open = (t % 7) > 2.5;
    for (let row = 0; row < depth; row++) {
      for (let i = -1; i < cols; i++) {
        if (open && row === 0 && i >= hole && i < hole + 3) continue;
        brick(i * TILE, floorY + row * TILE);
      }
    }
    if (open) {
      ctx.fillStyle = "#07050a";
      ctx.fillRect(hole * TILE, floorY, TILE * 3, TILE);
      for (let s = 0; s < 3; s++) drawSpikePair((hole + s) * TILE, floorY + TILE, "up");
    }

    const aura = ctx.createRadialGradient(doorX + 16, floorY - 8, 6, doorX + 16, floorY - 8, 72);
    aura.addColorStop(0, "rgba(255,200,90,0.38)");
    aura.addColorStop(1, "rgba(255,200,90,0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(doorX + 16, floorY - 8, 72, 0, Math.PI * 2);
    ctx.fill();
    drawDoorShell(doorX, floorY - 50, (t % 9) > 6.4);

    const cycle = t % 7;
    const walk = Math.min(1, cycle / 2.4);
    const px = W * 0.04 + walk * (hole * TILE - W * 0.04 - 8);
    const falling = open && cycle > 2.55 && walk > 0.9;
    const py = floorY - 28 + (falling ? Math.min(86, (cycle - 2.55) * 95) : 0);
    drawSaw({
      x: px - 72,
      y: floorY - 24 + Math.sin(t * 3) * 5,
      spin: t * 8,
      chase: cycle > 1.15,
    });
    if (py < floorY + 36) {
      drawDevilBody(px, py, 1, falling ? 0.8 : 1, (!falling && cycle > 2.2 && cycle < 2.55) ? 0.16 : 0);
    }

    for (let i = 0; i < 26; i++) {
      const n = frac(i * 5.3);
      const x = (frac(i * 11.7) * (W + 40) + t * (8 + n * 16)) % (W + 40) - 20;
      const y = H + 10 - ((t * (12 + n * 18) + n * 200) % (H + 30));
      ctx.fillStyle = `rgba(${Math.min(255, ar + 40)},${80 + n * 90},${40},${0.22 + n * 0.4})`;
      const s = n > 0.78 ? 2.4 : 1.3;
      ctx.fillRect(x, y, s, s);
    }
    ctx.restore();

    const vig = ctx.createRadialGradient(VIEW_W * 0.5, VIEW_H * 0.4, VIEW_H * 0.08, VIEW_W * 0.5, VIEW_H * 0.42, VIEW_H * 0.78);
    vig.addColorStop(0, "rgba(5,6,10,0.34)");
    vig.addColorStop(0.5, "rgba(5,6,10,0.06)");
    vig.addColorStop(1, "rgba(5,6,10,0)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function sceneryKindsForRole(weather, role) {
    // Role locks orientation; weather only swaps dressing. Kinds must match the mount.
    if (role === "hang") {
      if (weather === "ember" || weather === "sparks") return ["chain", "hook", "lamp", "chain"];
      if (weather === "snow") return ["drip", "banner", "drip", "hook"];
      if (weather === "spores") return ["vine", "bulb", "drip", "vine"];
      if (weather === "rain") return ["chain", "drip", "hook", "lamp"];
      if (weather === "static") return ["lamp", "chain", "hook", "lamp"];
      return ["chain", "hook", "banner", "drip"];
    }
    if (role === "wall") {
      if (weather === "ember" || weather === "sparks") return ["brace", "pipe", "panel", "brace"];
      if (weather === "snow") return ["brace", "panel", "pipe", "brace"];
      if (weather === "spores") return ["brace", "panel", "brace", "pipe"];
      if (weather === "rain") return ["pipe", "brace", "panel", "pipe"];
      if (weather === "static") return ["panel", "brace", "pipe", "panel"];
      return ["brace", "panel", "pipe", "brace"];
    }
    if (role === "floor") {
      // Planted on the walk lip — no hang/wall pieces.
      if (weather === "ember" || weather === "sparks") return ["lamppost", "rib", "brace", "shard"];
      if (weather === "snow") return ["lamppost", "rib", "shard"];
      if (weather === "spores") return ["lamppost", "shard", "rib"];
      if (weather === "static") return ["lamppost", "panel", "rib"];
      return ["lamppost", "rib", "shard", "brace"];
    }
    // ledge: hang from the lip or plant on the edge
    if (weather === "spores") return ["banner", "hook", "lamppost"];
    if (weather === "ember" || weather === "sparks") return ["banner", "lamppost", "hook"];
    if (weather === "snow") return ["banner", "drip", "lamppost"];
    return ["banner", "lamppost", "hook", "shard"];
  }

  function pushScenery(bag, kind, x, y, face, s, phase, extra) {
    const p = { kind, x, y, face: face || 0, s: s || 1, phase: phase || 0 };
    if (extra) {
      if (extra.float) p.float = true;
      if (extra.hang) p.hang = extra.hang;
      if (extra.pair) p.pair = true;
      if (extra.role) p.role = extra.role;
    }
    bag.push(p);
  }

  const ENABLE_ROOM_SCENERY = false;

  function buildRoomScenery() {
    world.scenery = [];
    world.fore = [];
    // Props off for now — flip ENABLE_ROOM_SCENERY when bringing them back.
    if (!ENABLE_ROOM_SCENERY || !world.cols || !world.rows) return;
    const th = currentTheme();
    const weather = th.weather || "shards";
    const dim = dimIndex || 1;
    const seed = ((dim * 9973) ^ ((levelIndex + 1) * 7919) ^ (world.cols * 13)) >>> 0;
    const bag = world.scenery;
    const minGap = Math.max(4, Math.min(7, (world.cols / 14) | 0)); // tile gap between mid props
    const maxMid = Math.min(28, 10 + (world.cols / 5 | 0) + Math.min(6, dim >> 1));
    const taken = [];
    const doorTx = world.door ? Math.floor(world.door.x / TILE) : -99;
    const spawnTx = world.spawn ? Math.floor(world.spawn.x / TILE) : -99;

    const tooClose = (tx, ty) => {
      for (let i = 0; i < taken.length; i++) {
        if (Math.abs(taken[i].x - tx) < minGap && Math.abs(taken[i].y - ty) < 3) return true;
      }
      return false;
    };
    const nearGate = (tx) => Math.abs(tx - doorTx) < 3 || Math.abs(tx - spawnTx) < 3;
    const openAir = (tx, ty) => {
      if (ty < 1 || ty >= world.rows - 1 || tx < 1 || tx >= world.cols - 1) return false;
      const t = world.tiles[ty][tx];
      return t === "." || t === "*" || t === "o";
    };
    const pickKind = (role, i, salt) => {
      const list = sceneryKindsForRole(weather, role);
      return list[(i + ((salt * list.length) | 0)) % list.length];
    };
    const placeAt = (role, tx, ty, face, hang, i, salt) => {
      if (bag.length >= maxMid) return false;
      if (!openAir(tx, ty) || nearGate(tx) || tooClose(tx, ty)) return false;
      const kind = pickKind(role, i, salt);
      const u = frac(seed * 0.001 + tx * 0.13 + ty * 0.29 + i * 1.7);
      // Pivot sits on the mount: ceiling underside, floor lip, or wall face.
      let px = tx * TILE + 16;
      let py = ty * TILE + 16;
      let f = face || 0;
      if (role === "hang") {
        py = ty * TILE;
      } else if (role === "floor" || role === "ledge") {
        py = (ty + 1) * TILE;
      } else if (role === "wall") {
        // face > 0: solid on left → pivot on left face, draw into +x.
        // face < 0: solid on right → pivot on right face, mirrored into room.
        px = f > 0 ? tx * TILE + 1 : (tx + 1) * TILE - 1;
        py = ty * TILE + 16;
      }
      pushScenery(
        bag,
        kind,
        px,
        py,
        f,
        0.88 + u * 0.22,
        u * Math.PI * 2,
        hang ? { hang, role } : { role }
      );
      taken.push({ x: tx, y: ty });
      return true;
    };

    // --- Collect map anchors (structure first, not random tile soup) ---
    const hangs = [];
    const wallsL = [];
    const wallsR = [];
    const floors = [];
    const ledges = [];
    const shafts = [];

    for (let x = 2; x < world.cols - 2; x++) {
      let ceilRun = 0;
      for (let y = 1; y < world.rows - 1; y++) {
        if (!openAir(x, y)) {
          ceilRun = 0;
          continue;
        }
        const up = world.tiles[y - 1][x];
        const down = world.tiles[y + 1][x];
        const left = world.tiles[y][x - 1];
        const right = world.tiles[y][x + 1];
        if (isSolid(up) && !isSolid(down)) {
          ceilRun += 1;
          // Prefer mid-span of a ceiling bite (run ≥2), skip tiny 1-tile nicks.
          if (ceilRun === 2 || (ceilRun > 2 && ceilRun % 3 === 1)) {
            hangs.push({ x, y, run: ceilRun, hang: Math.min(3, 1 + ((ceilRun / 2) | 0)) });
          }
        } else {
          ceilRun = 0;
        }
        // Wall dressing sits mid-corridor — never on a floor cell.
        if (isSolid(left) && !isSolid(right) && !isSolid(up) && !isSolid(down)) {
          wallsL.push({ x, y });
        }
        if (isSolid(right) && !isSolid(left) && !isSolid(up) && !isSolid(down)) {
          wallsR.push({ x, y });
        }
        if (isSolid(down) && !isSolid(up) && !isSolid(left) && !isSolid(right)) {
          // Standing platform top — only edges / ends read as dressed, not mid-run clutter.
          const dl = isSolid(world.tiles[y + 1][x - 1]);
          const dr = isSolid(world.tiles[y + 1][x + 1]);
          if (!dl || !dr) floors.push({ x, y, edge: !dl ? -1 : 1 });
          else if ((x + y + dim) % 5 === 0) floors.push({ x, y, edge: 0 });
        }
        // Ledge: solid under, open beyond one side — good for banners / hooks.
        if (isSolid(down) && !isSolid(up)) {
          if (!isSolid(world.tiles[y][x - 1]) && isSolid(world.tiles[y + 1][x + 1])) {
            ledges.push({ x, y, face: -1 });
          } else if (!isSolid(world.tiles[y][x + 1]) && isSolid(world.tiles[y + 1][x - 1])) {
            ledges.push({ x, y, face: 1 });
          }
        }
      }
      // Tall open shaft: float accent only where the column is roomy.
      let air = 0;
      let airY = 2;
      for (let y = 1; y < world.rows - 1; y++) {
        if (openAir(x, y) && !isSolid(world.tiles[y - 1][x]) && !isSolid(world.tiles[y + 1][x])) {
          if (air === 0) airY = y;
          air += 1;
        } else if (air >= 6) {
          shafts.push({ x, y: airY + ((air / 2) | 0), h: air });
          air = 0;
        } else air = 0;
      }
      if (air >= 6) shafts.push({ x, y: airY + ((air / 2) | 0), h: air });
    }

    // Deterministic shuffle so we don't always dress left→right the same way.
    const shuffle = (arr, salt) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = (frac(seed * 0.002 + salt + i * 3.1) * (i + 1)) | 0;
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr;
    };
    shuffle(hangs, 1.1);
    shuffle(wallsL, 2.3);
    shuffle(wallsR, 3.7);
    shuffle(floors, 4.9);
    shuffle(ledges, 5.5);

    // Budget by role so every room has mixed mounts, not one blob of chains.
    const budgets = {
      hang: Math.min(hangs.length, 3 + (world.cols / 12 | 0)),
      wall: Math.min(wallsL.length + wallsR.length, 4 + (world.cols / 10 | 0)),
      floor: Math.min(floors.length, 2 + (world.cols / 14 | 0)),
      ledge: Math.min(ledges.length, 2 + (dim / 6 | 0)),
    };

    let hi = 0;
    for (let i = 0; i < hangs.length && hi < budgets.hang; i++) {
      const a = hangs[i];
      if (placeAt("hang", a.x, a.y, 0, a.hang, hi, frac(a.x * 0.2 + a.y))) hi += 1;
    }

    let wi = 0;
    const wallCap = budgets.wall;
    for (let i = 0; i < wallsL.length && wi < wallCap; i++) {
      const a = wallsL[i];
      // Prefer mid-height wall faces (not floor skirting / ceiling lip).
      if (a.y < 2 || a.y > world.rows - 3) continue;
      if (placeAt("wall", a.x, a.y, 1, 0, wi, 0.31)) wi += 1;
    }
    for (let i = 0; i < wallsR.length && wi < wallCap; i++) {
      const a = wallsR[i];
      if (a.y < 2 || a.y > world.rows - 3) continue;
      if (placeAt("wall", a.x, a.y, -1, 0, wi, 0.57)) wi += 1;
    }

    let fi = 0;
    for (let i = 0; i < floors.length && fi < budgets.floor; i++) {
      const a = floors[i];
      if (placeAt("floor", a.x, a.y, a.edge || 0, 0, fi, 0.71)) fi += 1;
    }

    let li = 0;
    for (let i = 0; i < ledges.length && li < budgets.ledge; i++) {
      const a = ledges[i];
      if (placeAt("ledge", a.x, a.y, a.face, 0, li, 0.83)) li += 1;
    }

    // Sparse shaft accents — only tall open columns (not jump-gap litter).
    shuffle(shafts, 6.2);
    const floatN = Math.min(2, shafts.length, dim >= 4 ? 1 + (dim / 10 | 0) : 0);
    for (let i = 0; i < floatN; i++) {
      const a = shafts[i];
      if (a.h < 6 || nearGate(a.x) || tooClose(a.x, a.y)) continue;
      const u = frac(seed * 0.01 + a.x * 0.19 + i);
      // Only shaft accents float — drifting shards/lamps, never floor-planted kinds.
      pushScenery(
        bag,
        weather === "spores" ? "bulb" : (weather === "ember" || weather === "sparks") ? "lamp" : "shard",
        a.x * TILE + 16,
        a.y * TILE + 16,
        0,
        0.7 + u * 0.25,
        u * Math.PI * 2,
        { float: true, role: "float" }
      );
      taken.push({ x: a.x, y: a.y });
    }

    // Foreground: spaced along the level width, alternating band/depth/kind.
    const fore = world.fore;
    const foreKinds = weather === "ember" || weather === "sparks"
      ? ["teeth", "gantry", "chain", "blade", "tower"]
      : weather === "snow"
        ? ["teeth", "drip", "rib", "tower", "gantry"]
        : weather === "spores"
          ? ["vine", "bulb", "rib", "tower", "gantry"]
          : ["teeth", "gantry", "chain", "rib", "blade", "tower", "arch"];
    const foreN = Math.min(14, 7 + (world.cols / 8 | 0) + Math.min(4, dim >> 2));
    for (let i = 0; i < foreN; i++) {
      // Even base spacing + small jitter so pieces don't stack on the same x.
      const base = (i + 0.5) / foreN;
      const jitter = (frac(seed * 0.03 + i * 2.1) - 0.5) * (0.55 / foreN);
      const u = Math.max(0.04, Math.min(0.96, base + jitter));
      const bandCycle = i % 3;
      const band = bandCycle === 0 ? "low" : bandCycle === 1 ? "high" : "side";
      const depth = i % 2 === 0 ? "near" : "mid";
      fore.push({
        kind: foreKinds[i % foreKinds.length],
        u,
        band,
        depth,
        w: 40 + frac(u * 5.7 + i) * 70,
        h: 80 + frac(u * 8.2 + i * 0.4) * 140,
        lean: ((i % 5) - 2) * 0.12,
        phase: u * Math.PI * 2,
        teeth: 3 + ((i + dim) % 4),
      });
    }
  }

  // Midground props: brick/needle language, pivot on the mount (ceiling / floor / wall).
  // ≥20 purposeful parts each. Role locks orientation — only float props bob.
  function drawSceneryProp(p, accent, t, g) {
    const c = g || ctx;
    const ar = accent[0] | 0;
    const ag = accent[1] | 0;
    const ab = accent[2] | 0;
    const role = p.role || (p.float ? "float" : "hang");
    const bob = p.float ? Math.sin(t * 1.4 + p.phase) * 3.4 : 0;
    c.save();
    c.translate(p.x, p.y + bob);
    if (p.face < 0) c.scale(-1, 1);
    c.scale(p.s || 1, p.s || 1);

    const fill = `rgba(${ar},${ag},${ab},0.68)`;
    const deep = `rgba(${(ar * 0.24) | 0},${(ag * 0.22) | 0},${(ab * 0.26) | 0},0.94)`;
    const hot = `rgba(${ar},${ag},${ab},0.9)`;
    const lit = `rgba(255,245,220,0.55)`;
    const ink = `rgba(6,5,8,0.62)`;
    const lip = `rgba(${Math.min(255, ar + 36)},${Math.min(255, ag + 28)},${Math.min(255, ab + 22)},0.78)`;

    const bolt = (x, y, r) => {
      c.fillStyle = deep;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = hot;
      c.fillRect(x - r * 0.35, y - r * 0.85, r * 0.7, r * 1.7);
    };
    // Mini brick slab — same lip language as platforms.
    const brick = (x, y, w, h) => {
      c.fillStyle = deep;
      c.fillRect(x, y, w, h);
      c.fillStyle = lip;
      c.fillRect(x, y, w, Math.max(2, Math.min(5, h * 0.22)));
      c.fillStyle = "rgba(255,255,255,0.12)";
      c.fillRect(x + 1, y + 1, Math.max(1, w - 2), 1.5);
      c.fillStyle = ink;
      c.fillRect(x, y + h - 2, w, 2);
      c.fillRect(x + w - 2, y, 2, h);
      c.fillStyle = "rgba(255,255,255,0.06)";
      c.fillRect(x, y, 1.5, h);
    };
    const needle = (x0, y0, x1, y1, w) => {
      c.strokeStyle = deep;
      c.lineWidth = w + 2;
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
      c.stroke();
      c.strokeStyle = hot;
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
      c.stroke();
      c.fillStyle = lit;
      c.beginPath();
      c.arc(x1, y1, Math.max(1.2, w * 0.55), 0, Math.PI * 2);
      c.fill();
    };

    if (p.kind === "chain") {
      // Ceiling plate → angular links → needle tip. Hangs +y from mount.
      brick(-9, 0, 18, 5);
      bolt(-5, 2.5, 1.3);
      bolt(5, 2.5, 1.3);
      c.fillStyle = ink;
      c.fillRect(-7, 1, 14, 1.2);
      c.fillStyle = fill;
      c.fillRect(-2.2, 5, 4.4, 4);
      const links = 4 + (p.hang || 0);
      for (let i = 0; i < links; i++) {
        const yy = 9 + i * 9;
        c.fillStyle = deep;
        c.fillRect(-5, yy, 10, 7);
        c.strokeStyle = fill;
        c.lineWidth = 1.4;
        c.strokeRect(-5, yy, 10, 7);
        c.fillStyle = hot;
        c.fillRect(-1.4, yy + 2, 2.8, 3);
        c.fillStyle = ink;
        c.fillRect(-4, yy + 1, 8, 1);
      }
      const tip = 9 + links * 9;
      c.fillStyle = deep;
      c.beginPath();
      c.moveTo(-4, tip);
      c.lineTo(4, tip);
      c.lineTo(0, tip + 12);
      c.closePath();
      c.fill();
      c.fillStyle = lit;
      c.fillRect(-0.7, tip + 2, 1.4, 6);
      c.fillStyle = ink;
      c.fillRect(1.5, tip + 4, 1.2, 2);
      c.fillStyle = fill;
      c.fillRect(-3, tip - 1, 6, 2);
      c.strokeStyle = hot;
      c.beginPath();
      c.moveTo(-2, tip + 3);
      c.lineTo(2, tip + 3);
      c.stroke();
    } else if (p.kind === "hook") {
      brick(-8, 0, 16, 5);
      bolt(-4.5, 2.5, 1.2);
      bolt(4.5, 2.5, 1.2);
      c.fillStyle = deep;
      c.fillRect(-2.5, 5, 5, 14);
      c.fillStyle = lip;
      c.fillRect(-2.5, 5, 5, 2);
      c.fillStyle = ink;
      c.fillRect(-1.5, 8, 3, 1);
      c.fillRect(-1.5, 12, 3, 1);
      c.strokeStyle = hot;
      c.lineWidth = 2.8;
      c.beginPath();
      c.moveTo(0, 18);
      c.lineTo(0, 24);
      c.lineTo(10, 24);
      c.lineTo(10, 16);
      c.stroke();
      c.strokeStyle = fill;
      c.lineWidth = 1.3;
      c.beginPath();
      c.moveTo(10, 16);
      c.lineTo(10, 24);
      c.lineTo(0, 24);
      c.stroke();
      c.fillStyle = lit;
      c.fillRect(8.5, 17, 1.5, 5);
      c.fillStyle = deep;
      c.fillRect(-4, 28, 4, 5);
      c.fillStyle = hot;
      c.fillRect(-3, 29, 2, 2);
      bolt(0, 10, 1.1);
      c.fillStyle = ink;
      c.fillRect(2, 20, 2, 3);
      c.fillStyle = fill;
      c.fillRect(-1.5, 16, 3, 2);
    } else if (p.kind === "drip") {
      brick(-11, 0, 22, 5);
      bolt(-7, 2.5, 1.15);
      bolt(7, 2.5, 1.15);
      c.fillStyle = ink;
      c.fillRect(-9, 1.5, 18, 1.2);
      const lens = [16, 12, 20, 11, 15];
      for (let i = 0; i < 5; i++) {
        const xx = -8 + i * 4;
        const len = lens[i];
        c.fillStyle = deep;
        c.beginPath();
        c.moveTo(xx - 2, 5);
        c.lineTo(xx + 2, 5);
        c.lineTo(xx + 0.6, 5 + len);
        c.lineTo(xx - 0.6, 5 + len);
        c.closePath();
        c.fill();
        c.fillStyle = i % 2 ? hot : fill;
        c.fillRect(xx - 0.5, 6, 1, len * 0.55);
        c.fillStyle = lit;
        c.fillRect(xx - 0.35, 5 + len - 2, 0.7, 2);
        c.fillStyle = ink;
        c.fillRect(xx - 1.4, 5, 2.8, 1.5);
      }
      c.fillStyle = hot;
      c.beginPath();
      c.arc(0, 10, 1.3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = fill;
      c.fillRect(-10, 4, 3, 2);
      c.fillRect(7, 4, 3, 2);
      c.strokeStyle = lip;
      c.beginPath();
      c.moveTo(-9, 3);
      c.lineTo(9, 3);
      c.stroke();
    } else if (p.kind === "vine") {
      brick(-6, 0, 12, 4);
      bolt(-3, 2, 1.05);
      bolt(3, 2, 1.05);
      c.strokeStyle = deep;
      c.lineWidth = 3.2;
      c.beginPath();
      c.moveTo(0, 4);
      for (let i = 1; i <= 7; i++) c.lineTo(Math.sin(t * 1.05 + p.phase + i) * 4.5, 4 + i * 7);
      c.stroke();
      c.strokeStyle = fill;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(0, 4);
      for (let i = 1; i <= 7; i++) c.lineTo(Math.sin(t * 1.05 + p.phase + i) * 4.5, 4 + i * 7);
      c.stroke();
      for (let i = 1; i <= 5; i++) {
        const lx = Math.sin(t * 0.8 + i) * 4.5;
        const ly = 4 + i * 9;
        c.fillStyle = deep;
        c.beginPath();
        c.moveTo(lx, ly);
        c.lineTo(lx + 6, ly - 2);
        c.lineTo(lx + 5, ly + 3);
        c.closePath();
        c.fill();
        c.fillStyle = hot;
        c.fillRect(lx + 1, ly, 2, 1.5);
      }
      c.fillStyle = deep;
      c.fillRect(-3, 4, 6, 3);
      c.fillStyle = lit;
      c.beginPath();
      c.arc(Math.sin(t + p.phase) * 2.5, 52, 2, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = ink;
      c.fillRect(-2, 5, 4, 2);
      c.fillStyle = hot;
      c.fillRect(-4, 18, 2, 2);
      c.fillRect(3, 30, 2, 2);
      c.beginPath();
      c.moveTo(-5, 8);
      c.lineTo(-8, 10);
      c.strokeStyle = deep;
      c.stroke();
    } else if (p.kind === "bulb" || p.kind === "lamp") {
      // Geometric lantern — square cage, not a soft globe.
      if (role === "float") {
        c.fillStyle = deep;
        c.fillRect(-8, -12, 16, 24);
        c.fillStyle = lip;
        c.fillRect(-8, -12, 16, 3);
        c.fillStyle = ink;
        c.fillRect(-8, 10, 16, 2);
        c.strokeStyle = fill;
        c.lineWidth = 1.3;
        c.strokeRect(-8, -12, 16, 24);
        c.strokeRect(-5, -8, 10, 14);
        c.fillStyle = `rgba(${ar},${ag},${ab},0.22)`;
        c.fillRect(-4, -6, 8, 10);
        c.fillStyle = hot;
        c.fillRect(-2.5, -4, 5, 6);
        c.fillStyle = lit;
        c.fillRect(-1.5, -3, 2, 2);
        for (let i = 0; i < 4; i++) {
          c.fillStyle = ink;
          c.fillRect(-6, -8 + i * 5, 12, 1);
          c.fillStyle = fill;
          c.fillRect(-7, -9 + i * 5, 2, 2);
          c.fillRect(5, -9 + i * 5, 2, 2);
        }
        bolt(0, -13.5, 1.2);
        bolt(-5, 9, 1.05);
        bolt(5, 9, 1.05);
        c.fillStyle = deep;
        c.fillRect(-3, 12, 6, 3);
        c.fillStyle = hot;
        c.fillRect(-1, 13, 2, 1.5);
        c.beginPath();
        c.arc(0, 0, 14, 0, Math.PI * 2);
        c.strokeStyle = `rgba(${ar},${ag},${ab},0.28)`;
        c.stroke();
      } else {
        brick(-8, 0, 16, 4);
        bolt(-5, 2, 1.15);
        bolt(5, 2, 1.15);
        c.fillStyle = deep;
        c.fillRect(-2.5, 4, 5, 8);
        c.fillStyle = fill;
        c.fillRect(-2.5, 4, 5, 2);
        brick(-7, 12, 14, 16);
        c.fillStyle = `rgba(${ar},${ag},${ab},0.2)`;
        c.fillRect(-4, 15, 8, 8);
        c.fillStyle = hot;
        c.fillRect(-2.5, 16.5, 5, 5);
        c.fillStyle = lit;
        c.fillRect(-1.4, 17.5, 2, 2);
        c.strokeStyle = fill;
        c.lineWidth = 1.2;
        c.strokeRect(-5, 14, 10, 10);
        c.fillStyle = ink;
        c.fillRect(-5, 14, 10, 1);
        c.fillRect(-5, 23, 10, 1);
        c.fillStyle = deep;
        c.fillRect(-4, 28, 8, 3);
        c.fillStyle = hot;
        c.fillRect(-1, 29, 2, 1.5);
      }
    } else if (p.kind === "pipe") {
      // Wall duct — flush from x=0 into the room.
      brick(0, -8, 6, 16);
      bolt(3, -5, 1.15);
      bolt(3, 5, 1.15);
      c.fillStyle = deep;
      c.fillRect(5, -5, 28, 10);
      c.fillStyle = lip;
      c.fillRect(5, -5, 28, 2.5);
      c.fillStyle = ink;
      c.fillRect(5, 3, 28, 2);
      c.fillStyle = fill;
      c.fillRect(5, -3, 28, 1.2);
      for (const fx of [10, 22]) {
        c.fillStyle = deep;
        c.fillRect(fx, -8, 5, 16);
        bolt(fx + 2.5, -5, 1.05);
        bolt(fx + 2.5, 5, 1.05);
      }
      c.strokeStyle = hot;
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(18, -9, 4.5, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.moveTo(18, -13);
      c.lineTo(18, -5);
      c.moveTo(14, -9);
      c.lineTo(22, -9);
      c.stroke();
      c.fillStyle = lit;
      c.fillRect(8, -2, 2, 2);
      c.fillStyle = hot;
      c.beginPath();
      c.arc(30, 6, 1.4, 0, Math.PI * 2);
      c.fill();
    } else if (p.kind === "brace") {
      if (role === "floor" || role === "ledge") {
        // Standing ruin post — feet on y=0, body into -y.
        brick(-9, -4, 18, 4);
        bolt(-5, -2, 1.15);
        bolt(5, -2, 1.15);
        c.fillStyle = deep;
        c.fillRect(-4, -28, 8, 24);
        c.fillStyle = lip;
        c.fillRect(-4, -28, 8, 3);
        c.fillStyle = ink;
        c.fillRect(-4, -6, 8, 2);
        c.fillRect(-2, -22, 4, 1.2);
        c.fillRect(-2, -16, 4, 1.2);
        c.fillStyle = fill;
        c.fillRect(-5, -20, 2, 10);
        c.fillRect(3, -20, 2, 10);
        needle(0, -28, 0, -38, 1.6);
        c.fillStyle = hot;
        c.fillRect(-2, -12, 4, 3);
        c.fillStyle = lit;
        c.fillRect(-1, -11, 2, 1.2);
        c.fillStyle = ink;
        c.fillRect(-6, -3, 3, 2);
        c.fillRect(3, -3, 3, 2);
      } else {
        // Wall L-bracket — plate on wall, arm into room (+x).
        brick(0, -16, 5, 32);
        bolt(2.5, -12, 1.2);
        bolt(2.5, 12, 1.2);
        bolt(2.5, 0, 1.15);
        c.fillStyle = deep;
        c.fillRect(4, -5, 20, 7);
        c.fillStyle = lip;
        c.fillRect(4, -5, 20, 2);
        c.fillStyle = ink;
        c.fillRect(4, 0, 20, 2);
        c.beginPath();
        c.moveTo(5, -5);
        c.lineTo(16, -5);
        c.lineTo(5, 8);
        c.closePath();
        c.fillStyle = deep;
        c.fill();
        c.strokeStyle = fill;
        c.lineWidth = 1.2;
        c.stroke();
        bolt(12, -1.5, 1.15);
        bolt(20, -1.5, 1.1);
        c.fillStyle = hot;
        c.fillRect(22, -3, 5, 3);
        c.fillStyle = lit;
        c.fillRect(23, -2.2, 2, 1.3);
        c.fillStyle = fill;
        c.fillRect(5, 2, 14, 2);
        c.fillStyle = ink;
        c.fillRect(8, -2, 5, 1);
      }
    } else if (p.kind === "panel") {
      if (role === "floor" || role === "ledge") {
        // Standing monolith on the walk lip.
        brick(-8, -4, 16, 4);
        c.fillStyle = deep;
        c.fillRect(-7, -30, 14, 26);
        c.fillStyle = lip;
        c.fillRect(-7, -30, 14, 3);
        c.strokeStyle = fill;
        c.lineWidth = 1.3;
        c.strokeRect(-7, -30, 14, 26);
        c.fillStyle = ink;
        c.fillRect(-5, -24, 10, 14);
        c.fillStyle = hot;
        c.fillRect(-3, -22, 3, 3);
        c.fillRect(-3, -17, 6, 2);
        c.fillRect(-3, -13, 4, 2);
        c.fillStyle = lit;
        if ((t * 3.2 + p.phase) % 2 < 1.1) c.fillRect(-3, -22, 3, 3);
        for (let i = 0; i < 3; i++) {
          c.fillStyle = fill;
          c.fillRect(4, -22 + i * 5, 1.5, 2.5);
        }
        bolt(-4, -28, 1.05);
        bolt(4, -28, 1.05);
        c.fillStyle = deep;
        c.fillRect(-3, -32, 6, 2);
      } else {
        // Wall plaque flush to x=0.
        brick(0, -16, 4, 32);
        c.fillStyle = deep;
        c.fillRect(3, -14, 16, 28);
        c.fillStyle = lip;
        c.fillRect(3, -14, 16, 3);
        c.strokeStyle = fill;
        c.lineWidth = 1.3;
        c.strokeRect(3, -14, 16, 28);
        c.fillStyle = ink;
        c.fillRect(5, -10, 12, 18);
        bolt(5, -12, 1.05);
        bolt(15, -12, 1.05);
        bolt(5, 10, 1.05);
        bolt(15, 10, 1.05);
        c.fillStyle = hot;
        c.fillRect(7, -8, 3, 3);
        c.fillRect(11, -8, 5, 2);
        c.fillRect(7, -3, 8, 2);
        c.fillRect(7, 2, 5, 2);
        c.fillStyle = lit;
        if ((t * 3.5 + p.phase) % 2 < 1.1) c.fillRect(7, -8, 3, 3);
        for (let i = 0; i < 3; i++) {
          c.fillStyle = fill;
          c.fillRect(16, -6 + i * 4, 1.6, 2.2);
        }
        c.fillStyle = fill;
        c.fillRect(8, 10, 7, 2);
      }
    } else if (p.kind === "banner") {
      // Rod on mount (ceiling or ledge lip), pennant hangs +y.
      brick(-3, 0, 6, 10);
      c.fillStyle = deep;
      c.fillRect(-10, 8, 20, 4);
      bolt(-6, 10, 1.1);
      bolt(6, 10, 1.1);
      c.fillStyle = hot;
      c.beginPath();
      c.arc(0, 2, 2.2, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = `rgba(${ar},${ag},${ab},0.42)`;
      c.beginPath();
      c.moveTo(-8, 12);
      c.lineTo(8, 12);
      c.lineTo(6, 28);
      c.lineTo(1.5, 24);
      c.lineTo(0, 34);
      c.lineTo(-1.5, 24);
      c.lineTo(-6, 28);
      c.closePath();
      c.fill();
      c.strokeStyle = fill;
      c.lineWidth = 1.15;
      c.stroke();
      c.strokeStyle = deep;
      c.beginPath();
      c.moveTo(-4, 14);
      c.lineTo(-3, 22);
      c.moveTo(0, 15);
      c.lineTo(0, 24);
      c.moveTo(4, 14);
      c.lineTo(3, 22);
      c.stroke();
      c.fillStyle = hot;
      c.fillRect(-6, 32, 3, 3);
      c.fillRect(3, 32, 3, 3);
      c.fillStyle = ink;
      c.fillRect(-7, 12, 14, 1.2);
      c.fillStyle = lit;
      c.fillRect(-1, 18, 2, 4);
      c.fillStyle = fill;
      c.fillRect(-8, 10, 2, 2);
      c.fillRect(6, 10, 2, 2);
      c.fillRect(-1, 1, 2, 3);
      c.strokeStyle = deep;
      c.beginPath();
      c.moveTo(-6, 16);
      c.lineTo(-5, 26);
      c.moveTo(6, 16);
      c.lineTo(5, 26);
      c.stroke();
    } else if (p.kind === "rib") {
      // Arch planted on the floor — feet at y=0.
      brick(-16, -3, 10, 3);
      brick(6, -3, 10, 3);
      bolt(-11, -1.5, 1.15);
      bolt(11, -1.5, 1.15);
      c.strokeStyle = deep;
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(-14, -2);
      c.quadraticCurveTo(0, -26, 14, -2);
      c.stroke();
      c.strokeStyle = fill;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-12, -3);
      c.quadraticCurveTo(0, -22, 12, -3);
      c.stroke();
      c.strokeStyle = hot;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(-8, -5);
      c.quadraticCurveTo(0, -16, 8, -5);
      c.stroke();
      c.fillStyle = deep;
      c.fillRect(-3.5, -14, 7, 5);
      c.fillStyle = hot;
      c.fillRect(-2.5, -13, 5, 3);
      bolt(0, -11.5, 1.05);
      for (let i = -1; i <= 1; i++) {
        c.strokeStyle = ink;
        c.beginPath();
        c.moveTo(i * 5, -8);
        c.lineTo(i * 4, -3);
        c.stroke();
      }
      c.fillStyle = lit;
      c.fillRect(-1, -12.5, 2, 1.2);
      c.fillStyle = fill;
      c.beginPath();
      c.moveTo(-2, -14);
      c.lineTo(2, -14);
      c.lineTo(0, -18);
      c.closePath();
      c.fill();
      c.fillStyle = ink;
      c.fillRect(-14, -1, 6, 1);
      c.fillRect(8, -1, 6, 1);
    } else if (p.kind === "lamppost") {
      // Street post planted on the walk lip — base at y=0, head into -y.
      brick(-8, -4, 16, 4);
      bolt(-4.5, -2, 1.15);
      bolt(4.5, -2, 1.15);
      c.fillStyle = deep;
      c.fillRect(-2.5, -36, 5, 32);
      c.fillStyle = lip;
      c.fillRect(-2.5, -36, 5, 2.5);
      c.fillStyle = ink;
      c.fillRect(-1.5, -28, 3, 1.2);
      c.fillRect(-1.5, -18, 3, 1.2);
      c.fillRect(-1.5, -10, 3, 1.2);
      c.fillStyle = fill;
      c.fillRect(-3.2, -22, 1.4, 8);
      c.fillRect(1.8, -22, 1.4, 8);
      // Arm + cage head
      c.fillStyle = deep;
      c.fillRect(-2, -40, 14, 4);
      c.fillStyle = lip;
      c.fillRect(-2, -40, 14, 1.5);
      bolt(2, -38, 1.05);
      brick(8, -48, 12, 10);
      c.fillStyle = `rgba(${ar},${ag},${ab},0.22)`;
      c.fillRect(10, -45, 8, 5);
      c.fillStyle = hot;
      c.fillRect(11.5, -44, 5, 3.5);
      c.fillStyle = lit;
      c.fillRect(12.5, -43.5, 2, 1.5);
      c.strokeStyle = fill;
      c.lineWidth = 1.2;
      c.strokeRect(9, -47, 10, 8);
      c.fillStyle = ink;
      c.fillRect(9, -47, 10, 1);
      c.fillRect(9, -40, 10, 1);
      // Soft glow puddle under the head
      c.fillStyle = `rgba(${ar},${ag},${ab},0.12)`;
      c.beginPath();
      c.ellipse(14, -36, 10, 4, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = deep;
      c.fillRect(11, -38, 6, 2);
      c.fillStyle = hot;
      c.beginPath();
      c.arc(14, -42.5, 1.4, 0, Math.PI * 2);
      c.fill();
      needle(0, -36, 0, -44, 1.3);
      c.fillStyle = ink;
      c.fillRect(-6, -3, 3, 2);
      c.fillRect(3, -3, 3, 2);
    } else {
      // shard — cradled crystal. Floor: base on y=0. Float: centered, no pedestal.
      const floaty = role === "float" || !!p.float;
      if (!floaty) {
        brick(-8, -3, 16, 3);
        bolt(-4, -1.5, 1.05);
        bolt(4, -1.5, 1.05);
        c.fillStyle = deep;
        c.beginPath();
        c.moveTo(-8, -3);
        c.lineTo(-10, -8);
        c.lineTo(-5, -4);
        c.closePath();
        c.fill();
        c.beginPath();
        c.moveTo(8, -3);
        c.lineTo(10, -8);
        c.lineTo(5, -4);
        c.closePath();
        c.fill();
        c.fillStyle = fill;
        c.fillRect(-1.5, 0, 3, 2);
      }
      const oy = floaty ? 4 : -4;
      const facets = [
        [0, -16 + oy, 5, -2 + oy, 1, 8 + oy, -4, 0 + oy],
        [-6, -8 + oy, -1, -14 + oy, 2, -2 + oy, -5, 4 + oy],
        [4, -10 + oy, 9, -4 + oy, 6, 6 + oy, 1, 0 + oy],
      ];
      for (let f = 0; f < facets.length; f++) {
        const q = facets[f];
        c.fillStyle = f === 0 ? hot : fill;
        c.beginPath();
        c.moveTo(q[0], q[1]);
        c.lineTo(q[2], q[3]);
        c.lineTo(q[4], q[5]);
        c.lineTo(q[6], q[7]);
        c.closePath();
        c.fill();
      }
      c.fillStyle = lit;
      c.beginPath();
      c.moveTo(0, -14 + oy);
      c.lineTo(2, -6 + oy);
      c.lineTo(0, 0 + oy);
      c.closePath();
      c.fill();
      for (let i = 0; i < 4; i++) {
        c.fillStyle = i % 2 ? hot : deep;
        c.fillRect(-7 + i * 4, 4 + oy, 2, 2);
      }
      c.strokeStyle = fill;
      c.lineWidth = 1;
      c.strokeRect(-6, 5.5 + oy, 12, 2.5);
      c.fillStyle = lit;
      c.beginPath();
      c.arc(0, -2 + oy, 2, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = ink;
      c.fillRect(-3, 6 + oy, 6, 1);
      c.fillStyle = hot;
      c.fillRect(-1, -8 + oy, 2, 3);
      c.beginPath();
      c.moveTo(-4, 2 + oy);
      c.lineTo(4, 2 + oy);
      c.strokeStyle = fill;
      c.stroke();
      if (floaty) {
        c.strokeStyle = `rgba(${ar},${ag},${ab},0.35)`;
        c.beginPath();
        c.arc(0, 0, 11, 0, Math.PI * 2);
        c.stroke();
        c.beginPath();
        c.arc(0, 0, 7, 0, Math.PI * 2);
        c.stroke();
      }
    }
    c.restore();
  }

  function drawRoomScenery() {
    const bag = world.scenery;
    if (!bag || !bag.length) return;
    const th = currentTheme();
    const accent = th.accent || [210, 225, 255];
    const t = world.time || 0;
    for (let i = 0; i < bag.length; i++) drawSceneryProp(bag[i], accent, t);
  }

  function drawPit(view) {
    if (!view || !world.rows || mode !== "play") return;
    const bottom = view.oy + world.rows * TILE * view.scale;
    if (bottom > VIEW_H - 24) return;
    const top = Math.max(0, bottom);
    const gap = VIEW_H - top;
    const th = currentTheme();
    const accent = th.accent || [210, 225, 255];
    const t = world.time || 0;
    ctx.save();
    const fog = ctx.createLinearGradient(0, top, 0, VIEW_H);
    fog.addColorStop(0, "rgba(0,0,0,0)");
    fog.addColorStop(0.3, `rgba(${accent[0]},${accent[1]},${accent[2]},0.06)`);
    fog.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, top, VIEW_W, gap);
    for (let i = 0; i < 12; i++) {
      const n = frac(i * 3.7 + 1.1);
      const x = ((i + 0.4) / 12) * VIEW_W + Math.sin(t * 0.12 + i) * 5;
      const rise = gap * (0.42 + n * 0.5);
      const half = 26 + n * 34;
      ctx.beginPath();
      ctx.moveTo(x - half, VIEW_H + 6);
      ctx.lineTo(x - half * 0.2, VIEW_H - rise);
      ctx.lineTo(x + half * 0.28, VIEW_H - rise * 0.8);
      ctx.lineTo(x + half, VIEW_H + 6);
      ctx.closePath();
      ctx.fillStyle = `rgb(${accent[0] * 0.16 | 0},${accent[1] * 0.16 | 0},${accent[2] * 0.22 | 0})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${accent[0]},${accent[1]},${accent[2]},0.55)`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - half * 0.2, VIEW_H - rise);
      ctx.lineTo(x - half, VIEW_H + 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawForePiece(p, x, accent, t, alphaMul) {
    const ar = accent[0] | 0;
    const ag = accent[1] | 0;
    const ab = accent[2] | 0;
    const a = alphaMul == null ? 1 : alphaMul;
    // Accent-tinted mass + bright rim so the layer reads on dark void mountains.
    const deep = `rgba(${(ar * 0.18) | 0},${(ag * 0.14) | 0},${(ab * 0.16) | 0},${(0.9 * a).toFixed(3)})`;
    const edge = `rgba(${Math.min(255, ar + 40)},${Math.min(255, ag + 30)},${Math.min(255, ab + 30)},${(0.88 * a).toFixed(3)})`;
    const rim = `rgba(${ar},${ag},${ab},${(0.4 * a).toFixed(3)})`;
    const near = p.depth === "near";
    const scaleN = near ? 1.12 : 0.88;
    const yBase = p.band === "high"
      ? (near ? -4 : 8) + p.u * 16
      : p.band === "side"
        ? VIEW_H * (near ? 0.1 : 0.22)
        : VIEW_H + (near ? 14 : 6);
    ctx.save();
    ctx.translate(x, yBase);
    ctx.scale(scaleN, scaleN);
    if (p.kind === "teeth" || p.kind === "fang" || p.kind === "drip") {
      // Rail + teeth + roots + edge highlights — one jaw assembly.
      const count = Math.max(4, p.teeth || 4);
      const dir = p.band === "high" ? 1 : -1;
      const span = p.w;
      ctx.fillStyle = deep;
      ctx.fillRect(-span * 0.55, -dir * 4, span * 1.1, dir * 8);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-span * 0.55, Math.min(-dir * 4, dir * 4), span * 1.1, 8);
      for (let i = 0; i < count; i++) {
        const u = count === 1 ? 0.5 : i / (count - 1);
        const xx = (u - 0.5) * span;
        const h = p.h * (0.4 + (i % 3) * 0.12) * (p.band === "high" ? 0.55 : 0.92);
        ctx.fillStyle = deep;
        ctx.beginPath();
        ctx.moveTo(xx - span * 0.1, 0);
        ctx.lineTo(xx, dir * h);
        ctx.lineTo(xx + span * 0.1, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.lineWidth = near ? 2 : 1.3;
        ctx.beginPath();
        ctx.moveTo(xx, dir * h);
        ctx.lineTo(xx - span * 0.1, 0);
        ctx.stroke();
        ctx.fillStyle = rim;
        ctx.fillRect(xx - 1.2, dir * 2, 2.4, dir * Math.min(10, h * 0.2));
      }
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = edge;
        ctx.beginPath();
        ctx.arc(-span * 0.4 + i * span * 0.26, 0, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (p.kind === "gantry") {
      const h = p.h * (p.band === "high" ? 0.72 : 0.88);
      const dir = p.band === "high" ? 1 : -1;
      const W = p.w;
      ctx.fillStyle = deep;
      ctx.fillRect(-W * 0.58, 0, W * 1.16, dir * 12);
      ctx.fillRect(-W * 0.52, 0, 10, dir * h);
      ctx.fillRect(W * 0.4, 0, 10, dir * h * 0.9);
      ctx.fillRect(-W * 0.5, dir * h * 0.48, W, dir * 8);
      ctx.fillRect(-W * 0.45, dir * h * 0.78, W * 0.9, dir * 5);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.7;
      ctx.strokeRect(-W * 0.58, Math.min(0, dir * 12), W * 1.16, Math.abs(dir * 12));
      for (let i = 0; i < 4; i++) {
        const xx = -W * 0.35 + i * W * 0.22;
        ctx.fillStyle = rim;
        ctx.fillRect(xx, dir * h * 0.12, 3.5, dir * h * 0.34);
        ctx.strokeStyle = edge;
        ctx.strokeRect(xx, Math.min(dir * h * 0.12, dir * h * 0.46), 3.5, Math.abs(dir * h * 0.34));
      }
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = edge;
        ctx.beginPath();
        ctx.arc(-W * 0.45 + i * W * 0.22, dir * 6, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = rim;
      ctx.beginPath();
      ctx.moveTo(-W * 0.48, dir * h * 0.2);
      ctx.lineTo(W * 0.45, dir * h * 0.7);
      ctx.moveTo(W * 0.45, dir * h * 0.2);
      ctx.lineTo(-W * 0.48, dir * h * 0.7);
      ctx.stroke();
    } else if (p.kind === "tower") {
      const h = p.h;
      const dir = p.band === "high" ? 1 : -1;
      ctx.fillStyle = deep;
      ctx.beginPath();
      ctx.moveTo(-p.w * 0.4, 0);
      ctx.lineTo(-p.w * 0.2, dir * h);
      ctx.lineTo(p.w * 0.18, dir * h * 0.95);
      ctx.lineTo(p.w * 0.44, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = near ? 2.1 : 1.5;
      ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const yy = dir * h * (0.12 + i * 0.15);
        ctx.strokeStyle = rim;
        ctx.beginPath();
        ctx.moveTo(-p.w * (0.32 - i * 0.02), yy);
        ctx.lineTo(p.w * (0.34 - i * 0.02), yy);
        ctx.stroke();
      }
      ctx.fillStyle = edge;
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(-2, dir * h * (0.2 + i * 0.15), 4, dir * 6);
      }
      ctx.strokeStyle = rim;
      ctx.beginPath();
      ctx.moveTo(-p.w * 0.08, dir * h * 0.15);
      ctx.lineTo(-p.w * 0.02, dir * h * 0.85);
      ctx.stroke();
      ctx.fillStyle = edge;
      ctx.beginPath();
      ctx.arc(0, dir * h * 0.5, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === "chain") {
      const len = p.h * (near ? 1.05 : 0.85);
      const sway = Math.sin(t * 1.55 + p.phase) * (near ? 9 : 5);
      ctx.fillStyle = deep;
      ctx.fillRect(-8, -4, 16, 6);
      ctx.strokeStyle = edge;
      ctx.strokeRect(-8, -4, 16, 6);
      ctx.strokeStyle = edge;
      ctx.lineWidth = near ? 2.4 : 1.7;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.quadraticCurveTo(sway, len * 0.45, sway * 0.35, len);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const yy = (i + 0.6) * (len / 6.2);
        const xx = sway * (yy / len);
        ctx.fillStyle = deep;
        ctx.fillRect(xx - 5.5, yy - 3.5, 11, 7);
        ctx.strokeStyle = rim;
        ctx.strokeRect(xx - 5.5, yy - 3.5, 11, 7);
        ctx.fillStyle = edge;
        ctx.fillRect(xx - 1.2, yy - 1, 2.4, 2.4);
      }
      ctx.fillStyle = edge;
      ctx.beginPath();
      ctx.moveTo(sway * 0.35 - 5, len);
      ctx.lineTo(sway * 0.35 + 5, len);
      ctx.lineTo(sway * 0.35, len + 12);
      ctx.closePath();
      ctx.fill();
    } else if (p.kind === "blade") {
      ctx.fillStyle = deep;
      ctx.beginPath();
      ctx.moveTo(-p.w * 0.1, 0);
      ctx.lineTo(p.w * 0.82, -p.h * 0.4);
      ctx.lineTo(p.w * 0.6, -p.h * 0.18);
      ctx.lineTo(p.w * 0.14, p.h * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.7;
      ctx.stroke();
      ctx.strokeStyle = rim;
      for (let i = 0; i < 4; i++) {
        const u = 0.15 + i * 0.18;
        ctx.beginPath();
        ctx.moveTo(p.w * u * 0.5, -p.h * u * 0.15);
        ctx.lineTo(p.w * (0.2 + u * 0.5), -p.h * (0.08 + u * 0.2));
        ctx.stroke();
      }
      ctx.fillStyle = edge;
      for (let i = 0; i < 3; i++) ctx.fillRect(-2 + i * 3, -2, 2, 4);
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(p.w * 0.35, -p.h * 0.12, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === "vine" || p.kind === "bulb") {
      ctx.fillStyle = deep;
      ctx.fillRect(-6, -3, 12, 5);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      for (let i = 1; i <= 8; i++) ctx.lineTo(Math.sin(t * 1.05 + p.phase + i * 0.7) * 12, i * (p.h / 9));
      ctx.stroke();
      for (let i = 1; i <= 5; i++) {
        ctx.fillStyle = i % 2 ? rim : deep;
        ctx.beginPath();
        ctx.ellipse(Math.sin(t + i) * 8, i * (p.h / 7), 7, 3, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = deep;
      ctx.beginPath();
      ctx.arc(Math.sin(t + p.phase) * 7, p.h * 0.55, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.stroke();
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(Math.sin(t + p.phase) * 7 - 2, p.h * 0.52, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === "rib" || p.kind === "arch") {
      const h = p.h * 0.52;
      const dir = p.band === "high" ? 1 : -1;
      ctx.fillStyle = deep;
      ctx.fillRect(-p.w - 4, -4, 10, 8);
      ctx.fillRect(p.w - 6, -4, 10, 8);
      ctx.strokeStyle = deep;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(-p.w, 0);
      ctx.quadraticCurveTo(0, dir * h, p.w, 0);
      ctx.stroke();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-p.w * 0.92, 0);
      ctx.quadraticCurveTo(0, dir * h * 0.85, p.w * 0.92, 0);
      ctx.stroke();
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-p.w * 0.7, 0);
      ctx.quadraticCurveTo(0, dir * h * 0.55, p.w * 0.7, 0);
      ctx.stroke();
      ctx.fillStyle = edge;
      ctx.fillRect(-5, dir * h * 0.35 - 3, 10, 6);
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(-p.w * 0.55 + i * p.w * 0.35, dir * 2, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawAirFront(view) {
    if (mode !== "play") return;
    const th = currentTheme();
    const accent = th.accent || [210, 225, 255];
    const t = world.time || 0;
    const camX = view && view.scale ? -view.ox / view.scale : 0;
    const playX = player.x + player.w * 0.5;
    const scrollSrc = camX * 0.4 + playX * 1.3;
    const period = VIEW_W * 1.5;
    const scrollMid = ((scrollSrc * 0.95) % period + period) % period;
    const scrollNear = ((scrollSrc * 1.55) % period + period) % period;
    const bag = world.fore;
    ctx.save();
    // Edge haze — depth frame without choking the lane.
    const ar = accent[0] | 0;
    const ag = accent[1] | 0;
    const ab = accent[2] | 0;
    const hazeY = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    hazeY.addColorStop(0, `rgba(${ar},${ag},${ab},0.14)`);
    hazeY.addColorStop(0.14, "rgba(0,0,0,0)");
    hazeY.addColorStop(0.72, "rgba(0,0,0,0)");
    hazeY.addColorStop(1, `rgba(${(ar * 0.2) | 0},${(ag * 0.16) | 0},${(ab * 0.18) | 0},0.55)`);
    ctx.fillStyle = hazeY;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const hazeX = ctx.createLinearGradient(0, 0, VIEW_W, 0);
    hazeX.addColorStop(0, `rgba(${(ar * 0.18) | 0},${(ag * 0.14) | 0},${(ab * 0.16) | 0},0.4)`);
    hazeX.addColorStop(0.16, "rgba(0,0,0,0)");
    hazeX.addColorStop(0.84, "rgba(0,0,0,0)");
    hazeX.addColorStop(1, `rgba(${(ar * 0.18) | 0},${(ag * 0.14) | 0},${(ab * 0.16) | 0},0.4)`);
    ctx.fillStyle = hazeX;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Hard side blades — unmistakable fast layer, keeps the middle open.
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? 0 : VIEW_W;
      const dir = s === 0 ? 1 : -1;
      const wob = Math.sin(t * 1.2 + s) * 4;
      for (let i = 0; i < 5; i++) {
        const yy = VIEW_H * (0.08 + i * 0.18) + wob;
        const hh = 36 + (i % 3) * 18;
        const xx = side + dir * (8 + ((scrollNear * 0.15 + i * 37) % 28));
        ctx.fillStyle = `rgba(${(ar * 0.22) | 0},${(ag * 0.18) | 0},${(ab * 0.2) | 0},0.82)`;
        ctx.beginPath();
        ctx.moveTo(side, yy);
        ctx.lineTo(xx + dir * 26, yy + hh * 0.5);
        ctx.lineTo(side, yy + hh);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.7)`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(side, yy);
        ctx.lineTo(xx + dir * 26, yy + hh * 0.5);
        ctx.stroke();
      }
    }

    function paintDepth(depth, scroll, alpha) {
      if (!bag || !bag.length) return;
      for (let i = 0; i < bag.length; i++) {
        const p = bag[i];
        if ((p.depth || "mid") !== depth) continue;
        const base = p.u * period;
        for (let k = -1; k <= 1; k++) {
          const x = base - scroll + k * period;
          if (x < -160 || x > VIEW_W + 160) continue;
          // Soften pieces that cross the run corridor.
          const centerDist = Math.abs(x - VIEW_W * 0.5) / (VIEW_W * 0.5);
          const lane = p.band === "side" ? 1 : (0.45 + centerDist * 0.55);
          drawForePiece(p, x, accent, t, alpha * lane);
        }
      }
    }
    paintDepth("mid", scrollMid, 0.72);
    paintDepth("near", scrollNear, 1);

    for (let i = 0; i < 18; i++) {
      const n = frac(i * 5.1 + 0.4);
      const x = (frac(i * 2.7) * (VIEW_W + 70) - scrollNear * 0.55 + t * (12 + n * 20) + VIEW_W + 70) % (VIEW_W + 70) - 35;
      const y = (frac(i * 8.3) * VIEW_H + Math.sin(t * 0.7 + i) * 14 + VIEW_H) % VIEW_H;
      const s = n > 0.86 ? 10 : n > 0.55 ? 4.5 : 2.2;
      ctx.fillStyle = `rgba(${accent[0]},${accent[1]},${accent[2]},${0.16 + n * 0.26})`;
      ctx.fillRect(x, y, s, s);
    }
    if (view && world.door && !world.doorHidden) {
      const pad = bossAmbiencePad();
      const x = (pad.x + 16) * view.scale + view.ox;
      const y = (pad.y + 20) * view.scale + view.oy;
      const reach = 240 * view.scale;
      const beam = ctx.createLinearGradient(x, y - reach, x, y + 10);
      beam.addColorStop(0, "rgba(255,220,160,0)");
      beam.addColorStop(1, "rgba(255,206,110,0.2)");
      ctx.fillStyle = beam;
      ctx.fillRect(x - 18 * view.scale, y - reach, 36 * view.scale, reach + 16);
    }
    ctx.restore();
  }

  function drawRoomAir() {
    if (!world.cols || !world.rows) return;
    const th = currentTheme();
    const accent = th.accent || [200, 210, 230];
    const t = world.time || 0;
    const spanX = world.cols * TILE;
    const spanY = world.rows * TILE;
    const weather = th.weather || "shards";
    const ar = accent[0];
    const ag = accent[1];
    const ab = accent[2];
    for (let i = 0; i < 34; i++) {
      const u = frac(i * 6.1 + 1.7);
      const v = frac(i * 3.9);
      let x = v * spanX;
      let y = frac(i * 8.2) * spanY;
      let s = 1.2;
      let a = 0.14;
      if (weather === "rain") {
        x = (v * (spanX + 48) + t * (36 + u * 18)) % (spanX + 48) - 24;
        y = (i * 41 + t * (86 + u * 36)) % (spanY + 16);
        ctx.strokeStyle = `rgba(${ar},${ag},${ab},${0.14 + u * 0.2})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 2.5, y + 9);
        ctx.stroke();
        continue;
      }
      if (weather === "snow") {
        x = (v * spanX + Math.sin(t * 0.55 + i) * 7 + spanX) % spanX;
        y = (y + t * (7 + u * 9)) % spanY;
        s = u > 0.72 ? 2.3 : 1.35;
        a = 0.22 + u * 0.32;
      } else if (weather === "ember" || weather === "sparks") {
        x = (x + t * (5 + u * 9)) % spanX;
        y = spanY - ((y + t * (16 + u * 24)) % spanY);
        s = u > 0.84 ? 2.2 : 1.35;
        a = 0.16 + u * 0.38;
      } else if (weather === "spores") {
        x = (x + Math.sin(t * 0.35 + i) * 16 + spanX) % spanX;
        y = (y + Math.sin(t * 0.5 + i * 0.7) * 12 + spanY) % spanY;
        s = 1.5 + u * 1.4;
        a = 0.1 + u * 0.16;
      } else if (weather === "static") {
        if (u < 0.78) continue;
        y = frac(i * 4.4 + Math.floor(t * 9) * 0.17) * spanY;
        s = 1.3;
        a = 0.42;
      } else {
        x = (x + t * (4 + u * 8)) % spanX;
        y = (y + Math.sin(t * 0.7 + i) * 8 + spanY) % spanY;
        s = u > 0.82 ? 2.1 : 1.15;
        a = 0.1 + u * 0.18;
      }
      ctx.fillStyle = `rgba(${ar},${ag},${ab},${a})`;
      ctx.fillRect(x, y, s, s);
    }
    if (world.door && !world.doorHidden) {
      const pad = bossAmbiencePad();
      const x = pad.x + 16;
      const y = pad.y + 18;
      const g = ctx.createLinearGradient(x, y - 220, x, y + 48);
      g.addColorStop(0, "rgba(255,220,150,0)");
      g.addColorStop(0.72, "rgba(255,210,120,0.05)");
      g.addColorStop(1, "rgba(255,210,120,0.2)");
      ctx.fillStyle = g;
      ctx.fillRect(x - 16, y - 220, 36, 268);
      const pool = ctx.createRadialGradient(x, pad.y + 52, 4, x, pad.y + 52, 56);
      pool.addColorStop(0, "rgba(255,200,90,0.28)");
      pool.addColorStop(1, "rgba(255,200,90,0)");
      ctx.fillStyle = pool;
      ctx.beginPath();
      ctx.ellipse(x, pad.y + 50, 50, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawNullStage() {
    const b = world.boss;
    if (!b || b.dim !== 1 || !world.door || mode !== "play") return;
    const floorY = bossAmbienceFloor();
    const W = world.cols * TILE;
    const glowX = W * 0.5;
    const t = world.time || 0;
    ctx.save();
    const lip = ctx.createLinearGradient(0, floorY - 22, 0, floorY + 14);
    lip.addColorStop(0, "rgba(254, 31, 111, 0)");
    lip.addColorStop(0.62, "rgba(254, 31, 111, 0.16)");
    lip.addColorStop(1, "rgba(28, 4, 14, 0.55)");
    ctx.fillStyle = lip;
    ctx.fillRect(0, floorY - 22, W, 36);
    ctx.strokeStyle = "rgba(254, 146, 184, 0.45)";
    ctx.lineWidth = 1.25;
    ctx.lineCap = "round";
    for (let i = 2; i < world.cols - 2; i += 3) {
      const n = ((i * 17) % 7) - 3;
      const x = i * TILE + 10;
      ctx.globalAlpha = 0.35 + ((i * 3) % 5) * 0.08;
      ctx.beginPath();
      ctx.moveTo(x, floorY + 1);
      ctx.lineTo(x + 6 + n, floorY + 11);
      ctx.lineTo(x - 4, floorY + 20);
      ctx.moveTo(x + 14, floorY + 2);
      ctx.lineTo(x + 18, floorY + 9);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#fff0f6";
    ctx.fillRect(0, floorY, W, 2);
    ctx.fillStyle = "#fe92b8";
    for (let i = 0; i < 16; i++) {
      const x = (i * 113 + t * (16 + (i % 5) * 7)) % W;
      const y = floorY - 8 - ((i * 29 + t * 26) % 78);
      ctx.globalAlpha = 0.22 + (i % 4) * 0.12;
      ctx.beginPath();
      ctx.ellipse(x, y, 1.6 + (i % 3) * 0.6, 2.4 + (i % 2), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const glow = ctx.createRadialGradient(glowX, floorY, 8, glowX, floorY, 160);
    glow.addColorStop(0, "rgba(254, 31, 111, 0.28)");
    glow.addColorStop(1, "rgba(254, 31, 111, 0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.fillRect(glowX - 160, floorY - 28, 320, 40);
    ctx.restore();
  }

  function render() {
    clearBloom = Math.max(0, clearBloom - 0.016);
    if (mode === "title" || mode === "levels" || ((mode === "sideshow" || mode === "settings") && !(world.tiles && world.tiles.length))) {
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
    const inv = view.scale > 0 ? 1 / view.scale : 1;
    const pad = 3;
    const x0 = Math.max(0, (Math.floor((-view.ox) * inv / TILE) - pad) | 0);
    const x1 = Math.min(world.cols, (Math.ceil((VIEW_W - view.ox) * inv / TILE) + pad) | 0);
    const y0 = Math.max(0, (Math.floor((-view.oy) * inv / TILE) - pad) | 0);
    const y1 = Math.min(world.rows, (Math.ceil((VIEW_H - view.oy) * inv / TILE) + pad) | 0);
    for (let y = y0; y < y1; y++) {
      const row = world.tiles[y];
      if (!row) continue;
      for (let x = x0; x < x1; x++) drawTile(row[x], x, y);
    }
    drawNullStage();
    drawRoomScenery();
    drawRoomAir();
    drawBlood();
    for (const p of world.platforms) {
      drawBrickFace(p.x, p.y, "#6a4030", "#e0b090", false);
    }
    for (const d of world.drops) {
      if (d.boss && world.boss && world.boss.dim !== 1) drawBossDrop(d);
      else drawBrickFace(d.x, d.y, "#5a3830", "#c0a080", false);
    }
    drawDoor(world.door);
    drawDoor(world.fakeDoor);
    for (const coin of world.coins) {
      if (coin.dead) continue;
      const cy = coin.y + Math.sin(world.time * 6 + coin.x) * 2.4;
      const spin = world.time * 3 + coin.x * 0.1;
      const boom = !!world.rules.explodeCoins;
      const col = boom ? "#ff7a3a" : "#ffd24a";
      const glow = boom ? "rgba(255,100,40,0.35)" : "rgba(255,210,74,0.32)";
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(coin.x, cy, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(coin.x, cy);
      ctx.rotate(Math.sin(spin) * 0.25);
      // Crystal shard
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(6, -1);
      ctx.lineTo(3.5, 7);
      ctx.lineTo(-3.5, 7);
      ctx.lineTo(-6, -1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = boom ? "#ffb080" : "#fff1a8";
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(2.5, -1);
      ctx.lineTo(0, 2);
      ctx.lineTo(-1.5, -1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.globalAlpha = 0.7;
      ctx.fillRect(-1.5, -4, 1.5, 3);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    drawLasers();
    for (const saw of world.saws) {
      if (saw.boss && world.boss && world.boss.dim !== 1) drawBossSaw(saw);
      else drawSaw(saw);
    }
    drawEntities();
    drawDevil();
    drawDashReady();
    if (deathShow && window.DeathRoast) window.DeathRoast.drawWorld(ctx, deathShow, roastApi());
    drawParticles();
    ctx.restore();
    drawLighting(view);
    ctx.save();
    if (view.rot) {
      ctx.translate(VIEW_W / 2, VIEW_H / 2);
      ctx.rotate(view.rot);
      ctx.translate(-VIEW_W / 2, -VIEW_H / 2);
    }
    ctx.translate(view.ox, view.oy);
    ctx.scale(view.scale, view.scale);
    drawBoss();
    ctx.restore();
    drawNullBars();
    drawBossTalk();
    drawPit(view);
    drawAirFront(view);
    drawOverlay();
    drawQte();
    if (deathShow && window.DeathRoast) window.DeathRoast.drawScreen(ctx, deathShow, roastApi());
  }

  function step() {
    if (window.SURGE_TRAILER && window.SURGE_TRAILER.on) {
      if (window.SURGE_TRAILER.tick(FIXED)) return;
    }
    if (mode !== "play" && !testMode) return;
    if (hitstop > 0) { hitstop -= FIXED; return; }
    const steps = slowmo < 1 ? (Math.random() < slowmo ? 1 : 0) : 1;
    if (!steps && !testMode) {
      world.time += FIXED * slowmo;
      return;
    }
    if (world.shake > 16) world.shake = 16;
    world.shake = world.shake > 0.4 ? world.shake * 0.86 : 0;
    world.flash = Math.max(0, world.flash - FIXED);
    // Hard white cut: bright, then gone in a few frames.
    if ((world.whiteFlash || 0) > 0) {
      world.whiteFlash = world.whiteFlash > 0.2 ? world.whiteFlash * 0.62 : Math.max(0, world.whiteFlash - FIXED * 6);
    }
    world.hudGlitch = Math.max(0, world.hudGlitch - FIXED);
    if (world.chromatic > 0.55) world.chromatic = 0.55;
    world.chromatic = Math.max(0, world.chromatic - FIXED * 1.6);
    fadeStains();
    introT = Math.max(0, introT - FIXED);
    dimIntro = Math.max(0, dimIntro - FIXED);
    if (roomFade > 0) roomFade = Math.max(0, roomFade - FIXED * 2.6);
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
      audio.beginSpace();
      tickSaws();
      audio.endSpace();
      if (deathShow && window.DeathRoast) window.DeathRoast.tick(deathShow, roastApi());
      if (deathTimer <= 0) {
        deathShow = null;
        loadLevel(levelIndex);
      }
      return;
    }
    world.time += FIXED;
    tickPlayer();
    audio.beginSpace();
    tickSaws();
    tickLasers();
    tickPlatforms();
    tickDrops();
    tickEntities();
    audio.endSpace();
    tickParticles();
    tickEvents();
    tickBoss();
    tickRareEffects();
    tickQte();
    if (mode === "play") updateHud();
  }

  function loop(ts) {
    try {
      if (!last) last = ts;
      if (mode !== "play") audio.silenceSpace();
      if (typeof document !== "undefined" && document.hidden) {
        last = ts;
        acc = 0;
        audio.silenceSpace();
        requestAnimationFrame(loop);
        return;
      }
      let dt = (ts - last) / 1000;
      last = ts;
      if (!(window.SURGE_GUARD && window.SURGE_GUARD.allow("step-clock", dt))) {
        if (dt > 0.05) dt = 0.05;
      }
      acc += dt;
      while (acc >= FIXED) {
        step();
        acc -= FIXED;
      }
      render();
    } catch (err) {
      window.__SURGE_LOOP_ERR = String(err && err.stack || err);
    }
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
    const settingsScreen = document.getElementById("settings-screen");
    if (settingsScreen) settingsScreen.classList.add("hidden");
    const sideshowScreen = document.getElementById("sideshow-screen");
    if (sideshowScreen) sideshowScreen.classList.add("hidden");
    if (dimCard && dimIntro <= 0) dimCard.classList.add("hidden");
    hud.classList.remove("hidden");
    if (window.matchMedia("(pointer: coarse)").matches) mobile.classList.remove("hidden");
    deaths = 0;
    combo = 0;
    comboTimer = 0;
    runTraps = 0;
    levelIndex = startAt;
    clockOut = 0;
    clockOutAt = 0;
    startedAt = performance.now();
    mode = "play";
    loadLevel(levelIndex);
  }

  function pauseGame() {
    if (mode !== "play" || deathShow) return;
    releaseInput();
    player.vx = 0;
    parkClock();
    mode = "pause";
    if (pauseScreen) pauseScreen.classList.remove("hidden");
    if (dimCard) dimCard.classList.add("hidden");
    const pauseName = document.getElementById("pause-name");
    if (pauseName) pauseName.textContent = world.name;
    const pauseTaunt = document.getElementById("pause-taunt");
    if (pauseTaunt) pauseTaunt.textContent = world.taunt || "";
    const pauseDeaths = document.getElementById("pause-deaths");
    if (pauseDeaths) pauseDeaths.textContent = "DEAD " + deaths;
    if (pauseBtn) pauseBtn.setAttribute("aria-pressed", "true");
    audio.play("pause");
  }

  function resumeGame() {
    if (mode !== "pause") return;
    if (pauseScreen) pauseScreen.classList.add("hidden");
    if (dimCard && dimIntro > 0) dimCard.classList.remove("hidden");
    releaseClock();
    if (!bindHeld("left") && !bindHeld("right") && !hold.left && !hold.right) {
      player.vx = 0;
    }
    if (pauseBtn) pauseBtn.setAttribute("aria-pressed", "false");
    mode = "play";
  }

  function leavePlayUi() {
    if (pauseScreen) pauseScreen.classList.add("hidden");
    if (levelsScreen) levelsScreen.classList.add("hidden");
    const settingsScreen = document.getElementById("settings-screen");
    if (settingsScreen) settingsScreen.classList.add("hidden");
    const sideshowScreen = document.getElementById("sideshow-screen");
    if (sideshowScreen) sideshowScreen.classList.add("hidden");
    if (dimCard) dimCard.classList.add("hidden");
    winScreen.classList.add("hidden");
    clearScreen.classList.add("hidden");
    hud.classList.add("hidden");
    mobile.classList.add("hidden");
    deathShow = null;
    deathTimer = 0;
  }

  function quitToTitle() {
    if (creatorReturn) {
      const cb = creatorReturn;
      creatorReturn = null;
      creatorPlay = false;
      testMode = false;
      leavePlayUi();
      mode = "creator";
      cb({ reason: "quit" });
      return;
    }
    leavePlayUi();
    mode = "title";
    titleScreen.classList.remove("hidden");
    refreshRecords();
  }

  function playCustom(levels, opts) {
    opts = opts || {};
    const G = window.SURGE_GUARD;
    if (!G) return false;
    const incoming = Array.isArray(levels) ? levels : [levels];
    const pack = [];
    for (const lvl of incoming) {
      const clean = G.sanitizeRoom(lvl);
      if (clean) pack.push(clean);
    }
    if (!pack.length) return false;
    creatorReturn = typeof opts.onExit === "function" ? opts.onExit : null;
    creatorPlay = true;
    testMode = true;
    if (window.SURGE_GUARD && window.SURGE_GUARD.allow && !window.SURGE_GUARD.allow("custom-isolated", testMode)) {
      return false;
    }
    window.LEVELS = pack;
    dimIndex = Math.max(1, Math.min(20, opts.dim || 1));
    audio.unlock();
    audio.setTheme(dimIndex);
    audio.restartMusic();
    shardsGot = 0;
    dimIntro = 0;
    if (dimCard) dimCard.classList.add("hidden");
    if (dashBtn) dashBtn.classList.toggle("hidden", dimIndex < 3);
    titleScreen.classList.add("hidden");
    const creatorScreen = document.getElementById("creator-screen");
    if (creatorScreen) creatorScreen.classList.add("hidden");
    startGame(opts.from || 0);
    return true;
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

  let levelsView = "worlds";
  let levelsPickDim = 1;

  function setLevelsChrome(stamp, hint) {
    const stampEl = document.getElementById("levels-stamp");
    const hintEl = document.getElementById("levels-hint");
    if (stampEl) stampEl.textContent = stamp;
    if (hintEl) hintEl.textContent = hint;
  }

  function fillLevelGrid() {
    const grid = document.getElementById("level-grid");
    if (!grid || !window.SURGE_WORLDS) return;
    levelsView = "worlds";
    setLevelsChrome("WORLDS", "Clear a dimension to wake the next. Pick a world, then a room.");
    const s = loadSave();
    const unlocked = s.unlockedDim || 1;
    const rec = s.dimRecords || {};
    const progress = s.rooms || {};
    grid.innerHTML = "";
    grid.classList.remove("room-grid");
    grid.classList.add("world-grid");
    const frag = document.createDocumentFragment();
    window.SURGE_WORLDS.DIMS.forEach((dim, i) => {
      const d = i + 1;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "level-cell world-cell";
      const locked = d > unlocked;
      b.disabled = locked;
      const rooms = window.SURGE_WORLDS.roomCount(d);
      const traps = window.SURGE_WORLDS.trapCount(d);
      const reached = progress[d] != null ? progress[d] : (locked ? -1 : 0);
      const deathsN = rec[d] && typeof rec[d].bestDeaths === "number" ? rec[d].bestDeaths : null;
      const recLine = deathsN == null ? "" : " · " + deathsN + " DEAD";
      const num = document.createElement("span");
      num.className = "n";
      num.textContent = "D" + String(d).padStart(2, "0");
      const nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = locked ? "LOCKED" : String(dim.name || "");
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = locked
        ? rooms + " rooms · " + traps + " traps"
        : "room " + Math.min(rooms, reached + 1) + "/" + rooms + " · " + traps + " traps" + recLine;
      b.appendChild(num);
      b.appendChild(nm);
      b.appendChild(meta);
      b.onclick = () => showRoomSelect(d);
      frag.appendChild(b);
    });
    grid.appendChild(frag);
  }

  function showRoomSelect(d) {
    const grid = document.getElementById("level-grid");
    const pack = window.SURGE_WORLDS;
    if (!grid || !pack) return;
    const unlocked = loadSave().unlockedDim || 1;
    if (d > unlocked) return;
    levelsView = "rooms";
    levelsPickDim = d;
    const dim = pack.DIMS[d - 1] || { name: "NULLSCAPE" };
    const roomsN = pack.roomCount(d);
    setLevelsChrome(
      "D" + String(d).padStart(2, "0") + " " + String(dim.name || ""),
      "Pick a room. Cleared rooms stay open. Locked rooms wait until you reach them."
    );
    const s = loadSave();
    const reached = s.rooms && s.rooms[d] != null ? s.rooms[d] : 0;
    const lastRoom = (s.lastDim === d && s.lastRoom != null) ? s.lastRoom : -1;
    const packLevels = pack.generate(d);
    grid.innerHTML = "";
    grid.classList.remove("world-grid");
    grid.classList.add("room-grid");
    for (let i = 0; i < roomsN; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "level-cell room-cell";
      const locked = i > reached;
      const cleared = i < reached || (reached >= roomsN - 1 && i <= reached);
      if (i === lastRoom) b.classList.add("now");
      if (!locked && cleared && i < reached) b.classList.add("cleared");
      b.disabled = locked;
      const lvl = packLevels[i] || {};
      const gate = i === roomsN - 1;
      if (gate) {
        b.classList.add("gate");
        const accent = dim.accent || [255, 210, 122];
        b.style.setProperty("--gate", "rgb(" + (accent[0] | 0) + "," + (accent[1] | 0) + "," + (accent[2] | 0) + ")");
      }
      const bossStage = d === 1 && gate;
      const num = document.createElement("span");
      num.className = "n";
      num.textContent = bossStage ? "BOSS STAGE 1" : ("ROOM " + String(i + 1).padStart(2, "0"));
      const nm = document.createElement("span");
      nm.className = "nm";
      const shown = String(lvl.name || ("ROOM " + (i + 1))).replace(/\bBOSS\b/ig, "").replace(/\s+/g, " ").trim();
      nm.textContent = bossStage ? "" : (locked ? "LOCKED" : shown);
      const meta = document.createElement("span");
      meta.className = "meta";
      if (locked) meta.textContent = "reach room " + (reached + 1) + " first";
      else if (i === lastRoom) meta.textContent = "last played";
      else if (i < reached) meta.textContent = "cleared";
      else meta.textContent = "open";
      b.appendChild(num);
      b.appendChild(nm);
      b.appendChild(meta);
      b.onclick = () => enterDimension(d, i);
      grid.appendChild(b);
    }
  }

  function showLevels() {
    audio.unlock();
    titleScreen.classList.add("hidden");
    if (levelsScreen) levelsScreen.classList.remove("hidden");
    mode = "levels";
    fillLevelGrid();
  }

  function levelsGoBack() {
    if (levelsView === "rooms") {
      fillLevelGrid();
      return;
    }
    quitToTitle();
  }

  const playTabs = document.getElementById("play-tabs");
  const aboutTabs = document.getElementById("about-tabs");
  function showHub(which) {
    if (playTabs) playTabs.classList.toggle("hidden", which !== "play");
    if (aboutTabs) aboutTabs.classList.toggle("hidden", which !== "about");
    const playMenu = document.getElementById("play-menu-btn");
    const aboutMenu = document.getElementById("about-menu-btn");
    if (playMenu) playMenu.setAttribute("aria-expanded", which === "play" ? "true" : "false");
    if (aboutMenu) aboutMenu.setAttribute("aria-expanded", which === "about" ? "true" : "false");
  }
  const playMenuBtn = document.getElementById("play-menu-btn");
  if (playMenuBtn) playMenuBtn.onclick = () => showHub(playTabs && playTabs.classList.contains("hidden") ? "play" : "");
  const aboutMenuBtn = document.getElementById("about-menu-btn");
  if (aboutMenuBtn) aboutMenuBtn.onclick = () => showHub(aboutTabs && aboutTabs.classList.contains("hidden") ? "about" : "");
  document.getElementById("play-btn").onclick = () => {
    const s = loadSave();
    enterDimension(s.lastDim || 1, s.lastRoom != null ? s.lastRoom : 0);
  };
  document.getElementById("again-btn").onclick = () => enterDimension(dimIndex, 0);
  const nextDimBtn = document.getElementById("next-dim-btn");
  if (nextDimBtn) nextDimBtn.onclick = () => enterDimension(Math.min(20, dimIndex + 1), 0);
  const levelsBtn = document.getElementById("levels-btn");
  if (levelsBtn) levelsBtn.onclick = showLevels;
  const settingsBtn = document.getElementById("settings-btn");
  if (settingsBtn) settingsBtn.onclick = () => showSettings("title");
  const settingsMute = document.getElementById("settings-mute");
  if (settingsMute) settingsMute.onclick = () => { audio.unlock(); toggleMute(); };
  const pauseSettingsBtn = document.getElementById("pause-settings-btn");
  if (pauseSettingsBtn) pauseSettingsBtn.onclick = () => showSettings("pause");
  const sideshowBtn = document.getElementById("sideshow-btn");
  if (sideshowBtn) sideshowBtn.onclick = () => showSideshow("title");
  const pauseSideshowBtn = document.getElementById("pause-sideshow-btn");
  if (pauseSideshowBtn) pauseSideshowBtn.onclick = () => showSideshow("pause");
  const sideshowPrev = document.getElementById("sideshow-prev");
  if (sideshowPrev) sideshowPrev.onclick = () => stepSideshow(-1);
  const sideshowNext = document.getElementById("sideshow-next");
  if (sideshowNext) sideshowNext.onclick = () => stepSideshow(1);
  const sideshowClose = document.getElementById("sideshow-close");
  if (sideshowClose) sideshowClose.onclick = closeSideshow;
  const settingsBack = document.getElementById("settings-back");
  if (settingsBack) settingsBack.onclick = closeSettings;
  const bindReset = document.getElementById("bind-reset");
  if (bindReset) bindReset.onclick = () => {
    binds = cloneBinds(BIND_DEFAULTS);
    bindCapture = null;
    saveBinds();
    paintBinds();
    paintControlHint();
  };
  loadBinds();
  paintControlHint();
  const levelsBack = document.getElementById("levels-back");
  if (levelsBack) levelsBack.onclick = levelsGoBack;
  const resumeBtn = document.getElementById("resume-btn");
  if (resumeBtn) resumeBtn.onclick = resumeGame;
  const retryBtn = document.getElementById("retry-btn");
  if (retryBtn) retryBtn.onclick = () => { if (pauseScreen) pauseScreen.classList.add("hidden"); mode = "play"; deathTimer = 0; loadLevel(levelIndex); };
  const quitBtn = document.getElementById("quit-btn");
  if (quitBtn) quitBtn.onclick = quitToTitle;
    if (pauseBtn) pauseBtn.onclick = () => {
      if (window.SURGE_TRAILER && window.SURGE_TRAILER.on) return;
      if (deathShow) return;
      if (mode === "play") pauseGame();
      else if (mode === "pause") resumeGame();
    };
    muteBtn.onclick = () => {
      audio.unlock();
      toggleMute();
    };
  try {
    const muteBit = localStorage.getItem("level-surge-mute");
    if (window.SURGE_GUARD && window.SURGE_GUARD.allow("mute-flag", muteBit) && muteBit === "1") audio.setMuted(true);
  } catch (_) { /* private mode */ }
  syncMuteButton();

  function toggleMute() {
    audio.setMuted(!audio.muted);
    try { localStorage.setItem("level-surge-mute", audio.muted ? "1" : "0"); } catch (_) { /* quota */ }
    syncMuteButton();
  }

  function syncMuteButton() {
    if (muteBtn) {
      muteBtn.textContent = audio.muted ? "MUTED" : "SOUND";
      muteBtn.setAttribute("aria-pressed", audio.muted ? "true" : "false");
      muteBtn.setAttribute("aria-label", audio.muted ? "Unmute" : "Mute");
    }
    const settingsMute = document.getElementById("settings-mute");
    if (settingsMute) {
      settingsMute.textContent = audio.muted ? "SOUND OFF" : "SOUND ON";
      settingsMute.setAttribute("aria-pressed", audio.muted ? "true" : "false");
    }
  }

  function setMode(m) {
    if (window.SURGE_GUARD && window.SURGE_GUARD.allow && !window.SURGE_GUARD.allow("mode", m)) return;
    mode = m;
  }

  function roastSkippable() {
    return !!(deathShow && deathShow.t >= 0.55 && mode === "play" && !testMode);
  }

  function retryLevel() {
    if (pauseScreen) pauseScreen.classList.add("hidden");
    deathShow = null;
    deathTimer = 0;
    mode = "play";
    loadLevel(levelIndex);
  }

  window.addEventListener("pointerdown", (e) => {
    audio.unlock();
    if (roastSkippable() && !(e.target && e.target.closest && e.target.closest("button, a"))) {
      retryLevel();
      return;
    }
    if (mode !== "play" || !world.qte || player.dead) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const b = world.qte.box;
    if (!b || x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) return;
    if (world.qte.phase !== "go") return;
    pressQte(world.qte.keys[world.qte.index]);
  });
  function cloneBinds(src) {
    const out = {};
    const names = Object.keys(BIND_DEFAULTS);
    for (let i = 0; i < names.length; i++) {
      const k = names[i];
      const list = (src && src[k]) || BIND_DEFAULTS[k];
      out[k] = list.slice();
    }
    return out;
  }

  function loadBinds() {
    binds = cloneBinds(BIND_DEFAULTS);
    const G = window.SURGE_GUARD;
    if (!G || !G.openBlob) return;
    let text = null;
    try { text = localStorage.getItem("level-surge-binds"); } catch (_) { return; }
    const raw = G.openBlob("binds", text);
    if (!raw) return;
    const names = Object.keys(BIND_DEFAULTS);
    for (let i = 0; i < names.length; i++) {
      const k = names[i];
      if (Array.isArray(raw[k]) && raw[k].length) binds[k] = raw[k].slice(0, 3);
    }
  }

  function saveBinds() {
    const G = window.SURGE_GUARD;
    if (!G || !G.packBlob) return;
    const encoded = G.packBlob("binds", binds);
    try { if (encoded) localStorage.setItem("level-surge-binds", encoded); } catch (_) { /* quota */ }
  }

  function codeLabel(code) {
    if (!code) return "—";
    if (code === "Space") return "SPACE";
    if (code === "Escape") return "ESC";
    if (code === "ArrowLeft") return "LEFT";
    if (code === "ArrowRight") return "RIGHT";
    if (code === "ArrowUp") return "UP";
    if (code === "ArrowDown") return "DOWN";
    if (code === "ShiftLeft" || code === "ShiftRight") return "SHIFT";
    if (code.indexOf("Key") === 0) return code.slice(3);
    if (code.indexOf("Digit") === 0) return code.slice(5);
    return code;
  }

  function bindCodes(action) {
    if (!binds) loadBinds();
    return binds[action] || BIND_DEFAULTS[action] || [];
  }

  function bindHeld(action) {
    const list = bindCodes(action);
    for (let i = 0; i < list.length; i++) if (keys.has(list[i])) return true;
    return false;
  }

  function bindHit(e, action) {
    const code = e.code || "";
    return !!code && bindCodes(action).indexOf(code) >= 0;
  }

  function movementCode(code) {
    return bindCodes("left").indexOf(code) >= 0 || bindCodes("right").indexOf(code) >= 0
      || bindCodes("jump").indexOf(code) >= 0 || bindCodes("dash").indexOf(code) >= 0;
  }

  function expandBind(code) {
    if (code === "ShiftLeft" || code === "ShiftRight") return ["ShiftLeft", "ShiftRight"];
    return [code];
  }

  function assignBind(action, code) {
    if (!code || !BIND_DEFAULTS[action]) return;
    const next = expandBind(code);
    const names = Object.keys(binds);
    for (let i = 0; i < names.length; i++) {
      if (names[i] === action) continue;
      binds[names[i]] = binds[names[i]].filter((c) => next.indexOf(c) < 0);
      if (!binds[names[i]].length) {
        binds[names[i]] = BIND_DEFAULTS[names[i]].filter((c) => next.indexOf(c) < 0);
      }
    }
    binds[action] = next;
    bindCapture = null;
    saveBinds();
    paintBinds();
    paintControlHint();
  }

  function paintControlHint() {
    // Title keeps brand + buttons only. Bindings live under SETTINGS.
  }

  function paintBinds() {
    const list = document.getElementById("bind-list");
    if (!list || !binds) return;
    list.innerHTML = "";
    const names = Object.keys(BIND_LABELS);
    for (let i = 0; i < names.length; i++) {
      const action = names[i];
      const row = document.createElement("div");
      row.className = "bind-row";
      const name = document.createElement("span");
      name.textContent = BIND_LABELS[action];
      const btn = document.createElement("button");
      btn.type = "button";
      const labels = [];
      const seen = {};
      for (let j = 0; j < binds[action].length; j++) {
        const lab = codeLabel(binds[action][j]);
        if (seen[lab]) continue;
        seen[lab] = true;
        labels.push(lab);
      }
      const armed = bindCapture === action;
      btn.textContent = armed ? "PRESS A KEY" : (labels.join(" / ") || "—");
      if (armed) btn.className = "arm";
      btn.onclick = () => {
        bindCapture = action;
        paintBinds();
      };
      row.appendChild(name);
      row.appendChild(btn);
      list.appendChild(row);
    }
  }

  function showSettings(from) {
    settingsReturn = from || "title";
    bindCapture = null;
    if (!binds) loadBinds();
    titleScreen.classList.add("hidden");
    if (pauseScreen) pauseScreen.classList.add("hidden");
    if (levelsScreen) levelsScreen.classList.add("hidden");
    const screen = document.getElementById("settings-screen");
    if (screen) screen.classList.remove("hidden");
    mode = "settings";
    paintBinds();
  }

  function closeSettings() {
    bindCapture = null;
    const screen = document.getElementById("settings-screen");
    if (screen) screen.classList.add("hidden");
    if (settingsReturn === "pause") {
      mode = "pause";
      if (pauseScreen) pauseScreen.classList.remove("hidden");
      return;
    }
    mode = "title";
    titleScreen.classList.remove("hidden");
    paintControlHint();
  }

  let sideshowReturn = "title";
  let sideshowIndex = 0;

  function sideshowCards() {
    return document.querySelectorAll("#sideshow-scroll .sideshow-platform");
  }

  function nearestSideshow() {
    const scroller = document.getElementById("sideshow-scroll");
    const cards = sideshowCards();
    if (!scroller || !cards.length) return 0;
    const mark = scroller.scrollTop + scroller.clientHeight * 0.28;
    let best = 0;
    let bestD = 1e9;
    for (let i = 0; i < cards.length; i++) {
      const d = Math.abs(cards[i].offsetTop - mark);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function paintSideshow() {
    const cards = sideshowCards();
    const count = document.getElementById("sideshow-count");
    if (count) count.textContent = (cards.length ? sideshowIndex + 1 : 0) + " / " + cards.length;
    for (let i = 0; i < cards.length; i++) cards[i].classList.toggle("is-near", i === sideshowIndex);
  }

  function showSideshow(from) {
    sideshowReturn = from || "title";
    sideshowIndex = 0;
    titleScreen.classList.add("hidden");
    if (pauseScreen) pauseScreen.classList.add("hidden");
    const screen = document.getElementById("sideshow-screen");
    if (screen) {
      screen.classList.remove("hidden");
      const scroller = document.getElementById("sideshow-scroll");
      if (scroller) scroller.scrollTop = 0;
    }
    mode = "sideshow";
    paintSideshow();
    if (window.SURGE_SIDESHOW && window.SURGE_SIDESHOW.wake) window.SURGE_SIDESHOW.wake();
  }

  function closeSideshow() {
    const screen = document.getElementById("sideshow-screen");
    if (screen) screen.classList.add("hidden");
    if (sideshowReturn === "pause") {
      mode = "pause";
      if (pauseScreen) pauseScreen.classList.remove("hidden");
      return;
    }
    mode = "title";
    titleScreen.classList.remove("hidden");
  }

  function stepSideshow(dir) {
    const cards = sideshowCards();
    sideshowIndex = nearestSideshow();
    const next = sideshowIndex + dir;
    if (next < 0 || next >= cards.length) return;
    sideshowIndex = next;
    const scroller = document.getElementById("sideshow-scroll");
    const card = cards[sideshowIndex];
    if (scroller && card) {
      const top = card.offsetTop - scroller.clientHeight * 0.18;
      scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
    paintSideshow();
  }

  function trackKey(e, down) {
    /* Physical codes only — e.key casing breaks under Shift (A vs a) and sticks movement. */
    const code = e.code || "";
    if (!code) return;
    if (down) {
      keys.add(code);
      return;
    }
    keys.delete(code);
    if (code === "KeyA") { keys.delete("a"); keys.delete("A"); }
    if (code === "KeyD") { keys.delete("d"); keys.delete("D"); }
    if (code === "KeyW") { keys.delete("w"); keys.delete("W"); }
    if (code === "KeyS") { keys.delete("s"); keys.delete("S"); }
    if (code === "Space") keys.delete(" ");
    if (code === "ShiftLeft" || code === "ShiftRight") keys.delete("Shift");
  }

  window.addEventListener("keydown", (e) => {
    audio.unlock();
    if (window.SURGE_TRAILER && window.SURGE_TRAILER.on) {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Shift"].includes(e.key) ||
          e.code === "Space" || e.code.startsWith("Shift")) e.preventDefault();
      if (e.repeat) return;
      if (e.key === "Escape") window.SURGE_TRAILER.stop();
      else if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") window.SURGE_TRAILER.cut();
      return;
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Shift"].includes(e.key) ||
        e.code === "Space" || e.code.startsWith("Shift")) e.preventDefault();
    if (mode === "settings") {
      e.preventDefault();
      if (e.repeat) return;
      if (bindCapture) {
        assignBind(bindCapture, e.code);
        return;
      }
      if (e.key === "Escape") closeSettings();
      return;
    }
    if (mode === "sideshow") {
      e.preventDefault();
      if (e.repeat) return;
      if (e.key === "Escape") closeSideshow();
      else if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "Enter") stepSideshow(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") stepSideshow(-1);
      return;
    }
    if (!e.repeat && bindHit(e, "mute")) {
      const q = world.qte;
      const letter = (e.key || "").toLowerCase();
      const qteOwns = q && mode === "play" && !player.dead && q.phase === "go" &&
        q.keys && q.keys[q.index] && String(q.keys[q.index]).toLowerCase() === letter;
      if (!qteOwns) toggleMute();
    }
    if (mode === "pause") {
      if (bindHit(e, "pause")) resumeGame();
      else if (!e.repeat && bindHit(e, "retry")) retryLevel();
      return;
    }
    trackKey(e, true);
    if (mode === "play" && world.qte && !player.dead && !e.repeat && e.key.length === 1 && /[a-z]/i.test(e.key) && !movementCode(e.code || "")) {
      pressQte(e.key);
      return;
    }
    if (mode === "creator") {
      return;
    }
    if (mode === "title" && (e.key === "Enter" || e.key === " ")) {
      const s = loadSave();
      enterDimension(s.lastDim || 1, s.lastRoom != null ? s.lastRoom : 0);
    }
    else if (mode === "levels" && (e.key === "Escape" || bindHit(e, "pause"))) levelsGoBack();
    else if (mode === "clear") nextLevel();
    else if (mode === "win" && e.key === "Enter") enterDimension(dimIndex >= 20 ? 1 : dimIndex + 1, 0);
    else if (mode === "play" && deathShow) {
      if (!e.repeat && roastSkippable() && (bindHit(e, "retry") || e.key === " " || e.key === "Enter")) {
        retryLevel();
      }
    }
    else if (mode === "play" && bindHit(e, "pause")) pauseGame();
    else if (mode === "play" && !e.repeat && bindHit(e, "retry")) {
      deathTimer = 0;
      loadLevel(levelIndex);
    }
  });
  window.addEventListener("keyup", (e) => trackKey(e, false));
  window.addEventListener("blur", () => {
    releaseInput();
    player.vx = 0;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      releaseInput();
      player.vx = 0;
    }
  });
  clearScreen.addEventListener("click", () => { if (mode === "clear") nextLevel(); });

  function bindHold(id, prop) {
    const el = document.getElementById(id);
    if (!el) return;
    const on = (e) => {
      e.preventDefault();
      audio.unlock();
      if (prop === "jump" && roastSkippable()) {
        retryLevel();
        return;
      }
      hold[prop] = true;
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    };
    const off = (e) => { e.preventDefault(); hold[prop] = false; };
    el.addEventListener("pointerdown", on);
    el.addEventListener("pointerup", off);
    el.addEventListener("pointercancel", off);
    el.addEventListener("lostpointercapture", off);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
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

  function sceneryPartAudit() {
    // Count fill/stroke primitives the same way boss forms do — min 20 per kind.
    const kinds = ["chain", "hook", "drip", "vine", "lamp", "bulb", "pipe", "brace", "panel", "banner", "rib", "lamppost", "shard"];
    const counts = {};
    const mock = {
      n: 0,
      fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
      save() {}, restore() {}, translate() {}, scale() {}, rotate() {},
      beginPath() { this.n += 1; },
      closePath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {},
      arc() {}, ellipse() {},
      fill() {}, stroke() {},
      fillRect() { this.n += 1; },
      strokeRect() { this.n += 1; },
    };
    for (let i = 0; i < kinds.length; i++) {
      mock.n = 0;
      drawSceneryProp({ kind: kinds[i], x: 0, y: 0, face: 0, s: 1, phase: 0.4, hang: 1, role: "hang" }, [220, 120, 80], 1.25, mock);
      counts[kinds[i]] = mock.n;
    }
    return counts;
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
    assert(world.scenery && world.scenery.length === 0, "scenery props off", fails);
    if (window.SURGE_WORLDS && window.SURGE_WORLDS.auditDiscovery) {
      const early = window.SURGE_WORLDS.auditDiscovery();
      assert(!early.length, "trap discovery " + early.slice(0, 3).join("; "), fails);
    }
    if (window.SURGE_WORLDS && window.SURGE_WORLDS.blankMind) {
      const W = window.SURGE_WORLDS;
      const empty = W.blankMind();
      assert(W.mindDominant(empty) === "", "empty mind quiet", fails);
      empty.dash = 2.2;
      assert(W.mindDominant(empty) === "dash", "dash habit wins", fails);
      assert(!W.mindPlan(14, empty), "mind sleeps before D15", fails);
      assert(!!W.mindPlan(15, empty), "mind wakes at D15", fails);
      const audit = W.auditMindCounter(empty, 15);
      assert(audit.ok, "mind counters dash " + audit.delta + " " + audit.habit, fails);
      const d14 = W.generate(14, empty);
      assert(!(d14[0] && d14[0].mindHabit), "D14 ignores mind", fails);
      const d15 = W.generate(15, empty);
      assert(d15[0] && d15[0].mindHabit === "dash", "D15 stamps habit", fails);
    }
    assert(world.fore && world.fore.length === 0, "fore props off", fails);
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
    const firedBefore = world.trapsFired;
    world.time = 50;
    world.events = [{ if: { time: 50 }, once: true, fired: false, do: [["shake", 1]] }];
    step();
    assert(world.trapsFired === firedBefore + 1, "trap fires", fails);
    assert(world.events[0].rearmAt == null, "once trap does not rearm", fails);
    world.time = 56;
    step();
    assert(world.events[0].fired === true, "once trap stays spent", fails);
    assert(world.trapsFired === firedBefore + 1, "once trap does not fire again", fails);
    world.time = 1;
    world.events = [{ if: { time: 0 }, times: 2, rearm: 1.2, fired: false, do: [["shake", 1]] }];
    const repeatBefore = world.trapsFired;
    step();
    assert(world.trapsFired === repeatBefore + 1, "repeat trap first hit", fails);
    assert(world.events[0].rearmAt != null, "repeat trap rearms", fails);
    const againAt = world.events[0].rearmAt;
    world.time = againAt - 0.05;
    step();
    assert(world.trapsFired === repeatBefore + 1, "repeat trap waits out cooldown", fails);
    world.time = againAt;
    step();
    assert(world.trapsFired === repeatBefore + 2, "repeat trap second hit", fails);
    assert(world.events[0].rearmAt == null, "repeat trap stops at its count", fails);
    world.time = againAt + 5;
    step();
    assert(world.trapsFired === repeatBefore + 2, "repeat trap does not pass its count", fails);
    world.time = 1;
    world.events = [{ if: { time: 0 }, times: 9, rearm: 0.2, fired: false, do: [["shake", 1]] }];
    const capBefore = world.trapsFired;
    for (let n = 0; n < 8; n++) {
      step();
      world.time += 0.25;
    }
    assert(world.trapsFired === capBefore + 4, "repeat cap is 4", fails);
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
        else if (type === "slip") runAction(["slip", 0.2]);
        else if (type === "jumpCut") runAction(["jumpCut", 0.6, 0.2]);
        else if (type === "magnet") runAction(["magnet", 10, 0.1, 0.2]);
        else if (type === "blink") runAction(["blink", 2, 8, 1, 1, 0.2]);
        else if (type === "clamp") runAction(["clamp", 4, 8, 0.2]);
        else if (type === "echo") runAction(["echo", 0.2]);
        else if (type === "sticky") runAction(["sticky", 0.2]);
        else if (type === "rift") runAction(["rift", 0.3]);
        else if (type === "blackout") runAction(["blackout", 0.2]);
        else if (type === "heavy") runAction(["heavy", 1.3, 0.2]);
        else if (type === "stalker") runAction(["stalker", 70, 0.3, 3]);
        else if (type === "drone") runAction(["drone", 4, 3, 0.3]);
        else if (type === "rocket") runAction(["rocket", 1, 8, 0.3, 0.05]);
        else if (type === "voidFog") runAction(["voidFog", 0.3]);
        else if (type === "watcher") runAction(["watcher", 10, 2, 0.3]);
        else if (type === "sentry") runAction(["sentry", 1, 8, 0.3]);
        else if (type === "swarm") runAction(["swarm", 6, 1, 2]);
        else if (type === "phantom") runAction(["phantom", 0.3]);
        else if (type === "huntLight") runAction(["huntLight", 0.3, 70]);
        else if (type === "crushBot") runAction(["crushBot", 4, 0.4, 5]);
        else if (type === "qte") {
          player.dead = false;
          player.win = false;
          runAction(["qte", 0.4, 74]);
          assert(world.qte && world.qte.phase === "go" && world.qte.strict && world.qte.keys[0] === "J", "qte arms", fails);
          const before = deaths;
          pressQte("Q");
          assert(player.dead && deaths === before + 1 && !world.qte, "qte wrong key kills", fails);
          assert(deathKind("QTE") === "qte", "qte kind", fails);
          player.dead = false;
          runAction(["qte", 0.4, 74, 75]);
          pressQte("J");
          assert(world.qte && world.qte.index === 1, "qte advances", fails);
          pressQte("K");
          assert(!world.qte && !player.dead, "qte clears", fails);
          runAction(["qte", 1.1, 74]);
          assert(world.qte && world.qte.phase === "arm" && world.qte.strict && world.qte.lock, "easy qte winds up", fails);
          pressQte("J");
          assert(world.qte && world.qte.phase === "arm", "qte ignores keys while arming", fails);
          world.qte.phase = "go";
          world.qte.left = world.qte.window;
          pressQte("Q");
          assert(player.dead && !world.qte, "easy qte miss kills", fails);
          player.dead = false;
          runAction(["qte", 1.1, 74]);
          world.qte.phase = "go";
          world.qte.left = world.qte.window;
          pressQte("J");
          assert(!world.qte && !player.dead, "easy qte accepts the key", fails);
          runAction(["qte", 0.4, 74]);
          world.qte.left = 0;
          world.qte.slop = 0;
          tickQte();
          assert(player.dead && !world.qte, "qte timeout kills", fails);
          player.dead = false;
        }
        else runAction([type]);
      } catch (e) {
        fails.push("action " + type + ": " + e.message);
      }
    }

    enterDimension(1, 16);
    assert(!!world.boss && world.boss.goal === 7, "D1 boss goal " + (world.boss && world.boss.goal), fails);
    const flat = world.rules.surface || [];
    assert(flat.length > 8 && flat.every((y) => y === flat[0] && y > 0), "boss floor flat", fails);
    let doorMove = false;
    (world.events || []).forEach((ev) => {
      (ev.do || []).forEach((a) => {
        if (a && a[0] === "moveDoor") doorMove = true;
      });
    });
    assert(!doorMove, "no scripted door move", fails);
    const ids = window.SURGE_WORLDS.bossAttackIds();
    assert(ids.length === 10, "ten attacks " + ids.length, fails);
    const voice = window.SURGE_BOSS_VOICE;
    assert(!!voice, "boss voice loaded", fails);
    Object.keys(voice.all).forEach((d) => {
      const v = voice.all[d];
      (v.dead || []).forEach((line) => {
        assert(line && line.length <= 22, "dead fit D" + d + " [" + line + "]", fails);
      });
      assert(!v.back || v.back.length <= 22, "back fit D" + d + " [" + v.back + "]", fails);
    });
    assert(deathCopy("BOSS BOOM") === "I fell on you.", "boom line " + deathCopy("BOSS BOOM"), fails);
    assert(deathKind("BOSS BOLT") === "boss", "bolt kind", fails);
    assert(deathKind("SAW SAID HI") !== "boss", "room saw is not a boss kill", fails);

    function hushBoss() {
      world.events = [];
      world.coins = [];
      world.saws = [];
      world.lasers = [];
      world.drops = [];
      world.entities = [];
      world.queued = [];
      world.bossShots = [];
      world.bossZones = [];
      world.wind = 0;
      world.reverse = false;
      world.magnet = null;
      if (world.baseGravity) world.gravity = world.baseGravity;
      player.dead = false;
      player.win = false;
      player.vx = 0;
      player.vy = 0;
      if (world.boss) {
        world.boss.atkCd = 40;
        world.boss.arrive = 0;
        world.boss.rush = null;
        world.boss.wave = null;
        world.boss.echo = null;
        world.boss.gravUntil = 0;
        world.boss.flipUntil = 0;
        world.boss.windUntil = 0;
        world.boss.tell = null;
        world.boss.say = null;
        world.boss.snatch = null;
        world.boss.drive = null;
        world.boss.wave = null;
        world.boss.half = null;
        world.boss.plan = null;
        world.boss.gap = 0;
        world.boss.rest = 8;
        world.boss.dropping = false;
        world.boss.drop = null;
        world.boss.saidBored = false;
        world.boss.fightAt = null;
      }
      world.nullBeams = [];
      world.bossFog = 0;
      world.magnet = null;
    }

    hushBoss();
    const parked = world.door.x;
    player.x = 40;
    for (let frame = 0; frame < 180; frame++) {
      world.boss.doorCd = 40;
      world.boss.atkCd = 40;
      world.boss.tell = null;
      player.dead = false;
      player.win = false;
      step();
    }
    assert(world.door.x === parked, "door stays while far " + world.door.x, fails);
    assert(world.boss.moves === 0, "no steals while far", fails);

    hushBoss();
    const beforeClose = world.door.x;
    player.x = world.door.x - 80;
    world.boss.phase = "fight";
    world.boss.doorCd = 0;
    world.boss.atkCd = 40;
    world.boss.rest = 8;
    world.time = 4;
    for (let f = 0; f < 160 && world.boss.moves < 1; f++) step();
    const awayTiles = Math.abs(world.door.x / TILE - (player.x + player.w / 2) / TILE);
    assert(Math.abs(world.door.x - beforeClose) > 10, "close yoink", fails);
    assert(awayTiles >= 4, "yoink lands away " + awayTiles, fails);
    assert(world.boss.moves === 1, "yoink counts " + world.boss.moves, fails);

    enterDimension(1, 16);
    hushBoss();
    world.boss.phase = "fight";
    player.x = 40;
    world.time = 30.2;
    world.boss.doorCd = 40;
    world.boss.atkCd = 40;
    world.boss.rest = 8;
    world.boss.shoveCd = 0;
    const nullDoor = world.door.x;
    step();
    assert(world.boss.saidBored, "null failsafe arms at 30", fails);
    assert(!world.boss.dropping, "far after 30s the door stays", fails);
    assert(world.door.x === nullDoor, "null door waits on failsafe", fails);
    assert(bossHoldsDoor(), "door locked while boss stands", fails);
    player.x = world.door.x - 80;
    player.y = world.door.y + TILE - player.h;
    player.vx = 0;
    player.vy = 0;
    player.dead = false;
    player.win = false;
    world.boss.doorCd = 0;
    step();
    assert(Math.abs(player.vx) < 2, "no door knockback " + player.vx, fails);
    assert(!player.win, "door dead until boss falls", fails);
    assert(!!world.boss.snatch, "near door still snatches", fails);

    enterDimension(1, 16);
    hushBoss();
    world.boss.phase = "fight";
    world.time = 2;
    world.boss.tell = { id: "bolt", until: 0, tx: 4, ty: 4, tw: 1, th: 1 };
    world.boss.atkCd = 40;
    step();
    const shot = (world.bossShots || [])[0];
    assert(!!shot, "bolt spawned", fails);
    const shotSpeed = Math.hypot(shot.vx, shot.vy);
    assert(shotSpeed >= 4, "bolt speed " + shotSpeed, fails);

    ids.forEach((id) => {
      enterDimension(1, 16);
      hushBoss();
      world.boss.phase = "fight";
      world.time = 2;
      world.boss.tell = {
        id, until: 0, tx: 6, ty: 6, tw: 1, th: 1,
        px: player.x + 12, py: player.y + 12, feet: player.y + player.h - 10, face: 1,
      };
      world.boss.atkCd = 40;
      step();
      assert(world.bossShots && world.bossShots.length > 0, "pattern " + id, fails);
    });

    enterDimension(1, 16);
    hushBoss();
    world.bossShots = [{ x: player.x, y: player.y, w: 30, h: 30, vx: 0, vy: 0, life: 2, delay: 0, kind: "bolt" }];
    step();
    assert(player.dead, "shot kills", fails);
    assert(world.deathReason === voice.line(1, "bolt", true), "shot line " + world.deathReason, fails);
    assert(world.deathReason.length <= 22, "shot line fit", fails);
    player.dead = false;
    die("SAW SAID HI");
    assert(INSULTS.saw.indexOf(world.deathReason) >= 0, "room saw line " + world.deathReason, fails);

    enterDimension(1, 16);
    hushBoss();
    for (let n = 0; n < world.boss.goal; n++) {
      player.dead = false;
      player.win = false;
      player.vx = 0;
      player.vy = 0;
      player.x = world.door.x - 80;
      world.boss.phase = "fight";
      world.boss.doorCd = 0;
      world.boss.atkCd = 40;
      world.boss.rest = 8;
      world.boss.tell = null;
      world.boss.snatch = null;
      world.boss.dropping = false;
      world.bossShots = [];
      world.time = 5;
      const beforeMoves = world.boss.moves;
      for (let f = 0; f < 160 && world.boss.moves === beforeMoves; f++) step();
    }
    assert(world.boss.moves === world.boss.goal, "goal yoinks " + (world.boss && world.boss.moves), fails);
    for (let frame = 0; frame < 180 && world.boss.phase !== "gone"; frame++) {
      player.dead = false;
      player.win = false;
      player.x = world.boss.x < world.cols * TILE * 0.5 ? world.cols * TILE - 80 : 24;
      world.boss.atkCd = 40;
      world.boss.tell = null;
      world.bossShots = [];
      step();
    }
    assert(world.boss.phase === "gone", "collapse " + (world.boss && world.boss.phase), fails);
    assert(!bossHoldsDoor(), "door opens after boss falls", fails);
    player.dead = false;
    player.win = false;
    player.x = world.door.x + 4;
    player.y = world.door.y + TILE - player.h;
    player.vx = 0;
    player.vy = 0;
    step();
    assert(player.win, "door works after boss falls", fails);

    enterDimension(1, 16);
    assert(world.boss.phase === "intro", "null starts asleep", fails);
    const introDoor = world.door.x;
    for (let f = 0; f < 170; f++) step();
    assert(world.boss.phase === "intro" && world.boss.face === "sleep", "asleep at 3s " + world.boss.face, fails);
    assert(world.door.x === introDoor, "door waits while he sleeps", fails);
    let nullQuiet = false;
    for (let f = 0; f < 60 * 30; f++) {
      const wasIntro = world.boss.phase === "intro";
      step();
      if (wasIntro && world.boss.phase === "fight") {
        nullQuiet = !world.boss.say;
        break;
      }
    }
    assert(world.boss.phase === "fight", "intro ends " + world.boss.phase, fails);
    assert(nullQuiet, "null stays quiet after intro", fails);
    assert(world.boss.moves >= 1, "intro throw " + world.boss.moves, fails);

    enterDimension(1, 16);
    const lockedX = player.x;
    hold.right = true;
    hold.jump = true;
    for (let f = 0; f < 12; f++) step();
    assert(world.boss.phase === "intro" && Math.abs(player.x - lockedX) < 1, "cutscene locks feet " + player.x, fails);
    hold.right = false;
    hold.jump = false;
    Object.keys(NULL_DEAD).forEach((k) => {
      const bag = NULL_DEAD[k];
      const list = typeof bag === "string" ? [bag] : bag;
      list.forEach((line) => {
        assert(line && line.length <= 22, "null dead " + k + " [" + line + "]", fails);
      });
    });

    enterDimension(1, 16);
    for (let f = 0; f < 60 * 10; f++) step();
    assert(world.boss.phase === "intro" && world.boss.y < 120, "high hover " + world.boss.y, fails);
    assert(world.boss.attack > 0.4, "flames up " + world.boss.attack, fails);

    enterDimension(1, 16);
    hushBoss();
    world.boss.phase = "fight";
    world.boss.moves = 4;
    world.boss.hot = false;
    world.boss.raged = false;
    world.boss.doorCd = 40;
    world.boss.atkCd = 40;
    world.boss.rest = 8;
    player.x = 40;
    player.dead = false;
    world.particles = [];
    world.whiteFlash = 0;
    world.shake = 0;
    if (audio.theme) audio.theme.rage = false;
    step();
    assert(world.boss.hot, "enrage hot", fails);
    assert(world.boss.raged, "enrage burst", fails);
    assert(world.boss.say && world.boss.say.text === "OH MY GOD JUST DIE ALREADY", "enrage line " + (world.boss.say && world.boss.say.text), fails);
    assert(!!world.boss.say.rage, "enrage big text", fails);
    assert((world.shake || 0) > 0, "enrage shake", fails);
    assert((world.whiteFlash || 0) > 0, "enrage white flash", fails);
    assert(world.particles.length > 0, "enrage particles", fails);
    assert(!audio.theme || (audio.theme.rage && audio.theme.bpm > 174), "enrage music " + (audio.theme && audio.theme.bpm), fails);

    enterDimension(1, 16);
    hushBoss();
    world.boss.phase = "fight";
    world.boss.doorCd = 40;
    world.boss.atkCd = 40;
    world.boss.rest = 8;
    player.x = 40;
    player.dead = false;
    let trailed = false;
    for (let f = 0; f < 50 && !trailed; f++) {
      step();
      if (world.boss.ghosts && world.boss.ghosts.length) trailed = true;
    }
    assert(trailed, "boss trails", fails);

    ["spin", "shot", "pound", "half", "needles", "magnet", "drive", "pop", "storm", "shove"].forEach((id) => {
      enterDimension(1, 16);
      hushBoss();
      world.boss.phase = "fight";
      world.time = 4;
      world.boss.atkCd = 40;
      world.boss.rest = 8;
      player.dead = false;
      player.vx = 0;
      world.boss.tell = {
        id, until: 0, tx: 8, ty: 6, tw: 1, th: 1, side: 1,
        px: player.x + 40, py: player.y + 10, feet: player.y + 20, face: 1,
      };
      step();
      const marked = (world.bossShots && world.bossShots.length)
        || world.boss.wave || world.boss.half || world.boss.drive
        || (world.nullBeams && world.nullBeams.length)
        || world.magnet || Math.abs(player.vx) > 3;
      assert(marked, "null attack stayed " + id, fails);
    });

    function sampleNull(moves, tries) {
      enterDimension(1, 16);
      hushBoss();
      world.boss.phase = "fight";
      world.boss.moves = moves;
      world.boss.doorCd = 40;
      world.boss.cool = {};
      player.x = 40;
      player.dead = false;
      const seen = {};
      for (let k = 0; k < tries; k++) {
        world.boss.tell = null;
        world.boss.plan = null;
        world.boss.planI = 0;
        world.boss.rest = 0;
        world.boss.gap = 0;
        world.boss.atkCd = 0;
        world.bossShots = [];
        world.nullBeams = [];
        let id = "";
        for (let f = 0; f < 8 && !id; f++) {
          step();
          if (world.boss.tell) id = world.boss.tell.id;
        }
        if (id) seen[id] = 1;
      }
      return seen;
    }
    const squares = sampleNull(0, 16);
    assert(squares.spin || squares.shot || squares.pop, "squares open", fails);
    assert(!squares.pound && !squares.half && !squares.needles && !squares.storm, "no slam yet", fails);
    const slammed = sampleNull(2, 24);
    assert(slammed.pound, "slam after 2 grabs", fails);
    assert(!slammed.half && !slammed.needles && !slammed.magnet && !slammed.drive && !slammed.storm && !slammed.shove, "later locked at 2", fails);
    const opened = sampleNull(8, 30);
    assert(opened.storm && opened.shove, "late attacks open", fails);

    enterDimension(1, 16);
    hushBoss();
    world.boss.phase = "fight";
    world.time = 10;
    world.boss.atkCd = 40;
    world.boss.rest = 8;
    const coolWait = { shot: 4.5, pound: 60, magnet: 34, drive: 95, half: 180, needles: 22, storm: 80 };
    Object.keys(coolWait).forEach((id) => {
      world.boss.tell = {
        id, until: 0, tx: 8, ty: 6, tw: 1, th: 1, side: 1,
        px: player.x + 40, py: player.y + 10, feet: player.y + 20, face: 1,
      };
      step();
      const wait = coolWait[id];
      const left = world.boss.cool[id] - world.time;
      assert(Math.abs(left - wait) < 0.02, id + " cooldown " + left, fails);
      world.bossShots = [];
      world.nullBeams = [];
      world.boss.wave = null;
      world.boss.half = null;
    });

    enterDimension(1, 16);
    hushBoss();
    world.boss.phase = "fight";
    world.time = 4;
    world.boss.atkCd = 40;
    world.boss.rest = 8;
    player.x = 40;
    player.dead = false;
    world.boss.tell = {
      id: "shot", until: 0, tx: 8, ty: 6, tw: 1, th: 1, side: 1,
      px: player.x + 80, py: player.y + 10, feet: player.y + 20, face: 1,
    };
    step();
    const burstShots = (world.bossShots || []).filter((s) => s.kind === "shot");
    assert(burstShots.length === 11, "burst squares " + burstShots.length, fails);
    const cone = 70 * Math.PI / 180;
    burstShots.forEach((s) => {
      const off = Math.abs(Math.atan2(s.vy, s.vx) - Math.PI / 2);
      assert(s.vy > 0 && off <= cone + 0.001, "shot aims down " + off, fails);
    });
    world.bossShots = [];
    world.boss.tell = {
      id: "spin", until: 0, tx: 8, ty: 6, tw: 1, th: 1, side: 1,
      px: player.x + 200, py: player.y + 10, feet: player.y + 20, face: 1,
    };
    step();
    var wobLo = 0;
    var wobHi = 0;
    for (var wi = 0; wi < 50; wi++) {
      step();
      var sq = (world.bossShots || [])[0];
      if (!sq) break;
      if (sq.wob < wobLo) wobLo = sq.wob;
      if (sq.wob > wobHi) wobHi = sq.wob;
    }
    assert(wobHi > 20 && wobLo < -20, "spin weaves " + wobLo + " " + wobHi, fails);

    enterDimension(1, 16);
    hushBoss();
    world.boss.phase = "fight";
    world.time = 4;
    world.boss.atkCd = 40;
    world.boss.rest = 8;
    player.dead = false;
    world.boss.tell = {
      id: "storm", until: 0, tx: 8, ty: 6, tw: 1, th: 1, side: 1,
      px: 80, py: 80, feet: 100, face: 1,
    };
    step();
    assert(world.boss.fog === 1 && world.boss.safeW === 128, "storm fog " + world.boss.fog, fails);
    for (let i = 0; i < 40; i++) {
      player.dead = false;
      player.x = world.boss.safeX + 16;
      step();
    }
    assert(world.boss.fog === 1, "fog holds through storm " + world.boss.fog, fails);
    world.nullBeams = [];
    for (let i = 0; i < 80; i++) step();
    assert(world.boss.fog === 0, "fog lifts " + world.boss.fog, fails);

    enterDimension(1, 16);
    player.dead = false;
    player.win = false;
    world.boss.phase = "boom";
    world.boss.boom = 0.08;
    world.boss.dropping = false;
    world.boss.x = player.x + player.w / 2;
    world.boss.y = player.y - 10;
    step();
    assert(player.dead && world.deathReason === "I fell on you.", "blast line " + world.deathReason, fails);

    // LAST LAUGH: after the return trap, walking into the door from the right must win.
    // Planting solids on the door pad used to make the finish impossible.
    enterDimension(1, 15);
    assert(world.name === "LAST LAUGH" && !world.boss, "LAST LAUGH stays handmade", fails);
    world.doorOpened = "fake";
    world.maxX = 26 * TILE;
    player.x = 5 * TILE;
    player.y = 8 * TILE;
    player.onGround = true;
    player.dead = false;
    player.win = false;
    for (let f = 0; f < 90; f++) step();
    assert(world.door && world.door.x === 4 * TILE && world.door.y === 8 * TILE, "LAST LAUGH door returns", fails);
    assert(!isSolid(tileAt(world.door.x + 8, world.door.y + 8)), "LAST LAUGH door pad clear", fails);
    player.x = world.door.x + 48;
    player.y = 9 * TILE - player.h;
    player.vx = 0;
    player.vy = 0;
    player.dead = false;
    player.win = false;
    hold.left = true;
    hold.right = false;
    hold.jump = false;
    for (let f = 0; f < 90 && !player.win && !player.dead; f++) step();
    hold.left = false;
    assert(player.win, "LAST LAUGH door walk-in " + (player.dead ? world.deathReason : "stuck"), fails);

    const kits = window.SURGE_BOSS_KITS;
    assert(!!kits, "boss kits loaded", fails);
    const kitAudit = kits.audit();
    assert(!kitAudit.length, "kit audit " + kitAudit.join(" | "), fails);
    const forms = window.SURGE_BOSS_FORMS;
    assert(!!forms && typeof forms.audit === "function", "boss forms loaded", fails);
    const formCounts = forms.audit();
    for (let d = 2; d <= 20; d++) {
      const n = formCounts[d] || 0;
      assert(n <= 150 && n >= 16, "boss " + d + " parts " + n, fails);
    }

    function movesForBand(bandName, goal, dim) {
      if (bandName === "open") return 0;
      if (bandName === "strain") return Math.max(1, Math.ceil(goal * 0.42));
      const late = dim >= 18 ? 0.58 : dim >= 8 ? 0.64 : 0.72;
      return Math.max(1, Math.ceil(goal * Math.min(0.96, late + 0.03)));
    }
    function kitClear() {
      world.bossShots = [];
      world.bossZones = [];
      world.drops = [];
      world.saws = [];
      world.wind = 0;
      world.reverse = false;
      world.magnet = null;
      if (world.baseGravity) world.gravity = world.baseGravity;
      player.dead = false;
      player.win = false;
      player.vx = 0;
      player.vy = 0;
      hold.left = false;
      hold.right = false;
      hold.jump = false;
      if (!world.boss) return;
      world.boss.tell = null;
      world.boss.rush = null;
      world.boss.wave = null;
      world.boss.echo = null;
      world.boss.gravUntil = 0;
      world.boss.flipUntil = 0;
      world.boss.windUntil = 0;
      world.boss.dropping = false;
      world.boss.drop = null;
      world.boss.cool = {};
      world.boss.doorCd = 40;
    }

    for (let d = 2; d <= 20; d++) {
      const k = kits.kit(d);
      const openPlan = kits.build(k, { band: "open", role: "run", rand: function () { return 0.2; }, last: "", cool: {}, now: 0 });
      openPlan.forEach((id) => {
        const a = kits.act(k, id);
        assert(!!a && a.phase === 0, "D" + d + " open leaked " + id, fails);
      });
      for (let n = 0; n < openPlan.length - 1; n++) {
        if (openPlan[n] === openPlan[n + 1]) fails.push("D" + d + " open repeat");
        const left = kits.act(k, openPlan[n]);
        const right = kits.act(k, openPlan[n + 1]);
        if (left && right && left.heavy && right.heavy) fails.push("D" + d + " open heavies");
      }
      const latePlan = kits.build(k, { band: "desperate", role: "any", rand: function () { return 0.15; }, last: "", cool: {}, now: 0 });
      assert(latePlan.indexOf(k.sig) >= 0, "D" + d + " sig missing " + latePlan.join(","), fails);
    }

    for (let d = 2; d <= 20; d++) {
      enterDimension(d, window.SURGE_WORLDS.roomCount(d) - 1);
      assert(world.boss && world.boss.phase === "intro", "D" + d + " cutscene", fails);
      assert((world.boss.bars || 0) > 0.5, "D" + d + " bars", fails);
    }
    enterDimension(2, window.SURGE_WORLDS.roomCount(2) - 1);
    const ashX = player.x;
    hold.right = true;
    hold.jump = true;
    for (let f = 0; f < 18; f++) step();
    assert(world.boss.phase === "intro" && Math.abs(player.x - ashX) < 1, "ash cutscene locks", fails);
    hold.right = false;
    hold.jump = false;
    let ashSpoke = false;
    for (let f = 0; f < 60 * 14; f++) {
      const wasIntro = world.boss.phase === "intro";
      step();
      if (world.boss.say && world.boss.say.text) ashSpoke = true;
      if (wasIntro && world.boss.phase === "fight") break;
    }
    assert(!ashSpoke, "ash stays silent", fails);
    assert(world.boss.phase === "fight", "ash intro ends " + world.boss.phase, fails);
    assert((world.boss.moves || 0) === 0, "ash intro keeps the door", fails);

    enterDimension(2, window.SURGE_WORLDS.roomCount(2) - 1);
    hushBoss();
    world.boss.phase = "fight";
    world.boss.arrive = 0;
    world.boss.rest = 8;
    world.boss.gap = 8;
    world.boss.plan = [];
    world.boss.doorCd = 0;
    world.boss.moves = 0;
    world.time = 30;
    player.x = 40;
    player.y = world.door.y + TILE - player.h;
    player.vx = 0;
    const ashDoor = world.door.x;
    step();
    assert(world.boss.saidBored, "ash failsafe arms", fails);
    assert(!world.boss.say, "ash failsafe stays silent", fails);
    assert(!world.boss.dropping, "ash failsafe waits before drop", fails);
    assert(world.door.x === ashDoor, "ash door waits on warn", fails);
    assert((world.boss.doorCd || 0) > 0.5, "ash failsafe fuse " + world.boss.doorCd, fails);
    for (let f = 0; f < 100 && !world.boss.dropping; f++) step();
    assert(!!world.boss.dropping, "ash failsafe drops", fails);
    assert(Math.abs(world.door.x - ashDoor) > 10, "ash failsafe moves door", fails);

    enterDimension(20, window.SURGE_WORLDS.roomCount(20) - 1);
    for (let f = 0; f < 120; f++) step();
    assert(world.boss.phase === "intro", "last still in cutscene", fails);
    assert(Math.abs(world.boss.x - player.x) < 520, "last stays in frame " + Math.round(world.boss.x), fails);
    assert(!world.boss.say, "last stays silent", fails);

    for (let d = 2; d <= 20; d++) {
      enterDimension(d, window.SURGE_WORLDS.roomCount(d) - 1);
      assert(!!world.boss && world.boss.dim === d, "D" + d + " boss", fails);
      if (!world.boss) continue;
      assert(world.boss.goal === window.SURGE_WORLDS.bossDoorMoves(d), "D" + d + " door goal", fails);
      hushBoss();
      const k = kits.kit(d);
      const floor = world.door.y + TILE;
      k.acts.forEach((act) => {
        kitClear();
        const bandName = act.phase === 0 ? "open" : act.phase === 1 ? "strain" : "desperate";
        world.boss.phase = "fight";
        world.boss.moves = movesForBand(bandName, world.boss.goal, d);
        world.boss.band = kits.band(world.boss.moves, world.boss.goal, d);
        assert(world.boss.band === bandName, "D" + d + " band " + act.id + " " + world.boss.band, fails);
        world.boss.plan = [act.id];
        world.boss.planI = 0;
        world.boss.rest = 0;
        world.boss.gap = 0;
        world.boss.arrive = 0;
        world.time = 4;
        player.x = 80;
        player.y = floor - player.h;
        player.onGround = true;
        player.dead = false;
        let guard = 0;
        while (world.boss && !world.boss.tell && guard++ < 8) step();
        assert(world.boss && world.boss.tell && world.boss.tell.id === act.id, "D" + d + " arm " + act.id, fails);
        if (!world.boss || !world.boss.tell) return;
        const wind = world.boss.tell.until - world.time;
        assert(wind + 0.001 >= kits.wind(act, bandName) - 0.02, "D" + d + " wind " + act.id + " " + wind, fails);
        const prev = world.boss.tell.preview || {};
        (prev.shots || []).forEach((s) => {
          if (rectsOverlap(player, s)) fails.push("D" + d + " shot on player " + act.id);
        });
        const aimed = !!(act.home || act.cover === "move");
        if (!aimed) {
          (prev.zones || []).forEach((z) => {
            if (rectsOverlap(player, z)) fails.push("D" + d + " zone on player " + act.id);
          });
        }
        if (act.cover === "move" && prev.lane) {
          const px = player.x + player.w / 2;
          const mid = prev.lane.x + prev.lane.w / 2;
          if (Math.abs(px - mid) > TILE * 5) fails.push("D" + d + " lane far " + act.id);
          if (px >= prev.lane.x && px <= prev.lane.x + prev.lane.w) fails.push("D" + d + " lane covers " + act.id);
        }
        if (prev.rush) {
          const r = prev.rush;
          if (r.h > 26) fails.push("D" + d + " rush tall " + act.id);
          if (rectsOverlap(player, { x: r.x - r.w / 2, y: r.y, w: r.w, h: r.h })) fails.push("D" + d + " rush on player " + act.id);
        }
        if (act.low) {
          (prev.zones || []).forEach((z) => {
            if (z.h > 26) fails.push("D" + d + " low tall " + act.id);
          });
        }
        if (act.type !== "guard") {
          const dead = kits.line(d, act.id, true);
          assert(!!dead && dead.length <= 22, "D" + d + " dead " + act.id + " [" + dead + "]", fails);
        }
        if (act.type === "guard") {
          player.x = world.door.x - 36;
          player.y = floor - player.h;
          world.boss.guarded = false;
        }
        world.boss.tell.until = world.time;
        step();
        const happened = (world.bossShots && world.bossShots.length)
          || (world.bossZones && world.bossZones.length)
          || world.boss.rush || world.boss.wave
          || (world.drops && world.drops.length)
          || (world.saws && world.saws.length)
          || world.wind || world.reverse || world.magnet
          || world.boss.gravUntil || world.boss.guarded
          || Math.abs(player.vx) > 3;
        assert(!!happened, "D" + d + " cast " + act.id, fails);
        if ((world.bossShots || []).length > 24) fails.push("D" + d + " shot cap");
        if ((world.bossZones || []).length > 18) fails.push("D" + d + " zone cap");
      });

      hushBoss();
      world.boss.arrive = 0;
      world.boss.phase = "fight";
      world.boss.rest = 8;
      world.boss.gap = 8;
      world.boss.plan = [];
      world.boss.doorCd = 0;
      world.boss.moves = 0;
      world.time = 4;
      player.dead = false;
      player.win = false;
      player.x = world.door.x - 80;
      player.y = floor - player.h;
      player.vx = 0;
      const doorBefore = world.door.x;
      for (let f = 0; f < 160 && world.boss.moves < 1; f++) step();
      assert(Math.abs(world.door.x - doorBefore) > 10, "D" + d + " yoink", fails);
      assert(!player.dead, "D" + d + " yoink killed " + world.deathReason, fails);

      hushBoss();
      world.boss.arrive = 0;
      world.boss.phase = "fight";
      world.boss.rest = 0;
      world.boss.gap = 0;
      world.boss.doorCd = 40;
      world.boss.moves = 0;
      world.boss.plan = null;
      world.boss.cool = {};
      player.x = 48;
      player.y = floor - player.h;
      player.dead = false;
      player.win = false;
      for (let f = 0; f < 150; f++) {
        if (player.dead || player.win || player.x > 220) {
          player.dead = false;
          player.win = false;
          player.x = 48;
          player.y = floor - player.h;
          player.vx = 0;
          player.vy = 0;
        }
        step();
        if ((world.bossShots || []).length > 24) fails.push("D" + d + " sim shots");
        if ((world.bossZones || []).length > 18) fails.push("D" + d + " sim zones");
      }
      assert(Number.isFinite(world.boss.x) && Number.isFinite(world.boss.y), "D" + d + " sim nan", fails);
      assert(world.boss.phase === "fight" || world.boss.phase === "rage", "D" + d + " sim phase " + world.boss.phase, fails);
    }

    enterDimension(6, window.SURGE_WORLDS.roomCount(6) - 1);
    hushBoss();
    world.boss.arrive = 0;
    world.boss.phase = "fight";
    world.boss.band = "open";
    world.boss.moves = 0;
    world.boss.plan = ["pool"];
    world.boss.planI = 0;
    world.boss.rest = 0;
    world.boss.gap = 0;
    world.boss.doorCd = 40;
    world.time = 4;
    const poolFloor = world.door.y + TILE;
    player.x = 80;
    player.y = poolFloor - player.h;
    player.dead = false;
    player.vx = 0;
    for (let f = 0; f < 8 && !world.boss.tell; f++) step();
    assert(world.boss.tell && world.boss.tell.id === "pool", "pool armed", fails);
    world.boss.tell.until = world.time;
    step();
    player.x = 80;
    player.y = poolFloor - player.h;
    player.vy = 0;
    player.dead = false;
    for (let f = 0; f < 12 && !player.dead; f++) step();
    assert(player.dead && world.deathReason === "too low.", "pool kills grounded " + world.deathReason, fails);
    player.dead = false;
    world.gravity = 0;
    player.x = 80;
    player.y = poolFloor - 120;
    player.vy = 0;
    for (let f = 0; f < 8; f++) step();
    assert(!player.dead, "pool jump lives", fails);
    world.gravity = world.baseGravity || 0.55;

    enterDimension(2, window.SURGE_WORLDS.roomCount(2) - 1);
    hushBoss();
    world.boss.arrive = 0;
    world.boss.phase = "fight";
    world.boss.band = "strain";
    world.boss.moves = movesForBand("strain", world.boss.goal, 2);
    world.boss.plan = ["coal"];
    world.boss.planI = 0;
    world.boss.rest = 0;
    world.boss.gap = 0;
    world.boss.doorCd = 40;
    world.time = 4;
    const coalFloor = world.door.y + TILE;
    player.x = 200;
    player.y = coalFloor - player.h;
    player.dead = false;
    player.vx = 0;
    for (let f = 0; f < 8 && !world.boss.tell; f++) step();
    assert(world.boss.tell && world.boss.tell.id === "coal", "coal armed", fails);
    world.boss.tell.until = world.time;
    step();
    assert(!!world.boss.rush, "coal rush", fails);
    const coalDir = world.boss.rush.dir || 1;
    player.x = world.boss.rush.x + coalDir * 90 - player.w / 2;
    player.y = coalFloor - player.h;
    player.vx = 0;
    player.vy = 0;
    player.dead = false;
    for (let f = 0; f < 80 && !player.dead && world.boss.rush; f++) step();
    assert(player.dead, "coal dash grounded", fails);
    enterDimension(2, window.SURGE_WORLDS.roomCount(2) - 1);
    hushBoss();
    world.boss.arrive = 0;
    world.boss.phase = "fight";
    world.boss.band = "strain";
    world.boss.moves = movesForBand("strain", world.boss.goal, 2);
    world.boss.plan = ["coal"];
    world.boss.planI = 0;
    world.boss.rest = 0;
    world.boss.gap = 0;
    world.boss.doorCd = 40;
    world.time = 4;
    player.x = 200;
    player.y = coalFloor - player.h;
    player.dead = false;
    for (let f = 0; f < 8 && world.boss && !world.boss.tell; f++) step();
    world.boss.tell.until = world.time;
    step();
    world.gravity = 0;
    player.x = world.boss.rush.x + (world.boss.rush.dir || 1) * 90 - player.w / 2;
    player.y = coalFloor - 110;
    player.vy = 0;
    player.dead = false;
    for (let f = 0; f < 80 && world.boss.rush; f++) step();
    assert(!player.dead, "coal dash jumped", fails);
    world.gravity = world.baseGravity || 0.55;

    enterDimension(4, window.SURGE_WORLDS.roomCount(4) - 1);
    hushBoss();
    world.boss.arrive = 0;
    world.boss.phase = "fight";
    world.boss.band = "open";
    world.boss.moves = 0;
    world.boss.plan = ["petal"];
    world.boss.planI = 0;
    world.boss.rest = 0;
    world.boss.gap = 0;
    world.boss.doorCd = 40;
    world.time = 4;
    const sawFloor = world.door.y + TILE;
    player.x = 80;
    player.y = sawFloor - player.h;
    player.dead = false;
    player.vx = 0;
    for (let f = 0; f < 8 && world.boss && !world.boss.tell; f++) step();
    assert(world.boss.tell && world.boss.tell.id === "petal", "petal armed", fails);
    world.boss.tell.until = world.time;
    step();
    const petal = (world.saws || []).filter((s) => s.boss)[0];
    assert(!!petal, "petal saw", fails);
    if (petal) {
      player.x = petal.x - player.w / 2;
      player.y = sawFloor - player.h;
      player.vx = 0;
      player.vy = 0;
      player.dead = false;
      for (let f = 0; f < 6 && !player.dead; f++) step();
      assert(player.dead, "petal saw grounded", fails);
    }
    enterDimension(4, window.SURGE_WORLDS.roomCount(4) - 1);
    hushBoss();
    world.boss.arrive = 0;
    world.boss.phase = "fight";
    world.boss.band = "open";
    world.boss.moves = 0;
    world.boss.plan = ["petal"];
    world.boss.planI = 0;
    world.boss.rest = 0;
    world.boss.gap = 0;
    world.boss.doorCd = 40;
    world.time = 4;
    player.x = 80;
    player.y = sawFloor - player.h;
    player.dead = false;
    for (let f = 0; f < 8 && world.boss && !world.boss.tell; f++) step();
    world.boss.tell.until = world.time;
    step();
    const petalHigh = (world.saws || []).filter((s) => s.boss)[0];
    world.gravity = 0;
    if (petalHigh) {
      player.x = petalHigh.x - player.w / 2;
      player.y = sawFloor - 90;
      player.vy = 0;
      player.dead = false;
      for (let f = 0; f < 6 && world.saws.length; f++) step();
      assert(!player.dead, "petal saw jumped", fails);
    }
    world.gravity = world.baseGravity || 0.55;

    enterDimension(13, window.SURGE_WORLDS.roomCount(13) - 1);
    hushBoss();
    world.boss.arrive = 0;
    world.boss.phase = "fight";
    world.boss.band = "strain";
    world.boss.moves = movesForBand("strain", world.boss.goal, 13);
    world.boss.plan = ["live"];
    world.boss.planI = 0;
    world.boss.rest = 0;
    world.boss.gap = 0;
    world.boss.doorCd = 40;
    world.time = 4;
    const wireFloor = world.door.y + TILE;
    player.x = 80;
    player.y = wireFloor - player.h;
    player.dead = false;
    player.vx = 0;
    player.vy = 0;
    hold.jump = false;
    for (let f = 0; f < 8 && world.boss && !world.boss.tell; f++) step();
    assert(world.boss.tell && world.boss.tell.id === "live", "live armed", fails);
    world.boss.tell.until = world.time;
    step();
    player.x = 80;
    player.y = wireFloor - player.h;
    player.vy = 0;
    player.dead = false;
    for (let f = 0; f < 40 && !player.dead; f++) step();
    assert(!player.dead, "live wire grounded", fails);
    enterDimension(13, window.SURGE_WORLDS.roomCount(13) - 1);
    hushBoss();
    world.boss.arrive = 0;
    world.boss.phase = "fight";
    world.boss.band = "strain";
    world.boss.moves = movesForBand("strain", world.boss.goal, 13);
    world.boss.plan = ["live"];
    world.boss.planI = 0;
    world.boss.rest = 0;
    world.boss.gap = 0;
    world.boss.doorCd = 40;
    world.time = 4;
    player.x = 80;
    player.y = wireFloor - player.h;
    player.dead = false;
    player.vx = 0;
    for (let f = 0; f < 8 && world.boss && !world.boss.tell; f++) step();
    world.boss.tell.until = world.time;
    step();
    player.x = 80;
    player.y = wireFloor - player.h;
    player.vy = 0;
    player.dead = false;
    hold.jump = true;
    for (let f = 0; f < 28 && !player.dead; f++) step();
    hold.jump = false;
    assert(player.dead, "live wire jump " + world.deathReason, fails);
    enterDimension(1, 16);

    const sceneryCounts = sceneryPartAudit();
    Object.keys(sceneryCounts).forEach((k) => {
      assert(sceneryCounts[k] >= 20, "scenery " + k + " parts " + sceneryCounts[k], fails);
    });

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
        if (def.boss) {
          if (def.events && def.events.length) item.errors.push("boss traps " + def.events.length);
          if (/[\^v!<>oF]/.test((def.map || []).join(""))) item.errors.push("boss hazard tiles");
        } else if (!def.events || !def.events.length) {
          item.errors.push("no traps");
        } else {
          const want = (window.SURGE_WORLDS && (def.dim || dimIndex))
            ? (def.dim === 1 || (!def.dim && dimIndex === 1) ? def.events.length : window.SURGE_WORLDS.trapCount(def.dim || dimIndex))
            : 12;
          if (def.dim > 1 && def.events.length !== window.SURGE_WORLDS.trapCount(def.dim)) {
            item.errors.push("expected " + window.SURGE_WORLDS.trapCount(def.dim) + " traps, got " + def.events.length);
          }
          if ((!def.dim || def.dim === 1) && def.events.length !== 12 && want === 12) {
            item.errors.push("expected 12 traps, got " + def.events.length);
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
          if (last.events.length !== 0) {
            report.push({ i: "D" + d, name: last.name, ok: false, errors: ["boss traps " + last.events.length + " != 0"] });
          }
          if (!last.boss) {
            report.push({ i: "D" + d, name: last.name, ok: false, errors: ["last room is not a boss"] });
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
    const stepUp = isSolid(body1) || isSolid(tileAt(probe, player.y + player.h - 2));
    if (gap && !ceiling && !safeDrop) jump = true;
    if (stepUp && !ceiling) jump = true;
    if ((floor1 === "^" || body1 === "^") && !ceiling) jump = true;
    if (world.rules.explodeCoins) {
      for (const c of world.coins) {
        if (!c.dead && Math.abs(c.x - (px + wantDir * 20)) < 18 && Math.abs(c.y - (player.y + 8)) < 24) jump = false;
      }
    }
    return { ix, jump };
  }

  // Trailer-only. Same route as the playtest brain, plus a dash when the gap is wide.
  function trailerThink() {
    const base = botThink();
    let dash = false;
    if (dimIndex >= 3 && base.jump && dashCool <= 0 && dashT <= 0) {
      const px = player.x + player.w / 2;
      const dir = base.ix || player.facing || 1;
      const feet = player.y + player.h + 1;
      const far = tileAt(px + dir * 64, feet);
      if (!isSolid(far) && far !== "i") dash = true;
    }
    return { ix: base.ix, jump: !!base.jump, dash };
  }

  function playtestLevel(i, maxFrames) {
    const def = window.LEVELS[i];
    const saved = { mode, levelIndex, deaths, testMode };
    testMode = true;
    useBot = true;
    deaths = 0;
    mode = "play";
    loadLevel(i);
    let frames = 0;
    const max = maxFrames || 60 * 16;
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
      y: Math.round(player.y),
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

  function securitySelfTest() {
    const fails = [];
    const G = window.SURGE_GUARD;
    if (!G) return ["guard missing"];
    const prev = localStorage.getItem(SAVE_KEY);
    const payload = "<img src=x onerror=alert(1)>";
    try {
      if (!G.locks || G.locks.length !== 50) fails.push("lock count " + (G.locks && G.locks.length));
      const lockFails = G.lockCheck();
      if (lockFails.length) fails.push("locks " + lockFails.join(","));
      if (!G.cheatQuery("#unlock") || !G.cheatQuery("?all=1") || G.cheatQuery("#play")) {
        fails.push("cheat url miss");
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        unlockedDim: 20,
        bestDeaths: 1,
        runs: 1,
      }));
      const legacy = loadSave();
      if (legacy.unlockedDim || legacy.bestDeaths || legacy.runs) fails.push("unsigned save was accepted");
      const legacySealed = localStorage.getItem(SAVE_KEY) || "";
      if (legacySealed.indexOf('"m"') < 0) fails.push("unsigned save was not replaced");
      if (legacySealed.indexOf('"unlockedDim"') >= 0) fails.push("unsigned unlock persisted");
      if (G.openProgress(JSON.stringify({ unlockedDim: 9 })).unlockedDim) fails.push("raw unsigned open accepted");
      const merged = writeSave({
        unlockedDim: 20,
        lastDim: 3,
        lastRoom: 2,
        bestDeaths: 7,
        bestTime: 90,
        runs: 2,
        clears: 1,
        rooms: { 1: 15, 3: 2 },
        dimRecords: { 3: { bestDeaths: 7, bestTime: 90, shards: 1 } },
      });
      const kept = loadSave();
      if (merged.unlockedDim !== 2 || kept.unlockedDim !== 2 || kept.lastRoom !== 2 || kept.bestDeaths !== 7) {
        fails.push("sealed save damaged");
      }
      if (!kept.rooms || kept.rooms[1] !== 1 || kept.rooms[3]) fails.push("rooms jumped");
      if (kept.runs !== 1 || kept.clears !== 1) fails.push("counters jumped");
      if (kept.dimRecords && kept.dimRecords[3]) fails.push("locked dim record kept");
      const stepped = writeSave({ unlockedDim: 3, rooms: { 1: 2 }, dimRecords: { 2: { bestDeaths: 7, bestTime: 90, shards: 1 } } });
      if (stepped.unlockedDim !== 3 || !stepped.rooms || stepped.rooms[1] !== 2) fails.push("legal step blocked");
      if (!stepped.dimRecords || !stepped.dimRecords[2] || stepped.dimRecords[2].shards !== 1) fails.push("records damaged");
      const sealed = localStorage.getItem(SAVE_KEY) || "";
      if (sealed.indexOf('"m"') < 0) fails.push("save was stored without a seal");
      localStorage.setItem(SAVE_KEY, sealed.replace('"unlockedDim":3', '"unlockedDim":20'));
      if (loadSave().unlockedDim) fails.push("tampered seal accepted");

      G.clearAudit();
      localStorage.setItem(SAVE_KEY, "{"
        + "\"unlockedDim\":4,"
        + "\"bestDeaths\":\"" + payload + "\","
        + "\"dimRecords\":{\"1\":{\"bestDeaths\":\"" + payload + "\"}},"
        + "\"__proto__\":{\"polluted\":true}"
        + "}");
      const save = loadSave();
      if (save.unlockedDim) fails.push("poisoned unlock was accepted");
      if (typeof save.bestDeaths !== "undefined") fails.push("string bestDeaths kept");
      if (save.dimRecords && save.dimRecords[1] && Object.prototype.hasOwnProperty.call(save.dimRecords[1], "bestDeaths")) {
        fails.push("html deaths kept");
      }
      if (save.polluted || Object.prototype.polluted) fails.push("prototype polluted");
      const stored = localStorage.getItem(SAVE_KEY) || "";
      if (stored.indexOf("<") >= 0 || stored.indexOf("onerror") >= 0 || stored.indexOf("__proto__") >= 0) {
        fails.push("poison persisted");
      }
      if (stored.indexOf('"m"') < 0) fails.push("poisoned save was not replaced");
      fillLevelGrid();
      const grid = document.getElementById("level-grid");
      const bag = [];
      (function walk(el) {
        if (!el) return;
        bag.push(String(el.innerHTML || ""), String(el.textContent || ""));
        const kids = el.children || [];
        for (let i = 0; i < kids.length; i++) walk(kids[i]);
      })(grid);
      const joined = bag.join("\n");
      if (joined.indexOf("onerror") >= 0 || joined.indexOf("<img") >= 0 || joined.indexOf("<") >= 0) {
        fails.push("html reached the worlds grid");
      }
      if (joined.indexOf("NULLSCAPE") < 0) fails.push("world names missing");
      const dumped = JSON.stringify(G.auditLog());
      if (!/save-drop|proto/.test(dumped)) fails.push("no audit code");
      if (dumped.indexOf("onerror") >= 0 || dumped.indexOf("<img") >= 0) fails.push("audit leaked payload");
      if (playCustom([], { testMode: true }) !== false) fails.push("empty custom pack accepted");
    } catch (e) {
      fails.push("securitySelfTest threw: " + e.message);
    }
    if (Object.prototype.polluted) delete Object.prototype.polluted;
    if (prev == null) localStorage.removeItem(SAVE_KEY);
    else localStorage.setItem(SAVE_KEY, prev);
    return fails;
  }

  const gameApi = window.__SURGE_TEST__
    ? {
      hold, keys, player, world, loadLevel, startGame, enterDimension, step, die, winLevel,
      runAction, matchEvent, tileAt, isSolid, setTiles, parseSol, deathKind,
      unitTests, smokeAllLevels, playtestLevel, playtestAll, playSolLevel, playSolAll,
      searchSol, searchSolAll, runSelfTest, playCustom, quitToTitle, setMode, securitySelfTest,
      get mode() { return mode; },
      get creatorPlay() { return creatorPlay; },
    }
    : Object.freeze({ setMode: setMode, playCustom: playCustom });
  try {
    Object.defineProperty(window, "__GAME", { value: gameApi, writable: false, configurable: false });
  } catch (_) {
    window.__GAME = gameApi;
  }

  const playApi = Object.freeze({
    audioOn() { audio.unlock(); },
    audioLive() { return !!(audio.ctx && audio.ctx.state === "running"); },
    hush(quiet) {
      if (!audio.ctx) return;
      const t = audio.ctx.currentTime;
      const ducked = !!(quiet || audio.muted);
      const music = ducked ? 0.0001 : 0.32;
      if (audio.musicGain) {
        audio.musicGain.gain.cancelScheduledValues(t);
        audio.musicGain.gain.setTargetAtTime(music, t, quiet ? 0.03 : 0.14);
      }
      if (audio.drone) {
        try {
          audio.drone.g.gain.setTargetAtTime(ducked ? 0.0001 : 0.014, t, quiet ? 0.03 : 0.14);
          if (audio.drone.g2) audio.drone.g2.gain.setTargetAtTime(ducked ? 0.0001 : 0.008, t, quiet ? 0.03 : 0.14);
        } catch (_) { /* ignore */ }
      }
    },
    resetClock() {
      deaths = 0;
      clockOut = 0;
      clockOutAt = 0;
      startedAt = performance.now();
    },
    enter(dim, room, opts) {
      opts = opts || {};
      const keepDeaths = deaths;
      const keepStart = startedAt;
      testMode = true;
      useBot = !opts.lock;
      enterDimension(dim, room);
      if (opts.intro != null && world.boss) world.boss.introT = opts.intro;
      deaths = keepDeaths;
      startedAt = keepStart;
      introT = 0;
      dimIntro = 0;
      deathShow = null;
      deathTimer = 0;
      if (dimCard) dimCard.classList.add("hidden");
      if (mobile) mobile.classList.add("hidden");
      if (deathsEl) deathsEl.textContent = "DEAD " + deaths;
      if (opts.lock) {
        useBot = false;
        botIx = 0;
        botJump = false;
        hold.dash = false;
        keys.clear();
      }
    },
    load(i, opts) {
      opts = opts || {};
      testMode = true;
      useBot = !opts.lock;
      deathShow = null;
      deathTimer = 0;
      loadLevel(i);
      introT = 0;
      if (opts.intro != null && world.boss) world.boss.introT = opts.intro;
      if (mobile) mobile.classList.add("hidden");
      if (opts.lock) {
        useBot = false;
        botIx = 0;
        botJump = false;
        hold.dash = false;
        keys.clear();
      }
    },
    poke(ix, jump, dash) {
      useBot = true;
      botIx = ix || 0;
      botJump = !!jump;
      hold.dash = !!dash;
    },
    brain() {
      return trailerThink();
    },
    still() {
      useBot = false;
      botIx = 0;
      botJump = false;
      hold.dash = false;
      keys.clear();
    },
    state() {
      const pack = window.SURGE_WORLDS;
      const th = pack ? pack.theme(dimIndex) : null;
      return {
        dead: !!player.dead,
        win: !!player.win,
        traps: world.trapsFired || 0,
        insult: world.deathReason || "",
        taunt: world.taunt || "",
        name: world.name || "",
        dim: dimIndex,
        lore: th && th.lore ? th.lore : "",
        fake: world.doorOpened === "fake",
        rev: !!world.reverse,
        flip: world.gravity < 0,
        saws: world.saws ? world.saws.length : 0,
      };
    },
    finishToTitle() {
      testMode = false;
      useBot = false;
      botIx = 0;
      botJump = false;
      hold.dash = false;
      keys.clear();
      deathShow = null;
      deathTimer = 0;
      dimIndex = 1;
      audio.setTheme(1);
      audio.restartMusic();
      quitToTitle();
    },
  });
  try {
    Object.defineProperty(window, "SURGE_PLAY", { value: playApi, writable: false, configurable: false });
  } catch (_) {
    window.SURGE_PLAY = playApi;
  }

  refreshRecords();
  if (typeof location !== "undefined") {
    const qh = String(location.search || "") + String(location.hash || "");
    const G = window.SURGE_GUARD;
    if (G && G.cheatQuery && G.cheatQuery(qh) && typeof history !== "undefined" && history.replaceState) {
      try { history.replaceState(null, "", location.pathname); } catch (_) { /* ignore */ }
    }
  }
  requestAnimationFrame(loop);
})();
