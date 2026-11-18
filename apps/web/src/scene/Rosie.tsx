/**
 * Rosie, from the Godot edition's Blender model (art/blender/grandma.py → grandma.glb), with its procedural
 * animation ported from grandma.gd: breathing, blinking, looking at the camera, lip flaps while she talks,
 * a pose per mood, nodding off as her tea runs low, sips, and the tea level in her cup (her stamina).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal, useFrame } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import { BufferAttribute, BufferGeometry, CanvasTexture, Euler, Float32BufferAttribute, PointsMaterial, Quaternion, Vector3 } from "three";
import type { Mesh, Object3D } from "three";
import { useGame } from "../store.ts";
import { useSettings } from "../settings.ts";
import { materialFor } from "./materials.ts";

const URL = "/models/house/grandma.glb";
const LID_OPEN = -0.45;
const LID_CLOSED = 1.45;

/** The game's moods (from the model) as the rig's poses (grandma.gd). */
const POSE: Record<string, string> = { happy: "proud", teasing: "laugh", nostalgic: "fond", confused: "think", suspicious: "think", worried: "sad", sleepy: "idle" };

/**
 * A small emote over her head as each line arrives (iteration 56): her poses alone were too subtle to read her
 * mood with the sound off (both reviews). The words say the same, so this is decoration (aria-hidden).
 */
const EMOTE: Record<string, string> = { happy: "😊", teasing: "😏", nostalgic: "💭", confused: "❓", suspicious: "🤨", worried: "😟" };

const PARTS = ["Torso", "Head", "EyelidL", "EyelidR", "MouthOpen", "Brows", "ArmR", "ForearmR", "ArmL", "ForearmL", "TeaLevel", "Teacup"] as const;
type Part = (typeof PARTS)[number];

const moveToward = (v: number, to: number, step: number) => (Math.abs(to - v) <= step ? to : v + Math.sign(to - v) * step);
const lerp = (a: number, b: number, k: number) => a + (b - a) * Math.min(1, k);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Steam over her cup while there's tea in it. */
function Steam({ on }: { on: boolean }) {
  const geo = useMemo(() => {
    const n = 14;
    const g = new BufferGeometry();
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) p[i * 3 + 1] = (i / n) * 0.18;
    g.setAttribute("position", new Float32BufferAttribute(p, 3));
    return g;
  }, []);
  // Soft round puffs, not the square points WebGL draws by default (iteration 56).
  const mat = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.45)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new PointsMaterial({ color: "#ffffff", map: new CanvasTexture(c), size: 0.05, transparent: true, opacity: 0.16, depthWrite: false });
  }, []);
  useFrame(({ clock }, dt) => {
    const a = geo.getAttribute("position") as BufferAttribute;
    const arr = a.array as Float32Array;
    for (let i = 0; i < a.count; i++) {
      arr[i * 3 + 1]! += dt * 0.07;
      arr[i * 3] = Math.sin(clock.elapsedTime * 1.3 + i) * 0.012 * arr[i * 3 + 1]! * 8;
      if (arr[i * 3 + 1]! > 0.18) arr[i * 3 + 1] = 0;
    }
    a.needsUpdate = true;
  });
  return <points geometry={geo} material={mat} position={[0, 0.07, 0]} visible={on} />;
}

export function Rosie({ seat }: { seat: Object3D | null }) {
  const gltf = useGLTF(URL);
  const reduced = useSettings((s) => s.calmCamera);
  const model = useMemo(() => {
    const m = gltf.scene.clone(true);
    m.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const src = Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material;
      mesh.material = materialFor(src.name) ?? src;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    // A fuller neck, set a little lower, so it fills her collar instead of a thin stalk in a ring (iteration 56).
    const neck = m.getObjectByName("Neck");
    if (neck) {
      neck.scale.set(1.55, 1.15, 1.45);
      neck.position.y -= 0.02;
    }
    return m;
  }, [gltf]);
  const parts = useMemo(() => {
    const out = {} as Record<Part, Object3D | undefined>;
    for (const p of PARTS) out[p] = model.getObjectByName(p);
    const rest = new Map<Object3D, { q: Quaternion; p: Vector3; s: Vector3 }>();
    for (const o of Object.values(out)) if (o) rest.set(o, { q: o.quaternion.clone(), p: o.position.clone(), s: o.scale.clone() });
    return { ...out, rest };
  }, [model]);
  const cup = parts.Teacup;

  // Where she sits: the armchair's seat marker in the room.
  const place = useMemo(() => {
    if (!seat) return { p: new Vector3(-2.74, 0.5, -1.83), q: new Quaternion() };
    seat.updateWorldMatrix(true, false);
    return { p: seat.getWorldPosition(new Vector3()), q: seat.getWorldQuaternion(new Quaternion()) };
  }, [seat]);

  // Game state that drives her.
  const stamina = useGame((s) => s.run?.stamina ?? 100);
  const maxStamina = useGame((s) => s.run?.maxStamina ?? 100);
  const status = useGame((s) => s.run?.status);
  const busy = useGame((s) => s.busy);
  const lastIndex = useGame((s) => s.log.findLastIndex((l) => l.who === "grandma"));
  const last = useGame((s) => s.log[lastIndex]);
  const cookies = useGame((s) => s.run?.cookies ?? 1);

  const [emote, setEmote] = useState<{ icon: string; key: number } | null>(null);
  const st = useRef({ t: 0, mood: "idle", moodTime: 0, talking: 0, talkOpen: 0, talkTarget: 0, blink: 0, nextBlink: 2, drowsy: 0, yaw: 0, pitch: 0, sip: -1, nextSip: 18, syl: 0 });
  // A new line from her: talk for about as long as it takes to read, in that line's mood.
  useEffect(() => {
    if (!last) return;
    const s = st.current;
    s.mood = POSE[last.mood ?? ""] ?? "idle";
    s.moodTime = 0;
    s.talking = clamp(last.text.length / 42, 1, 12);
    const icon = EMOTE[last.mood ?? ""];
    if (!icon) return;
    setEmote({ icon, key: last.seq ?? 0 });
    const id = setTimeout(() => setEmote(null), 2600);
    return () => clearTimeout(id);
  }, [last?.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  // A cookie: she sips her refilled tea.
  const prevCookies = useRef(cookies);
  useEffect(() => {
    if (cookies < prevCookies.current) st.current.sip = 0;
    prevCookies.current = cookies;
  }, [cookies]);

  const asleep = status === "bedtime";
  const teaFrac = clamp(stamina / maxStamina, 0, 1);
  const zzz = useRef<HTMLDivElement>(null);
  const head = new Vector3();
  const local = new Vector3();
  const e = new Euler(0, 0, 0, "YXZ");
  const q = new Quaternion();
  const rot = (o: Object3D | undefined, x: number, y: number, z: number) => {
    if (!o) return;
    const r = parts.rest.get(o)!;
    o.quaternion.copy(r.q).multiply(q.setFromEuler(e.set(x, y, z, "YXZ")));
  };

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = st.current;
    s.t += dt;
    s.moodTime += dt;
    s.talking = Math.max(0, s.talking - dt);
    // While she's thinking (the model is working), a small "hmm" nod and a look away.
    const thinking = busy && s.talking <= 0;
    let target = asleep ? 1 : clamp((0.3 - teaFrac) / 0.3, 0, 0.7);
    if (s.talking > 0 || thinking) target = Math.min(target, 0.15);
    s.drowsy = moveToward(s.drowsy, target, dt * 0.6);

    // breathing
    const rate = asleep ? 1.1 : 1.7;
    const b = Math.sin(s.t * rate);
    if (parts.Torso) {
      let lean = 0.05 * s.drowsy;
      if (s.mood === "laugh" && s.moodTime < 1.6) lean -= 0.05 * Math.abs(Math.sin(s.moodTime * 14)) * (1 - s.moodTime / 1.6);
      rot(parts.Torso, lean, 0, 0);
      const r = parts.rest.get(parts.Torso)!;
      parts.Torso.scale.set(r.s.x * (1 + 0.006 * b), r.s.y * (1 + 0.012 * b), r.s.z * (1 + 0.008 * b));
    }

    // head: look at the camera, nod while talking, droop when sleepy
    let wantYaw = 0;
    let wantPitch = 0;
    if (parts.Head?.parent) {
      parts.Head.parent.worldToLocal(local.copy(camera.position)).sub(head.copy(parts.Head.position));
      wantYaw = clamp(Math.atan2(local.x, local.z), -0.6, 0.6);
      wantPitch = clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)) * 0.6, -0.25, 0.25);
    }
    if (thinking) {
      wantYaw += 0.25;
      wantPitch -= 0.12;
    }
    s.yaw = lerp(s.yaw, wantYaw * (1 - s.drowsy), dt * 2);
    s.pitch = lerp(s.pitch, wantPitch, dt * 2);
    let nod = 0;
    let tilt = 0;
    if (s.talking > 0 && !reduced) nod = 0.035 * Math.sin(s.t * 5.3) + 0.02 * Math.sin(s.t * 2.1);
    switch (s.mood) {
      case "laugh":
        nod -= 0.12 * Math.max(0, 1 - s.moodTime / 1.8) * Math.abs(Math.sin(s.moodTime * 12));
        tilt = 0.05;
        break;
      case "fond":
        tilt = 0.14 * Math.min(s.moodTime, 1);
        break;
      case "proud":
        nod -= 0.08 * Math.min(s.moodTime, 1);
        break;
      case "think":
        tilt = -0.12 * Math.min(s.moodTime, 1);
        nod -= 0.05;
        break;
      case "sad":
        nod += 0.1;
        break;
    }
    if (thinking) tilt -= 0.08;
    const droop = 0.42 * s.drowsy + 0.03 * Math.sin(s.t * 0.9) * s.drowsy;
    rot(parts.Head, s.pitch + nod + droop, s.yaw, tilt);

    // blinking; eyes close when asleep, half-close when fond or drowsy
    s.nextBlink -= dt;
    if (s.nextBlink <= 0) {
      s.blink = 1;
      s.nextBlink = 2 + Math.random() * 3.5;
    }
    s.blink = moveToward(s.blink, 0, dt * 7);
    let close = Math.max(s.blink, s.drowsy);
    if (s.mood === "fond" && s.talking > 0) close = Math.max(close, 0.45);
    if (s.mood === "laugh" && s.moodTime < 1.5) close = Math.max(close, 0.6);
    const lid = lerp(LID_OPEN, LID_CLOSED, clamp(close, 0, 1));
    parts.EyelidL?.rotation.set(lid, 0, 0);
    parts.EyelidR?.rotation.set(lid, 0, 0);

    // mouth: syllable flaps while she talks (the Godot UI sent one per typed syllable; here a rhythm)
    if (s.talking > 0) {
      s.syl -= dt;
      if (s.syl <= 0) {
        s.talkTarget = 0.35 + Math.random() * 0.65;
        s.syl = 0.09 + Math.random() * 0.08;
      }
    }
    s.talkTarget = moveToward(s.talkTarget, 0, dt * 9);
    s.talkOpen = lerp(s.talkOpen, s.talkTarget, dt * 22);
    const snore = asleep ? 0.25 + 0.2 * Math.sin(s.t * rate) : 0;
    if (parts.MouthOpen) {
      let open = Math.max(s.talkOpen, snore);
      if (s.mood === "laugh" && s.moodTime < 1.4) open = Math.max(open, 0.7);
      parts.MouthOpen.scale.set(1, 0.05 + open * 0.95, 1);
    }

    // brows
    if (parts.Brows) {
      const r = parts.rest.get(parts.Brows)!;
      let liftY = 0;
      if ((s.mood === "proud" || s.mood === "laugh") && s.moodTime < 2) liftY = 0.006;
      if (s.mood === "think" || thinking) liftY = -0.003;
      parts.Brows.position.set(r.p.x, r.p.y + liftY, r.p.z);
    }

    // arms: a small gesture with the free hand while talking; sips lift the cup
    if (s.talking > 0 && !reduced) rot(parts.ForearmL, 0.12 * (0.5 + 0.5 * Math.sin(s.t * 2.6)), 0, 0.08 * Math.sin(s.t * 1.7));
    else rot(parts.ForearmL, 0, 0, 0);
    s.nextSip -= dt;
    if (s.nextSip <= 0 && s.sip < 0 && s.talking <= 0 && !asleep && teaFrac > 0.05) {
      s.sip = 0;
      s.nextSip = 20 + Math.random() * 25;
    }
    if (s.sip >= 0) {
      s.sip += dt;
      const k = Math.sin(clamp(s.sip / 2.2, 0, 1) * Math.PI);
      rot(parts.ArmR, -0.35 * k, 0, 0);
      rot(parts.ForearmR, -0.9 * k, 0, 0.25 * k);
      if (s.sip > 2.2) s.sip = -1;
    }
    // the tea level in her cup is her stamina
    if (parts.TeaLevel) {
      const r = parts.rest.get(parts.TeaLevel)!;
      parts.TeaLevel.position.set(r.p.x, r.p.y + lerp(-0.04, 0, teaFrac), r.p.z);
      parts.TeaLevel.scale.set(r.s.x * (0.75 + 0.25 * teaFrac), r.s.y, r.s.z * (0.75 + 0.25 * teaFrac));
      parts.TeaLevel.visible = teaFrac > 0.02;
    }
    if (zzz.current) zzz.current.style.opacity = String(lerp(Number(zzz.current.style.opacity || 0), asleep || s.drowsy > 0.6 ? 1 : 0, dt * 2));
  });

  return (
    <group position={place.p} quaternion={place.q}>
      <primitive object={model} />
      {cup && createPortal(<Steam on={teaFrac > 0.01 && !asleep} />, cup)}
      {/* On her head, not the chair: placed by the chair they sat above the frame in her close view (iteration 56). */}
      {parts.Head &&
        createPortal(
          <>
            {emote && (
              <Html position={[-0.27, 0.19, 0.06]} center zIndexRange={[5, 0]} pointerEvents="none">
                <div key={emote.key} className="emote" aria-hidden="true">
                  {emote.icon}
                </div>
              </Html>
            )}
            <Html position={[0.22, 0.34, 0]} center zIndexRange={[5, 0]} pointerEvents="none">
              <div ref={zzz} className="zzz" style={{ opacity: 0 }} aria-hidden="true">
                z z Z
              </div>
            </Html>
          </>,
          parts.Head,
        )}
    </group>
  );
}

useGLTF.preload(URL);
