/**
 * The 3D room and its HUD, loaded as their own chunk (three.js and drei are most of the JS), so the
 * title screen appears without waiting for them. The room also shows behind the title screen.
 */
import { useProgress } from "@react-three/drei";
import type { PublicScene } from "@gwp/engine";
import { GameCanvas } from "./scene/GameCanvas.tsx";
import { Hud } from "./ui/Hud.tsx";
import { useGame } from "./store.ts";
import { t } from "./strings.ts";

/** While the house is still downloading, say so (the title shows over an empty room meanwhile). */
function HouseLoading() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="loading-pill house-loading" role="status">
      {t("loading.room", { pct: Math.round(progress) })}
    </div>
  );
}

export default function Game({ scene }: { scene: PublicScene }) {
  const playing = useGame((s) => Boolean(s.run));
  return (
    <>
      <GameCanvas scene={scene} />
      <HouseLoading />
      {playing && <Hud />}
    </>
  );
}
