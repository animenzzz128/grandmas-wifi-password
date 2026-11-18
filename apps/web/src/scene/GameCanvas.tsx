import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ACESFilmicToneMapping, AgXToneMapping, PCFShadowMap } from "three";
import { ADAPT, adapt, qualityStep } from "./adaptive.ts";
import { t } from "../strings.ts";
import { useSettings } from "../settings.ts";
import { useGame } from "../store.ts";
import { RetroFilter } from "./RetroFilter.tsx";
import type { PublicScene } from "@gwp/engine";
import { House } from "./House.tsx";
import type { HouseInfo } from "./House.tsx";
import { Rosie } from "./Rosie.tsx";
import { ViewRig } from "./ViewRig.tsx";
import { HighPost } from "./HighPost.tsx";
import { setRichMaterials } from "./materials.ts";

const PARAMS = new URLSearchParams(location.search);
const POST_PARAM = PARAMS.get("post");

/** Resolution by quality (device pixels per CSS pixel), capped by the screen. ?px= pins it (screenshots). */
const PINNED = PARAMS.has("px") ? Math.min(2, Math.max(0.25, Number(PARAMS.get("px")) || 1)) : null;
const MAX_DPR = { low: 1, medium: 1.25, high: 2 } as const;

/** Dev only: the renderer and scene for performance checks from the console (draw calls, frame cost). */
function DevHooks() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const get = useThree((s) => s.get);
  useEffect(() => {
    // advance(): draw one whole frame on demand (post-processing included), for timing from the console.
    if (import.meta.env.DEV) Object.assign(window, { __three: { gl, scene, camera, advance: () => get().advance(performance.now()) } });
  }, [gl, scene, camera, get]);
  return null;
}

/**
 * Watches the frame rate and calls `onScale` with a new resolution scale when it should change (see
 * adaptive.ts). Frames longer than a quarter second (a hidden tab, a breakpoint) aren't counted.
 */
function AdaptiveResolution({ scale, max, onScale }: { scale: number; max: number; onScale: (scale: number) => void }) {
  const acc = useRef({ time: 0, frames: 0, goodStreak: 0, slowStreak: 0 });
  useFrame((_, dt) => {
    if (dt > 0.25) return;
    const a = acc.current;
    a.time += dt;
    a.frames++;
    if (a.time < ADAPT.window) return;
    const fps = a.frames / a.time;
    const next = adapt({ scale, goodStreak: a.goodStreak }, fps, max);
    Object.assign(a, { time: 0, frames: 0, goodStreak: next.goodStreak });
    // Still slow: step the quality down too (High → Medium → Low), if the player left it on automatic.
    const q = qualityStep(a.slowStreak, fps);
    a.slowStreak = q.slowStreak;
    const prefs = useSettings.getState();
    if (q.down && prefs.autoQuality && prefs.quality !== "low") {
      const lower = prefs.quality === "high" ? "medium" : "low";
      prefs.set({ quality: lower });
      useGame.getState().showHint(t("settings.qualityLowered", { quality: t(`settings.quality.${lower}`) }));
    }
    if (import.meta.env.DEV) ((window as unknown as { __dprLog?: unknown[] }).__dprLog ??= []).push({ t: Math.round(performance.now()), fps: Math.round(fps), scale: next.scale });
    if (next.scale !== scale) onScale(next.scale);
  });
  return null;
}

/**
 * Shadow maps on Medium and High; Low (phones) goes without. The room doesn't move, so the shadow maps are
 * drawn a few times while it settles and then kept (re-drawing the lamp's cube map every frame cost ~100 ms
 * on an integrated GPU). Grandma's own breathing doesn't change her shadow enough to notice.
 */
function ShadowSwitch({ ready }: { ready: boolean }) {
  const gl = useThree((s) => s.gl);
  const quality = useSettings((s) => s.quality);
  const frames = useRef(0);
  useEffect(() => {
    setRichMaterials(quality === "high");
    gl.shadowMap.enabled = quality !== "low";
    gl.shadowMap.type = PCFShadowMap;
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    frames.current = 0;
  }, [gl, quality, ready]);
  useFrame(() => {
    // A few refreshes after load or a quality change (models and Grandma's seat settle in the first frames).
    if (frames.current < 3) {
      frames.current++;
      gl.shadowMap.needsUpdate = true;
    }
  });
  return null;
}

export function GameCanvas({ scene }: { scene: PublicScene }) {
  const retro = useSettings((s) => s.retro) && POST_PARAM !== "0";
  const quality = useSettings((s) => s.quality);
  const max = Math.min(MAX_DPR[quality], typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  const [dpr, setDpr] = useState(PINNED ?? max);
  useEffect(() => setDpr(PINNED ?? max), [max]);
  // Behind a close-up card the room stops redrawing (the card has its own small canvas; iteration 49).
  const examining = useGame((s) => s.panel?.type === "inspect");
  const [info, setInfo] = useState<HouseInfo | null>(null);
  const onReady = useCallback((i: HouseInfo) => setInfo(i), []);
  return (
    <Canvas
      id="game-canvas"
      dpr={dpr}
      shadows
      frameloop={examining ? "demand" : "always"}
      gl={{ antialias: quality !== "low", powerPreference: "high-performance", toneMapping: quality === "low" ? ACESFilmicToneMapping : AgXToneMapping, toneMappingExposure: 1.1 }}
      camera={{ fov: 55, near: 0.03, far: 60, position: [3, 1.6, -2.5] }}
    >
      {PINNED === null && <AdaptiveResolution scale={dpr} max={max} onScale={setDpr} />}
      <ShadowSwitch ready={Boolean(info)} />
      <color attach="background" args={["#120c08"]} />
      <Suspense fallback={null}>
        <House scene={scene} onReady={onReady} />
        <Rosie seat={info?.seat ?? null} />
      </Suspense>
      <ViewRig scene={scene} info={info} />
      {import.meta.env.DEV && <DevHooks />}
      {retro ? <RetroFilter /> : quality === "high" && info && <HighPost ao={PARAMS.get("ao") === "1"} bloom={PARAMS.get("bloom") !== "0"} />}
    </Canvas>
  );
}
