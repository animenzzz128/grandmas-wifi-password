/**
 * A small twinkle above a clue the player hasn't inspected yet, shown only when they're close.
 * Telegraphs "this matters" without a waypoint (important objects look interesting, filler looks plain).
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { Vector3 } from "three";
import { useGame } from "../store.ts";
import type { Vec3 } from "./models.ts";

const SHOW_WITHIN = 3.2; // meters
const world = new Vector3();

export function Glint({ id, size }: { id: string; size: Vec3 }) {
  const ref = useRef<Mesh>(null);
  const inspected = useGame((s) => s.inspected.includes(id) || (id === "sticky_note" && s.noteSeen));
  useFrame(({ clock, camera }) => {
    const m = ref.current;
    if (!m) return;
    m.getWorldPosition(world);
    const near = world.distanceTo(camera.position) < SHOW_WITHIN;
    m.visible = near && !inspected;
    if (!m.visible) return;
    const t = clock.getElapsedTime() + id.length;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
    m.scale.setScalar(0.6 + pulse * 0.6);
    m.rotation.y = t * 1.5;
  });
  return (
    <mesh ref={ref} position={[0, size[1] / 2 + 0.1, 0]} raycast={() => undefined}>
      <octahedronGeometry args={[0.025, 0]} />
      <meshBasicMaterial color="#fff2b0" transparent opacity={0.9} depthWrite={false} />
    </mesh>
  );
}
