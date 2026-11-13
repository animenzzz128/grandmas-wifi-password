// Page-side helpers for cdp.mjs, injected with {"evalFile": "page-helpers.js"}.
// Needs the dev build's hooks: __game (zustand store), __camera, __view(x, z, yaw, pitch).
// __pt.settle(ms) · __pt.fps(ms) · __pt.state() · __pt.note() · __pt.log(n) · __pt.ask(text) · __pt.trace(ms)
window.__pt = {
  /** Keep frames running for `ms`. Use instead of a plain wait: Chrome may pause rendering while its window is hidden behind others. */
  settle(ms = 300) {
    return new Promise((done) => {
      const t0 = performance.now();
      const tick = (now) => (now - t0 < ms ? requestAnimationFrame(tick) : done(true));
      requestAnimationFrame(tick);
      setTimeout(() => done(false), ms + 500); // false = no frames ran (window hidden?)
    });
  },
  /** Frame rate and worst frame over `ms`. */
  fps(ms = 3000) {
    return new Promise((done) => {
      let f = 0, worst = 0, last = performance.now();
      const t0 = last;
      const tick = (now) => {
        f++;
        worst = Math.max(worst, now - last);
        last = now;
        if (now - t0 < ms) requestAnimationFrame(tick);
        else done({ fps: Math.round((f * 1000) / (now - t0)), worstMs: Math.round(worst) });
      };
      requestAnimationFrame(tick);
    });
  },
  state() {
    const g = __game.getState();
    const r = g.run;
    return {
      status: r?.status, stamina: r?.stamina, naps: r?.naps, cookies: r?.cookies, q: r?.questionCount, attempts: r?.attemptsLeft,
      focus: g.focusId, panel: g.panel?.type ?? null, locked: g.locked, busy: g.busy,
      pos: __camera.position.toArray().map((v) => +v.toFixed(2)),
    };
  },
  note() {
    const r = __game.getState().run;
    return { note: r.note, len: r.passwordLength, difficulty: r.difficulty };
  },
  log(n = 6) {
    return __game.getState().log.slice(-n).map((l) => `${l.who}${l.cost ? `(-${l.cost})` : ""}: ${l.text}`);
  },
  async ask(text) {
    const t0 = performance.now();
    await __game.getState().ask(text);
    return { ms: Math.round(performance.now() - t0), log: this.log(2), stamina: __game.getState().run.stamina };
  },
  /** Moves the player while recording position and yaw every frame, to measure input response. */
  trace(ms = 1500) {
    return new Promise((done) => {
      const out = [];
      const t0 = performance.now();
      const tick = (now) => {
        out.push([Math.round(now - t0), +__camera.position.x.toFixed(3), +__camera.position.z.toFixed(3), +__camera.rotation.y.toFixed(3)]);
        if (now - t0 < ms) requestAnimationFrame(tick);
        else done(out);
      };
      requestAnimationFrame(tick);
    });
  },
};
"ok";
