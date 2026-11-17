/**
 * Shared helpers for people built from the Quaternius base body (Grandma, and the people in her photos):
 * clothes painted by bone region, hair colour, and posing bones by world direction.
 */
import { BufferAttribute, Color, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import type { Material, Object3D, SkinnedMesh } from "three";

/** The CC0 base body and hairstyle (Quaternius Universal Base Characters; see CREDITS.md). */
export const BODY_URL = "/models/quaternius/grandma_body.gltf";
export const HAIR_URL = "/models/quaternius/hair_parted.gltf";

/** Colours for the painted clothing regions (see `regionOf`). */
export interface Outfit {
  /** Torso and arms (blouse, shirt, jacket). */
  top: string;
  /** Hips and thighs (skirt, trousers). */
  bottom: string;
  /** Calves (stockings, trousers, a long dress). */
  legs: string;
  shoes: string;
  /** The puffed-out cardigan shell (Grandma only). */
  cardigan?: string;
}

/** Clothing ids: 0 skin (keeps the texture), 1 top, 2 bottom, 3 legs, 4 shoes, 5 cardigan. */
export function regionOf(bone: string): number {
  if (/^(spine|clavicle|upperarm|lowerarm)/.test(bone)) return 1;
  if (/^(pelvis|thigh)/.test(bone)) return 2;
  if (/^calf/.test(bone)) return 3;
  if (/^(foot|ball)/.test(bone)) return 4;
  return 0; // head, neck, hands, fingers
}

/** Per-vertex clothing region from the bone with the most weight. */
export function regionsOf(mesh: SkinnedMesh): Float32Array {
  const g = mesh.geometry;
  const idx = g.getAttribute("skinIndex");
  const wt = g.getAttribute("skinWeight");
  const n = g.getAttribute("position").count;
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
  return region;
}

export function setRegions(mesh: SkinnedMesh, region: Float32Array) {
  mesh.geometry.setAttribute("region", new BufferAttribute(region, 1));
}

/**
 * Paints clothes by the `region` attribute; skin keeps the texture. `age` 0..1 makes skin a bit paler
 * and greyer (Grandma is 1).
 */
export function clothMaterial(src: MeshStandardMaterial, outfit: Outfit, age = 1): MeshStandardMaterial {
  const mat = src.clone();
  mat.roughness = 0.9;
  mat.metalness = 0;
  const c = (hex: string) => ({ value: new Color(hex) });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uBlouse: c(outfit.top),
      uSkirt: c(outfit.bottom),
      uStockings: c(outfit.legs),
      uShoes: c(outfit.shoes),
      uCardigan: c(outfit.cardigan ?? outfit.top),
      uAge: { value: age },
    });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float region;\nvarying float vRegion;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRegion = region;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vRegion;\nuniform vec3 uBlouse, uSkirt, uStockings, uShoes, uCardigan;\nuniform float uAge;",
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
          vec3 older = mix(diffuseColor.rgb, vec3(l), 0.3) * 1.45 + vec3(0.05, 0.02, 0.02);
          diffuseColor.rgb = mix(diffuseColor.rgb * 1.25, older, uAge);
        }`,
      );
  };
  return mat;
}

/** Hair recoloured: grey and silvery for Grandma, or any colour (kept a little textured). */
export function hairMaterial(m: Material, color?: string): Material {
  const mat = (m as MeshStandardMaterial).clone();
  mat.roughness = 0.7;
  const tint = color ? new Color(color) : null;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTint = { value: tint ?? new Color(1, 1, 1) };
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 uTint;").replace(
      "#include <map_fragment>",
      tint
        ? `#include <map_fragment>
      float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
      diffuseColor.rgb = uTint * (0.75 + l * 0.6);`
        : `#include <map_fragment>
      float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
      diffuseColor.rgb = clamp(vec3(l) * 1.7 + vec3(0.33, 0.33, 0.35), 0.0, 1.0);`,
    );
  };
  return mat;
}

/**
 * The base model is an athletic "superhero" body. Soften the chest: in front, nothing may stick out much
 * past a straight line from the collarbone down to the waist. Edits the mesh's geometry in place (clone it
 * first: loaded models are cached and shared). Must run in the rest pose. Returns the chest line, which
 * Grandma's cardigan buttons follow.
 */
export function softenChest(mesh: SkinnedMesh, keep = 0.1) {
  const g = mesh.geometry;
  const pos = g.getAttribute("position") as BufferAttribute;
  const n = pos.count;
  // Work in model space (rest pose): +y up, +z forward.
  const toModel = mesh.matrixWorld.clone();
  const toMesh = toModel.clone().invert();
  const p = new Vector3();
  const model: Vector3[] = [];
  for (let v = 0; v < n; v++) model.push(p.fromBufferAttribute(pos, v).applyMatrix4(toModel).clone());
  const boneAt = (name: string) => {
    const b = mesh.skeleton.getBoneByName(name);
    if (!b) throw new Error(`body: no bone ${name}`);
    return b;
  };
  const yOf = (name: string) => boneAt(name).getWorldPosition(new Vector3()).y;
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
    m.z = lim + (m.z - lim) * keep;
    p.copy(m).applyMatrix4(toMesh);
    pos.setXYZ(v, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return { midZ, line, yTop, yBot };
}

/** Rotate `bone` so the direction to `child` points along `dir` (model space). Children follow. */
export function aim(bone: Object3D, child: Object3D, dir: Vector3) {
  const a = bone.getWorldPosition(new Vector3());
  const b = child.getWorldPosition(new Vector3());
  const now = b.sub(a).normalize();
  const turn = new Quaternion().setFromUnitVectors(now, dir.clone().normalize());
  const world = bone.getWorldQuaternion(new Quaternion()).premultiply(turn);
  const parent = bone.parent!.getWorldQuaternion(new Quaternion()).invert();
  bone.quaternion.copy(parent.multiply(world));
  bone.updateMatrixWorld(true);
}

/**
 * Twist `bone` about its own length (the line to `child`) so that `normal` (a world direction that turns
 * with the bone, e.g. the palm) points as close to `want` (model space) as the twist allows.
 */
export function roll(bone: Object3D, child: Object3D, normal: Vector3, want: Vector3) {
  const axis = child.getWorldPosition(new Vector3()).sub(bone.getWorldPosition(new Vector3())).normalize();
  const n = normal.clone().projectOnPlane(axis).normalize();
  const w = want.clone().projectOnPlane(axis).normalize();
  const angle = Math.atan2(new Vector3().crossVectors(n, w).dot(axis), n.dot(w));
  const turn = new Quaternion().setFromAxisAngle(axis, angle);
  const world = bone.getWorldQuaternion(new Quaternion()).premultiply(turn);
  const parent = bone.parent!.getWorldQuaternion(new Quaternion()).invert();
  bone.quaternion.copy(parent.multiply(world));
  bone.updateMatrixWorld(true);
}

/**
 * The body triangles still worth drawing once a clothing shell covers `covered` (clipping plan step 1, after
 * Disco Elysium's clothing occlusion and Reallusion's "auto hide"). A triangle is hidden when all three corners
 * are in the covered region and none is on the rim, where the covered region meets uncovered skin: the shell
 * stands off the body there, so the body under the rim stays to close the gap (neck, cuffs, waist).
 * `index` is the mesh's triangle list. Returns the triangles to keep and how many were hidden.
 */
export function uncoveredTriangles(index: ArrayLike<number>, region: ArrayLike<number>, covered: number): { keep: number[]; hidden: number } {
  const rim = new Set<number>();
  for (let t = 0; t < index.length; t += 3) {
    const tri = [index[t]!, index[t + 1]!, index[t + 2]!];
    const inside = tri.filter((v) => region[v] === covered);
    if (inside.length > 0 && inside.length < 3) for (const v of inside) rim.add(v);
  }
  const keep: number[] = [];
  let hidden = 0;
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t]!;
    const b = index[t + 1]!;
    const c = index[t + 2]!;
    const under = region[a] === covered && region[b] === covered && region[c] === covered && !rim.has(a) && !rim.has(b) && !rim.has(c);
    if (under) hidden++;
    else keep.push(a, b, c);
  }
  return { keep, hidden };
}

/**
 * Two-bone IK (clipping plan step 3): where the elbow goes so the wrist reaches `target` from `shoulder`,
 * with upper arm `a` and forearm `b` long. `pole` says which way the elbow bends (out and back for an arm
 * resting on the lap). A target out of reach is pulled in along the line to it. Pure maths, unit-tested.
 */
export function twoBoneElbow(shoulder: Vector3, target: Vector3, a: number, b: number, pole: Vector3): { elbow: Vector3; wrist: Vector3 } {
  const toTarget = target.clone().sub(shoulder);
  const d = Math.min(Math.max(toTarget.length(), Math.abs(a - b) + 1e-4), a + b - 1e-4);
  const dir = toTarget.normalize();
  const wrist = shoulder.clone().addScaledVector(dir, d);
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const bend = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (bend.lengthSq() < 1e-10) bend.set(0, -1, 0).addScaledVector(dir, dir.y);
  bend.normalize();
  const elbow = shoulder.clone().addScaledVector(dir, a * cosA).addScaledVector(bend, a * sinA);
  return { elbow, wrist };
}

/**
 * Where the skinned vertices of `meshes` are right now (posed), in world space, for vertices whose
 * heaviest bone's name matches `bones`. Computed on the CPU, so call it once after posing, not per frame.
 */
export function posedPoints(meshes: SkinnedMesh[], bones: RegExp): Vector3[] {
  const out: Vector3[] = [];
  for (const m of meshes) {
    m.updateMatrixWorld(true);
    m.skeleton.update();
    const g = m.geometry;
    const idx = g.getAttribute("skinIndex");
    const wt = g.getAttribute("skinWeight");
    const n = g.getAttribute("position").count;
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
      if (!bones.test(m.skeleton.bones[best]?.name ?? "")) continue;
      const p = new Vector3();
      m.getVertexPosition(v, p);
      out.push(m.localToWorld(p));
    }
  }
  return out;
}
