/**
 * People and dogs for Grandma's photos, built in code. People reuse Grandma's CC0 base body (body.ts) with
 * different clothes, hair and build; dogs are a handful of low-poly shapes. Everything stands on y = 0 and
 * faces +z, in metres.
 */
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  Box3,
  BoxGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  SkinnedMesh,
  SphereGeometry,
  Vector3,
} from "three";
import type { Bone, Material, Object3D } from "three";
import { aim, clothMaterial, hairMaterial, regionsOf, setRegions, softenChest } from "./body.ts";
import type { Outfit } from "./body.ts";

export interface PersonSpec {
  outfit: Outfit;
  hair: string;
  /** Standing height in metres (the base body is about 1.7 m). */
  height: number;
  /** Broader shoulders, flat chest, short hair, a shirt front and tie. */
  man?: boolean;
  /** 0 young skin, 1 Grandma's. */
  age?: number;
  /** Children: a bigger head for their size. */
  child?: boolean;
  /** Hands together in front (holding a bouquet). Otherwise arms hang at the sides. */
  hold?: boolean;
  veil?: boolean;
  bouquet?: boolean;
  /** A full skirt to the floor in this colour (a wedding gown). */
  gown?: string;
  /** A suit jacket's skirt over the hips in this colour. */
  jacket?: string;
}

const mat = (color: string, rough = 0.85) => new MeshStandardMaterial({ color, roughness: rough, flatShading: true });

/** A person from the base body. Returns a group with the feet on y = 0, facing +z. */
export function buildPerson(bodySrc: Object3D, hairSrc: Object3D, spec: PersonSpec): Group {
  const body = cloneSkinned(bodySrc) as Group;
  body.updateMatrixWorld(true);
  const bone = (n: string) => {
    const b = body.getObjectByName(n);
    if (!b) throw new Error(`person: no bone ${n}`);
    return b as Bone;
  };

  let chest: ReturnType<typeof softenChest> | null = null;
  body.traverse((o) => {
    if (o instanceof Mesh) o.frustumCulled = false;
    if (o instanceof SkinnedMesh && o.name === "Superhero_Female") {
      o.geometry = o.geometry.clone();
      const region = regionsOf(o);
      chest = softenChest(o, spec.man ? 0 : 0.35);
      setRegions(o, region);
      o.material = clothMaterial(o.material as MeshStandardMaterial, spec.outfit, spec.age ?? 0);
    } else if (o instanceof Mesh && /hair/i.test((o.material as Material).name)) {
      o.material = hairMaterial(o.material as Material, spec.hair); // eyebrows
    }
  });

  const head = bone("Head");
  const hairMat = (() => {
    let m: Material | null = null;
    hairSrc.traverse((o) => {
      if (o instanceof Mesh && !m) m = o.material as Material;
    });
    return m ? hairMaterial(m, spec.hair) : mat(spec.hair);
  })();
  const headPos = head.getWorldPosition(new Vector3());
  if (spec.man) {
    // Short hair: a cap over the crown instead of the long parted style.
    const cap = new Mesh(new SphereGeometry(0.105, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat);
    cap.scale.set(0.98, 0.9, 1.1);
    cap.position.copy(headPos).add(new Vector3(0, 0.085, -0.012));
    cap.rotation.x = -0.18;
    cap.updateMatrixWorld(true);
    head.attach(cap);
  } else {
    const hair = hairSrc.clone(true);
    hair.traverse((o) => {
      if (o instanceof Mesh) o.material = hairMat;
    });
    hair.updateMatrixWorld(true);
    head.attach(hair);
  }

  if (spec.veil) {
    const veilMat = new MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.75, side: DoubleSide, roughness: 1 });
    const veil = new Mesh(new CylinderGeometry(0.07, 0.3, 0.9, 14, 1, true, Math.PI * 0.6, Math.PI * 0.8), veilMat);
    veil.position.copy(headPos).add(new Vector3(0, -0.3, -0.06));
    veil.rotation.x = 0.12;
    veil.updateMatrixWorld(true);
    head.attach(veil);
  }

  // Shirt front and tie on the chest, following the chest line.
  if (spec.man && chest) {
    const c = chest as ReturnType<typeof softenChest>;
    const spine3 = bone("spine_03");
    const yMid = c.yTop - 0.09;
    const z = Math.max(c.midZ(yMid), c.line(yMid)) + 0.004;
    // The shirt shows in a V between the lapels; a thin dark tie down the middle.
    const v = new Shape();
    v.moveTo(-0.06, 0.07);
    v.lineTo(0.06, 0.07);
    v.lineTo(0, -0.09);
    v.closePath();
    const shirt = new Mesh(new ShapeGeometry(v), mat("#f2f0ea"));
    shirt.position.set(0, yMid + 0.02, z);
    const tie = new Mesh(new BoxGeometry(0.016, 0.11, 0.005), mat("#1d1d22"));
    tie.position.set(0, yMid + 0.01, z + 0.003);
    for (const m of [shirt, tie]) {
      m.updateMatrixWorld(true);
      spine3.attach(m);
    }
  }

  // Build: a man's shoulders are broader (the head is scaled back so it keeps its size).
  if (spec.man) {
    bone("spine_03").scale.set(1.14, 1, 1.06);
    bone("neck_01").scale.set(1 / 1.14, 1, 1 / 1.06);
  }
  if (spec.child) head.scale.setScalar(1.25);

  // Pose: arms down or holding something in front.
  const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
  body.updateMatrixWorld(true);
  for (const s of [1, -1]) {
    const side = s > 0 ? "l" : "r";
    if (spec.hold) {
      aim(bone(`upperarm_${side}`), bone(`lowerarm_${side}`), v(0.1 * s, -1, 0.28));
      aim(bone(`lowerarm_${side}`), bone(`hand_${side}`), v(-0.75 * s, 0.25, 1));
      aim(bone(`hand_${side}`), bone(`middle_01_${side}`), v(-0.8 * s, 0, 0.6));
    } else {
      aim(bone(`upperarm_${side}`), bone(`lowerarm_${side}`), v(0.16 * s, -1, 0.02));
      aim(bone(`lowerarm_${side}`), bone(`hand_${side}`), v(0.06 * s, -1, 0.12));
      aim(bone(`hand_${side}`), bone(`middle_01_${side}`), v(0.02 * s, -1, 0.05));
    }
  }
  body.updateMatrixWorld(true);

  if (spec.bouquet) {
    const l = bone("hand_l").getWorldPosition(new Vector3());
    const r = bone("hand_r").getWorldPosition(new Vector3());
    const at = l.add(r).multiplyScalar(0.5).add(v(0, 0.03, 0.06));
    const bouquet = new Group();
    const flowers = mat("#f7f3ea", 0.9);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const f = new Mesh(new IcosahedronGeometry(0.035, 0), flowers);
      f.position.set(Math.cos(a) * 0.05, 0.04 + (i % 3) * 0.015, Math.sin(a) * 0.05);
      bouquet.add(f);
    }
    const leaves = new Mesh(new ConeGeometry(0.035, 0.22, 6), mat("#5f6b52"));
    leaves.rotation.x = Math.PI;
    leaves.position.y = -0.08;
    bouquet.add(leaves);
    bouquet.position.copy(at);
    body.add(bouquet);
  }

  // Clothes that stand away from the body: a gown's skirt, a jacket's hem (the painted body is skin-tight).
  const hipY = bone("pelvis").getWorldPosition(new Vector3()).y;
  const waistY = bone("spine_01").getWorldPosition(new Vector3()).y + 0.02;
  if (spec.gown) {
    const skirt = new Mesh(new CylinderGeometry(0.15, 0.46, waistY, 16, 3, true), mat(spec.gown, 0.95));
    (skirt.material as MeshStandardMaterial).side = DoubleSide;
    skirt.position.set(0, waistY / 2, 0.01);
    const bodice = new Mesh(new CylinderGeometry(0.135, 0.15, 0.2, 14), mat(spec.gown, 0.95));
    bodice.scale.set(1, 1, 0.8);
    bodice.position.set(0, waistY + 0.08, 0.005);
    body.add(skirt, bodice);
  }
  if (spec.jacket) {
    const hem = new Mesh(new CylinderGeometry(0.175, 0.2, 0.22, 12, 1, true), mat(spec.jacket));
    (hem.material as MeshStandardMaterial).side = DoubleSide;
    hem.scale.set(1, 1, 0.78);
    hem.position.set(0, hipY - 0.05, 0);
    body.add(hem);
  }

  const scale = spec.height / 1.7;
  const root = new Group();
  body.scale.setScalar(scale);
  root.add(body);
  return root;
}

export interface DogSpec {
  coat: string;
  /** Saddle patch on the back (beagles). */
  saddle?: string;
  /** Muzzle, chest, paws and tail tip. */
  white?: string;
  ears: string;
  /** Long, wavy ears (spaniel) instead of short floppy ones. */
  longEars?: boolean;
  /** One ear flipped inside out. */
  flippedEar?: boolean;
  sitting?: boolean;
  /** Something striped in its mouth. */
  sock?: boolean;
  /** Shoulder height, metres. */
  height: number;
}

/** A low-poly dog, about `height` tall at the shoulder, facing +z with its feet on y = 0. */
export function buildDog(spec: DogSpec): Group {
  const dog = new Group();
  const coat = mat(spec.coat);
  const white = mat(spec.white ?? spec.coat);
  const ear = mat(spec.ears);
  const dark = mat("#141210");
  const add = (m: Mesh, p: [number, number, number], r: [number, number, number] = [0, 0, 0], parent: Object3D = dog) => {
    m.position.set(...p);
    m.rotation.set(...r);
    parent.add(m);
    return m;
  };
  // Proportions for a 0.38 m dog, scaled at the end.
  const torso = new Group();
  dog.add(torso);
  add(new Mesh(new CapsuleGeometry(0.1, 0.24, 4, 8), coat), [0, 0, 0], [Math.PI / 2, 0, 0], torso);
  add(new Mesh(new SphereGeometry(0.095, 8, 6), white), [0, -0.02, 0.15], [0, 0, 0], torso); // chest
  if (spec.saddle) add(new Mesh(new SphereGeometry(0.1, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), mat(spec.saddle)), [0, 0.012, -0.03], [0, 0, 0], torso).scale.set(1.04, 1, 1.6);
  const tail = add(new Mesh(new CylinderGeometry(0.014, 0.022, 0.18, 6), coat), [0, 0.09, -0.24], [-0.6, 0, 0], torso);
  add(new Mesh(new SphereGeometry(0.02, 6, 4), white), [0, 0.09, 0], [0, 0, 0], tail);

  // Head.
  const head = new Group();
  head.position.set(0, 0.13, 0.22);
  torso.add(head);
  add(new Mesh(new SphereGeometry(0.075, 8, 6), coat), [0, 0, 0], [0, 0, 0], head);
  add(new Mesh(new BoxGeometry(0.07, 0.06, 0.09), white), [0, -0.025, 0.08], [0.1, 0, 0], head); // muzzle
  add(new Mesh(new SphereGeometry(0.018, 6, 4), dark), [0, -0.005, 0.125], [0, 0, 0], head); // nose
  for (const s of [-1, 1]) add(new Mesh(new SphereGeometry(0.011, 6, 4), dark), [0.032 * s, 0.025, 0.06], [0, 0, 0], head);
  for (const s of [-1, 1]) {
    const flipped = spec.flippedEar && s > 0;
    const len = spec.longEars ? 0.17 : 0.11;
    const e = add(new Mesh(new BoxGeometry(0.02, len, 0.06), flipped ? mat("#d9b9a0") : ear), [0.075 * s, -len / 2 + 0.03, -0.01], [0, 0, flipped ? -2.4 : 0.12 * s], head);
    if (flipped) e.position.set(0.07, 0.07, -0.02);
    if (spec.longEars) for (let i = 0; i < 3; i++) add(new Mesh(new SphereGeometry(0.03, 6, 4), ear), [0.082 * s, -0.04 - i * 0.045, -0.005], [0, 0, 0], head);
  }
  if (spec.sock) {
    const sock = new Group();
    sock.position.set(0.02, -0.05, 0.13);
    sock.rotation.set(0.3, 0.4, 1.2);
    head.add(sock);
    for (let i = 0; i < 4; i++) add(new Mesh(new CylinderGeometry(0.022, 0.022, 0.035, 8), mat(i % 2 ? "#c7372f" : "#efe8dc")), [0, i * 0.035 - 0.05, 0], [0, 0, 0], sock);
    add(new Mesh(new SphereGeometry(0.026, 8, 6), mat("#c7372f")), [0.012, 0.085, 0.01], [0, 0, 0], sock);
  }

  // Legs.
  const leg = (x: number, z: number, len: number) => {
    const g = new Group();
    g.position.set(x, 0, z);
    add(new Mesh(new CylinderGeometry(0.026, 0.022, len, 6), coat), [0, -len / 2, 0], [0, 0, 0], g);
    add(new Mesh(new SphereGeometry(0.028, 6, 4), white), [0, -len, 0.01], [0, 0, 0], g);
    torso.add(g);
    return g;
  };
  const legLen = 0.2;
  leg(-0.06, 0.13, legLen);
  leg(0.06, 0.13, legLen);
  const back = [leg(-0.065, -0.14, legLen), leg(0.065, -0.14, legLen)];
  torso.position.y = legLen + 0.03;
  if (spec.sitting) {
    // Rear down, chest up: tip the torso back and fold the back legs forward under it.
    torso.rotation.x = -0.65;
    torso.position.set(0, legLen + 0.03, 0.04);
    for (const b of back) {
      b.rotation.x = 1.3;
      b.position.y -= 0.02;
    }
    head.rotation.x = 0.55;
  } else {
    head.rotation.x = 0.15;
  }

  dog.scale.setScalar(spec.height / 0.3);
  // Feet on the floor.
  dog.updateMatrixWorld(true);
  const minY = new Box3().setFromObject(dog).min.y;
  const root = new Group();
  root.add(dog);
  dog.position.y = -minY;
  return root;
}
