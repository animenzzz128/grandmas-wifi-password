// Page-side helpers for cdp.mjs, injected with {"evalFile": "page-helpers.js"}.
// Needs the dev build's hooks: __game (zustand store), __settings, __three ({ gl, scene, camera, advance }).
// Since iteration 54 the player doesn't walk: the camera moves between views and the player taps things.
// __pt.settle(ms) · __pt.fps(ms) · __pt.frameMs(n) · __pt.state() · __pt.note() · __pt.log(n) · __pt.ask(text)
// __pt.card(id, mode) · __pt.view(id) · __pt.tap(objectId, pointerType) · __pt.trace(ms)
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
  /** Frame rate and worst frame over `ms` (only meaningful when the window is visible). */
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
  /** GPU time of a whole frame, post-processing included, even in a hidden window: draws `n` frames and waits for the GPU. */
  frameMs(n = 5) {
    const t = __three;
    const g = t.gl.getContext();
    const px = new Uint8Array(4);
    const sync = () => g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
    t.advance();
    sync();
    const s = performance.now();
    for (let i = 0; i < n; i++) t.advance();
    sync();
    return { ms: Math.round((performance.now() - s) / n), dpr: t.gl.getPixelRatio(), calls: t.gl.info.render.calls, quality: __settings.getState().quality };
  },
  state() {
    const g = __game.getState();
    const r = g.run;
    return {
      status: r?.status, stamina: r?.stamina, naps: r?.naps, cookies: r?.cookies, calls: r?.callsLeft, q: r?.questionCount, attempts: r?.attemptsLeft,
      view: g.view, focus: g.focusId, panel: g.panel?.type ?? null, picked: g.pickedTopic, busy: g.busy,
      cards: r?.topics.length, fresh: r?.topics.filter((c) => c.fresh).map((c) => c.label),
      pos: window.__three ? __three.camera.position.toArray().map((v) => +v.toFixed(2)) : null,
    };
  },
  note() {
    const r = __game.getState().run;
    return { note: r.note, len: r.passwordLength, difficulty: r.difficulty, noteId: r.noteId };
  },
  log(n = 6) {
    return __game.getState().log.slice(-n).map((l) => `${l.who}${l.cost ? `(-${l.cost})` : ""}: ${l.text}`);
  },
  async ask(text) {
    const t0 = performance.now();
    await __game.getState().ask(text);
    return { ms: Math.round(performance.now() - t0), log: this.log(2), stamina: __game.getState().run.stamina };
  },
  /** Ask with a topic card: "about" (Tell me about it) or "when" (When was that?). */
  async card(id, mode = "about") {
    await __game.getState().askTopic(id, mode);
    return { log: this.log(3), state: this.state() };
  },
  view(id) {
    __game.getState().goView(id);
    return this.settle(1400);
  },
  /**
   * Tap an object through the real pointer path: project its centre to the screen and send pointer down/up to
   * the canvas. pointerType "touch" skips hover, like a phone. Returns where it tapped and what opened.
   */
  tap(objectId, pointerType = "mouse") {
    const t = __three;
    const it = __game.getState().scene.interactables.find((i) => i.id === objectId);
    const p = t.camera.position.clone().set(...it.position).project(t.camera);
    const c = t.gl.domElement;
    const r = c.getBoundingClientRect();
    const x = r.left + ((p.x + 1) / 2) * r.width;
    const y = r.top + ((1 - p.y) / 2) * r.height;
    const ev = (type) => c.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0, pointerId: 9, pointerType, isPrimary: true }));
    if (pointerType === "mouse") ev("pointermove");
    ev("pointerdown");
    ev("pointerup");
    const g = __game.getState();
    return { x: Math.round(x), y: Math.round(y), onScreen: Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1, hovered: g.focusId, panel: g.panel };
  },
  /** Camera position and look direction every frame for `ms` (a view change, a drag). */
  trace(ms = 1500) {
    return new Promise((done) => {
      const out = [];
      const t0 = performance.now();
      const cam = __three.camera;
      const tick = (now) => {
        out.push([Math.round(now - t0), +cam.position.x.toFixed(3), +cam.position.y.toFixed(3), +cam.position.z.toFixed(3), +cam.rotation.y.toFixed(3)]);
        if (now - t0 < ms) requestAnimationFrame(tick);
        else done(out);
      };
      requestAnimationFrame(tick);
    });
  },
};
"ok";
