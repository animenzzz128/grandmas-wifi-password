/**
 * First-person player controller.
 *
 * - Mouse look: our own pointer-lock handling. Raw mouse deltas (unadjustedMovement, no OS acceleration)
 *   are accumulated between frames and applied once per frame, in the same place as walking, so turning
 *   and walking always stay in sync.
 * - Walking: WASD/arrows work whether or not the mouse is locked (but not while typing or reading a card).
 *   Velocity eases in and out instead of starting and stopping instantly. Shift walks faster.
 * - Interaction: a ray from the screen center picks what you're looking at. E interacts, Enter talks.
 *   Clues and cookies are carried to Grandma (E on her shows or gives; Q puts it back).
 * - Esc backs out one layer at a time: card, then talk mode. (With the mouse locked, the browser
 *   handles Esc itself and just frees the mouse.)
 */
import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Raycaster, Vector2 } from "three";
import type { Group, Object3D } from "three";
import { PLAYER_RADIUS } from "@gwp/engine";
import type { PublicScene } from "@gwp/engine";
import { useGame } from "../store.ts";
import { useSettings } from "../settings.ts";
import { HITBOX_LAYER } from "./Room.tsx";
import { viewer } from "../examine.ts";

const WALK_SPEED = 2.6; // m/s
const SPRINT_SPEED = 4.2; // m/s with Shift
const ACCEL = 14; // how quickly velocity catches up with input (1/s); higher = snappier
const LOOK_SENSITIVITY = 0.0022; // radians per mouse count
const MAX_PITCH = 1.45; // ~83 degrees
const REACH = 2.6; // how far away you can interact
const NEAR_GRANDMA = 2.4; // how close you must be to show or give her something (meters, floor distance)
const EARSHOT = 3.2; // how close you must be to talk to her
const EYE_HEIGHT = 1.6;
const GRANDMA_FACE_Y = 1.1; // her face, seated

/** The shortest signed turn from b to a, in radians. */
export function angleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const RADIUS = PLAYER_RADIUS;

interface Box2 {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Axis-aligned footprints of everything solid. Objects turned a quarter turn swap width and depth. */
function colliders(scene: PublicScene): Box2[] {
  return [...scene.props, ...scene.interactables]
    .filter((i) => i.collide !== false)
    .map((i) => {
      const turned = Math.abs(Math.sin(i.rotation_y ?? 0)) > 0.7;
      const w = turned ? i.size[2] : i.size[0];
      const d = turned ? i.size[0] : i.size[2];
      return { minX: i.position[0] - w / 2, maxX: i.position[0] + w / 2, minZ: i.position[2] - d / 2, maxZ: i.position[2] + d / 2 };
    });
}

function blocked(x: number, z: number, boxes: Box2[], scene: PublicScene): boolean {
  const hw = scene.room.width / 2 - RADIUS;
  const hd = scene.room.depth / 2 - RADIUS;
  if (x < -hw || x > hw || z < -hd || z > hd) return true;
  return boxes.some((b) => x > b.minX - RADIUS && x < b.maxX + RADIUS && z > b.minZ - RADIUS && z < b.maxZ + RADIUS);
}

function isTyping(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
}

function interactIdOf(obj: Object3D | null): string | null {
  for (let o: Object3D | null = obj; o; o = o.parent) {
    const id = o.userData?.interactId;
    if (typeof id === "string") return id;
  }
  return null;
}

/** Ask for raw mouse input (lower latency, no acceleration); fall back to plain pointer lock if unsupported. */
function requestLock(el: HTMLElement) {
  try {
    const p = (el.requestPointerLock as (o?: { unadjustedMovement?: boolean }) => Promise<void> | void)({ unadjustedMovement: true });
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        // Not supported, or the browser's short cooldown after Esc. Try the plain form once.
        try {
          const q = el.requestPointerLock() as unknown as Promise<void> | undefined;
          q?.catch?.(() => undefined);
        } catch {
          /* ignore: the player can click again */
        }
      });
    }
  } catch {
    el.requestPointerLock();
  }
}

export function Player({ scene, interactRef }: { scene: PublicScene; interactRef: RefObject<Group | null> }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const keys = useRef(new Set<string>());
  const look = useRef({ dx: 0, dy: 0, yaw: scene.spawn.yaw, pitch: 0 });
  const vel = useRef({ x: 0, z: 0 });
  const boxes = useMemo(() => colliders(scene), [scene]);
  // Only the hit-box layer: one box per object, never model triangles (see HITBOX_LAYER).
  const ray = useMemo(() => {
    const r = new Raycaster();
    r.layers.set(HITBOX_LAYER);
    return r;
  }, []);
  const center = useMemo(() => new Vector2(0, 0), []);
  const setFocus = useGame((s) => s.setFocus);
  const setNearGrandma = useGame((s) => s.setNearGrandma);
  const setInEarshot = useGame((s) => s.setInEarshot);
  const grandmaAt = useMemo(() => scene.interactables.find((i) => i.kind === "grandma")?.position ?? null, [scene]);
  const runId = useGame((s) => s.run?.runId);

  // Spawn at the start of every visit.
  useEffect(() => {
    const [x, , z] = scene.spawn.position;
    camera.position.set(x, EYE_HEIGHT, z);
    look.current = { dx: 0, dy: 0, yaw: scene.spawn.yaw, pitch: 0 };
    vel.current = { x: 0, z: 0 };
    camera.rotation.set(0, scene.spawn.yaw, 0, "YXZ");
    // Dev only: lets you move the camera from the console when testing without pointer lock.
    if (import.meta.env.DEV) {
      Object.assign(window, {
        __camera: camera,
        /** __view(x, z, yaw, pitch, y?) places the player, for screenshots and testing. */
        __view: (x: number, z: number, yaw: number, pitch = 0, y = EYE_HEIGHT) => {
          camera.position.set(x, y, z);
          Object.assign(look.current, { yaw, pitch, dx: 0, dy: 0 });
          vel.current = { x: 0, z: 0 };
        },
      });
    }
  }, [scene, camera, runId]);

  // Pointer lock and mouse look.
  useEffect(() => {
    const el = gl.domElement;
    const onClick = () => {
      const game = useGame.getState();
      if (game.panel) return;
      // Clicking the room leaves talk mode, so the keyboard goes back to walking.
      if (game.talking && document.activeElement instanceof HTMLElement) document.activeElement.blur();
      if (document.pointerLockElement !== el) requestLock(el);
    };
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      look.current.dx += e.movementX;
      look.current.dy += e.movementY;
    };
    const onChange = () => {
      const locked = document.pointerLockElement === el;
      useGame.getState().setLocked(locked);
      look.current.dx = 0;
      look.current.dy = 0;
    };
    el.addEventListener("click", onClick);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("pointerlockchange", onChange);
    return () => {
      el.removeEventListener("click", onClick);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("pointerlockchange", onChange);
      if (document.pointerLockElement === el) document.exitPointerLock();
    };
  }, [gl]);

  // Keyboard.
  useEffect(() => {
    const unlock = () => {
      if (document.pointerLockElement) document.exitPointerLock();
    };
    const down = (e: KeyboardEvent) => {
      const game = useGame.getState();
      // Esc works in every mode, including while typing.
      if (e.code === "Escape") {
        if (game.back()) e.preventDefault();
        keys.current.clear();
        return;
      }
      if (isTyping()) return;
      // Visit over: the result card owns the keyboard (Enter/Space press its buttons, Tab moves between them).
      // The room's keys used to swallow them and open hidden cards underneath (review, iteration 39).
      if (game.run?.status !== "playing") {
        keys.current.clear();
        return;
      }
      // With a card open, Tab, Space and the arrows keep their usual jobs: move between buttons, press them,
      // change a dropdown. (Swallowing them left keyboard players stuck on a card; review, iteration 30.)
      if (game.panel) {
        keys.current.clear();
        return;
      }
      const bind = useSettings.getState().keys;
      if ([bind.forward, bind.back, bind.left, bind.right, "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", bind.use, bind.putBack, bind.notebook].includes(e.code)) {
        // preventDefault also stops the key from typing into a text box that opens because of it.
        e.preventDefault();
      }
      keys.current.add(e.code);
      if (e.repeat || game.panel) return;
      if (e.code === bind.speak) {
        keys.current.clear();
        useGame.setState((s) => ({ voiceTick: s.voiceTick + 1 }));
      } else if (e.code === "KeyO") {
        unlock();
        keys.current.clear();
        game.openPanel({ type: "settings" });
      } else if (e.code === bind.notebook) {
        e.preventDefault();
        unlock();
        keys.current.clear();
        game.openPanel({ type: "notebook" });
      } else if (e.code === bind.putBack && game.carrying) {
        game.take(null);
      } else if (e.code === bind.use && game.focusId) {
        const it = scene.interactables.find((i) => i.id === game.focusId);
        if (!it) return;
        keys.current.clear();
        if (it.kind === "grandma") {
          if (game.carrying?.kind === "clue" && game.nearGrandma) return void game.showCarried();
          if (game.carrying?.kind === "cookie" && game.nearGrandma) return void game.giveCookie();
          unlock();
          game.focusChat();
          return;
        }
        if (it.kind === "fixture" && !game.opened.includes(it.id)) return void game.setOpened(it.id, true);
        unlock();
        if (it.kind === "note") game.openPanel({ type: "note" });
        else if (it.kind === "router") game.openPanel({ type: "router" });
        else game.openPanel({ type: "inspect", objectId: it.id });
      } else if (e.code === "Enter") {
        e.preventDefault();
        keys.current.clear();
        // Out of earshot, focusChat only shows "too far": keep mouse look rather than dropping it for nothing.
        if (game.inEarshot) unlock();
        game.focusChat();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const clear = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, [scene]);

  useFrame((_, rawDt) => {
    // Clamp only truly huge gaps (tab switches), not ordinary slow frames.
    const dt = Math.min(rawDt, 0.1);
    const L = look.current;

    // 1) Mouse look, applied once per frame.
    if (L.dx || L.dy) {
      const prefs = useSettings.getState();
      const k = LOOK_SENSITIVITY * prefs.sensitivity;
      L.yaw -= L.dx * k;
      L.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, L.pitch - L.dy * k * (prefs.invertY ? -1 : 1)));
      L.dx = 0;
      L.dy = 0;
    }
    // While talking, ease round to face Grandma so she's in view while she answers (plan C3). The mouse is
    // free in talk mode, so this never fights the player's own looking. Off with the setting or reduced motion.
    if (grandmaAt && useGame.getState().talking && useSettings.getState().cameraAssist && !reducedMotion()) {
      const dx = grandmaAt[0] - camera.position.x;
      const dz = grandmaAt[2] - camera.position.z;
      const flat = Math.hypot(dx, dz);
      if (flat > 0.3) {
        const wantYaw = Math.atan2(-dx, -dz);
        const wantPitch = Math.atan2(GRANDMA_FACE_Y - camera.position.y, flat);
        const ease = 1 - Math.exp(-3 * dt);
        L.yaw += angleDiff(wantYaw, L.yaw) * ease;
        L.pitch += (wantPitch - L.pitch) * ease;
      }
    }
    camera.rotation.set(L.pitch, L.yaw, 0, "YXZ");

    // 2) Walking, relative to where you're facing (yaw only, so looking down doesn't slow you).
    const k = keys.current;
    const canWalk = !isTyping() && !useGame.getState().panel;
    let f = 0;
    let r = 0;
    if (canWalk) {
      const b = useSettings.getState().keys;
      f = (k.has(b.forward) || k.has("ArrowUp") ? 1 : 0) - (k.has(b.back) || k.has("ArrowDown") ? 1 : 0);
      r = (k.has(b.right) || k.has("ArrowRight") ? 1 : 0) - (k.has(b.left) || k.has("ArrowLeft") ? 1 : 0);
    }
    const len = Math.hypot(f, r) || 1;
    const speed = k.has("ShiftLeft") || k.has("ShiftRight") ? SPRINT_SPEED : WALK_SPEED;
    const sin = Math.sin(L.yaw);
    const cos = Math.cos(L.yaw);
    // forward = (-sin, -cos), right = (cos, -sin)
    const tx = ((-sin * f + cos * r) / len) * speed;
    const tz = ((-cos * f - sin * r) / len) * speed;
    const blend = 1 - Math.exp(-ACCEL * dt);
    const v = vel.current;
    v.x += (tx - v.x) * blend;
    v.z += (tz - v.z) * blend;
    if (Math.abs(v.x) < 1e-3) v.x = 0;
    if (Math.abs(v.z) < 1e-3) v.z = 0;

    if (v.x || v.z) {
      const dx = v.x * dt;
      const dz = v.z * dt;
      // Slide along walls: each axis separately. If somehow already inside something, let the player walk out.
      const stuck = blocked(camera.position.x, camera.position.z, boxes, scene);
      if (stuck || !blocked(camera.position.x + dx, camera.position.z, boxes, scene)) camera.position.x += dx;
      else v.x = 0;
      if (stuck || !blocked(camera.position.x, camera.position.z + dz, boxes, scene)) camera.position.z += dz;
      else v.z = 0;
    }

    // 3) Close enough to Grandma to hand her things?
    if (grandmaAt) {
      const d = Math.hypot(camera.position.x - grandmaAt[0], camera.position.z - grandmaAt[2]);
      setNearGrandma(d <= NEAR_GRANDMA);
      setInEarshot(d <= EARSHOT);
    }

    viewer.x = camera.position.x;
    viewer.z = camera.position.z;
    // 3b) Doors left open swing shut once you walk away.
    const opened = useGame.getState().opened;
    for (const id of opened) {
      const it = scene.interactables.find((i) => i.id === id);
      if (it && Math.hypot(camera.position.x - it.position[0], camera.position.z - it.position[2]) > REACH + 0.8) useGame.getState().setOpened(id, false);
    }

    // 4) What are we looking at?
    if (interactRef.current) {
      ray.setFromCamera(center, camera);
      ray.far = REACH;
      const hit = ray.intersectObject(interactRef.current, true)[0];
      setFocus(hit ? interactIdOf(hit.object) : null);
    }
  });

  return null;
}
