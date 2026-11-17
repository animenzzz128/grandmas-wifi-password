/**
 * Tiny Chrome DevTools Protocol driver for automated playtests. No dependencies (Node 22+).
 *
 * 1. Start Chrome with a debugging port and a throwaway profile (see launch-chrome.ps1 / SKILL.md).
 * 2. Write the steps as a JSON array in a file, then: node cdp.mjs steps.json
 *
 * Steps (run in order, results printed as JSON lines):
 *   {"evalFile": "page-helpers.js"}           inject helpers (window.__pt) into the page
 *   {"eval": "<js>", "label": "name"}         run JS in the page (awaits promises), print the result
 *   {"key": "KeyE", "ms": 60}                 tap a key (or ["KeyW","ShiftLeft"] together), held for ms
 *   {"down": "KeyW"} / {"up": "KeyW"}         hold / release
 *   {"text": "hello"}                         type text into the focused element
 *   {"click": [x, y]}                         click at CSS pixels (gives user activation, e.g. pointer lock)
 *   {"move": [dx, dy], "hold": ["KeyW"], "ms": 1000, "steps": 50}   mouse motion while holding keys
 *   {"restore": true}                         un-minimise and focus the window (minimised windows render nothing)
 *   {"cdp": {"method": "Page.bringToFront"}}  raw DevTools call
 *   {"wait": 500}                             sleep
 *   {"shot": "file.jpg"}                      screenshot of the page
 *
 * Caveat: synthetic mouse motion under pointer lock is unreliable (Chrome re-centres the cursor),
 * so it proves that look + walk work together but cannot judge sensitivity or smoothness.
 * Env: CDP_PORT (default 9333), CDP_URL_MATCH (default "localhost:5173").
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const PORT = Number(process.env.CDP_PORT ?? 9333);
const arg = process.argv[2];
const steps = JSON.parse(existsSync(arg) ? readFileSync(arg, "utf8") : arg);

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.find((t) => t.type === "page" && t.url.includes(process.env.CDP_URL_MATCH ?? "localhost:5173")) ?? targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
};
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const KEYS = {
  KeyW: ["w", 87], KeyA: ["a", 65], KeyS: ["s", 83], KeyD: ["d", 68], KeyE: ["e", 69],
  ShiftLeft: ["Shift", 16], Enter: ["Enter", 13], Escape: ["Escape", 27], F3: ["F3", 114], Space: [" ", 32],
  ArrowUp: ["ArrowUp", 38], ArrowDown: ["ArrowDown", 40], Tab: ["Tab", 9],
};
const key = (type, code) => {
  const [k, vk] = KEYS[code] ?? [code, 0];
  const text = type !== "keyDown" ? undefined : k.length === 1 ? k : code === "Enter" ? String.fromCharCode(13) : undefined;
  return send("Input.dispatchKeyEvent", { type, code, key: k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(text ? { text } : {}) });
};

const view = await send("Runtime.evaluate", { expression: "[innerWidth, innerHeight]", returnByValue: true });
let [mx, my] = view.result.value.map((v) => Math.round(v / 2));

const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) return { error: r.exceptionDetails.exception?.description ?? r.exceptionDetails.text };
  return r.result.value;
};

for (const s of steps) {
  if (s.evalFile) console.log(JSON.stringify({ evalFile: s.evalFile, out: await evaluate(readFileSync(s.evalFile, "utf8")) }));
  else if (s.eval) console.log(JSON.stringify({ eval: s.label ?? s.eval.slice(0, 40), out: await evaluate(s.eval) }));
  else if (s.restore) {
    const { windowId } = await send("Browser.getWindowForTarget");
    await send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
    await send("Page.bringToFront");
    await sleep(300);
  } else if (s.cdp) console.log(JSON.stringify({ cdp: s.cdp.method, out: await send(s.cdp.method, s.cdp.params ?? {}) }));
  else if (s.wait) await sleep(s.wait);
  else if (s.key) {
    for (const k of [s.key].flat()) await key("keyDown", k);
    await sleep(s.ms ?? 60);
    for (const k of [s.key].flat()) await key("keyUp", k);
  } else if (s.down) await key("keyDown", s.down);
  else if (s.up) await key("keyUp", s.up);
  else if (s.text) await send("Input.insertText", { text: s.text });
  else if (s.click) {
    [mx, my] = s.click;
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: mx, y: my });
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: mx, y: my, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: mx, y: my, button: "left", clickCount: 1 });
  } else if (s.move) {
    // relative mouse motion spread over `ms`, optionally while holding keys
    const [dx, dy] = s.move;
    const n = s.steps ?? 20;
    for (const k of [s.hold ?? []].flat()) await key("keyDown", k);
    for (let i = 0; i < n; i++) {
      mx += dx / n;
      my += dy / n;
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: mx, y: my });
      await sleep((s.ms ?? 300) / n);
    }
    for (const k of [s.hold ?? []].flat()) await key("keyUp", k);
  } else if (s.shot) {
    const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 80 });
    writeFileSync(s.shot, Buffer.from(r.data, "base64"));
    console.log(JSON.stringify({ shot: s.shot }));
  }
}
ws.close();
