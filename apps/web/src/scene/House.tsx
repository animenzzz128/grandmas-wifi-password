/**
 * Grandma's house, from the Godot edition's Blender model (art/blender/room.py → room.glb): every piece of
 * furniture built in code, with the procedural materials in materials.ts. Ported from grandma-wifi-godot's
 * main.gd: lights at the model's LIGHT_ markers, the clock's pendulum and hands, the router's blinking LEDs,
 * the TV's flicker on the rug, snow falling past the window.
 *
 * Objects the player can tap are named PROP_<id> in the model; the scene manifest links each interactable to
 * its node (`model`). Static meshes are merged per material at load (578 meshes → a few dozen draw calls).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Box3, BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, PlaneGeometry, Points, PointsMaterial, Vector3 } from "three";
import type { Material, Object3D, PointLight } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { PublicScene } from "@gwp/engine";
import { useGame } from "../store.ts";
import { useSettings } from "../settings.ts";
import { OBJECT_SPACE, TIME, highlightMaterial, materialFor, sparkleMaterial } from "./materials.ts";
import { Art, HITBOX_LAYER } from "./Room.tsx";

/** Nodes that move, so they stay separate meshes. */
const ANIMATED = /^(ClockPendulum|ClockHands|RouterLED\d)$/;

export interface HouseInfo {
  /** World boxes of the PROP_ nodes and other linked nodes, by node name. */
  boxes: Map<string, Box3>;
  /** Meshes under each linked node (for the hover highlight). */
  meshes: Map<string, Mesh[]>;
  /** Grandma's seat: where she sits and which way she faces. */
  seat: Object3D | null;
}

function keyOf(m: Material): string {
  return m.name.split(".")[0] ?? "";
}

/**
 * Keep only position and normal (the materials are procedural), and make sure there's an index. Copies the
 * data: the model is cached and shared, and baking a world matrix into it in place would move it for everyone
 * (React's dev double-run then moved the floor twice).
 */
function slim(g: BufferGeometry): BufferGeometry {
  const out = new BufferGeometry();
  out.setAttribute("position", g.getAttribute("position").clone());
  const n = g.getAttribute("normal");
  if (n) out.setAttribute("normal", n.clone());
  else out.computeVertexNormals();
  if (g.index) out.setIndex(g.index.clone());
  else out.setIndex(new BufferAttribute(Uint32Array.from({ length: g.getAttribute("position").count }, (_, i) => i), 1));
  return out;
}

/** Build the room once: materials, merged statics, the linked nodes' boxes. */
function prepare(source: Object3D, linked: Set<string>) {
  const root = source.clone(true);
  root.updateMatrixWorld(true);
  const boxes = new Map<string, Box3>();
  const meshes = new Map<string, Mesh[]>();
  const keep = new Set<Object3D>();
  // The linked nodes (and moving ones) keep their own meshes.
  root.traverse((o) => {
    if (linked.has(o.name) || ANIMATED.test(o.name)) {
      const list: Mesh[] = [];
      const box = new Box3();
      o.traverse((c) => {
        keep.add(c);
        if ((c as Mesh).isMesh) {
          list.push(c as Mesh);
          box.expandByObject(c);
        }
      });
      if (linked.has(o.name)) {
        boxes.set(o.name, box);
        meshes.set(o.name, list);
      }
    }
  });
  const groups = new Map<string, { material: Material; geos: BufferGeometry[] }>();
  const loose: Mesh[] = [];
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const src = Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material;
    const mat = materialFor(src.name) ?? src;
    mesh.material = mat;
    mesh.castShadow = !/glass|bulb|lampshade|sky|lace/.test(src.name);
    mesh.receiveShadow = true;
    if (keep.has(mesh) || OBJECT_SPACE.has(keyOf(src)) || (mat as { transparent?: boolean }).transparent) {
      loose.push(mesh);
      return;
    }
    const key = keyOf(src) || mat.uuid;
    const g = slim(mesh.geometry).applyMatrix4(mesh.matrixWorld);
    // A mirrored node (negative scale) turns its triangles inside out once the matrix is baked in; three only
    // corrects that per object, so flip their winding back here.
    if (mesh.matrixWorld.determinant() < 0) {
      const idx = g.index!.array as Uint16Array | Uint32Array;
      const flipped = idx.slice();
      for (let i = 0; i < flipped.length; i += 3) [flipped[i + 1], flipped[i + 2]] = [flipped[i + 2]!, flipped[i + 1]!];
      g.setIndex(new BufferAttribute(flipped, 1));
    }
    const entry = groups.get(key) ?? { material: mat, geos: [] };
    entry.geos.push(g);
    groups.set(key, entry);
    mesh.visible = false;
  });
  // Drop the merged originals from the graph; keep the rest in place.
  const toRemove: Object3D[] = [];
  root.traverse((o) => {
    if ((o as Mesh).isMesh && !o.visible) toRemove.push(o);
  });
  for (const o of toRemove) o.removeFromParent();
  const merged = new Group();
  merged.name = "MergedStatics";
  for (const [key, { material, geos }] of groups) {
    const geo = mergeGeometries(geos, false);
    if (!geo) continue;
    const m = new Mesh(geo, material);
    m.name = `merged:${key}`;
    m.castShadow = !/glass|bulb|lampshade|sky|lace|snow/.test(key);
    m.receiveShadow = true;
    merged.add(m);
  }
  const seat = root.getObjectByName("GRANDMA_SEAT") ?? null;
  return { root, merged, info: { boxes, meshes, seat } satisfies HouseInfo, loose: loose.length };
}

/** The room's lights at the model's markers. Quality decides shadows. */
function Lights({ root }: { root: Object3D }) {
  const quality = useSettings((s) => s.quality);
  const tv = useRef<PointLight>(null);
  const at = (name: string, fallback: [number, number, number]) => {
    const o = root.getObjectByName(name);
    return o ? (o.getWorldPosition(new Vector3()).toArray() as [number, number, number]) : fallback;
  };
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (tv.current) tv.current.intensity = 0.55 + 0.18 * Math.sin(t * 7) * Math.sin(t * 2.3);
  });
  const shadows = quality !== "low";
  return (
    <>
      <ambientLight color="#8c7378" intensity={quality === "high" ? 0.55 : 0.75} />
      <hemisphereLight args={["#ffe7c8", "#3a2a24", 0.35]} />
      <pointLight position={at("LIGHT_floorlamp", [-3.55, 1.5, -2.55])} color="#ffb36b" intensity={9} distance={7} decay={1.6} castShadow={shadows} shadow-mapSize={[1024, 1024]} shadow-bias={-0.002} shadow-radius={4} />
      <pointLight position={at("LIGHT_ceiling", [0.15, 2.25, -0.3])} color="#ffcf99" intensity={3.2} distance={8} decay={1.4} />
      <pointLight position={at("LIGHT_kitchen", [-5.3, 2, 1.9])} color="#ffe0a8" intensity={3} distance={5} decay={1.4} />
      <pointLight ref={tv} position={[2.55, 0.6, -0.35]} color="#8caeff" intensity={0.6} distance={2.6} decay={1.2} />
      {/* Cool moonlight through the window. */}
      <directionalLight position={[1.3, 3.5, -5]} color="#8c9ef2" intensity={0.55} castShadow={quality === "high"} shadow-mapSize={[1024, 1024]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-bias={-0.0015} />
    </>
  );
}

/** Snow drifting past the window (Godot: CPUParticles3D, 260 flakes). */
function Snow() {
  const ref = useRef<Points>(null);
  const geo = useMemo(() => {
    const n = 260;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = 1.3 + (Math.random() * 2 - 1) * 2.6;
      pos[i * 3 + 1] = Math.random() * 3;
      pos[i * 3 + 2] = -4.6 + (Math.random() * 2 - 1) * 1.6;
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    return g;
  }, []);
  const mat = useMemo(() => new PointsMaterial({ color: new Color("#e6edff"), size: 0.025, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false, fog: false }), []);
  useFrame((_, dt) => {
    const a = geo.getAttribute("position") as BufferAttribute;
    const arr = a.array as Float32Array;
    for (let i = 0; i < a.count; i++) {
      arr[i * 3 + 1]! -= dt * (0.25 + (i % 7) * 0.03);
      arr[i * 3]! += dt * 0.12 * Math.sin(i + arr[i * 3 + 1]! * 2);
      if (arr[i * 3 + 1]! < 0) arr[i * 3 + 1] = 3;
    }
    a.needsUpdate = true;
  });
  return <points ref={ref} geometry={geo} material={mat} />;
}

/** A glint over each clue not looked at yet (Godot: sparkle.gdshader). */
function Glints({ scene, info }: { scene: PublicScene; info: HouseInfo }) {
  const inspected = useGame((s) => s.inspected);
  const noteSeen = useGame((s) => s.noteSeen);
  const playing = useGame((s) => s.run?.status === "playing");
  const items = useMemo(
    () =>
      scene.interactables
        .filter((i) => ["clue", "note", "router", "glasses", "cookie_jar"].includes(i.kind))
        .map((it, k) => {
          const box = it.model ? info.boxes.get(it.model) : undefined;
          const c = box ? box.getCenter(new Vector3()) : new Vector3(...it.position);
          const top = box ? box.max.y : it.position[1] + it.size[1] / 2;
          return { it, pos: [c.x, top + 0.06, c.z] as [number, number, number], mat: sparkleMaterial(k * 1.7) };
        }),
    [scene, info],
  );
  const quad = useMemo(() => new PlaneGeometry(0.17, 0.17), []);
  if (!playing) return null;
  return (
    <>
      {items.map(({ it, pos, mat }) =>
        inspected.includes(it.id) || (it.kind === "note" && noteSeen) ? null : <mesh key={it.id} position={pos} geometry={quad} material={mat} renderOrder={10} frustumCulled={false} />,
      )}
    </>
  );
}

/**
 * Invisible boxes the pointer ray hits (one per interactable, on their own layer), sized from the model's node
 * when there is one, else from the manifest.
 */
function HitBoxes({ scene, info }: { scene: PublicScene; info: HouseInfo }) {
  const boxes = useMemo(
    () =>
      scene.interactables.map((it) => {
        const b = it.model ? info.boxes.get(it.model) : undefined;
        const c = b ? b.getCenter(new Vector3()) : new Vector3(...it.position);
        const s = b ? b.getSize(new Vector3()) : new Vector3(...it.size);
        // Small things get a generous target (a thumb on a phone is ~1 cm on screen).
        return { id: it.id, c: c.toArray() as [number, number, number], s: [Math.max(s.x + 0.06, 0.16), Math.max(s.y + 0.06, 0.16), Math.max(s.z + 0.06, 0.16)] as [number, number, number] };
      }),
    [scene, info],
  );
  return (
    <group>
      {boxes.map((b) => (
        <mesh key={b.id} position={b.c} layers={HITBOX_LAYER} userData={{ interactId: b.id }}>
          <boxGeometry args={b.s} />
          <meshBasicMaterial visible={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Hover: a warm rim over the object under the pointer (Godot: highlight.gdshader as a material overlay). */
function Highlight({ scene, info }: { scene: PublicScene; info: HouseInfo }) {
  const focusId = useGame((s) => s.focusId);
  useEffect(() => {
    const it = scene.interactables.find((i) => i.id === focusId);
    const list = it?.model ? info.meshes.get(it.model) : undefined;
    if (!list?.length) return;
    const overlays = list.map((m) => {
      const o = new Mesh(m.geometry, highlightMaterial);
      o.renderOrder = 5;
      m.add(o);
      return o;
    });
    return () => overlays.forEach((o) => o.removeFromParent());
  }, [focusId, scene, info]);
  return null;
}

/** Web-only objects (no node in the room model): drawn by the old art table, placed by the manifest. */
function Extras({ scene }: { scene: PublicScene }) {
  return (
    <>
      {scene.interactables
        .filter((it) => !it.model && it.kind !== "grandma")
        .map((it) => (
          <group key={it.id} position={it.position} rotation={[0, it.rotation_y ?? 0, 0]}>
            <Art item={it} />
          </group>
        ))}
    </>
  );
}

/** One object from the room model on its own (the examine card's close-up), turned as it stands in the room. */
export function RoomNode({ name }: { name: string }) {
  const gltf = useGLTF("/models/house/room.glb");
  const obj = useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    const src = gltf.scene.getObjectByName(name);
    if (!src) return null;
    const copy = src.clone(true);
    // Keep its world rotation and scale, drop its position: the card centres it.
    src.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale);
    copy.position.set(0, 0, 0);
    copy.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const m = Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material;
      mesh.material = materialFor(m.name) ?? m;
    });
    return copy;
  }, [gltf, name]);
  return obj ? <primitive object={obj} /> : null;
}

export function House({ scene, onReady }: { scene: PublicScene; onReady: (info: HouseInfo) => void }) {
  const gltf = useGLTF(scene.model ?? "/models/house/room.glb");
  const linked = useMemo(() => new Set(scene.interactables.map((i) => i.model).filter((m): m is string => Boolean(m))), [scene]);
  const built = useMemo(() => prepare(gltf.scene, linked), [gltf, linked]);
  useEffect(() => onReady(built.info), [built, onReady]);
  // Things that move (main.gd _animate_room).
  const parts = useMemo(() => {
    const r = built.root;
    const hands = r.getObjectByName("ClockHands");
    return {
      pendulum: r.getObjectByName("ClockPendulum"),
      hour: hands?.children[0],
      minute: hands?.children[1],
      leds: [0, 1, 2, 3].map((i) => r.getObjectByName(`RouterLED${i}`)).filter((o): o is Object3D => Boolean(o)),
    };
  }, [built]);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    TIME.value += dt;
    if (parts.pendulum) parts.pendulum.rotation.z = Math.sin(t * Math.PI) * 0.12;
    const now = new Date();
    const minutes = now.getMinutes() + now.getSeconds() / 60 + 4; // runs four minutes fast, and nobody may fix it
    if (parts.hour) parts.hour.rotation.z = (-2 * Math.PI * ((now.getHours() % 12) + minutes / 60)) / 12;
    if (parts.minute) parts.minute.rotation.z = (-2 * Math.PI * minutes) / 60;
    parts.leds.forEach((l, i) => (l.visible = Math.sin(t * (3 + i * 1.7) + i) > -0.6));
  });
  return (
    <group>
      <primitive object={built.root} />
      <primitive object={built.merged} />
      <Lights root={built.root} />
      <Snow />
      <Extras scene={scene} />
      <Glints scene={scene} info={built.info} />
      <HitBoxes scene={scene} info={built.info} />
      <Highlight scene={scene} info={built.info} />
    </group>
  );
}
