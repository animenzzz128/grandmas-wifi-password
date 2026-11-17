/**
 * Grandma's photos, generated in the game: each one is a small 3D set (people from her base body, dogs,
 * a church, a porch) rendered once off screen, then "developed" into an old print (develop.ts). Cards with
 * writing (the back of the wedding photo, a birth announcement, album pages) are drawn on 2D canvases.
 *
 * What each photo shows follows the object's inspect text in data/scenes (the floor rule "text matches the
 * world"): e.g. the porch mailbox shows only "41", the last digit hidden by the rosebush.
 *
 * Results are cached as plain canvases, so any WebGL context (the room, the examine view) can make a texture.
 */
import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  WebGLRenderTarget,
} from "three";
import type { BufferGeometry, Object3D, WebGLRenderer } from "three";
import { BODY_URL, HAIR_URL } from "./body.ts";
import { develop, flipRows } from "./develop.ts";
import type { PhotoStyle } from "./develop.ts";
import { buildDog, buildPerson } from "./people.ts";

export type PhotoId = "wedding" | "beagle" | "cocker" | "cherry" | "porch";

interface PhotoSet {
  scene: Scene;
  camera: PerspectiveCamera;
}

/** Print size in pixels (rendered at twice this and scaled down, for smooth edges). */
const PRINT: Record<PhotoId, [number, number]> = {
  wedding: [300, 400],
  beagle: [400, 300],
  cocker: [400, 300],
  cherry: [400, 300],
  porch: [400, 300],
};
const STYLE: Record<PhotoId, PhotoStyle> = { wedding: "bw", beagle: "faded", cocker: "faded", cherry: "faded", porch: "faded" };

const mat = (color: string, rough = 0.9) => new MeshStandardMaterial({ color, roughness: rough, flatShading: true });

function box(w: number, h: number, d: number, color: string | MeshStandardMaterial, x = 0, y = 0, z = 0) {
  const m = new Mesh(new BoxGeometry(w, h, d), typeof color === "string" ? mat(color) : color);
  m.position.set(x, y, z);
  return m;
}

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  return c;
}

function texture(c: HTMLCanvasElement, repeat?: [number, number]) {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.magFilter = NearestFilter;
  if (repeat) {
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

function setOf(sky: string, fov = 35): PhotoSet {
  const scene = new Scene();
  scene.background = new Color(sky);
  scene.add(new HemisphereLight("#eef2f6", "#5a4a3a", 1.3));
  const sun = new DirectionalLight("#fff4e0", 2.2);
  sun.position.set(-2, 4, 3);
  scene.add(sun);
  const camera = new PerspectiveCamera(fov, 4 / 3, 0.05, 50);
  return { scene, camera };
}

/** A soft dark blob under feet, so people don't float (no shadow maps needed). */
function blob(r: number, x = 0, y = 0.003, z = 0) {
  const m = new Mesh(new CircleGeometry(r, 16), new MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.3 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}

const bricks = () =>
  texture(
    canvas(64, 32, (g) => {
      g.fillStyle = "#cfc4b4";
      g.fillRect(0, 0, 64, 32);
      for (let row = 0; row < 4; row++)
        for (let i = -1; i < 4; i++) {
          const x = i * 16 + (row % 2) * 8;
          g.fillStyle = ["#8e4a36", "#9a5440", "#82432f"][(row + i + 3) % 3]!;
          g.fillRect(x + 1, row * 8 + 1, 14, 6);
        }
    }),
    [6, 6],
  );

const siding = (color: string) =>
  texture(
    canvas(16, 16, (g) => {
      g.fillStyle = color;
      g.fillRect(0, 0, 16, 16);
      g.fillStyle = "rgba(0,0,0,0.18)";
      for (let y = 3; y < 16; y += 4) g.fillRect(0, y, 16, 1);
    }),
    [6, 10],
  );

/** A bush of leaves with a few roses in it. */
function rosebush(r: number) {
  const g = new Group();
  const leaf = mat("#3f5a2e");
  const rose = mat("#b8333a", 0.7);
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4;
    const m = new Mesh(new IcosahedronGeometry(r * (0.45 + (i % 3) * 0.08), 0), leaf);
    m.position.set(Math.cos(a) * r * 0.55, r * (0.5 + ((i * 7) % 5) * 0.12), Math.sin(a) * r * 0.4);
    g.add(m);
  }
  for (let i = 0; i < 6; i++) {
    const a = i * 1.7 + 0.4;
    const m = new Mesh(new IcosahedronGeometry(r * 0.13, 0), rose);
    m.position.set(Math.cos(a) * r * 0.7, r * (0.75 + (i % 3) * 0.2), Math.sin(a) * r * 0.5 + r * 0.25);
    g.add(m);
  }
  return g;
}

type Models = { body: Object3D; hair: Object3D };

const SETS: Record<PhotoId, (m: Models) => PhotoSet> = {
  // Black-and-white, 1961: Rosie and Walt on the church steps. Walt is squinting into the sun.
  wedding({ body, hair }) {
    const s = setOf("#c9cdd2", 30);
    s.camera.aspect = 3 / 4;
    const stone = mat("#b9b3a8");
    s.scene.add(box(8, 0.02, 6, "#8f8a80", 0, -0.01, 0));
    for (let i = 0; i < 3; i++) s.scene.add(box(4.2, 0.16, 0.42, stone, 0, 0.08 + i * 0.16, -0.2 - i * 0.42));
    s.scene.add(box(4.6, 3.6, 0.3, "#a9a296", 0, 1.8, -1.6));
    // Arched church door with columns.
    s.scene.add(box(1.2, 2.0, 0.1, "#3a2c22", 0, 1.48, -1.42));
    const arch = new Mesh(new CylinderGeometry(0.6, 0.6, 0.1, 16, 1, false, 0, Math.PI), mat("#3a2c22"));
    arch.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    arch.position.set(0, 2.48, -1.42);
    s.scene.add(arch);
    for (const x of [-0.85, 0.85]) s.scene.add(box(0.22, 2.6, 0.22, "#c4beb2", x, 1.78, -1.38));
    const top = 0.48;
    const rosie = buildPerson(body, hair, {
      outfit: { top: "#f4f1ea", bottom: "#f4f1ea", legs: "#f4f1ea", shoes: "#f4f1ea" },
      hair: "#3d2a1e",
      height: 1.62,
      hold: true,
      bouquet: true,
      veil: true,
      gown: "#f4f1ea",
    });
    rosie.position.set(-0.3, top, -0.75);
    rosie.rotation.y = 0.22;
    const walt = buildPerson(body, hair, {
      outfit: { top: "#25252b", bottom: "#25252b", legs: "#25252b", shoes: "#111111" },
      hair: "#241a14",
      height: 1.8,
      man: true,
      jacket: "#25252b",
    });
    walt.position.set(0.32, top, -0.8);
    walt.rotation.y = -0.18;
    s.scene.add(rosie, walt, blob(0.3, -0.3, top + 0.003, -0.75), blob(0.32, 0.32, top + 0.003, -0.8));
    s.camera.position.set(0, 1.75, 2.6);
    s.camera.lookAt(0, 1.62, -0.75);
    return s;
  },

  // A beagle with one floppy ear, chewing a sock, on the living-room rug.
  beagle() {
    const s = setOf("#d8cbb0", 40);
    s.scene.add(box(6, 0.02, 6, "#7a5a3c", 0, -0.01, 0));
    s.scene.add(box(2.4, 0.02, 1.6, "#8c3b3b", 0, 0.005, 0.1));
    s.scene.add(box(6, 2.4, 0.1, "#d9c9a3", 0, 1.2, -0.9));
    s.scene.add(box(6, 0.1, 0.03, "#6b4a2f", 0, 0.05, -0.84));
    const dog = buildDog({ coat: "#b8773a", saddle: "#1c1714", white: "#f1ece2", ears: "#9c5f2a", flippedEar: true, sock: true, height: 0.36 });
    dog.rotation.y = 0.75;
    s.scene.add(dog, blob(0.28, 0, 0.012, 0));
    s.camera.position.set(0.15, 0.55, 1.35);
    s.camera.lookAt(0, 0.25, 0);
    return s;
  },

  // A cocker spaniel sitting on a porch step.
  cocker() {
    const s = setOf("#c8d6de", 38);
    s.scene.add(box(8, 0.02, 8, "#6f7f4a", 0, -0.01, 0));
    const wood = mat("#9b8a72");
    for (let i = 0; i < 3; i++) s.scene.add(box(1.8, 0.18, 0.34, wood, 0, 0.09 + i * 0.18, -i * 0.34));
    s.scene.add(box(3, 0.54, 1.5, wood, 0, 0.27, -1.3));
    const wall = new Mesh(new PlaneGeometry(4, 2.6), new MeshStandardMaterial({ map: siding("#e8e1cf"), roughness: 1 }));
    wall.position.set(0, 1.84, -1.9);
    s.scene.add(wall);
    s.scene.add(box(0.14, 2.2, 0.14, "#f1ede4", 0.95, 1.64, -0.75));
    const dog = buildDog({ coat: "#c38d45", ears: "#a9733a", longEars: true, sitting: true, height: 0.34 });
    dog.position.set(-0.05, 0.36, -0.36);
    dog.rotation.y = 0.35;
    s.scene.add(dog);
    s.camera.position.set(0.2, 0.75, 1.5);
    s.camera.lookAt(0, 0.55, -0.35);
    return s;
  },

  // The window of the first apartment on Cherry Street (the caption is on the album page).
  cherry() {
    const s = setOf("#cfd9df", 38);
    const wall = new Mesh(new PlaneGeometry(6, 6), new MeshStandardMaterial({ map: bricks(), roughness: 1 }));
    wall.position.set(0, 1.5, -0.2);
    s.scene.add(wall);
    s.scene.add(box(1.3, 1.6, 0.1, "#efece4", 0, 1.6, -0.15)); // frame
    s.scene.add(box(1.1, 1.4, 0.1, "#3c4a55", 0, 1.6, -0.12)); // glass
    s.scene.add(box(0.06, 1.4, 0.12, "#efece4", 0, 1.6, -0.1)); // mullion
    s.scene.add(box(1.1, 0.06, 0.12, "#efece4", 0, 1.6, -0.1));
    for (const x of [-0.38, 0.38]) s.scene.add(box(0.32, 1.3, 0.02, "#e9d9b8", x, 1.62, -0.06)); // curtains
    s.scene.add(box(1.4, 0.08, 0.3, "#d8d2c4", 0, 0.78, 0)); // sill
    s.scene.add(box(1.2, 0.22, 0.24, "#7a5236", 0, 0.66, 0.06)); // flower box
    for (let i = 0; i < 7; i++) {
      const f = new Mesh(new IcosahedronGeometry(0.07, 0), mat(i % 2 ? "#c94a52" : "#e8b63c"));
      f.position.set(-0.5 + i * 0.165, 0.83, 0.07);
      s.scene.add(f);
    }
    s.camera.position.set(0.25, 1.35, 2.6);
    s.camera.lookAt(0, 1.4, 0);
    return s;
  },

  // The house on Maple Avenue, summer 1969: porch, steps and the mailbox. The rosebush hides the last digit.
  porch() {
    const s = setOf("#bcd0dc", 40);
    s.scene.add(box(12, 0.02, 10, "#5f7a3e", 0, -0.01, 0));
    const wall = new Mesh(new PlaneGeometry(7, 3.4), new MeshStandardMaterial({ map: siding("#f0ead8"), roughness: 1 }));
    wall.position.set(0, 1.7, -2.4);
    s.scene.add(wall);
    s.scene.add(box(4, 0.5, 1.6, "#a39580", 0, 0.25, -1.6)); // porch deck
    for (let i = 0; i < 2; i++) s.scene.add(box(1.2, 0.25, 0.3, "#9a8c76", 0.6, 0.125 + i * 0.25, -0.65 - i * 0.3)); // steps
    for (const x of [-1.8, 0, 1.8]) s.scene.add(box(0.14, 2.2, 0.14, "#f6f3ec", x, 1.6, -0.9)); // posts
    s.scene.add(box(4, 0.2, 1.7, "#5a4a3e", 0, 2.75, -1.6)); // porch roof
    s.scene.add(box(0.9, 1.9, 0.06, "#5b3a2a", 0.6, 1.45, -2.36)); // front door
    s.scene.add(box(0.7, 0.8, 0.06, "#3c4a55", -1.2, 1.6, -2.36)); // window
    // Mailbox on its post, side toward the camera, with "41" painted on.
    const post = box(0.08, 1.0, 0.08, "#6b4a2f", -1.0, 0.5, 0.35);
    const mailbox = new Group();
    mailbox.position.set(-1.0, 1.08, 0.35);
    mailbox.add(box(0.5, 0.2, 0.22, "#2f3b46", 0, 0, 0));
    const curve = new Mesh(new CylinderGeometry(0.11, 0.11, 0.5, 12, 1, false, 0, Math.PI), mat("#2f3b46"));
    curve.rotation.set(0, 0, Math.PI / 2);
    curve.position.y = 0.1;
    mailbox.add(curve);
    const label = canvas(128, 48, (g) => {
      g.fillStyle = "#f2efe6";
      g.fillRect(0, 0, 128, 48);
      g.fillStyle = "#1c1c1c";
      g.font = "bold 40px Georgia, serif";
      g.textBaseline = "middle";
      g.fillText("41", 10, 26); // only the first two digits are ever painted where the camera can see
    });
    const plate = new Mesh(new PlaneGeometry(0.42, 0.16), new MeshBasicMaterial({ map: texture(label) }));
    plate.position.set(0.02, 0.02, 0.112);
    mailbox.add(plate);
    mailbox.rotation.y = 0.05;
    // A rosebush beside the post; one cane has climbed up in front of the plate's right end, right where a
    // third digit would be.
    const bush = rosebush(0.45);
    bush.position.set(-0.45, 0, 0.6);
    const cane = new Group();
    const leaf = mat("#3f5a2e");
    const rose = mat("#b8333a", 0.7);
    for (const [x, y, z, r, m] of [
      [0, 0, 0, 0.075, leaf],
      [0.05, -0.07, 0.01, 0.07, leaf],
      [-0.02, 0.07, 0.02, 0.06, leaf],
      [0.07, 0.05, -0.01, 0.065, leaf],
      [0.0, -0.15, 0.0, 0.07, leaf],
      [0.03, -0.3, 0.02, 0.07, leaf],
      [0.02, 0.02, 0.07, 0.035, rose],
      [0.06, -0.12, 0.06, 0.03, rose],
    ] as const) {
      const p = new Mesh(new IcosahedronGeometry(r, 0), m);
      p.position.set(x, y, z);
      cane.add(p);
    }
    cane.position.set(-0.83, 1.08, 0.52);
    s.scene.add(post, mailbox, bush, cane, blob(0.45, -0.45, 0.005, 0.6));
    s.camera.position.set(-0.6, 1.25, 2.3);
    s.camera.lookAt(-0.85, 1.0, 0);
    return s;
  },
};

const cache = new Map<string, HTMLCanvasElement>();
// Dev only: look at the generated photos from the console.
if (import.meta.env.DEV && typeof window !== "undefined") Object.assign(window, { __photoCache: cache });

/** Geometry that belongs to the shared, cached model files (never dispose it). */
function sharedGeometry(...roots: Object3D[]) {
  const set = new Set<BufferGeometry>();
  for (const r of roots) r.traverse((o) => o instanceof Mesh && set.add(o.geometry));
  return set;
}

function renderPhoto(gl: WebGLRenderer, id: PhotoId, models: Models): HTMLCanvasElement {
  const [w, h] = PRINT[id];
  const W = w * 2;
  const H = h * 2;
  const set = SETS[id](models);
  set.camera.aspect = W / H;
  set.camera.updateProjectionMatrix();
  const rt = new WebGLRenderTarget(W, H);
  const before = gl.getRenderTarget();
  gl.setRenderTarget(rt);
  gl.clear();
  gl.render(set.scene, set.camera);
  const raw = new Uint8Array(W * H * 4);
  gl.readRenderTargetPixels(rt, 0, 0, W, H, raw);
  gl.setRenderTarget(before);
  rt.dispose();
  const keep = sharedGeometry(models.body, models.hair);
  set.scene.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    if (!keep.has(o.geometry)) o.geometry.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      (m as MeshStandardMaterial).map?.dispose();
      m.dispose();
    }
  });

  const pixels = flipRows(raw, W, H);
  develop(pixels, W, H, STYLE[id], id.length * 977);
  const big = canvas(W, H, (g) => g.putImageData(new ImageData(pixels as unknown as Uint8ClampedArray<ArrayBuffer>, W, H), 0, 0));
  return canvas(w, h, (g) => {
    g.imageSmoothingQuality = "high";
    g.drawImage(big, 0, 0, w, h);
  });
}

/** A photo as a canvas, rendered the first time it's asked for. */
export function photoCanvas(gl: WebGLRenderer, id: PhotoId, models: Models): HTMLCanvasElement {
  let c = cache.get(id);
  if (!c) {
    c = renderPhoto(gl, id, models);
    cache.set(id, c);
  }
  return c;
}

/** Inside a <Canvas>: a texture of one of Grandma's photos (suspends while her body model loads). */
export function usePhoto(id: PhotoId): CanvasTexture {
  const gl = useThree((s) => s.gl);
  const body = useGLTF(BODY_URL);
  const hair = useGLTF(HAIR_URL);
  if (import.meta.env.DEV) {
    // Dev only: __photo("porch") renders a photo again (after editing its set) and returns the canvas.
    Object.assign(window, {
      __photo: (pid: PhotoId) => {
        cache.delete(pid);
        return photoCanvas(gl, pid, { body: body.scene, hair: hair.scene });
      },
    });
  }
  return useMemo(() => texture(photoCanvas(gl, id, { body: body.scene, hair: hair.scene })), [gl, id, body, hair]);
}

// ---- Drawn cards ---------------------------------------------------------------------------------------------

const HAND = "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive";

/** Lines of handwriting, wrapped to `width`. */
function writeLines(g: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > width && line) {
      g.fillText(line, x, y);
      y += lineHeight;
      line = w;
    } else line = next;
  }
  if (line) g.fillText(line, x, y);
}

function paper(g: CanvasRenderingContext2D, w: number, h: number, color: string, speckle: string, seed = 3) {
  g.fillStyle = color;
  g.fillRect(0, 0, w, h);
  let s = seed;
  g.fillStyle = speckle;
  for (let i = 0; i < (w * h) / 60; i++) {
    s = (s * 16807) % 2147483647;
    const x = s % w;
    s = (s * 16807) % 2147483647;
    g.fillRect(x, s % h, 1, 1);
  }
}

export type CardId = "wedding_back" | "announcement";

const CARDS: Record<CardId, () => HTMLCanvasElement> = {
  wedding_back: () =>
    canvas(300, 400, (g) => {
      paper(g, 300, 400, "#c8ad84", "rgba(80,50,20,0.25)");
      g.strokeStyle = "rgba(80,50,20,0.35)";
      g.strokeRect(10, 10, 280, 380);
      g.fillStyle = "#2a2440";
      g.font = `26px ${HAND}`;
      g.save();
      g.translate(26, 70);
      g.rotate(-0.05);
      writeLines(g, "To my little songbird.", 0, 0, 250, 36);
      writeLines(g, "Married the June after the pierogi.", 0, 82, 250, 36);
      g.font = `22px ${HAND}`;
      g.fillText("— W.", 175, 180);
      g.restore();
    }),
  announcement: () =>
    canvas(300, 400, (g) => {
      paper(g, 300, 400, "#f6f1e4", "rgba(0,0,0,0.06)", 9);
      g.strokeStyle = "#5a86b8";
      g.lineWidth = 8;
      g.strokeRect(14, 14, 272, 372);
      g.lineWidth = 2;
      g.strokeRect(26, 26, 248, 348);
      g.fillStyle = "#3d6aa0";
      g.textAlign = "center";
      g.font = "bold 34px Georgia, serif";
      g.fillText("It's a Boy!", 150, 92);
      g.font = "italic 20px Georgia, serif";
      g.fillStyle = "#4a4a4a";
      g.fillText("We are happy to announce", 150, 150);
      g.fillText("the arrival of", 150, 176);
      g.font = `40px ${HAND}`;
      g.fillStyle = "#2a3f66";
      g.fillText("Michael", 150, 240);
      g.font = "20px Georgia, serif";
      g.fillStyle = "#4a4a4a";
      g.fillText("1966", 150, 290);
      // a stork, very roughly
      g.strokeStyle = "#9ab4d4";
      g.beginPath();
      g.arc(150, 335, 16, Math.PI, 0);
      g.stroke();
    }),
};

export function cardCanvas(id: CardId): HTMLCanvasElement {
  let c = cache.get(id);
  if (!c) {
    c = CARDS[id]();
    cache.set(id, c);
  }
  return c;
}

export function useCard(id: CardId): CanvasTexture {
  return useMemo(() => texture(cardCanvas(id)), [id]);
}

// ---- The photo album ---------------------------------------------------------------------------------------------

/** What's on each page of the album, left page then right page, in order. */
export const ALBUM: { photo?: PhotoId; card?: CardId; caption?: string; empty?: boolean }[][] = [
  [{ photo: "beagle" }, { photo: "cocker" }], // nobody wrote the names underneath
  [
    { photo: "cherry", caption: "Cherry St., our first home — moved out summer '64" },
    { photo: "porch", caption: "Summer '69" },
  ],
  [{ empty: true }, { card: "announcement" }], // tucked in the back
];

/** One album page (cream paper, black photo corners, a caption in Grandma's hand). */
export function albumPageCanvas(gl: WebGLRenderer, models: Models, spread: number, side: 0 | 1): HTMLCanvasElement {
  const key = `album:${spread}:${side}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const item = ALBUM[spread]![side]!;
  const W = 400;
  const H = 520;
  const c = canvas(W, H, (g) => {
    paper(g, W, H, "#efe6d0", "rgba(90,70,40,0.12)", 5 + spread * 2 + side);
    const pic = item.photo ? photoCanvas(gl, item.photo, models) : item.card ? cardCanvas(item.card) : null;
    const pw = item.card ? 230 : 320;
    const ph = pic ? (pic.height / pic.width) * pw : 240;
    const x = (W - pw) / 2;
    const y = item.card ? 70 : 90;
    g.save();
    if (item.card) {
      g.translate(W / 2, y + ph / 2);
      g.rotate(0.06);
      g.translate(-W / 2, -(y + ph / 2));
    }
    if (pic) {
      g.fillStyle = "#fbf8f0";
      g.fillRect(x - 10, y - 10, pw + 20, ph + 20); // white print border
      g.drawImage(pic, x, y, pw, ph);
    } else {
      g.fillStyle = "rgba(0,0,0,0.06)";
      g.fillRect(x, y, pw, ph); // a lighter patch where a photo used to be
    }
    if (!item.card) {
      g.fillStyle = "#1b1712";
      const corner = (cx: number, cy: number, dx: number, dy: number) => {
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + 34 * dx, cy);
        g.lineTo(cx, cy + 34 * dy);
        g.fill();
      };
      corner(x - 14, y - 14, 1, 1);
      corner(x + pw + 14, y - 14, -1, 1);
      corner(x - 14, y + ph + 14, 1, -1);
      corner(x + pw + 14, y + ph + 14, -1, -1);
    }
    g.restore();
    if (item.caption) {
      g.fillStyle = "#2a2440";
      g.font = `22px ${HAND}`;
      g.textAlign = "center";
      writeLines(g, item.caption, W / 2, y + ph + 60, W - 60, 30);
    }
  });
  cache.set(key, c);
  return c;
}

export function useAlbumPage(spread: number, side: 0 | 1): CanvasTexture {
  const gl = useThree((s) => s.gl);
  const body = useGLTF(BODY_URL);
  const hair = useGLTF(HAIR_URL);
  return useMemo(() => texture(albumPageCanvas(gl, { body: body.scene, hair: hair.scene }, spread, side)), [gl, body, hair, spread, side]);
}
