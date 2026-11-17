import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ADAPT, adapt } from "./adaptive.ts";
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

/** Dev only: the renderer and scene for performance checks from the console (draw calls, frame cost). */
function DevHooks() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __three: { gl, scene } });
  }, [gl, scene]);
  return null;
}

/** Set ?px= to pin the resolution (no adapting), e.g. for screenshots. */
const PINNED = new URLSearchParams(location.search).has("px");

/**
 * Watches the frame rate and calls `onScale` with a new resolution scale when it should change (see
 * adaptive.ts). Frames longer than a quarter second (a hidden tab, a breakpoint) aren't counted.
 */
function AdaptiveResolution({ scale, onScale }: { scale: number; onScale: (scale: number) => void }) {
  const acc = useRef({ time: 0, frames: 0, goodStreak: 0 });
  useFrame((_, dt) => {
    if (dt > 0.25) return;
    const a = acc.current;
    a.time += dt;
    a.frames++;
    if (a.time < ADAPT.window) return;
    const fps = a.frames / a.time;
    const next = adapt({ scale, goodStreak: a.goodStreak }, fps, PIXEL_SCALE);
    Object.assign(a, { time: 0, frames: 0, goodStreak: next.goodStreak });
    if (import.meta.env.DEV) ((window as unknown as { __dprLog?: unknown[] }).__dprLog ??= []).push({ t: Math.round(performance.now()), fps: Math.round(fps), scale: next.scale });
    if (next.scale !== scale) onScale(next.scale);
  });
  return null;
}

export function GameCanvas({ scene }: { scene: PublicScene }) {
  const interactRef = useRef<Group>(null);
  const retro = useSettings((s) => s.retro) && POST_PARAM !== "0";
  // Adaptive resolution (iteration 48): fewer pixels when the frame rate stays low, back up when it recovers.
  const [dpr, setDpr] = useState(PIXEL_SCALE);
  return (
    <Canvas id="game-canvas" dpr={dpr} gl={{ antialias: false, powerPreference: "high-performance" }} camera={{ fov: 70, near: 0.05, far: 40 }} flat>
      {!PINNED && <AdaptiveResolution scale={dpr} onScale={setDpr} />}
      <color attach="background" args={[scene.room.fog_color]} />
      <fog attach="fog" args={[scene.room.fog_color, 5, 13]} />
      <Room scene={scene} interactRef={interactRef} />
      <Player scene={scene} interactRef={interactRef} />
      <FovFromSettings />
      {import.meta.env.DEV && <DevHooks />}
      {retro && <RetroFilter />}
    </Canvas>
  );
}
