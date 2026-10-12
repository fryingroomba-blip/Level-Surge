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

  function mix(c1, c2, t) {
    return [
      Math.round(c1[0] + (c2[0] - c1[0]) * t),
      Math.round(c1[1] + (c2[1] - c1[1]) * t),
      Math.round(c1[2] + (c2[2] - c1[2]) * t),
    ];
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

  function frame(now) {
    const t = now / 1000;
    const pulse = Math.pow(1 - ((t * (128 / 60)) % 1), 3);
    const picked = themeAt(t);
    const a = picked.a || {};
    const b = picked.b || a;
    const fade = picked.fade;
    const accent = mix(a.accent || [210, 225, 255], b.accent || [210, 225, 255], fade);
    const theme = {
      sky: fade < 0.45 ? (a.sky || ["#0b1018", "#07090f", "#04050a"]) : (b.sky || a.sky),
      planet: fade < 0.45 ? (a.planet || ["#ffffff", "#7b93bc", "#1b2433"]) : (b.planet || a.planet),
      accent,
      needle: a.needle || "#101624",
      edge: a.edge || "rgba(160,190,230,0.22)",
      weather: (fade < 0.5 ? a.weather : b.weather) || "shards",
    };

    if (window.SURGE_VOID && window.SURGE_VOID.draw) {
      // About page leans harder into the trip — bigger mood, slower dread.
      window.SURGE_VOID.draw({
        ctx, w, h, t, theme, pulse, heat: 0.22 + pulse * 0.3, trip: 0.62,
        floorShade: false, bolt: true,
      });
      const shade = ctx.createLinearGradient(0, h * 0.35, 0, h);
      shade.addColorStop(0, "rgba(5,6,10,0)");
      shade.addColorStop(1, "rgba(5,6,10,0.62)");
      ctx.fillStyle = shade;
      ctx.fillRect(0, h * 0.35, w, h * 0.65);
    } else {
      ctx.fillStyle = "#05060a";
      ctx.fillRect(0, 0, w, h);
    }

    requestAnimationFrame(frame);
  }

  fit();
  window.addEventListener("resize", fit);
  requestAnimationFrame(frame);
})();
