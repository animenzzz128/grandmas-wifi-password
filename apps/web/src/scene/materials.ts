/**
 * The house's materials, ported from the Godot edition (grandma-wifi-godot/game/scripts/material_library.gd and
 * its shaders/*.gdshader). The Blender scripts name each material ("wood_walnut", "knit_lilac", "rug_persian");
 * here each name becomes a three.js material. Most are MeshPhysicalMaterial with procedural colour and roughness
 * patched into three's own lighting (onBeforeCompile), so they keep shadows, fog and tone mapping.
 *
 * Colours given as hex are sRGB (three converts them); constants inside the shader code are linear, as in Godot.
 */
import { AdditiveBlending, Color, DoubleSide, MeshBasicMaterial, MeshPhysicalMaterial, ShaderMaterial } from "three";
import type { Material, WebGLProgramParametersWithUniforms } from "three";

/** Shared clock for animated materials (sky stars, the TV picture, glints). Advanced by the room each frame. */
export const TIME = { value: 0 };

const NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
  return v;
}
vec2 plane_uv(vec3 p, vec3 n) {
  vec3 a = abs(n);
  if (a.y > a.x && a.y > a.z) return p.xz;
  if (a.x > a.z) return p.zy;
  return p.xy;
}
`;

type Uniforms = Record<string, { value: unknown }>;

interface Procedural {
  /** GLSL that sets `vec3 albedo` (and may set `float rough`, `vec3 emit`, `float cut`), with wpos, wnrm, opos, onrm in scope. */
  body: string;
  uniforms?: Uniforms;
}

/**
 * Patch a physical material: its base colour, roughness, emission and cut-out come from `body`. World and object
 * position and normal are passed from the vertex shader (after skinning/morphing, so they follow animation).
 */
function patch(m: MeshPhysicalMaterial, p: Procedural, key: string): MeshPhysicalMaterial {
  const uniforms: Uniforms = { uTime: TIME, ...(p.uniforms ?? {}) };
  const decl = Object.entries(uniforms)
    .map(([k, u]) => `uniform ${u.value instanceof Color ? "vec3" : typeof u.value === "boolean" ? "bool" : "float"} ${k};`)
    .join("\n");
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;\nvarying vec3 vOPos;\nvarying vec3 vONrm;\nvarying vec3 vOrigin;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * objectNormal);\nvOPos = transformed;\nvONrm = objectNormal;\nvOrigin = modelMatrix[3].xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;\nvarying vec3 vOPos;\nvarying vec3 vONrm;\nvarying vec3 vOrigin;\n${decl}\n${NOISE}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec3 wpos = vWPos; vec3 wnrm = normalize(vWNrm); vec3 opos = vOPos; vec3 onrm = normalize(vONrm);
        vec3 albedo = diffuseColor.rgb; float rough = -1.0; vec3 emit = vec3(0.0); float cut = 0.0;
        ${p.body}
        if (cut > 0.5) discard;
        diffuseColor.rgb = albedo;`,
      )
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nif (rough >= 0.0) roughnessFactor = rough;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += emit;");
  };
  // One compiled program per kind of patch (the uniforms differ per material, the code doesn't).
  m.customProgramCacheKey = () => key;
  return m;
}

const lin = (hex: string) => new Color(hex);

// ---------------------------------------------------------------- the procedural materials (Godot shaders)

function wood(o: { light: string; dark: string; grain?: number; rough?: number; planks?: boolean; varnish?: number; warp?: number }) {
  const m = new MeshPhysicalMaterial({ clearcoat: o.varnish ?? 0.35, clearcoatRoughness: 0.25 });
  return patch(
    m,
    {
      uniforms: {
        light_col: { value: lin(o.light) },
        dark_col: { value: lin(o.dark) },
        grain_scale: { value: o.grain ?? 22 },
        roughness_base: { value: o.rough ?? 0.42 },
        planks: { value: Boolean(o.planks) },
        varnish: { value: o.varnish ?? 0.35 },
        warp_amount: { value: o.warp ?? 2.5 },
      },
      body: /* glsl */ `
        vec2 g = plane_uv(wpos, wnrm);
        float tint = 0.0; float seam = 0.0;
        if (planks) {
          float pw = 0.14; float pl = 1.25;
          float row = floor(wpos.z / pw);
          float off = hash12(vec2(row, 3.0)) * pl;
          float col = floor((wpos.x + off) / pl);
          float id = hash12(vec2(row, col));
          tint = (id - 0.5) * 0.35;
          float fz = fract(wpos.z / pw);
          float fx = fract((wpos.x + off) / pl);
          seam = max(1.0 - smoothstep(0.0, 0.035, min(fz, 1.0 - fz)), 1.0 - smoothstep(0.0, 0.006, min(fx, 1.0 - fx)));
          g = vec2(wpos.x + id * 7.0, wpos.z + id * 3.0);
        }
        float warp = fbm(g * vec2(1.2, 9.0)) * warp_amount;
        float rings = sin((g.y * grain_scale + warp * 3.0) * 3.14159);
        float grain = smoothstep(-0.2, 1.0, rings) * 0.55 + fbm(g * vec2(3.0, 60.0)) * 0.45;
        float pores = step(0.82, vnoise(g * vec2(40.0, 400.0))) * 0.25;
        vec3 c = mix(dark_col, light_col, clamp(grain + tint, 0.0, 1.0));
        c *= 1.0 - pores;
        albedo = mix(c, c * 0.35, seam);
        rough = clamp(roughness_base + (1.0 - grain) * 0.12 + seam * 0.4 - varnish * 0.2, 0.05, 1.0);`,
    },
    "wood",
  );
}

function wallpaper() {
  return patch(
    new MeshPhysicalMaterial({ roughness: 0.85, specularIntensity: 0.3 }),
    {
      uniforms: { base_col: { value: lin("#dbc7a1") }, stripe_col: { value: lin("#ccad8c") }, rose_col: { value: lin("#b85c61") }, leaf_col: { value: lin("#6b855c") } },
      body: /* glsl */ `
        float u = abs(wnrm.x) > 0.5 ? wpos.z : wpos.x;
        float v = wpos.y;
        float s = fract(u / 0.24);
        vec3 c = mix(base_col, stripe_col, smoothstep(0.48, 0.5, s) * (1.0 - smoothstep(0.98, 1.0, s)));
        float thin = 1.0 - smoothstep(0.0, 0.012, abs(s - 0.49));
        c = mix(c, stripe_col * 0.85, thin * 0.6);
        vec2 cell = vec2(u / 0.24, v / 0.2 + floor(u / 0.24) * 0.5);
        vec2 q = fract(cell) - vec2(0.25, 0.5);
        q.x *= 0.24 / 0.2;
        float r = length(q);
        float ang = atan(q.y, q.x);
        float petals = 0.045 + 0.012 * sin(ang * 5.0 + 1.0);
        float rose = 1.0 - smoothstep(petals - 0.006, petals, r);
        float heart = 1.0 - smoothstep(0.012, 0.018, r);
        vec2 lc = q - vec2(0.05, -0.04);
        float leaf = 1.0 - smoothstep(0.018, 0.024, length(lc * vec2(1.0, 2.2)));
        vec2 lc2 = q - vec2(-0.05, -0.045);
        leaf = max(leaf, 1.0 - smoothstep(0.016, 0.022, length(lc2 * vec2(1.0, 2.4))));
        c = mix(c, leaf_col, leaf * 0.85);
        c = mix(c, rose_col, rose * 0.85);
        c = mix(c, rose_col * 0.6, heart * 0.7);
        float age = fbm(vec2(u, v) * 3.0);
        c *= 0.93 + age * 0.1;
        albedo = mix(c, c * vec3(1.0, 0.94, 0.82), smoothstep(1.6, 2.7, v) * 0.35);`,
    },
    "wallpaper",
  );
}

function fabric(o: { color: string; sheen?: number; weave?: number; pattern?: boolean }) {
  const m = new MeshPhysicalMaterial({ roughness: 0.9, specularIntensity: 0.25, sheen: o.sheen ?? 0.55, sheenRoughness: 0.55, sheenColor: new Color(o.color).lerp(new Color("#ffffff"), 0.4) });
  return patch(
    m,
    {
      uniforms: { color: { value: lin(o.color) }, weave_scale: { value: o.weave ?? 520 }, pattern: { value: o.pattern ? 1 : 0 } },
      body: /* glsl */ `
        vec2 uv = plane_uv(wpos, wnrm);
        float w = sin(uv.x * weave_scale) * sin(uv.y * weave_scale);
        float mott = fbm(uv * 6.0);
        vec3 c = color * (0.88 + 0.08 * w + 0.16 * (mott - 0.5));
        if (pattern > 0.5) {
          vec2 q = fract(uv / 0.07) - 0.5;
          c = mix(c, vec3(0.95, 0.9, 0.82), (1.0 - smoothstep(0.1, 0.14, length(q))) * 0.7);
        }
        albedo = c;`,
    },
    "fabric",
  );
}

function knit(o: { color: string; stitch?: number; granny?: boolean }) {
  const m = new MeshPhysicalMaterial({ roughness: 0.95, specularIntensity: 0.2, sheen: 0.5, sheenRoughness: 0.7, sheenColor: new Color(o.color).lerp(new Color("#ffffff"), 0.5) });
  return patch(
    m,
    {
      uniforms: { color: { value: lin(o.color) }, stitch: { value: o.stitch ?? 0.011 }, granny: { value: o.granny ? 1 : 0 } },
      body: /* glsl */ `
        vec2 uv = granny > 0.5 ? plane_uv(opos, onrm) : plane_uv(wpos, wnrm);
        vec2 s = uv / stitch;
        float colx = fract(s.x) - 0.5;
        float row = fract(s.y + abs(colx) * 0.9);
        float vv = smoothstep(0.0, 0.25, row) * (1.0 - smoothstep(0.65, 1.0, row));
        float edge = 1.0 - smoothstep(0.38, 0.5, abs(colx));
        float k = vv * mix(0.7, 1.0, edge);
        vec3 c = color;
        if (granny > 0.5) {
          vec2 sq = uv / 0.09;
          vec2 id = floor(sq);
          vec2 f = fract(sq) - 0.5;
          float ring = max(abs(f.x), abs(f.y));
          vec3 pal0 = vec3(0.85, 0.35, 0.3); vec3 pal1 = vec3(0.95, 0.75, 0.3); vec3 pal2 = vec3(0.35, 0.6, 0.55);
          vec3 pal3 = vec3(0.6, 0.45, 0.7); vec3 pal4 = vec3(0.95, 0.6, 0.55);
          float k1 = floor(hash12(id) * 4.99); float k2 = floor(hash12(id + 7.0) * 4.99);
          vec3 a1 = k1 < 1.0 ? pal0 : k1 < 2.0 ? pal1 : k1 < 3.0 ? pal2 : k1 < 4.0 ? pal3 : pal4;
          vec3 a2 = k2 < 1.0 ? pal0 : k2 < 2.0 ? pal1 : k2 < 3.0 ? pal2 : k2 < 4.0 ? pal3 : pal4;
          c = ring < 0.18 ? a1 : (ring < 0.34 ? a2 : vec3(0.95, 0.92, 0.84));
          c = mix(c, vec3(0.25, 0.2, 0.18), smoothstep(0.44, 0.5, ring));
        }
        albedo = c * (0.7 + 0.35 * k + 0.1 * (fbm(uv * 40.0) - 0.5));`,
    },
    "knit",
  );
}

function rug() {
  const m = new MeshPhysicalMaterial({ roughness: 0.97, specularIntensity: 0.15, sheen: 0.3, sheenRoughness: 0.8, sheenColor: new Color("#a04030") });
  return patch(
    m,
    {
      uniforms: { field: { value: lin("#8c1f1a") }, navy: { value: lin("#1a2140") }, ivory: { value: lin("#ebd9b3") }, gold: { value: lin("#d99940") }, rw: { value: 3.4 }, rd: { value: 2.4 } },
      body: /* glsl */ `
        vec2 size = vec2(rw, rd);
        vec2 uv = opos.xz / size + 0.5;
        vec2 p = (uv - 0.5) * size;
        vec2 e = min(uv, 1.0 - uv) * size;
        float edge = min(e.x, e.y);
        vec3 c = field;
        vec2 g = fract(p / 0.16) - 0.5;
        float lat = 1.0 - smoothstep(0.08, 0.12, abs(abs(g.x) + abs(g.y) - 0.3));
        c = mix(c, field * 1.35, lat * 0.6);
        c = mix(c, gold, (1.0 - smoothstep(0.05, 0.09, length(g))) * 0.7);
        float md = abs(p.x) / 0.85 + abs(p.y) / 0.55;
        float med = 1.0 - smoothstep(0.98, 1.0, md);
        c = mix(c, navy, med);
        c = mix(c, ivory, (1.0 - smoothstep(0.0, 0.03, abs(md - 0.8))) * med);
        c = mix(c, gold, (1.0 - smoothstep(0.0, 0.025, abs(md - 0.55))) * med);
        float core = 1.0 - smoothstep(0.24, 0.26, md);
        c = mix(c, field * 1.2, core);
        float petal = 1.0 - smoothstep(0.02, 0.03, abs(length(p * vec2(1.0, 1.5)) - 0.12 - 0.03 * sin(atan(p.y, p.x) * 8.0)));
        c = mix(c, ivory, petal * core);
        vec2 cp = abs(p) - (size * 0.5 - vec2(0.55, 0.45));
        float corner = 1.0 - smoothstep(0.0, 0.02, max(-cp.x, -cp.y));
        c = mix(c, navy, corner * step(0.3, edge));
        float b1 = step(edge, 0.3);
        c = mix(c, navy, b1);
        float bp = sin((uv.x * size.x + uv.y * size.y) * 40.0) * sin(edge * 40.0);
        c = mix(c, gold, b1 * step(0.5, bp) * step(0.08, edge) * step(edge, 0.24));
        c = mix(c, ivory, 1.0 - smoothstep(0.0, 0.015, abs(edge - 0.06)));
        c = mix(c, ivory, 1.0 - smoothstep(0.0, 0.012, abs(edge - 0.28)));
        c = mix(c, field, 1.0 - smoothstep(0.0, 0.02, abs(edge - 0.32)));
        float pile = fbm(p * 60.0);
        float wear = fbm(p * 2.0 + 3.0);
        c *= 0.82 + 0.25 * pile;
        albedo = mix(c, c * 0.8 + vec3(0.06), smoothstep(0.55, 0.8, wear) * 0.5);`,
    },
    "rug",
  );
}

function lace() {
  return patch(
    new MeshPhysicalMaterial({ color: "#faf6ee", roughness: 0.9, side: DoubleSide }),
    {
      body: /* glsl */ `
        vec2 p = opos.xz;
        float r = length(p);
        float a = atan(p.y, p.x);
        float rings = abs(fract(r / 0.022) - 0.5);
        float spokes = abs(fract(a * 24.0 / 6.28318) - 0.5);
        cut = step(0.2, rings) * step(0.22, spokes);`,
    },
    "lace",
  );
}

function tile() {
  return patch(
    new MeshPhysicalMaterial({}),
    {
      uniforms: { tile_a: { value: lin("#ebe6d6") }, tile_b: { value: lin("#8cad99") } },
      body: /* glsl */ `
        vec2 uv = plane_uv(wpos, wnrm) / 0.25;
        vec2 f = fract(uv);
        float chk = mod(floor(uv.x) + floor(uv.y), 2.0);
        vec3 c = mix(tile_a, tile_b, chk);
        float grout = 1.0 - smoothstep(0.0, 0.025, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
        c = mix(c, c * 0.6, grout);
        albedo = c * (0.92 + 0.12 * fbm(uv * 3.0));
        rough = 0.35 + grout * 0.5;`,
    },
    "tile",
  );
}

function photo() {
  return patch(
    new MeshPhysicalMaterial({ roughness: 0.35 }),
    {
      body: /* glsl */ `
        vec3 sv = vOrigin;
        float seed = hash12(sv.xz * 13.0 + sv.y);
        vec2 p = opos.xy * 6.0;
        float bg = 0.55 + 0.25 * fbm(p * 1.5 + seed * 10.0);
        float fig = 0.0;
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          vec2 c = vec2(-0.35 + fi * 0.35 + (seed - 0.5) * 0.2, -0.05);
          float body = 1.0 - smoothstep(0.16, 0.2, length((p - c) * vec2(1.6, 0.8)));
          float head = 1.0 - smoothstep(0.08, 0.1, length(p - c - vec2(0.0, 0.32)));
          fig = max(fig, max(body, head) * step(fi, 1.0 + seed * 2.0));
        }
        float v = mix(bg, 0.25, fig);
        v *= 1.0 - smoothstep(0.4, 1.0, length(p) * 0.6);
        v += (hash12(floor(p * 120.0)) - 0.5) * 0.06;
        albedo = vec3(v * 1.08, v * 0.92, v * 0.72);`,
    },
    "photo",
  );
}

function crt() {
  return patch(
    new MeshPhysicalMaterial({ color: "#050505", roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
    {
      body: /* glsl */ `
        vec2 p = vec2(opos.x / 0.54, opos.y / 0.4) + 0.5;
        float t = uTime * 0.15;
        vec3 pic = vec3(0.5 + 0.5 * sin(p.x * 3.0 + t * 3.0), 0.45 + 0.4 * sin(p.y * 2.0 - t * 2.0 + 1.0), 0.55 + 0.4 * sin((p.x + p.y) * 2.5 + t * 4.0 + 2.0));
        pic = mix(pic, vec3(fbm(p * 3.0 + t)), 0.35);
        float scan = 0.82 + 0.18 * sin(p.y * 380.0);
        float stat = hash12(floor(p * vec2(200.0, 150.0)) + floor(uTime * 24.0)) * 0.12;
        vec2 q = p - 0.5;
        float vig = 1.0 - smoothstep(0.3, 0.6, length(q * vec2(1.0, 1.2)));
        emit = (pic * scan + stat) * vig * 0.75;`,
    },
    "crt",
  );
}

/** The view out of the window: a snowy dusk, the moon, and the neighbours' lit windows. Unlit. */
function sky() {
  return new ShaderMaterial({
    uniforms: { uTime: TIME },
    vertexShader: /* glsl */ `varying vec3 vOPos; void main() { vOPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec3 vOPos;
      ${NOISE}
      void main() {
        vec2 p = vOPos.xy;
        float h = clamp((p.y + 0.9) / 1.9, 0.0, 1.0);
        vec3 c = mix(vec3(0.95, 0.56, 0.42), vec3(0.25, 0.22, 0.42), smoothstep(0.0, 0.45, h));
        c = mix(c, vec3(0.05, 0.07, 0.2), smoothstep(0.4, 1.0, h));
        vec2 sc = floor(p * 60.0);
        float st = step(0.985, hash12(sc)) * smoothstep(0.35, 0.8, h);
        c += st * (0.5 + 0.5 * sin(uTime * 2.0 + hash12(sc) * 30.0)) * 0.8;
        vec2 m = p - vec2(-0.55, 0.35);
        float md = length(m);
        c += vec3(1.0, 0.95, 0.8) * (1.0 - smoothstep(0.085, 0.09, md));
        c += vec3(0.6, 0.6, 0.8) * exp(-md * 7.0) * 0.35;
        float cl = fbm(vec2(p.x * 1.2 + uTime * 0.01, p.y * 4.0));
        c = mix(c, vec3(0.45, 0.38, 0.55), smoothstep(0.55, 0.8, cl) * 0.5 * smoothstep(0.2, 0.6, h));
        float x = p.x * 3.0; float bx = floor(x); float hx = fract(x);
        float hh = 0.15 + 0.2 * hash12(vec2(bx, 1.0));
        float roof = hh + 0.12 * (1.0 - abs(hx - 0.5) * 2.0);
        float house = step(p.y + 0.62, roof) * step(0.08, hx) * step(hx, 0.92);
        vec3 hcol = vec3(0.08, 0.08, 0.15);
        vec2 wcell = vec2(fract(hx * 3.0), fract((p.y + 0.62) * 12.0));
        float win = step(0.3, wcell.x) * step(wcell.x, 0.7) * step(0.3, wcell.y) * step(wcell.y, 0.75);
        float lit = step(0.55, hash12(floor(vec2(x * 3.0, (p.y + 0.62) * 12.0))));
        hcol += vec3(1.0, 0.7, 0.35) * win * lit * step(p.y + 0.62, hh - 0.03) * 0.9;
        gl_FragColor = vec4(mix(c, hcol, house), 1.0);
        #include <colorspace_fragment>
      }`,
    fog: false,
  });
}

/**
 * A four-point glint over clues not looked at yet (always faces the camera; see Glints in House.tsx). Unlike
 * the Godot edition's additive glint it's drawn with a soft dark rim, so it still shows over the cream wallpaper.
 */
export function sparkleMaterial(phase: number) {
  return new ShaderMaterial({
    uniforms: { uTime: TIME, phase: { value: phase } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float phase; varying vec2 vUv;
      float starOf(vec2 p, float thin) { return max(0.0, 1.0 - abs(p.x) * thin - abs(p.y) * 1.3) + max(0.0, 1.0 - abs(p.y) * thin - abs(p.x) * 1.3); }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float pulse = 0.6 + 0.4 * sin(uTime * 2.4 + phase);
        float s = (0.85 + 0.15 * pulse);
        vec2 q = p / s;
        float star = clamp(starOf(q, 10.0) * 0.9 + exp(-dot(q, q) * 14.0), 0.0, 1.0);
        float rim = clamp(starOf(q * 0.82, 6.0) * 0.6 + exp(-dot(q, q) * 6.0) * 0.6, 0.0, 1.0);
        vec3 col = mix(vec3(0.35, 0.18, 0.02), vec3(1.0, 0.86, 0.42), star);
        float a = max(star, rim * 0.55) * (0.55 + 0.45 * pulse);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
}

/** Hover: a warm fresnel rim drawn over the object (one shared material). */
export const highlightMaterial = new ShaderMaterial({
  uniforms: { uTime: TIME },
  vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; varying vec3 vN; varying vec3 vV;
    void main() {
      float f = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), 2.5);
      float pulse = 0.75 + 0.25 * sin(uTime * 4.0);
      float a = f * 0.7 * pulse + 0.06;
      gl_FragColor = vec4(vec3(1.0, 0.8, 0.45) * a, a);
    }`,
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
  fog: false,
});

// ---------------------------------------------------------------- tuned standard materials

function std(color: string, roughness: number, extra: Partial<ConstructorParameters<typeof MeshPhysicalMaterial>[0]> = {}) {
  return new MeshPhysicalMaterial({ color, roughness, ...extra });
}

/** Material names that use object-space patterns: their meshes can't be merged into one world-space mesh. */
export const OBJECT_SPACE = new Set(["rug_persian", "lace", "sky_backdrop", "screen_crt", "photo_print", "knit_granny"]);

function build(key: string): Material | null {
  switch (key) {
    case "wood_floor":
      return wood({ light: "#9a6a42", dark: "#62391f", planks: true, grain: 60, varnish: 0.55, rough: 0.38, warp: 0.6 });
    case "wood_walnut":
    case "wood_door":
      return wood({ light: "#6e4428", dark: "#331b0e", varnish: 0.6 });
    case "wood_oak":
    case "wood_sled":
      return wood({ light: "#c49260", dark: "#8a5a32", varnish: 0.35 });
    case "wood_cherry":
      return wood({ light: "#8f3f24", dark: "#4a1a0e", varnish: 0.7 });
    case "wood_panel":
      return wood({ light: "#7d5232", dark: "#4a2c17", varnish: 0, rough: 0.7, grain: 30 });
    case "wallpaper":
      return wallpaper();
    case "fabric_rose":
      return fabric({ color: "#a2525a", sheen: 0.6 });
    case "fabric_green":
      return fabric({ color: "#5c7451", sheen: 0.7, weave: 400 });
    case "fabric_mustard":
      return fabric({ color: "#c9952f", sheen: 0.5 });
    case "fabric_curtain":
      return fabric({ color: "#d9b48a", sheen: 0.3, pattern: true });
    case "fabric_skirt":
      return fabric({ color: "#4c5675", sheen: 0.35, weave: 700 });
    case "fabric_blouse":
      return fabric({ color: "#f3eee4", sheen: 0.25, weave: 900 });
    case "slipper_pink":
      return fabric({ color: "#eba1ad", sheen: 0.9, weave: 1500 });
    case "knit_cream":
      return knit({ color: "#ece2c8" });
    case "knit_teal":
      return knit({ color: "#3a7a78" });
    case "knit_lilac":
      return knit({ color: "#9c84b4", stitch: 0.008 });
    case "knit_granny":
      return knit({ color: "#ffffff", granny: true, stitch: 0.006 });
    case "rug_persian":
      return rug();
    case "lace":
      return lace();
    case "sky_backdrop":
      return sky();
    case "screen_crt":
      return crt();
    case "photo_print":
      return photo();
    case "tile_check":
      return tile();
    case "plaster":
      return std("#efe6d4", 0.95);
    case "paint_cream":
      return std("#efe7d6", 0.35, { clearcoat: 0.3 });
    case "brass":
      return std("#d6a957", 0.28, { metalness: 1 });
    case "brass_dark":
      return std("#a87b3c", 0.28, { metalness: 1 });
    case "gold":
      return std("#f0c060", 0.22, { metalness: 1 });
    case "chrome":
      return std("#dcdde2", 0.1, { metalness: 1 });
    case "glass":
      return std("#e6f2ff", 0.18, { transparent: true, opacity: 0.12, side: DoubleSide, depthWrite: false, specularIntensity: 0.7 });
    case "ceramic_white":
    case "teeth":
    case "pearl":
    case "button_pearl":
    case "bowling_pin":
      return std("#f4f1ea", 0.12, { clearcoat: 0.8 });
    case "ceramic_blue":
      return std("#3d64a8", 0.12, { clearcoat: 1 });
    case "ceramic_rose":
      return std("#d47a86", 0.15);
    case "enamel_mint":
      return std("#b5dccc", 0.22, { clearcoat: 1 });
    case "paint_red":
      return std("#b02a22", 0.3, { clearcoat: 1 });
    case "plastic_black":
      return std("#151515", 0.35);
    case "plastic_black_gloss":
      return std("#0e0e10", 0.08, { clearcoat: 1 });
    case "metal_brushed":
      return std("#c9ccd1", 0.35, { metalness: 1 });
    case "marble_white":
      return std("#eeebe4", 0.22, { clearcoat: 0.7 });
    case "lampshade":
      return std("#f6dcaa", 0.8, { side: DoubleSide, emissive: "#ffcf86", emissiveIntensity: 0.9, transmission: 0 });
    case "glass_frosted":
      return std("#f7f1e6", 0.6, { emissive: "#ffe2b8", emissiveIntensity: 0.6 });
    case "bulb":
      return new MeshBasicMaterial({ color: new Color("#ffd9a0").multiplyScalar(3) });
    case "led_green":
      return new MeshBasicMaterial({ color: new Color("#2bff6a").multiplyScalar(2.5) });
    case "skin":
      return std("#eebda4", 0.55, { sheen: 0.4, sheenColor: "#ffd0c0", sheenRoughness: 0.6 });
    case "skin_blush":
      return std("#ec9c90", 0.6, { sheen: 0.3, sheenColor: "#ffc0b0" });
    case "stocking":
      return std("#cfa48e", 0.55, { sheen: 0.5, sheenColor: "#f0d0c0" });
    case "hair_silver":
    case "brow":
      return std("#e3e3e8", 0.42, { sheen: 0.6, sheenColor: "#ffffff", sheenRoughness: 0.4 });
    case "eye_white":
      return std("#f7f5f0", 0.12, { clearcoat: 1 });
    case "iris":
      return std("#4f6f8c", 0.05, { clearcoat: 1 });
    case "pupil":
      return std("#050505", 0.02);
    case "lip":
      return std("#b65962", 0.4);
    case "mouth_inside":
      return std("#4a1418", 0.7);
    case "tea":
      return std("#5a2c0e", 0.03, { clearcoat: 1 });
    case "paper":
    case "clock_face":
      return std("#f4ecd6", 0.85);
    case "paper_note":
      return std("#f8e15a", 0.85);
    case "snow":
      return std("#e6ecf8", 0.7, { emissive: "#4a5a88", emissiveIntensity: 0.4 });
    case "leaves":
      return std("#3e6f34", 0.5, { sheen: 0.3, sheenColor: "#6a9040" });
    case "satin_blue":
      return std("#2347b0", 0.3, { sheen: 0.6, sheenColor: "#8ab0ff" });
  }
  return null;
}

const cache = new Map<string, Material | null>();

/**
 * The material for a Blender material name ("wood_walnut.001" counts as "wood_walnut"), or null to keep the one
 * that came in the model (names the library doesn't know, like the books' colours).
 */
export function materialFor(name: string): Material | null {
  const key = name.split(".")[0]!;
  if (!cache.has(key)) cache.set(key, build(key));
  return cache.get(key)!;
}
