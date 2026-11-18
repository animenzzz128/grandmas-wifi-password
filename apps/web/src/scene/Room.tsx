/**
 * Art for objects the house model (House.tsx) doesn't have: the fishing rod, the house number sign, and the
 * close-up card's open fridge, wedding photo and album. Each object's art comes from models.ts (CC0 models or
 * props made in code), scaled into its box from the scene manifest; without art, or if a model fails to load,
 * a plain box stands in. (Until iteration 54 this file built the whole walk-around room.)
 */
import { Suspense, useRef } from "react";
import type { ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { PublicScene } from "@gwp/engine";
import { ART } from "./models.ts";
import type { Vec3 } from "./models.ts";
import { ArtBoundary, GltfModel } from "./Model.tsx";
import { Handmade } from "./handmade.tsx";
import type { Detail } from "./handmade.tsx";
import { GrandmaModel } from "./Grandma.tsx";

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

/** The art for one object, with the grey box as a fallback while loading or on error. Also used by the examine view. */
export function Art({ item, highlight = false, detail }: { item: Item; highlight?: boolean; detail?: Detail }) {
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
  if (art.kind === "handmade") return safe(<Handmade name={art.name} size={item.size} highlight={highlight} detail={detail} />);
  return safe(<GltfModel spec={art} size={item.size} position={item.position} highlight={highlight} />);
}

/** Invisible box the crosshair ray hits: the same for every object, however detailed its art. */
/**
 * Hit boxes live on their own layer, and the look ray tests only that layer: one box per object instead of
 * every triangle of every model. Raycasting Grandma's skinned body re-poses all its vertices in JavaScript,
 * which cost 5–10 ms a frame whenever you looked at her (iteration 48). The camera doesn't render this layer.
 */
export const HITBOX_LAYER = 1;
