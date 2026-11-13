import { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { useSettings } from "../settings.ts";
import { RetroFilter } from "./RetroFilter.tsx";

const POST_PARAM = new URLSearchParams(location.search).get("post");
import type { Group } from "three";
import type { PublicScene } from "@gwp/engine";
import { Room } from "./Room.tsx";
import { Player } from "./Player.tsx";

/**
 * Render resolution relative to the screen. Lower = chunkier pixels. 0.42 looked crunchy but made
 * small mouse movements feel steppy, so 0.6 is the default. Try others with ?px=0.4 in the URL.
 */
const PIXEL_SCALE = Math.min(1, Math.max(0.25, Number(new URLSearchParams(location.search).get("px")) || 0.6));

/**
 * The "rough 3D" look: no antialiasing, a low pixel ratio, and the canvas upscaled with
 * image-rendering: pixelated (see styles.css). Easy to match in Godot later.
 */
/** Applies the field-of-view setting to the camera. */
function FovFromSettings() {
  const fov = useSettings((s) => s.fov);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useEffect(() => {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }, [camera, fov]);
  return null;
}

export function GameCanvas({ scene }: { scene: PublicScene }) {
  const interactRef = useRef<Group>(null);
  const retro = useSettings((s) => s.retro) && POST_PARAM !== "0";
  return (
    <Canvas id="game-canvas" dpr={PIXEL_SCALE} gl={{ antialias: false, powerPreference: "high-performance" }} camera={{ fov: 70, near: 0.05, far: 40 }} flat>
      <color attach="background" args={[scene.room.fog_color]} />
      <fog attach="fog" args={[scene.room.fog_color, 5, 13]} />
      <Room scene={scene} interactRef={interactRef} />
      <Player scene={scene} interactRef={interactRef} />
      <FovFromSettings />
      {retro && <RetroFilter />}
    </Canvas>
  );
}
