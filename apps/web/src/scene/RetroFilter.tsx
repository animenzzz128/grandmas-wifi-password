/**
 * Retro post-process: posterize each channel, add a 4×4 ordered dither and a slight warm grade, so
 * furniture from different packs, Grandma and the code-made props read as one palette (art bible:
 * avocado, mustard, walnut, cream, faded rose). One extra fullscreen pass; no extra dependencies.
 * Turn it off in Settings ("Retro filter") or with ?post=0.
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Mesh, NearestFilter, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, WebGLRenderTarget } from "three";

const fragment = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uSize;
uniform float uLevels;
varying vec2 vUv;

float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int i = x + y * 4;
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return m[i] / 16.0 - 0.5;
}

// The render target holds linear colour; the screen wants sRGB. Convert here (this ShaderMaterial
// skips three's own output conversion), then posterize in sRGB where the steps look even.
vec3 toSRGB(vec3 l) {
  return mix(l * 12.92, 1.055 * pow(max(l, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), l));
}

void main() {
  vec3 c = toSRGB(texture2D(tScene, vUv).rgb);
  // warm grade: lift reds a touch, sink blues, soften contrast
  c = c * vec3(1.04, 1.0, 0.92) + vec3(0.012, 0.006, 0.0);
  // ordered dither, then posterize
  float d = bayer4(vUv * uSize) / uLevels;
  c = floor((c + d) * uLevels + 0.5) / uLevels;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

const vertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export function RetroFilter({ levels = 14 }: { levels?: number }) {
  const { gl, scene, camera, size } = useThree();
  const target = useMemo(() => new WebGLRenderTarget(1, 1, { magFilter: NearestFilter, minFilter: NearestFilter }), []);
  const { post, cam, mat } = useMemo(() => {
    const mat = new ShaderMaterial({
      uniforms: { tScene: { value: null }, uSize: { value: new Vector2(1, 1) }, uLevels: { value: levels } },
      vertexShader: vertex,
      fragmentShader: fragment,
      depthTest: false,
      depthWrite: false,
    });
    const post = new Scene();
    post.add(new Mesh(new PlaneGeometry(2, 2), mat));
    return { post, cam: new OrthographicCamera(-1, 1, 1, -1, 0, 1), mat };
  }, [levels]);

  useEffect(() => {
    const pr = gl.getPixelRatio();
    target.setSize(Math.max(1, Math.floor(size.width * pr)), Math.max(1, Math.floor(size.height * pr)));
    mat.uniforms.uSize!.value.set(target.width, target.height);
  }, [gl, size, target, mat]);
  useEffect(() => () => target.dispose(), [target]);

  // Priority 1 takes over rendering from R3F: scene → target → filtered quad on screen.
  useFrame(() => {
    gl.setRenderTarget(target);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    mat.uniforms.tScene!.value = target.texture;
    gl.render(post, cam);
  }, 1);
  return null;
}
