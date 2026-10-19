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
      const trackPack = window.SURGE_TRACKS;
      const track = trackPack ? trackPack.musicFor(d) : null;
      this.theme = {
        bpm: th ? th.bpm : 128,
        root: th ? th.root : 92.5,
        dim: d || 1,
        track: track || null,
      };
      if (this.drone && this.ctx && th) {
        const base = Math.max(28, (th.root || 92.5) * 0.35);
        try {
          this.drone.o.frequency.setTargetAtTime(base, this.ctx.currentTime, 0.2);
          this.drone.o2.frequency.setTargetAtTime(base * 2, this.ctx.currentTime, 0.2);
        } catch (_) { /* ignore */ }
      }
    },
    restartMusic() {
      if (this.musicId) clearTimeout(this.musicId);
      this._musicOn = false;
      this._step = 0;
      if (this.unlocked && this.ctx) this.music();
    },
    hzFrom(rootHz, semitone) {
      return rootHz * Math.pow(2, semitone / 12);
    },
    playStep(step, t) {
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
      if (window.SURGE_TRACKS) ch = window.SURGE_TRACKS.chordsFor(rootHz, dim)[bar % track.prog.length];
      else ch = [rootHz, rootHz * 1.189, rootHz * 1.498, rootHz * 2];
      const ctx = { step, t, bar, s, rootHz, ch, track, heat, scale: track.scale || [0, 2, 3, 5, 7], motif: track.motif || [0, 2, 4, 5] };
      const fn = this._trk[style] || this._trk.voidAmbient;
      fn.call(this, ctx);
    },
    // Each style is a different piece of music — not shared drum/pad skeletons.
    _trk: {
      voidAmbient(c) {
        const { t, s, bar, ch, rootHz, motif } = c;
        if (s === 0) {
          this.voice(ch[0] / 2, t, 3.6, "sine", 0.11);
          this.voice(ch[1] || ch[0] * 1.5, t, 3.4, "sine", 0.05);
          this.voice((ch[2] || ch[0] * 2) * 2, t, 2.8, "triangle", 0.02);
        }
        if (s === 8 && bar % 2 === 1) this.voice(ch[0] * 0.5, t, 1.6, "sine", 0.06);
        if ((s === 4 || s === 12) && bar % 3 === 0) {
          const f = this.hzFrom(rootHz, motif[(bar + s) % motif.length] + 24);
          this.voice(f, t, 1.2, "sine", 0.028);
          this.voice(f * 2.005, t, 0.9, "triangle", 0.012);
        }
      },
      industrial(c) {
        const { t, s, bar, ch, heat } = c;
        const stomps = [0, 6, 8, 11];
        if (stomps.indexOf(s) >= 0) {
          this.voice(70, t, 0.18, "sine", 0.55, 28);
          this.noiseHit(t, 0.08, 0.2, 400);
        }
        if (s === 4 || s === 12 || (heat > 0.4 && s === 10)) {
          this.noiseHit(t, 0.12, 0.28, 1800);
          this.voice(180, t, 0.06, "square", 0.08, 60);
        }
        if (s % 2 === 1) this.noiseHit(t, 0.02, 0.04, 3200);
        if (s === 0) this.voice(ch[0] / 2, t, 0.35, "sawtooth", 0.14);
        if (s === 8) this.voice((ch[1] || ch[0] * 1.2) / 2, t, 0.28, "sawtooth", 0.12, ch[0] / 2);
        if (bar % 4 === 3 && s === 14) this.noiseHit(t, 0.25, 0.18, 900);
      },
      waltz(c) {
        // 3/4 feel inside 16: accents on 0, 6, 10 (and wrap)
        const { t, s, bar, ch, rootHz, motif } = c;
        const beat = s % 12;
        if (beat === 0) {
          this.voice(90, t, 0.2, "sine", 0.35, 40);
          this.voice(ch[0], t, 1.1, "sine", 0.05);
          this.voice(ch[1] || ch[0] * 1.2, t, 1.1, "sine", 0.035);
        }
        if (beat === 4 || beat === 8) this.noiseHit(t, 0.05, 0.08, 5000);
        if (beat === 0 || beat === 4 || beat === 8) {
          const f = this.hzFrom(rootHz, motif[(Math.floor(s / 4) + bar) % motif.length] + 24);
          this.voice(f, t, 0.7, "sine", 0.045);
          this.voice(f * 2.01, t, 0.4, "triangle", 0.02);
        }
        if (s === 0) this.voice(ch[0] / 2, t, 1.4, "sine", 0.1);
      },
      psychedelic(c) {
        const { t, s, bar, ch, rootHz, motif } = c;
        if (s === 0) {
          this.voice(ch[0], t, 2.2, "triangle", 0.055);
          this.voice(ch[0] * 1.008, t, 2.2, "sine", 0.04);
          this.voice((ch[2] || ch[0] * 1.5), t, 2.0, "triangle", 0.035);
          this.voice((ch[3] || ch[0] * 2) * 0.99, t, 1.8, "sine", 0.025);
        }
        // No kick — spore blips
        if (s === 3 || s === 7 || s === 11 || s === 14) {
          const f = this.hzFrom(rootHz, motif[(s + bar) % motif.length] + 19);
          this.voice(f, t, 0.18, "sine", 0.04, f * 1.06);
        }
        if (s % 5 === 2) this.noiseHit(t, 0.04, 0.02, 7000);
        if (bar % 2 === 0 && s === 8) this.voice(ch[0] / 3, t, 1.5, "triangle", 0.08);
      },
      techno(c) {
        const { t, s, bar, ch, rootHz, motif, heat } = c;
        // 4-on-floor
        if (s % 4 === 0) {
          this.voice(180, t, 0.2, "sine", 0.5, 30);
          this.voice(60, t, 0.12, "sine", 0.25);
        }
        if (s === 4 || s === 12) this.noiseHit(t, 0.1, 0.18, 2200);
        // Clock tick every 16th
        this.voice(2400 + (s % 4) * 200, t, 0.012, "square", s % 4 === 0 ? 0.04 : 0.018);
        if (s % 2 === 0) this.noiseHit(t, 0.015, 0.03, 11000);
        if (s % 4 === 0) this.voice(ch[0] / 2, t, 0.16, "square", 0.14);
        if (s % 2 === 0 && bar % 2 === 1) {
          const f = this.hzFrom(rootHz, motif[(s / 2) % motif.length] + 12);
          this.voice(f, t, 0.1, "square", 0.04 + heat * 0.02);
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
          this.voice(ch[0] * 2, t, 0.12, "triangle", 0.06);
          this.voice((ch[1] || ch[0] * 1.2) * 2, t, 0.12, "triangle", 0.04);
        }
        if (s === 0) this.voice(ch[0] / 2, t, 0.9, "sine", 0.16);
        if (s === 8 && bar % 2 === 0) {
          const f = this.hzFrom(rootHz, motif[bar % motif.length] + 12);
          this.voice(f, t, 0.5, "sine", 0.05);
          this.voice(f * 0.5, t + 0.12, 0.4, "sine", 0.03); // echo
        }
        if (s % 4 === 0) this.noiseHit(t, 0.03, 0.02, 2800);
      },
      liquid(c) {
        const { t, s, bar, ch, rootHz, motif } = c;
        if (s === 0) {
          this.voice(ch[0], t, 2.4, "sine", 0.05);
          this.voice(ch[0] * 1.498, t, 2.2, "sine", 0.03);
          this.voice((ch[2] || ch[0] * 2), t, 2.0, "triangle", 0.025);
        }
        // Soft delayed hats (odd 16ths)
        if (s === 3 || s === 7 || s === 11 || s === 15) this.noiseHit(t, 0.06, 0.04, 9000);
        if (s === 2 || s === 10) this.voice(ch[0] / 2, t, 0.8, "sine", 0.09);
        if (s === 0 || s === 8) {
          const f = this.hzFrom(rootHz, motif[(bar + (s ? 1 : 0)) % motif.length] + 24);
          this.voice(f, t, 0.9, "sine", 0.035);
          this.voice(f * 0.997, t, 0.85, "triangle", 0.02);
        }
        if (bar % 4 === 2 && s === 12) this.voice(ch[0] * 4, t, 1.4, "sine", 0.02);
      },
      train(c) {
        const { t, s, bar, ch, rootHz, motif } = c;
        // Gallop: X-x-X X-x-X
        if (s % 4 === 0 || s % 4 === 3) {
          this.voice(140, t, 0.1, "sine", s % 4 === 0 ? 0.45 : 0.28, 35);
          this.noiseHit(t, 0.03, 0.08, 1200);
        }
        if (s === 4 || s === 12) this.noiseHit(t, 0.08, 0.16, 2000);
        if (s % 4 === 0 || s % 4 === 3) this.voice(ch[0] / 2, t, 0.1, "sawtooth", 0.12);
        // Whistle every other bar
        if (bar % 2 === 0 && s === 0) {
          const f = this.hzFrom(rootHz, motif[bar % motif.length] + 24);
          this.voice(f, t, 0.6, "sine", 0.06, f * 1.03);
          this.voice(f * 1.5, t, 0.45, "triangle", 0.03);
        }
        if (s === 8) this.noiseHit(t, 0.1, 0.05, 800); // steam
      },
      glitch(c) {
        const { t, s, bar, ch, rootHz, motif, step } = c;
        // Pseudo-random from step — broken timing
        const r = ((step * 1103515245 + 12345) >>> 0) % 100;
        if (r < 18) {
          this.voice(40 + (r * 3), t, 0.08, "square", 0.35, 20);
          this.noiseHit(t, 0.05, 0.2, 500 + r * 40);
        }
        if (r > 70 && r < 85) this.noiseHit(t, 0.03, 0.15, 8000 + r * 50);
        if (r > 40 && r < 55) {
          const f = this.hzFrom(rootHz, motif[r % motif.length]);
          this.voice(f, t, 0.06, "square", 0.08);
          this.voice(f * 1.5, t, 0.04, "square", 0.05);
        }
        if (s === 0 && bar % 2 === 0) this.voice(ch[0] / 2, t, 0.2, "square", 0.12);
        if (s === 7 || s === 13) this.noiseHit(t, 0.15, 0.12, 1500);
      },
      ritual(c) {
        const { t, s, bar, ch, rootHz, motif } = c;
        if (s === 0) {
          this.voice(48, t, 0.5, "sine", 0.5, 22);
          this.noiseHit(t, 0.2, 0.15, 300);
          this.voice(ch[0] / 2, t, 3.2, "triangle", 0.12);
          this.voice(ch[0], t, 3.0, "sine", 0.05);
          this.voice((ch[1] || ch[0] * 1.5), t, 2.8, "sine", 0.04);
        }
        if (s === 8 && bar % 2 === 1) this.voice(40, t, 0.35, "sine", 0.3, 20);
        if (s === 0 || s === 8) {
          const f = this.hzFrom(rootHz, motif[(bar + (s ? 4 : 0)) % motif.length] + 12);
          this.voice(f, t, 1.4, "triangle", 0.04);
        }
      },
      crystal(c) {
        const { t, s, bar, rootHz, motif, ch } = c;
        // No kick, no bass — only glass
        if (s % 3 === 0) {
          const f = this.hzFrom(rootHz, motif[(s + bar) % motif.length] + 24);
          this.voice(f, t, 0.55, "sine", 0.04);
          this.voice(f * 2.005, t, 0.35, "sine", 0.018);
          this.voice(f * 3.01, t, 0.2, "triangle", 0.01);
        }
        if (s === 0) {
          this.voice(ch[0] * 2, t, 1.8, "sine", 0.03);
          this.voice((ch[1] || ch[0] * 1.25) * 2, t, 1.6, "sine", 0.022);
        }
        if (s === 8) this.voice((ch[2] || ch[0] * 1.5) * 4, t, 1.2, "triangle", 0.018);
      },
      lullaby(c) {
        const { t, s, bar, rootHz, motif, ch } = c;
        if (s === 0) this.voice(ch[0] / 2, t, 2.8, "sine", 0.08);
        // Music box on even steps, sparse
        if (s % 2 === 0) {
          const deg = motif[(Math.floor(s / 2) + bar * 2) % motif.length];
          const f = this.hzFrom(rootHz, deg + 24);
          this.voice(f, t, 0.35, "square", 0.035);
          this.voice(f * 2, t, 0.2, "sine", 0.012);
        }
        // Occasional wrong note dissonance
        if (bar % 4 === 3 && s === 10) this.voice(this.hzFrom(rootHz, 1 + 24), t, 0.6, "triangle", 0.03);
      },
      acid(c) {
        const { t, s, ch, rootHz, motif, heat } = c;
        if (s % 4 === 0) this.voice(165, t, 0.18, "sine", 0.48, 32);
        if (s === 4 || s === 12) this.noiseHit(t, 0.09, 0.16, 2500);
        if (s % 2 === 0) this.noiseHit(t, 0.012, 0.035, 9000);
        // 303 every 16th
        const deg = motif[s % motif.length];
        const next = motif[(s + 1) % motif.length];
        const f = this.hzFrom(rootHz, deg);
        const n = this.hzFrom(rootHz, next);
        this.voice(f, t, 0.13, "sawtooth", 0.07 + heat * 0.03, n);
        if (s === 0) this.voice(ch[0] / 2, t, 0.25, "sawtooth", 0.1);
      },
      organ(c) {
        const { t, s, ch } = c;
        if (s !== 0) return;
        const vol = 0.07;
        this.voice(ch[0], t, 3.5, "sine", vol);
        this.voice(ch[0] * 2, t, 3.5, "sine", vol * 0.55);
        this.voice((ch[1] || ch[0] * 1.5), t, 3.5, "sine", vol * 0.5);
        this.voice((ch[2] || ch[0] * 2), t, 3.5, "triangle", vol * 0.4);
        if (ch[3]) this.voice(ch[3], t, 3.5, "sine", vol * 0.3);
        this.voice(ch[0] / 2, t, 3.5, "sine", 0.1);
        // Soft pedal thump only
        this.voice(55, t, 0.4, "sine", 0.2, 30);
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
        if (s % 2 === 1) this.noiseHit(t, 0.012, 0.04, 10000);
        if (s === 0 || s === 8) this.voice(ch[0] / 2, t, 0.2, "sawtooth", 0.14);
        if (bar % 2 === 1 && s % 2 === 0) {
          const f = this.hzFrom(rootHz, motif[(s / 2) % motif.length] + 12);
          this.voice(f, t, 0.1, "sawtooth", 0.045);
        }
      },
      chip(c) {
        const { t, s, bar, rootHz, motif, ch } = c;
        // Arp bass + square lead — no pads, no noise hats
        if (s % 2 === 0) {
          const deg = motif[(s + bar * 2) % motif.length];
          this.voice(this.hzFrom(rootHz, deg + 12), t, 0.11, "square", 0.055);
        }
        if (s % 4 === 0) this.voice(ch[0] / 2, t, 0.14, "square", 0.1);
        if (s === 0 || s === 8) this.voice(90, t, 0.08, "square", 0.12);
        // Triangle "counter" every other bar
        if (bar % 2 === 0 && (s === 4 || s === 12)) {
          this.voice(this.hzFrom(rootHz, motif[(s / 4) % motif.length] + 19), t, 0.2, "triangle", 0.04);
        }
      },
      needle(c) {
        const { t, s, bar, rootHz, motif, ch } = c;
        if (s === 0 && bar % 4 === 0) this.voice(ch[0] / 3, t, 3.8, "sine", 0.07);
        // Rare needle pings
        if (s === 3 || s === 11 || (bar % 3 === 0 && s === 7)) {
          const f = this.hzFrom(rootHz, motif[(bar + s) % motif.length]);
          this.voice(f, t, 0.08, "triangle", 0.05);
          this.voice(f * 2.5, t, 0.05, "sine", 0.025);
        }
        if (bar % 8 === 7 && s === 14) this.noiseHit(t, 0.4, 0.06, 200);
      },
      doom(c) {
        const { t, s, bar, ch, rootHz, motif } = c;
        if (s === 0 || s === 8) {
          this.voice(70, t, 0.35, "sine", 0.5, 25);
          this.noiseHit(t, 0.12, 0.18, 600);
          // Power chord
          this.voice(ch[0], t, 0.9, "sawtooth", 0.1);
          this.voice(ch[0] * 1.498, t, 0.9, "sawtooth", 0.07);
          this.voice(ch[0] * 2, t, 0.9, "triangle", 0.05);
        }
        if (s === 4 || s === 12) this.noiseHit(t, 0.1, 0.14, 1800);
        if (bar % 2 === 1 && s === 0) {
          const f = this.hzFrom(rootHz, motif[bar % motif.length] + 12);
          this.voice(f, t, 0.7, "triangle", 0.05);
        }
      },
      fold(c) {
        // 7/8 cycle: 14 sixteenths then 2 rest
        const { t, s, bar, ch, rootHz, motif } = c;
        const cell = (bar * 16 + s) % 14;
        if (cell === 0 || cell === 4 || cell === 8) {
          this.voice(120, t, 0.12, "sine", 0.4, 35);
        }
        if (cell === 2 || cell === 6 || cell === 10 || cell === 12) {
          this.noiseHit(t, 0.05, 0.1, 4000);
        }
        if (cell < 14 && cell % 2 === 0) {
          const f = this.hzFrom(rootHz, motif[cell % motif.length] + 12);
          this.voice(f, t, 0.12, "sine", 0.045);
        }
        if (cell === 0) this.voice(ch[0] / 2, t, 0.5, "triangle", 0.12);
        // Mirror phrase backwards every other cycle
        if (bar % 2 === 1 && cell === 0) {
          this.voice(ch[0] * 2, t, 0.8, "triangle", 0.03);
        }
      },
      fanfare(c) {
        const { t, s, bar, ch, rootHz, motif } = c;
        // March: kick on 0/8, snare 4/12
        if (s === 0 || s === 8) this.voice(160, t, 0.18, "sine", 0.45, 30);
        if (s === 4 || s === 12) {
          this.noiseHit(t, 0.1, 0.2, 2400);
          this.voice(300, t, 0.06, "triangle", 0.08);
        }
        if (s % 2 === 0) this.noiseHit(t, 0.02, 0.03, 8000);
        if (s % 2 === 0) {
          const deg = motif[(s / 2 + bar) % motif.length];
          const f = this.hzFrom(rootHz, deg + 12);
          this.voice(f, t, 0.2, "sawtooth", 0.055);
          this.voice(f * 1.498, t, 0.2, "triangle", 0.03);
        }
        if (s === 0) {
          this.voice(ch[0], t, 0.9, "sawtooth", 0.06);
          this.voice(ch[0] * 1.25, t, 0.9, "sawtooth", 0.04);
          this.voice(ch[0] * 1.5, t, 0.9, "triangle", 0.035);
        }
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
        if (mode !== "play" && mode !== "title" && mode !== "pause" && mode !== "levels" && mode !== "clear" && mode !== "win") return;
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
  let clearBloom = 0;
  let lastView = { scale: 1, ox: 0, oy: 0, rot: 0 };
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
    if (!G || !G.packProgress) return {};
    const next = G.sanitizeSave(Object.assign({}, loadSave(), G.sanitizeSave(patch)));
    const encoded = G.packProgress(next);
    try { if (encoded) localStorage.setItem(SAVE_KEY, encoded); } catch (_) { /* quota */ }
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
    world.baseGravity = world.gravity;
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
      if (creatorPlay) dimNameEl.textContent = "CREATOR";
      else {
        const th = currentTheme();
        dimNameEl.textContent = `D${dimIndex} ${th.name}`;
      }
    }
    updatePips();
    if (deathsEl) deathsEl.textContent = `☠ ${deaths}`;
    introT = testMode ? 0 : (dimIntro > 0.5 ? dimIntro + 0.9 : 1.05);
    clearBloom = 0;
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

  function shock(x, y, color) {
    if (!world.rings) world.rings = [];
    if (world.rings.length > 16) world.rings.shift();
    world.rings.push({
      x, y, r: 5, vr: 118, life: 0.28, max: 0.28,
      color: color || "rgba(244,234,216,0.75)",
    });
  }

  function dust(x, y, n, kick) {
    kick = kick || 0;
    for (let i = 0; i < n; i++) {
      world.particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y,
        vx: (Math.random() - 0.5) * 1.2 - kick,
        vy: -0.4 - Math.random() * 1.1,
        grav: 0.08,
        life: 0.28 + Math.random() * 0.22,
        color: "#c4b8a8",
        size: 2 + Math.random() * 2,
        kind: "square",
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
    stalker: [
      "IT FOLLOWED YOU HOME",
      "DON'T LOOK BACK",
      "THE SHADOW CAUGHT UP",
      "YOU WERE THE PREY",
    ],
    drone: [
      "TARGET LOCKED",
      "THE DRONE SAW YOU",
      "ROBOTS DON'T MISS",
      "RED LIGHT MEANS RUN",
    ],
    rocket: [
      "INCOMING",
      "YOU CAN'T OUTRUN A ROCKET",
      "THAT WAS A MISSILE",
      "JUMP THE EXPLOSION NEXT TIME",
    ],
    fog: [
      "THE DARK BITES",
      "FOG DOESN'T CARE",
      "YOU STOOD IN THE VOID",
      "THE FLOOR WASN'T THE DANGER",
    ],
    watcher: [
      "SEEN",
      "IT WAS WATCHING",
      "DON'T FREEZE",
      "THE EYE WON",
    ],
    sentry: [
      "DEFENSE ONLINE",
      "TURRET SAYS NO",
      "YOU ENTERED THE ARC",
      "WALLS HAVE GUNS NOW",
    ],
    swarm: [
      "THEY FOUND YOU",
      "TOO MANY TEETH",
      "THE AIR BIT BACK",
      "SWARM 1  ·  YOU 0",
    ],
    phantom: [
      "THAT'S NOT YOU",
      "YOUR GHOST WON",
      "MIRROR MATCH: LOSS",
      "IT WORE YOUR FACE",
    ],
    light: [
      "STAY IN THE LIGHT",
      "THE DARK WAS HUNGRY",
      "SPOTLIGHT OR DIE",
      "YOU LEFT THE SAFE CIRCLE",
    ],
    crush: [
      "STOMP",
      "THE ROBOT SAID SIT",
      "HEAVY METAL",
      "YOU WERE UNDER THAT",
    ],
    qte: [
      "TOO SLOW",
      "THAT LETTER WAS THE TRAP",
      "THE PROMPT WON",
      "YOU MISSED THE KEY",
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
        if (ty < 0 || tx < 0 || ty >= world.rows || tx >= world.cols) continue;
        if (!force && world.tiles[ty][tx] === ch) continue;
        burst(tx * TILE + 16, ty * TILE + 10, color, n, hazard ? 3.4 : 2.6);
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
          if (ty < 0 || ty >= world.rows || tx < 0 || tx >= world.cols) continue;
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
        if (ty < 0 || ty >= world.rows || tx < 0 || tx >= world.cols) continue;
        cells.push([tx, ty, world.tiles[ty][tx]]);
        world.tiles[ty][tx] = ch;
        fxTiles(tx, ty, 1, 1, ch);
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

  function tickEvents() {
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
            if (!player.wasOnGround && (player.airTime || 0) > 0.08 && Math.abs(player.vy) > 2.2) {
              audio.play("land");
              player.justLanded = true;
              world.squash = 0.42;
              camFX.punch = Math.max(camFX.punch, 4.2);
              dust(player.x + player.w / 2, player.y + player.h, 8, 0.4);
              shock(player.x + player.w / 2, player.y + player.h, "rgba(244,234,216,0.8)");
              burst(player.x + player.w / 2, player.y + player.h - 2, "#fff6d8", 4, 2.2);
              if (stickyNext > 0) {
                lockTimer = Math.max(lockTimer, stickyNext);
                stickyNext = 0;
                world.shake = Math.max(world.shake, 3);
                audio.play("land");
              }
            }
            player.onGround = true;
            player.airTime = 0;
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
    world.qte = null;
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
    if (creatorPlay) {
      say(world.deathReason);
      deathTimer = 0.85;
      return;
    }
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
      clearStats.textContent = `${world.time.toFixed(1)}s · ☠ ${deaths} · SURGE x${Math.max(1, combo)}`;
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
    if (world.qte && world.qte.lock) { ix = 0; jumpDown = false; }

    if (world.reverse) ix *= -1;
    if (ix) player.facing = ix;
    const icy = (world.slipT || 0) > 0;
    const accel = player.onGround ? (icy ? 0.42 : 0.9) : 0.58;
    if (ix) player.vx += ix * accel;
    else player.vx *= player.onGround ? (icy ? 0.96 : 0.7) : 0.94;
    player.vx += world.wind;
    if (world.magnet && world.time < world.magnet.until) {
      const pull = Math.sign(world.magnet.x - (player.x + player.w / 2)) * (world.magnet.str || 0.16);
      player.vx += pull;
    }
    if (!ix && player.onGround && !icy && Math.abs(player.vx) < 0.35) player.vx = 0;

    dashCool = Math.max(0, dashCool - FIXED);
    dashT = Math.max(0, dashT - FIXED);
    const wantDash = keys.has("Shift") || hold.dash;
    if (dimIndex >= 3 && wantDash && dashCool <= 0 && !player.dead && !(world.qte && world.qte.lock)) {
      const dir = ix || player.facing || 1;
      player.vx = dir * 9.2;
      player.vy *= 0.35;
      dashCool = 0.72;
      dashT = 0.16;
      audio.play("dash");
      burst(player.x + player.w / 2, player.y + player.h / 2, "#ffe8a0", 14, 5);
      shock(player.x + player.w / 2, player.y + player.h / 2, "rgba(255,232,170,0.85)");
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
      dust(player.x + player.w / 2, player.y + player.h, 4);
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

    if (Math.abs(movedX) > 2.4 || (!player.onGround && Math.abs(player.vy) > 2.5)) {
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
      shock(midX, player.y + player.h, "rgba(255,210,122,0.9)");
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

    player.stepCool = Math.max(0, (player.stepCool || 0) - FIXED);
    if (ix && player.onGround && Math.abs(movedX) > 0.35) {
      player.anim += Math.abs(movedX) * 0.22;
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
      if (laser.life <= 0) { world.lasers.splice(i, 1); continue; }
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
    for (const d of world.drops) {
      d.vy += 0.4;
      d.y += d.vy;
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
      if (e.life <= 0) { world.entities.splice(i, 1); continue; }

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
        if (entityHit(e, 1)) { die("ROCKET"); return; }
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

  function tickParticles() {
    for (let i = world.particles.length - 1; i >= 0; i--) {
      const p = world.particles[i];
      p.vy += p.grav != null ? p.grav : 0.25;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= FIXED;
      if (p.rot != null) p.rot += p.spin || 0;
      if (p.life <= 0) world.particles.splice(i, 1);
    }
    if (world.rings) {
      for (let i = world.rings.length - 1; i >= 0; i--) {
        const ring = world.rings[i];
        ring.r += ring.vr * FIXED;
        ring.life -= FIXED;
        if (ring.life <= 0) world.rings.splice(i, 1);
      }
    }
    for (let i = world.afterimages.length - 1; i >= 0; i--) {
      world.afterimages[i].life -= FIXED;
      if (world.afterimages[i].life <= 0) world.afterimages.splice(i, 1);
    }
  }

  function camera() {
    const lw = world.cols * TILE;
    const lh = world.rows * TILE;
    const fitCols = Math.min(world.cols, 32);
    // Shaft rooms are taller than a corridor. Fit the usual 12 rows so the
    // player stays the same size, then follow them if the map is actually taller
    // than the view.
    const fitRows = Math.min(world.rows, 12);
    const scale = Math.min(VIEW_W / (fitCols * TILE + 36), VIEW_H / (fitRows * TILE + 70));
    let oy = (VIEW_H - lh * scale) / 2 + 8;
    let ox = (VIEW_W - Math.min(lw, fitCols * TILE) * scale) / 2;
    if (world.cols > 32) {
      const focus = player.x + player.w / 2;
      const viewW = VIEW_W / scale;
      let cam = focus - viewW * 0.38;
      const maxCam = Math.max(0, lw - viewW);
      if (cam < 0) cam = 0;
      if (cam > maxCam) cam = maxCam;
      ox = -cam * scale;
    }
    if (world.rows > 12) {
      const viewH = VIEW_H / scale;
      if (lh > viewH) {
        const focusY = player.y + player.h * 0.5;
        let camY = focusY - viewH * 0.62;
        const maxCamY = lh - viewH;
        if (camY < 0) camY = 0;
        if (camY > maxCamY) camY = maxCamY;
        oy = -camY * scale;
      }
    }
    camFX.phase += 1.37;
    camFX.punch *= 0.82;
    const sx = world.shake ? Math.sin(camFX.phase * 1.7) * world.shake : 0;
    const sy = world.shake ? Math.cos(camFX.phase * 2.15) * world.shake * 0.72 : 0;
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
    // Soft vertical shade so blocks read as volumes
    const shade = ctx.createLinearGradient(px, py, px + TILE, py);
    shade.addColorStop(0, "rgba(255,255,255,0.07)");
    shade.addColorStop(0.45, "rgba(255,255,255,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = shade;
    ctx.fillRect(px, py, TILE, TILE);
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
    // Trap heat + later dims push the void into a denser trip.
    const dim = world.dim || 1;
    const trip = Math.min(0.85, 0.32 + heat * 0.28 + Math.max(0, dim - 1) * 0.015);
    if (window.SURGE_VOID && window.SURGE_VOID.draw) {
      window.SURGE_VOID.draw({
        ctx, w: VIEW_W, h: VIEW_H, t, theme: th, pulse, heat, trip,
        floorShade: true, bolt: true,
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
    ctx.save();
    // Aura
    const aura = ctx.createRadialGradient(x + 18, y + 28, 6, x + 18, y + 28, 34);
    aura.addColorStop(0, fake ? `rgba(255,80,80,${0.2 + pulse * 0.12})` : `rgba(255,200,80,${0.18 + pulse * 0.14})`);
    aura.addColorStop(1, "rgba(0,0,0,0)");
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
    const panel = ctx.createLinearGradient(x + 3, y + 10, x + 33, y + 48);
    panel.addColorStop(0, "rgba(255,255,255,0.12)");
    panel.addColorStop(0.5, "rgba(0,0,0,0)");
    panel.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = panel;
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
    ctx.translate(ax, ay);
    ctx.scale(pop, pop);
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
      ctx.shadowColor = "#ff2020";
      ctx.shadowBlur = 8;
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
      ctx.shadowColor = "#ff40e0";
      ctx.shadowBlur = 10;
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
      ctx.shadowColor = "#ff3030";
      ctx.shadowBlur = 12;
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
        ctx.shadowColor = "#ff2020";
        ctx.shadowBlur = 8;
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
        ctx.shadowColor = "#ff4040";
        ctx.shadowBlur = 10;
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
        ctx.shadowColor = mad ? "#ff2020" : "transparent";
        ctx.shadowBlur = mad ? 12 : 0;
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
        ctx.shadowColor = "#ff4040";
        ctx.shadowBlur = 8;
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
        ctx.shadowColor = "#ff4040";
        ctx.shadowBlur = 12;
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
        ctx.shadowColor = "#ff3030";
        ctx.shadowBlur = 8;
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
    if (alpha > 0.85 && mode === "play" && !player.dead) {
      ctx.rotate(Math.max(-0.18, Math.min(0.18, player.vx * 0.02)));
    }
    ctx.scale(facing < 0 ? -1 : 1, world.gravity < 0 ? -1 : 1);
    let sq = squash;
    if (alpha > 0.85 && mode === "play" && !player.dead && !player.onGround) {
      sq += Math.max(-0.22, Math.min(0.16, player.vy * 0.016));
    }
    const sy = 1 - sq * 0.5;
    const sx = 1 + sq * 0.34;
    ctx.scale(sx, sy);
    ctx.translate(-player.w / 2, -player.h / 2);

    const demo = mode === "title" || mode === "levels";
    const gait = opts.gait != null ? opts.gait : (demo ? Math.sin(performance.now() / 90) : Math.sin(player.anim));
    const air = opts.air != null ? opts.air : (demo ? false : !player.onGround);
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

    // Red cube hands (no arms)
    const handY = air ? 16 : 17 + gait * 1.2;
    ctx.fillStyle = "#e31b1b";
    ctx.fillRect(-4, handY, 5, 5);
    ctx.fillRect(23, handY - gait * 0.8, 5, 5);
    ctx.fillStyle = "#ff5a5a";
    ctx.fillRect(-3, handY + 1, 2, 2);
    ctx.fillRect(24, handY - gait * 0.8 + 1, 2, 2);

    const leg = air ? -2 : gait * 3.2;
    ctx.fillStyle = "#7a0e0e";
    ctx.fillRect(3, 24, 6, 5 + (air ? 1 : Math.max(0, -leg)));
    ctx.fillRect(15, 24, 6, 5 + (air ? 1 : Math.max(0, leg)));
    ctx.fillStyle = "#1a100c";
    ctx.fillRect(2, 27 + (air ? 1 : Math.max(0, -leg)), 7, 3);
    ctx.fillRect(14, 27 + (air ? 1 : Math.max(0, leg)), 7, 3);
    // Hoof tips
    ctx.fillStyle = "#e31b1b";
    ctx.fillRect(2, 29 + (air ? 1 : Math.max(0, -leg)), 3, 1.5);
    ctx.fillRect(14, 29 + (air ? 1 : Math.max(0, leg)), 3, 1.5);

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
    if (!player.dead) blob(player.x + player.w / 2, player.y + player.h + 3, 13, 4.5, 0.4);
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
    for (const ring of world.rings || []) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ring.life / ring.max);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.stroke();
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
      const flicker = 0.85 + Math.sin(world.time * 48 + l.x) * 0.15;
      if (l.fake) {
        ctx.fillStyle = `rgba(160,200,255,${0.1 * a})`;
        ctx.fillRect(l.x - 5, l.y - 6, l.w + 10, l.h + 12);
        ctx.fillStyle = `rgba(210,230,255,${0.35 * a})`;
        ctx.fillRect(l.x, l.y, l.w, l.h);
        ctx.fillStyle = `rgba(255,255,255,${0.25 * a})`;
        ctx.fillRect(l.x + 1, l.y + 1, Math.max(1, l.w - 2), Math.max(1, Math.min(2, l.h - 2)));
        continue;
      }
      ctx.fillStyle = `rgba(255,40,40,${0.2 * a * flicker})`;
      ctx.fillRect(l.x - 6, l.y - 6, l.w + 12, l.h + 12);
      ctx.fillStyle = `rgba(255,80,80,${0.45 * a})`;
      ctx.fillRect(l.x - 2, l.y - 2, l.w + 4, l.h + 4);
      ctx.fillStyle = `rgba(255,230,230,${0.92 * a * flicker})`;
      ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.fillStyle = `rgba(255,255,255,${0.7 * a})`;
      if (l.w >= l.h) ctx.fillRect(l.x + 1, l.y + Math.max(0, l.h / 2 - 1), Math.max(1, l.w - 2), 2);
      else ctx.fillRect(l.x + Math.max(0, l.w / 2 - 1), l.y + 1, 2, Math.max(1, l.h - 2));
    }
  }

  function drawOverlay() {
    if (world.flash > 0) {
      ctx.fillStyle = `rgba(227,27,27,${world.flash * 2})`;
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
  }

  function drawSpeedLines() {
    if (dashT <= 0 || player.dead || mode !== "play") return;
    const a = Math.min(1, dashT / 0.16);
    const dir = player.facing || 1;
    ctx.save();
    ctx.globalAlpha = 0.32 * a;
    ctx.strokeStyle = "#ffe8a0";
    ctx.lineWidth = 1.25;
    for (let i = 0; i < 9; i++) {
      const y = frac(i * 3.7 + world.time * 9) * VIEW_H;
      const len = 50 + frac(i * 8.2) * 140;
      const x = frac(i * 5.1 + world.time * 4) * VIEW_W;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - dir * len, y + (i - 4) * 1.4);
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

  function drawAirFront(view) {
    if (mode !== "play") return;
    const th = currentTheme();
    const accent = th.accent || [210, 225, 255];
    const t = world.time || 0;
    ctx.save();
    for (let i = 0; i < 22; i++) {
      const n = frac(i * 5.1 + 0.4);
      const x = (frac(i * 2.7) * (VIEW_W + 40) + t * (16 + n * 28)) % (VIEW_W + 40) - 20;
      const y = (frac(i * 8.3) * VIEW_H + Math.sin(t * 0.7 + i) * 18 + VIEW_H) % VIEW_H;
      const s = n > 0.86 ? 11 : n > 0.55 ? 5 : 2.5;
      ctx.fillStyle = `rgba(${accent[0]},${accent[1]},${accent[2]},${0.16 + n * 0.28})`;
      ctx.fillRect(x, y, s, s);
    }
    if (view && world.door && !world.doorHidden) {
      const x = (world.door.x + 16) * view.scale + view.ox;
      const y = (world.door.y + 20) * view.scale + view.oy;
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
      const x = world.door.x + 16;
      const y = world.door.y + 18;
      const g = ctx.createLinearGradient(x, y - 220, x, y + 48);
      g.addColorStop(0, "rgba(255,220,150,0)");
      g.addColorStop(0.72, "rgba(255,210,120,0.05)");
      g.addColorStop(1, "rgba(255,210,120,0.2)");
      ctx.fillStyle = g;
      ctx.fillRect(x - 16, y - 220, 36, 268);
      const pool = ctx.createRadialGradient(x, world.door.y + 52, 4, x, world.door.y + 52, 56);
      pool.addColorStop(0, "rgba(255,200,90,0.28)");
      pool.addColorStop(1, "rgba(255,200,90,0)");
      ctx.fillStyle = pool;
      ctx.beginPath();
      ctx.ellipse(x, world.door.y + 50, 50, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function render() {
    clearBloom = Math.max(0, clearBloom - 0.016);
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
    drawRoomAir();
    drawBlood();
    for (const p of world.platforms) {
      drawBrickFace(p.x, p.y, "#6a4030", "#e0b090", false);
    }
    for (const d of world.drops) drawBrickFace(d.x, d.y, "#5a3830", "#c0a080", false);
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
    for (const saw of world.saws) drawSaw(saw);
    drawEntities();
    drawDevil();
    drawDashReady();
    if (deathShow && window.DeathRoast) window.DeathRoast.drawWorld(ctx, deathShow, roastApi());
    drawParticles();
    ctx.restore();
    drawLighting(view);
    drawPit(view);
    drawAirFront(view);
    drawOverlay();
    drawQte();
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
    tickRareEffects();
    tickQte();
    if (mode === "play") updateHud();
  }

  function loop(ts) {
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
    if (dimCard) dimCard.classList.add("hidden");
    const pauseName = document.getElementById("pause-name");
    if (pauseName) pauseName.textContent = world.name;
    audio.play("pause");
  }

  function resumeGame() {
    if (mode !== "pause") return;
    if (pauseScreen) pauseScreen.classList.add("hidden");
    if (dimCard && dimIntro > 0) dimCard.classList.remove("hidden");
    mode = "play";
  }

  function leavePlayUi() {
    if (pauseScreen) pauseScreen.classList.add("hidden");
    if (levelsScreen) levelsScreen.classList.add("hidden");
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
    creatorPlay = !!creatorReturn;
    testMode = opts.testMode !== false;
    window.LEVELS = pack;
    dimIndex = Math.max(1, Math.min(20, opts.dim || 1));
    audio.unlock();
    audio.setTheme(dimIndex);
    audio.restartMusic();
    shardsGot = 0;
    deathGhost = null;
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
    const unlocked = loadSave().unlockedDim || 1;
    const rec = loadSave().dimRecords || {};
    const progress = loadSave().rooms || {};
    grid.innerHTML = "";
    grid.classList.remove("room-grid");
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
      const reached = progress[d] != null ? progress[d] : (locked ? -1 : 0);
      const deathsN = rec[d] && typeof rec[d].bestDeaths === "number" ? rec[d].bestDeaths : null;
      const recLine = deathsN == null ? "" : " · " + deathsN + "☠";
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
      grid.appendChild(b);
    });
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
      const num = document.createElement("span");
      num.className = "n";
      num.textContent = (i === roomsN - 1 && d > 1 ? "CORE " : "ROOM ") + String(i + 1).padStart(2, "0");
      const nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = locked ? "LOCKED" : String(lvl.name || ("ROOM " + (i + 1)));
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

  document.getElementById("play-btn").onclick = () => {
    const s = loadSave();
    enterDimension(s.lastDim || 1, s.lastRoom != null ? s.lastRoom : 0);
  };
  document.getElementById("again-btn").onclick = () => enterDimension(dimIndex, 0);
  const nextDimBtn = document.getElementById("next-dim-btn");
  if (nextDimBtn) nextDimBtn.onclick = () => enterDimension(Math.min(20, dimIndex + 1), 0);
  const levelsBtn = document.getElementById("levels-btn");
  if (levelsBtn) levelsBtn.onclick = showLevels;
  const levelsBack = document.getElementById("levels-back");
  if (levelsBack) levelsBack.onclick = levelsGoBack;
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

  function setMode(m) { mode = m; }

  window.addEventListener("pointerdown", (e) => {
    audio.unlock();
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
  window.addEventListener("keydown", (e) => {
    audio.unlock();
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    if (mode === "pause") {
      if (e.key === "Escape") resumeGame();
      return;
    }
    keys.add(e.key);
    if (mode === "play" && world.qte && !player.dead && !e.repeat && e.key.length === 1 && /[a-z]/i.test(e.key) && !"wasd".includes(e.key.toLowerCase())) {
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
    else if (mode === "levels" && e.key === "Escape") levelsGoBack();
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
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        unlockedDim: 20,
        bestDeaths: 1,
        runs: 1,
      }));
      const legacy = loadSave();
      if (legacy.unlockedDim !== 20 || legacy.bestDeaths !== 1) fails.push("legacy save was not migrated");
      const legacySealed = localStorage.getItem(SAVE_KEY) || "";
      if (legacySealed.indexOf('"m"') < 0) fails.push("legacy save was not resealed");
      if (G.openProgress(JSON.stringify({ unlockedDim: 9 })).unlockedDim) fails.push("raw unsigned open accepted");
      const merged = writeSave({
        unlockedDim: 3,
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
      if (merged.unlockedDim !== 3 || kept.unlockedDim !== 3 || kept.lastRoom !== 2 || kept.bestDeaths !== 7) {
        fails.push("sealed save damaged");
      }
      if (!kept.rooms || kept.rooms[1] !== 15 || kept.rooms[3] !== 2) fails.push("rooms damaged");
      if (!kept.dimRecords || !kept.dimRecords[3] || kept.dimRecords[3].shards !== 1) fails.push("records damaged");
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
      if (save.unlockedDim !== 4) fails.push("legacy unlock was not migrated");
      if (typeof save.bestDeaths !== "undefined") fails.push("string bestDeaths kept");
      if (save.dimRecords && save.dimRecords[1] && Object.prototype.hasOwnProperty.call(save.dimRecords[1], "bestDeaths")) {
        fails.push("html deaths kept");
      }
      if (save.polluted || Object.prototype.polluted) fails.push("prototype polluted");
      const stored = localStorage.getItem(SAVE_KEY) || "";
      if (stored.indexOf("<") >= 0 || stored.indexOf("onerror") >= 0 || stored.indexOf("__proto__") >= 0) {
        fails.push("poison persisted");
      }
      if (stored.indexOf('"m"') < 0) fails.push("poisoned legacy was not resealed");
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

  if (window.__SURGE_TEST__) {
    window.__GAME = {
      hold, keys, player, world, loadLevel, startGame, enterDimension, step, die, winLevel,
      runAction, matchEvent, tileAt, isSolid, setTiles, parseSol, deathKind,
      unitTests, smokeAllLevels, playtestLevel, playtestAll, playSolLevel, playSolAll,
      searchSol, searchSolAll, runSelfTest, playCustom, quitToTitle, setMode, securitySelfTest,
      get mode() { return mode; },
      get creatorPlay() { return creatorPlay; },
    };
  } else {
    window.__GAME = Object.freeze({ setMode: setMode, playCustom: playCustom });
  }

  refreshRecords();
  requestAnimationFrame(loop);
})();
