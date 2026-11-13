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
  CylinderGeometry,
  SphereGeometry,
  Vector3,
} from "three";
import type { Bone, Material, Object3D } from "three";
import { useGame } from "../store.ts";
import { t } from "../strings.ts";
import { useHighlight } from "./Model.tsx";
import type { Vec3 } from "./models.ts";

const BODY_URL = "/models/quaternius/grandma_body.gltf";
const HAIR_URL = "/models/quaternius/hair_parted.gltf";

/** How tall Grandma would be standing up (the base model is about 1.7 m). */
const STANDING_HEIGHT = 1.56;

const PALETTE = {
  blouse: "#efe2cc",
  skirt: "#4f5a7a",
  stockings: "#c9a58a",
  shoes: "#3a2a22",
  cardigan: "#8e5b7e",
};

/** Clothing ids: 0 skin (keeps the texture), 1 blouse, 2 skirt, 3 stockings, 4 shoes, 5 cardigan. */
function regionOf(bone: string): number {
  if (/^(spine|clavicle|upperarm|lowerarm)/.test(bone)) return 1;
  if (/^(pelvis|thigh)/.test(bone)) return 2;
  if (/^calf/.test(bone)) return 3;
  if (/^(foot|ball)/.test(bone)) return 4;
  return 0; // head, neck, hands, fingers
}

/** Paints clothes by `region` attribute; skin keeps the texture but looks a bit older and paler. */
function clothMaterial(src: MeshStandardMaterial): MeshStandardMaterial {
  const mat = src.clone();
  mat.roughness = 0.9;
  mat.metalness = 0;
  const c = (hex: string) => ({ value: new Color(hex) });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uBlouse: c(PALETTE.blouse),
      uSkirt: c(PALETTE.skirt),
      uStockings: c(PALETTE.stockings),
      uShoes: c(PALETTE.shoes),
      uCardigan: c(PALETTE.cardigan),
    });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float region;\nvarying float vRegion;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRegion = region;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vRegion;\nuniform vec3 uBlouse, uSkirt, uStockings, uShoes, uCardigan;",
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        float r = floor(vRegion + 0.5);
        if (r > 0.5) {
          vec3 cloth = r < 1.5 ? uBlouse : r < 2.5 ? uSkirt : r < 3.5 ? uStockings : r < 4.5 ? uShoes : uCardigan;
          #ifdef USE_MAP
            if (r > 4.5) cloth *= 0.88 + 0.12 * step(0.5, fract(vMapUv.x * 70.0)); // knit ribs
          #endif
          diffuseColor.rgb = cloth;
        } else {
          float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(l), 0.3) * 1.45 + vec3(0.05, 0.02, 0.02);
        }`,
      );
  };
  return mat;
}

/**
 * The base model is an athletic "superhero" body. Make it a grandma's: soften the chest, paint a
 * blouse, skirt, stockings and shoes on it, and wrap a loose buttoned cardigan around the top.
 * Must run in the rest pose, before posing.
 */
function dress(mesh: SkinnedMesh) {
  const g = mesh.geometry.clone(); // the loaded model is cached and shared: never edit it in place
  mesh.geometry = g;
  const pos = g.getAttribute("position") as BufferAttribute;
  const idx = g.getAttribute("skinIndex");
  const wt = g.getAttribute("skinWeight");
  const n = pos.count;
  const region = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    let best = 0;
    let bestW = -1;
    for (let k = 0; k < 4; k++) {
      const w = wt.getComponent(v, k);
      if (w > bestW) {
        bestW = w;
        best = idx.getComponent(v, k);
      }
    }
    region[v] = regionOf(mesh.skeleton.bones[best]?.name ?? "");
  }

  // Work in model space (rest pose): +y up, +z forward.
  const toModel = mesh.matrixWorld.clone();
  const toMesh = toModel.clone().invert();
  const p = new Vector3();
  const model: Vector3[] = [];
  for (let v = 0; v < n; v++) model.push(p.fromBufferAttribute(pos, v).applyMatrix4(toModel).clone());
  const boneAt = (name: string) => {
    const b = mesh.skeleton.getBoneByName(name);
    if (!b) throw new Error(`grandma: no bone ${name}`);
    return b;
  };
  const yOf = (name: string) => boneAt(name).getWorldPosition(new Vector3()).y;

  // Soften the chest: in front, nothing may stick out much past a straight line from the
  // collarbone down to the waist.
  const midZ = (y: number) => {
    let z = -Infinity;
    for (const m of model) if (Math.abs(m.x) < 0.03 && Math.abs(m.y - y) < 0.015 && m.z > z) z = m.z;
    return z;
  };
  const yTop = yOf("clavicle_l") - 0.03;
  const yBot = yOf("spine_01") + 0.03;
  const zTop = midZ(yTop);
  const zBot = midZ(yBot);
  const line = (y: number) => zBot + ((zTop - zBot) * (y - yBot)) / (yTop - yBot) + 0.012;
  for (let v = 0; v < n; v++) {
    const m = model[v]!;
    if (m.y <= yBot || m.y >= yTop || m.z <= 0) continue;
    const lim = line(m.y);
    if (m.z <= lim) continue;
    m.z = lim + (m.z - lim) * 0.1;
    p.copy(m).applyMatrix4(toMesh);
    pos.setXYZ(v, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.setAttribute("region", new BufferAttribute(region, 1));
  const bodyMat = clothMaterial(mesh.material as MeshStandardMaterial);
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
  const spine2 = boneAt("spine_02");
  const spine3 = boneAt("spine_03");
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

/** Grey, slightly silvery hair (also used for the eyebrows). */
function greyHair(m: Material): Material {
  const mat = (m as MeshStandardMaterial).clone();
  mat.roughness = 0.7;
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
      diffuseColor.rgb = clamp(vec3(l) * 1.7 + vec3(0.33, 0.33, 0.35), 0.0, 1.0);`,
    );
  };
  return mat;
}

/** Rotate `bone` so the direction to `child` points along `dir` (model space). Children follow. */
function aim(bone: Object3D, child: Object3D, dir: Vector3) {
  const a = bone.getWorldPosition(new Vector3());
  const b = child.getWorldPosition(new Vector3());
  const now = b.sub(a).normalize();
  const turn = new Quaternion().setFromUnitVectors(now, dir.clone().normalize());
  const world = bone.getWorldQuaternion(new Quaternion()).premultiply(turn);
  const parent = bone.parent!.getWorldQuaternion(new Quaternion()).invert();
  bone.quaternion.copy(parent.multiply(world));
  bone.updateMatrixWorld(true);
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
    else if (o instanceof Mesh && /hair/i.test((o.material as Material).name)) o.material = greyHair(o.material as Material);
    if (o instanceof Mesh) o.frustumCulled = false; // skinned bounds don't follow the pose
  });
  for (const m of dressing) dress(m); // after the traversal: dress() adds a mesh to the tree

  const head = bone("Head");
  // Hair and glasses are modelled around the rest pose: attach them to the head before posing.
  const hair = hairSrc.clone(true);
  hair.traverse((o) => {
    if (o instanceof Mesh) o.material = greyHair(o.material as Material);
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

  // Sit down. Directions are in model space: +z forward, +x is her left.
  const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
  for (const s of [1, -1]) {
    const side = s > 0 ? "l" : "r";
    aim(bone(`thigh_${side}`), bone(`calf_${side}`), v(0.07 * s, -0.1, 1));
    aim(bone(`calf_${side}`), bone(`foot_${side}`), v(0.02 * s, -1, 0.18));
    aim(bone(`foot_${side}`), bone(`ball_${side}`), v(0.05 * s, -0.35, 1));
    aim(bone(`upperarm_${side}`), bone(`lowerarm_${side}`), v(0.2 * s, -1, 0.3));
    aim(bone(`lowerarm_${side}`), bone(`hand_${side}`), v(-0.42 * s, -0.25, 1));
    aim(bone(`hand_${side}`), bone(`middle_01_${side}`), v(-0.35 * s, -0.4, 1));
  }
  const spine = bone("spine_02");
  const neck = bone("neck_01");
  aim(neck, head, v(0, 1, 0.12)); // a little hunched forward

  // Crocheted blanket over her lap, from hips to knees, with a flap over the knees.
  const hipL = bone("thigh_l").getWorldPosition(new Vector3());
  const hipR = bone("thigh_r").getWorldPosition(new Vector3());
  const kneeL = bone("calf_l").getWorldPosition(new Vector3());
  const kneeR = bone("calf_r").getWorldPosition(new Vector3());
  const hips = hipL.clone().add(hipR).multiplyScalar(0.5);
  const knees = kneeL.clone().add(kneeR).multiplyScalar(0.5);
  const blanketMat = new MeshStandardMaterial({ map: grannySquares(), roughness: 0.95 });
  const width = Math.abs(hipL.x - hipR.x) + 0.3;
  const lap = new Mesh(new BoxGeometry(width, 0.04, knees.z - hips.z + 0.12), blanketMat);
  lap.position.set(hips.x, hips.y + 0.09, (hips.z + knees.z) / 2 + 0.04);
  const flap = new Mesh(new BoxGeometry(width, 0.32, 0.04), blanketMat);
  flap.position.set(knees.x, knees.y + 0.09 - 0.16, knees.z + 0.1);
  body.add(lap, flap);

  // Scale to her height, then put her hips on the seat (object space: seat at y = 0, hips at z = 0).
  const scale = STANDING_HEIGHT / 1.7;
  const root = new Group();
  root.add(body);
  body.scale.setScalar(scale);
  body.position.set(-hips.x * scale, -hips.y * scale, -hips.z * scale);
  root.updateMatrixWorld(true);

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
  };
}

const tmp = new Quaternion();

export function GrandmaModel({ size, highlight }: { size: Vec3; highlight: boolean }) {
  const bodyGltf = useGLTF(BODY_URL);
  const hairGltf = useGLTF(HAIR_URL);
  const built = useMemo(() => build(bodyGltf.scene, hairGltf.scene), [bodyGltf, hairGltf]);
  useHighlight(built.root, highlight, "#2a1f30");

  const busy = useGame((s) => s.busy);
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
  const pose = useRef({ ...NEUTRAL, yaw: 0 });
  const local = useMemo(() => new Vector3(), []);

  useFrame(({ clock, camera }, dt) => {
    const t = clock.getElapsedTime();
    const b = built;
    doze.current = damp(doze.current, sleepy ? 1 : 0, 1.5, dt);

    if (said && said.i !== speech.current.index) {
      speech.current = { index: said.i, until: t + Math.min(4, 0.6 + said.len * 0.035) };
    }
    const talking = t < speech.current.until;
    const target = MOOD_POSE[said?.mood ?? ""] ?? NEUTRAL;

    // Look at the player when they're in front of her and not too far (she's seated; limited neck turn).
    local.copy(camera.position);
    b.root.worldToLocal(local);
    const dist = Math.hypot(local.x, local.z);
    const yawTarget = dist < 5 && local.z > 0 ? Math.max(-0.7, Math.min(0.7, Math.atan2(local.x, local.z))) : 0;

    const P = pose.current;
    P.lean = damp(P.lean, target.lean, 3, dt);
    P.pitch = damp(P.pitch, target.pitch, 3, dt);
    P.tilt = damp(P.tilt, target.tilt, 3, dt);
    P.laugh = damp(P.laugh, talking ? target.laugh : 0, 4, dt);
    P.yaw = damp(P.yaw, sleepy ? 0 : yawTarget, 2.5, dt);

    const breathe = Math.sin(t * 1.4) * 0.025;
    const laugh = P.laugh * Math.abs(Math.sin(t * 9)) * 0.05;
    const nod = talking ? Math.sin(t * 7) * 0.035 : 0;
    const think = busy ? Math.sin(t * 5) * 0.06 : 0;
    const idle = Math.sin(t * 0.37) * 0.04;
    b.spine.quaternion
      .copy(b.spineBase)
      .multiply(tmp.setFromAxisAngle(b.spineAxis, breathe + laugh + P.lean + doze.current * 0.12));
    b.neck.quaternion
      .copy(b.neckBase)
      .multiply(tmp.setFromAxisAngle(b.neckYawAxis, P.yaw))
      .multiply(tmp.setFromAxisAngle(b.neckAxis, doze.current * 0.35));
    b.head.quaternion
      .copy(b.headBase)
      .multiply(tmp.setFromAxisAngle(b.headAxis, idle + think + nod + P.pitch + doze.current * 0.3 + Math.sin(t * 0.8) * 0.04 * doze.current))
      .multiply(tmp.setFromAxisAngle(b.headTiltAxis, P.tilt));
  });

  const [, h] = size;
  return (
    <group>
      {/* object space: the item's box is centered on the origin; her seat is its bottom */}
      <primitive object={built.root} position={[0, -h / 2 + 0.1, -0.1]} />
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
