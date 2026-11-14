/**
 * The 3D room and its HUD, loaded as their own chunk (three.js and drei are most of the JS), so the
 * title screen appears without waiting for them. App prefetches this while the player reads the title.
 */
import type { PublicScene } from "@gwp/engine";
import { GameCanvas } from "./scene/GameCanvas.tsx";
import { Hud } from "./ui/Hud.tsx";

export default function Game({ scene }: { scene: PublicScene }) {
  return (
    <>
      <GameCanvas scene={scene} />
      <Hud />
    </>
  );
}
