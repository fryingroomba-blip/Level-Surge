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

  const FLAME_BODY = "#fe1f6f";
  const FLAME_SHELL = "#fe92b8";

  function flameTongue(ctx, x0, y0, x1, y1, w) {
    const my = y0 + (y1 - y0) * 0.55;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0 - w * 0.7, y0 + w * 0.15);
    ctx.quadraticCurveTo(x0 - w * 0.85, my, x1, y1);
    ctx.quadraticCurveTo(x0 + w * 0.9, my, x0 + w * 0.55, y0 + w * 0.2);
    ctx.closePath();
    ctx.fillStyle = FLAME_SHELL;
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x0 - w * 0.32, y0 + w * 0.12);
    ctx.quadraticCurveTo(x0 - w * 0.28, my + w * 0.05, x1, y1 + (y0 - y1) * 0.16);
    ctx.quadraticCurveTo(x0 + w * 0.38, my, x0 + w * 0.28, y0 + w * 0.14);
    ctx.closePath();
    ctx.fillStyle = FLAME_BODY;
    ctx.globalAlpha = 0.88;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x0 - w * 0.1, y0 + w * 0.1);
    ctx.quadraticCurveTo(x0, my, x1, y1 + (y0 - y1) * 0.34);
    ctx.quadraticCurveTo(x0 + w * 0.14, my + w * 0.08, x0 + w * 0.08, y0 + w * 0.12);
    ctx.closePath();
    ctx.fillStyle = "#fff0f6";
    ctx.globalAlpha = 0.68;
    ctx.fill();
    ctx.restore();
  }

  function paintSideHand(ctx, R, t, phase, grab, face) {
    const lift = Math.sin(t * 6.8 + phase) * 7 + (face === "scared" ? -12 : 0) + (grab || 0) * 10;
    const wag = Math.sin(t * 8 + phase) * 0.14;
    const flick = 1 + Math.sin(t * 13 + phase) * 0.08;
    ctx.save();
    ctx.translate(-1.02 * R, 0.28 * R + lift);
    ctx.rotate(-0.62 + wag + (grab || 0) * 0.85);
    ctx.scale(flick, 1);
    const w = R * 0.4;
    const o = Math.sin(t * 11 + phase) * 5;
    flameTongue(ctx, 0, 0, -0.22 * R, -1.35 * R + o, w);
    ctx.globalAlpha = 0.94;
    ctx.fillStyle = FLAME_SHELL;
    ctx.beginPath();
    ctx.ellipse(0, 5, R * 0.32, R * 0.22, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = FLAME_BODY;
    ctx.beginPath();
    ctx.ellipse(-2, 3, R * 0.2, R * 0.13, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "#fff0f6";
    ctx.beginPath();
    ctx.ellipse(-5, 0, R * 0.07, R * 0.045, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function paintNullFace(ctx, R, face, t, look, grab) {
    const ink = "#141414";
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const gaze = Math.max(-1, Math.min(1, look || 0));
    const eyeX = 0.36 * R;
    const eyeY = 0.02 * R + (face === "tired" ? 0.04 * R : 0);
    const blink = (t % 3.6) < 0.09 && face !== "sleep";

    if (face === "sleep") {
      ctx.lineWidth = R * 0.22;
      ctx.beginPath();
      ctx.moveTo(-eyeX - 0.24 * R, eyeY);
      ctx.quadraticCurveTo(-eyeX, eyeY + 0.32 * R, -eyeX + 0.24 * R, eyeY);
      ctx.moveTo(eyeX - 0.24 * R, eyeY);
      ctx.quadraticCurveTo(eyeX, eyeY + 0.32 * R, eyeX + 0.24 * R, eyeY);
      ctx.stroke();
      ctx.lineWidth = R * 0.045;
      ctx.beginPath();
      ctx.arc(0, 0.4 * R, 0.08 * R, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.globalAlpha = 0.55 + Math.sin(t * 2.2) * 0.2;
      ctx.lineWidth = R * 0.04;
      for (let i = 0; i < 3; i++) {
        const zx = 0.55 * R + i * 0.12 * R;
        const zy = -0.35 * R - i * 0.14 * R - Math.sin(t * 1.4 + i) * 2;
        ctx.beginPath();
        ctx.moveTo(zx, zy);
        ctx.lineTo(zx + 0.08 * R, zy - 0.04 * R);
        ctx.moveTo(zx + 0.02 * R, zy + 0.05 * R);
        ctx.lineTo(zx + 0.1 * R, zy + 0.01 * R);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      return;
    }

    if (face === "look") {
      const px = gaze * 0.08 * R;
      const r = 0.2 * R;
      ctx.lineWidth = R * 0.09;
      for (const side of [-1, 1]) {
        const cx = side * eyeX + px;
        ctx.beginPath();
        if (blink) ctx.ellipse(cx, eyeY, r, 0.05 * R, 0, 0, Math.PI * 2);
        else ctx.arc(cx, eyeY, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.lineWidth = R * 0.05;
      ctx.beginPath();
      ctx.moveTo(-0.1 * R, 0.4 * R);
      ctx.quadraticCurveTo(0, 0.48 * R, 0.1 * R, 0.4 * R);
      ctx.stroke();
      return;
    }

    if (face === "scared") {
      const jitter = Math.sin(t * 22) * 0.7;
      ctx.save();
      ctx.translate(gaze * 0.05 * R + jitter, -0.03 * R);
      ctx.lineWidth = R * 0.2;
      for (const side of [-1, 1]) {
        const cx = side * eyeX + gaze * 0.03 * R;
        ctx.beginPath();
        ctx.moveTo(cx - 0.22 * R, eyeY + 0.08 * R);
        ctx.quadraticCurveTo(cx, eyeY - 0.18 * R, cx + 0.22 * R, eyeY + 0.08 * R);
        ctx.stroke();
      }
      ctx.lineWidth = R * 0.075;
      ctx.beginPath();
      ctx.moveTo(-0.09 * R, 0.44 * R);
      ctx.quadraticCurveTo(0, 0.32 * R, 0.09 * R, 0.44 * R);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (face === "mad") {
      ctx.lineWidth = R * 0.12;
      for (const side of [-1, 1]) {
        const ox = side * eyeX;
        ctx.beginPath();
        ctx.moveTo(ox - side * 0.2 * R, eyeY - 0.1 * R);
        ctx.lineTo(ox + side * 0.05 * R, eyeY + 0.02 * R);
        ctx.lineTo(ox + side * 0.2 * R, eyeY - 0.08 * R);
        ctx.stroke();
      }
      ctx.lineWidth = R * 0.07;
      ctx.beginPath();
      ctx.moveTo(-0.16 * R, 0.4 * R);
      ctx.lineTo(0.16 * R, 0.4 * R);
      ctx.stroke();
      ctx.lineWidth = R * 0.035;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 0.055 * R, 0.34 * R);
        ctx.lineTo(i * 0.055 * R, 0.46 * R);
        ctx.stroke();
      }
      return;
    }

    if (face === "tired") {
      ctx.lineWidth = R * 0.1;
      for (const side of [-1, 1]) {
        const ox = side * eyeX;
        ctx.beginPath();
        ctx.moveTo(ox - 0.18 * R, eyeY);
        ctx.quadraticCurveTo(ox, eyeY + 0.08 * R, ox + 0.18 * R, eyeY);
        ctx.stroke();
        ctx.lineWidth = R * 0.04;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.moveTo(ox - 0.12 * R, eyeY + 0.12 * R);
        ctx.quadraticCurveTo(ox, eyeY + 0.18 * R, ox + 0.12 * R, eyeY + 0.12 * R);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = R * 0.1;
      }
      ctx.lineWidth = R * 0.05;
      ctx.beginPath();
      ctx.moveTo(-0.12 * R, 0.44 * R);
      ctx.quadraticCurveTo(0, 0.36 * R, 0.12 * R, 0.44 * R);
      ctx.stroke();
      return;
    }

    /* fight — two thick closed crescents, same shape as the picture */
    const dip = blink ? 0.08 * R : (0.3 + grab * 0.05) * R;
    const span = 0.24 * R;
    ctx.lineWidth = blink ? R * 0.1 : R * 0.22;
    ctx.beginPath();
    ctx.moveTo(-eyeX - span, eyeY);
    ctx.quadraticCurveTo(-eyeX, eyeY + dip, -eyeX + span, eyeY);
    ctx.moveTo(eyeX - span, eyeY);
    ctx.quadraticCurveTo(eyeX, eyeY + dip, eyeX + span, eyeY);
    ctx.stroke();
    ctx.lineWidth = R * 0.05;
    ctx.beginPath();
    if (grab > 0.35) {
      ctx.moveTo(-0.12 * R, 0.38 * R);
      ctx.lineTo(0.12 * R, 0.38 * R);
      ctx.moveTo(-0.08 * R, 0.34 * R);
      ctx.lineTo(-0.08 * R, 0.42 * R);
      ctx.moveTo(0.08 * R, 0.34 * R);
      ctx.lineTo(0.08 * R, 0.42 * R);
    } else {
      ctx.moveTo(-0.11 * R, 0.36 * R);
      ctx.lineTo(0.11 * R, 0.36 * R);
    }
    ctx.stroke();
  }

  function poseOf(boss, t, grab) {
    const face = (boss && boss.face) || "fight";
    const mood = (boss && boss.mood) || 0;
    const open = Math.max(0, Math.min(1, (grab || 0) + (face === "mad" ? 0.3 : 0) + (face === "scared" ? 0.14 : 0)));
    const tired = face === "tired" || face === "sleep" ? 1 : 0;
    const blink = face !== "mad" && face !== "scared" && (t % 3.5) < 0.07;
    const shake = face === "scared" ? Math.sin(t * 28) * 1.6 : 0;
    return { face: face, mood: mood, open: open, tired: tired, blink: blink, shake: shake };
  }

  function enterForm(ctx, t, look, p) {
    ctx.save();
    ctx.translate(p.shake, Math.sin(t * 2) * (4.2 - p.tired * 2.1) + p.tired * 7);
    ctx.rotate((p.face === "tired" ? 0.08 : 0) + Math.sin(t * 1.25) * 0.04);
    const breath = Math.sin(t * 2.15);
    ctx.scale(1 + breath * 0.02, 1 - breath * 0.015);
    if (look < 0) ctx.scale(-1, 1);
  }

  function poly(ctx, pts, fill) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function disc(ctx, x, y, rx, ry, fill, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry == null ? rx : ry), rot || 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function glow(ctx, x, y, r, inner, outer) {
    // Tight hard halo. Big soft discs read like generated gloss.
    const rr = Math.max(4, r * 0.48);
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fillStyle = outer;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, rr * 0.4), 0, Math.PI * 2);
    ctx.fillStyle = inner;
    ctx.fill();
  }

  function rod(ctx, x, y, len, thick, ang, fill, hot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    poly(ctx, [[-thick, 0], [-thick * 0.5, len], [thick * 0.5, len], [thick, 0]], fill);
    disc(ctx, 0, 0, thick * 0.9, thick * 0.9, fill);
    disc(ctx, 0, len, thick * 0.72, thick * 0.72, hot || fill);
    ctx.restore();
  }

  function gazeEye(ctx, x, y, r, p, socket, iris) {
    const h = p.blink ? 0.16 : (p.tired ? 0.46 : (p.face === "scared" ? 1.18 : 1));
    disc(ctx, x, y, r * 1.2, r * h, socket);
    if (p.blink) return;
    const gx = r * (p.face === "look" ? 0.42 : 0.2);
    const gy = p.face === "mad" ? -r * 0.08 : r * 0.04;
    disc(ctx, x + gx, y + gy, r * 0.46, r * 0.46 * Math.min(1, h), iris);
    disc(ctx, x + gx * 1.2, y + gy, r * 0.18, r * 0.18, "#12080c");
    disc(ctx, x + gx * 0.35, y + gy - r * 0.18, r * 0.09, r * 0.09, "rgba(255,255,255,0.85)");
  }

  function strokeSeg(ctx, x0, y0, x1, y1, style, w) {
    ctx.strokeStyle = style;
    ctx.lineWidth = w || 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  function arcSeg(ctx, x, y, r, a0, a1, style, w) {
    ctx.strokeStyle = style;
    ctx.lineWidth = w || 2;
    ctx.beginPath();
    ctx.arc(x, y, r, a0, a1);
    ctx.stroke();
  }

  // Second sculpt pass. Drawn in front of each body, so every piece sits on
  // an edge, a limb, or a surface that should read on top. NULL is not dressed.
  const FORMS = {
    // Null. Drawn. Same wick, closed eyes, dash mouth, and side flames. Never an image.
    1: function (ctx, t, grab, accent, look, boss) {
      const face = (boss && boss.face) || "fight";
      const R = 58;
      const bob = face === "sleep" ? Math.sin(t * 1.1) * 4.5 : Math.sin(t * 2.2) * 2.4;
      const sway = Math.sin(t * 1.7) * 3.4;
      const breath = 1 + Math.sin(t * 2.6) * (face === "sleep" ? 0.025 : 0.05);
      ctx.save();
      ctx.translate(sway * 0.35, bob);
      ctx.scale(2 - breath, breath);
      if (look < 0) ctx.scale(-1, 1);

      // Flat discs instead of a fresh radial gradient every frame.
      ctx.fillStyle = "rgba(254,31,111,0.16)";
      ctx.beginPath();
      ctx.arc(0, R * 0.08, R * 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(254,146,184,0.08)";
      ctx.beginPath();
      ctx.arc(0, R * 0.08, R * 1.55, 0, Math.PI * 2);
      ctx.fill();

      const startled = face === "scared";
      const flick = 1 + Math.sin(t * 11.5) * 0.07;
      const wag = Math.sin(t * 6.2) * 0.1 * R;
      ctx.save();
      ctx.translate(0.06 * R + wag, startled ? -14 : -6);
      ctx.scale(flick, (startled ? 1.16 : 1.04) * flick);
      ctx.globalAlpha = 0.86;
      ctx.fillStyle = FLAME_SHELL;
      ctx.beginPath();
      ctx.moveTo(-0.22 * R, -0.7 * R);
      ctx.quadraticCurveTo(-0.38 * R, -1.35 * R, 0.02 * R, -2.15 * R);
      ctx.quadraticCurveTo(0.46 * R, -1.25 * R, 0.26 * R, -0.7 * R);
      ctx.quadraticCurveTo(0.02 * R, -0.58 * R, -0.22 * R, -0.7 * R);
      ctx.fill();
      ctx.fillStyle = FLAME_BODY;
      ctx.beginPath();
      ctx.moveTo(-0.1 * R, -0.76 * R);
      ctx.quadraticCurveTo(-0.16 * R, -1.3 * R, 0.03 * R, -1.9 * R);
      ctx.quadraticCurveTo(0.22 * R, -1.22 * R, 0.12 * R, -0.76 * R);
      ctx.quadraticCurveTo(0.01 * R, -0.66 * R, -0.1 * R, -0.76 * R);
      ctx.fill();
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = "#fff0f6";
      ctx.beginPath();
      ctx.moveTo(-0.02 * R, -0.86 * R);
      ctx.quadraticCurveTo(0.08 * R, -1.28 * R, 0.04 * R, -1.62 * R);
      ctx.quadraticCurveTo(0.12 * R, -1.22 * R, 0.05 * R, -0.84 * R);
      ctx.fill();
      ctx.restore();

      ctx.globalAlpha = 1;
      ctx.fillStyle = FLAME_BODY;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff3d86";
      ctx.beginPath();
      ctx.ellipse(-0.16 * R, -0.2 * R, R * 0.62, R * 0.46, -0.5, 0, Math.PI * 2);
      ctx.fill();

      paintSideHand(ctx, R, t, 0, grab || 0, face);
      ctx.save();
      ctx.scale(-1, 1);
      paintSideHand(ctx, R, t, 1.7, grab || 0, face);
      ctx.restore();

      const hopL = Math.abs(Math.sin(t * 7.4)) * -8;
      const hopR = Math.abs(Math.sin(t * 7.4 + 1.7)) * -8;
      const foot = (x, hop) => {
        ctx.fillStyle = FLAME_SHELL;
        ctx.beginPath();
        ctx.arc(x, 1.18 * R + hop, R * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = FLAME_BODY;
        ctx.beginPath();
        ctx.arc(x, 1.18 * R + hop, R * 0.22, 0, Math.PI * 2);
        ctx.fill();
      };
      foot(-0.46 * R, hopL);
      foot(0.46 * R, hopR);

      paintNullFace(ctx, R, face, t, look, grab || 0);
      ctx.restore();
    },

    // Ash. A kiln: roof, firebox, chimney, and two arms. Everything sits on that mass.
    2: function (ctx, t, grab, accent, look, boss) {
      const p = poseOf(boss, t, grab);
      enterForm(ctx, t, look, p);
      const slag = "#2a120e";
      const rock = "#6a3824";
      const hot = "#ff5a18";
      const lava = "#ffc56a";
      const lift = -0.7 - p.open * 0.85;
      glow(ctx, 0, 4, 100, "rgba(255,90,30,0.32)", "rgba(255,90,30,0)");
      poly(ctx, [[-86, 46], [-64, -8], [-24, -34], [24, -34], [64, -8], [86, 46]], slag);
      poly(ctx, [[-68, 40], [-50, 2], [-16, -18], [16, -18], [50, 2], [68, 40]], rock);
      poly(ctx, [[-46, 34], [-28, 8], [0, -4], [28, 8], [46, 34]], "#140806");
      disc(ctx, 0, -30, 30, 14, "#3a160e");
      disc(ctx, 0, -28, 20, 8, hot);
      disc(ctx, -6, -30, 7, 3, lava);
      const lip = [-54, -36, -18, 0, 18, 36, 54];
      lip.forEach((x, i) => {
        const h = i === 3 ? 16 : 11;
        poly(ctx, [[x - 8, -30], [x - 2, -30 - h], [x + 7, -28], [x + 4, -18]], i % 2 ? rock : "#3d2418");
      });
      poly(ctx, [[-14, -36], [-10, -78], [10, -78], [14, -36]], slag);
      poly(ctx, [[-6, -44], [-4, -72], [4, -72], [6, -44]], "#140806");
      poly(ctx, [[-16, -78], [-12, -88], [12, -88], [16, -78]], rock);
      disc(ctx, 0, -98, 7, 5, "rgba(80,80,80,0.45)");
      disc(ctx, 0, -110, 4, 3, "rgba(90,90,90,0.3)");
      for (let i = 0; i < 5; i++) {
        poly(ctx, [[-20 + i * 10, 28], [-17 + i * 10, 42], [-12 + i * 10, 42], [-15 + i * 10, 28]], slag);
      }
      rod(ctx, -62, 4, 34, 7, lift, slag, hot);
      rod(ctx, 62, 4, 34, 7, Math.PI - lift, slag, hot);
      for (let s = -1; s <= 1; s += 2) {
        const x = s * 78;
        for (let c = 0; c < 3; c++) {
          poly(ctx, [[x, -2], [x + s * (16 + c * 4), -16 - c * 6 - p.open * 8], [x + s * 4, 4]], slag);
        }
      }
      disc(ctx, -40, 50, 16, 7, slag);
      disc(ctx, 40, 50, 16, 7, slag);
      disc(ctx, -40, 48, 6, 2.4, hot);
      disc(ctx, 40, 48, 6, 2.4, hot);
      gazeEye(ctx, -14, 6, 6.5, p, "#140806", lava);
      gazeEye(ctx, 14, 6, 6.5, p, "#140806", lava);
      const mh = 4 + p.open * 10;
      poly(ctx, [[-16, 20], [-8, 20 + mh], [0, 18], [8, 20 + mh], [16, 20]], "#120806");
      for (let i = 0; i < 5; i++) poly(ctx, [[-12 + i * 6, 20], [-9 + i * 6, 20 + mh * 0.7], [-6 + i * 6, 20]], rock);
      ctx.restore();
    },

    // Frost. A crystal knight. Crown, breastplate, and two arms, all on one axis.
    3: function (ctx, t, grab, accent, look, boss) {
      const p = poseOf(boss, t, grab);
      enterForm(ctx, t, look, p);
      const ice = "#e9f7ff";
      const deep = "#6aa6d4";
      const edge = "#16324c";
      const arm = -1.05 - p.open * 0.55;
      glow(ctx, 0, -8, 96, "rgba(180,230,255,0.26)", "rgba(180,230,255,0)");
      poly(ctx, [[0, -96], [-22, -46], [0, -28], [22, -46]], ice);
      poly(ctx, [[0, -88], [-12, -50], [0, -36], [12, -50]], "rgba(255,255,255,0.65)");
      poly(ctx, [[-46, 4], [-18, -34], [-8, 18], [-34, 42]], deep);
      poly(ctx, [[46, 4], [18, -34], [8, 18], [34, 42]], "#9ed0f0");
      poly(ctx, [[-16, -6], [0, -36], [16, -6], [10, 40], [-10, 40]], ice);
      poly(ctx, [[-7, -2], [0, -24], [7, -2], [4, 28], [-4, 28]], "rgba(255,255,255,0.4)");
      [16, 26, 38, 26, 16].forEach((h, i) => {
        const x = -24 + i * 12;
        poly(ctx, [[x - 3, -18], [x, -18 - h], [x + 3, -18]], i === 2 ? ice : deep);
      });
      poly(ctx, [[-20, -12], [20, -12], [16, -4], [-16, -4]], edge);
      disc(ctx, 0, 8, 7, 9, "#f4fbff");
      disc(ctx, -2, 4, 2.6, 3.4, "#fff");
      rod(ctx, -24, -2, 30, 5.5, arm, deep, ice);
      rod(ctx, 24, -2, 30, 5.5, Math.PI - arm, deep, ice);
      for (let s = -1; s <= 1; s += 2) {
        const x = s * 40;
        for (let c = 0; c < 3; c++) {
          poly(ctx, [[x, -16], [x + s * (12 + c * 5), -28 - c * 7 - p.open * 4], [x + s * 2, -8]], ice);
        }
      }
      disc(ctx, -18, 48, 12, 5, deep);
      disc(ctx, 18, 48, 12, 5, deep);
      poly(ctx, [[-26, 46], [-12, 46], [-16, 56], [-28, 54]], edge);
      poly(ctx, [[26, 46], [12, 46], [16, 56], [28, 54]], edge);
      gazeEye(ctx, -7, -2, 4.2, p, edge, "#fff");
      gazeEye(ctx, 7, -2, 4.2, p, edge, "#fff");
      for (let i = 0; i < 3; i++) {
        arcSeg(ctx, 0, 16 + i * 8, 12 - i, 0.35, Math.PI - 0.35, "rgba(255,255,255,0.75)", 2);
      }
      ctx.restore();
    },

    // Bloom. Six petals around a bud, one stem, two leaves.
    4: function (ctx, t, grab, accent, look, boss) {
      const p = poseOf(boss, t, grab);
      enterForm(ctx, t, look, p);
      const leaf = "#6a2a78";
      const petal = "#e7a0ff";
      const deep = "#4a1460";
      const pollen = "#ffe6a8";
      const flare = 1 + p.open * 0.22;
      glow(ctx, 0, -6, 96, "rgba(220,120,255,0.28)", "rgba(220,120,255,0)");
      poly(ctx, [[-6, 56], [-3, 16], [3, 16], [6, 56]], deep);
      for (let i = 0; i < 4; i++) disc(ctx, 0, 22 + i * 8, 5.5 - i * 0.6, 3.2, i % 2 ? leaf : deep);
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate(-Math.PI / 2 + i * (Math.PI * 2 / 6));
        ctx.scale(flare, 1);
        poly(ctx, [[-7, -4], [-16, -32], [0, -72], [16, -32], [7, -4]], i % 2 ? petal : "#f6d0ff");
        poly(ctx, [[-3, -12], [0, -52], [3, -12]], "rgba(255,255,255,0.55)");
        disc(ctx, 0, -24, 2.6, 6, deep);
        ctx.restore();
      }
      poly(ctx, [[-4, 36], [-26, 28], [-8, 22]], leaf);
      poly(ctx, [[4, 36], [26, 28], [8, 22]], leaf);
      strokeSeg(ctx, -8, 30, -22, 28, deep, 1.5);
      strokeSeg(ctx, 8, 30, 22, 28, deep, 1.5);
      const vine = -0.35 - p.open * 0.9;
      rod(ctx, -16, 10, 28, 3.2, vine, leaf, petal);
      rod(ctx, 16, 10, 28, 3.2, Math.PI - vine, leaf, petal);
      disc(ctx, 0, -8, 14, 16, "#f7d4ff");
      disc(ctx, 0, -10, 8, 10, "#fff6ff");
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
        disc(ctx, Math.cos(a) * 16, -8 + Math.sin(a) * 12, 2.2, 2.2, pollen);
      }
      gazeEye(ctx, -4.5, -10, 3.2, p, deep, pollen);
      gazeEye(ctx, 4.5, -10, 3.2, p, deep, pollen);
      poly(ctx, [[-3, -2], [0, 2 + p.open * 3], [3, -2]], deep);
      ctx.restore();
    },

    // Clock. Case, face, two gears, one pendulum. The hands are the only moving face detail.
    5: function (ctx, t, grab, accent, look, boss) {
      const p = poseOf(boss, t, grab);
      enterForm(ctx, t, look, p);
      const brass = "#e2c15a";
      const dark = "#6a5018";
      const face = "#fff4cc";
      const spin = t * (1.1 + p.open * 2.4);
      glow(ctx, 0, -16, 86, "rgba(240,200,80,0.26)", "rgba(240,200,80,0)");
      disc(ctx, 0, -16, 48, 48, dark);
      disc(ctx, 0, -16, 40, 40, brass);
      disc(ctx, 0, -16, 32, 32, face);
      disc(ctx, -8, -26, 12, 7, "rgba(255,255,255,0.35)");
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const inner = i % 3 === 0 ? 24 : 28;
        strokeSeg(ctx, Math.cos(a) * inner, -16 + Math.sin(a) * inner, Math.cos(a) * 36, -16 + Math.sin(a) * 36, dark, i % 3 === 0 ? 3 : 1.5);
      }
      ctx.save();
      ctx.translate(0, -16);
      ctx.rotate(spin * 0.15);
      strokeSeg(ctx, 0, 0, 0, -22, dark, 4);
      ctx.restore();
      ctx.save();
      ctx.translate(0, -16);
      ctx.rotate(spin);
      strokeSeg(ctx, 0, 0, 14, 5, "#8a1c1c", 2.5);
      ctx.restore();
      disc(ctx, 0, -16, 3.5, 3.5, dark);
      const gear = (x, y, r, n, dir) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * dir);
        disc(ctx, 0, 0, r, r, brass);
        for (let i = 0; i < n; i++) {
          ctx.rotate((Math.PI * 2) / n);
          poly(ctx, [[r * 0.72, -2.4], [r + 6, -2], [r + 6, 2], [r * 0.72, 2.4]], dark);
        }
        disc(ctx, 0, 0, r * 0.28, r * 0.28, dark);
        ctx.restore();
      };
      gear(-44, -18, 13, 6, 2);
      gear(46, -14, 10, 6, -2.2);
      poly(ctx, [[-8, -68], [0, -82], [8, -68]], brass);
      disc(ctx, 0, -64, 5, 5, brass);
      poly(ctx, [[-12, 28], [12, 28], [6, 64], [-6, 64]], dark);
      ctx.save();
      ctx.translate(0, 64);
      ctx.rotate(Math.sin(t * (1.5 + p.open)) * (0.32 + p.open * 0.4));
      poly(ctx, [[-2.5, 0], [-2.5, 26], [2.5, 26], [2.5, 0]], brass);
      disc(ctx, 0, 32, 11, 13, brass);
      disc(ctx, 0, 32, 5, 6, dark);
      ctx.restore();
      rod(ctx, -16, 36, 26, 4.5, 0.45, dark, brass);
      rod(ctx, 16, 36, 26, 4.5, Math.PI - 0.45, dark, brass);
      disc(ctx, -20, 64, 7, 4, dark);
      disc(ctx, 20, 64, 7, 4, dark);
      gazeEye(ctx, -11, -22, 4.6, p, dark, "#fff");
      gazeEye(ctx, 11, -22, 4.6, p, dark, "#fff");
      poly(ctx, [[-7, -8], [0, -5 + p.open * 5], [7, -8]], dark);
      ctx.restore();
    },

    // Gut. One sack, a row of ribs, four tubes, one mouth.
    6: function (ctx, t, grab, accent, look, boss) {
      const p = poseOf(boss, t, grab);
      enterForm(ctx, t, look, p);
      const bile = "#b6ff6a";
      const sack = "#3e7a28";
      const deep = "#173014";
      const heave = Math.sin(t * 2.2) * 3 + p.open * 5;
      glow(ctx, 0, 6, 96, "rgba(160,255,80,0.26)", "rgba(160,255,80,0)");
      disc(ctx, 0, 8, 58 + heave * 0.2, 46, deep);
      disc(ctx, 0, 6, 48, 38, sack);
      disc(ctx, -14, -6, 18, 12, "rgba(210,255,160,0.32)");
      for (let i = 0; i < 5; i++) {
        arcSeg(ctx, 0, -4 + i * 10, 36 - i * 2, Math.PI * 1.08, Math.PI * 1.92, deep, 3.5);
      }
      for (let i = 0; i < 4; i++) {
        const x = -27 + i * 18;
        poly(ctx, [[x - 4, -34], [x - 5, -56], [x + 5, -56], [x + 4, -34]], sack);
        disc(ctx, x, -60, 5, 4, bile);
      }
      const mh = 7 + p.open * 14;
      disc(ctx, 0, 26, 22, 7 + mh * 0.25, "#10200c");
      for (let i = 0; i < 6; i++) {
        const tx = -15 + i * 6;
        poly(ctx, [[tx, 22], [tx + 2.4, 22 + mh], [tx + 5, 22]], i % 2 ? bile : "#e8ffc0");
      }
      gazeEye(ctx, -14, -4, 5.5, p, deep, bile);
      gazeEye(ctx, 14, -4, 5.5, p, deep, bile);
      poly(ctx, [[-64, 8], [-80, 20], [-76, 30], [-60, 18]], sack);
      poly(ctx, [[64, 8], [80, 20], [76, 30], [60, 18]], sack);
      disc(ctx, -78, 26, 5, 4, bile);
      disc(ctx, 78, 26, 5, 4, bile);
      ctx.restore();
    },

    // Mirror. One frame. Two figures. The echo is the same figure, shifted.
    7: function (ctx, t, grab, accent, look, boss) {
      const p = poseOf(boss, t, grab);
      enterForm(ctx, t, look, p);
      const glass = "rgba(186,226,255,0.88)";
      const edge = "#1a3c66";
      const split = 16 + p.open * 10;
      glow(ctx, 4, 0, 100, "rgba(80,160,255,0.2)", "rgba(80,160,255,0)");
      ctx.strokeStyle = edge;
      ctx.lineWidth = 6;
      ctx.strokeRect(-78, -86, 164, 164);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#e7f4ff";
      ctx.strokeRect(-68, -76, 144, 144);
      poly(ctx, [[-12, -86], [0, -102], [12, -86]], glass);
      poly(ctx, [[-46, 78], [46, 78], [36, 92], [-36, 92]], edge);
      const figure = (dx, alpha) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(dx, 0);
        poly(ctx, [[-14, 46], [-18, -8], [-8, -46], [8, -46], [18, -8], [14, 46]], glass);
        poly(ctx, [[-6, 10], [-2, -28], [5, -34], [6, 8]], "rgba(255,255,255,0.5)");
        poly(ctx, [[-16, -6], [-34, -22 - p.open * 10], [-30, -12], [-12, 2]], edge);
        poly(ctx, [[16, -6], [34, -22 - p.open * 10], [30, -12], [12, 2]], edge);
        disc(ctx, 0, -26, 12, 14, glass);
        disc(ctx, -4, -28, 2.4, 3, edge);
        disc(ctx, 4, -28, 2.4, 3, edge);
        disc(ctx, -4, -27, 1, 1, "#fff");
        disc(ctx, 4, -27, 1, 1, "#fff");
        poly(ctx, [[-12, 46], [-8, 46], [-12, 60], [-18, 56]], edge);
        poly(ctx, [[12, 46], [8, 46], [12, 60], [18, 56]], edge);
        ctx.restore();
      };
      figure(split, 0.45);
      figure(-8, 1);
      ctx.restore();
    },

    // Rail. Boiler, cab, cowcatcher, three wheels on one axle line.
    8: function (ctx, t, grab, accent, look, boss) {
      const p = poseOf(boss, t, grab);
      enterForm(ctx, t, look, p);
      const iron = "#3a241c";
      const coal = "#1a0e0c";
      const fire = "#ff5a28";
      const brass = "#e2b060";
      const spin = t * (5 + p.open * 6);
      glow(ctx, -10, -6, 90, "rgba(255,90,40,0.28)", "rgba(255,90,40,0)");
      poly(ctx, [[-70, 16], [-78, 32], [62, 32], [72, 16], [64, 2], [-62, 2]], iron);
      poly(ctx, [[-52, 2], [-46, -20], [36, -20], [44, 2]], "#5a3428");
      poly(ctx, [[24, -20], [58, -24], [64, -2], [28, 2]], iron);
      poly(ctx, [[36, -16], [52, -16], [50, -4], [38, -4]], "#9fd6ff");
      poly(ctx, [[-78, 18], [-104, 32], [-68, 32]], brass);
      for (let i = 0; i < 3; i++) strokeSeg(ctx, -96, 20 + i * 4, -74, 24 + i * 3, iron, 2);
      poly(ctx, [[-8, -20], [-4, -52], [6, -52], [10, -20]], iron);
      disc(ctx, 1, -58, 6, 4, "rgba(70,70,70,0.4)");
      disc(ctx, 1, -66, 4, 3, "rgba(90,90,90,0.28)");
      for (let i = 0; i < 3; i++) strokeSeg(ctx, -40, -12 + i * 6, 30, -12 + i * 6, brass, 2);
      [-36, -4, 28].forEach((x) => {
        disc(ctx, x, 36, 15, 15, coal);
        disc(ctx, x, 36, 7, 7, iron);
        ctx.save();
        ctx.translate(x, 36);
        ctx.rotate(spin);
        strokeSeg(ctx, -11, 0, 11, 0, brass, 3);
        strokeSeg(ctx, 0, -11, 0, 11, brass, 3);
        ctx.restore();
      });
      strokeSeg(ctx, -36, 24, 28, 24, brass, 4);
      poly(ctx, [[-28, -6], [8, -6], [6, 8], [-26, 8]], "#241610");
      gazeEye(ctx, -16, 0, 3.6, p, coal, fire);
      gazeEye(ctx, -4, 0, 3.6, p, coal, fire);
      poly(ctx, [[-46, -28], [-34, -28], [-32, -42], [-48, -42]], brass);
      disc(ctx, -40, -34, 5, 5, "#fff2c8");
      disc(ctx, -40, -34, 2.2, 2.2, fire);
      poly(ctx, [[48, 6], [70, 6], [66, 24], [46, 24]], coal);
      ctx.restore();
    },

    // Static. A set: screen, two ears, three legs.
    9: function (ctx, t, grab, accent, look, boss) {
      const p = poseOf(boss, t, grab);
      enterForm(ctx, t, look, p);
      const caseC = "#2a2a44";
      const spark = "#d8d8ff";
      glow(ctx, 0, -24, 88, "rgba(180,180,255,0.26)", "rgba(180,180,255,0)");
      poly(ctx, [[-34, -2], [-40, -60], [40, -60], [34, -2]], caseC);
      poly(ctx, [[-26, -8], [-30, -52], [30, -52], [26, -8]], "#12122a");
      ctx.fillStyle = "rgba(200,200,255,0.4)";
      ctx.fillRect(-26, -50 + ((t * 28) % 40), 52, 3);
      for (let i = 0; i < 3; i++) strokeSeg(ctx, -24, -44 + i * 12, 24, -44 + i * 12, "rgba(180,180,255,0.28)", 1);
      gazeEye(ctx, -9, -30, 5.5, p, "#070714", spark);
      gazeEye(ctx, 9, -30, 5.5, p, "#070714", spark);
      [-14, 0, 14].forEach((x, i) => {
        const h = (i === 1 ? 26 : 16) + p.open * 6;
        poly(ctx, [[x - 2, -60], [x - 2, -60 - h], [x + 2, -60 - h], [x + 2, -60]], spark);
        disc(ctx, x, -62 - h, 3, 3, "#fff");
      });
      const buzz = Math.sin(t * 24) * (2 + p.open * 3);
      ctx.strokeStyle = spark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-14, -78);
      ctx.lineTo(buzz * 0.4, -92);
      ctx.lineTo(14, -76);
      ctx.stroke();
      disc(ctx, -40, -28, 11, 11, caseC);
      disc(ctx, 40, -28, 11, 11, caseC);
      for (let i = 0; i < 2; i++) {
        arcSeg(ctx, -40, -28, 6 + i * 3, t * 3, t * 3 + 1.6, "#8a8ae0", 2);
        arcSeg(ctx, 40, -28, 6 + i * 3, -t * 3, -t * 3 + 1.6, "#8a8ae0", 2);
      }
      [-18, -6, 6, 18].forEach((x, i) => {
        disc(ctx, x, -4, 3.2, 3.2, caseC);
        disc(ctx, x, -4, 1.3, 1.3, i === 3 ? "#ff5a6a" : spark);
      });
      rod(ctx, -14, 2, 36, 3.6, 0.55, caseC, spark);
      rod(ctx, 0, 4, 42, 3.6, Math.PI / 2, caseC, spark);
      rod(ctx, 14, 2, 36, 3.6, Math.PI - 0.55, caseC, spark);
      disc(ctx, -32, 34, 5, 3, "#111");
      disc(ctx, 0, 46, 5, 3, "#111");
      disc(ctx, 32, 34, 5, 3, "#111");
      ctx.restore();
    },

    // Bone. Skull, jaw, ribcage, and three bones on one orbit.
    10: function (ctx, t, grab, accent, look, boss) {
      const p = poseOf(boss, t, grab);
      enterForm(ctx, t, look, p);
      const bone = "#f2e6d0";
      const shade = "#c2ae90";
      const pit = "#2a2218";
      const drop = 8 + p.open * 14;
      glow(ctx, 0, -10, 90, "rgba(240,220,180,0.2)", "rgba(240,220,180,0)");
      arcSeg(ctx, 0, -6, 70, t * 0.35, t * 0.35 + Math.PI * 1.35, "rgba(240,220,180,0.4)", 3);
      disc(ctx, 0, -18, 36, 32, bone);
      disc(ctx, -8, -28, 14, 10, "rgba(255,255,255,0.4)");
      disc(ctx, -12, -14, 9, 11, pit);
      disc(ctx, 12, -14, 9, 11, pit);
      gazeEye(ctx, -12, -14, 3.8, p, pit, "#fff6e4");
      gazeEye(ctx, 12, -14, 3.8, p, pit, "#fff6e4");
      poly(ctx, [[-4, -6], [0, 2], [4, -6], [2, -14], [-2, -14]], pit);
      ctx.save();
      ctx.translate(0, drop * 0.35);
      poly(ctx, [[-24, 6], [-16, 6 + drop], [16, 6 + drop], [24, 6]], bone);
      for (let i = 0; i < 5; i++) poly(ctx, [[-12 + i * 5, 6], [-10 + i * 5, 6 + drop * 0.65], [-7 + i * 5, 6]], shade);
      ctx.restore();
      for (let i = 0; i < 4; i++) {
        arcSeg(ctx, 0, 20 + i * 7, 26 - i * 4, 0.25, Math.PI - 0.25, shade, 3);
      }
      poly(ctx, [[-5, 18], [5, 18], [3, 52], [-3, 52]], shade);
      disc(ctx, 0, 56, 8, 5, bone);
      for (let i = 0; i < 3; i++) {
        const a = t * 0.7 + i * (Math.PI * 2 / 3);
        ctx.save();
        ctx.translate(Math.cos(a) * 58, -8 + Math.sin(a) * 22);
        ctx.rotate(a);
        poly(ctx, [[-14, -3], [14, -3], [12, 3], [-12, 3]], bone);
        disc(ctx, -14, 0, 4.5, 4.5, bone);
        disc(ctx, 14, 0, 4.5, 4.5, bone);
        ctx.restore();
      }
      ctx.restore();
    },

    // Glass. One window. Leads frame the face. Shards hang off the sill.
    11: function (ctx, t, grab, accent, look, boss) {
      const p = poseOf(boss, t, grab);
      enterForm(ctx, t, look, p);
      const pane = "rgba(190,255,248,0.78)";
      const lead = "#14343a";
      const stain = "rgba(90,210,200,0.5)";
      glow(ctx, 0, -8, 88, "rgba(80,255,240,0.2)", "rgba(80,255,240,0)");
      poly(ctx, [[-34, -84], [34, -84], [40, 48], [-40, 48]], pane);
      poly(ctx, [[-30, -78], [-6, -78], [-8, -48], [-32, -40]], stain);
      poly(ctx, [[8, -76], [30, -76], [32, -42], [10, -50]], "rgba(255,255,255,0.28)");
      poly(ctx, [[-28, 4], [-6, -2], [-4, 36], [-30, 40]], "rgba(20,80,90,0.35)");
      poly(ctx, [[8, 2], [30, -4], [32, 38], [10, 34]], stain);
      ctx.strokeStyle = lead;
      ctx.lineWidth = 4;
      ctx.strokeRect(-34, -84, 68, 132);
      [[-22, -84, -22, 48], [22, -84, 22, 48], [-34, -46, 34, -46], [-34, 0, 34, 0]].forEach((ln) => {
        strokeSeg(ctx, ln[0], ln[1], ln[2], ln[3], lead, 3);
      });
      [[-22, -46], [22, -46], [-22, 0], [22, 0]].forEach((j) => disc(ctx, j[0], j[1], 3.2, 3.2, lead));
      gazeEye(ctx, -8, -24, 4.4, p, lead, "#fff");
      gazeEye(ctx, 8, -24, 4.4, p, lead, "#fff");
      ctx.strokeStyle = "#f4fffe";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-22, -46);
      ctx.lineTo(-8, -30);
      ctx.lineTo(-14, -8);
      if (p.open > 0.35 || p.mood > 0.4) ctx.lineTo(6, 8);
      ctx.stroke();
      poly(ctx, [[-8, -96], [0, -110], [8, -96]], pane);
      for (let s = -1; s <= 1; s += 2) {
        for (let i = 0; i < 3; i++) {
          ctx.save();
          ctx.translate(s * 46, -16 + i * 18);
          ctx.rotate(s * (0.5 + p.open * 0.35));
          poly(ctx, [[0, -5], [s * -20, 0], [0, 5]], pane);
          ctx.restore();
        }
      }
      poly(ctx, [[-30, 48], [-38, 62], [38, 62], [30, 48]], lead);
      ctx.restore();
    },

    // Hunger. A mouth. Teeth on one curve, tongue in the middle, eyes above.
    12: function (ctx, t, grab, accent, look, boss) {
      const p = poseOf(boss, t, grab);
      enterForm(ctx, t, look, p);
      const flesh = "#e07088";
      const deep = "#6a2038";
      const gum = "#ffd0d8";
      const gape = 8 + p.open * 18;
      glow(ctx, 0, 2, 90, "rgba(255,80,120,0.26)", "rgba(255,80,120,0)");
      disc(ctx, 0, 2, 52, 46, deep);
      disc(ctx, 0, 0, 44, 38, flesh);
      disc(ctx, -14, -12, 14, 10, "rgba(255,220,220,0.35)");
      disc(ctx, 0, 10, 26, 7 + gape * 0.4, "#2a0814");
      for (let i = 0; i < 7; i++) {
        const tx = -21 + i * 7;
        poly(ctx, [[tx, 4], [tx + 3, 4 - (6 + (i % 2) * 2)], [tx + 6, 4]], gum);
        poly(ctx, [[tx, 14], [tx + 3, 14 + gape * 0.5], [tx + 6, 14]], gum);
      }
      const lick = Math.sin(t * 2.4) * 8;
      poly(ctx, [[-6, 12], [lick, 14 + gape + 14], [6, 12]], "#ff8aa0");
      poly(ctx, [[-3, 12], [lick * 0.5, 14 + gape + 6], [3, 12]], "#ffd0d8");
      disc(ctx, lick, 18 + gape, 3.5, 2.6, "#fff");
      gazeEye(ctx, -14, -16, 4.6, p, deep, "#fff");
      gazeEye(ctx, 14, -16, 4.6, p, deep, "#fff");
      rod(ctx, -36, 0, 18, 4.5, -0.7 - p.open * 0.4, flesh, gum);
      rod(ctx, 36, 0, 18, 4.5, Math.PI + 0.7 + p.open * 0.4, flesh, gum);
      for (let i = 0; i < 3; i++) arcSeg(ctx, 0, 34 + i * 6, 30 - i * 6, 0.25, Math.PI - 0.25, deep, 2);
      ctx.restore();
    },

    // Wire. One mast, two crossarms, three insulators, one sagging cable.
    13: function (ctx, t, grab, accent, look, boss) {
      const p = poseOf(boss, t, grab);
      enterForm(ctx, t, look, p);
      const steel = "#3a2458";
      const coil = "#c9a6ff";
      const arc = "#f4e8ff";
      glow(ctx, 0, -16, 90, "rgba(180,100,255,0.24)", "rgba(180,100,255,0)");
      poly(ctx, [[-12, 58], [-16, -16], [16, -16], [12, 58]], steel);
      poly(ctx, [[-8, -16], [-6, -64], [6, -64], [8, -16]], "#241438");
      poly(ctx, [[-64, -22], [64, -22], [60, -12], [-60, -12]], steel);
      poly(ctx, [[-42, -44], [42, -44], [38, -34], [-38, -34]], steel);
      [-36, 0, 36].forEach((x, i) => {
        disc(ctx, x, -52, 7, 9, coil);
        disc(ctx, x, -52, 2.6, 3.4, steel);
        poly(ctx, [[x - 2, -60], [x, -74 - (i === 1 ? 8 : 0)], [x + 2, -60]], coil);
      });
      ctx.strokeStyle = arc;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-36, -44);
      ctx.quadraticCurveTo(0, -20 + Math.sin(t * 16) * (3 + p.open * 8), 36, -44);
      ctx.stroke();
      gazeEye(ctx, 0, -4, 5.5, p, "#14081c", arc);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? "#ffd24a" : "#241438";
        ctx.fillRect(-10, 16 + i * 8, 20, 5);
      }
      rod(ctx, -16, 18, 28, 3.5, 0.7, steel, coil);
      rod(ctx, 16, 18, 28, 3.5, Math.PI - 0.7, steel, coil);
      poly(ctx, [[-22, 58], [-28, 70], [28, 70], [22, 58]], "#1a1024");
      ctx.restore();
    },

    // Salt. Three drums, a capital, a base, two arms that open together.
    14: function (ctx, t, grab, accent, look, boss) {
      const p = poseOf(boss, t, grab);
      enterForm(ctx, t, look, p);
      const salt = "#f4ecd4";
      const shade = "#c8b98a";
      const dark = "#3a3428";
      const pray = 0.85 - p.open * 1.15;
      glow(ctx, 0, -20, 78, "rgba(255,244,210,0.26)", "rgba(255,244,210,0)");
      poly(ctx, [[-32, 58], [-38, 36], [38, 36], [32, 58]], shade);
      poly(ctx, [[-24, 36], [-28, 8], [28, 8], [24, 36]], salt);
      poly(ctx, [[-18, 8], [-22, -24], [22, -24], [18, 8]], "#fff8ea");
      poly(ctx, [[-30, -24], [30, -24], [24, -40], [-24, -40]], salt);
      for (let i = 0; i < 4; i++) strokeSeg(ctx, -16, -8 + i * 12, 16, -8 + i * 12, shade, 2);
      poly(ctx, [[-14, 16], [14, 16], [10, 30], [-10, 30]], dark);
      poly(ctx, [[-8, 18], [8, 18], [6, 28], [-6, 28]], "#2a2418");
      disc(ctx, 0, -58, 14, 5, "rgba(255,250,230,0.9)");
      arcSeg(ctx, 0, -64, 20, Math.PI * 1.15, Math.PI * 1.85, salt, 2);
      disc(ctx, 0, -86, 4, 4, salt);
      rod(ctx, -14, -6, 26, 3.6, pray, salt, shade);
      rod(ctx, 14, -6, 26, 3.6, Math.PI - pray, salt, shade);
      gazeEye(ctx, -6, -12, 3.2, p, dark, "#fff");
      gazeEye(ctx, 6, -12, 3.2, p, dark, "#fff");
      poly(ctx, [[-5, -4], [0, -2 + p.open * 2], [5, -4]], dark);
      ctx.restore();
    },

    // Shift. One runner and two copies of the same body, stepped behind it.
    15: function (ctx, t, grab, accent, look, boss) {
      const p = poseOf(boss, t, grab);
      enterForm(ctx, t, look, p);
      const red = "#ff3a3a";
      const dark = "#4a1014";
      const hot = "#ffd0d0";
      const stretch = 1 + p.open * 0.28;
      const body = (alpha) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        poly(ctx, [[-62 * stretch, -10], [40, -18], [74, -2], [40, 14], [-56 * stretch, 10]], dark);
        poly(ctx, [[-44 * stretch, -5], [34, -10], [60, 0], [30, 8], [-40, 5]], red);
        ctx.restore();
      };
      glow(ctx, 16, 0, 96, "rgba(255,40,40,0.28)", "rgba(255,40,40,0)");
      body(0.22);
      ctx.save();
      ctx.translate(-16, 0);
      body(0.4);
      ctx.restore();
      body(1);
      for (let i = 0; i < 4; i++) strokeSeg(ctx, -78 * stretch, -16 + i * 8, -24, -16 + i * 8, hot, 2);
      disc(ctx, 58, -4, 14, 12, dark);
      disc(ctx, 62, -6, 8, 7, red);
      gazeEye(ctx, 64, -6, 3.2, p, "#2a080c", hot);
      poly(ctx, [[72, -12], [90, -4], [72, 4]], hot);
      const stride = Math.sin(t * (7 + p.open * 4));
      rod(ctx, -6, 6, 22, 3.5, 0.9 + stride * 0.45, dark, red);
      rod(ctx, 8, 6, 22, 3.5, 2.3 - stride * 0.45, dark, red);
      ctx.restore();
    },

    // Ghost. One sheet, a straight grid, two holes, a stitched mouth.
    16: function (ctx, t, grab, accent, look, boss) {
      const p = poseOf(boss, t, grab);
      enterForm(ctx, t, look, p);
      const sheet = "rgba(214,255,238,0.86)";
      const grid = "rgba(18,70,54,0.4)";
      const hole = "#12382c";
      glow(ctx, 0, -4, 78, "rgba(80,255,180,0.18)", "rgba(80,255,180,0)");
      ctx.beginPath();
      ctx.moveTo(-32, -58);
      ctx.quadraticCurveTo(-44, -8, -30, 36);
      for (let i = 0; i < 5; i++) {
        const x = -30 + i * 15;
        const dip = 12 + (i % 2) * 8 + Math.sin(t * 2.2 + i * 0.6) * 2;
        ctx.lineTo(x + 7, 36 + dip + p.open * 3);
        ctx.lineTo(x + 15, 34);
      }
      ctx.quadraticCurveTo(44, -4, 32, -58);
      ctx.closePath();
      ctx.fillStyle = sheet;
      ctx.fill();
      for (let i = 0; i < 4; i++) strokeSeg(ctx, -24 + i * 16, -48, -18 + i * 12, 34, grid, 1);
      for (let i = 0; i < 4; i++) strokeSeg(ctx, -30, -44 + i * 18, 30, -44 + i * 18, grid, 1);
      disc(ctx, -9, -22, 7, 9, hole);
      disc(ctx, 11, -22, 7, 9, hole);
      if (!p.blink) {
        disc(ctx, -7, -20, 2.2, 2.6, "#e8fff6");
        disc(ctx, 13, -20, 2.2, 2.6, "#e8fff6");
      }
      poly(ctx, [[-8, -4], [-4, 2 + p.open * 5], [0, -2], [4, 2 + p.open * 5], [8, -4]], hole);
      poly(ctx, [[-16, -58], [-6, -72], [2, -58]], sheet);
      poly(ctx, [[2, -58], [12, -70], [20, -56]], sheet);
      ctx.restore();
    },

    // Needle. A cushion and one crown of pins, tallest in the middle.
    17: function (ctx, t, grab, accent, look, boss) {
      const p = poseOf(boss, t, grab);
      enterForm(ctx, t, look, p);
      const cloth = "#3a3a6a";
      const pin = "#e8e8ff";
      const head = "#ffd24a";
      glow(ctx, 0, 8, 84, "rgba(140,140,255,0.22)", "rgba(140,140,255,0)");
      disc(ctx, 0, 14, 42, 24, cloth);
      disc(ctx, -10, 8, 14, 7, "rgba(255,255,255,0.16)");
      const pins = 9;
      for (let i = 0; i < pins; i++) {
        const u = i / (pins - 1);
        const x = -36 + u * 72;
        const arch = Math.sin(u * Math.PI);
        const h = 22 + arch * 36 + p.open * arch * 8;
        strokeSeg(ctx, x, 6, x, 6 - h, pin, i === 4 ? 3 : 2);
        disc(ctx, x, 6 - h, i === 4 ? 3.6 : 2.6, i === 4 ? 3.6 : 2.6, i % 2 ? head : pin);
      }
      ctx.strokeStyle = "#ff8aa0";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-28, 6);
      ctx.quadraticCurveTo(0, -8, 30, 2);
      ctx.stroke();
      gazeEye(ctx, -10, 12, 4.4, p, "#1a1a30", pin);
      gazeEye(ctx, 10, 12, 4.4, p, "#1a1a30", pin);
      for (let i = 0; i < 5; i++) strokeSeg(ctx, -20 + i * 10, 28, -20 + i * 10, 40, pin, 1.5);
      disc(ctx, 0, 22, 8, 3.5, "#2a2a4a");
      ctx.restore();
    },

    // Sun. A disc and twelve rays on one center. One wedge is the shade.
    18: function (ctx, t, grab, accent, look, boss) {
      const p = poseOf(boss, t, grab);
      enterForm(ctx, t, look, p);
      const core = "#ffd15a";
      const burn = "#c45a10";
      const ash = "#3a2410";
      const rays = [78, 44, 78, 44, 78, 44, 78, 44, 78, 44, 78, 44];
      glow(ctx, 0, 0, 100, "rgba(255,200,60,0.36)", "rgba(255,200,60,0)");
      for (let i = 0; i < rays.length; i++) {
        const a = (i / rays.length) * Math.PI * 2;
        const len = rays[i] + p.open * (i % 2 ? 10 : 4);
        ctx.save();
        ctx.rotate(a);
        poly(ctx, [[-6, 30], [0, 30 + len], [6, 30]], i % 2 ? core : "#ffe7a8");
        ctx.restore();
      }
      disc(ctx, 0, 0, 32, 32, burn);
      disc(ctx, 0, 0, 24, 24, core);
      disc(ctx, -6, -6, 7, 5, "rgba(255,255,255,0.4)");
      ctx.beginPath();
      ctx.moveTo(10, -6);
      ctx.arc(0, 0, 24, -0.3, 0.85);
      ctx.closePath();
      ctx.fillStyle = "rgba(40,24,8,0.5)";
      ctx.fill();
      gazeEye(ctx, -7, -2, 4.4, p, ash, "#fff");
      gazeEye(ctx, 7, -2, 4.4, p, ash, "#fff");
      for (let i = 0; i < 2; i++) arcSeg(ctx, 0, 0, 36 + i * 6, t * 0.6 + i, t * 0.6 + i + 1.1, "rgba(255,230,150,0.8)", 2);
      ctx.restore();
    },

    // Fold. Two halves of one card, one crease, stitches on that crease.
    19: function (ctx, t, grab, accent, look, boss) {
      const p = poseOf(boss, t, grab);
      enterForm(ctx, t, look, p);
      const paper = "#e6dcff";
      const shade = "#b7a6e4";
      const crease = "#6c5c9a";
      const gap = 4 + p.open * 12;
      glow(ctx, 0, 0, 84, "rgba(200,180,255,0.22)", "rgba(200,180,255,0)");
      ctx.save();
      ctx.translate(-gap, 0);
      poly(ctx, [[6, -64], [-36, -36], [-40, 36], [4, 56], [8, -16]], paper);
      poly(ctx, [[2, -36], [-16, -18], [-14, 16], [4, 8]], "rgba(255,255,255,0.4)");
      poly(ctx, [[-36, -36], [-48, -46], [-28, -24]], shade);
      gazeEye(ctx, -14, -6, 3.6, p, crease, "#fff");
      poly(ctx, [[-20, 10], [-12, 14 + p.open * 3], [-6, 10]], crease);
      ctx.restore();
      ctx.save();
      ctx.translate(gap, 0);
      poly(ctx, [[-6, -64], [36, -36], [40, 36], [-4, 56], [-8, -16]], shade);
      poly(ctx, [[-2, -36], [16, -18], [14, 16], [-4, 8]], "rgba(255,255,255,0.22)");
      poly(ctx, [[36, -36], [48, -46], [28, -24]], paper);
      gazeEye(ctx, 14, -6, 3.6, p, crease, "#fff");
      poly(ctx, [[6, 10], [12, 14 + p.open * 3], [20, 10]], crease);
      ctx.restore();
      strokeSeg(ctx, 0, -66, 0, 58, crease, 3);
      for (let i = 0; i < 6; i++) strokeSeg(ctx, -4, -48 + i * 16, 4, -40 + i * 16, "#fff", 1.5);
      ctx.restore();
    },

    // Last. Two stars on one center. The face sits in the middle. Nothing orbits off to the side.
    20: function (ctx, t, grab, accent, look, boss) {
      const p = poseOf(boss, t, grab);
      enterForm(ctx, t, look, p);
      const star = "#f7f4ff";
      const dim = "#b7b4cc";
      const core = "#fff";
      glow(ctx, 0, 0, 96, "rgba(255,255,255,0.26)", "rgba(255,255,255,0)");
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const len = (i % 2 ? 36 : 58);
        ctx.save();
        ctx.rotate(a);
        poly(ctx, [[-7, 14], [0, len], [7, 14]], dim);
        ctx.restore();
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const len = (i % 2 ? 70 : 42) + p.open * (i % 2 ? 6 : 2);
        ctx.save();
        ctx.rotate(a);
        poly(ctx, [[-8, 16], [0, len], [8, 16]], i % 2 ? star : "#dedae8");
        poly(ctx, [[-3, 18], [0, len - 12], [3, 18]], "rgba(255,255,255,0.55)");
        disc(ctx, 0, len - 2, 2.6, 2.6, core);
        ctx.restore();
      }
      arcSeg(ctx, 0, 0, 30, 0, Math.PI * 2, "rgba(255,255,255,0.35)", 1.5);
      disc(ctx, 0, 0, 20, 20, "#e4e0ee");
      disc(ctx, 0, 0, 15, 15, core);
      gazeEye(ctx, -5.5, -1, 3.4, p, "#2c2c3a", "#fff");
      gazeEye(ctx, 5.5, -1, 3.4, p, "#2c2c3a", "#fff");
      ctx.strokeStyle = "#6a6880";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (p.face === "mad") {
        ctx.moveTo(-5, 7);
        ctx.lineTo(5, 7);
      } else if (p.tired) {
        ctx.moveTo(-5, 5);
        ctx.quadraticCurveTo(0, 9, 5, 5);
      } else {
        ctx.moveTo(-4, 6);
        ctx.quadraticCurveTo(0, 7 + p.open * 3, 4, 6);
      }
      ctx.stroke();
      ctx.restore();
    },
  };

  // Static chassis for Null: disc + highlight + soft aura. Animated wick/hands/face paint live.
  const NULL_SHELL = { canvas: null, ready: false };
  function ensureNullShell() {
    if (NULL_SHELL.ready && NULL_SHELL.canvas) return NULL_SHELL.canvas;
    if (typeof document === "undefined" || !document.createElement) return null;
    const N = 280;
    const c = document.createElement("canvas");
    if (!c.getContext) return null;
    c.width = N;
    c.height = N;
    const g = c.getContext("2d");
    const R = 58;
    g.translate(N / 2, N / 2);
    g.fillStyle = "rgba(254,31,111,0.16)";
    g.beginPath();
    g.arc(0, R * 0.08, R * 0.95, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(254,146,184,0.08)";
    g.beginPath();
    g.arc(0, R * 0.08, R * 1.55, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = FLAME_BODY;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ff3d86";
    g.beginPath();
    g.ellipse(-0.16 * R, -0.2 * R, R * 0.62, R * 0.46, -0.5, 0, Math.PI * 2);
    g.fill();
    NULL_SHELL.canvas = c;
    NULL_SHELL.ready = true;
    return c;
  }

  // Static chassis bake: body mass without live face/limb motion. Animated bits still paint live.
  const SHELL = { key: "", canvas: null, N: 280 };

  function shellKey(dim, accent) {
    const a = accent || [255, 210, 160];
    return (dim | 0) + ":" + (a[0] | 0) + "," + (a[1] | 0) + "," + (a[2] | 0);
  }

  function bakeTrailShell(g, N) {
    // Soft glows (Null's halo, kiln haze) sit under alpha ~100. Crushing those
    // into a solid accent disc made the first boss trail a giant opaque blob.
    // Keep the body colors and drop the haze. The blit alpha is the only fade.
    let img;
    try { img = g.getImageData(0, 0, N, N); } catch (e) { return; }
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 100) d[i + 3] = 0;
      else d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }

  function ensureShell(dim, accent) {
    const key = shellKey(dim, accent);
    if (SHELL.canvas && SHELL.key === key) return SHELL.canvas;
    if (typeof document === "undefined" || !document.createElement) return null;
    const N = SHELL.N;
    const c = SHELL.canvas && SHELL.canvas.width === N ? SHELL.canvas : document.createElement("canvas");
    if (!c.getContext) return null;
    c.width = N;
    c.height = N;
    const g = c.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, N, N);
    g.save();
    g.translate(N / 2, N / 2);
    // Neutral pose — filled mass only. Drop strokes so speed-lines/wire don't become the trail.
    const fn = FORMS[dim] || FORMS[1];
    const col = accent || [255, 210, 160];
    const stroke = g.stroke;
    const strokeRect = g.strokeRect;
    g.stroke = function () {};
    g.strokeRect = function () {};
    fn(g, 0, 0, col, 1, { face: "fight", phase: "fight", mood: 0 });
    g.stroke = stroke;
    g.strokeRect = strokeRect;
    g.restore();
    bakeTrailShell(g, N);
    SHELL.key = key;
    SHELL.canvas = c;
    return c;
  }

  function paint(ctx, dim, t, grab, accent, look, boss) {
    const fn = FORMS[dim] || FORMS[1];
    // Live boss always paints full form (animated). Shell bake is for ghost/trail blit.
    ctx.save();
    fn(ctx, t, grab, accent || [255, 210, 160], look || 1, boss || {});
    ctx.restore();
  }

  function paintCached(ctx, dim, t, grab, accent, look, boss, alpha) {
    const a = alpha == null ? 1 : alpha;
    if (a <= 0.012) return;
    // Afterimages only. The live boss goes through paint() and stays solid.
    const shell = ensureShell(dim, accent);
    if (shell && a < 0.9) {
      const N = SHELL.N;
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = a;
      if (look < 0) ctx.scale(-1, 1);
      ctx.drawImage(shell, -N / 2, -N / 2);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = a;
    paint(ctx, dim, t, grab, accent, look, boss);
    ctx.restore();
  }

  function paintShell(ctx, dim, accent, look) {
    if ((dim | 0) !== 1) return false;
    const shell = ensureNullShell();
    if (!shell) return false;
    const N = shell.width;
    ctx.drawImage(shell, -N / 2, -N / 2);
    return true;
  }

  function countingCtx() {
    return {
      n: 0,
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      globalAlpha: 1,
      lineCap: "butt",
      lineJoin: "miter",
      save: function () {},
      restore: function () {},
      translate: function () {},
      scale: function () {},
      rotate: function () {},
      beginPath: function () { this.n += 1; },
      closePath: function () {},
      moveTo: function () {},
      lineTo: function () {},
      arc: function () {},
      ellipse: function () {},
      fill: function () {},
      stroke: function () {},
      fillRect: function () { this.n += 1; },
      strokeRect: function () { this.n += 1; },
      quadraticCurveTo: function () {},
      createRadialGradient: function () { return { addColorStop: function () {} }; },
      createLinearGradient: function () { return { addColorStop: function () {} }; },
    };
  }

  function audit() {
    const counts = {};
    for (let d = 2; d <= 20; d++) {
      const ctx = countingCtx();
      FORMS[d](ctx, 1.25, 0.55, 1, { face: "fight", mood: 0.6, phase: "fight", band: "strain" });
      counts[d] = ctx.n;
    }
    return counts;
  }

  root.SURGE_BOSS_FORMS = {
    paint: paint,
    paintCached: paintCached,
    ensureShell: ensureShell,
    ids: Object.keys(FORMS).map(Number),
    audit: audit,
  };
})(typeof window !== "undefined" ? window : globalThis);
