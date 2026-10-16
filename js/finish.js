/* Level Surge finish pass.
   Screen-space detail that sits on top of the picture: film marks, edge props,
   state tells, and weather crumbs. World drawing stays in game.js.
   One hundred features live across this file, the about page, and the style sheets.
   This file owns 1–64. */
(function (root) {
  const FEATURES = [];
  function add(id, fn, rich) {
    FEATURES.push({ id, fn, rich: !!rich });
  }

  function frac(n) {
    return n - Math.floor(n);
  }

  let prevGround = true;
  let prevTraps = 0;
  let landPulse = 0;
  let jumpPulse = 0;
  let trapPulse = 0;
  let budget = 1;
  let reduced = false;

  try {
    reduced = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) { reduced = false; }

  function arm(s) {
    if (s.mode === "play") {
      if (s.ground && !prevGround) landPulse = 1;
      if (!s.ground && prevGround && s.vy < -0.8) jumpPulse = 1;
      if ((s.traps || 0) > prevTraps) trapPulse = 1;
      prevGround = !!s.ground;
      prevTraps = s.traps || 0;
    }
    const decay = reduced ? 0.7 : 0.9;
    landPulse *= decay;
    jumpPulse *= decay;
    trapPulse *= decay;
    s.land = landPulse;
    s.jump = jumpPulse;
    s.trapPulse = trapPulse;
    s.reduced = reduced;
  }

  function cross(ctx, x, y, a) {
    ctx.globalAlpha = a;
    ctx.strokeStyle = "#f4ead8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x + 8, y);
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y + 8);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function bolt(ctx, x, y, a) {
    ctx.globalAlpha = a;
    ctx.strokeStyle = "#cbbba6";
    ctx.lineWidth = 1.25;
    ctx.strokeRect(x - 3, y - 3, 6, 6);
    ctx.fillStyle = "#ffd27a";
    ctx.fillRect(x - 1, y - 1, 2, 2);
    ctx.globalAlpha = 1;
  }

  function spikeRow(ctx, x, y, n, dir, a) {
    ctx.globalAlpha = a;
    ctx.fillStyle = "#f4ead8";
    for (let i = 0; i < n; i++) {
      const yy = y + i * 16;
      ctx.beginPath();
      if (dir > 0) {
        ctx.moveTo(x, yy);
        ctx.lineTo(x + 14, yy + 7);
        ctx.lineTo(x, yy + 14);
      } else {
        ctx.moveTo(x, yy);
        ctx.lineTo(x - 14, yy + 7);
        ctx.lineTo(x, yy + 14);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  add("reg-tl", (ctx, s) => cross(ctx, 18, 18, 0.28));
  add("reg-tr", (ctx, s) => cross(ctx, s.w - 18, 18, 0.28));
  add("reg-bl", (ctx, s) => cross(ctx, 18, s.h - 18, 0.22));
  add("reg-br", (ctx, s) => cross(ctx, s.w - 18, s.h - 18, 0.22));

  add("timecode-dots", (ctx, s) => {
    if (s.mode !== "play") return;
    ctx.fillStyle = "rgba(231,197,106,0.45)";
    const n = 8;
    for (let i = 0; i < n; i++) {
      const x = s.w * (0.32 + i * 0.05);
      ctx.fillRect(x, 10, i === ((s.t * 2) | 0) % n ? 6 : 2, 2);
    }
  });

  add("sprocket-left", (ctx, s) => {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    for (let y = 28; y < s.h - 20; y += 22) ctx.fillRect(4, y, 7, 10);
    ctx.strokeStyle = "rgba(244,234,216,0.18)";
    ctx.strokeRect(3, 22, 9, s.h - 44);
  });

  add("sprocket-right", (ctx, s) => {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    for (let y = 28; y < s.h - 20; y += 22) ctx.fillRect(s.w - 11, y, 7, 10);
    ctx.strokeStyle = "rgba(244,234,216,0.18)";
    ctx.strokeRect(s.w - 12, 22, 9, s.h - 44);
  });

  add("hairline-top", (ctx, s) => {
    ctx.fillStyle = "rgba(244,234,216,0.16)";
    ctx.fillRect(22, 22, s.w - 44, 1);
  });

  add("hairline-bottom", (ctx, s) => {
    ctx.fillStyle = "rgba(244,234,216,0.12)";
    ctx.fillRect(22, s.h - 23, s.w - 44, 1);
  });

  add("center-ticks", (ctx, s) => {
    ctx.fillStyle = "rgba(244,234,216,0.2)";
    ctx.fillRect(s.w / 2 - 8, 23, 16, 1);
    ctx.fillRect(s.w / 2, 23, 1, 6);
  });

  add("spikes-left", (ctx, s) => {
    if (s.mode !== "play") return;
    spikeRow(ctx, 16, s.h * 0.22, 6, 1, 0.14);
  });

  add("spikes-right", (ctx, s) => {
    if (s.mode !== "play") return;
    spikeRow(ctx, s.w - 16, s.h * 0.58, 5, -1, 0.14);
  });

  add("teeth-top", (ctx, s) => {
    if (s.mode !== "play") return;
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#f4ead8";
    for (let i = 0; i < 5; i++) {
      const x = s.w * 0.2 + i * 28;
      ctx.beginPath();
      ctx.moveTo(x, 24);
      ctx.lineTo(x + 8, 40);
      ctx.lineTo(x + 16, 24);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

  add("brick-lip", (ctx, s) => {
    ctx.fillStyle = "rgba(74,64,56,0.55)";
    ctx.fillRect(0, s.h - 8, s.w, 8);
    ctx.fillStyle = "rgba(207,193,170,0.35)";
    ctx.fillRect(0, s.h - 8, s.w, 2);
  });

  add("chain-left", (ctx, s) => {
    const sway = reduced ? 0 : Math.sin(s.now / 700) * 3;
    ctx.strokeStyle = "rgba(203,187,166,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(26 + sway, 24);
    ctx.lineTo(26 + sway, s.h * 0.34);
    ctx.stroke();
  });

  add("chain-right", (ctx, s) => {
    const sway = reduced ? 0 : Math.sin(s.now / 900 + 1) * 3;
    ctx.strokeStyle = "rgba(203,187,166,0.28)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s.w - 26 + sway, 24);
    ctx.lineTo(s.w - 26 + sway, s.h * 0.28);
    ctx.stroke();
  });

  add("bolt-tl", (ctx, s) => bolt(ctx, 28, 28, 0.4));
  add("bolt-tr", (ctx, s) => bolt(ctx, s.w - 28, 28, 0.4));
  add("bolt-bl", (ctx, s) => bolt(ctx, 28, s.h - 28, 0.3));
  add("bolt-br", (ctx, s) => bolt(ctx, s.w - 28, s.h - 28, 0.3));

  add("base-vignette", (ctx, s) => {
    const g = ctx.createRadialGradient(s.w / 2, s.h / 2, s.h * 0.35, s.w / 2, s.h / 2, s.h * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s.w, s.h);
  });

  add("combo-vignette", (ctx, s) => {
    const k = Math.min(1, (s.combo || 0) / 8);
    if (k < 0.05) return;
    ctx.fillStyle = "rgba(227,27,27," + (0.05 + k * 0.12) + ")";
    ctx.fillRect(0, 0, 10, s.h);
    ctx.fillRect(s.w - 10, 0, 10, s.h);
  });

  add("death-scratches", (ctx, s) => {
    const n = Math.min(6, s.deaths || 0);
    if (!n || s.mode !== "play") return;
    ctx.strokeStyle = "rgba(180,20,20,0.35)";
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const y = 40 + i * 7;
      ctx.beginPath();
      ctx.moveTo(s.w - 36, y);
      ctx.lineTo(s.w - 22, y + 4);
      ctx.stroke();
    }
  });

  add("reverse-arrows", (ctx, s) => {
    if (!s.reverse) return;
    ctx.fillStyle = "rgba(140,180,255,0.55)";
    ctx.beginPath();
    ctx.moveTo(40, 36);
    ctx.lineTo(52, 32);
    ctx.lineTo(52, 40);
    ctx.closePath();
    ctx.fill();
  });

  add("gravity-chevrons", (ctx, s) => {
    if (!(s.grav < 0)) return;
    ctx.strokeStyle = "rgba(200,120,220,0.45)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const x = s.w * 0.4 + i * 18;
      ctx.beginPath();
      ctx.moveTo(x, 34);
      ctx.lineTo(x + 6, 28);
      ctx.lineTo(x + 12, 34);
      ctx.stroke();
    }
  });

  add("wind-barbs", (ctx, s) => {
    if (!s.wind) return;
    const dir = s.wind > 0 ? 1 : -1;
    ctx.strokeStyle = "rgba(244,234,216,0.35)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = s.h * 0.3 + i * 18;
      const x = dir > 0 ? 36 : s.w - 36;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dir * 16, y);
      ctx.lineTo(x + dir * 10, y - 4);
      ctx.stroke();
    }
  });

  add("dash-streaks", (ctx, s) => {
    if (!(s.dash > 0) || s.mode !== "play") return;
    const a = Math.min(1, s.dash / 0.16);
    ctx.globalAlpha = 0.35 * a;
    ctx.fillStyle = "#ffe8a0";
    const dir = s.vx >= 0 ? 1 : -1;
    for (let i = 0; i < 5; i++) {
      const y = s.h * (0.35 + i * 0.07);
      const len = 40 + i * 18;
      const x = dir > 0 ? s.w * 0.2 : s.w * 0.8;
      ctx.fillRect(x, y, dir * len, 1);
    }
    ctx.globalAlpha = 1;
  }, true);

  add("fall-lines", (ctx, s) => {
    if (s.mode !== "play" || s.ground || s.vy < 6) return;
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = "#f4ead8";
    for (let i = 0; i < 4; i++) {
      const x = s.w * (0.42 + i * 0.05);
      ctx.beginPath();
      ctx.moveTo(x, s.h * 0.55);
      ctx.lineTo(x, s.h * 0.55 + 18);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, true);

  add("shake-ticks", (ctx, s) => {
    if (!(s.shake > 1)) return;
    ctx.fillStyle = "rgba(227,27,27,0.45)";
    ctx.fillRect(0, 0, s.w, 3);
    ctx.fillRect(0, s.h - 3, s.w, 3);
  });

  add("flash-specks", (ctx, s) => {
    if (!(s.flash > 0.02)) return;
    ctx.fillStyle = "rgba(255,255,255," + Math.min(0.5, s.flash) + ")";
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(frac(i * 9.1 + s.t) * s.w, frac(i * 4.7) * s.h, 2, 2);
    }
  });

  add("intro-underline", (ctx, s) => {
    if (!(s.intro > 0) || s.mode !== "play") return;
    const a = Math.min(1, s.intro);
    ctx.globalAlpha = a;
    ctx.fillStyle = "#e7c56a";
    ctx.fillRect(s.w * 0.3, s.h * 0.2, s.w * 0.4 * a, 1);
    ctx.globalAlpha = 1;
  });

  add("accent-wash", (ctx, s) => {
    const c = s.accent || [227, 27, 27];
    ctx.fillStyle = "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + ",0.035)";
    ctx.fillRect(0, 0, s.w, 18);
  });

  add("clear-iris", (ctx, s) => {
    if (!(s.clear > 0.05)) return;
    ctx.strokeStyle = "rgba(255,214,140," + Math.min(0.8, s.clear) + ")";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.w / 2, s.h / 2, 40 + (1 - s.clear) * 80, 0, Math.PI * 2);
    ctx.stroke();
  });

  add("win-dots", (ctx, s) => {
    if (!s.win) return;
    ctx.fillStyle = "rgba(255,210,120,0.8)";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + s.now / 800;
      ctx.fillRect(s.w / 2 + Math.cos(a) * 70, s.h / 2 + Math.sin(a) * 36, 3, 3);
    }
  });

  add("still-dust", (ctx, s) => {
    if (s.mode !== "play" || !s.ground || Math.abs(s.vx) > 0.4) return;
    ctx.fillStyle = "rgba(180,160,140,0.35)";
    const x = s.w * 0.5 + Math.sin(s.now / 500) * 8;
    ctx.fillRect(x, s.h * 0.72, 2, 2);
    ctx.fillRect(x + 6, s.h * 0.74, 2, 2);
  }, true);

  add("combo-arc", (ctx, s) => {
    if (!(s.combo >= 2) || s.mode !== "play") return;
    const k = Math.min(1, s.combo / 10);
    ctx.strokeStyle = "rgba(227,27,27," + (0.35 + k * 0.4) + ")";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.w - 36, 46, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
    ctx.stroke();
  });

  add("trap-tick", (ctx, s) => {
    if (!(s.trapPulse > 0.08)) return;
    ctx.globalAlpha = s.trapPulse;
    ctx.strokeStyle = "#ffd27a";
    ctx.strokeRect(s.w * 0.62, 8, 70, 14);
    ctx.globalAlpha = 1;
  });

  add("near-door-rim", (ctx, s) => {
    if (!(s.near > 0.05) || s.mode !== "play") return;
    ctx.fillStyle = "rgba(255,210,120," + (s.near * 0.18) + ")";
    ctx.fillRect(0, s.h - 6, s.w, 3);
  });

  add("death-frame", (ctx, s) => {
    if (!s.dead) return;
    ctx.strokeStyle = "rgba(180,16,16,0.65)";
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, s.w - 16, s.h - 16);
  });

  add("win-frame", (ctx, s) => {
    if (!s.win) return;
    ctx.strokeStyle = "rgba(255,210,120,0.7)";
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, s.w - 20, s.h - 20);
  });

  add("combo-frame", (ctx, s) => {
    if (!(s.combo >= 5)) return;
    ctx.strokeStyle = "rgba(227,27,27,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, s.w - 28, s.h - 28);
  });

  add("surge-frame", (ctx, s) => {
    if (!(s.combo >= 10)) return;
    ctx.strokeStyle = "rgba(255,210,120,0.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 20, s.w - 40, s.h - 40);
  });

  add("reverse-bleed", (ctx, s) => {
    if (!s.reverse) return;
    ctx.fillStyle = "rgba(80,120,255,0.06)";
    ctx.fillRect(0, 0, s.w, s.h);
  });

  add("gravity-bleed", (ctx, s) => {
    if (!(s.grav < 0)) return;
    ctx.fillStyle = "rgba(160,40,180,0.05)";
    ctx.fillRect(0, 0, s.w, s.h);
  });

  add("flash-bleed", (ctx, s) => {
    if (!(s.flash > 0.02)) return;
    ctx.fillStyle = "rgba(255,255,255," + Math.min(0.12, s.flash * 0.4) + ")";
    ctx.fillRect(0, 0, s.w, s.h);
  });

  add("timecode", (ctx, s) => {
    if (s.mode === "creator") return;
    const sec = Math.max(0, s.t || 0);
    const m = (sec / 60) | 0;
    const r = sec - m * 60;
    const text = (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r.toFixed(1);
    ctx.globalAlpha = 0.38;
    ctx.font = "11px Rubik, sans-serif";
    ctx.fillStyle = "#e7c56a";
    ctx.textAlign = "left";
    ctx.fillText(text, 34, s.h - 32);
    ctx.globalAlpha = 1;
  });

  add("cue-marker", (ctx, s) => {
    if (!(s.intro > 0.2) || s.mode !== "play") return;
    ctx.fillStyle = "rgba(227,27,27,0.85)";
    ctx.fillRect(34, s.h * 0.18, 8, 8);
  });

  add("speed-smear", (ctx, s) => {
    if (s.mode !== "play" || Math.abs(s.vx) < 4.2) return;
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#f4ead8";
    const dir = s.vx > 0 ? -1 : 1;
    ctx.fillRect(s.w * 0.48, s.h * 0.62, dir * 30, 2);
    ctx.globalAlpha = 1;
  }, true);

  add("spike-glint", (ctx, s) => {
    if (reduced || s.mode !== "play") return;
    const x = 16 + (frac(s.now / 2400) * 6 | 0) * 0;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(x + 8, s.h * 0.22 + (frac(s.now / 900) * 80), 2, 2);
  }, true);

  add("brick-sheen", (ctx, s) => {
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(0, s.h - 8, s.w, 1);
  });

  add("bolt-glint", (ctx, s) => {
    if (reduced) return;
    const a = 0.25 + Math.sin(s.now / 500) * 0.15;
    ctx.globalAlpha = a;
    ctx.fillStyle = "#fff6d0";
    ctx.fillRect(27, 27, 2, 1);
    ctx.globalAlpha = 1;
  }, true);

  function crumbs(ctx, s, color, n, speed, tall) {
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const x = frac(i * 12.1 + s.now * speed) * s.w;
      const y = frac(i * 5.3 + s.now * speed * 0.7) * s.h;
      if (tall) ctx.fillRect(x, y, 1, 7);
      else ctx.fillRect(x, y, 2, 2);
    }
  }

  add("snow", (ctx, s) => {
    if (s.weather !== "snow") return;
    crumbs(ctx, s, "rgba(230,240,255,0.55)", 10, 0.00004, false);
  }, true);

  add("ember", (ctx, s) => {
    if (s.weather !== "ember") return;
    crumbs(ctx, s, "rgba(255,120,40,0.5)", 8, 0.00005, false);
  }, true);

  add("spore", (ctx, s) => {
    if (s.weather !== "spores") return;
    crumbs(ctx, s, "rgba(220,140,255,0.4)", 8, 0.00003, false);
  }, true);

  add("spark", (ctx, s) => {
    if (s.weather !== "sparks") return;
    crumbs(ctx, s, "rgba(255,220,120,0.55)", 7, 0.00008, false);
  }, true);

  add("rain", (ctx, s) => {
    if (s.weather !== "rain") return;
    crumbs(ctx, s, "rgba(140,220,160,0.35)", 12, 0.00012, true);
  }, true);

  add("shard", (ctx, s) => {
    if (s.weather !== "shards") return;
    crumbs(ctx, s, "rgba(200,210,230,0.4)", 8, 0.00004, false);
  }, true);

  add("static-scan", (ctx, s) => {
    if (s.weather !== "static") return;
    const y = frac(s.now / 1400) * s.h;
    ctx.fillStyle = "rgba(180,180,255,0.05)";
    ctx.fillRect(0, y, s.w, 2);
  }, true);

  add("ash", (ctx, s) => {
    if (s.weather !== "ember") return;
    crumbs(ctx, s, "rgba(80,70,60,0.45)", 5, 0.00002, false);
  }, true);

  add("fog", (ctx, s) => {
    if (s.weather !== "snow" && s.weather !== "rain") return;
    ctx.fillStyle = "rgba(200,210,220,0.03)";
    ctx.fillRect(0, s.h * 0.62, s.w, s.h * 0.2);
  }, true);

  add("dust", (ctx, s) => {
    if (s.weather === "snow" || s.weather === "rain") return;
    crumbs(ctx, s, "rgba(180,160,140,0.22)", 5, 0.00002, false);
  }, true);

  add("heat-lines", (ctx, s) => {
    if (s.weather !== "ember" || reduced) return;
    ctx.strokeStyle = "rgba(255,80,20,0.08)";
    ctx.beginPath();
    const y = s.h * 0.7 + Math.sin(s.now / 400) * 3;
    ctx.moveTo(0, y);
    ctx.lineTo(s.w, y + 4);
    ctx.stroke();
  }, true);

  add("dash-ready-ping", (ctx, s) => {
    if (!s.dashReady || s.mode !== "play" || reduced) return;
    const a = 0.25 + Math.sin(s.now / 180) * 0.15;
    ctx.globalAlpha = a;
    ctx.strokeStyle = "#ffe8a0";
    ctx.strokeRect(s.w - 48, s.h - 48, 10, 10);
    ctx.globalAlpha = 1;
  }, true);

  add("dim-pips", (ctx, s) => {
    if (s.mode !== "play") return;
    const n = Math.max(1, Math.min(20, s.dim || 1));
    ctx.fillStyle = "rgba(244,234,216,0.35)";
    for (let i = 0; i < n; i++) ctx.fillRect(34 + (i % 10) * 5, 30 + ((i / 10) | 0) * 4, 3, 2);
  });

  add("landing-ring", (ctx, s) => {
    if (!(s.land > 0.08)) return;
    ctx.globalAlpha = s.land * 0.7;
    ctx.strokeStyle = "#f4ead8";
    ctx.beginPath();
    ctx.arc(s.w * 0.5, s.h * 0.78, 10 + (1 - s.land) * 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  add("jump-wisp", (ctx, s) => {
    if (!(s.jump > 0.08)) return;
    ctx.globalAlpha = s.jump * 0.6;
    ctx.fillStyle = "#ffd27a";
    ctx.fillRect(s.w * 0.48, s.h * 0.7, 3, 8 * s.jump);
    ctx.fillRect(s.w * 0.52, s.h * 0.72, 3, 6 * s.jump);
    ctx.globalAlpha = 1;
  });

  function paint(ctx, s) {
    if (!ctx || !s || s.mode === "creator") return;
    const t0 = root.performance ? root.performance.now() : 0;
    arm(s);
    ctx.save();
    const richOk = budget > 0;
    const filmChrome = {
      "reg-tl": 1, "reg-tr": 1, "reg-bl": 1, "reg-br": 1,
      "timecode-dots": 1, "sprocket-left": 1, "sprocket-right": 1,
      "hairline-top": 1, "hairline-bottom": 1, "center-ticks": 1,
    };
    for (let i = 0; i < FEATURES.length; i++) {
      const f = FEATURES[i];
      if (filmChrome[f.id]) continue;
      if (f.rich && !richOk) continue;
      f.fn(ctx, s);
    }
    ctx.restore();
    if (root.performance) {
      const cost = root.performance.now() - t0;
      if (cost > 2.2) budget = 0;
      else if (cost < 0.7) budget = 1;
    }
  }

  root.SURGE_FINISH = {
    count: FEATURES.length,
    ids: function () { return FEATURES.map(function (f) { return f.id; }); },
    paint: paint,
  };
})(typeof window !== "undefined" ? window : globalThis);
