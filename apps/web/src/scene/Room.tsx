/**
 * The room, built from the scene manifest. Each object's art comes from models.ts (CC0 models or
 * props made in code), scaled into the object's collider box; anything without art, or whose model
 * fails to load, falls back to a grey box. Collision and interaction only ever use the manifest.
 */
import { Suspense, forwardRef, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { ContactShadows } from "@react-three/drei";
import { Glint } from "./Glint.tsx";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { PublicScene } from "@gwp/engine";
import { useGame } from "../store.ts";
import { ART } from "./models.ts";
import type { Vec3 } from "./models.ts";
import { ArtBoundary, GltfModel } from "./Model.tsx";
import { Handmade } from "./handmade.tsx";
import { GrandmaModel } from "./Grandma.tsx";
import { ceiling, wallpaper, woodFloor } from "./textures.ts";

type Item = PublicScene["props"][number] | PublicScene["interactables"][number];

function Shape({ item, highlight }: { item: Item; highlight?: boolean }) {
  const [w, h, d] = item.size;
  const emissive = highlight ? "#5a4a10" : "#000000";
  if (item.shape === "cylinder") {
    return (
      <mesh>
        <cylinderGeometry args={[w / 2, w / 2, h, 8]} />
        <meshLambertMaterial color={item.color} emissive={emissive} flatShading />
      </mesh>
    );
  }
  return (
    <mesh>
      <boxGeometry args={[w, h, d]} />
      <meshLambertMaterial color={item.color} emissive={emissive} flatShading />
    </mesh>
  );
}

/** The old low-poly stand-in, used while the real Grandma loads or if her model fails. */
function GrandmaFigure({ item, highlight }: { item: Item; highlight: boolean }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = Math.sin(clock.getElapsedTime() * 1.6) * 0.01;
  });
  const [, h] = item.size;
  const emissive = highlight ? "#3a2a40" : "#000000";
  return (
    <group ref={ref}>
      <mesh position={[0, -h / 2 + 0.38, 0]}>
        <cylinderGeometry args={[0.17, 0.27, 0.76, 7]} />
        <meshLambertMaterial color={item.color} emissive={emissive} flatShading />
      </mesh>
      <mesh position={[0, -h / 2 + 0.88, 0]}>
        <icosahedronGeometry args={[0.14, 0]} />
        <meshLambertMaterial color="#e8c4a8" emissive={emissive} flatShading />
      </mesh>
    </group>
  );
}

/** The art for one object, with the grey box as a fallback while loading or on error. */
function Art({ item, highlight = false }: { item: Item; highlight?: boolean }) {
  const art = ART[item.node];
  const box = item.shape === "figure" ? <GrandmaFigure item={item} highlight={highlight} /> : <Shape item={item} highlight={highlight} />;
  const safe = (node: ReactNode) => (
    <ArtBoundary fallback={box}>
      <Suspense fallback={box}>{node}</Suspense>
    </ArtBoundary>
  );
  if (item.shape === "figure") return safe(<GrandmaModel size={item.size} highlight={highlight} />);
  if (!art) return box;
  if (art.kind === "none") return null;
  if (art.kind === "handmade") return <Handmade name={art.name} size={item.size} highlight={highlight} />;
  return safe(<GltfModel spec={art} size={item.size} position={item.position} highlight={highlight} />);
}

/** Invisible box the crosshair ray hits: the same for every object, however detailed its art. */
function HitBox({ size }: { size: Vec3 }) {
  const s = size.map((v) => Math.max(v, 0.14)) as Vec3;
  return (
    <mesh>
      <boxGeometry args={s} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

const Placed = forwardRef<Group, { item: Item; children: ReactNode; userData?: Record<string, unknown> }>(
  function Placed({ item, children, userData }, ref) {
    return (
      <group ref={ref} name={item.node} position={item.position} rotation={[0, item.rotation_y ?? 0, 0]} userData={userData}>
        {children}
      </group>
    );
  },
);

function Shell({ scene }: { scene: PublicScene }) {
  const { width: W, depth: D, height: H } = scene.room;
  const tex = useMemo(
    () => ({
      floor: woodFloor(W, D),
      ceiling: ceiling(W, D, scene.room.ceiling_color),
      wallX: wallpaper(W, scene.room.wall_color),
      wallZ: wallpaper(D, scene.room.wall_color),
    }),
    [W, D, scene.room.ceiling_color, scene.room.wall_color],
  );
  const walls: { p: Vec3; ry: number; w: number; t: "wallX" | "wallZ" }[] = [
    { p: [0, H / 2, -D / 2], ry: 0, w: W, t: "wallX" },
    { p: [0, H / 2, D / 2], ry: Math.PI, w: W, t: "wallX" },
    { p: [-W / 2, H / 2, 0], ry: Math.PI / 2, w: D, t: "wallZ" },
    { p: [W / 2, H / 2, 0], ry: -Math.PI / 2, w: D, t: "wallZ" },
  ];
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={tex.floor} roughness={0.75} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={tex.ceiling} roughness={1} />
      </mesh>
      {walls.map((w, i) => (
        <group key={i} position={w.p} rotation={[0, w.ry, 0]}>
          <mesh>
            <planeGeometry args={[w.w, H]} />
            <meshStandardMaterial map={tex[w.t]} roughness={0.95} />
          </mesh>
          {/* crown molding */}
          <mesh position={[0, H / 2 - 0.04, 0.03]}>
            <boxGeometry args={[w.w, 0.08, 0.06]} />
            <meshStandardMaterial color="#efe4cc" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Room({ scene, interactRef }: { scene: PublicScene; interactRef: React.RefObject<Group | null> }) {
  const focusId = useGame((s) => s.focusId);
  const { height: H } = scene.room;
  return (
    <group>
      <Shell scene={scene} />
      {/* Soft shadows under furniture, baked once (frames=1): cheap, and nothing big moves. */}
      <ContactShadows position={[0, 0.004, 0]} scale={[scene.room.width, scene.room.depth]} resolution={512} far={1.6} blur={2.2} opacity={0.55} frames={1} color="#2a1810" />

      {scene.props.map((p) => (
        <Placed key={p.id} item={p}>
          <Art item={p} />
        </Placed>
      ))}

      {/* Everything the player can look at and press E on lives under interactRef, for raycasting. */}
      <group ref={interactRef}>
        {scene.interactables.map((it) => (
          <Placed key={it.id} item={it} userData={{ interactId: it.id }}>
            <HitBox size={it.size} />
            <Art item={it} highlight={focusId === it.id} />
            {(it.kind === "clue" || it.kind === "note") && <Glint id={it.id} size={it.size} />}
          </Placed>
        ))}
      </group>

      {/* warm living-room light */}
      <hemisphereLight args={["#fff1d6", "#4a3426", 1.1]} />
      <pointLight position={[-0.5, H - 0.45, -0.8]} intensity={5} distance={9} decay={1.6} color="#ffd9a0" />
      <pointLight position={[-3, H - 0.4, 1.6]} intensity={3} distance={5} decay={1.6} color="#fff4e0" />
      <pointLight position={[-3.3, 1.5, -2.6]} intensity={1.5} distance={3} decay={1.6} color="#ffc070" />
    </group>
  );
}

