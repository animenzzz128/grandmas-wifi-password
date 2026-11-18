/**
 * High quality only: a soft glow around the lamps and bulbs (bloom), then three's own tone mapping and colour
 * output, like the Godot edition's glow on High. Off on Medium and Low, and while the retro filter is on (it
 * renders the frame itself).
 *
 * Ambient occlusion (GTAO) is here but off: with the camera's view offset (framing above the HUD dock) it washed
 * the picture out to a pale haze, and it cost ~30 ms a frame on an integrated GPU. Try it with ?ao=1.
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector2 } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

export function HighPost({ ao = false, bloom = true }: { ao?: boolean; bloom?: boolean }) {
  const { gl, scene, camera, size } = useThree();
  const dpr = useThree((s) => s.viewport.dpr);
  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    if (ao) {
      const gtao = new GTAOPass(scene, camera, 1, 1);
      gtao.blendIntensity = 0.85;
      gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1, scale: 1, samples: 12 });
      c.addPass(gtao);
    }
    // Only the brightest things glow: bulbs, the lampshade, the TV picture.
    // The frame is still linear HDR here (before tone mapping): the lampshade near the bulb is far above 1.
    if (bloom) c.addPass(new UnrealBloomPass(new Vector2(256, 256), 0.18, 0.35, 4));
    c.addPass(new OutputPass());
    return c;
  }, [gl, scene, camera, ao, bloom]);
  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
  }, [composer, gl, size, dpr]);
  useEffect(() => () => composer.dispose(), [composer]);
  // Priority 1 takes over rendering from R3F.
  useFrame((_, dt) => composer.render(dt), 1);
  return null;
}
