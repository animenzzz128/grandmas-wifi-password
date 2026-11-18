/**
 * The camera and pointer, ported from the Godot edition (main.gd): instead of walking, the player moves between
 * composed views of the room (Living room, Grandma, Coffee table, …) with a smooth camera, taps things to look
 * closer, and drags to look around a little. The same controls work with a mouse, a trackpad and a touch screen.
 *
 * - No visit yet (title screen): the camera drifts slowly around the room.
 * - Tap or click an object: the camera moves in on it and its card opens. Grandma: the camera frames her.
 * - Drag: look around within the view (±0.5 rad across, ±0.3 up and down); it springs back on the next move.
 * - Keys 1–7 switch views (handled by the HUD, which owns the keyboard).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Raycaster, Vector2, Vector3 } from "three";
import type { Object3D, PerspectiveCamera } from "three";
import type { PublicScene } from "@gwp/engine";
import { useGame } from "../store.ts";
import { useSettings } from "../settings.ts";
import { HITBOX_LAYER } from "./Room.tsx";
import type { HouseInfo } from "./House.tsx";
import { viewer } from "../examine.ts";
import { whoosh } from "../audio.ts";

const DRAG_START = 10; // pixels before a press becomes a drag
const DRAG_SPEED = 0.0028; // radians per pixel
const MOVE_TIME = 1.05; // seconds per camera move
const DESIGN_ASPECT = 4 / 3; // the views were composed for this width:height (the Godot edition's)
/** Open floor in the middle of the living room, at eye height: long camera moves pass through here. */
const ROOM_MIDDLE = new Vector3(0.9, 1.65, 0.6);

interface Shot {
  pos: Vector3;
  look: Vector3;
  fov: number;
}

const reducedMotion = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

function interactIdOf(obj: Object3D | null): string | null {
  for (let o: Object3D | null = obj; o; o = o.parent) {
    const id = o.userData?.interactId;
    if (typeof id === "string") return id;
  }
  return null;
}

/** Where to stand to look at an object up close: back toward the camera, a little above, far enough to fit it. */
export function focusShot(center: Vector3, size: Vector3, from: Vector3): Shot {
  const dir = from.clone().sub(center);
  dir.y = Math.max(dir.y, 0.25);
  dir.normalize();
  const radius = Math.max(size.length() * 0.5, 0.12);
  const dist = (radius / Math.tan((18 * Math.PI) / 180)) * 0.9 + 0.15;
  return { pos: center.clone().addScaledVector(dir, dist), look: center.clone(), fov: 38 };
}

export function ViewRig({ scene, info }: { scene: PublicScene; info: HouseInfo | null }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const root = useThree((s) => s.scene);
  const playing = useGame((s) => Boolean(s.run));
  const view = useGame((s) => s.view);
  const calm = useSettings((s) => s.calmCamera);
  const views = useMemo(() => new Map((scene.views ?? []).map((v) => [v.id, v])), [scene]);

  const cam = useRef({ pos: new Vector3(3, 1.6, -2.5), look: new Vector3(), fov: 55, yaw: 0, pitch: 0, t: 0 });
  const move = useRef<{ from: Shot; to: Shot; k: number; via: Vector3 | null } | null>(null);
  const ray = useMemo(() => {
    const r = new Raycaster();
    r.layers.set(HITBOX_LAYER);
    return r;
  }, []);

  /** Shot for a view id, or for "focus:<object id>". */
  const shotFor = (id: string): Shot | null => {
    if (id.startsWith("focus:")) {
      const it = scene.interactables.find((i) => i.id === id.slice(6));
      if (!it) return null;
      const box = it.model ? info?.boxes.get(it.model) : undefined;
      const c = box ? box.getCenter(new Vector3()) : new Vector3(...it.position);
      const s = box ? box.getSize(new Vector3()) : new Vector3(...it.size);
      const from = it.view && views.get(it.view) ? new Vector3(...views.get(it.view)!.pos) : cam.current.pos;
      return focusShot(c, s, from);
    }
    const v = views.get(id);
    return v ? { pos: new Vector3(...v.pos), look: new Vector3(...v.look), fov: v.fov } : null;
  };

  // A new view: move the camera there (instantly with reduced motion).
  useEffect(() => {
    if (!playing) return;
    const to = shotFor(view);
    if (!to) return;
    const c = cam.current;
    c.yaw = 0;
    c.pitch = 0;
    if (calm || reducedMotion()) {
      Object.assign(c, { pos: to.pos.clone(), look: to.look.clone(), fov: to.fov });
      move.current = null;
      return;
    }
    // A long move bends through the middle of the room instead of cutting through walls and furniture.
    const via = c.pos.distanceTo(to.pos) > 2.2 ? c.pos.clone().lerp(to.pos, 0.5).lerp(ROOM_MIDDLE, 0.75) : null;
    move.current = { from: { pos: c.pos.clone(), look: c.look.clone(), fov: c.fov }, to, k: 0, via };
    whoosh();
  }, [view, playing, info]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pointer: hover highlights, a tap acts, a drag looks around.
  useEffect(() => {
    const el = gl.domElement;
    const ndc = new Vector2();
    let press: { x: number; y: number; id: number } | null = null;
    let dragging = false;
    const pick = (e: PointerEvent): string | null => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObject(root, true)[0];
      return hit ? interactIdOf(hit.object) : null;
    };
    const blocked = () => {
      const g = useGame.getState();
      return !g.run || g.run.status !== "playing" || Boolean(g.panel);
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || blocked()) return;
      press = { x: e.clientX, y: e.clientY, id: e.pointerId };
      dragging = false;
    };
    const moveEv = (e: PointerEvent) => {
      if (blocked()) {
        useGame.getState().setFocus(null);
        return;
      }
      if (press && e.pointerId === press.id) {
        const dx = e.clientX - press.x;
        const dy = e.clientY - press.y;
        if (!dragging && Math.hypot(dx, dy) > DRAG_START) {
          dragging = true;
          el.setPointerCapture?.(e.pointerId);
        }
        if (dragging) {
          const c = cam.current;
          const k = DRAG_SPEED * useSettings.getState().sensitivity;
          c.yaw = Math.max(-0.5, Math.min(0.5, c.yaw - e.movementX * k));
          c.pitch = Math.max(-0.3, Math.min(0.3, c.pitch - e.movementY * k * (useSettings.getState().invertY ? -1 : 1)));
          useGame.getState().setFocus(null);
          return;
        }
      }
      if (e.pointerType === "mouse") {
        const id = pick(e);
        useGame.getState().setFocus(id);
        el.style.cursor = id ? "pointer" : dragging ? "grabbing" : "grab";
      }
    };
    const up = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.id) return;
      const wasDrag = dragging;
      press = null;
      dragging = false;
      if (wasDrag || blocked()) return;
      const id = pick(e);
      if (id) useGame.getState().tapObject(id);
    };
    const leave = () => useGame.getState().setFocus(null);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", moveEv);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", () => (press = null));
    el.addEventListener("pointerleave", leave);
    el.style.touchAction = "none";
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", moveEv);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointerleave", leave);
    };
  }, [gl, camera, ray, root]);

  // The bottom dock's height (cards and conversation), to frame views above it.
  const size = useThree((s) => s.size);
  const dock = useRef(0);
  const offsetNow = useRef(-1);
  const smooth = useRef(0);
  useEffect(() => {
    if (!playing) return;
    let ro: ResizeObserver | null = null;
    const attach = () => {
      const el = document.querySelector(".hud .bottom");
      if (!el) return void setTimeout(attach, 200);
      ro = new ResizeObserver(() => (dock.current = el.getBoundingClientRect().height));
      ro.observe(el);
    };
    attach();
    return () => {
      ro?.disconnect();
      dock.current = 0;
    };
  }, [playing]);
  const dir = useMemo(() => new Vector3(), []);
  const right = useMemo(() => new Vector3(), []);
  const up = useMemo(() => new Vector3(0, 1, 0), []);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const c = cam.current;
    c.t += dt;
    if (!playing) {
      // Title screen: a slow drift around the room (main.gd title_mode).
      const a = c.t * 0.05;
      c.pos.set(0.3 + Math.cos(a) * 2.6, 1.55 + Math.sin(c.t * 0.13) * 0.1, 0.2 + Math.sin(a) * 1.7);
      c.look.set(-1.2, 0.9, -0.6);
      c.fov = 55;
    } else if (move.current) {
      const m = move.current;
      m.k = Math.min(1, m.k + dt / MOVE_TIME);
      const k = 0.5 - 0.5 * Math.cos(Math.PI * m.k); // sine in-out
      const arc = Math.sin(k * Math.PI) * 0.12;
      if (m.via) {
        // Quadratic Bézier from → via → to.
        const u = 1 - k;
        c.pos.copy(m.from.pos).multiplyScalar(u * u).addScaledVector(m.via, 2 * u * k).addScaledVector(m.to.pos, k * k);
      } else c.pos.lerpVectors(m.from.pos, m.to.pos, k).y += arc;
      c.look.lerpVectors(m.from.look, m.to.look, k);
      c.fov = m.from.fov + (m.to.fov - m.from.fov) * k;
      if (m.k >= 1) move.current = null;
    }
    const sway = calm || reducedMotion() ? 0 : 1;
    camera.position.set(c.pos.x + Math.sin(c.t * 0.37) * 0.008 * sway, c.pos.y + Math.sin(c.t * 0.53) * 0.006 * sway, c.pos.z);
    dir.copy(c.look).sub(c.pos).normalize().applyAxisAngle(up, c.yaw);
    right.crossVectors(dir, up).normalize();
    dir.applyAxisAngle(right, c.pitch);
    camera.lookAt(camera.position.x + dir.x, camera.position.y + dir.y, camera.position.z + dir.z);
    // Frame the view in the part of the screen above the bottom dock (cards and conversation): the image is
    // the lower part of a taller virtual one, so its centre sits half a dock higher, at the same scale.
    const h = size.height;
    const want = playing ? Math.min(dock.current * 0.85, h * 0.45) : 0;
    // Eased, so the picture glides when the conversation box grows or shrinks.
    smooth.current += (want - smooth.current) * Math.min(1, dt * 5);
    const d = Math.abs(want - smooth.current) < 0.5 ? want : smooth.current;
    // Views are composed for a 4:3 screen or wider. On a taller screen (a phone held upright) the field of view
    // opens up so the same things still fit across, as far as a sensible limit.
    const narrow = Math.min(2.2, Math.max(1, DESIGN_ASPECT / (size.width / Math.max(1, h - want))));
    const fov = Math.min(100, (2 * Math.atan(Math.tan((c.fov * Math.PI) / 360) * narrow * ((h + d) / h)) * 180) / Math.PI);
    if (Math.abs(camera.fov - fov) > 0.01 || Math.abs(offsetNow.current - d) > 0.5) {
      camera.fov = fov;
      if (d > 0) camera.setViewOffset(size.width, h + d, 0, d, size.width, h);
      else camera.clearViewOffset();
      offsetNow.current = d;
      camera.updateProjectionMatrix();
    }
    viewer.x = camera.position.x;
    viewer.z = camera.position.z;
  });
  return null;
}
