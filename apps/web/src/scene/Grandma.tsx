/**
 * Grandma, built in code from CC0 parts (see CREDITS.md):
 *   Quaternius "Universal Base Characters" female body + "Hair_SimpleParted" hairstyle.
 * On top of that, here in code: a seated pose, clothes painted per body part (cardigan, skirt,
 * stockings, shoes), grey hair, glasses and a crocheted lap blanket. Idle breathing, nodding while
 * she thinks, dozing when her tea runs low.
 *
 * Nothing here depends on the bones' local axes: poses are given as world directions.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  Box3,
  BufferAttribute,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  Quaternion,
  SkinnedMesh,
  TorusGeometry,
  BoxGeometry,
  DoubleSide,
  CylinderGeometry,
  CircleGeometry,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import type { Bone, Material, Object3D } from "three";
import { useGame } from "../store.ts";
import { t } from "../strings.ts";
import { useHighlight } from "./Model.tsx";
import { drapeSurfaceY, drapedBlanket, liftToClear } from "./blanket.ts";
import { limitHead } from "./poseLimits.ts";
import { BODY_URL, HAIR_URL, aim, clothMaterial, hairMaterial, regionsOf, roll, setRegions, dropTriangles, posedPoints, softenChest, twoBoneElbow, uncoveredTriangles } from "./body.ts";
import type { Outfit } from "./body.ts";
import type { Vec3 } from "./models.ts";


/** How tall Grandma would be standing up (the base model is about 1.7 m). */
const STANDING_HEIGHT = 1.56;
/** How far each finger joint bends from the model's flat T-pose hand (radians, about the bone's Z). */
const FINGER_CURL = 0.35;
/** Extra bend of the cup hand's thumb joints (radians, bone Z). */
const THUMB_CURL = 0.6;
/** Lips sit this far below the eyes on the base model (metres, rest pose). */
const MOUTH_BELOW_EYES = 0.075;
/** Where her wrist goes, relative to her lips, when she sips (model space, before scaling). */
const SIP_WRIST = new Vector3(-0.06, -0.065, 0.06);
/** The teacup's radius and half its height (model space, before scaling). */
const CUP_RADIUS = 0.03;
const CUP_HALF_HEIGHT = 0.0275;
/** From the middle of her palm to its surface (the cup stands on it). */
const PALM_THICKNESS = 0.012;
/** Hands on the lap: how far from hip to knee, and how high the wrist sits above the blanket. */
const LAP_HAND_ALONG = 0.62;
const WRIST_ABOVE_LAP = 0.028;
/** Her fingers rest this far above the blanket's surface (it's soft; just not inside it). */
const HAND_ON_LAP = 0.003;
/** The blanket is lifted to clear her thighs from this fraction of the way from hip to knee (the knees). */
const BLANKET_CLEARS_FROM = 0.8;
/**
 * The blanket: how far it reaches past the outside of her thighs, how far its sides drop, and the smallest
 * gap it keeps above them (model space).
 */
const BLANKET_OVERHANG = 0.015;
const BLANKET_SAG = 0.035;
const BLANKET_GAP = 0.008;

/**
 * The armchair as fitted in the room (KayKit "armchair" stretched into the scene's chair boxes), in Grandma's
 * object space, where the centre of her box is the origin. Measured from the chair's mesh by raycasts in
 * iteration 51; measure again if the chair's art or boxes change.
 */
const CHAIR = {
  /** Top of the seat cushion. */
  seatY: -0.605,
  /** The backrest's front face: z0 at height y0, leaning back `slope` metres per metre up. */
  back: { y0: -0.475, z0: -0.15, slope: 0.33 },
  /** Inner faces of the armrests (x, either side). */
  armInnerX: 0.333,
};
/** Gaps kept between her and the chair (metres). */
const SEAT_GAP = 0.003;
const BACK_GAP = 0.005;
/** Smallest gap between her face and the cup or her fingers while she sips (metres). */
const FACE_GAP = 0.012;
/** The cup and her hand stay at least this far below her glasses while she sips. */
const SIP_BROW_GAP = 0.03;

/** Gaps around her resting pose (metres in the room; negative would mean clipping). */
export interface Fit {
  /** Her resting hands above the blanket. */
  lapGap: number;
  /** Between her two hands. */
  handGap: number;
  /** Her arms inside the armrests. */
  armGap: number;
  /** How high the blanket sits above the line from hip to knee. */
  blanketLift: number;
  /** Thigh triangles not drawn because the blanket covers them. */
  underBlanket: number;
}

/** How much room the sip leaves (metres; negative means the cup or hand is in her face). */
export interface SipClearance {
  face: number;
  brow: number;
}

/** How many body triangles the cardigan hides (for the dev checks). */
let hiddenBodyTriangles = 0;

const GRANDMA_OUTFIT: Outfit = {
  top: "#efe2cc",
  bottom: "#4f5a7a",
  legs: "#c9a58a",
  shoes: "#3a2a22",
  cardigan: "#8e5b7e",
};

/**
 * The base model is an athletic "superhero" body. Make it a grandma's: soften the chest, paint a
 * blouse, skirt, stockings and shoes on it, and wrap a loose buttoned cardigan around the top.
 * Must run in the rest pose, before posing.
 */
function dress(mesh: SkinnedMesh) {
  const g = mesh.geometry.clone(); // the loaded model is cached and shared: never edit it in place
  mesh.geometry = g;
  const pos = g.getAttribute("position") as BufferAttribute;
  const n = pos.count;
  const region = regionsOf(mesh);
  const { midZ, line, yTop, yBot } = softenChest(mesh);
  setRegions(mesh, region);
  const bodyMat = clothMaterial(mesh.material as MeshStandardMaterial, GRANDMA_OUTFIT);
  mesh.material = bodyMat;

  // The cardigan: the top's triangles, puffed out a little.
  const PUFF = 0.014;
  const nor = g.getAttribute("normal") as BufferAttribute;
  const shellPos = new Float32Array(n * 3);
  const q = new Vector3();
  const nn = new Vector3();
  for (let v = 0; v < n; v++) {
    q.fromBufferAttribute(pos, v);
    nn.fromBufferAttribute(nor, v);
    q.addScaledVector(nn, PUFF);
    shellPos.set([q.x, q.y, q.z], v * 3);
  }
  const tris = g.getIndex()!;
  const keep: number[] = [];
  for (let t = 0; t < tris.count; t += 3) {
    const a = tris.getX(t);
    const b = tris.getX(t + 1);
    const c = tris.getX(t + 2);
    if (region[a] === 1 && region[b] === 1 && region[c] === 1) keep.push(a, b, c);
  }
  const shellGeo = g.clone();
  shellGeo.setAttribute("position", new BufferAttribute(shellPos, 3));
  shellGeo.setAttribute("region", new BufferAttribute(new Float32Array(n).fill(5), 1));
  shellGeo.setIndex(keep);
  // Under the cardigan, don't draw the body at all, so it can never poke through at the shoulders and
  // elbows (clipping plan step 1). Fewer triangles to draw, too.
  const uncovered = uncoveredTriangles(tris.array as ArrayLike<number>, region, 1);
  g.setIndex(uncovered.keep);
  hiddenBodyTriangles = uncovered.hidden;
  const shell = new SkinnedMesh(shellGeo, bodyMat);
  shell.name = "Cardigan";
  shell.frustumCulled = false;
  shell.position.copy(mesh.position);
  shell.quaternion.copy(mesh.quaternion);
  shell.scale.copy(mesh.scale);
  mesh.parent!.add(shell);
  shell.updateMatrixWorld(true);
  shell.bind(mesh.skeleton, mesh.bindMatrix);

  // Four buttons down the front.
  const buttonMat = new MeshStandardMaterial({ color: "#efe2cc", roughness: 0.5 });
  const spine2 = mesh.skeleton.getBoneByName("spine_02")!;
  const spine3 = mesh.skeleton.getBoneByName("spine_03")!;
  const y3 = spine3.getWorldPosition(new Vector3()).y;
  for (let i = 0; i < 4; i++) {
    const y = yBot + (yTop - yBot) * (0.12 + 0.22 * i);
    const button = new Mesh(new CylinderGeometry(0.009, 0.009, 0.005, 8), buttonMat);
    button.rotation.x = Math.PI / 2;
    button.position.set(0, y, Math.min(midZ(y), line(y)) + PUFF + 0.004);
    button.updateMatrixWorld(true);
    (y > y3 ? spine3 : spine2).attach(button);
  }
}

/** A local axis for `bone` that matches the model's X axis right now (for nodding about X). */
function localAxis(bone: Object3D, worldAxis: Vector3) {
  const inv = bone.getWorldQuaternion(new Quaternion()).invert();
  return worldAxis.clone().applyQuaternion(inv).normalize();
}

function grannySquares(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const colors = ["#c4553b", "#e3b23c", "#4f8a6b", "#6b5ca5", "#d97a9a", "#3f7cac"];
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      g.fillStyle = "#2b2420";
      g.fillRect(x * 16, y * 16, 16, 16);
      g.fillStyle = colors[(x * 3 + y * 5) % colors.length]!;
      g.fillRect(x * 16 + 2, y * 16 + 2, 12, 12);
      g.fillStyle = "#f1e6cf";
      g.fillRect(x * 16 + 5, y * 16 + 5, 6, 6);
      g.fillStyle = colors[(x + y * 2 + 1) % colors.length]!;
      g.fillRect(x * 16 + 7, y * 16 + 7, 2, 2);
    }
  const t = new CanvasTexture(c);
  t.magFilter = NearestFilter;
  return t;
}

interface Built {
  root: Group;
  head: Bone;
  neck: Bone;
  spine: Bone;
  headBase: Quaternion;
  neckBase: Quaternion;
  spineBase: Quaternion;
  headAxis: Vector3;
  neckAxis: Vector3;
  spineAxis: Vector3;
  /** Neck turn (model Y) and head tilt (model Z), for looking at the player and mood poses. */
  neckYawAxis: Vector3;
  headTiltAxis: Vector3;
  /** Arm bones (right upper, lower, hand; left upper, lower, hand) and their poses. */
  arms: { bones: Bone[]; rest: Quaternion[]; sip: Quaternion[]; gesture: Quaternion[]; glasses: Quaternion[] };
  /** The tea inside her cup (scaled with the tea meter). */
  tea: Mesh;
  /** Her mouth (scaled open while she talks). */
  mouth: Mesh;
  /** Turning the head itself (the neck takes only part of a look; clipping plan step 2). */
  headYawAxis: Vector3;
  /** The tightest the cup and hand get to her face anywhere along the sip. */
  sipWorst: SipClearance;
  /** How she fits the chair and her lap (metres, in the room). */
  fit: Fit;
  hiddenTriangles: number;
}

/**
 * Body language for each mood the reply comes with (the model picks the mood; game design §8.1).
 * lean: spine forward (+) or back (-) · pitch: head down (+) or up (-) · tilt: head to the side ·
 * laugh: shoulders bob. Values are radians.
 */
const MOOD_POSE: Record<string, { lean: number; pitch: number; tilt: number; laugh: number }> = {
  happy: { lean: 0.03, pitch: 0, tilt: 0.06, laugh: 1 },
  teasing: { lean: 0.02, pitch: 0.04, tilt: 0.16, laugh: 0.6 },
  nostalgic: { lean: -0.03, pitch: -0.16, tilt: -0.05, laugh: 0 },
  confused: { lean: 0, pitch: 0.02, tilt: -0.24, laugh: 0 },
  suspicious: { lean: -0.08, pitch: 0.1, tilt: 0.04, laugh: 0 },
  worried: { lean: 0.1, pitch: 0.1, tilt: 0, laugh: 0 },
  sleepy: { lean: 0.05, pitch: 0.15, tilt: 0.05, laugh: 0 },
};
const NEUTRAL = { lean: 0, pitch: 0, tilt: 0, laugh: 0 };
const damp = (from: number, to: number, rate: number, dt: number) => from + (to - from) * Math.min(1, dt * rate);

function build(bodySrc: Object3D, hairSrc: Object3D): Built {
  const body = cloneSkinned(bodySrc) as Group;
  body.updateMatrixWorld(true);
  const bone = (n: string) => {
    const b = body.getObjectByName(n);
    if (!b) throw new Error(`grandma: no bone ${n}`);
    return b as Bone;
  };

  // Clothes and hair colors.
  const dressing: SkinnedMesh[] = [];
  body.traverse((o) => {
    if (o instanceof SkinnedMesh && o.name === "Superhero_Female") dressing.push(o);
    else if (o instanceof Mesh && /hair/i.test((o.material as Material).name)) o.material = hairMaterial(o.material as Material);
    if (o instanceof Mesh) o.frustumCulled = false; // skinned bounds don't follow the pose
  });
  for (const m of dressing) dress(m); // after the traversal: dress() adds a mesh to the tree

  const head = bone("Head");
  // Hair and glasses are modelled around the rest pose: attach them to the head before posing.
  const hair = hairSrc.clone(true);
  hair.traverse((o) => {
    if (o instanceof Mesh) o.material = hairMaterial(o.material as Material);
  });
  hair.updateMatrixWorld(true);
  head.attach(hair);
  // A bun at the back of the head.
  const hairBox = new Box3().setFromObject(hair);
  let hairMat: Material | null = null;
  hair.traverse((o) => {
    if (o instanceof Mesh && !hairMat) hairMat = o.material as Material;
  });
  const bun = new Mesh(new SphereGeometry(0.06, 10, 8), hairMat ?? new MeshStandardMaterial({ color: "#d6d6d8" }));
  bun.scale.set(1, 0.85, 0.85);
  bun.position.set((hairBox.min.x + hairBox.max.x) / 2, hairBox.max.y - 0.07, hairBox.min.z + 0.03);
  bun.updateMatrixWorld(true);
  head.attach(bun);

  const eyes = body.getObjectByName("Eyes");
  const eyeBox = eyes ? new Box3().setFromObject(eyes) : null;
  const eyeMid = eyeBox ? eyeBox.getCenter(new Vector3()) : head.getWorldPosition(new Vector3()).add(new Vector3(0, 0.06, 0.08));
  const eyeHalf = eyeBox ? Math.max(0.028, (eyeBox.max.x - eyeBox.min.x) / 2 - 0.012) : 0.032;
  const glasses = new Group();
  const frame = new MeshStandardMaterial({ color: "#b08a3a", metalness: 0.6, roughness: 0.35 });
  for (const s of [-1, 1]) {
    const ring = new Mesh(new TorusGeometry(0.021, 0.003, 4, 10), frame);
    ring.position.set(s * eyeHalf, 0, 0);
    glasses.add(ring);
    const arm = new Mesh(new BoxGeometry(0.003, 0.003, 0.09), frame);
    arm.position.set(s * (eyeHalf + 0.026), 0.004, -0.045);
    glasses.add(arm);
  }
  const bridge = new Mesh(new BoxGeometry(eyeHalf * 2 - 0.042, 0.003, 0.003), frame);
  glasses.add(bridge);
  glasses.position.set(eyeMid.x, eyeMid.y, (eyeBox?.max.z ?? eyeMid.z) + 0.02);
  glasses.updateMatrixWorld(true);
  head.attach(glasses);

  // A mouth that opens while she talks (the model has no jaw bone or face shapes). It sits on her lips,
  // found from the skinned face vertices just below the nose, and stays hidden while she is quiet.
  const mouthY = eyeMid.y - MOUTH_BELOW_EYES;
  let lipZ = -Infinity;
  const p = new Vector3();
  for (const m of dressing) {
    const n = m.geometry.attributes.position!.count;
    for (let i = 0; i < n; i++) {
      m.getVertexPosition(i, p);
      m.localToWorld(p);
      if (Math.abs(p.x - eyeMid.x) < 0.012 && Math.abs(p.y - mouthY) < 0.006) lipZ = Math.max(lipZ, p.z);
    }
  }
  if (!Number.isFinite(lipZ)) lipZ = (eyeBox?.max.z ?? eyeMid.z) - 0.005;
  const mouth = new Mesh(new CircleGeometry(0.011, 12), new MeshBasicMaterial({ color: "#3b1717" }));
  mouth.scale.set(1.5, 0.05, 1);
  mouth.position.set(eyeMid.x, mouthY, lipZ + 0.002);
  mouth.visible = false;
  mouth.updateMatrixWorld(true);
  head.attach(mouth);

  // Sit down. Directions are in model space: +z forward, +x is her left.
  const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
  for (const s of [1, -1]) {
    const side = s > 0 ? "l" : "r";
    aim(bone(`thigh_${side}`), bone(`calf_${side}`), v(0.07 * s, -0.1, 1));
    aim(bone(`calf_${side}`), bone(`foot_${side}`), v(0.02 * s, -1, 0.18));
    aim(bone(`foot_${side}`), bone(`ball_${side}`), v(0.05 * s, -0.35, 1));
    // Relaxed fingers instead of a flat, splayed T-pose hand; the cup hand curls a little more.
    for (const finger of ["index", "middle", "ring", "pinky"]) {
      for (const j of [1, 2, 3]) {
        bone(`${finger}_0${j}_${side}`).rotateZ(FINGER_CURL * (side === "r" ? 1.1 : 1) * (j === 1 ? 0.6 : 1));
      }
    }
    // The cup hand's thumb wraps the cup instead of sticking up past her nose when she sips.
    if (side === "r") for (const j of [2, 3]) bone(`thumb_0${j}_r`).rotateZ(THUMB_CURL);
  }
  const spine = bone("spine_02");
  const neck = bone("neck_01");
  aim(neck, head, v(0, 1, 0.12)); // a little hunched forward
  body.updateMatrixWorld(true);
  /** Which way a palm faces (world), from the knuckle line and the finger direction. */
  const palm = (side: "l" | "r") => {
    const at = (name: string) => bone(`${name}_${side}`).getWorldPosition(new Vector3());
    const finger = at("middle_01").sub(at("hand"));
    const across = at("pinky_01").sub(at("index_01"));
    return new Vector3().crossVectors(finger, across).normalize().multiplyScalar(side === "r" ? 1 : -1);
  };
  /** Turn a forearm so its palm faces `want`, then point the hand along `point` again. */
  const turnPalm = (side: "l" | "r", want: Vector3, point: Vector3) => {
    roll(bone(`lowerarm_${side}`), bone(`hand_${side}`), palm(side), want);
    aim(bone(`hand_${side}`), bone(`middle_01_${side}`), point);
  };

  // Crocheted blanket draped over her lap and knees (see blanket.ts), shaped from her posed legs (clipping
  // plan step 4). The base body's thighs are athletic: mid-thigh they rise about 13 cm above the bone, so a
  // blanket clearing them looked like a box. Instead it is only lifted to clear her knees, where it rolls over,
  // and the thigh triangles that would poke up through it aren't drawn (the blanket covers that spot from
  // above, like the cardigan over her arms).
  const hipL = bone("thigh_l").getWorldPosition(new Vector3());
  const hipR = bone("thigh_r").getWorldPosition(new Vector3());
  const kneeL = bone("calf_l").getWorldPosition(new Vector3());
  const kneeR = bone("calf_r").getWorldPosition(new Vector3());
  const hips = hipL.clone().add(hipR).multiplyScalar(0.5);
  const knees = kneeL.clone().add(kneeR).multiplyScalar(0.5);
  const thighLen = hips.distanceTo(knees);
  const along = (p: Vector3) => (p.z - hips.z) / thighLen;
  const thighPoints = posedPoints(dressing, /^thigh_/);
  const legSpan = Math.max(...thighPoints.filter((p) => along(p) > 0.25).map((p) => Math.abs(p.x - hips.x)));
  const blanketWidth = 2 * (legSpan + BLANKET_OVERHANG);
  const drape = { sag: BLANKET_SAG, lift: 0 };
  drape.lift = liftToClear(hips, knees, blanketWidth, drape, thighPoints.filter((p) => along(p) > BLANKET_CLEARS_FROM), BLANKET_GAP);
  const blanketMat = new MeshStandardMaterial({ map: grannySquares(), roughness: 0.95, side: DoubleSide });
  const blanket = new Mesh(drapedBlanket(hips, knees, blanketWidth, drape), blanketMat);
  body.add(blanket);
  let underBlanket = 0;
  for (const m of dressing) {
    const g = m.geometry;
    const idx = g.getAttribute("skinIndex");
    const wt = g.getAttribute("skinWeight");
    const n = g.getAttribute("position").count;
    const poke = new Uint8Array(n);
    const p = new Vector3();
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestW = -1;
      for (let k = 0; k < 4; k++) {
        if (wt.getComponent(i, k) > bestW) {
          bestW = wt.getComponent(i, k);
          best = idx.getComponent(i, k);
        }
      }
      if (!/^thigh_/.test(m.skeleton.bones[best]?.name ?? "")) continue;
      m.localToWorld(m.getVertexPosition(i, p));
      if (along(p) < 0) continue; // behind the hip joints the body rises out of the blanket: keep it
      const top = drapeSurfaceY(hips, knees, blanketWidth, drape, p.x, p.z);
      if (top !== null && p.y > top - 0.002) poke[i] = 1;
    }
    const kept = dropTriangles(g.getIndex()!.array as ArrayLike<number>, (v) => poke[v] === 1);
    g.setIndex(kept.keep);
    underBlanket += kept.dropped;
  }
  const lapY = (x: number, z: number) => drapeSurfaceY(hips, knees, blanketWidth, drape, x, z) ?? hips.y + drape.lift;

  // Hands rest on the blanket, one on each thigh, placed by two-bone IK (clipping plan step 3). They used to
  // be aimed by hand-tuned directions and ended up crossed, one through the other. Elbows bend out and back.
  const boneLength = (from: string, to: string) => bone(from).getWorldPosition(new Vector3()).distanceTo(bone(to).getWorldPosition(new Vector3()));
  const restHand = (side: "l" | "r", along: number, above: number) => {
    const s = side === "l" ? 1 : -1;
    const target = (side === "l" ? hipL : hipR).clone().lerp(side === "l" ? kneeL : kneeR, along);
    target.y = lapY(target.x, target.z) + above;
    const shoulder = bone(`upperarm_${side}`).getWorldPosition(new Vector3());
    const a = boneLength(`upperarm_${side}`, `lowerarm_${side}`);
    const b = boneLength(`lowerarm_${side}`, `hand_${side}`);
    const { elbow, wrist } = twoBoneElbow(shoulder, target, a, b, v(0.45 * s, -0.4, -0.5));
    aim(bone(`upperarm_${side}`), bone(`lowerarm_${side}`), elbow.clone().sub(shoulder));
    aim(bone(`lowerarm_${side}`), bone(`hand_${side}`), wrist.clone().sub(bone(`lowerarm_${side}`).getWorldPosition(new Vector3())));
  };
  // Each hand is placed, then lifted until its lowest point is on top of the blanket (the fingers droop below
  // the wrist, so a fixed wrist height left them in the cloth).
  const settle = (side: "l" | "r", place: (above: number) => void) => {
    const fingers = new RegExp(`^(hand|index|middle|ring|pinky|thumb)(_0\\d)?_${side}$`);
    let above = WRIST_ABOVE_LAP;
    for (let i = 0; i < 5; i++) {
      place(above);
      body.updateMatrixWorld(true);
      let gap = Infinity;
      for (const p of posedPoints(dressing, fingers)) gap = Math.min(gap, p.y - lapY(p.x, p.z));
      if (gap >= HAND_ON_LAP) break;
      above += HAND_ON_LAP - gap;
    }
  };
  // Her free (left) hand lies palm down on her left thigh, fingers toward the knee along the thigh.
  settle("l", (above) => {
    restHand("l", LAP_HAND_ALONG, above);
    turnPalm("l", v(0.15, -1, 0.1), v(-0.2, -0.1, 1));
  });
  // The cup hand lies palm up on her right thigh, a little nearer her hip, so the cup sits in it.
  settle("r", (above) => {
    restHand("r", LAP_HAND_ALONG - 0.1, above);
    turnPalm("r", v(0.35, 1, 0), v(0.3, -0.1, 1));
  });

  // Her teacup, held in the right hand on her lap; the tea level follows the tea meter.
  const cupMat = new MeshStandardMaterial({ color: "#f3ede2", roughness: 0.35 });
  const cup = new Group();
  const cupBody = new Mesh(new CylinderGeometry(0.03, 0.022, 0.055, 12, 1, true), cupMat);
  cupBody.material.side = DoubleSide;
  const cupBase = new Mesh(new CylinderGeometry(0.022, 0.022, 0.004, 12), cupMat);
  cupBase.position.y = -0.0275;
  const band = new Mesh(new CylinderGeometry(0.0305, 0.0295, 0.008, 12, 1, true), new MeshStandardMaterial({ color: "#c46a7a", roughness: 0.4 }));
  band.position.y = 0.014;
  const tea = new Mesh(new CylinderGeometry(0.027, 0.022, 0.045, 12), new MeshStandardMaterial({ color: "#7a4a22", roughness: 0.2 }));
  tea.position.y = -0.0045;
  cup.add(cupBody, cupBase, band, tea);
  const handR = bone("hand_r");
  // In the palm (clipping plan step 3): the cup's base sits on the middle of the palm, standing along the
  // palm's normal tipped toward upright, instead of floating at a guessed height beside the hand.
  const palmMid = ["hand_r", "index_01_r", "middle_01_r", "pinky_01_r"]
    .map((n) => bone(n).getWorldPosition(new Vector3()))
    .reduce((sum, p) => sum.add(p), new Vector3())
    .multiplyScalar(0.25);
  const cupUp = palm("r").add(v(0, 2, 0)).normalize();
  cup.quaternion.setFromUnitVectors(v(0, 1, 0), cupUp);
  cup.position.copy(palmMid).addScaledVector(cupUp, PALM_THICKNESS + CUP_HALF_HEIGHT);
  cup.updateMatrixWorld(true);
  handR.attach(cup);

  // Arm poses for gestures, computed once and blended at runtime. Captured as local bone rotations.
  const armBones = ["upperarm_r", "lowerarm_r", "hand_r", "upperarm_l", "lowerarm_l", "hand_l"].map(bone);
  const snapshot = () => armBones.map((b) => b.quaternion.clone());
  const restore = (pose: Quaternion[]) => {
    armBones.forEach((b, i) => b.quaternion.copy(pose[i]!));
    body.updateMatrixWorld(true);
  };
  const rest = snapshot();
  const eyeLine = glasses.getWorldPosition(new Vector3());
  const toward = (from: Object3D, target: Vector3) => target.clone().sub(from.getWorldPosition(new Vector3()));
  // Sip: elbow forward, the upturned hand brings the cup up under her lips, tipped toward her.
  // Keep-out (clipping plan step 5): the cup and the hand must stay in front of her face and below her
  // glasses. If the pose breaks that, the wrist target moves forward or down until it doesn't.
  const lips = mouth.getWorldPosition(new Vector3());
  const handPoints = ["hand_r", "middle_01_r", "index_01_r", "middle_03_r", "index_03_r", "thumb_03_r"].map(bone);
  const clearance = (): SipClearance => {
    const c = cup.getWorldPosition(new Vector3());
    let face = c.z - (lips.z + CUP_RADIUS + FACE_GAP);
    let brow = eyeLine.y - SIP_BROW_GAP - (c.y + CUP_RADIUS);
    for (const b of handPoints) {
      const p = b.getWorldPosition(new Vector3());
      // Only what's level with her face matters (the hand is far below her chin most of the way up).
      if (p.y > lips.y - 0.05) face = Math.min(face, p.z - (lips.z + FACE_GAP));
      brow = Math.min(brow, eyeLine.y - SIP_BROW_GAP - p.y);
    }
    return { face, brow };
  };
  const wrist = lips.clone().add(SIP_WRIST);
  const sipPose = () => {
    restore(rest);
    aim(bone("upperarm_r"), bone("lowerarm_r"), v(-0.12, -0.35, 0.9));
    aim(bone("lowerarm_r"), handR, toward(bone("lowerarm_r"), wrist));
    turnPalm("r", v(0.1, 1, -0.4), v(0.75, 0.2, 0.25));
  };
  sipPose();
  for (let i = 0; i < 8; i++) {
    const c = clearance();
    if (c.face >= 0 && c.brow >= 0) break;
    wrist.z += Math.max(0, -c.face) + 0.002;
    wrist.y -= Math.max(0, -c.brow) + 0.002;
    sipPose();
  }
  const sip = snapshot();
  // Check the whole way up, not just the end: the runtime blends each arm bone from rest to sip.
  let sipWorst: SipClearance = { face: Infinity, brow: Infinity };
  for (let k = 0; k <= 10; k++) {
    armBones.forEach((b, i) => b.quaternion.copy(rest[i]!).slerp(sip[i]!, k / 10));
    body.updateMatrixWorld(true);
    const c = clearance();
    sipWorst = { face: Math.min(sipWorst.face, c.face), brow: Math.min(sipWorst.brow, c.brow) };
  }
  restore(rest);
  // Talking gesture with the free (left) hand: elbow stays at her side, forearm lifts forward, palm up.
  aim(bone("upperarm_l"), bone("lowerarm_l"), v(0.1, -1, 0.3));
  aim(bone("lowerarm_l"), bone("hand_l"), v(0.12, 0.6, 1));
  turnPalm("l", v(-0.4, 1, 0), v(0.05, 0.2, 1));
  const gesture = snapshot();
  restore(rest);
  // Push up the glasses: left hand to the bridge of the nose.
  aim(bone("upperarm_l"), bone("lowerarm_l"), v(0.15, -0.45, 0.85));
  aim(bone("lowerarm_l"), bone("hand_l"), toward(bone("lowerarm_l"), eyeLine.clone().add(v(0.02, -0.03, 0.04))));
  aim(bone("hand_l"), bone("middle_01_l"), v(-0.2, 0.9, 0.3));
  const glassesPose = snapshot();
  restore(rest);

  // How her resting hands sit: on top of the blanket, and apart from each other (checked, not assumed).
  const handsL = posedPoints(dressing, /^(hand|index|middle|ring|pinky|thumb)(_0\d)?_l$/);
  const handsR = posedPoints(dressing, /^(hand|index|middle|ring|pinky|thumb)(_0\d)?_r$/);
  let lapGap = Infinity;
  for (const p of [...handsL, ...handsR]) {
    const y = drapeSurfaceY(hips, knees, blanketWidth, drape, p.x, p.z);
    if (y !== null) lapGap = Math.min(lapGap, p.y - y);
  }
  let handGap = Infinity;
  for (const a of handsL) for (const b of handsR) handGap = Math.min(handGap, a.distanceToSquared(b));
  handGap = Math.sqrt(handGap);

  // Scale to her height, then seat her in the chair from her posed body (clipping plan step 3): the lowest
  // point of her hips and thighs just on the cushion, her back just in front of the backrest.
  const scale = STANDING_HEIGHT / 1.7;
  const root = new Group();
  root.add(body);
  body.scale.setScalar(scale);
  body.position.set(-hips.x * scale, -hips.y * scale, -hips.z * scale);
  root.updateMatrixWorld(true);
  const cardigan = body.getObjectByName("Cardigan") as SkinnedMesh | undefined;
  const torso = [...dressing, ...(cardigan ? [cardigan] : [])];
  const seatY = CHAIR.seatY + SEAT_GAP - Math.min(...posedPoints(dressing, /^(pelvis|thigh_)/).map((p) => p.y));
  const backZ = (y: number) => CHAIR.back.z0 - CHAIR.back.slope * (y - CHAIR.back.y0);
  let seatZ = -Infinity;
  for (const p of posedPoints(torso, /^(pelvis|spine|thigh_)/)) {
    const y = seatY + p.y;
    if (y > CHAIR.seatY && y < CHAIR.seatY + 0.7) seatZ = Math.max(seatZ, backZ(y) + BACK_GAP - p.z);
  }
  root.position.set(0, seatY, seatZ);
  root.updateMatrixWorld(true);
  const armGap = Math.min(...posedPoints(torso, /^(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)_/).map((p) => CHAIR.armInnerX - Math.abs(p.x)));
  const fit: Fit = { lapGap: lapGap * scale, handGap: handGap * scale, armGap, blanketLift: drape.lift * scale, underBlanket };

  const X = v(1, 0, 0);
  return {
    root,
    head,
    neck,
    spine,
    headBase: head.quaternion.clone(),
    neckBase: neck.quaternion.clone(),
    spineBase: spine.quaternion.clone(),
    headAxis: localAxis(head, X),
    neckAxis: localAxis(neck, X),
    spineAxis: localAxis(spine, X),
    neckYawAxis: localAxis(neck, v(0, 1, 0)),
    headTiltAxis: localAxis(head, v(0, 0, 1)),
    arms: { bones: armBones, rest, sip, gesture, glasses: glassesPose },
    tea,
    mouth,
    headYawAxis: localAxis(head, v(0, 1, 0)),
    sipWorst,
    hiddenTriangles: hiddenBodyTriangles,
    fit,
  };
}

/** Raw (before limits) head angles and gesture blends to hold, for dev checks. */
type DebugPose = Partial<{ yaw: number; pitch: number; tilt: number; sip: number; talk: number; glasses: number }>;

const q1 = new Quaternion();

const tmp = new Quaternion();

export function GrandmaModel({ size, highlight }: { size: Vec3; highlight: boolean }) {
  const bodyGltf = useGLTF(BODY_URL);
  const hairGltf = useGLTF(HAIR_URL);
  const built = useMemo(() => build(bodyGltf.scene, hairGltf.scene), [bodyGltf, hairGltf]);
  useHighlight(built.root, highlight, "#2a1f30");

  const busy = useGame((s) => s.busy);
  const voicePlaying = useGame((s) => s.grandmaSpeaking);
  const stamina = useGame((s) => s.run?.stamina ?? 100);
  const status = useGame((s) => s.run?.status);
  const sleepy = stamina <= 20 || status === "bedtime";
  const doze = useRef(0);

  // Her latest line: its mood sets the pose, its length how long she "talks" (nods while speaking).
  const lastIndex = useGame((s) => s.log.findLastIndex((l) => l.who === "grandma"));
  const lastMood = useGame((s) => s.log[lastIndex]?.mood);
  const lastLen = useGame((s) => s.log[lastIndex]?.text.length ?? 0);
  const lastSeq = useGame((s) => s.log[lastIndex]?.seq ?? lastIndex);
  const said = lastIndex >= 0 ? { i: lastSeq, mood: lastMood, len: lastLen } : null;
  const speech = useRef({ index: -1, until: 0 });
  const mouthOpen = useRef(0);
  const gest = useRef({ sip: 0, talk: 0, glasses: 0, nextSip: 6, glassesUntil: 0 });
  const teaLevel = Math.max(0.08, stamina / 100);
  const pose = useRef({ ...NEUTRAL, yaw: 0 });
  const local = useMemo(() => new Vector3(), []);

  // Dev only: __grandma.pose({ yaw: 2, sip: 1 }) holds a pose for checking clipping (null lets her go);
  // __grandma.info has the sip clearance and how many body triangles the cardigan hides.
  const debugPose = useRef<DebugPose | null>(null);
  if (import.meta.env.DEV) {
    Object.assign(window, {
      __grandma: { info: { sipWorst: built.sipWorst, hiddenTriangles: built.hiddenTriangles, fit: built.fit }, pose: (p: DebugPose | null) => void (debugPose.current = p) },
    });
  }

  useFrame(({ clock, camera }, dt) => {
    const t = clock.getElapsedTime();
    const b = built;
    doze.current = damp(doze.current, sleepy ? 1 : 0, 1.5, dt);

    if (said && said.i !== speech.current.index) {
      speech.current = { index: said.i, until: t + Math.min(4, 0.6 + said.len * 0.035) };
      if (said.mood === "confused" || said.mood === "suspicious") gest.current.glassesUntil = t + 1.8;
    }
    const talking = t < speech.current.until || voicePlaying;
    const target = MOOD_POSE[said?.mood ?? ""] ?? NEUTRAL;

    // Look at the player when they're in front of her and not too far (she's seated; limited neck turn).
    local.copy(camera.position);
    b.root.worldToLocal(local);
    const dist = Math.hypot(local.x, local.z);
    const yawTarget = dist < 5 && local.z > 0 ? Math.max(-1.1, Math.min(1.1, Math.atan2(local.x, local.z))) : 0;

    const P = pose.current;
    P.lean = damp(P.lean, target.lean, 3, dt);
    P.pitch = damp(P.pitch, target.pitch, 3, dt);
    P.tilt = damp(P.tilt, target.tilt, 3, dt);
    P.laugh = damp(P.laugh, talking ? target.laugh : 0, 4, dt);
    P.yaw = damp(P.yaw, sleepy ? 0 : yawTarget, 2.5, dt);

    // Gestures: a sip of tea now and then when idle, hands while talking, glasses when puzzled.
    const G = gest.current;
    const idleNow = !talking && !busy && doze.current < 0.3;
    if (import.meta.env.DEV) (window as unknown as { __sip?: () => void }).__sip = () => void (G.nextSip = t);
    const sipping = idleNow && t > G.nextSip && t < G.nextSip + 3;
    if (t > G.nextSip + 3) G.nextSip = t + 12 + ((Math.sin(t * 7.3) + 1) * 5);
    G.sip = damp(G.sip, sipping ? 1 : 0, 2.2, dt);
    const animated = said?.mood === "happy" || said?.mood === "teasing" || said?.mood === "nostalgic";
    G.talk = damp(G.talk, talking && animated ? 0.65 + Math.sin(t * 3.1) * 0.25 : 0, 4, dt);
    G.glasses = damp(G.glasses, t < G.glassesUntil ? 1 : 0, 3.5, dt);
    const D = debugPose.current;
    if (D) {
      G.sip = D.sip ?? G.sip;
      G.talk = D.talk ?? G.talk;
      G.glasses = D.glasses ?? G.glasses;
    }
    const A = b.arms;
    A.bones.forEach((bone, i) => {
      const right = i < 3;
      bone.quaternion.copy(A.rest[i]!);
      if (right) {
        // The cup hand only sips (never waves the tea around).
        bone.quaternion.slerp(q1.copy(A.sip[i]!), G.sip);
      } else {
        bone.quaternion.slerp(q1.copy(A.gesture[i]!), G.talk);
        bone.quaternion.slerp(q1.copy(A.glasses[i]!), G.glasses);
      }
    });
    b.tea.scale.y = teaLevel;
    // Mouth: two out-of-step waves read as syllables; closes between words and when she stops.
    const syll = Math.max(0, Math.sin(t * 11) * 0.6 + Math.sin(t * 17.3 + 1) * 0.5);
    mouthOpen.current = damp(mouthOpen.current, talking ? syll : 0, 18, dt);
    b.mouth.visible = mouthOpen.current > 0.08;
    b.mouth.scale.y = 0.15 + mouthOpen.current * 0.85;
    b.tea.position.y = -0.027 + 0.0225 * teaLevel;

    const breathe = Math.sin(t * 1.4) * 0.025;
    const laugh = P.laugh * Math.abs(Math.sin(t * 9)) * 0.05;
    const nod = talking ? Math.sin(t * 7) * 0.035 : 0;
    const think = busy ? Math.sin(t * 5) * 0.06 : 0;
    const idle = Math.sin(t * 0.37) * 0.04;
    // Everything adds up here, then goes through soft limits (clipping plan step 2, poseLimits.ts).
    const limited = limitHead({
      yaw: D?.yaw ?? P.yaw,
      pitch: D?.pitch ?? idle + think + nod + P.pitch + doze.current * 0.3 + Math.sin(t * 0.8) * 0.04 * doze.current,
      tilt: D?.tilt ?? P.tilt,
      lean: breathe + laugh + P.lean + doze.current * 0.12,
      doze: doze.current,
    });
    b.spine.quaternion.copy(b.spineBase).multiply(tmp.setFromAxisAngle(b.spineAxis, limited.spineLean));
    b.neck.quaternion
      .copy(b.neckBase)
      .multiply(tmp.setFromAxisAngle(b.neckYawAxis, limited.neckYaw))
      .multiply(tmp.setFromAxisAngle(b.neckAxis, limited.neckPitch));
    b.head.quaternion
      .copy(b.headBase)
      .multiply(tmp.setFromAxisAngle(b.headYawAxis, limited.headYaw))
      .multiply(tmp.setFromAxisAngle(b.headAxis, limited.headPitch))
      .multiply(tmp.setFromAxisAngle(b.headTiltAxis, limited.headTilt));
  });

  const [, h] = size;
  return (
    <group>
      {/* object space: the item's box is centred on the origin; build() seats her in the chair (CHAIR) */}
      <primitive object={built.root} />
      {busy && (
        <Html position={[0, -h / 2 + 1.12, 0]} center distanceFactor={6}>
          <div className="bubble">…</div>
        </Html>
      )}
      {sleepy && !busy && (
        <Html position={[0, -h / 2 + 1.12, 0]} center distanceFactor={6}>
          <div className="bubble">{t("grandma.dozing")}</div>
        </Html>
      )}
    </group>
  );
}

useGLTF.preload(BODY_URL);
useGLTF.preload(HAIR_URL);
