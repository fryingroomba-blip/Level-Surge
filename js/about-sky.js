(() => {
  const canvas = document.getElementById("sky");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let w = 0;
  let h = 0;

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frac(n) {
    const x = Math.sin(n * 127.1) * 43758.5453;
    return x - Math.floor(x);
  }

  function themeAt(t) {
    const pack = window.SURGE_WORLDS;
    const count = pack ? pack.count : 20;
    const hold = 9;
    const slot = Math.floor(t / hold) % count;
    const next = (slot + 1) % count;
    const fade = Math.min(1, (t % hold) / 1.4);
    const a = pack ? pack.theme(slot + 1) : null;
    const b = pack ? pack.theme(next + 1) : null;
    return { a, b, fade, slot };
  }

  function mix(c1, c2, t) {
    return [
      Math.round(c1[0] + (c2[0] - c1[0]) * t),
      Math.round(c1[1] + (c2[1] - c1[1]) * t),
      Math.round(c1[2] + (c2[2] - c1[2]) * t),
    ];
  }

  function drawNeedles(t, y0, count, hMin, hMax, speed, fill, edge, lean, seed) {
    const span = w / count;
    const shift = (t * speed) % (span * 2);
    for (let i = -2; i <= count + 3; i++) {
      const n = frac(i * 19.17 + seed);
      const x = i * span - shift;
      const hh = hMin + (hMax - hMin) * (0.4 + n * 0.6);
      const bw = 6 + n * 18;
      ctx.beginPath();
      ctx.moveTo(x - bw, y0 + 80);
      ctx.lineTo(x + lean * hh, y0 - hh);
      ctx.lineTo(x + bw, y0 + 80);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  function drawWeather(t, weather, accent) {
    const [ar, ag, ab] = accent;
    if (weather === "ember") {
      for (let i = 0; i < 36; i++) {
        const n = frac(i * 5.7);
        const x = (frac(i * 11.3) * w + t * (8 + n * 18)) % w;
        const y = h + 40 - ((t * (30 + n * 50) + n * 400) % (h + 80));
        ctx.fillStyle = `rgba(${220 + n * 35},${80 + n * 80},40,${0.35 + n * 0.35})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.2 + n * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (weather === "snow") {
      for (let i = 0; i < 60; i++) {
        const n = frac(i * 8.1);
        const x = (frac(i * 3.9) * w + Math.sin(t * 0.6 + i) * 18) % w;
        const y = (t * (18 + n * 28) + n * 900) % (h + 20);
        ctx.fillStyle = `rgba(230,240,255,${0.35 + n * 0.45})`;
        ctx.fillRect(x, y, n > 0.8 ? 3 : 1.4, n > 0.8 ? 3 : 1.4);
      }
    } else if (weather === "spores") {
      for (let i = 0; i < 28; i++) {
        const n = frac(i * 6.4);
        const x = (frac(i * 14.2) * w + Math.sin(t * 0.4 + i) * 40) % w;
        const y = (frac(i * 9.8) * h + Math.cos(t * 0.3 + i) * 24) % h;
        ctx.fillStyle = `rgba(${ar},${ag},${ab},${0.12 + n * 0.2})`;
        ctx.beginPath();
        ctx.arc(x, y, 3 + n * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (weather === "sparks") {
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 24; i++) {
        const n = frac(i * 4.4);
        const life = (t * (90 + n * 140) + n * 500) % (h + 80);
        const x = frac(i * 17.1) * w;
        ctx.strokeStyle = `rgba(255,${180 + n * 60},60,0.55)`;
        ctx.beginPath();
        ctx.moveTo(x, h - life);
        ctx.lineTo(x + (n - 0.5) * 12, h - life - 10 - n * 16);
        ctx.stroke();
      }
    } else if (weather === "rain") {
      ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.28)`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 70; i++) {
        const n = frac(i * 2.2);
        const x = (frac(i * 19) * w + t * 40) % w;
        const y = (t * (280 + n * 120) + n * 700) % (h + 30);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 4, y + 12 + n * 10);
        ctx.stroke();
      }
    } else if (weather === "static") {
      if (((t * 24) | 0) % 7 === 0) {
        ctx.fillStyle = `rgba(${ar},${ag},${ab},0.06)`;
        for (let i = 0; i < 14; i++) {
          ctx.fillRect(frac(t * 9 + i) * w, frac(t * 5 + i * 3) * h, 40 + frac(i) * 80, 2);
        }
      }
    } else {
      for (let i = 0; i < 28; i++) {
        const n = frac(i * 7.3);
        const life = (t * (22 + n * 50) + n * 800) % (h + 140);
        const x = frac(i * 21.9) * w;
        const y = h + 50 - life;
        const len = 8 + n * 22;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(0.15 + n * 0.5 + t * (0.2 + n * 0.4));
        ctx.fillStyle = `rgba(${ar},${ag},${ab},${n > 0.62 ? 0.72 : 0.38})`;
        ctx.beginPath();
        ctx.moveTo(0, -len);
        ctx.lineTo(2.4, len);
        ctx.lineTo(-2.4, len);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function frame(now) {
    const t = now / 1000;
    const pulse = Math.pow(1 - ((t * (128 / 60)) % 1), 3);
    const picked = themeAt(t);
    const skyA = (picked.a && picked.a.sky) || ["#0b1018", "#07090f", "#04050a"];
    const skyB = (picked.b && picked.b.sky) || skyA;
    const accent = mix((picked.a && picked.a.accent) || [210, 225, 255], (picked.b && picked.b.accent) || [210, 225, 255], picked.fade);
    const planetCols = (picked.a && picked.a.planet) || ["#ffffff", "#7b93bc", "#1b2433"];
    const weather = (picked.fade < 0.5 ? picked.a : picked.b);
    const weatherName = (weather && weather.weather) || "shards";
    const [ar, ag, ab] = accent;

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, picked.fade < 0.45 ? skyA[0] : skyB[0]);
    sky.addColorStop(0.42, picked.fade < 0.45 ? skyA[1] : skyB[1]);
    sky.addColorStop(1, picked.fade < 0.45 ? skyA[2] : skyB[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = `rgba(${ar},${ag},${ab},0.045)`;
    for (let b = 0; b < 3; b++) {
      const y = h * (0.16 + b * 0.1) + Math.sin(t * 0.3 + b) * 10;
      ctx.beginPath();
      ctx.ellipse(w * (0.32 + b * 0.16), y, w * 0.38, 26 + pulse * 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const cx = w * 0.78;
    const cy = h * 0.16;
    const r = Math.min(w, h) * (0.11 + pulse * 0.01);
    const corona = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r * 4.2);
    corona.addColorStop(0, `rgba(${ar},${ag},${ab},${0.22 + pulse * 0.14})`);
    corona.addColorStop(0.28, `rgba(${ar},${ag},${ab},0.08)`);
    corona.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = corona;
    ctx.fillRect(0, 0, w, h);

    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.28 + k / 3) % 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r * (1.35 + ph * 4.2), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${ar},${ag},${ab},${(1 - ph) * 0.2})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    const planet = ctx.createRadialGradient(cx - r * 0.32, cy - r * 0.38, r * 0.08, cx, cy, r);
    planet.addColorStop(0, planetCols[0]);
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

    for (let i = 0; i < 8; i++) {
      const a = t * 0.32 + i * 0.785;
      const rr = r * (1.7 + 0.4 * Math.sin(t * 0.7 + i));
      ctx.save();
      ctx.translate(cx + Math.cos(a) * rr * 1.55, cy + Math.sin(a) * rr * 0.42);
      ctx.rotate(a + 1.2);
      const len = 9 + (i % 4) * 6;
      ctx.fillStyle = `rgba(${ar},${ag},${ab},${i % 2 ? 0.55 : 0.32})`;
      ctx.beginPath();
      ctx.moveTo(0, -len);
      ctx.lineTo(2.2, len * 0.7);
      ctx.lineTo(-2.2, len * 0.7);
      ctx.fill();
      ctx.restore();
    }

    for (let i = 0; i < 70; i++) {
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (1.3 + (i % 5) * 0.4) + i));
      const x = (frac(i * 13.7) * w + t * (4 + (i % 6))) % w;
      const y = frac(i * 9.1) * h * 0.62;
      ctx.globalAlpha = tw;
      ctx.fillStyle = `rgba(${ar},${ag},${ab},0.8)`;
      ctx.fillRect(x, y, i % 11 === 0 ? 2.4 : 1.1, i % 11 === 0 ? 2.4 : 1.1);
    }
    ctx.globalAlpha = 1;

    drawWeather(t, weatherName, accent);

    const needle = (picked.a && picked.a.needle) || "#101624";
    const edge = (picked.a && picked.a.edge) || "rgba(160,190,230,0.22)";
    const floor = skyA[2];
    drawNeedles(t, h * 0.58, 13, 70, 190, 10, needle, edge, 0.08, 1.1);
    drawNeedles(t, h * 0.7, 17, 50, 140, 18, needle, edge, -0.05, 4.4);
    drawNeedles(t, h * 0.84, 21, 36, 110, 28, floor, edge, 0.04, 8.8);

    const shade = ctx.createLinearGradient(0, h * 0.35, 0, h);
    shade.addColorStop(0, "rgba(5,6,10,0)");
    shade.addColorStop(1, "rgba(5,6,10,0.55)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, h * 0.35, w, h * 0.65);

    requestAnimationFrame(frame);
  }

  fit();
  window.addEventListener("resize", fit);
  requestAnimationFrame(frame);
})();
