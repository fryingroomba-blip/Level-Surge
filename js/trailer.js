/* Plays the real rooms. Lines are the game's own. */
(() => {
  const PLAY = window.SURGE_PLAY;
  const lineEl = document.getElementById("trailer-line");
  const skipEl = document.getElementById("trailer-skip");
  const cardEl = document.getElementById("trailer-card");
  const flashEl = document.getElementById("trailer-flash");
  const canvas = document.getElementById("game");
  if (!PLAY || !lineEl || !skipEl || !cardEl || !canvas) return;

  // Real rooms. Lines are me talking about the game — not leftover room taunts.
  const shots = [
    { id: "in", card: "black", dur: 0.45, hush: true },
    { id: "trust", dim: 1, room: 0, bot: true, dur: 7, min: 1.3, hold: 1.25, voice: "line", line: "I made the floor lie.", lineAt: 0.4 },
    { id: "jump", dim: 1, room: 1, bot: true, dur: 7, min: 1.2, hold: 1.2, voice: "line", line: "Every jump is a dare.", lineAt: 0.35 },
    { id: "wait", dim: 1, room: 3, bot: true, dur: 12, min: 2.2, winHold: 1.55, voice: "line", line: "Waiting is how I get you.", lineAt: 0.45, winLine: "You waited. I hate that." },
    { id: "knock", dim: 1, room: 2, bot: true, dur: 7, min: 1.2, hold: 1.35, voice: "line", line: "I made the door lie too.", lineAt: 0.3 },
    { id: "shiny", dim: 1, room: 4, bot: true, dur: 9, min: 2, winHold: 1.45, voice: "line", line: "Pretty things are bait.", lineAt: 0.35, winLine: "The shiny ones were a rumor." },
    { id: "yeet", dim: 1, room: 8, bot: true, dur: 7, min: 1.15, hold: 1.2, voice: "line", line: "Physics works for me.", lineAt: 0.3 },
    { id: "back", dim: 1, room: 5, bot: true, dur: 7, min: 1.2, hold: 1.2, voice: "line", line: "Left is a rumor now.", lineAt: 0.3 },
    { id: "gap1", card: "black", dur: 0.28, hush: true },
    { id: "ash", dim: 2, room: 0, bot: true, dur: 8, min: 1.4, hold: 1.2, voice: "line", line: "Twenty dimensions. They get meaner.", lineAt: 0.35 },
    { id: "frost", dim: 3, room: 2, bot: true, dur: 8, min: 1.35, hold: 1.2, voice: "line", line: "Dash starts in world 3. Sorry.", lineAt: 0.28 },
    { id: "come", dim: 1, room: 10, bot: true, dur: 9, min: 1.8, winHold: 1.45, voice: "line", line: "World 1 I built by hand.", lineAt: 0.35, winLine: "You came back." },
    { id: "through", dim: 1, room: 14, bot: true, dur: 9, min: 1.8, winHold: 1.45, voice: "line", line: "Walls are optional. I checked.", lineAt: 0.35, winLine: "The wall was paint." },
    { id: "gap2", card: "black", dur: 0.28, hush: true },
    { id: "hunger", dim: 12, room: 0, bot: true, dur: 7, min: 1.2, hold: 1.15, voice: "line", line: "Later worlds stack traps on traps.", lineAt: 0.25 },
    { id: "last", dim: 20, room: 0, bot: true, dur: 6, min: 1.05, hold: 1.15, voice: "line", line: "Last Light. I'm a little scared too.", lineAt: 0.22 },
    { id: "stop", dim: 1, room: 12, bot: true, dur: 9, min: 1.8, winHold: 1.5, voice: "line", line: "Standing still is dying.", lineAt: 0.35, winLine: "You didn't stop." },
    { id: "gap3", card: "black", dur: 0.34, hush: true },
    { id: "boss", dim: 1, room: 16, bot: true, dur: 18, min: 5, intro: 0, hold: 1.45, voice: "line", line: "Then the boss steals your door.", lineAt: 0.8 },
    { id: "out", card: "black", dur: 0.4, hush: true },
    { id: "title", card: "title", dur: 5.4, min: 2.2, hush: true },
  ];

  let on = false;
  let index = 0;
  let elapsed = 0;
  let dimNow = 0;
  let dieAt = null;
  let winAt = null;
  let markAt = null;
  let heard = false;
  let steps = [];
  let si = 0;
  let left = 0;
  let shown = "";
  let flashT = 0;
  let titleTimers = [];

  function clearTitleTimers() {
    for (let i = 0; i < titleTimers.length; i++) clearTimeout(titleTimers[i]);
    titleTimers.length = 0;
    const beats = cardEl.querySelectorAll(".trailer-beat");
    for (let i = 0; i < beats.length; i++) {
      beats[i].classList.remove("is-on");
      beats[i].style.opacity = "";
      beats[i].style.transform = "";
    }
  }

  function armTitleBeats() {
    clearTitleTimers();
    const beats = cardEl.querySelectorAll(".trailer-beat");
    const delays = [80, 280, 620, 1050];
    for (let i = 0; i < beats.length; i++) {
      const el = beats[i];
      const wait = delays[i] != null ? delays[i] : 80 + i * 260;
      titleTimers.push(setTimeout(() => {
        el.classList.add("is-on");
        // Guarantee readable type even if CSS transitions are frozen.
        el.style.opacity = "1";
        el.style.transform = "none";
      }, wait));
    }
  }

  function parseSol(sol) {
    if (!sol) return [];
    return String(sol).trim().split(/\s+/).filter(Boolean).map((tok) => {
      const m = tok.match(/^(JR|JL|J|R|L|W|D)(\d+)$/i);
      if (!m) return { ix: 0, jump: false, dash: false, frames: 1 };
      const n = +m[2];
      const k = m[1].toUpperCase();
      if (k === "R") return { ix: 1, jump: false, dash: false, frames: n };
      if (k === "L") return { ix: -1, jump: false, dash: false, frames: n };
      if (k === "JR" || k === "J") return { ix: 1, jump: true, dash: false, frames: n };
      if (k === "JL") return { ix: -1, jump: true, dash: false, frames: n };
      if (k === "D") return { ix: 1, jump: false, dash: true, frames: Math.max(1, n) };
      return { ix: 0, jump: false, dash: false, frames: n };
    });
  }

  function armSol(sol) {
    steps = parseSol(sol);
    si = 0;
    left = steps.length ? steps[0].frames : 0;
  }

  function drive() {
    if (!steps.length || si >= steps.length) return { ix: 0, jump: false, dash: false };
    const cur = steps[si];
    left -= 1;
    if (left <= 0) {
      si += 1;
      left = si < steps.length ? steps[si].frames : 0;
    }
    return cur;
  }

  function show(text, kind) {
    const key = kind + "\n" + text;
    if (key === shown) return;
    shown = key;
    if (!text) {
      lineEl.className = "hidden";
      lineEl.textContent = "";
      return;
    }
    lineEl.className = kind;
    lineEl.textContent = text;
    // Retrigger snap-in without a layout thrash mid-frame.
    lineEl.classList.remove("is-in");
    void lineEl.offsetWidth;
    lineEl.classList.add("is-in");
  }

  function showCard(shot) {
    clearTitleTimers();
    cardEl.classList.remove("hidden", "is-black", "is-title");
    cardEl.classList.add(shot.card === "title" ? "is-title" : "is-black");
    if (shot.card === "title") armTitleBeats();
  }

  function hideCard() {
    clearTitleTimers();
    cardEl.classList.add("hidden");
    cardEl.classList.remove("is-black", "is-title");
  }

  function cutFlash() {
    if (!flashEl) return;
    flashEl.classList.remove("hidden", "is-on");
    void flashEl.offsetWidth;
    flashEl.classList.add("is-on");
    flashT = 0.12;
  }

  function skipText() {
    skipEl.textContent = heard ? "click cuts · esc leaves" : "tap for sound";
  }

  function markHash() {
    if (!/#trailer\b/.test(location.hash)) {
      history.replaceState(null, "", location.pathname + location.search + "#trailer");
    }
  }

  function clearHash() {
    if (/#trailer\b/.test(location.hash)) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  function begin(shot) {
    elapsed = 0;
    dieAt = null;
    winAt = null;
    markAt = null;
    shown = "";
    document.body.classList.toggle("trailer-quiet", !!shot.quiet);
    if (shot.hush) PLAY.hush(true);
    else PLAY.hush(false);
    if (shot.card) {
      armSol("");
      PLAY.still();
      show("", "");
      showCard(shot);
      return;
    }
    hideCard();
    armSol(shot.sol || "");
    const opts = { lock: !!shot.lock, intro: shot.intro };
    if (shot.dim !== dimNow) {
      PLAY.enter(shot.dim, shot.room, opts);
      dimNow = shot.dim;
    } else {
      PLAY.load(shot.room, opts);
    }
    if (shot.lock) PLAY.still();
  }

  function finish() {
    if (!on) return;
    on = false;
    document.body.classList.remove("trailer-live", "trailer-quiet");
    hideCard();
    show("", "");
    skipEl.classList.add("hidden");
    if (flashEl) {
      flashEl.classList.add("hidden");
      flashEl.classList.remove("is-on");
    }
    clearHash();
    PLAY.hush(false);
    PLAY.finishToTitle();
  }

  function restart() {
    index = 0;
    dimNow = 0;
    PLAY.resetClock();
    begin(shots[0]);
  }

  function advance() {
    const prev = shots[index];
    index += 1;
    if (index >= shots.length) {
      restart();
      return;
    }
    const next = shots[index];
    // Hard punctuation between live rooms / into black / off the title loop.
    if (prev && next && !prev.card && (!next.card || next.card === "black")) cutFlash();
    else if (prev && next && prev.card === "title") cutFlash();
    begin(next);
  }

  function caption(shot) {
    if (shot.voice === "line") return shot.line || "";
    return shot.line || "";
  }

  function tick(dt) {
    if (!on) return false;
    const shot = shots[index];
    if (!shot) { finish(); return true; }
    elapsed += dt;
    if (flashT > 0) {
      flashT -= dt;
      if (flashT <= 0 && flashEl) flashEl.classList.remove("is-on");
    }
    if (index > 0) skipEl.classList.add("hidden");
    if (shot.card) {
      show("", "");
      if (shot.dur && elapsed >= Math.max(shot.dur, shot.min || 0)) advance();
      return true;
    }
    if (shot.lock) PLAY.still();
    else if (shot.bot) {
      const d = PLAY.brain();
      PLAY.poke(d.ix, d.jump, d.dash);
    } else {
      const d = drive();
      PLAY.poke(d.ix, d.jump, d.dash);
    }
    const st = PLAY.state();
    if (st.dead && dieAt == null) dieAt = elapsed;
    if (st.win && winAt == null) winAt = elapsed;
    if (shot.until === "fake" && st.fake && markAt == null) markAt = elapsed;
    const afterDeath = shot.hold != null ? shot.hold : 0.72;
    const afterWin = shot.winHold != null ? shot.winHold : 0.48;
    const deadDone = dieAt != null && elapsed >= Math.max(shot.min || 0, dieAt + afterDeath);
    const winDone = winAt != null && elapsed >= afterWin && elapsed >= winAt + afterWin;
    const markDone = markAt != null && elapsed >= Math.max(shot.min || 0, markAt + 0.4);
    const timeDone = dieAt == null && winAt == null && markAt == null && shot.dur && elapsed >= Math.max(shot.dur, shot.min || 0);
    if (deadDone || winDone || markDone || timeDone) {
      advance();
      return true;
    }
    const lineAt = shot.lineAt != null ? shot.lineAt : 0.32;
    const lineReady = shot.until === "fake" ? !!st.fake : elapsed >= lineAt;
    if (st.win && shot.winLine) show(shot.winLine, "lore");
    else if (st.dead && st.insult) show(st.insult, "insult");
    else if (!shot.voice || !lineReady) show("", "");
    else show(caption(shot), "lore");
    return false;
  }

  function cut() {
    if (!on || elapsed < 0.14) return;
    advance();
  }

  function start() {
    if (on) return;
    on = true;
    index = 0;
    dimNow = 0;
    heard = PLAY.audioLive();
    document.body.classList.add("trailer-live");
    skipEl.classList.remove("hidden");
    skipText();
    markHash();
    PLAY.audioOn();
    PLAY.resetClock();
    begin(shots[0]);
    heard = PLAY.audioLive();
    skipText();
  }

  document.getElementById("app").addEventListener("pointerdown", (e) => {
    if (!on) return;
    if (e.target && e.target.closest && e.target.closest("button, a")) return;
    PLAY.audioOn();
    if (!heard) {
      heard = true;
      skipText();
      return;
    }
    cut();
  });

  const btn = document.getElementById("trailer-btn");
  if (btn) btn.addEventListener("click", start);

  window.SURGE_TRAILER = {
    get on() { return on; },
    get lock() { return !!(on && shots[index] && shots[index].lock); },
    get wantsRoast() { return !!(on && shots[index] && shots[index].roast); },
    tick,
    cut,
    stop: finish,
    start,
    status() {
      const shot = shots[index];
      const st = PLAY.state();
      return {
        on, index, id: shot && shot.id, card: shot && shot.card || "",
        t: Math.round(elapsed * 100) / 100,
        name: st.name, dim: st.dim, dead: st.dead, win: st.win, traps: st.traps,
        fake: st.fake, rev: st.rev, flip: st.flip, saws: st.saws, insult: st.insult,
        line: lineEl.textContent || "",
      };
    },
  };

  if (typeof location !== "undefined" && /#trailer\b/.test(location.hash)) start();
})();
