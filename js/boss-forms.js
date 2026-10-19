// One silhouette per world. Nothing here is a recolor of another body.
(function (root) {
  function ink(accent, m, a) {
    const r = Math.max(0, Math.min(255, (accent[0] * m) | 0));
    const g = Math.max(0, Math.min(255, (accent[1] * m) | 0));
    const b = Math.max(0, Math.min(255, (accent[2] * m) | 0));
    return a == null ? "rgb(" + r + "," + g + "," + b + ")" : "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  function moodOf(boss, t, grab) {
    const phase = (boss && boss.phase) || "fight";
    const mood = phase === "fall" || phase === "rage" ? 1 : ((boss && boss.mood) || 0);
    const blink = phase === "fall" || (grab < 0.2 && mood < 0.62 && (t % 3.2) < 0.08);
    return { phase: phase, mood: mood, blink: blink };
  }

  const NULL_BOSS_IMG = (typeof Image === "function") ? new Image() : null;
  if (NULL_BOSS_IMG) NULL_BOSS_IMG.src = "img/null-boss.png";

  const FORMS = {
    // Null. The face is the sprite you sent. Same bite, same eyes, same dash mouth.
    1: function (ctx, t, grab, accent, look, boss) {
      const face = (boss && boss.face) || "fight";
      const sleep = face === "sleep";
      const bob = sleep ? Math.sin(t * 1.1) * 2 : 0;
      ctx.save();
      ctx.translate(look * 2, bob);
      const img = NULL_BOSS_IMG;
      const ready = img && img.complete && img.naturalWidth > 0;
      if (ready) {
        const dw = 200;
        const dh = dw * (img.naturalHeight / img.naturalWidth);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, -dw / 2, -dh / 2 + 6, dw, dh);
      } else {
        ctx.fillStyle = "#e73b6d";
        ctx.beginPath();
        ctx.arc(4, 6, 70, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },

    // Volcano. Wide base, open crater, falling embers.
    2: function (ctx, t, grab, accent, look, boss) {
      const st = moodOf(boss, t, grab);
      ctx.fillStyle = ink(accent, 0.35);
      ctx.beginPath();
      ctx.moveTo(-86, 48);
      ctx.lineTo(-18, -62);
      ctx.lineTo(18, -62);
      ctx.lineTo(86, 48);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = ink(accent, 1);
      ctx.beginPath();
      ctx.moveTo(-70, 48);
      ctx.lineTo(-10, -28);
      ctx.quadraticCurveTo(0, -70 - grab * 16, 10, -28);
      ctx.lineTo(70, 48);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#2a1008";
      ctx.beginPath();
      ctx.ellipse(0, -24, 22 + grab * 8, st.blink ? 4 : 10 + grab * 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff1c8";
      ctx.beginPath();
      ctx.ellipse(look * 3, -26, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ink(accent, 1);
      for (let i = 0; i < 5; i++) {
        const yy = ((t * 40 + i * 18) % 70) - 10;
        ctx.globalAlpha = Math.max(0.15, 1 - yy / 80);
        ctx.fillRect(-40 + i * 18, yy, 6, 14);
      }
      ctx.globalAlpha = 1;
    },

    // Ice crystal. Facets only, a glint instead of eyes.
    3: function (ctx, t, grab, accent) {
      const tips = [[0, -78], [-46, -20], [42, -8], [-18, 46], [34, 40], [-62, 18]];
      ctx.fillStyle = ink(accent, 0.45);
      ctx.beginPath();
      ctx.moveTo(0, -70);
      ctx.lineTo(54, 8);
      ctx.lineTo(8, 52);
      ctx.lineTo(-58, 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = ink(accent, 1);
      ctx.beginPath();
      ctx.moveTo(tips[0][0], tips[0][1]);
      ctx.lineTo(tips[1][0], tips[1][1]);
      ctx.lineTo(0, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#f4fbff";
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(8, -62);
      ctx.lineTo(36, -4);
      ctx.lineTo(4, 6);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = ink(accent, 0.75);
      ctx.beginPath();
      ctx.moveTo(-8, 4);
      ctx.lineTo(-48, 36);
      ctx.lineTo(6, 44);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-6, -36 + Math.sin(t * 3) * 2);
      ctx.lineTo(10, -18);
      ctx.stroke();
      ctx.fillStyle = ink(accent, 1);
      ctx.beginPath();
      ctx.moveTo(48, -36);
      ctx.lineTo(70, -18);
      ctx.lineTo(40, -8);
      ctx.closePath();
      ctx.fill();
    },

    // Flower. Petals around a bud.
    4: function (ctx, t, grab, accent, look, boss) {
      const st = moodOf(boss, t, grab);
      const flap = Math.sin(t * 2.2) * 0.18;
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 * i) / 6 + flap);
        ctx.fillStyle = i % 2 ? ink(accent, 0.72) : ink(accent, 1);
        ctx.beginPath();
        ctx.ellipse(0, -52, 22, 40, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = "#2a1028";
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ink(accent, 0.95);
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a0814";
      if (!st.blink) {
        ctx.beginPath();
        ctx.arc(-8 + look * 2, -2, 3.2, 0, Math.PI * 2);
        ctx.arc(8 + look * 2, -2, 3.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-12, -3, 8, 2);
        ctx.fillRect(4, -3, 8, 2);
      }
      ctx.fillStyle = "#3a1030";
      ctx.beginPath();
      ctx.ellipse(0, 10, 6, 3 + grab * 4, 0, 0, Math.PI * 2);
      ctx.fill();
    },

    // Clock. Ticks, two hands, a pendulum. No face.
    5: function (ctx, t, grab, accent) {
      ctx.fillStyle = ink(accent, 0.2);
      ctx.beginPath();
      ctx.arc(0, -16, 58, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ink(accent, 1);
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(0, -16, 52, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = ink(accent, 1);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const inner = i % 3 === 0 ? 34 : 42;
        ctx.fillRect(Math.cos(a) * inner - 2, Math.sin(a) * inner - 18, 4, i % 3 === 0 ? 16 : 8);
      }
      ctx.save();
      ctx.translate(0, -16);
      ctx.rotate(t * 0.6);
      ctx.fillStyle = "#1c1808";
      ctx.fillRect(-3, -8, 6, 36);
      ctx.restore();
      ctx.save();
      ctx.translate(0, -16);
      ctx.rotate(t * 2.4);
      ctx.fillStyle = "#fff6d0";
      ctx.fillRect(-2, -4, 4, 28);
      ctx.restore();
      ctx.fillStyle = ink(accent, 1);
      ctx.fillRect(-3, 36, 6, 28);
      ctx.save();
      ctx.translate(0, 64);
      ctx.rotate(Math.sin(t * 2.1) * (0.5 + grab * 0.3));
      ctx.fillRect(-3, 0, 6, 22);
      ctx.beginPath();
      ctx.arc(0, 28, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    // Gut. A sagging sack, one eye, a wet mouth, drips.
    6: function (ctx, t, grab, accent, look, boss) {
      const st = moodOf(boss, t, grab);
      const sag = Math.sin(t * 1.6) * 6;
      ctx.fillStyle = ink(accent, 0.55);
      ctx.beginPath();
      ctx.moveTo(-40, -40);
      ctx.bezierCurveTo(-90, -10, -80, 40 + sag, 0, 52 + sag);
      ctx.bezierCurveTo(86, 36, 70, -20, 30, -48);
      ctx.quadraticCurveTo(0, -20, -40, -40);
      ctx.fill();
      ctx.fillStyle = ink(accent, 1);
      ctx.beginPath();
      ctx.ellipse(-6, -8, 36, 28, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#102008";
      ctx.beginPath();
      ctx.ellipse(10 + look * 4, -16, st.blink ? 10 : 8, st.blink ? 2 : 9, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!st.blink) {
        ctx.fillStyle = "#e8ffd0";
        ctx.beginPath();
        ctx.arc(12 + look * 4, -18, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#061208";
      ctx.beginPath();
      ctx.ellipse(-4, 16, 16 + grab * 8, 6 + grab * 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ink(accent, 0.9);
      for (let i = 0; i < 4; i++) {
        const yy = 28 + ((t * 28 + i * 16) % 36);
        ctx.beginPath();
        ctx.arc(-18 + i * 12, yy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    // Two mirrors. The copy is late and flipped.
    7: function (ctx, t, grab, accent, look, boss) {
      const st = moodOf(boss, t, grab);
      const lag = Math.sin(t * 1.4) * 10;
      function pane(flip, alpha, dy) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(flip ? 34 : -34, dy);
        ctx.scale(flip ? -1 : 1, 1);
        ctx.fillStyle = ink(accent, 0.35);
        ctx.fillRect(-28, -58, 8, 110);
        ctx.fillStyle = ink(accent, 0.95);
        ctx.beginPath();
        ctx.moveTo(-20, -52);
        ctx.lineTo(22, -40);
        ctx.lineTo(16, 48);
        ctx.lineTo(-24, 36);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#061018";
        ctx.fillRect(-8, -16, 16, st.blink ? 3 : 8);
        ctx.fillStyle = "#e6f4ff";
        if (!st.blink) ctx.fillRect(-4 + look * 3, -14, 5, 5);
        ctx.restore();
      }
      pane(true, 0.4, lag);
      pane(false, 1, 0);
    },

    // Locomotive. Boiler, stack, cowcatcher, wheels.
    8: function (ctx, t, grab, accent) {
      const spin = t * 4;
      ctx.fillStyle = ink(accent, 1);
      ctx.fillRect(-18, -62, 16, 28);
      ctx.fillRect(-24, -66, 28, 8);
      ctx.fillStyle = "#1a0c08";
      ctx.fillRect(-8, -78 - grab * 10, 10, 16);
      ctx.fillStyle = ink(accent, 0.9);
      ctx.beginPath();
      ctx.moveTo(-54, -28);
      ctx.lineTo(40, -28);
      ctx.quadraticCurveTo(62, -28, 62, -8);
      ctx.lineTo(62, 6);
      ctx.quadraticCurveTo(62, 14, 40, 14);
      ctx.lineTo(-54, 14);
      ctx.quadraticCurveTo(-70, 14, -70, -2);
      ctx.quadraticCurveTo(-70, -28, -54, -28);
      ctx.fill();
      ctx.fillStyle = "#fff6d0";
      ctx.beginPath();
      ctx.arc(28, -8, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ink(accent, 0.7);
      ctx.beginPath();
      ctx.moveTo(50, -8);
      ctx.lineTo(86, 18);
      ctx.lineTo(48, 18);
      ctx.closePath();
      ctx.fill();
      for (const wx of [-36, 24]) {
        ctx.save();
        ctx.translate(wx, 28);
        ctx.rotate(spin);
        ctx.fillStyle = "#140804";
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = ink(accent, 1);
        ctx.fillRect(-14, -3, 28, 6);
        ctx.fillRect(-3, -14, 6, 28);
        ctx.restore();
      }
    },

    // Static. Offset bars, no solid body.
    9: function (ctx, t, grab, accent, look, boss) {
      const st = moodOf(boss, t, grab);
      for (let i = 0; i < 8; i++) {
        const ox = Math.sin(t * 16 + i * 1.7) * (10 + (i % 3) * 8);
        const w = 70 + ((i * 17) % 50);
        ctx.fillStyle = i % 2 ? ink(accent, 0.35) : ink(accent, 1);
        ctx.fillRect(-w / 2 + ox, -62 + i * 14, w, i === 3 ? 6 : 10);
      }
      if (!st.blink) {
        ctx.fillStyle = "#0c0c14";
        ctx.fillRect(-22 + look * 6, -22, 12, 8);
        ctx.fillRect(8 + look * 6, -20, 12, 8);
      }
    },

    // Skull, with a separate bone ring.
    10: function (ctx, t, grab, accent, look, boss) {
      const st = moodOf(boss, t, grab);
      ctx.save();
      ctx.rotate(t * 0.4);
      ctx.strokeStyle = ink(accent, 0.8);
      ctx.lineWidth = 6;
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(62, -6);
        ctx.lineTo(84, 0);
        ctx.lineTo(62, 6);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = ink(accent, 0.95);
      ctx.beginPath();
      ctx.arc(0, -16, 40, Math.PI, 0);
      ctx.lineTo(36, 10);
      ctx.quadraticCurveTo(0, 28, -36, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#1c1810";
      ctx.beginPath();
      ctx.ellipse(-14 + look * 2, -18, st.blink ? 8 : 10, st.blink ? 2 : 12, 0, 0, Math.PI * 2);
      ctx.ellipse(16 + look * 2, -18, st.blink ? 8 : 10, st.blink ? 2 : 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(7, 8);
      ctx.lineTo(-7, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = ink(accent, 0.75);
      ctx.fillRect(-28, 16, 56, 12 + grab * 6);
      ctx.fillStyle = "#1c1810";
      for (let i = 0; i < 4; i++) ctx.fillRect(-22 + i * 12, 18, 4, 8);
    },

    // Diamond prism and a crack. No eyes.
    11: function (ctx, t, grab, accent) {
      function gem(s, col) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(0, -70 * s);
        ctx.lineTo(58 * s, -8);
        ctx.lineTo(0, 58 * s);
        ctx.lineTo(-58 * s, -8);
        ctx.closePath();
        ctx.fill();
      }
      gem(1, ink(accent, 0.28));
      gem(0.72, ink(accent, 0.95));
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.moveTo(0, -48);
      ctx.lineTo(22, -8);
      ctx.lineTo(0, 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#062024";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, -40);
      ctx.lineTo(6, -10 + Math.sin(t * 5) * 2);
      ctx.lineTo(-14, 16);
      ctx.lineTo(10, 36);
      ctx.stroke();
      ctx.globalAlpha = 0.5 + grab * 0.4;
      ctx.strokeStyle = ink(accent, 1);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    // Crescent with a bite and teeth on the inner curve.
    12: function (ctx, t, grab, accent, look, boss) {
      const st = moodOf(boss, t, grab);
      ctx.fillStyle = ink(accent, 1);
      ctx.beginPath();
      ctx.arc(0, 0, 62, 0.6, Math.PI * 1.7);
      ctx.arc(-8, 4, 36, Math.PI * 1.55, 0.85, true);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#280810";
      if (!st.blink) {
        ctx.beginPath();
        ctx.arc(18 + look * 3, -16, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#fff0e6";
      for (let i = 0; i < 5; i++) {
        const a = 1.1 + i * 0.42;
        const x = Math.cos(a) * 40 - 4;
        const y = Math.sin(a) * 40;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 8, y + 4);
        ctx.lineTo(x + 2, y + 12 + grab * 6);
        ctx.closePath();
        ctx.fill();
      }
    },

    // A knot of wire. No body to stand on.
    13: function (ctx, t, grab, accent) {
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = ink(accent, 1);
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = t * 1.4 + i * 1.25;
        ctx.moveTo(Math.cos(a) * 16, Math.sin(a) * 12);
        ctx.lineTo(Math.cos(a + 0.7) * 70, Math.sin(a + 0.4) * 48);
        ctx.lineTo(Math.cos(a + 1.5) * 24, Math.sin(a + 1.8) * 36);
        ctx.lineTo(Math.cos(a + 2.2) * 78, Math.sin(a + 2.4) * 20);
      }
      ctx.stroke();
      ctx.fillStyle = "#f4e8ff";
      for (let i = 0; i < 4; i++) {
        const a = t * 2 + i * 1.6;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 36, Math.sin(a) * 24, 4 + (i === 0 ? grab * 3 : 0), 0, Math.PI * 2);
        ctx.fill();
      }
    },

    // Cathedral. Two columns, a pointed arch, a rose window.
    14: function (ctx, t, grab, accent, look, boss) {
      const st = moodOf(boss, t, grab);
      ctx.fillStyle = ink(accent, 0.85);
      ctx.fillRect(-48, -10, 14, 62);
      ctx.fillRect(34, -10, 14, 62);
      ctx.beginPath();
      ctx.moveTo(-48, -10);
      ctx.lineTo(-34, -10);
      ctx.lineTo(0, -78);
      ctx.lineTo(34, -10);
      ctx.lineTo(48, -10);
      ctx.lineTo(0, -62);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = ink(accent, 1);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, -86 + Math.sin(t) * 2, 26, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#fff6e0";
      ctx.beginPath();
      ctx.arc(0, -36, st.blink ? 4 : 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ink(accent, 0.4);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.moveTo(0, -36);
        ctx.lineTo(Math.cos(a) * 12, -36 + Math.sin(a) * 12);
      }
      ctx.stroke();
      ctx.fillStyle = "#1c1a14";
      if (!st.blink) {
        ctx.fillRect(-3 + look * 2, -38, 3, 3);
      }
      ctx.fillStyle = ink(accent, 0.55);
      ctx.fillRect(-20, 20, 40, 8 + grab * 10);
    },

    // Three copies smeared to the right. No upright body.
    15: function (ctx, t, grab, accent, look) {
      const copies = [
        { x: -28, a: 0.28, s: 1 },
        { x: 6, a: 0.55, s: 0.86 },
        { x: 36 + grab * 12, a: 0.9, s: 0.7 },
      ];
      copies.forEach((c, i) => {
        ctx.save();
        ctx.globalAlpha = c.a;
        ctx.translate(c.x + Math.sin(t * 3 + i) * 4, 0);
        ctx.scale(c.s, 0.55 + i * 0.08);
        ctx.fillStyle = ink(accent, 1);
        ctx.beginPath();
        ctx.moveTo(-50, -10);
        ctx.lineTo(10, -36);
        ctx.lineTo(54, 0);
        ctx.lineTo(10, 28);
        ctx.lineTo(-50, 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#300808";
        ctx.fillRect(-20 + look * 4, -8, 16, 4);
        ctx.restore();
      });
      ctx.globalAlpha = 1;
    },

    // A ghost made only of grid dots.
    16: function (ctx, t, grab, accent, look, boss) {
      const st = moodOf(boss, t, grab);
      const shift = (t * 8) | 0;
      ctx.fillStyle = ink(accent, 1);
      for (let y = -52; y <= 40; y += 8) {
        const wave = y > 24 ? Math.sin((y + shift) * 0.4) * 10 : 0;
        const half = y < -28 ? 18 + (y + 52) : 36 - Math.max(0, y - 8) * 0.2;
        for (let x = -half; x <= half; x += 8) {
          if (((x + y) / 8 + shift) % 5 === 0) continue;
          ctx.globalAlpha = 0.45 + ((x + y + shift) % 3) * 0.18;
          ctx.fillRect(x + wave, y, 5, 5);
        }
      }
      ctx.globalAlpha = 1;
      if (!st.blink) {
        ctx.fillStyle = "#f4fff8";
        ctx.fillRect(-14 + look * 3, -22, 7, 7);
        ctx.fillRect(8 + look * 3, -22, 7, 7);
      }
    },

    // One needle, then a fan of smaller ones.
    17: function (ctx, t, grab, accent) {
      ctx.fillStyle = ink(accent, 1);
      ctx.beginPath();
      ctx.moveTo(0, -88);
      ctx.lineTo(8, 52);
      ctx.lineTo(-8, 52);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#e8e8ff";
      ctx.fillRect(-2, -20, 4, 40);
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        const lean = i * 0.28;
        const h = 36 + Math.abs(i) * 8 + Math.sin(t * 5 + i) * 4;
        ctx.save();
        ctx.translate(i * 10, -70);
        ctx.rotate(lean);
        ctx.fillStyle = ink(accent, 0.85);
        ctx.beginPath();
        ctx.moveTo(0, -h);
        ctx.lineTo(3, 8);
        ctx.lineTo(-3, 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = ink(accent, 0.5);
      ctx.fillRect(-16, 44, 32, 4 + grab * 8);
    },

    // Sun disk, long uneven rays, a grave notch cut out of the bottom.
    18: function (ctx, t, grab, accent, look, boss) {
      const st = moodOf(boss, t, grab);
      ctx.save();
      ctx.rotate(t * 0.15);
      ctx.fillStyle = ink(accent, 1);
      for (let i = 0; i < 14; i++) {
        ctx.rotate((Math.PI * 2) / 14);
        const len = i % 2 ? 34 : 18;
        ctx.fillRect(28, -4, len, i % 2 ? 8 : 4);
      }
      ctx.restore();
      ctx.fillStyle = ink(accent, 0.95);
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#241c08";
      ctx.fillRect(-10, 14, 20, 22);
      ctx.fillStyle = "#1a1406";
      if (!st.blink) {
        ctx.fillRect(-12 + look * 2, -8, 7, 7);
        ctx.fillRect(5 + look * 2, -8, 7, 7);
      } else {
        ctx.fillRect(-12, -4, 7, 2);
        ctx.fillRect(5, -4, 7, 2);
      }
    },

    // A paper strip that folds back through itself.
    19: function (ctx, t, grab, accent) {
      const wob = Math.sin(t * 1.3) * 8;
      ctx.lineJoin = "miter";
      ctx.strokeStyle = ink(accent, 0.35);
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.moveTo(-70, 20 + wob);
      ctx.lineTo(-20, -50);
      ctx.lineTo(24, 16);
      ctx.lineTo(70, -36 - grab * 10);
      ctx.stroke();
      ctx.strokeStyle = ink(accent, 1);
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(-78, -10);
      ctx.lineTo(-16, 46);
      ctx.lineTo(18, -28);
      ctx.lineTo(76, 24 + wob);
      ctx.stroke();
      ctx.strokeStyle = "#f4f0ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-70, -6);
      ctx.lineTo(-12, 40);
      ctx.lineTo(14, -22);
      ctx.stroke();
    },

    // Four-point star, a hot core, thin rings. Not a sun and not a broken loop.
    20: function (ctx, t, grab, accent) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const rad = 26 + ((t * 22 + i * 16) % 40);
        ctx.globalAlpha = 1 - (rad - 26) / 48;
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = ink(accent, 1);
      ctx.beginPath();
      ctx.moveTo(0, -74);
      ctx.lineTo(14, -14);
      ctx.lineTo(74, 0);
      ctx.lineTo(14, 14);
      ctx.lineTo(0, 70);
      ctx.lineTo(-14, 14);
      ctx.lineTo(-74, 0);
      ctx.lineTo(-14, -14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(0, 0, 8 + grab * 6 + Math.sin(t * 4) * 2, 0, Math.PI * 2);
      ctx.fill();
    },
  };

  function paint(ctx, dim, t, grab, accent, look, boss) {
    const fn = FORMS[dim] || FORMS[1];
    ctx.save();
    fn(ctx, t, grab, accent || [255, 210, 160], look || 1, boss || {});
    ctx.restore();
  }

  root.SURGE_BOSS_FORMS = { paint: paint, ids: Object.keys(FORMS).map(Number) };
})(typeof window !== "undefined" ? window : globalThis);
