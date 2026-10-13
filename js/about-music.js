/**
 * Classic Level Surge soundtrack for the about page —
 * the shared sequencer the game used before per-dimension engines.
 */
(() => {
  // Pre-engine BPMs (game now uses wildly different ones).
  const CLASSIC_BPM = [
    128, 122, 118, 126, 132, 124, 120, 136, 140, 114,
    128, 108, 144, 112, 134, 126, 138, 130, 116, 148,
  ];

  function classicChords(rootHz) {
    const r = rootHz;
    return [
      [r, r * 1.18921, r * 1.49831, r * 2],
      [r * 0.79370, r, r * 1.18921, r * 1.58740],
      [r * 1.18921, r * 1.49831, r * 1.78180, r * 2.37841],
      [r * 0.89090, r * 1.12246, r * 1.33484, r * 1.78180],
    ];
  }

  function dimAt(t) {
    const pack = window.SURGE_WORLDS;
    const count = pack ? pack.count : 20;
    const hold = 9;
    return (Math.floor(t / hold) % count) + 1;
  }

  const audio = {
    ctx: null,
    unlocked: false,
    muted: false,
    master: null,
    musicGain: null,
    drone: null,
    musicId: 0,
    _musicOn: false,
    _nextNote: 0,
    _step: 0,
    theme: { bpm: 128, root: 92.5, dim: 1 },

    unlock() {
      if (this.unlocked) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.28;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 10;
      comp.ratio.value = 3.6;
      comp.attack.value = 0.004;
      comp.release.value = 0.16;
      this.musicGain.connect(comp);
      comp.connect(this.master);
      this.unlocked = true;
      if (this.ctx.state === "suspended") this.ctx.resume();
      this.ambience();
      this.syncTheme(performance.now() / 1000);
      this.music();
      const tip = document.getElementById("about-sound-tip");
      if (tip) tip.classList.add("on");
    },

    setMuted(on) {
      this.muted = on;
      if (this.drone) {
        this.drone.g.gain.value = on ? 0 : 0.014;
        if (this.drone.g2) this.drone.g2.gain.value = on ? 0 : 0.008;
      }
      if (this.musicGain && this.ctx) {
        this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.musicGain.gain.setTargetAtTime(on ? 0 : 0.28, this.ctx.currentTime, 0.04);
      }
      const btn = document.getElementById("about-mute");
      if (btn) {
        btn.textContent = on ? "🔇" : "🔊";
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      }
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
      g.connect(this.master);
      o2.connect(g2);
      g2.connect(this.master);
      o.start();
      o2.start();
      this.drone = { o, g, o2, g2 };
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

    syncTheme(tSec) {
      const d = dimAt(tSec);
      const pack = window.SURGE_WORLDS;
      const th = pack ? pack.theme(d) : null;
      const root = th ? th.root : 92.5;
      const bpm = CLASSIC_BPM[Math.max(0, Math.min(CLASSIC_BPM.length - 1, d - 1))];
      const prev = this.theme.dim;
      this.theme = { bpm, root, dim: d };
      if (this.drone && this.ctx && th) {
        const base = Math.max(28, root * 0.35);
        try {
          this.drone.o.frequency.setTargetAtTime(base, this.ctx.currentTime, 0.25);
          this.drone.o2.frequency.setTargetAtTime(base * 2, this.ctx.currentTime, 0.25);
        } catch (_) { /* ignore */ }
      }
      if (prev !== d) {
        const tip = document.getElementById("about-sound-tip");
        if (tip && this.unlocked) {
          tip.textContent = (th && th.name ? th.name : "D" + d) + " · classic mix";
        }
      }
    },

    playStep(step, t) {
      const LOOP_BARS = 96;
      const bar = Math.floor(step / 16) % LOOP_BARS;
      const s = step % 16;
      const heat = 0.15;
      const rootHz = (this.theme && this.theme.root) || 92.5;
      const chords = classicChords(rootHz);
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
        root.syncTheme(performance.now() / 1000);
        if (root.muted) {
          root._nextNote = root.ctx.currentTime + 0.08;
          return;
        }
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
  };

  const unlock = () => audio.unlock();
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });

  const muteBtn = document.getElementById("about-mute");
  if (muteBtn) {
    muteBtn.addEventListener("click", (e) => {
      e.preventDefault();
      audio.unlock();
      audio.setMuted(!audio.muted);
    });
  }

  window.SURGE_ABOUT_MUSIC = audio;
})();
