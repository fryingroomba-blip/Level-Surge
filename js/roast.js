(function (root) {
  const DUR = 10;

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function inv(a, b, x) { return clamp01((b === a ? 1 : (x - a) / (b - a))); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - (1 - t) * (1 - t); }
  function easeIn(t) { return t * t; }
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  function crossed(s, t) { return s.tPrev < t && s.t >= t; }
  function pick(arr, seed) { return arr[Math.abs(seed | 0) % arr.length]; }
  function wobble(t, amp, spd) { return Math.sin(t * spd) * amp; }

  function u(W, H, px) {
    return Math.max(8, px * Math.min(W / 960, H / 540));
  }
  function font(ctx, px, heavy) {
    ctx.font = `${heavy ? 900 : 800} ${Math.round(px)}px ${heavy ? "Bungee, " : ""}Rubik, sans-serif`;
  }

  function stamp(ctx, text, x, y, size, rot, color, a) {
    ctx.save();
    ctx.globalAlpha = a == null ? 1 : a;
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    font(ctx, size, true);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = color || "#e31b1b";
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function outlineStamp(ctx, text, x, y, size, rot, fill, a) {
    ctx.save();
    ctx.globalAlpha = a == null ? 1 : a;
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    font(ctx, size, true);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = Math.max(6, size * 0.12);
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = fill || "#f4ead8";
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function panel(ctx, x, y, w, h, a) {
    ctx.save();
    ctx.globalAlpha = a == null ? 1 : a;
    ctx.fillStyle = "rgba(8,6,10,0.88)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#f4ead8";
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    ctx.strokeStyle = "#e31b1b";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 8, y + 8, w - 16, h - 16);
    ctx.restore();
  }

  function bar(ctx, x, y, w, h, p, label, a) {
    ctx.save();
    ctx.globalAlpha = a == null ? 1 : a;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#e31b1b";
    ctx.fillRect(x + 3, y + 3, Math.max(0, (w - 6) * clamp01(p)), h - 6);
    ctx.strokeStyle = "#f4ead8";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    if (label) {
      font(ctx, Math.max(11, h * 0.55), false);
      ctx.fillStyle = "#f4ead8";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    }
    ctx.restore();
  }

  function letterbox(ctx, W, H, amt) {
    if (amt <= 0) return;
    const h = H * 0.11 * amt;
    const g1 = ctx.createLinearGradient(0, 0, 0, h);
    g1.addColorStop(0, "#000");
    g1.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, h * 0.72);
    ctx.fillStyle = g1;
    ctx.fillRect(0, h * 0.55, W, h * 0.55);
    const g2 = ctx.createLinearGradient(0, H - h, 0, H);
    g2.addColorStop(0, "rgba(0,0,0,0)");
    g2.addColorStop(1, "#000");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, H - h * 0.72, W, h * 0.72);
    ctx.fillStyle = g2;
    ctx.fillRect(0, H - h, W, h * 0.5);
  }

  function drawCorpse(ctx, s, api) {
    const { player, drawDevilBody } = api;
    ctx.save();
    ctx.translate(s.x + player.w / 2, s.y + player.h + 2);
    ctx.scale(1, 0.28);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if ((s.spinBlur || 0) > 0.18) {
      const rot = s.rot;
      ctx.save();
      ctx.globalAlpha = 0.18 * s.spinBlur;
      s.rot = rot - 0.55;
      ctx.translate(s.x + player.w / 2, s.y + player.h / 2);
      ctx.rotate(s.rot);
      ctx.scale(s.scaleX, s.scaleY);
      drawDevilBody(-player.w / 2, -player.h / 2, s.facing, 1, s.squash, s.pose || { gait: 0, air: true, blink: false });
      ctx.restore();
      s.rot = rot;
    }
    ctx.save();
    ctx.translate(s.x + player.w / 2, s.y + player.h / 2);
    ctx.rotate(s.rot);
    ctx.scale(s.scaleX, s.scaleY);
    drawDevilBody(-player.w / 2, -player.h / 2, s.facing, s.alpha, s.squash, s.pose || {
      gait: 0, air: true, blink: s.t % 0.5 < 0.12,
    });
    ctx.restore();
  }

  function puff(api, s, color, n, spd) {
    api.burst(s.x + 12, s.y + 14, color, n, spd);
  }

  const LINES = {
    spike: ["YOU SAW THE SPIKES", "THOSE WERE NOT DECORATION", "YOU WALKED ON PURPOSE", "FEET 1  ·  BRAIN 0"],
    ceiling: ["THAT JUMP WAS OPTIONAL", "THE CEILING WAS A HINT", "YOU JUMPED INTO THAT", "GRAVITY WAS HELPING"],
    jumpspike: ["YOU AIMED AT THE SPIKES", "THAT LANDING. WOW.", "THE FLOOR WAS SPIKES", "PARKOUR GRADE: SEE ME"],
    saw: ["IT WAS SPINNING AT YOU", "THE SAW WAS NOT A HUG", "YOU WALKED INTO A BLADE", "IT SPINS. YOU DON'T."],
    laser: ["THE RED LINE WAS A HINT", "GLOWING MEANS DON'T", "YOU TOUCHED THE OBVIOUS", "LASERS ARE NOT A DARE"],
    hole: ["THERE WAS NO FLOOR", "YOU FELL IN THE OBVIOUS", "AIR IS NOT A PLATFORM", "THE GAP WAS THE HINT"],
    jumpfall: ["YOU JUMPED INTO NOTHING", "THAT JUMP HAD NO LANDING", "THE GAP WAS A GAP", "AIR TIME IS NOT A PLAN"],
    teeth: ["YOU TRUSTED THE FAKE FLOOR", "IT LOOKED SOLID. IT LIED.", "YOU FOUND THE TEETH", "THE FLOOR FOOLED YOU"],
    greed: ["YOU TOOK THE BAIT", "SHINY WON. YOU DIDN'T.", "THE COINS WERE THE TRAP", "GREED SPEEDRUN: SUCCESS"],
    brick: ["A BRICK OUTPLAYED YOU", "HEAD VS BRICK. BRICK.", "YOU STOOD UNDER THAT", "THE BRICK HAD TIMING"],
    fake: ["YOU BELIEVED THE FAKE", "WRONG DOOR. COME ON.", "THE OTHER ONE WAS REAL", "THAT DOOR WAS LYING"],
    reverse: ["LEFT WAS RIGHT. MISS THAT?", "YOU DIDN'T NOTICE THE FLIP", "YOU WALKED THE WRONG WAY", "BACKWARDS. STILL WRONG."],
    still: ["STANDING IS NOT A PLAN", "THE LEVEL ASKED YOU TO MOVE", "AFK WAS THE TRAP", "MOSS ON YOUR SKILL"],
    jump: ["YOU DIDN'T NEED TO JUMP", "WALKING WAS LEGAL", "THAT JUMP WAS THE TRAP", "THE GROUND WAS RIGHT THERE"],
    generic: ["THAT WAS ON YOU", "SKILL ISSUE", "THE LEVEL ISN'T THE PROBLEM", "TRY LOOKING NEXT TIME"],
  };

  function impact(s, api, power) {
    const p = power || 0.4;
    s.flash = Math.max(s.flash || 0, Math.min(1, p));
    s.punch = Math.max(s.punch || 0, p * 14);
    if (api.world) {
      api.world.shake = Math.max(api.world.shake || 0, p * 14);
      api.world.chromatic = Math.max(api.world.chromatic || 0, p * 0.28);
    }
  }

  const HIT = {
    spike: 1, die: 0.95, fail: 0.62, saw: 0.55, crumble: 0.48,
    glitch: 0.7, land: 0.32, trombone: 0.4, laugh: 0.18,
    fanfare: 0.22, jump: 0.2, reverse: 0.28, slot: 0.34, coin: 0.12,
  };

  function TICK(s, api) {
    const t = s.t;
    const pool = POOL[s.kind] || POOL.generic;
    if (s.var == null) s.var = (Math.random() * pool.length) | 0;
    const real = api.audio;
    api.audio = {
      play(name) {
        if (real && real.play) real.play(name);
        const w = HIT[name];
        if (w) impact(s, api, w);
      },
    };
    const fn = pool[s.var] || pool[0];
    fn(s, api, t);
    api.audio = real;
    if (s.caption !== s._cap) {
      s._cap = s.caption;
      s.capIn = 0;
    }
    s.capIn = Math.min(1, (s.capIn || 0) + api.FIXED * 5.5);
    const px = s._px == null ? s.x : s._px;
    const py = s._py == null ? s.y : s._py;
    s.speed = Math.hypot(s.x - px, s.y - py);
    s._px = s.x;
    s._py = s.y;
    s.flash = Math.max(0, (s.flash || 0) - api.FIXED * 1.7);
    s.punch = (s.punch || 0) * 0.84;
    if (t > 9.72) s.black = inv(9.72, 10, t);
  }

  function beat(s, api, t, steps) {
    let active = steps[0];
    let idx = 0;
    for (let i = 0; i < steps.length; i++) {
      if (t >= steps[i].t) { active = steps[i]; idx = i; }
      if (steps[i].sfx && crossed(s, steps[i].t + 0.02)) api.audio.play(steps[i].sfx);
    }
    const end = idx + 1 < steps.length ? steps[idx + 1].t : 10;
    const u = inv(active.t, end, t);
    if (active.cap != null) s.caption = active.cap;
    if (active.sub != null) s.sub = active.sub;
    if (active.go) active.go(s, api, u, t);
  }

  const POSE = {
    spike(s, api, t) {
      s.letterbox = 1;
      if (t < 0.9) {
        s.zoom = lerp(1.2, 2.1, easeOut(inv(0, 0.9, t)));
        s.camY = lerp(0, 18, inv(0, 0.9, t));
        s.squash = 0.4;
        s.circle = { r: lerp(48, 22, inv(0, 0.9, t)), pulse: true };
        s.caption = "HOLD IT.";
        s.sub = "LET'S REVIEW THE FEET";
      } else if (t < 2.3) {
        const u = inv(0.9, 2.3, t);
        s.y = s.y0 - easeOut(u) * 42;
        s.zoom = 1.7;
        s.squash = lerp(0.4, -0.2, u);
        s.caption = "WAIT";
        s.sub = "YOU CAN STILL... NO.";
        if (crossed(s, 0.95)) api.audio.play("jump");
      } else if (t < 4.6) {
        const u = inv(2.3, 4.6, t);
        s.y = s.y0 - 42 + easeIn(u) * 70;
        s.kebab = easeIn(u);
        s.squash = lerp(-0.2, 0.85, u);
        s.scaleY = lerp(1, 1.35, u);
        s.scaleX = lerp(1, 0.72, u);
        s.zoom = lerp(1.7, 1.35, u);
        s.caption = "SLOW KEBAB";
        s.sub = "YOUR IDEA. THEIR SPIKES.";
        if (crossed(s, 2.4)) api.audio.play("spike");
        if (crossed(s, 3.6)) puff(api, s, "#e31b1b", 14, 4);
      } else if (t < 7) {
        const u = inv(4.6, 7, t);
        s.rot = wobble(t, 0.12, 7);
        s.camRot = wobble(t, 0.04, 3);
        s.menu = easeOut(u);
        s.kebab = 1;
        s.caption = "";
        s.sub = "";
        if (crossed(s, 4.7)) api.audio.play("fanfare");
      } else if (t < 8.7) {
        s.tip = inv(7, 8.7, t);
        s.menu = 1;
        s.caption = "PRO TIP";
        s.sub = "THE SHARP ONES. REMEMBER?";
        if (crossed(s, 7.05)) api.audio.play("laugh");
      } else {
        const u = inv(8.7, 10, t);
        s.y -= 8;
        s.rot += 0.35;
        s.vx = 6;
        s.x += 4;
        s.scaleY = lerp(1.35, 0.2, u);
        s.caption = s.insult;
        s.sub = "";
        if (crossed(s, 8.75)) puff(api, s, "#ffd24a", 18, 6);
      }
    },

    ceiling(s, api, t) {
      s.letterbox = 1;
      if (t < 1.1) {
        s.y = s.y0 - 8;
        s.scaleY = 1.15;
        s.squash = -0.3;
        s.zoom = lerp(1.1, 1.6, inv(0, 1.1, t));
        s.hang = 1;
        s.caption = "PIÑATA PROTOCOL";
        s.sub = "YOU ARE THE PIÑATA";
      } else if (t < 3.8) {
        const u = inv(1.1, 3.8, t);
        s.rot = Math.sin(t * 5.2) * 0.55;
        s.x = s.x0 + Math.sin(t * 5.2) * 22;
        s.y = s.y0 - 8 + Math.abs(Math.cos(t * 5.2)) * 6;
        s.hits = Math.floor(u * 8);
        s.caption = "HIT THE DEMON";
        s.sub = `${s.hits} HITS · STILL STUCK`;
        if (crossed(s, 1.3) || crossed(s, 1.9) || crossed(s, 2.5) || crossed(s, 3.2)) {
          api.audio.play("land");
          puff(api, s, "#f4ead8", 6, 3);
        }
      } else if (t < 5.8) {
        const u = inv(3.8, 5.8, t);
        s.hang = 1 - u;
        s.y = s.y0 - 8 + easeIn(u) * 90;
        s.rot = lerp(s.rot, 0.2, u);
        s.caption = "THAT JUMP WAS OPTIONAL";
        s.sub = "GRAVITY WAS HELPING";
        if (crossed(s, 3.85)) api.audio.play("jump");
      } else if (t < 7.6) {
        const u = inv(5.8, 7.6, t);
        if (u < 0.15) s.squash = 0.9;
        else s.squash = lerp(0.9, 0.2, inv(0.15, 1, u));
        s.y = s.y0 + 62;
        s.floorSpikes = easeOut(u);
        s.caption = "THE FLOOR ALSO SAID NO";
        s.sub = "";
        if (crossed(s, 5.85)) { api.audio.play("spike"); puff(api, s, "#e31b1b", 16, 5); }
      } else {
        s.scorecard = inv(7.6, 10, t);
        s.caption = "";
        s.sub = "";
        s.y = s.y0 + 62;
        if (crossed(s, 7.7)) api.audio.play("fail");
      }
    },

    jumpspike(s, api, t) {
      s.letterbox = 1;
      if (t < 2.2) {
        const u = inv(0, 2.2, t);
        s.y = s.y0 - easeOut(u) * 70;
        s.replay = 1;
        s.zoom = lerp(1.2, 1.55, u);
        s.caption = "INSTANT REPLAY";
        s.sub = "THE LANDING · 0.25×";
        s.pose = { gait: 0, air: true, blink: false };
        if (crossed(s, 0.1)) api.audio.play("reverse");
      } else if (t < 4.6) {
        const u = inv(2.2, 4.6, t);
        s.y = s.y0 - 70 + easeIn(u) * 78;
        s.rot = u * 0.4;
        s.trail = 1;
        s.caption = "SLOW-MO";
        s.sub = "YOU AIMED AT THESE";
        if (crossed(s, 4.4)) { api.audio.play("spike"); puff(api, s, "#e31b1b", 20, 5); }
      } else if (t < 7.1) {
        s.y = s.y0 + 8;
        s.squash = 0.7;
        s.circle = { r: 40 + Math.sin(t * 8) * 4, pulse: true };
        s.zoom = 2.0;
        s.caption = "LANDING TECHNIQUE";
        s.sub = "GRADE: PLEASE STOP";
        if (crossed(s, 4.7)) api.audio.play("laugh");
      } else {
        s.judges = inv(7.1, 10, t);
        s.caption = s.insult;
        s.sub = "0.0  ·  0.0  ·  0.0";
        if (crossed(s, 7.2)) api.audio.play("fail");
        if (crossed(s, 8.4)) api.audio.play("trombone");
      }
    },

    saw(s, api, t) {
      s.letterbox = 0.6;
      const sx = s.sawX;
      const sy = s.sawY;
      if (t < 1.2) {
        const u = easeIn(inv(0, 1.2, t));
        s.x = lerp(s.x0, sx - 10, u);
        s.y = lerp(s.y0, sy - 10, u);
        s.zoom = lerp(1.15, 1.8, u);
        s.caption = "MAGNETIZED";
        s.sub = "TO THE OBVIOUS BLADE";
        if (crossed(s, 0.2)) api.audio.play("saw");
      } else if (t < 5.2) {
        const u = inv(1.2, 5.2, t);
        const ang = u * Math.PI * 8 * (s.seed % 2 ? 1 : -1);
        s.rot = ang;
        s.x = sx + Math.cos(ang) * 18;
        s.y = sy + Math.sin(ang) * 18;
        s.scaleX = lerp(1, 0.4, u);
        s.scaleY = lerp(1, 1.6, u);
        s.camRot = ang * 0.35;
        s.zoom = 1.9;
        s.spinBlur = u;
        s.caption = "BLADE CYCLE";
        s.sub = `${Math.floor(u * 794)} RPM`;
        if (crossed(s, 1.3) || crossed(s, 2.5) || crossed(s, 3.8)) api.audio.play("saw");
      } else if (t < 7.8) {
        s.camRot *= 0.85;
        s.card = easeOut(inv(5.2, 7.8, t));
        s.x = sx;
        s.y = sy;
        s.scaleX = 0.45;
        s.scaleY = 1.5;
        s.rot += 0.2;
        s.caption = "";
        s.sub = "";
        if (crossed(s, 5.3)) api.audio.play("coin");
      } else {
        const u = inv(7.8, 10, t);
        s.camRot = 0;
        s.scaleX = lerp(0.45, 1.8, easeOut(u));
        s.scaleY = lerp(1.5, 0.25, easeOut(u));
        s.rot = 0;
        s.y = s.y0 + 8;
        s.x = s.x0;
        s.caption = s.insult;
        s.sub = "IT SPINS. YOU WALKED IN.";
        if (crossed(s, 7.9)) { api.audio.play("fail"); puff(api, s, "#ece8e1", 22, 5); }
      }
    },

    laser(s, api, t) {
      s.letterbox = 1;
      if (t < 1.15) {
        s.zoom = lerp(1.2, 2.0, easeOut(inv(0, 1.15, t)));
        s.beamHold = 1;
        s.caption = "DIAGNOSIS IN PROGRESS";
        s.sub = "THE RED LINE WAS A HINT";
        if (crossed(s, 0.15)) api.audio.play("spike");
      } else if (t < 4.6) {
        const u = inv(1.15, 4.6, t);
        s.split = easeOut(u) * 28;
        s.halves = 1;
        s.pose = { gait: Math.sin(t * 8), air: false, blink: false };
        s.caption = "BILATERAL DEMON";
        s.sub = "BOTH HALVES CHOSE THIS";
        if (crossed(s, 1.2)) puff(api, s, "#ffe0e0", 12, 4);
      } else if (t < 8) {
        s.split = 28 + Math.sin(t * 3) * 3;
        s.halves = 1;
        s.report = inv(4.6, 8, t);
        s.caption = "";
        if (crossed(s, 4.7)) api.audio.play("type");
      } else {
        const u = inv(8, 10, t);
        s.split = lerp(28, 0, u);
        s.scaleY = lerp(1, 0.35, u);
        s.squash = u;
        s.report = 1;
        s.caption = s.insult;
        if (crossed(s, 8.1)) api.audio.play("fail");
      }
    },

    hole(s, api, t) {
      s.letterbox = 0.4;
      if (t < 6.2) {
        s.y += 3.4 + t * 0.15;
        s.rot = Math.sin(t * 4) * 0.25;
        s.pose = { gait: 0, air: true, blink: t % 0.4 < 0.1 };
        s.fallLoop = t;
        s.zoom = 1.35;
        const floor = Math.floor(t * 1.7) + 1;
        s.caption = `FLOOR −${floor}`;
        s.sub = floor > 6 ? "OUT OF SERVICE" : "STILL GOING";
        if (crossed(s, 1) || crossed(s, 2.2) || crossed(s, 3.5) || crossed(s, 5)) {
          api.audio.play("crumble");
        }
      } else if (t < 8.3) {
        s.hotel = inv(6.2, 8.3, t);
        s.y += 1.2;
        s.caption = "WELCOME TO THE FLOOR";
        s.sub = "NO VACANCY · YOU ARE THE VACANCY";
        if (crossed(s, 6.3)) api.audio.play("fanfare");
      } else {
        const u = inv(8.3, 10, t);
        s.scaleY = lerp(1, 0.2, easeIn(u));
        s.scaleX = lerp(1, 1.7, easeIn(u));
        s.squash = 1;
        s.caption = s.insult;
        s.sub = "AIR IS NOT A PLATFORM";
        if (crossed(s, 8.4)) { api.audio.play("die"); puff(api, s, "#c4b8a8", 24, 6); }
      }
    },

    jumpfall(s, api, t) {
      s.letterbox = 1;
      if (t < 2.6) {
        const u = inv(0, 2.6, t);
        s.x = s.x0 - 40 + u * 40;
        s.y = s.y0 + 20 - Math.sin(u * Math.PI) * 80;
        s.replay = 1;
        s.arc = u;
        s.pose = { gait: 0, air: true, blink: false };
        s.caption = "JUMP RECONSTRUCTION";
        s.sub = "NOBODY ASKED FOR THAT";
        if (crossed(s, 0.15)) api.audio.play("jump");
      } else if (t < 5.2) {
        s.y = s.y0 + 20 - 80;
        s.circle = { r: 36, pulse: true };
        s.zoom = 1.85;
        s.caption = "THE GAP WAS A GAP";
        s.sub = "AIR TIME: POINTLESS";
        if (crossed(s, 2.7)) api.audio.play("laugh");
      } else if (t < 7.6) {
        const u = inv(5.2, 7.6, t);
        s.flag = 1;
        s.flagY = lerp(-20, 110, easeIn(u));
        s.y = s.y0 - 40 + u * 30;
        s.caption = "CHECKPOINT";
        s.sub = "LOL NO";
        if (crossed(s, 5.3)) api.audio.play("coin");
        if (crossed(s, 6.4)) api.audio.play("crumble");
      } else {
        const u = inv(7.6, 10, t);
        s.y += 5;
        s.rot += 0.12;
        s.caption = s.insult;
        s.sub = "JUMPING INTO NOTHING";
        s.zoom = lerp(1.4, 1.1, u);
        if (crossed(s, 7.7)) api.audio.play("fail");
      }
    },

    teeth(s, api, t) {
      s.letterbox = 0.8;
      if (t < 1.6) {
        const u = inv(0, 1.6, t);
        s.jaw = easeOut(u);
        s.zoom = lerp(1.2, 1.7, u);
        s.caption = "LOOK AT THE FLOOR";
        s.sub = "YOU TRUSTED THAT?";
        if (crossed(s, 0.2)) api.audio.play("crumble");
      } else if (t < 4.2) {
        const u = inv(1.6, 4.2, t);
        s.jaw = 1;
        s.scaleY = lerp(1, 0.15, u);
        s.y += 1.4;
        s.chew = t;
        s.vignette = u;
        s.caption = "SNACK DETECTED";
        s.sub = "CHEWING...";
        if (crossed(s, 1.7) || crossed(s, 2.5) || crossed(s, 3.4)) {
          api.audio.play("land");
          worldShake(api, 10);
        }
      } else if (t < 7.2) {
        s.dark = 0.85;
        s.scaleY = 0.2;
        s.caption = pick(["GUT STATUS: FULL", "DIGESTING DEMON", "FLOOR LUNCH"], s.seed);
        s.sub = "RUMBLE";
        s.camX = wobble(t, 8, 14);
        if (crossed(s, 5.2)) api.audio.play("laugh");
      } else if (t < 9) {
        const u = inv(7.2, 9, t);
        s.dark = 1 - u;
        s.jaw = 1 - u * 0.4;
        s.y = s.y0 - easeOut(u) * 50;
        s.scaleY = lerp(0.2, 1, u);
        s.rot = u * 6.2;
        s.caption = "SPITBACK";
        s.sub = "THANKS FOR THE SNACK";
        if (crossed(s, 7.3)) { api.audio.play("jump"); puff(api, s, "#6a0c0c", 16, 5); }
      } else {
        s.y = s.y0 + Math.sin((t - 9) * 20) * 4;
        s.caption = s.insult;
        if (crossed(s, 9.05)) api.audio.play("fail");
      }
    },

    greed(s, api, t) {
      s.letterbox = 0.5;
      if (t < 2.1) {
        s.jackpot = inv(0, 2.1, t);
        s.zoom = lerp(1.2, 1.5, s.jackpot);
        s.caption = "JACKPOT";
        s.sub = "YOUR PRIZE IS LOADING";
        if (crossed(s, 0.1) || crossed(s, 0.45) || crossed(s, 0.8) || crossed(s, 1.2)) {
          api.audio.play("coin");
          puff(api, s, "#ffd24a", 10, 4);
        }
      } else if (t < 5.6) {
        s.slots = inv(2.1, 5.6, t);
        s.caption = "";
        s.sub = "";
        if (crossed(s, 2.2)) api.audio.play("slot");
        if (crossed(s, 4.8)) api.audio.play("fail");
      } else if (t < 8.1) {
        s.slots = 1;
        s.skullCoins = inv(5.6, 8.1, t);
        s.caption = "YOUR PRIZE";
        s.sub = "DEATH";
        if (crossed(s, 5.7)) api.audio.play("laugh");
      } else {
        s.caption = s.insult;
        s.sub = "SHINY WON. YOU DIDN'T.";
        s.scaleY = 1 + Math.sin(t * 18) * 0.08;
        if (crossed(s, 8.2)) puff(api, s, "#ff7a3a", 18, 5);
      }
    },

    brick(s, api, t) {
      s.letterbox = 1;
      if (t < 2) {
        s.brickY = s.y - 18 + Math.sin(t * 14) * 2;
        s.squash = 0.55;
        s.pose = { gait: Math.sin(t * 10), air: false, blink: true };
        s.caption = "HEAD vs BRICK";
        s.sub = "BRICK IS WINNING. STILL.";
        if (crossed(s, 0.15)) api.audio.play("land");
      } else if (t < 5.2) {
        const u = inv(2, 5.2, t);
        s.stack = Math.floor(u * 7) + 1;
        s.squash = 0.7;
        s.scaleY = lerp(1, 0.55, u);
        s.caption = "MASONRY COMBO";
        s.sub = `x${s.stack}`;
        if (Math.floor((s.tPrev) * 3) !== Math.floor(t * 3)) {
          api.audio.play("land");
          worldShake(api, 6);
        }
      } else if (t < 8.2) {
        s.stack = 8;
        s.tomb = inv(5.2, 8.2, t);
        s.caption = "";
        if (crossed(s, 5.3)) api.audio.play("fanfare");
      } else {
        s.tomb = 1;
        s.caption = s.insult;
        s.sub = "REST IN PIECES";
        if (crossed(s, 8.3)) api.audio.play("fail");
      }
    },

    fake(s, api, t) {
      s.letterbox = 0;
      if (t < 0.45) {
        s.white = 1 - t / 0.45;
        s.hideCorpse = true;
        if (crossed(s, 0.02)) api.audio.play("win");
      } else if (t < 3.6) {
        s.fakeWin = inv(0.45, 3.6, t);
        s.hideCorpse = true;
        s.confetti = true;
        if (crossed(s, 0.5)) api.audio.play("fanfare");
      } else if (t < 5.6) {
        s.fakeWin = 1;
        s.newBest = inv(3.6, 5.6, t);
        s.hideCorpse = true;
        if (crossed(s, 3.7)) api.audio.play("coin");
      } else if (t < 7.2) {
        s.glitch = inv(5.6, 7.2, t);
        s.fakeWin = 1;
        s.hideCorpse = true;
        s.caption = "WAIT.";
        if (crossed(s, 5.7)) api.audio.play("glitch");
      } else if (t < 9) {
        s.sike = inv(7.2, 9, t);
        s.hideCorpse = false;
        s.scaleX = 1 + Math.sin(t * 20) * 0.1;
        s.caption = "SIKE";
        s.sub = "WRONG DOOR";
        if (crossed(s, 7.25)) { api.audio.play("laugh"); puff(api, s, "#e31b1b", 20, 6); }
      } else {
        s.sike = 1;
        s.caption = s.insult;
        s.sub = "YOU BELIEVED THE FAKE";
        s.rot += 0.2;
        if (crossed(s, 9.05)) api.audio.play("fail");
      }
    },

    reverse(s, api, t) {
      s.letterbox = 1;
      if (t < 2.1) {
        s.swap = inv(0, 2.1, t);
        s.caption = "CONTROLS UPDATED";
        s.sub = "LEFT ↔ RIGHT";
        if (crossed(s, 0.15)) api.audio.play("reverse");
      } else if (t < 5.2) {
        const u = inv(2.1, 5.2, t);
        s.x = s.x0 + Math.sin(t * 3.2) * 26;
        s.facing = Math.sin(t * 3.2) > 0 ? 1 : -1;
        s.pose = { gait: Math.sin(t * 10), air: false, blink: false };
        s.wall = 1;
        s.caption = "TUTORIAL";
        s.sub = "WALK FORWARD (YOU CAN'T)";
        if (crossed(s, 2.6) || crossed(s, 3.5) || crossed(s, 4.4)) api.audio.play("land");
      } else if (t < 7.8) {
        s.gps = inv(5.2, 7.8, t);
        s.caption = "RECALCULATING";
        s.sub = pick(["MAKE A U-TURN", "YOU CAN'T", "TURN AROUND", "NO REALLY"], (s.seed + (t * 2) | 0));
        if (crossed(s, 5.3)) api.audio.play("reverse");
      } else {
        s.arrows = inv(7.8, 10, t);
        s.caption = s.insult;
        s.sub = "YOU DIDN'T NOTICE";
        s.camRot = Math.sin(t * 4) * 0.08;
        if (crossed(s, 7.9)) api.audio.play("fail");
      }
    },

    still(s, api, t) {
      s.letterbox = 1;
      s.pose = { gait: 0, air: false, blink: t % 2.2 < 0.08 };
      if (t < 2.6) {
        s.zoom = lerp(1.1, 1.7, inv(0, 2.6, t));
        s.dust = 1;
        s.caption = "NATURE DOCUMENTARY";
        s.sub = "THE STATIONARY DEMON";
        if (crossed(s, 0.8) || crossed(s, 1.8)) api.audio.play("tick");
      } else if (t < 6.2) {
        s.moss = inv(2.6, 6.2, t);
        s.caption = "MOSS SPEEDRUN";
        s.sub = `T+${t.toFixed(1)}s STILL`;
        if (crossed(s, 4.0)) api.audio.play("crumble");
      } else if (t < 8.3) {
        s.moss = 1;
        s.doc = inv(6.2, 8.3, t);
        s.caption = "AFK DETECTED";
        s.sub = "STANDING IS NOT A PLAN";
        if (crossed(s, 6.3)) api.audio.play("laugh");
      } else {
        const u = inv(8.3, 10, t);
        s.y += 2;
        s.rot = u * 0.4;
        s.caption = s.insult;
        s.sub = "HERE LIES MOTION";
        if (crossed(s, 8.4)) { api.audio.play("crumble"); puff(api, s, "#6a5a48", 14, 4); }
      }
    },

    jump(s, api, t) {
      s.letterbox = 1;
      if (t < 2.2) {
        const u = inv(0, 2.2, t);
        s.y = s.y0 + 16 - Math.sin(u * Math.PI) * 72;
        s.pose = { gait: 0, air: true, blink: false };
        s.replay = 1;
        s.caption = "INSTANT REPLAY";
        s.sub = "THE UNNECESSARY JUMP";
        if (crossed(s, 0.12)) api.audio.play("jump");
      } else if (t < 5.1) {
        s.y = s.y0 + 16 - 72;
        s.bigX = inv(2.2, 5.1, t);
        s.zoom = 1.7;
        s.circle = { r: 44, pulse: true };
        s.caption = "THE UNNECESSARY JUMP";
        s.sub = "WALKING WAS LEGAL";
        if (crossed(s, 2.3)) api.audio.play("fail");
      } else if (t < 7.6) {
        s.y = s.y0 + 16 - 72 + (t - 5.1) * 8;
        s.path = inv(5.1, 7.6, t);
        s.bigX = 1;
        s.caption = "THIS WAS FINE";
        s.sub = "THE GROUND. RIGHT THERE.";
        if (crossed(s, 5.2)) api.audio.play("laugh");
      } else {
        const u = inv(7.6, 10, t);
        s.y += 4;
        s.rot += 0.08;
        s.caption = s.insult;
        s.sub = "THAT JUMP WAS THE TRAP";
        s.zoom = lerp(1.5, 1.15, u);
        if (crossed(s, 7.7)) api.audio.play("trombone");
      }
    },

    generic(s, api, t) {
      s.letterbox = 0.3;
      if (t < 3.2) {
        s.progress = Math.min(0.99, easeOut(inv(0, 3.2, t)) * 0.99);
        s.hideCorpse = t > 0.4;
        s.caption = "ALMOST";
        s.sub = `${Math.floor(s.progress * 100)}%`;
        if (crossed(s, 0.2)) api.audio.play("win");
      } else if (t < 6.3) {
        s.progress = 0.99;
        s.credits = inv(3.2, 6.3, t);
        s.hideCorpse = true;
        s.caption = "";
        if (crossed(s, 3.3)) api.audio.play("fanfare");
      } else if (t < 8.6) {
        s.credits = 1;
        s.dvd = 1;
        s.hideCorpse = true;
        s.caption = "";
        if (crossed(s, 6.4)) api.audio.play("glitch");
      } else {
        s.dvd = 0;
        s.hideCorpse = false;
        s.scaleX = 1 + Math.sin(t * 30) * 0.2;
        s.caption = s.insult;
        s.sub = "THAT WAS ON YOU";
        if (crossed(s, 8.65)) { api.audio.play("fail"); puff(api, s, "#e31b1b", 20, 6); }
      }
    },
  };

  function worldShake(api, n) {
    api.world.shake = Math.max(api.world.shake || 0, n);
  }

  function drawHalves(ctx, s, api) {
    const { player, drawDevilBody } = api;
    const w = player.w;
    const h = player.h;
    const pose = s.pose || { gait: 0, air: true, blink: false };
    ctx.save();
    ctx.beginPath();
    ctx.rect(s.x - 40, s.y - 50, w / 2 + 40 - 1, h + 80);
    ctx.clip();
    drawDevilBody(s.x - s.split, s.y, s.facing, s.alpha, s.squash, pose);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(s.x + w / 2 + 1, s.y - 50, w / 2 + 40, h + 80);
    ctx.clip();
    drawDevilBody(s.x + s.split, s.y, s.facing, s.alpha, s.squash, pose);
    ctx.restore();
    ctx.strokeStyle = "#ffe0e0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s.x + w / 2, s.y - 8);
    ctx.lineTo(s.x + w / 2, s.y + h + 4);
    ctx.stroke();
  }

  function WORLD(ctx, s, api) {
    const { TILE, drawSpikePair, drawBrickFace, drawSkullMark } = api;
    if (s.kind === "laser") {
      const pulse = 0.55 + Math.sin(s.t * 18) * 0.25;
      ctx.fillStyle = `rgba(255,30,30,${0.18 * pulse})`;
      ctx.fillRect(s.x - 110, s.y + 4, 260, 24);
      ctx.fillStyle = "rgba(255,40,40,0.35)";
      ctx.fillRect(s.x - 90, s.y + 10, 220, 12);
      ctx.fillStyle = "rgba(255,240,240,0.95)";
      ctx.fillRect(s.x - 80, s.y + 13, 200, 4);
    }
    if (s.kind === "spike" && s.kebab) {
      const n = 5;
      for (let i = 0; i < n; i++) {
        ctx.save();
        ctx.translate(s.x - 6 + i * 8, s.y + 28);
        ctx.scale(0.85, 1 + s.kebab * 2.1);
        ctx.translate(0, -TILE);
        drawSpikePair(0, TILE - 6, "up");
        ctx.restore();
      }
      ctx.fillStyle = `rgba(180,12,12,${0.35 + s.kebab * 0.4})`;
      for (let i = 0; i < 4; i++) {
        const drip = (s.t * 28 + i * 11) % 18;
        ctx.beginPath();
        ctx.ellipse(s.x + 2 + i * 7, s.y + 30 + drip, 1.6, 3 + drip * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (s.kind === "ceiling" && s.floorSpikes) {
      for (let i = -2; i <= 2; i++) {
        ctx.globalAlpha = s.floorSpikes;
        drawSpikePair(s.x + i * 16 - 8, s.y0 + 70, "up");
        ctx.globalAlpha = 1;
      }
    }
    if (s.kind === "hole" && s.fallLoop != null) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(s.x - 16, s.y - 80, 56, 420);
      const off = (s.fallLoop * 160) % TILE;
      for (let i = -4; i < 10; i++) {
        drawBrickFace(s.x - 52, s.y + i * TILE + off, "#3a3028", "#b8a890", false);
        drawBrickFace(s.x + 44, s.y + i * TILE + off, "#3a3028", "#b8a890", false);
      }
    }
    if (s.kind === "teeth" && s.jaw) {
      const open = (s.jaw < 1 ? s.jaw : 0.65 + Math.sin((s.chew || s.t) * 10) * 0.12) * 28;
      ctx.fillStyle = "#1a120e";
      ctx.beginPath();
      ctx.moveTo(s.x - 36, s.y + 32);
      ctx.lineTo(s.x + 60, s.y + 32);
      ctx.lineTo(s.x + 50, s.y + 32 + open);
      ctx.lineTo(s.x - 26, s.y + 32 + open);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        drawSpikePair(s.x - 28 + i * 14, s.y + 10, "down");
        drawSpikePair(s.x - 28 + i * 14, s.y + 20 + open, "up");
      }
    }
    if (s.kind === "brick") {
      if (s.brickY != null && !s.stack) {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(s.x - 2, s.brickY + TILE - 2, TILE, 5);
        drawBrickFace(s.x - 4, s.brickY, "#6a4030", "#e0b090", false);
      }
      const stack = s.stack || (s.brickY == null ? 1 : 0);
      for (let i = 0; i < stack; i++) {
        const jx = Math.sin(i * 2.1) * 2;
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.fillRect(s.x - 2 + jx, s.y - 6 - i * 18, TILE, 5);
        drawBrickFace(s.x - 4 + jx, s.y - 10 - i * 18, "#5a3830", "#c0a080", false);
      }
    }
    if (s.kind === "jumpfall" && s.flag) {
      const fy = s.y + (s.flagY || 0);
      const wave = Math.sin(s.t * 9) * 4;
      ctx.fillStyle = "#cfc1aa";
      ctx.fillRect(s.x + 28, fy - 42, 3, 52);
      ctx.fillStyle = "#e31b1b";
      ctx.beginPath();
      ctx.moveTo(s.x + 31, fy - 40);
      ctx.quadraticCurveTo(s.x + 48, fy - 30 + wave, s.x + 31, fy - 14);
      ctx.fill();
      ctx.fillStyle = "#ffd24a";
      ctx.fillRect(s.x + 31, fy - 32, 10, 4);
    }
    if (s.kind === "still" && s.moss) {
      ctx.fillStyle = `rgba(40,90,40,${0.35 + s.moss * 0.4})`;
      for (let i = 0; i < 9; i++) {
        const gx = s.x + (i * 7) % 24 - 2;
        const gy = s.y + 20 - i * 3 * s.moss;
        ctx.fillRect(gx, gy, 4, 10 * s.moss);
      }
      ctx.strokeStyle = "rgba(244,234,216,0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s.x + 6, s.y + 4, 10 * s.moss, 0, Math.PI * 1.2);
      ctx.stroke();
    }
    if (s.kind === "greed" && s.skullCoins) {
      ctx.save();
      ctx.globalAlpha = s.skullCoins;
      ctx.translate(s.x + 12, s.y - 36);
      ctx.scale(2.4, 2.4);
      drawSkullMark(0, 0, 1);
      ctx.restore();
    }
    if (s.kind === "jumpspike" && s.trail) {
      ctx.strokeStyle = "rgba(244,234,216,0.45)";
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x0 + 12, s.y0 - 70);
      ctx.lineTo(s.x + 12, s.y + 14);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (s.kind === "jumpfall" && s.arc) {
      ctx.strokeStyle = "rgba(255,210,74,0.7)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const u = i / 12;
        const x = s.x0 - 40 + u * 40 + 12;
        const y = s.y0 + 20 - Math.sin(u * Math.PI) * 80 + 14;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (s.circle) {
      ctx.save();
      ctx.translate(s.x + 12, s.y + 16);
      ctx.strokeStyle = "#e31b1b";
      ctx.lineWidth = 2.4;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(0, 0, s.circle.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, s.circle.r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#ffd24a";
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + s.t * (s.circle.pulse ? 1.4 : 0);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (s.circle.r + 4), Math.sin(a) * (s.circle.r + 4));
        ctx.lineTo(Math.cos(a) * (s.circle.r + 12), Math.sin(a) * (s.circle.r + 12));
        ctx.stroke();
      }
      ctx.restore();
    }

    if (s.dark) {
      ctx.fillStyle = `rgba(0,0,0,${s.dark})`;
      ctx.fillRect(s.x - 80, s.y - 80, 180, 180);
    }

    if (!s.hideCorpse) {
      if (s.halves) drawHalves(ctx, s, api);
      else drawCorpse(ctx, s, api);
    }
  }

  function SCREEN(ctx, s, api) {
    const W = api.VIEW_W;
    const H = api.VIEW_H;
    letterbox(ctx, W, H, s.letterbox || 0);

    if ((s.speed || 0) > 3.5 || s.fallLoop != null) {
      ctx.save();
      ctx.globalAlpha = s.fallLoop != null ? 0.35 : Math.min(0.45, (s.speed - 3) * 0.08);
      ctx.strokeStyle = "rgba(244,234,216,0.8)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 10; i++) {
        const y = (i * 53 + s.t * 220) % H;
        const len = 30 + (i % 4) * 18;
        ctx.beginPath();
        ctx.moveTo(W * (0.15 + (i % 5) * 0.15), y);
        ctx.lineTo(W * (0.15 + (i % 5) * 0.15), y + len);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (s.white) {
      ctx.fillStyle = `rgba(255,255,255,${s.white})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (s.vignette) {
      ctx.fillStyle = `rgba(0,0,0,${s.vignette * 0.55})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (s.kind === "fake" && s.fakeWin && !s.sike) drawFakeWin(ctx, s, W, H);
    if (s.kind === "generic" && s.progress != null && s.t < 6.4) drawAlmost(ctx, s, W, H);
    if (s.kind === "generic" && s.credits) drawCredits(ctx, s, W, H);
    if (s.kind === "generic" && s.dvd) drawDvd(ctx, s, W, H);
    if (s.kind === "laser" && s.report) drawReport(ctx, s, W, H);
    if (s.kind === "greed" && s.slots) drawSlots(ctx, s, W, H);
    if (s.kind === "saw" && s.card) drawCard(ctx, s, W, H, api);
    if (s.kind === "spike" && s.menu) drawMenu(ctx, s, W, H);
    if (s.kind === "ceiling" && s.scorecard) drawScores(ctx, s, W, H);
    if (s.kind === "jumpspike" && s.judges) drawJudges(ctx, s, W, H);
    if (s.kind === "brick" && s.tomb) drawTomb(ctx, s, W, H);
    if (s.kind === "hole" && s.hotel) drawHotel(ctx, s, W, H);
    if (s.kind === "reverse" && (s.swap || s.gps || s.arrows)) drawReverseUI(ctx, s, W, H);
    if (s.kind === "jump" && s.bigX) {
      outlineStamp(ctx, "X", W * 0.72, H * 0.38, W * 0.22, -0.15, "#e31b1b", s.bigX);
    }
    if (s.kind === "jump" && s.path) {
      ctx.save();
      ctx.globalAlpha = s.path;
      ctx.strokeStyle = "#ffd24a";
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.moveTo(W * 0.2, H * 0.72);
      ctx.lineTo(W * 0.8, H * 0.72);
      ctx.stroke();
      font(ctx, W * 0.018, false);
      ctx.fillStyle = "#ffd24a";
      ctx.textAlign = "center";
      ctx.fillText("WALKING WAS LEGAL", W / 2, H * 0.72 + 28);
      ctx.restore();
    }
    if (s.kind === "fake" && s.sike) {
      outlineStamp(ctx, "SIKE", W / 2, H * 0.28, W * 0.16, -0.08 + wobble(s.t, 0.04, 12), "#e31b1b", s.sike);
    }
    if (s.kind === "still" && s.doc) {
      ctx.save();
      ctx.globalAlpha = s.doc * 0.9;
      panel(ctx, W * 0.14, H * 0.12, W * 0.72, 64);
      font(ctx, W * 0.016, false);
      ctx.fillStyle = "#c4b49c";
      ctx.textAlign = "center";
      ctx.fillText("ATV · ANIMAL TRAP VISION", W / 2, H * 0.12 + 26);
      ctx.fillStyle = "#f4ead8";
      ctx.fillText("HERE WE OBSERVE A DEMON WHO FORGOT TO MOVE", W / 2, H * 0.12 + 48);
      ctx.restore();
    }

    if (s.glitch) {
      for (let i = 0; i < 10; i++) {
        const y = ((s.t * 220 + i * 47) % H);
        ctx.fillStyle = `rgba(${i % 2 ? 227 : 80},${i % 2 ? 27 : 80},${i % 2 ? 27 : 255},${0.12 * s.glitch})`;
        ctx.fillRect(0, y, W, 8 + (i % 5));
      }
    }

    if (!s.fakeWin && !s.menu && !s.report && !s.slots && !s.tomb && !s.credits && !s.dvd && (s.caption || s.sub)) {
      const pop = easeOut(s.capIn == null ? 1 : s.capIn);
      const cap = s.caption || "";
      const sub = s.sub || "";
      const capSize = cap ? u(W, H, cap.length > 22 ? 28 : cap.length > 16 ? 34 : 42) : 0;
      const subSize = sub ? u(W, H, 16) : 0;
      const gap = cap && sub ? Math.max(u(W, H, 16), capSize * 0.38 + subSize * 0.62) : 0;
      let y = u(W, H, 20) + (cap ? capSize * 0.55 : subSize * 0.55);
      if (cap) {
        ctx.save();
        ctx.translate(W / 2, y);
        ctx.scale(lerp(1.1, 1, pop), lerp(1.1, 1, pop));
        outlineStamp(ctx, cap, 0, 0, capSize, -0.03, "#f4ead8", pop);
        ctx.restore();
        y += capSize * 0.62 + gap;
      }
      if (sub) {
        const sp = easeOut(Math.max(0, (s.capIn || 1) - 0.15));
        stamp(ctx, sub, W / 2, y, subSize, 0.02, "#e31b1b", 0.95 * sp);
      }
    }

    if (s.kind === "spike" && s.tip) {
      ctx.save();
      ctx.globalAlpha = s.tip;
      const ax = W * 0.5 + Math.sin(s.t * 8) * 10;
      const ay = H * 0.62;
      ctx.fillStyle = "#ffd24a";
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - 16, ay - 28);
      ctx.lineTo(ax + 16, ay - 28);
      ctx.fill();
      font(ctx, W * 0.018, true);
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffd24a";
      ctx.fillText("THESE. THE SHARP ONES.", ax, ay + 28);
      ctx.restore();
    }

    if (s.flash) {
      ctx.fillStyle = `rgba(255,236,220,${s.flash * 0.55})`;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = `rgba(227,27,27,${s.flash * 0.22})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (s.black) {
      ctx.fillStyle = `rgba(0,0,0,${s.black})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawFakeWin(ctx, s, W, H) {
    const a = Math.min(1, s.fakeWin * 2);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(8,6,10,0.82)";
    ctx.fillRect(0, 0, W, H);
    outlineStamp(ctx, "LEVEL COMPLETE!", W / 2, H * 0.28, Math.min(64, W * 0.07), 0, "#ffd24a", 1);
    font(ctx, W * 0.028, true);
    ctx.fillStyle = "#f4ead8";
    ctx.textAlign = "center";
    ctx.fillText(s.levelName || "TRUST ME", W / 2, H * 0.38);
    font(ctx, W * 0.016, false);
    ctx.fillStyle = "#9a8c7a";
    ctx.fillText(`ATTEMPT ${79437924 + (s.seed % 90)}  ·  100%`, W / 2, H * 0.46);
    bar(ctx, W * 0.22, H * 0.52, W * 0.56, 22, 1, "CLEARED", 1);
    if (s.newBest) {
      outlineStamp(ctx, "NEW BEST", W / 2, H * 0.66, Math.min(40, W * 0.045), -0.05, "#e31b1b", s.newBest);
      font(ctx, W * 0.02, true);
      ctx.fillStyle = "#ffd24a";
      ctx.fillText("SURGE RATING 99,999,999×", W / 2, H * 0.74);
    }
    if (s.confetti) {
      ctx.fillStyle = "#ffd24a";
      for (let i = 0; i < 40; i++) {
        const x = (i * 97 + s.t * 140) % W;
        const y = (i * 53 + s.t * 90) % H;
        ctx.fillRect(x, y, 4, 8);
      }
    }
    ctx.restore();
  }

  function drawAlmost(ctx, s, W, H) {
    ctx.save();
    ctx.fillStyle = "rgba(8,6,10,0.55)";
    ctx.fillRect(0, H * 0.4, W, 80);
    bar(ctx, W * 0.18, H * 0.44, W * 0.64, 28, s.progress, `${Math.floor(s.progress * 100)}%`, 1);
    ctx.restore();
  }

  function drawCredits(ctx, s, W, H) {
    const names = [
      "DIRECTED BY THE FLOOR",
      "STARRING YOU  (SKILL ISSUE)",
      "SPIKES  ·  AS THEMSELVES",
      "SAW  ·  THE ROUND SHARP ONE",
      "DOOR  ·  A LIAR",
      "SPECIAL THANKS: GRAVITY",
    ];
    ctx.save();
    ctx.globalAlpha = Math.min(1, s.credits * 2);
    const y0 = H * 0.55 - s.credits * 80;
    names.forEach((n, i) => {
      font(ctx, W * 0.018, i === 0);
      ctx.fillStyle = i === 0 ? "#ffd24a" : "#c4b49c";
      ctx.textAlign = "center";
      ctx.fillText(n, W / 2, y0 + i * 28);
    });
    ctx.restore();
  }

  function drawDvd(ctx, s, W, H) {
    const t = s.t * 0.22;
    const bw = W * 0.34;
    const bh = 54;
    const x = Math.abs((t * 180) % (W - bw) * 2 - (W - bw));
    const y = Math.abs((t * 110) % (H - bh) * 2 - (H - bh));
    panel(ctx, x, y, bw, bh);
    stamp(ctx, "SKILL ISSUE", x + bw / 2, y + bh / 2, W * 0.028, 0, "#e31b1b", 1);
  }

  function drawReport(ctx, s, W, H) {
    const lines = [
      "DEMON GENERAL HOSPITAL",
      "CAUSE: TOUCHED THE HINT",
      "BEAM: LETHAL  ·  TOUCH: ELECTIVE",
      "BILATERAL SPLIT: SUCCESSFUL",
      "PROGNOSIS: TRY LOOKING",
      s.insult,
    ];
    const n = Math.max(0, Math.floor(s.report * lines.length));
    if (!n) return;
    const titlePx = u(W, H, 26);
    const bodyPx = u(W, H, 20);
    ctx.save();
    const sized = [];
    for (let i = 0; i < n; i++) {
      const px = i === 0 ? titlePx : bodyPx;
      font(ctx, px, true);
      const m = ctx.measureText(lines[i] || "");
      const h = (m.actualBoundingBoxAscent || px * 0.9) + (m.actualBoundingBoxDescent || px * 0.3);
      sized.push({ text: lines[i], px, w: m.width, h });
    }
    const gap = bodyPx * 0.7;
    const padX = bodyPx * 3.3;
    sized.forEach((l) => {
      const row = l.h + l.px * 0.72;
      l.boxH = row * 2.2;
    });
    let stack = sized.reduce((a, l) => a + l.boxH, 0) + gap * (sized.length - 1);
    const maxStack = H * 0.9;
    if (stack > maxStack) {
      const scale = maxStack / stack;
      sized.forEach((l) => { l.boxH *= scale; });
      stack = maxStack;
    }
    const boxW = Math.min(W * 0.92, Math.max(...sized.map((l) => l.w)) + padX * 2);
    const x = (W - boxW) / 2;
    let y = Math.max(16, (H - stack) / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    sized.forEach((l, i) => {
      panel(ctx, x, y, boxW, l.boxH);
      font(ctx, l.px, true);
      ctx.fillStyle = i === 0 ? "#e31b1b" : "#f4ead8";
      ctx.fillText(l.text, x + padX * 0.55, y + l.boxH / 2);
      y += l.boxH + gap;
    });
    ctx.restore();
  }

  function drawSlots(ctx, s, W, H) {
    const labels = s.slots < 0.82
      ? ["7", "7", "7"]
      : ["DEATH", "DEATH", "DEATH"];
    const w = W * 0.18;
    const x0 = W / 2 - (w * 3 + 16) / 2;
    const y = H * 0.58;
    panel(ctx, x0 - 16, y - 24, w * 3 + 48, 88);
    labels.forEach((lab, i) => {
      const x = x0 + i * (w + 8);
      ctx.fillStyle = "#140808";
      ctx.fillRect(x, y, w, 52);
      font(ctx, lab.length > 1 ? W * 0.016 : W * 0.04, true);
      ctx.fillStyle = "#ffd24a";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const jitter = s.slots < 0.82 ? Math.sin(s.t * 24 + i) * 6 : 0;
      ctx.fillText(lab, x + w / 2, y + 26 + jitter);
    });
  }

  function drawCard(ctx, s, W, H, api) {
    const a = s.card;
    const titlePx = u(W, H, 18);
    const bodyPx = u(W, H, 15);
    const titleStep = titlePx * 1.55;
    const bodyStep = bodyPx * 1.7;
    const w = Math.min(W * 0.86, Math.max(W * 0.5, titlePx * 22));
    const h = titlePx * 1.35 + titleStep + bodyStep + bodyPx;
    const x = W / 2 - w / 2;
    const y = Math.max(H * 0.42, Math.min(H * 0.58, H - h - u(W, H, 16)));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W / 2, y + h / 2);
    ctx.rotate(-0.06);
    ctx.translate(-W / 2, -(y + h / 2));
    ctx.fillStyle = "#1a0c08";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ffd24a";
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
    font(ctx, titlePx, true);
    ctx.fillStyle = "#ffd24a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let lineY = y + titlePx * 1.15;
    ctx.fillText("BLADE APPRECIATION SOCIETY", W / 2, lineY);
    font(ctx, bodyPx, false);
    ctx.fillStyle = "#f4ead8";
    lineY += titleStep;
    ctx.fillText(`MEMBER #${1000 + (api.deaths || 1)}`, W / 2, lineY);
    lineY += bodyStep;
    ctx.fillText("IT SPINS. YOU WALKED IN.", W / 2, lineY);
    ctx.restore();
  }

  function drawMenu(ctx, s, W, H) {
    ctx.save();
    ctx.globalAlpha = s.menu;
    const titlePx = u(W, H, 22);
    const bodyPx = u(W, H, 16);
    const row = Math.max(titlePx, bodyPx) * 1.65;
    const boxH = row * 3 + bodyPx * 0.8;
    const top = H * 0.56;
    panel(ctx, W * 0.12, top, W * 0.76, boxH);
    font(ctx, titlePx, true);
    ctx.fillStyle = "#ffd24a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SPIKE TASTING MENU", W / 2, top + row * 0.7);
    font(ctx, bodyPx, false);
    ctx.fillStyle = "#f4ead8";
    ctx.fillText("DEMON SKEWER  ·  ★☆☆☆☆  ·  CHEF'S PITY", W / 2, top + row * 1.75);
    ctx.fillStyle = "#e31b1b";
    ctx.fillText("CUSTOMER DID NOT LOOK", W / 2, top + row * 2.8);
    ctx.restore();
  }

  function drawScores(ctx, s, W, H) {
    ctx.save();
    ctx.globalAlpha = s.scorecard;
    const pairs = [["JUMP", "UNFORCED"], ["FORM", "F"], ["BRAIN", "ALSO F"]];
    const maxW = W * 0.94;
    let px = u(W, H, 28);
    const wordGap = () => px * 0.42;
    const pairGap = () => px * 1.35;

    function measure() {
      font(ctx, px, true);
      const widths = pairs.map((r) => {
        const a = ctx.measureText(r[0]).width;
        const b = ctx.measureText(r[1]).width;
        return { a, b, w: a + wordGap() + b };
      });
      let w = 0;
      widths.forEach((p, i) => { w += p.w + (i ? pairGap() : 0); });
      const sample = ctx.measureText("UNFORCED");
      const ascent = sample.actualBoundingBoxAscent || px * 0.8;
      const descent = sample.actualBoundingBoxDescent || px * 0.22;
      return { widths, w, h: ascent + descent };
    }

    let m = measure();
    while (m.w + px * 2.2 > maxW && px > 11) {
      px *= 0.92;
      m = measure();
    }

    const padX = Math.max(18, px * 0.95);
    const padY = Math.max(14, px * 0.62);
    const boxW = Math.min(maxW, m.w + padX * 2);
    const boxH = m.h + padY * 2;
    const x = (W - boxW) / 2;
    const y = H * 0.86 - boxH;
    panel(ctx, x, y, boxW, boxH);

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const cy = y + boxH / 2 + px * 0.04;
    let cursor = x + (boxW - m.w) / 2;
    pairs.forEach((r, i) => {
      const p = m.widths[i];
      font(ctx, px, true);
      ctx.fillStyle = "#f4ead8";
      ctx.fillText(r[0], cursor, cy);
      ctx.fillStyle = "#e31b1b";
      ctx.fillText(r[1], cursor + p.a + wordGap(), cy);
      cursor += p.w + pairGap();
    });
    ctx.restore();
  }

  function drawJudges(ctx, s, W, H) {
    const scores = ["0.0", "0.0", "0.0"];
    const px = u(W, H, 34);
    ctx.save();
    ctx.globalAlpha = s.judges;
    font(ctx, px, true);
    const sample = ctx.measureText("0.0");
    const ascent = sample.actualBoundingBoxAscent || px * 0.92;
    const descent = sample.actualBoundingBoxDescent || px * 0.28;
    const boxW = sample.width + px * 1.35 * 2.2;
    const boxH = ascent + descent + px * 0.85 * 2.2;
    const gap = Math.max(22, px * 0.42 * 2.2);
    const total = boxW * 3 + gap * 2;
    const x0 = (W - total) / 2;
    const y = H * 0.58;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    scores.forEach((n, i) => {
      const x = x0 + i * (boxW + gap);
      panel(ctx, x, y, boxW, boxH);
      ctx.fillStyle = "#e31b1b";
      ctx.fillText(n, x + boxW / 2, y + boxH / 2 + px * 0.04);
    });
    ctx.restore();
  }

  function drawTomb(ctx, s, W, H) {
    ctx.save();
    ctx.globalAlpha = s.tomb;
    const x = W / 2;
    const y = H * 0.62;
    ctx.fillStyle = "#6b6560";
    ctx.beginPath();
    ctx.moveTo(x - 70, y + 50);
    ctx.lineTo(x - 70, y - 10);
    ctx.quadraticCurveTo(x, y - 70, x + 70, y - 10);
    ctx.lineTo(x + 70, y + 50);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1a120e";
    font(ctx, W * 0.016, true);
    ctx.textAlign = "center";
    ctx.fillText("HERE LIES", x, y - 8);
    ctx.fillText("OUTPLAYED BY A BRICK", x, y + 16);
    ctx.fillText(s.insult || "REST IN PIECES", x, y + 40);
    ctx.restore();
  }

  function drawHotel(ctx, s, W, H) {
    ctx.save();
    ctx.globalAlpha = s.hotel;
    panel(ctx, W * 0.14, H * 0.2, W * 0.72, 90);
    font(ctx, W * 0.028, true);
    ctx.fillStyle = "#ffd24a";
    ctx.textAlign = "center";
    ctx.fillText("HOTEL FLOOR", W / 2, H * 0.2 + 36);
    font(ctx, W * 0.016, false);
    ctx.fillStyle = "#f4ead8";
    ctx.fillText("NO VACANCY  ·  YOU ARE THE VACANCY", W / 2, H * 0.2 + 66);
    ctx.restore();
  }

  function drawReverseUI(ctx, s, W, H) {
    if (s.swap) {
      ctx.save();
      ctx.globalAlpha = s.swap;
      panel(ctx, W * 0.25, H * 0.6, W * 0.5, 80);
      font(ctx, W * 0.04, true);
      ctx.fillStyle = "#80a0ff";
      ctx.textAlign = "center";
      ctx.fillText("◀  LEFT    RIGHT  ▶", W / 2, H * 0.6 + 34);
      ctx.fillText("▶  LEFT    RIGHT  ◀", W / 2, H * 0.6 + 64);
      ctx.restore();
    }
    if (s.gps) {
      stamp(ctx, "RECALCULATING", W / 2, H * 0.7, W * 0.028, 0, "#80a0ff", s.gps);
    }
    if (s.arrows) {
      ctx.save();
      ctx.globalAlpha = s.arrows;
      font(ctx, W * 0.06, true);
      ctx.fillStyle = "#80a0ff";
      ctx.textAlign = "center";
      for (let i = 0; i < 8; i++) {
        ctx.fillText(i % 2 ? "◀" : "▶", (i * 0.12 + 0.1) * W, H * 0.5 + Math.sin(s.t * 5 + i) * 40);
      }
      ctx.restore();
    }
  }

  const ALT = {
    spike: [
      function (s, api, t) {
        s.letterbox = 1;
        beat(s, api, t, [
          { t: 0, cap: "FOOT CAM", sub: "ZOOMING IN. SORRY.", sfx: "tick", go(s, api, u) {
            s.zoom = lerp(1.3, 2.4, easeOut(u));
            s.camY = lerp(0, 36, u);
            s.circle = { r: lerp(60, 18, u), pulse: true };
            s.squash = 0.25;
          }},
          { t: 2.4, cap: "THESE ARE SPIKES", sub: "NOT FLOOR TEXTURE", sfx: "spike", go(s, api, u) {
            s.kebab = easeIn(u);
            s.y = s.y0 + easeIn(u) * 18;
            s.squash = lerp(0.2, 0.8, u);
            s.scaleY = lerp(1, 1.4, u);
            s.zoom = 1.8;
          }},
          { t: 5.2, cap: "EVIDENCE", sub: "YOU STEPPED ANYWAY", sfx: "fanfare", go(s, api, u) {
            s.menu = easeOut(u);
            s.kebab = 1;
            s.rot = wobble(t, 0.08, 5);
          }},
          { t: 7.6, cap: "", sub: "", go(s, api, u, t) {
            s.caption = s.insult;
            s.tip = u;
            s.menu = 1;
            s.y -= 2;
            s.rot += 0.12;
          }},
        ]);
      },
      function (s, api, t) {
        s.letterbox = 1;
        beat(s, api, t, [
          { t: 0, cap: "CHARGES", sub: "WALKING ON PURPOSE", sfx: "type", go(s, api, u) {
            s.menu = easeOut(u);
            s.zoom = 1.4;
            s.pose = { gait: 0, air: false, blink: u > 0.7 };
          }},
          { t: 3.2, cap: "SENTENCE", sub: "SLOW KEBAB", sfx: "spike", go(s, api, u) {
            s.menu = 0;
            s.kebab = easeIn(u);
            s.y = s.y0 - 30 + easeIn(u) * 58;
            s.squash = lerp(-0.2, 0.9, u);
            s.zoom = lerp(1.5, 1.9, u);
          }},
          { t: 6.2, cap: "PRO TIP", sub: "SHARP END GOES UP", sfx: "laugh", go(s, api, u) {
            s.tip = u;
            s.kebab = 1;
            s.circle = { r: 28, pulse: true };
          }},
          { t: 8.2, cap: "", sub: "", sfx: "fail", go(s, api, u) {
            s.caption = s.insult;
            s.x += 5;
            s.rot += 0.4;
            s.scaleY = lerp(1.3, 0.25, u);
          }},
        ]);
      },
    ],
    ceiling: [
      function (s, api, t) {
        s.letterbox = 1;
        beat(s, api, t, [
          { t: 0, cap: "STUCK", sub: "THE CEILING WON", sfx: "land", go(s, api, u) {
            s.hang = 1;
            s.y = s.y0 - 10;
            s.rot = Math.sin(t * 2) * 0.2;
            s.zoom = lerp(1.2, 1.7, u);
          }},
          { t: 2.8, cap: "BONK BONK BONK", sub: "STILL UP THERE", sfx: "land", go(s, api, u) {
            s.hits = Math.floor(u * 6) + 1;
            s.sub = s.hits + " HITS · NO ESCAPE";
            s.rot = Math.sin(t * 9) * 0.7;
            s.x = s.x0 + Math.sin(t * 9) * 16;
            s.hang = 1;
          }},
          { t: 5.6, cap: "GRAVITY REMEMBERED", sub: "AND THE FLOOR", sfx: "spike", go(s, api, u) {
            s.hang = 1 - u;
            s.y = s.y0 - 10 + easeIn(u) * 80;
            s.floorSpikes = easeOut(u);
            s.squash = u > 0.7 ? 0.85 : 0;
          }},
          { t: 8, cap: "", sub: "", sfx: "fail", go(s, api, u) {
            s.scorecard = u;
            s.y = s.y0 + 60;
            s.floorSpikes = 1;
          }},
        ]);
      },
      function (s, api, t) {
        s.letterbox = 1;
        beat(s, api, t, [
          { t: 0, cap: "REWIND", sub: "YOU WERE FINE DOWN HERE", sfx: "reverse", go(s, api, u) {
            s.y = s.y0 + 50 - easeOut(u) * 58;
            s.floorSpikes = 1 - u;
            s.zoom = 1.45;
          }},
          { t: 3, cap: "THEN YOU JUMPED", sub: "INTO THE CEILING", sfx: "jump", go(s, api, u) {
            s.hang = easeOut(u);
            s.y = s.y0 - easeOut(u) * 12;
            s.rot = Math.sin(t * 6) * 0.45;
          }},
          { t: 5.8, cap: "SCORE", sub: "CEILING 1 · YOU 0", sfx: "fanfare", go(s, api, u) {
            s.scorecard = u;
            s.hang = 1;
          }},
          { t: 8, cap: "", sub: "", sfx: "spike", go(s, api, u) {
            s.caption = s.insult;
            s.scorecard = 0;
            s.y = s.y0 + easeIn(u) * 70;
            s.floorSpikes = u;
            s.squash = u;
          }},
        ]);
      },
    ],
    jumpspike: [
      function (s, api, t) {
        s.letterbox = 1;
        beat(s, api, t, [
          { t: 0, cap: "JUDGES", sub: "BEFORE THE LANDING", sfx: "type", go(s, api, u) {
            s.judges = easeOut(u);
            s.zoom = 1.3;
            s.y = s.y0 - 20;
          }},
          { t: 3.1, cap: "NOW WATCH", sub: "YOU AIMED AT THEM", sfx: "reverse", go(s, api, u) {
            s.judges = 0;
            s.replay = 1;
            s.trail = 1;
            s.y = s.y0 - 64 + easeIn(u) * 72;
            s.rot = u * 0.5;
          }},
          { t: 6.2, cap: "CONTACT", sub: "GRADE: SEE ME", sfx: "spike", go(s, api, u) {
            s.squash = 0.75;
            s.circle = { r: 34 + Math.sin(t * 10) * 3, pulse: true };
            s.zoom = 2;
            if (crossed(s, 6.28)) puff(api, s, "#e31b1b", 8, 3);
          }},
          { t: 8.2, cap: "", sub: "0.0 · 0.0 · 0.0", sfx: "trombone", go(s, api, u) {
            s.caption = s.insult;
            s.judges = 1;
          }},
        ]);
      },
      function (s, api, t) {
        s.letterbox = 1;
        beat(s, api, t, [
          { t: 0, cap: "TRAJECTORY", sub: "A LINE INTO TEETH", sfx: "tick", go(s, api, u) {
            s.trail = 1;
            s.arc = u;
            s.x = s.x0 - 30 + u * 30;
            s.y = s.y0 - Math.sin(u * Math.PI) * 50;
            s.replay = 1;
          }},
          { t: 3.4, cap: "IMPACT FRAME", sub: "HOLD THIS", sfx: "spike", go(s, api, u) {
            s.zoom = lerp(1.4, 2.2, u);
            s.squash = 0.8;
            s.circle = { r: 26, pulse: true };
            s.y = s.y0 + 6;
          }},
          { t: 6, cap: "PANEL", sub: "UNANIMOUS", sfx: "fail", go(s, api, u) {
            s.judges = u;
            s.zoom = 1.35;
          }},
          { t: 8.3, cap: "", sub: "", go(s, api, u) {
            s.caption = s.insult;
            s.rot += 0.15;
            s.y += 3;
          }},
        ]);
      },
    ],
    saw: [
      function (s, api, t) {
        s.letterbox = 0.6;
        beat(s, api, t, [
          { t: 0, cap: "MEMBERSHIP", sub: "BLADE CLUB", sfx: "coin", go(s, api, u) {
            s.card = easeOut(u);
            s.zoom = 1.4;
            s.x = s.sawX;
            s.y = s.sawY;
          }},
          { t: 2.8, cap: "INITIATION", sub: "SPIN WITH US", sfx: "saw", go(s, api, u) {
            s.card = 0;
            const ang = u * Math.PI * 10;
            s.rot = ang;
            s.x = s.sawX + Math.cos(ang) * 22;
            s.y = s.sawY + Math.sin(ang) * 22;
            s.camRot = ang * 0.25;
            s.spinBlur = u;
            s.zoom = 1.85;
          }},
          { t: 6.4, cap: "FLAT", sub: "THAT'S THE SHAPE NOW", sfx: "fail", go(s, api, u) {
            s.camRot *= 0.8;
            s.scaleY = lerp(1, 0.2, easeOut(u));
            s.scaleX = lerp(1, 2.1, easeOut(u));
            s.x = s.x0;
            s.y = s.y0 + 10;
            s.rot = 0;
          }},
          { t: 8.4, cap: "", sub: "IT SPINS. YOU WALKED IN.", go(s, api, u) {
            s.caption = s.insult;
            s.scaleX = 1.6;
            s.scaleY = 0.3;
          }},
        ]);
      },
      function (s, api, t) {
        s.letterbox = 0.6;
        beat(s, api, t, [
          { t: 0, cap: "IT'S COMING", sub: "YOU ARE NOT MOVING", sfx: "saw", go(s, api, u) {
            s.x = lerp(s.x0, s.sawX, easeIn(u));
            s.y = lerp(s.y0, s.sawY, easeIn(u));
            s.zoom = lerp(1.1, 2, u);
          }},
          { t: 3.2, cap: "ONE ROTATION", sub: "THAT WAS ENOUGH", sfx: "saw", go(s, api, u) {
            s.rot = u * Math.PI * 2;
            s.spinBlur = 1;
            s.scaleX = lerp(1, 0.35, u);
            s.scaleY = lerp(1, 1.7, u);
          }},
          { t: 6.2, cap: "CARD", sub: "EXPIRED", sfx: "coin", go(s, api, u) {
            s.card = u;
            s.rot += 0.15;
          }},
          { t: 8.2, cap: "", sub: "", sfx: "fail", go(s, api, u) {
            s.caption = s.insult;
            s.card = 0;
            s.scaleX = lerp(0.4, 1.5, u);
            s.scaleY = lerp(1.6, 0.3, u);
            s.x = s.x0;
            s.y = s.y0;
          }},
        ]);
      },
    ],
    laser: [
      function (s, api, t) {
        s.letterbox = 1;
        beat(s, api, t, [
          { t: 0, cap: "INCIDENT REPORT", sub: "FILING WHILE YOU SPLIT", sfx: "type", go(s, api, u) {
            s.report = easeOut(u);
            s.beamHold = 1;
            s.zoom = 1.35;
          }},
          { t: 3.4, cap: "BILATERAL", sub: "LEFT YOU AND RIGHT YOU", sfx: "spike", go(s, api, u) {
            s.report = 0;
            s.split = easeOut(u) * 36;
            s.halves = 1;
          }},
          { t: 6.2, cap: "CAUSE", sub: "TOUCHED THE RED LINE", sfx: "laugh", go(s, api, u) {
            s.report = u;
            s.halves = 1;
            s.split = 36;
          }},
          { t: 8.3, cap: "", sub: "", sfx: "fail", go(s, api, u) {
            s.caption = s.insult;
            s.split = lerp(36, 0, u);
            s.scaleY = lerp(1, 0.3, u);
            s.squash = u;
          }},
        ]);
      },
      function (s, api, t) {
        s.letterbox = 1;
        beat(s, api, t, [
          { t: 0, cap: "HOLD THE BEAM", sub: "IT'S HOLDING YOU", sfx: "spike", go(s, api, u) {
            s.beamHold = 1;
            s.zoom = lerp(1.2, 2.1, u);
            s.pose = { gait: Math.sin(t * 12), air: false, blink: false };
          }},
          { t: 2.6, cap: "TWO DEMONS", sub: "NEITHER SURVIVED", sfx: "glitch", go(s, api, u) {
            s.halves = 1;
            s.split = easeOut(u) * 40;
          }},
          { t: 5.6, cap: "PAPERWORK", sub: "BOTH SIGNED", sfx: "type", go(s, api, u) {
            s.report = u;
            s.halves = 1;
          }},
          { t: 8, cap: "", sub: "", sfx: "fail", go(s, api, u) {
            s.caption = s.insult;
            s.scaleY = lerp(1, 0.25, u);
            s.split = lerp(40, 8, u);
          }},
        ]);
      },
    ],
    hole: [
      function (s, api, t) {
        s.letterbox = 0.4;
        beat(s, api, t, [
          { t: 0, cap: "CHECKING IN", sub: "NO FLOOR REQUIRED", sfx: "fanfare", go(s, api, u) {
            s.hotel = easeOut(u);
            s.fallLoop = t;
            s.y += 2.2;
            s.rot = Math.sin(t * 3) * 0.2;
          }},
          { t: 3.2, cap: "ELEVATOR", sub: "DOWN ONLY", sfx: "crumble", go(s, api, u) {
            s.hotel = 0;
            s.y += 4.2;
            s.fallLoop = t;
            s.caption = "FLOOR −" + (Math.floor(t * 2) + 3);
            s.zoom = 1.3;
          }},
          { t: 6.4, cap: "LOBBY", sub: "YOU ARE THE VACANCY", sfx: "fanfare", go(s, api, u) {
            s.hotel = u;
            s.y += 1.4;
          }},
          { t: 8.2, cap: "", sub: "AIR IS NOT A PLATFORM", sfx: "die", go(s, api, u) {
            s.caption = s.insult;
            s.scaleY = lerp(1, 0.18, easeIn(u));
            s.scaleX = lerp(1, 1.8, u);
            s.squash = 1;
          }},
        ]);
      },
      function (s, api, t) {
        s.letterbox = 0.4;
        beat(s, api, t, [
          { t: 0, cap: "EXPRESS DROP", sub: "SKIPPING FLOORS", sfx: "crumble", go(s, api, u) {
            s.y += 6;
            s.fallLoop = t;
            s.rot += 0.08;
            s.zoom = 1.5;
            s.caption = "FLOOR −" + (Math.floor(u * 12) + 1);
          }},
          { t: 3.5, cap: "OUT OF SERVICE", sub: "YOU KEPT GOING", sfx: "fail", go(s, api, u) {
            s.y += 1;
            s.fallLoop = t;
            s.zoom = 1.8;
            s.circle = { r: 40, pulse: true };
          }},
          { t: 6.2, cap: "CONCIERGE", sub: "WE DON'T DO UP", sfx: "fanfare", go(s, api, u) {
            s.hotel = u;
          }},
          { t: 8.3, cap: "", sub: "", sfx: "die", go(s, api, u) {
            s.caption = s.insult;
            s.scaleY = lerp(1, 0.15, u);
            s.squash = 1;
          }},
        ]);
      },
    ],
    jumpfall: [
      function (s, api, t) {
        s.letterbox = 1;
        beat(s, api, t, [
          { t: 0, cap: "FLAG PLANTED", sub: "IN NOTHING", sfx: "coin", go(s, api, u) {
            s.flag = 1;
            s.flagY = lerp(120, 20, easeOut(u));
            s.y = s.y0 - 30;
            s.pose = { gait: 0, air: true, blink: false };
          }},
          { t: 2.8, cap: "FLAG SAYS NO", sub: "LOL", sfx: "crumble", go(s, api, u) {
            s.flagY = lerp(20, 140, easeIn(u));
            s.y = s.y0 - 30 + u * 40;
          }},
          { t: 5.4, cap: "REPLAY", sub: "THE GAP WAS A GAP", sfx: "jump", go(s, api, u) {
            s.replay = 1;
            s.arc = u;
            s.x = s.x0 - 36 + u * 36;
            s.y = s.y0 - Math.sin(u * Math.PI) * 70;
          }},
          { t: 8, cap: "", sub: "JUMPING INTO NOTHING", sfx: "fail", go(s, api, u) {
            s.caption = s.insult;
            s.y += 5;
            s.rot += 0.14;
          }},
        ]);
      },
      function (s, api, t) {
        s.letterbox = 1;
        beat(s, api, t, [
          { t: 0, cap: "HOVER", sub: "THIS ISN'T FLYING", sfx: "laugh", go(s, api, u) {
            s.y = s.y0 - 70;
            s.circle = { r: 32, pulse: true };
            s.zoom = lerp(1.2, 1.9, u);
            s.pose = { gait: 0, air: true, blink: false };
          }},
          { t: 3.2, cap: "GRAVITY INVOICE", sub: "DUE NOW", sfx: "jump", go(s, api, u) {
            s.y = s.y0 - 70 + easeIn(u) * 110;
            s.arc = u;
          }},
          { t: 6, cap: "CHECKPOINT", sub: "DENIED", sfx: "crumble", go(s, api, u) {
            s.flag = 1;
            s.flagY = lerp(-10, 100, u);
            s.y = s.y0 + 20;
          }},
          { t: 8.2, cap: "", sub: "", sfx: "fail", go(s, api, u) {
            s.caption = s.insult;
            s.rot += 0.1;
            s.y += 4;
          }},
        ]);
      },
    ],
    teeth: [
      function (s, api, t) {
        s.letterbox = 0.8;
        beat(s, api, t, [
          { t: 0, cap: "BITE", sub: "NO APPETIZER", sfx: "crumble", go(s, api, u) {
            s.jaw = 1;
            s.chew = t;
            s.scaleY = lerp(1, 0.2, u);
            s.y += 1.6;
          }},
          { t: 2.6, cap: "DARK", sub: "DIGESTING", sfx: "land", go(s, api, u) {
            s.dark = 0.9;
            s.vignette = u;
            s.scaleY = 0.2;
            s.camX = wobble(t, 10, 12);
          }},
          { t: 5.6, cap: "SPITBACK", sub: "NOT EVEN A SNACK", sfx: "jump", go(s, api, u) {
            s.dark = 1 - u;
            s.y = s.y0 - easeOut(u) * 60;
            s.scaleY = lerp(0.2, 1, u);
            s.rot = u * 5;
          }},
          { t: 8, cap: "", sub: "", sfx: "fail", go(s, api, u) {
            s.caption = s.insult;
            s.y = s.y0 + Math.sin(t * 16) * 5;
          }},
        ]);
      },
      function (s, api, t) {
        s.letterbox = 0.8;
        beat(s, api, t, [
          { t: 0, cap: "THE FLOOR SMILES", sub: "YOU SMILED BACK", sfx: "tick", go(s, api, u) {
            s.jaw = easeOut(u) * 0.4;
            s.zoom = lerp(1.2, 1.8, u);
          }},
          { t: 3, cap: "ONE CHOMP", sub: "THAT'S THE WHOLE BIT", sfx: "spike", go(s, api, u) {
            s.jaw = 1;
            s.scaleY = lerp(1, 0.12, easeIn(u));
            s.chew = t;
          }},
          { t: 5.8, cap: "FULL", sub: "GUT STATUS: RUDE", sfx: "laugh", go(s, api, u) {
            s.dark = u * 0.85;
            s.scaleY = 0.15;
          }},
          { t: 8, cap: "REJECTED", sub: "", sfx: "jump", go(s, api, u) {
            s.caption = s.insult;
            s.dark = 1 - u;
            s.scaleY = lerp(0.15, 1, u);
            s.rot = u * 4;
            s.y = s.y0 - u * 40;
          }},
        ]);
      },
    ],
    greed: [
      function (s, api, t) {
        s.letterbox = 0.5;
        beat(s, api, t, [
          { t: 0, cap: "SPIN", sub: "YOUR PRIZE IS DEATH", sfx: "slot", go(s, api, u) {
            s.slots = u;
            s.zoom = 1.35;
          }},
          { t: 3.4, cap: "SKULLS", sub: "THREE OF THEM", sfx: "fail", go(s, api, u) {
            s.slots = 1;
            s.skullCoins = u;
          }},
          { t: 6, cap: "JACKPOT", sub: "OF CONSEQUENCES", sfx: "coin", go(s, api, u) {
            s.jackpot = u;
            s.skullCoins = 1;
            if (crossed(s, 6.08)) puff(api, s, "#ffd24a", 6, 3);
          }},
          { t: 8.2, cap: "", sub: "SHINY WON.", sfx: "laugh", go(s, api, u) {
            s.caption = s.insult;
            s.scaleY = 1 + Math.sin(t * 16) * 0.1;
          }},
        ]);
      },
      function (s, api, t) {
        s.letterbox = 0.5;
        beat(s, api, t, [
          { t: 0, cap: "COIN RAIN", sub: "NONE OF THEM HELP", sfx: "coin", go(s, api, u) {
            s.jackpot = u;
            s.zoom = lerp(1.2, 1.6, u);
            if ((t * 8 | 0) !== (s.tPrev * 8 | 0)) puff(api, s, "#ffd24a", 4, 3);
          }},
          { t: 3, cap: "BUST", sub: "HOUSE WINS", sfx: "slot", go(s, api, u) {
            s.slots = u;
            s.jackpot = 1;
          }},
          { t: 6.2, cap: "PAYOUT", sub: "A SKULL", sfx: "fail", go(s, api, u) {
            s.skullCoins = u;
            s.slots = 1;
          }},
          { t: 8.3, cap: "", sub: "", sfx: "laugh", go(s, api, u) {
            s.caption = s.insult;
            if (crossed(s, 8.38)) puff(api, s, "#ff7a3a", 10, 4);
          }},
        ]);
      },
    ],
    brick: [
      function (s, api, t) {
        s.letterbox = 1;
        beat(s, api, t, [
          { t: 0, cap: "HERE LIES", sub: "UNDER ONE BRICK", sfx: "fanfare", go(s, api, u) {
            s.tomb = easeOut(u);
            s.squash = 0.5;
            s.brickY = s.y - 16;
          }},
          { t: 3.2, cap: "MORE BRICKS", sub: "THEY BROUGHT FRIENDS", sfx: "land", go(s, api, u) {
            s.tomb = 0;
            s.stack = Math.floor(u * 8) + 1;
            s.sub = "x" + s.stack;
            s.scaleY = lerp(1, 0.5, u);
            s.squash = 0.7;
          }},
          { t: 6.2, cap: "HEAD vs BRICK", sub: "SERIES FINALE", sfx: "land", go(s, api, u) {
            s.brickY = s.y - 20 + Math.sin(t * 18) * 3;
            s.pose = { gait: 0, air: false, blink: true };
            s.stack = 8;
          }},
          { t: 8.2, cap: "", sub: "REST IN PIECES", sfx: "fail", go(s, api, u) {
            s.caption = s.insult;
            s.tomb = 1;
          }},
        ]);
      },
      function (s, api, t) {
        s.letterbox = 1;
        beat(s, api, t, [
          { t: 0, cap: "ONE BRICK", sub: "HOVERING. MENACING.", sfx: "tick", go(s, api, u) {
            s.brickY = s.y - 40 + u * 10;
            s.zoom = lerp(1.2, 1.8, u);
            s.pose = { gait: Math.sin(t * 8), air: false, blink: true };
          }},
          { t: 2.8, cap: "COMBO", sub: "MASONRY", sfx: "land", go(s, api, u) {
            s.stack = Math.floor(u * 6) + 2;
            s.sub = "x" + s.stack;
            s.scaleY = lerp(1, 0.45, u);
            s.squash = 0.8;
          }},
          { t: 5.8, cap: "TOMBSTONE", sub: "CAUSE: BRICK", sfx: "fanfare", go(s, api, u) {
            s.tomb = u;
            s.stack = 8;
          }},
          { t: 8.2, cap: "", sub: "", sfx: "fail", go(s, api, u) {
            s.caption = s.insult;
            s.tomb = 1;
            s.squash = 0.9;
          }},
        ]);
      },
    ],
    fake: [
      function (s, api, t) {
        s.letterbox = 0;
        beat(s, api, t, [
          { t: 0, cap: "SIKE", sub: "BEFORE THE PARTY", sfx: "laugh", go(s, api, u) {
            s.sike = easeOut(u);
            s.hideCorpse = false;
            s.scaleX = 1 + Math.sin(t * 18) * 0.08;
          }},
          { t: 2.6, cap: "OK FINE", sub: "FAKE VICTORY", sfx: "win", go(s, api, u) {
            s.sike = 0;
            s.hideCorpse = true;
            s.fakeWin = u;
            s.confetti = true;
          }},
          { t: 5.4, cap: "NEW BEST", sub: "AT BEING WRONG", sfx: "coin", go(s, api, u) {
            s.fakeWin = 1;
            s.newBest = u;
            s.hideCorpse = true;
          }},
          { t: 7.6, cap: "WAIT.", sub: "WRONG DOOR", sfx: "glitch", go(s, api, u) {
            s.glitch = u;
            s.hideCorpse = u < 0.6;
            s.caption = u > 0.5 ? s.insult : "WAIT.";
          }},
        ]);
      },
      function (s, api, t) {
        s.letterbox = 0;
        beat(s, api, t, [
          { t: 0, cap: "LEVEL COMPLETE", sub: "LOADING LIE", sfx: "win", go(s, api, u) {
            s.white = 1 - u;
            s.hideCorpse = true;
            s.fakeWin = u;
            s.confetti = u > 0.3;
          }},
          { t: 3, cap: "GLITCH", sub: "THE DOOR BUFFERED", sfx: "glitch", go(s, api, u) {
            s.fakeWin = 1;
            s.glitch = u;
            s.hideCorpse = true;
          }},
          { t: 5.6, cap: "SIKE", sub: "THAT DOOR WAS LYING", sfx: "laugh", go(s, api, u) {
            s.hideCorpse = false;
            s.sike = u;
            s.glitch = 1 - u;
          }},
          { t: 8, cap: "", sub: "YOU BELIEVED THE FAKE", sfx: "fail", go(s, api, u) {
            s.caption = s.insult;
            s.sike = 1;
            s.rot += 0.18;
          }},
        ]);
      },
    ],
    reverse: [
      function (s, api, t) {
        s.letterbox = 1;
        beat(s, api, t, [
          { t: 0, cap: "ARROWS", sub: "THEY DISAGREE", sfx: "reverse", go(s, api, u) {
            s.arrows = easeOut(u);
            s.camRot = Math.sin(t * 3) * 0.06;
          }},
          { t: 2.8, cap: "GPS", sub: "RECALCULATING FOREVER", sfx: "reverse", go(s, api, u) {
            s.arrows = 0;
            s.gps = u;
          }},
          { t: 5.6, cap: "WALL", sub: "FORWARD IS A WALL", sfx: "land", go(s, api, u) {
            s.gps = 0;
            s.wall = 1;
            s.x = s.x0 + Math.sin(t * 4) * 20;
            s.facing = Math.sin(t * 4) > 0 ? 1 : -1;
            s.pose = { gait: Math.sin(t * 8), air: false, blink: false };
          }},
          { t: 8.2, cap: "", sub: "YOU DIDN'T NOTICE", sfx: "fail", go(s, api, u) {
            s.caption = s.insult;
            s.swap = u;
          }},
        ]);
      },
      function (s, api, t) {
        s.letterbox = 1;
        beat(s, api, t, [
          { t: 0, cap: "PATCH NOTES", sub: "LEFT IS RIGHT", sfx: "type", go(s, api, u) {
            s.swap = easeOut(u);
            s.zoom = 1.4;
          }},
          { t: 3, cap: "DEMO", sub: "WATCH THE WRONG WAY", sfx: "reverse", go(s, api, u) {
            s.arrows = u;
            s.x = s.x0 + Math.sin(t * 2.4) * 30;
            s.facing = Math.sin(t * 2.4) > 0 ? -1 : 1;
          }},
          { t: 5.8, cap: "U-TURN", sub: "YOU CAN'T", sfx: "laugh", go(s, api, u) {
            s.gps = u;
            s.wall = 1;
          }},
          { t: 8.1, cap: "", sub: "", sfx: "fail", go(s, api, u) {
            s.caption = s.insult;
            s.camRot = Math.sin(t * 5) * 0.1;
            s.rot += 0.05;
          }},
        ]);
      },
    ],
    still: [
      function (s, api, t) {
        s.letterbox = 1;
        s.pose = { gait: 0, air: false, blink: t % 2 < 0.08 };
        beat(s, api, t, [
          { t: 0, cap: "MOSS", sub: "IT STARTED WITHOUT YOU", sfx: "crumble", go(s, api, u) {
            s.moss = easeOut(u);
            s.zoom = 1.5;
          }},
          { t: 3, cap: "DOCUMENTARY", sub: "THE STILL DEMON", sfx: "tick", go(s, api, u) {
            s.dust = 1;
            s.moss = 1;
            s.doc = u * 0.4;
            s.zoom = lerp(1.5, 1.9, u);
          }},
          { t: 5.8, cap: "NARRATOR", sub: "IT REFUSED TO MOVE", sfx: "laugh", go(s, api, u) {
            s.doc = u;
            s.moss = 1;
          }},
          { t: 8.1, cap: "", sub: "HERE LIES MOTION", sfx: "crumble", go(s, api, u) {
            s.caption = s.insult;
            s.y += 2.2;
            s.rot = u * 0.5;
          }},
        ]);
      },
      function (s, api, t) {
        s.letterbox = 1;
        s.pose = { gait: 0, air: false, blink: false };
        beat(s, api, t, [
          { t: 0, cap: "AFK", sub: "THE LEVEL NOTICED", sfx: "tick", go(s, api, u) {
            s.doc = easeOut(u);
            s.zoom = lerp(1.1, 1.6, u);
          }},
          { t: 2.8, cap: "DUST", sub: "SETTLING ON SKILL", sfx: "tick", go(s, api, u) {
            s.doc = 0;
            s.dust = 1;
            s.zoom = 1.75;
          }},
          { t: 5.4, cap: "MOSS SPEEDRUN", sub: "WORLD RECORD: YOU", sfx: "crumble", go(s, api, u) {
            s.moss = u;
            s.sub = "T+" + t.toFixed(1) + "s STILL";
          }},
          { t: 8, cap: "", sub: "", sfx: "fail", go(s, api, u) {
            s.caption = s.insult;
            s.y += 2;
            s.rot = u * 0.35;
          }},
        ]);
      },
    ],
    jump: [
      function (s, api, t) {
        s.letterbox = 1;
        beat(s, api, t, [
          { t: 0, cap: "NO", sub: "THAT JUMP", sfx: "fail", go(s, api, u) {
            s.bigX = easeOut(u);
            s.zoom = 1.6;
            s.y = s.y0 - 40;
            s.circle = { r: 40, pulse: true };
          }},
          { t: 2.8, cap: "THE PATH", sub: "WAS THE FLOOR", sfx: "laugh", go(s, api, u) {
            s.bigX = 1;
            s.path = u;
            s.y = s.y0 + 8;
            s.pose = { gait: Math.sin(t * 6), air: false, blink: false };
          }},
          { t: 5.6, cap: "REPLAY", sub: "YOU DID IT ANYWAY", sfx: "jump", go(s, api, u) {
            s.replay = 1;
            s.path = 0;
            s.y = s.y0 + 10 - Math.sin(u * Math.PI) * 64;
            s.pose = { gait: 0, air: true, blink: false };
          }},
          { t: 8.1, cap: "", sub: "WALKING WAS LEGAL", sfx: "trombone", go(s, api, u) {
            s.caption = s.insult;
            s.y += 3;
            s.rot += 0.08;
          }},
        ]);
      },
      function (s, api, t) {
        s.letterbox = 1;
        beat(s, api, t, [
          { t: 0, cap: "WALK THIS", sub: "SEE? LEGAL.", sfx: "land", go(s, api, u) {
            s.path = u;
            s.x = s.x0 - 20 + u * 40;
            s.pose = { gait: Math.sin(t * 8), air: false, blink: false };
            s.y = s.y0;
          }},
          { t: 3.2, cap: "YOU JUMPED", sub: "OFF THE LEGAL PART", sfx: "jump", go(s, api, u) {
            s.path = 0;
            s.replay = 1;
            s.y = s.y0 - Math.sin(u * Math.PI) * 76;
          }},
          { t: 6, cap: "MARKED", sub: "UNNECESSARY", sfx: "fail", go(s, api, u) {
            s.bigX = u;
            s.zoom = 1.75;
            s.y = s.y0 - 50;
            s.circle = { r: 36, pulse: true };
          }},
          { t: 8.2, cap: "", sub: "THAT JUMP WAS THE TRAP", sfx: "trombone", go(s, api, u) {
            s.caption = s.insult;
            s.y += 4;
          }},
        ]);
      },
    ],
    generic: [
      function (s, api, t) {
        s.letterbox = 0.3;
        beat(s, api, t, [
          { t: 0, cap: "CREDITS", sub: "FOR A WIN YOU DIDN'T GET", sfx: "fanfare", go(s, api, u) {
            s.credits = u;
            s.hideCorpse = true;
          }},
          { t: 3.2, cap: "ALMOST", sub: "99%", sfx: "win", go(s, api, u) {
            s.credits = 0;
            s.progress = Math.min(0.99, easeOut(u) * 0.99);
            s.sub = Math.floor(s.progress * 100) + "%";
            s.hideCorpse = true;
          }},
          { t: 6, cap: "DVD", sub: "BOUNCE", sfx: "glitch", go(s, api, u) {
            s.dvd = 1;
            s.hideCorpse = true;
            s.progress = 0.99;
          }},
          { t: 8.2, cap: "", sub: "THAT WAS ON YOU", sfx: "fail", go(s, api, u) {
            s.caption = s.insult;
            s.dvd = 0;
            s.hideCorpse = false;
            s.scaleX = 1 + Math.sin(t * 24) * 0.18;
          }},
        ]);
      },
      function (s, api, t) {
        s.letterbox = 0.3;
        beat(s, api, t, [
          { t: 0, cap: "", sub: "", sfx: "glitch", go(s, api, u) {
            s.dvd = 1;
            s.hideCorpse = true;
          }},
          { t: 2.8, cap: "LOADING WIN", sub: "STUCK AT 99", sfx: "win", go(s, api, u) {
            s.dvd = 0;
            s.progress = 0.5 + u * 0.49;
            s.sub = Math.floor(s.progress * 100) + "%";
            s.hideCorpse = true;
          }},
          { t: 5.6, cap: "SPECIAL THANKS", sub: "THE FLOOR", sfx: "fanfare", go(s, api, u) {
            s.credits = u;
            s.hideCorpse = true;
            s.progress = 0.99;
          }},
          { t: 8.1, cap: "", sub: "SKILL ISSUE", sfx: "fail", go(s, api, u) {
            s.caption = s.insult;
            s.credits = 0;
            s.hideCorpse = false;
            if (crossed(s, 8.18)) puff(api, s, "#e31b1b", 12, 5);
          }},
        ]);
      },
    ],
  };

  const POOL = {};
  Object.keys(POSE).forEach((kind) => {
    POOL[kind] = [POSE[kind]].concat(ALT[kind] || []);
  });

  root.DeathRoast = {
    DURATION: DUR,
    lines: LINES,
    variantCount(kind) {
      const pool = POOL[kind] || POOL.generic;
      return pool.length;
    },
    start(kind, info) {
      return {
        kind,
        t: 0,
        tPrev: -1,
        x: info.x,
        y: info.y,
        x0: info.x,
        y0: info.y,
        facing: info.facing,
        rot: 0,
        scaleX: 1,
        scaleY: 1,
        alpha: 1,
        squash: info.squash || 0,
        split: 0,
        zoom: 1.18,
        camX: 0,
        camY: 0,
        camRot: 0,
        caption: "",
        sub: "",
        insult: info.insult || "",
        levelName: info.levelName || "",
        taunt: info.taunt || "",
        seed: info.seed || 1,
        var: null,
        sawX: info.sawX || info.x,
        sawY: info.sawY || info.y,
        pose: { gait: 0, air: true, blink: false },
        letterbox: 0,
        black: 0,
      };
    },
    tick(s, api) {
      s.tPrev = s.t;
      s.t += api.FIXED;
      TICK(s, api);
    },
    drawWorld(ctx, s, api) { WORLD(ctx, s, api); },
    drawScreen(ctx, s, api) { SCREEN(ctx, s, api); },
  };
})(typeof window !== "undefined" ? window : globalThis);
