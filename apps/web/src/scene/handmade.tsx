/**
 * Small props modelled in code, for things no CC0 pack had (bowling trophy, sled, router...).
 * Each one fills a box of `size` centered on the origin, standing on its bottom, front toward +z.
 * They're ours, so no license to track. To move them to Blender/Godot later, export with GLTFExporter.
 */
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, DoubleSide, LatheGeometry, NearestFilter, Vector2 } from "three";
import type { Group, Points } from "three";
import type { HandmadeName, Vec3 } from "./models.ts";
import { useHighlight } from "./Model.tsx";
import { Fridge, WeddingFrame } from "./props.tsx";

const GOLD = "#d4af37";
const WOOD = "#8a5a35";
const DARK_WOOD = "#4a3020";

function Mat({ color, rough = 0.8, metal = 0, emissive }: { color: string; rough?: number; metal?: number; emissive?: string }) {
  return <meshStandardMaterial color={color} roughness={rough} metalness={metal} emissive={emissive ?? "#000000"} flatShading />;
}

function lathe(points: [number, number][], segments = 10) {
  return new LatheGeometry(points.map(([x, y]) => new Vector2(x, y)), segments);
}

/** A texture with a few words on it, drawn once (house number, plaque text). */
function useLabel(text: string, bg: string, fg: string, w = 128, h = 64) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d")!;
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = `bold ${Math.floor(h * 0.7)}px Georgia, serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.translate(w / 2, h / 2);
    g.rotate(-0.06); // "painted a little crooked"
    g.fillText(text, 0, 2);
    const t = new CanvasTexture(c);
    t.magFilter = NearestFilter;
    return t;
  }, [text, bg, fg, w, h]);
}

function Trophy({ size: [w, h] }: { size: Vec3 }) {
  const pin = useMemo(() => lathe([[0, 0], [0.22, 0.05], [0.32, 0.3], [0.18, 0.55], [0.14, 0.62], [0.2, 0.78], [0.12, 0.95], [0, 1]], 10), []);
  return (
    <group position={[0, -h / 2, 0]}>
      <mesh position={[0, h * 0.08, 0]}>
        <boxGeometry args={[w * 1.2, h * 0.16, w * 1.2]} />
        <Mat color={DARK_WOOD} />
      </mesh>
      <mesh position={[0, h * 0.16 + 0.002, w * 0.6 + 0.001]}>
        <planeGeometry args={[w * 0.8, h * 0.08]} />
        <Mat color="#e8d18a" metal={0.6} rough={0.4} />
      </mesh>
      <mesh position={[0, h * 0.28, 0]}>
        <cylinderGeometry args={[w * 0.14, w * 0.2, h * 0.24, 8]} />
        <Mat color={GOLD} metal={0.7} rough={0.35} />
      </mesh>
      <mesh position={[0, h * 0.4, 0]} scale={[w, h * 0.6, w]}>
        <primitive object={pin} attach="geometry" />
        <Mat color={GOLD} metal={0.7} rough={0.35} />
      </mesh>
    </group>
  );
}

function Ribbon({ size: [w, h] }: { size: Vec3 }) {
  const r = w / 2;
  return (
    <group position={[0, h / 2 - r, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r, r, 0.01, 14]} />
        <Mat color="#2f5fb3" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.008]}>
        <cylinderGeometry args={[r * 0.7, r * 0.7, 0.01, 14]} />
        <Mat color="#3d72c9" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.014]}>
        <cylinderGeometry args={[r * 0.38, r * 0.38, 0.01, 12]} />
        <Mat color={GOLD} metal={0.5} rough={0.4} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * r * 0.35, -r - (h - 2 * r) / 2 + 0.01, -0.002]} rotation={[0, 0, s * 0.18]}>
          <boxGeometry args={[r * 0.55, h - 2 * r + 0.04, 0.006]} />
          <Mat color="#2a55a0" />
        </mesh>
      ))}
    </group>
  );
}

function Sled({ size: [w, h, d] }: { size: Vec3 }) {
  const slats = 4;
  return (
    <group position={[0, -h / 2, 0]}>
      {/* red metal runners, curled up at the front (+x) */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0, 0, s * d * 0.42]}>
          <mesh position={[-0.04, 0.012, 0]}>
            <boxGeometry args={[w * 0.9, 0.024, 0.03]} />
            <Mat color="#b0302a" rough={0.5} metal={0.3} />
          </mesh>
          <mesh position={[w * 0.43, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.05, 0.012, 4, 8, Math.PI]} />
            <Mat color="#b0302a" rough={0.5} metal={0.3} />
          </mesh>
          {[-0.3, 0, 0.3].map((x) => (
            <mesh key={x} position={[x * w, h * 0.45, 0]}>
              <boxGeometry args={[0.03, h * 0.7, 0.02]} />
              <Mat color="#8f2a24" />
            </mesh>
          ))}
        </group>
      ))}
      {/* wooden slats; the front one is the steering bar */}
      {Array.from({ length: slats }, (_, i) => (
        <mesh key={i} position={[-0.06, h * 0.86, (i - (slats - 1) / 2) * (d / slats)]}>
          <boxGeometry args={[w * 0.78, 0.025, d / slats - 0.02]} />
          <Mat color={i === 1 ? "#a87a4a" : "#b5875a"} />
        </mesh>
      ))}
      <mesh position={[w * 0.36, h * 0.9, 0]}>
        <boxGeometry args={[0.06, 0.03, d * 1.05]} />
        <Mat color={WOOD} />
      </mesh>
    </group>
  );
}

function FishingRod({ size: [, h] }: { size: Vec3 }) {
  return (
    <group rotation={[0.06, 0, -0.08]}>
      <mesh>
        <cylinderGeometry args={[0.004, 0.012, h, 5]} />
        <Mat color="#2f4a2f" rough={0.4} />
      </mesh>
      <mesh position={[0, -h / 2 + 0.22, 0]}>
        <cylinderGeometry args={[0.018, 0.016, 0.3, 6]} />
        <Mat color="#b88a5a" />
      </mesh>
      <group position={[0.03, -h / 2 + 0.42, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, 0.03, 10]} />
          <Mat color="#888888" metal={0.7} rough={0.3} />
        </mesh>
      </group>
      {/* dented green tackle box at the foot of the rod */}
      <mesh position={[-0.12, -h / 2 + 0.07, 0.05]} rotation={[0, 0.4, 0.08]}>
        <boxGeometry args={[0.3, 0.14, 0.16]} />
        <Mat color="#4c6b4c" metal={0.3} rough={0.6} />
      </mesh>
      <mesh position={[-0.12, -h / 2 + 0.15, 0.05]} rotation={[0, 0.4, 0.08]}>
        <boxGeometry args={[0.12, 0.02, 0.03]} />
        <Mat color="#333333" />
      </mesh>
    </group>
  );
}

function CookieJar({ size: [w, h] }: { size: Vec3 }) {
  const r = w / 2;
  const body = useMemo(() => lathe([[0, 0], [r * 0.75, 0], [r * 0.95, h * 0.15], [r, h * 0.45], [r * 0.9, h * 0.72], [r * 0.7, h * 0.78], [0, h * 0.78]], 12), [r, h]);
  return (
    <group position={[0, -h / 2, 0]}>
      <mesh geometry={body}>
        <Mat color="#d98c5f" rough={0.35} />
      </mesh>
      <mesh position={[0, h * 0.45, 0]}>
        <cylinderGeometry args={[r * 1.01, r * 1.01, h * 0.1, 12]} />
        <Mat color="#f2e3c6" rough={0.35} />
      </mesh>
      <mesh position={[0, h * 0.82, 0]}>
        <cylinderGeometry args={[r * 0.78, r * 0.72, h * 0.08, 12]} />
        <Mat color="#c97a4f" rough={0.35} />
      </mesh>
      <mesh position={[0, h * 0.93, 0]}>
        <sphereGeometry args={[r * 0.2, 8, 6]} />
        <Mat color="#f2e3c6" rough={0.35} />
      </mesh>
    </group>
  );
}

function Router({ size: [w, h, d] }: { size: Vec3 }) {
  return (
    <group position={[0, -h / 2, 0]}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <Mat color="#1e1e1e" rough={0.4} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * w * 0.4, h + 0.09, -d * 0.4]} rotation={[0, 0, s * -0.2]}>
          <cylinderGeometry args={[0.007, 0.009, 0.18, 5]} />
          <Mat color="#1a1a1a" />
        </mesh>
      ))}
      {[-2, -1, 0, 1, 2].map((i) => (
        <mesh key={i} position={[i * w * 0.12, h * 0.55, d / 2 + 0.002]}>
          <boxGeometry args={[0.012, 0.008, 0.004]} />
          <meshBasicMaterial color={i === 2 ? "#ff5a3a" : "#4cff7a"} />
        </mesh>
      ))}
    </group>
  );
}

/** Lives on the west wall: thin along x, the writing faces +x. */
function StickyNote({ size: [w, h, d] }: { size: Vec3 }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[w * 0.4, h, d]} />
        <Mat color="#f7e463" />
      </mesh>
      {[0.25, 0.05, -0.15].map((y, i) => (
        <mesh key={y} position={[w * 0.21, y * h, -d * 0.05 * i]}>
          <boxGeometry args={[0.002, 0.008, d * (0.7 - i * 0.12)]} />
          <meshBasicMaterial color="#2a3a8a" />
        </mesh>
      ))}
    </group>
  );
}

function HouseNumber({ size: [w, h, d] }: { size: Vec3 }) {
  const label = useLabel("412", "#e9dcc0", "#5a3a22");
  return (
    <group>
      <mesh>
        <boxGeometry args={[w, h, d]} />
        <Mat color="#a67b50" />
      </mesh>
      {/* the sign hangs on the south wall, so its face points into the room (-z) */}
      <mesh position={[0, 0, -d / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w * 0.88, h * 0.8]} />
        <meshStandardMaterial map={label} roughness={0.9} />
      </mesh>
    </group>
  );
}

function Door({ size: [w, h, d] }: { size: Vec3 }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[w, h, d]} />
        <Mat color="#6b4429" />
      </mesh>
      {[-1, 1].flatMap((side) =>
        [0.22, -0.2].map((y) => (
          <mesh key={`${side}${y}`} position={[0, y * h, side * (d / 2 + 0.005)]}>
            <boxGeometry args={[w * 0.66, h * 0.32, 0.01]} />
            <Mat color="#5a3820" />
          </mesh>
        )),
      )}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[w * 0.38, -0.05, side * (d / 2 + 0.03)]}>
          <sphereGeometry args={[0.03, 8, 6]} />
          <Mat color="#c9a24a" metal={0.8} rough={0.3} />
        </mesh>
      ))}
      {/* frame */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 + 0.04), 0, 0]}>
          <boxGeometry args={[0.08, h, d + 0.04]} />
          <Mat color="#efe6d2" />
        </mesh>
      ))}
      <mesh position={[0, h / 2 + 0.04, 0]}>
        <boxGeometry args={[w + 0.16, 0.08, d + 0.04]} />
        <Mat color="#efe6d2" />
      </mesh>
    </group>
  );
}

/** Snow falling outside (the big snowstorm is one of the clues). */
function Snow({ w, h }: { w: number; h: number }) {
  const ref = useRef<Points>(null);
  const count = 70;
  const positions = useMemo(() => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      a[i * 3] = (Math.random() - 0.5) * w;
      a[i * 3 + 1] = (Math.random() - 0.5) * h;
      a[i * 3 + 2] = 0.006;
    }
    return a;
  }, [w, h]);
  useFrame((_, dt) => {
    const p = ref.current?.geometry.getAttribute("position");
    if (!p) return;
    for (let i = 0; i < count; i++) {
      let y = p.getY(i) - dt * (0.12 + (i % 5) * 0.03);
      let x = p.getX(i) + Math.sin(y * 6 + i) * dt * 0.03;
      if (y < -h / 2) {
        y = h / 2;
        x = (Math.random() - 0.5) * w;
      }
      p.setXY(i, Math.max(-w / 2, Math.min(w / 2, x)), y);
    }
    p.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.025} sizeAttenuation transparent opacity={0.9} />
    </points>
  );
}

function Window({ size: [w, h, d] }: { size: Vec3 }) {
  const frame = "#f1ebdd";
  return (
    <group>
      {/* evening sky behind the glass */}
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color="#6f7f9e" side={DoubleSide} />
      </mesh>
      <mesh position={[0, -h * 0.35, 0.002]}>
        <planeGeometry args={[w, h * 0.3]} />
        <meshBasicMaterial color="#e8eef5" transparent opacity={0.85} />
      </mesh>
      <Snow w={w} h={h} />
      {/* frame and muntins */}
      {(
      [
        [0, h / 2, w + 0.1, 0.06],
        [0, -h / 2, w + 0.1, 0.06],
        [-w / 2, 0, 0.06, h],
        [w / 2, 0, 0.06, h],
        [0, 0, 0.04, h],
        [0, 0, w, 0.04],
      ] as [number, number, number, number][]).map(([x, y, fw, fh], i) => (
        <mesh key={i} position={[x, y, d]}>
          <boxGeometry args={[fw, fh, 0.05]} />
          <Mat color={frame} />
        </mesh>
      ))}
      <mesh position={[0, -h / 2 - 0.04, 0.08]}>
        <boxGeometry args={[w + 0.2, 0.04, 0.16]} />
        <Mat color={frame} />
      </mesh>
      {/* curtains */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 + 0.05), -0.08, 0.07]}>
          <boxGeometry args={[0.32, h + 0.5, 0.05]} />
          <Mat color="#b0623e" />
        </mesh>
      ))}
      <mesh position={[0, h / 2 + 0.2, 0.08]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, w + 0.8, 6]} />
        <Mat color={GOLD} metal={0.6} rough={0.4} />
      </mesh>
    </group>
  );
}

/** Commemorative moon-landing plate on a little stand (mentioned in the TV's inspect text). */
function MoonPlate({ size: [w, h] }: { size: Vec3 }) {
  const r = Math.min(w, h) / 2;
  return (
    <group position={[0, -h / 2 + r + 0.01, 0]} rotation={[-0.15, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r, r, 0.012, 16]} />
        <Mat color="#f1ece0" rough={0.3} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.007]}>
        <cylinderGeometry args={[r * 0.78, r * 0.78, 0.004, 16]} />
        <Mat color="#1f2f5a" rough={0.3} />
      </mesh>
      <mesh position={[r * 0.25, r * 0.2, 0.011]}>
        <sphereGeometry args={[r * 0.28, 10, 8]} />
        <Mat color="#c9c6bd" />
      </mesh>
      <mesh position={[-r * 0.3, -r * 0.3, 0.012]}>
        <boxGeometry args={[r * 0.08, r * 0.3, 0.004]} />
        <Mat color="#e6e2d6" />
      </mesh>
      <mesh position={[0, -r * 0.9, -0.03]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[r * 0.5, 0.012, 0.08]} />
        <Mat color="#5a3a22" />
      </mesh>
    </group>
  );
}

/** Grandma's reading glasses, folded on the coffee table: two round lenses, a bridge, folded arms. */
function ReadingGlasses({ size }: { size: Vec3 }) {
  const [w, , d] = size;
  const r = w * 0.22;
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * w * 0.25, r * 0.15, 0]} rotation={[-Math.PI / 2 + 0.25, 0, 0]}>
          <mesh>
            <torusGeometry args={[r, r * 0.12, 6, 16]} />
            <Mat color="#b08a3a" />
          </mesh>
          <mesh>
            <circleGeometry args={[r * 0.92, 16]} />
            <meshStandardMaterial color="#cfe3ea" transparent opacity={0.35} roughness={0.05} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, r * 0.3, 0]}>
        <boxGeometry args={[w * 0.12, r * 0.12, r * 0.12]} />
        <Mat color="#b08a3a" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * w * 0.05, r * 0.12, -d * 0.35]} rotation={[0, s * 0.15, 0]}>
          <boxGeometry args={[w * 0.6, r * 0.1, r * 0.1]} />
          <Mat color="#b08a3a" />
        </mesh>
      ))}
    </group>
  );
}

/** Close-up state some props show: an open door, the back of a photo. */
export interface Detail {
  open?: boolean;
  flipped?: boolean;
}

const MAKERS: Record<HandmadeName, (props: { size: Vec3 } & Detail) => React.ReactNode> = {
  trophy: Trophy,
  ribbon: Ribbon,
  sled: Sled,
  fishingRod: FishingRod,
  cookieJar: CookieJar,
  readingGlasses: ReadingGlasses,
  router: Router,
  stickyNote: StickyNote,
  houseNumber: HouseNumber,
  door: Door,
  window: Window,
  moonPlate: MoonPlate,
  weddingFrame: WeddingFrame,
  fridge: Fridge,
};

export function Handmade({ name, size, highlight = false, detail }: { name: HandmadeName; size: Vec3; highlight?: boolean; detail?: Detail }) {
  const [root, setRoot] = useState<Group | null>(null);
  useHighlight(root, highlight);
  const Make = MAKERS[name];
  return (
    <group ref={setRoot}>
      <Make size={size} {...detail} />
    </group>
  );
}
