(() => {
  // Refined false-3D void: stable geometry, shared light, quiet depth.
  function frac(n) {
    const x = Math.sin(n * 127.1) * 43758.5453;
    return x - Math.floor(x);
  }

  function hexToRgb(hex) {
    if (!hex || hex[0] !== "#") return [16, 22, 36];
    const h = hex.length === 4
      ? hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
      : hex.slice(1);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function rgba(r, g, b, a) {
    return `rgba(${r | 0},${g | 0},${b | 0},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  }

  function shade(hex, mul, a) {
    const [r, g, b] = hexToRgb(hex);
    return rgba(r * mul, g * mul, b * mul, a == null ? 1 : a);
  }

  function mixHexAccent(hex, accent, amt, a) {
    const [r, g, b] = hexToRgb(hex);
    const [ar, ag, ab] = accent;
    return rgba(r + (ar - r) * amt, g + (ag - g) * amt, b + (ab - b) * amt, a);
  }

  function makeCam(w, h, t, trip) {
    const sway = 0.5 + trip * 0.3;
    return {
      vpX: w * 0.5 + Math.sin(t * 0.08) * (4 * sway),
      vpY: h * 0.4 + Math.cos(t * 0.06) * (2.5 * sway),
      yaw: Math.sin(t * 0.045) * (0.02 + trip * 0.025),
      focal: Math.min(w, h) * 0.95,
      near: 0.45,
      far: 8.2,
    };
  }

  function project(cam, x, y, z) {
    const zz = Math.max(0.25, z);
    const s = cam.focal / zz;
    const xr = x * Math.cos(cam.yaw) - (z - 3) * Math.sin(cam.yaw) * 0.28;
    return { x: cam.vpX + xr * s, y: cam.vpY - y * s, s, z: zz };
  }

  function fog(z, cam) {
    return Math.max(0.14, Math.min(1, (z - cam.near) / (cam.far - cam.near) * 0.82 + 0.18));
  }

  function drawHorizon(ctx, cam, w, h, t, accent, trip, light) {
    const [ar, ag, ab] = accent;

    const wash = ctx.createLinearGradient(0, cam.vpY - 8, 0, h);
    wash.addColorStop(0, rgba(ar, ag, ab, 0.035));
    wash.addColorStop(0.35, "rgba(6,8,12,0.2)");
    wash.addColorStop(1, "rgba(3,4,8,0.72)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, cam.vpY - 8, w, h - cam.vpY + 16);

    // Warm pool under the orb light.
    if (light) {
      const pool = ctx.createRadialGradient(light.x, cam.vpY + 10, 8, light.x, cam.vpY + 40, w * 0.45);
      pool.addColorStop(0, rgba(ar, ag, ab, 0.07 + light.pulse * 0.04));
      pool.addColorStop(0.45, rgba(ar, ag, ab, 0.03));
      pool.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = pool;
      ctx.fillRect(0, cam.vpY, w, h - cam.vpY);
    }

    ctx.strokeStyle = rgba(ar, ag, ab, 0.07 + trip * 0.03);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cam.vpY);
    ctx.lineTo(w, cam.vpY);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, cam.vpY, w, h - cam.vpY);
    ctx.clip();

    for (let i = -7; i <= 7; i++) {
      if (i === 0) continue;
      const a = project(cam, i * 0.7, -0.02, cam.far);
      const b = project(cam, i * 0.7, -0.02, cam.near);
      ctx.strokeStyle = rgba(ar, ag, ab, 0.02 + (1 - Math.abs(i) / 7) * 0.045);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    for (let zi = 0; zi < 10; zi++) {
      const z = cam.far - ((t * 0.28 + zi * 0.7) % (cam.far - cam.near));
      const f = fog(z, cam);
      const L = project(cam, -5.5, -0.02, z);
      const R = project(cam, 5.5, -0.02, z);
      ctx.strokeStyle = rgba(ar, ag, ab, 0.025 + f * 0.065);
      ctx.lineWidth = Math.max(0.5, 1.5 * f);
      ctx.beginPath();
      ctx.moveTo(L.x, L.y);
      ctx.lineTo(R.x, R.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSpike(ctx, cam, wx, height, width, z, fill, edge, lean, accent, light) {
    const [ar, ag, ab] = accent;
    const f = fog(z, cam);
    const tip = project(cam, wx + lean * height, height * 0.95, z);
    const bl = project(cam, wx - width, -0.02, z);
    const br = project(cam, wx + width, -0.02, z);
    const tip2 = project(cam, wx + lean * height * 0.85, height * 0.88, z + 0.16);
    const br2 = project(cam, wx + width * 0.78, -0.02, z + 0.16);
    const bl2 = project(cam, wx - width * 0.78, -0.02, z + 0.16);

    // How much this spike faces the orb light (stable, not random).
    let lit = 0.35;
    if (light) {
      const midX = (bl.x + br.x) * 0.5;
      const midY = (tip.y + bl.y) * 0.5;
      const dx = light.x - midX;
      const dy = light.y - midY;
      const dist = Math.sqrt(dx * dx + dy * dy) + 1;
      const toward = Math.max(0, dx * 0.002 + 0.35);
      lit = Math.max(0.2, Math.min(1, toward * (180 / dist) + light.pulse * 0.15));
      lit *= 0.75 + 0.25 * Math.max(0, Math.min(1, 0.5 + (light.x - midX) * 0.0015));
    }

    // Contact shadow on the ground.
    ctx.fillStyle = rgba(0, 0, 0, 0.18 + f * 0.2);
    ctx.beginPath();
    ctx.ellipse((bl.x + br.x) * 0.5, (bl.y + br.y) * 0.5 + 2, Math.abs(br.x - bl.x) * 0.7, 4 + f * 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Far side face (darker).
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(br2.x, br2.y);
    ctx.lineTo(tip2.x, tip2.y);
    ctx.closePath();
    ctx.fillStyle = shade(fill, 0.28 + f * 0.12 + lit * 0.08, 0.95);
    ctx.fill();

    // Near side face.
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.lineTo(bl2.x, bl2.y);
    ctx.lineTo(tip2.x, tip2.y);
    ctx.closePath();
    ctx.fillStyle = shade(fill, 0.38 + f * 0.14 + lit * 0.1, 0.95);
    ctx.fill();

    // Lit front face with vertical falloff + key light.
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.lineTo(br.x, br.y);
    ctx.closePath();
    const face = ctx.createLinearGradient(tip.x, tip.y, (bl.x + br.x) * 0.5, bl.y);
    face.addColorStop(0, mixHexAccent(fill, accent, 0.25 + lit * 0.35, 0.97));
    face.addColorStop(0.45, shade(fill, 0.85 + f * 0.15 + lit * 0.25, 0.96));
    face.addColorStop(1, shade(fill, 0.42 + f * 0.12, 0.96));
    ctx.fillStyle = face;
    ctx.fill();

    // Edge highlight toward the light.
    ctx.strokeStyle = rgba(ar, ag, ab, 0.08 + lit * 0.22);
    ctx.lineWidth = Math.max(0.6, 1.1 * f);
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(light && light.x < tip.x ? bl.x : br.x, light && light.x < tip.x ? bl.y : br.y);
    ctx.stroke();

    ctx.strokeStyle = edge;
    ctx.globalAlpha = 0.18 + f * 0.3;
    ctx.lineWidth = Math.max(0.5, 1 * f);
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.lineTo(br.x, br.y);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Tip specular.
    ctx.fillStyle = rgba(255, 255, 255, 0.04 + lit * 0.14 + f * 0.04);
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(tip.x * 0.55 + bl.x * 0.45, tip.y * 0.45 + bl.y * 0.55);
    ctx.lineTo(tip.x * 0.55 + br.x * 0.45, tip.y * 0.45 + br.y * 0.55);
    ctx.fill();
  }

  function drawRidges(ctx, cam, w, t, fill, edge, accent, light) {
    // Fixed world slots scroll — every spike stays; none randomly culled.
    const bands = [
      { z0: 6.6, count: 10, hMin: 0.32, hMax: 0.98, speed: 0.045, lean: 0.04 },
      { z0: 4.0, count: 12, hMin: 0.52, hMax: 1.38, speed: 0.095, lean: -0.03 },
      { z0: 2.15, count: 14, hMin: 0.78, hMax: 1.88, speed: 0.17, lean: 0.05 },
    ];
    for (let b = 0; b < bands.length; b++) {
      const band = bands[b];
      const span = 11 / band.count;
      const shift = (t * band.speed) % span;
      // Extra padding so spikes enter/exit offscreen instead of popping.
      for (let i = -3; i <= band.count + 3; i++) {
        const wx = -5.5 + i * span - shift;
        // Stable id from world cell so height never flickers as it scrolls.
        const cell = Math.floor((wx + shift) / span + 500);
        const n = frac(cell * 19.17 + b * 8.3);
        const hh = band.hMin + (band.hMax - band.hMin) * (0.42 + n * 0.58);
        const bw = 0.11 + n * 0.2;
        drawSpike(ctx, cam, wx, hh, bw, band.z0, fill, edge, band.lean, accent, light);
      }
      const y = project(cam, 0, 0.05, band.z0).y;
      const sheet = ctx.createLinearGradient(0, y - 28, 0, y + 64);
      sheet.addColorStop(0, "rgba(5,6,10,0)");
      sheet.addColorStop(0.55, `rgba(5,6,10,${0.05 + b * 0.03})`);
      sheet.addColorStop(1, "rgba(5,6,10,0)");
      ctx.fillStyle = sheet;
      ctx.fillRect(0, y - 28, w, 100);
    }
  }

  function drawPillars(ctx, cam, t, fill, edge, accent, light) {
    const [ar, ag, ab] = accent;
    for (let i = 0; i < 5; i++) {
      const n = frac(i * 4.4 + 2);
      const side = i % 2 === 0 ? -1 : 1;
      const z = 3.8 + n * 3.2;
      const wx = side * (2.6 + n * 1.8);
      const f = fog(z, cam);
      const base = project(cam, wx, -0.02, z);
      const top = project(cam, wx, 1.1 + n * 0.9, z);
      const half = 4.5 * f;
      let lit = 0.4;
      if (light) {
        const dist = Math.hypot(light.x - base.x, light.y - (top.y + base.y) * 0.5) + 1;
        lit = Math.max(0.25, Math.min(1, 140 / dist + light.pulse * 0.12));
      }
      // Ground contact shadow.
      ctx.fillStyle = rgba(0, 0, 0, 0.2 + f * 0.15);
      ctx.beginPath();
      ctx.ellipse(base.x, base.y + 1, half * 1.3, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      const g = ctx.createLinearGradient(top.x, top.y, base.x, base.y);
      g.addColorStop(0, mixHexAccent(fill, accent, 0.2 + lit * 0.25, 0.92));
      g.addColorStop(0.55, shade(fill, 0.7 + f * 0.15 + lit * 0.15, 0.92));
      g.addColorStop(1, shade(fill, 0.38 + f * 0.12, 0.92));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(base.x - half, base.y);
      ctx.lineTo(top.x - half * 0.55, top.y);
      ctx.lineTo(top.x + half * 0.55, top.y);
      ctx.lineTo(base.x + half, base.y);
      ctx.closePath();
      ctx.fill();
      // Rim
      ctx.strokeStyle = rgba(ar, ag, ab, 0.1 + lit * 0.18);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(top.x - half * 0.55, top.y);
      ctx.lineTo(base.x - half, base.y);
      ctx.stroke();
      ctx.strokeStyle = edge;
      ctx.globalAlpha = 0.18 + f * 0.28;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = rgba(ar, ag, ab, 0.1 + lit * 0.12);
      ctx.fillRect(top.x - half * 0.65, top.y - 2, half * 1.3, 3);
    }
  }

  function drawDebris(ctx, cam, t, accent, trip, light) {
    const [ar, ag, ab] = accent;
    for (let i = 0; i < 12; i++) {
      const n = frac(i * 5.9 + 1.2);
      const z = 1.6 + frac(i * 3.1) * 4.8;
      const orbit = t * (0.1 + n * 0.16) + i;
      const wx = Math.sin(orbit) * (1.4 + n * 2.8);
      const wy = 0.55 + frac(i * 7.2) * 1.4 + Math.sin(t * 0.35 + i) * 0.08;
      const p = project(cam, wx, wy, z);
      const f = fog(z, cam);
      const size = (3.5 + n * 9) * f;
      let lit = 0.45;
      if (light) {
        const dist = Math.hypot(light.x - p.x, light.y - p.y) + 1;
        lit = Math.max(0.3, Math.min(1, 160 / dist));
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(orbit * 0.6 + n);
      ctx.globalAlpha = 0.22 + f * 0.42;
      if (i % 3 === 0) {
        ctx.fillStyle = rgba(ar, ag, ab, 0.35 + lit * 0.25);
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.4, size * 0.65);
        ctx.lineTo(-size * 0.4, size * 0.65);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.4, size * 0.65);
        ctx.lineTo(size * 0.08, size * 0.15);
        ctx.fill();
      } else if (i % 3 === 1) {
        ctx.strokeStyle = rgba(ar, ag, ab, 0.3 + lit * 0.25);
        ctx.lineWidth = 1 + f * 0.6;
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.65, size * 0.24, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = rgba(ar, ag, ab, 0.28 + lit * 0.2 + trip * 0.05);
        ctx.fillRect(-size * 0.35, -size * 0.22, size * 0.7, size * 0.44);
        ctx.fillStyle = rgba(255, 255, 255, 0.08 + lit * 0.1);
        ctx.fillRect(-size * 0.35, -size * 0.22, size * 0.7, size * 0.1);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawWeather(ctx, cam, w, h, t, heat, weather, accent) {
    const [ar, ag, ab] = accent;
    const count = weather === "rain" || weather === "snow" ? 48 : 28;
    for (let i = 0; i < count; i++) {
      const n = frac(i * 6.1 + 0.7);
      let z = 1.0 + frac(i * 2.9) * 5.8;
      const fall = weather === "rain" ? 1.8 : weather === "ember" ? 0.7 : 1;
      z -= (t * (0.25 + n * 0.55) * fall) % 5.8;
      if (z < 1) z += 5.8;
      const wx = (frac(i * 11.3) - 0.5) * 9 + Math.sin(t * 0.3 + i) * 0.2;
      const wy = 0.35 + frac(i * 8.8) * 2.0;
      const p = project(cam, wx, wy, z);
      const f = fog(z, cam);
      if (p.y < -20 || p.y > h + 20 || p.x < -30 || p.x > w + 30) continue;

      if (weather === "ember") {
        ctx.fillStyle = rgba(220 + n * 30, 90 + n * 70, 40, 0.25 + f * 0.4);
        ctx.beginPath();
        ctx.arc(p.x, p.y, (1 + n * 2) * f + heat * 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (weather === "snow") {
        const sz = (1.1 + n * 1.8) * f;
        ctx.fillStyle = rgba(230, 240, 255, 0.28 + f * 0.45);
        ctx.fillRect(p.x, p.y, sz, sz);
      } else if (weather === "spores") {
        ctx.fillStyle = rgba(ar, ag, ab, 0.08 + f * 0.16);
        ctx.beginPath();
        ctx.arc(p.x, p.y, (2.5 + n * 4.5) * f, 0, Math.PI * 2);
        ctx.fill();
      } else if (weather === "sparks") {
        ctx.strokeStyle = rgba(255, 190 + n * 50, 70, 0.35 + f * 0.35);
        ctx.lineWidth = Math.max(0.7, f);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + (n - 0.5) * 8 * f, p.y - (8 + n * 12) * f);
        ctx.stroke();
      } else if (weather === "rain") {
        ctx.strokeStyle = rgba(ar, ag, ab, 0.12 + f * 0.25);
        ctx.lineWidth = Math.max(0.6, 0.9 * f);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 2.5 * f, p.y + (9 + n * 10) * f);
        ctx.stroke();
      } else if (weather === "static") {
        if (((t * 20) | 0) % 9 === 0 && i < 10) {
          ctx.fillStyle = rgba(ar, ag, ab, 0.045);
          ctx.fillRect(p.x, p.y, 24 + n * 40, 1.5);
        }
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(0.15 + n * 0.4 + t * 0.25);
        const len = (6 + n * 14) * f;
        ctx.fillStyle = rgba(ar, ag, ab, n > 0.65 ? 0.55 : 0.28);
        ctx.beginPath();
        ctx.moveTo(0, -len);
        ctx.lineTo(1.8 * f, len * 0.85);
        ctx.lineTo(-1.8 * f, len * 0.85);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawOrb(ctx, cx, cy, r, t, planetCols, accent, pulse, heat, trip) {
    const [ar, ag, ab] = accent;
    const rot = t * (0.14 + heat * 0.08);
    const lx = -0.4;
    const ly = -0.46;

    const glow = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r * 3.1);
    glow.addColorStop(0, rgba(ar, ag, ab, 0.2 + pulse * 0.12));
    glow.addColorStop(0.28, rgba(ar, ag, ab, 0.08 + heat * 0.04));
    glow.addColorStop(0.6, rgba(ar, ag, ab, 0.03));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 3.1, 0, Math.PI * 2);
    ctx.fill();

    // Soft light shafts from the orb.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 5; i++) {
      const a = -0.9 + i * 0.35 + Math.sin(t * 0.2 + i) * 0.04;
      ctx.rotate(a);
      const shaft = ctx.createLinearGradient(0, 0, 0, r * 4.5);
      shaft.addColorStop(0, rgba(ar, ag, ab, 0.07 + pulse * 0.04));
      shaft.addColorStop(0.4, rgba(ar, ag, ab, 0.02));
      shaft.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = shaft;
      ctx.beginPath();
      ctx.moveTo(-r * (0.08 + i * 0.02), 0);
      ctx.lineTo(r * (0.08 + i * 0.02), 0);
      ctx.lineTo(r * (0.35 + i * 0.08), r * 4.5);
      ctx.lineTo(-r * (0.35 + i * 0.08), r * 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-a);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();

    for (let ring = 0; ring < 2; ring++) {
      const rx = r * (1.65 + ring * 0.45 + pulse * 0.03);
      const ry = rx * (0.24 + ring * 0.04);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.32 + Math.sin(t * 0.15 + ring) * 0.05);
      ctx.strokeStyle = rgba(ar, ag, ab, 0.12 + (1 - ring) * 0.1 + pulse * 0.06);
      ctx.lineWidth = 1.1 + (1 - ring) * 0.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, rot * 0.12, rot + ring, rot + ring + Math.PI * 1.4);
      ctx.stroke();
      // Thin bright rim on the near edge of the ring.
      ctx.strokeStyle = rgba(255, 255, 255, 0.06 + pulse * 0.05);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, rot * 0.12, rot + 0.2, rot + 1.1);
      ctx.stroke();
      ctx.restore();
    }

    if (trip > 0.45) {
      const split = 0.9 + trip * 1.4;
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx - split, cy, r * 1.015, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(255, 70, 100, 0.05 + trip * 0.06);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + split, cy, r * 1.015, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(70, 190, 255, 0.05 + trip * 0.06);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    }

    const body = ctx.createRadialGradient(cx + lx * r, cy + ly * r, r * 0.05, cx, cy, r);
    body.addColorStop(0, planetCols[0]);
    body.addColorStop(0.3, planetCols[0]);
    body.addColorStop(0.68, planetCols[1]);
    body.addColorStop(1, planetCols[2]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = rgba(ar, ag, ab, 0.1);
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      const lat = i * 0.32 + Math.sin(rot * 0.5 + i) * 0.02;
      const yy = cy + Math.sin(lat) * r * 0.9;
      const rx = Math.cos(lat) * r * 0.96;
      const ry = Math.max(1.5, Math.cos(lat) * r * 0.18);
      if (rx < 5) continue;
      ctx.beginPath();
      ctx.ellipse(cx, yy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const bend = Math.sin(rot * 0.8 + i * 0.9);
      ctx.strokeStyle = rgba(ar, ag, ab, 0.06 + Math.abs(bend) * 0.08);
      ctx.beginPath();
      for (let s = 0; s <= 16; s++) {
        const lat = -1.05 + (2.1 * s) / 16;
        const yy = cy + Math.sin(lat) * r * 0.9;
        const rr = Math.cos(lat) * r * 0.96;
        const xx = cx + bend * rr * 0.82;
        if (s === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }

    for (let i = 0; i < 8; i++) {
      const n = frac(i * 4.13 + 2.2);
      const a = rot * 0.55 + n * Math.PI * 2;
      const d = (0.2 + frac(i * 9.1) * 0.55) * r;
      const px = cx + Math.cos(a) * d * 0.8 + lx * r * 0.08;
      const py = cy + Math.sin(a) * d * 0.5 + ly * r * 0.06;
      const pr = (0.12 + n * 0.2) * r;
      const g = ctx.createRadialGradient(px - pr * 0.25, py - pr * 0.25, 0, px, py, pr);
      g.addColorStop(0, rgba(ar, ag, ab, 0.1 + n * 0.06));
      g.addColorStop(0.55, rgba(ar * 0.35, ag * 0.35, ab * 0.45, 0.12 + n * 0.08));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * (0.5 + n * 0.3), a, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 5; i++) {
      const n = frac(i * 7.7 + 0.4);
      const a = -rot * 0.4 + n * Math.PI * 2;
      const d = (0.25 + frac(i * 3.3) * 0.45) * r;
      const px = cx + Math.cos(a) * d;
      const py = cy + Math.sin(a) * d * 0.58;
      const pr = (0.045 + n * 0.07) * r;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = rgba(8, 10, 16, 0.2 + n * 0.18);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px - pr * 0.22, py - pr * 0.22, pr * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = rgba(ar, ag, ab, 0.1);
      ctx.fill();
    }

    const term = ctx.createRadialGradient(cx - lx * r * 0.85, cy - ly * r * 0.85, r * 0.15, cx, cy, r * 1.05);
    term.addColorStop(0, "rgba(0,0,0,0)");
    term.addColorStop(0.5, "rgba(0,0,0,0.06)");
    term.addColorStop(1, "rgba(4,6,12,0.52)");
    ctx.fillStyle = term;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    const spec = ctx.createRadialGradient(cx + lx * r * 0.5, cy + ly * r * 0.5, 0, cx + lx * r * 0.15, cy + ly * r * 0.15, r * 0.5);
    spec.addColorStop(0, rgba(255, 255, 255, 0.5 + pulse * 0.18));
    spec.addColorStop(0.22, rgba(ar, ag, ab, 0.18));
    spec.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = spec;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const rim = ctx.createRadialGradient(cx, cy, r * 0.84, cx, cy, r * 1.08);
    rim.addColorStop(0, "rgba(0,0,0,0)");
    rim.addColorStop(0.72, rgba(ar, ag, ab, 0));
    rim.addColorStop(1, rgba(ar, ag, ab, 0.32 + pulse * 0.16));
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = rgba(ar, ag, ab, 0.2 + pulse * 0.12);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.015, 0, Math.PI * 2);
    ctx.stroke();

    const moonA = t * 0.42;
    const mx = cx + Math.cos(moonA) * r * 1.72;
    const my = cy + Math.sin(moonA) * r * 0.48;
    const mr = r * 0.12;
    // Moon cast glow on void.
    ctx.fillStyle = rgba(ar, ag, ab, 0.04);
    ctx.beginPath();
    ctx.arc(mx, my, mr * 2.2, 0, Math.PI * 2);
    ctx.fill();
    const moon = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.35, 0, mx, my, mr);
    moon.addColorStop(0, planetCols[0]);
    moon.addColorStop(0.65, planetCols[1]);
    moon.addColorStop(1, planetCols[2]);
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fillStyle = moon;
    ctx.fill();
    ctx.fillStyle = "rgba(6,8,14,0.32)";
    ctx.beginPath();
    ctx.arc(mx + mr * 0.18, my + mr * 0.12, mr * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStars(ctx, cam, w, h, t, accent) {
    const [ar, ag, ab] = accent;
    for (let i = 0; i < 90; i++) {
      const n = frac(i * 13.7);
      const z = 4.2 + frac(i * 2.2) * 4.5;
      const p = project(cam, (frac(i * 17.3) - 0.5) * 14, 0.7 + frac(i * 9.1) * 2.8, z);
      const f = fog(z, cam);
      const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * (1 + (i % 4) * 0.3) + i));
      const sz = (0.7 + n * 1.6) * f * (i % 15 === 0 ? 1.7 : 1);
      ctx.globalAlpha = tw * (0.25 + f * 0.5);
      ctx.fillStyle = i % 11 === 0 ? rgba(ar, ag, ab, 1) : "#e4eaf4";
      ctx.fillRect(p.x, p.y, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  function drawNebula(ctx, cam, t, accent, pulse, trip) {
    const [ar, ag, ab] = accent;
    for (let b = 0; b < 4; b++) {
      const n = frac(b * 2.7 + 1);
      const z = 5.8 + n * 2;
      const p = project(cam, (b - 1.5) * 1.6 + Math.sin(t * 0.1 + b) * 0.3, 1.2 + n * 0.7, z);
      const f = fog(z, cam);
      const rx = (90 + n * 100) * f * (1 + trip * 0.15);
      const ry = (16 + pulse * 6 + n * 18) * f;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rx);
      g.addColorStop(0, rgba(ar, ag, ab, 0.05 + pulse * 0.035 + trip * 0.025));
      g.addColorStop(0.5, rgba(ar * 0.55, ag * 0.45, ab * 0.75, 0.025 + n * 0.02));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, ry, Math.sin(t * 0.08 + b) * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw(opts) {
    const ctx = opts.ctx;
    const w = opts.w;
    const h = opts.h;
    const t = opts.t;
    const th = opts.theme || {};
    const pulse = opts.pulse || 0;
    const heat = opts.heat || 0;
    const trip = opts.trip == null ? 0.55 : opts.trip;
    const skyCols = th.sky || ["#0b1018", "#07090f", "#04050a"];
    const planetCols = th.planet || ["#ffffff", "#7b93bc", "#1b2433"];
    const accent = th.accent || [210, 225, 255];
    const [ar, ag, ab] = accent;
    const cam = makeCam(w, h, t, trip);
    const needle = th.needle || "#101624";
    const edge = th.edge || "rgba(160,190,230,0.18)";

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, skyCols[0]);
    sky.addColorStop(0.42, skyCols[1]);
    sky.addColorStop(1, skyCols[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const well = ctx.createRadialGradient(cam.vpX, cam.vpY * 0.85, h * 0.12, w * 0.5, h * 0.55, h);
    well.addColorStop(0, "rgba(0,0,0,0)");
    well.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = well;
    ctx.fillRect(0, 0, w, h);

    // Place the light early so ground/ridges can use it.
    const orbZ = 5.4;
    const orb = project(cam, 2.2, 1.5, orbZ);
    const r = Math.min(w, h) * (0.105 + pulse * 0.01) * (0.75 + fog(orbZ, cam) * 0.55);
    const cx = orb.x;
    const cy = orb.y;
    const light = { x: cx, y: cy, pulse, r };

    drawNebula(ctx, cam, t, accent, pulse, trip);
    drawStars(ctx, cam, w, h, t, accent);
    drawHorizon(ctx, cam, w, h, t, accent, trip, light);
    drawPillars(ctx, cam, t, needle, edge, accent, light);

    for (let k = 0; k < 2; k++) {
      const ph = (t * 0.18 + k / 2) % 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r * (1.25 + ph * 3.8), 0, Math.PI * 2);
      ctx.strokeStyle = rgba(ar, ag, ab, (1 - ph) * (0.1 + pulse * 0.08));
      ctx.lineWidth = 1 + pulse * 0.5;
      ctx.stroke();
    }
    drawOrb(ctx, cx, cy, r, t, planetCols, accent, pulse, heat, trip);

    drawRidges(ctx, cam, w, t, needle, edge, accent, light);
    drawDebris(ctx, cam, t, accent, trip, light);
    drawWeather(ctx, cam, w, h, t, heat, th.weather || "shards", accent);

    for (let i = 0; i < 6; i++) {
      const a = t * 0.28 + i * 1.05;
      const rr = r * (1.55 + 0.35 * Math.sin(t * 0.5 + i));
      ctx.save();
      ctx.translate(cx + Math.cos(a) * rr * 1.45, cy + Math.sin(a) * rr * 0.38);
      ctx.rotate(a + 1.0);
      const len = 6 + (i % 3) * 5;
      ctx.fillStyle = rgba(ar, ag, ab, i % 2 ? 0.45 : 0.25);
      ctx.beginPath();
      ctx.moveTo(0, -len);
      ctx.lineTo(2, len * 0.65);
      ctx.lineTo(-2, len * 0.65);
      ctx.fill();
      ctx.restore();
    }

    if (opts.floorShade !== false) {
      const shadeG = ctx.createLinearGradient(0, h * 0.8, 0, h);
      shadeG.addColorStop(0, "rgba(8,10,16,0)");
      shadeG.addColorStop(0.5, "rgba(8,10,16,0.28)");
      shadeG.addColorStop(1, "rgba(8,10,16,0.68)");
      ctx.fillStyle = shadeG;
      ctx.fillRect(0, h * 0.8, w, h * 0.2);
    }

    if (opts.bolt !== false) {
      const bolt = (t * 0.16) % 14;
      if (bolt > 13.78) {
        const a = (bolt - 13.78) / 0.22;
        ctx.fillStyle = rgba(ar, ag, ab, 0.1 * (1 - a));
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = rgba(255, 255, 255, 0.5 * (1 - a));
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let bx = w * (0.4 + frac(Math.floor(t * 2)) * 0.3);
        let by = 0;
        ctx.moveTo(bx, by);
        for (let k = 0; k < 5; k++) {
          bx += (frac(t * 8 + k) - 0.5) * 55;
          by += h * 0.05 + k * 5;
          ctx.lineTo(bx, by);
        }
        ctx.lineTo(cx, cy);
        ctx.stroke();
      }
    }

    if (pulse > 0.6) {
      ctx.fillStyle = rgba(ar, ag, ab, (pulse - 0.6) * 0.08);
      ctx.fillRect(0, 0, w, h);
    }

    if (trip > 0.5) {
      const wash = ctx.createLinearGradient(0, 0, w, h);
      wash.addColorStop(0, rgba(ar, 50, 80, 0.02 + trip * 0.02));
      wash.addColorStop(0.5, "rgba(0,0,0,0)");
      wash.addColorStop(1, rgba(50, ag, ab, 0.02 + trip * 0.02));
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, h);
    }
  }

  window.SURGE_VOID = { draw, frac, hexToRgb };
})();
