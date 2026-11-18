/**
 * Props with detail you can examine up close (iteration 49): the wedding photo in its frame (front and back),
 * the open photo album, and the fridge, whose door opens onto what's inside. Like handmade.tsx, each fills a
 * box of `size` centred on the origin, standing on its bottom, front toward +z.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, DoubleSide, LatheGeometry, NearestFilter, Vector2 } from "three";
import type { Group } from "three";
import type { Vec3 } from "./models.ts";
import { useAlbumPage, useCard, usePhoto } from "./photos.ts";

function Mat({ color, rough = 0.8, metal = 0, opacity }: { color: string; rough?: number; metal?: number; opacity?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={rough}
      metalness={metal}
      flatShading
      transparent={opacity !== undefined}
      opacity={opacity ?? 1}
    />
  );
}

function useLabel(text: string, opts: { bg: string; fg: string; font: string; w?: number; h?: number }) {
  const { bg, fg, font, w = 128, h = 32 } = opts;
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d")!;
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = font;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 1);
    const t = new CanvasTexture(c);
    t.magFilter = NearestFilter;
    return t;
  }, [text, bg, fg, font, w, h]);
}

/** Eases a value toward a target every frame (for doors, page turns, flips). */
function useEased(target: number, rate: number, apply: (value: number) => void) {
  const v = useRef(target);
  useFrame((_, dt) => {
    v.current += (target - v.current) * Math.min(1, dt * rate);
    apply(v.current);
  });
}

// ---- Wedding photo ---------------------------------------------------------------------------------------------

/**
 * A standing frame: the generated wedding photo in front, a brass plate engraved "Unchained Melody", and on the back
 * Grandpa's handwriting. `flipped` turns it round (examine view).
 */
export function WeddingFrame({ size: [w, h, d], flipped = false }: { size: Vec3; flipped?: boolean }) {
  const photo = usePhoto("wedding");
  const back = useCard("wedding_back");
  const plate = useLabel("Unchained Melody", { bg: "#c9a648", fg: "#4a3410", font: "italic bold 20px Georgia, serif" });
  const turn = useRef<Group>(null);
  useEased(flipped ? Math.PI : 0, 6, (v) => {
    if (turn.current) turn.current.rotation.y = v;
  });
  const border = w * 0.11;
  const depth = Math.min(d, 0.025);
  const innerW = w - border * 2;
  const innerH = h - border * 2;
  const wood = "#3b2416";
  return (
    <group position={[0, 0, 0]} ref={turn}>
      {/* frame bars */}
      <mesh position={[0, h / 2 - border / 2, 0]}>
        <boxGeometry args={[w, border, depth]} />
        <Mat color={wood} rough={0.5} />
      </mesh>
      <mesh position={[0, -h / 2 + border / 2, 0]}>
        <boxGeometry args={[w, border, depth]} />
        <Mat color={wood} rough={0.5} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 - border / 2), 0, 0]}>
          <boxGeometry args={[border, h - border * 2, depth]} />
          <Mat color={wood} rough={0.5} />
        </mesh>
      ))}
      {/* gold inner lip */}
      <mesh position={[0, 0, depth / 2 - 0.004]}>
        <boxGeometry args={[innerW + 0.01, innerH + 0.01, 0.004]} />
        <Mat color="#b8923a" metal={0.5} rough={0.4} />
      </mesh>
      {/* the photo */}
      <mesh position={[0, 0, depth / 2 - 0.001]}>
        <planeGeometry args={[innerW, innerH]} />
        <meshBasicMaterial map={photo} toneMapped={false} />
      </mesh>
      {/* engraved plate on the bottom bar */}
      <mesh position={[0, -h / 2 + border / 2, depth / 2 + 0.001]}>
        <planeGeometry args={[innerW * 0.7, border * 0.6]} />
        <meshStandardMaterial map={plate} metalness={0.4} roughness={0.4} />
      </mesh>
      {/* the back: kraft paper with the inscription, and the stand */}
      <mesh position={[0, 0, -depth / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w * 0.96, h * 0.96]} />
        <meshStandardMaterial map={back} roughness={1} />
      </mesh>
      {/* a short kickstand low on the back, clear of the writing */}
      <mesh position={[0, -h * 0.33, -depth / 2 - h * 0.08]} rotation={[0.45, 0, 0]}>
        <boxGeometry args={[w * 0.14, h * 0.36, 0.006]} />
        <Mat color="#6b4a2f" />
      </mesh>
    </group>
  );
}

// ---- Photo album (examine only; the room shows the closed book) ----------------------------------------------

export const ALBUM_SPREADS = 3;

function AlbumPage({ spread, side, w, h }: { spread: number; side: 0 | 1; w: number; h: number }) {
  const tex = useAlbumPage(spread, side);
  return (
    <mesh position={[(side === 0 ? -1 : 1) * (w / 2 + 0.002), 0.012, 0]} rotation={[-Math.PI / 2, 0, (side === 0 ? 1 : -1) * 0.04]}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={tex} roughness={1} />
    </mesh>
  );
}

/** The album lying open at `spread`, pages facing up (examine view looks down at it). */
export function OpenAlbum({ spread }: { spread: number }) {
  const pw = 0.4;
  const ph = 0.52;
  return (
    <group rotation={[0.9, 0, 0]}>
      <mesh position={[0, -0.006, 0]}>
        <boxGeometry args={[pw * 2 + 0.05, 0.012, ph + 0.04]} />
        <Mat color="#7b2d26" rough={0.6} />
      </mesh>
      {/* page block */}
      <mesh position={[0, 0.004, 0]}>
        <boxGeometry args={[pw * 2, 0.012, ph]} />
        <Mat color="#e4d9bf" />
      </mesh>
      <AlbumPage key={`${spread}-0`} spread={spread} side={0} w={pw} h={ph} />
      <AlbumPage key={`${spread}-1`} spread={spread} side={1} w={pw} h={ph} />
      {/* the gutter */}
      <mesh position={[0, 0.013, 0]}>
        <boxGeometry args={[0.012, 0.004, ph]} />
        <Mat color="#b9ab8c" />
      </mesh>
    </group>
  );
}

// ---- Fridge ---------------------------------------------------------------------------------------------------

/** A green Jell-O ring: a fluted lathe, see-through. */
function JelloMold({ r }: { r: number }) {
  const geo = useMemo(() => {
    const pts: Vector2[] = [];
    for (let i = 0; i <= 8; i++) {
      const y = (i / 8) * r * 1.1;
      pts.push(new Vector2(r * (1 - i / 14) + (i % 2) * r * 0.08, y));
    }
    pts.push(new Vector2(r * 0.35, r * 1.1), new Vector2(r * 0.35, 0));
    return new LatheGeometry(pts, 12);
  }, [r]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#5fbf4a" roughness={0.15} transparent opacity={0.8} flatShading />
    </mesh>
  );
}

function Jar({ r, h, glass, lid, children }: { r: number; h: number; glass: string; lid: string; children?: React.ReactNode }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[r, r, h, 10]} />
        <meshStandardMaterial color={glass} roughness={0.1} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, h + 0.008, 0]}>
        <cylinderGeometry args={[r * 1.02, r * 1.02, 0.016, 10]} />
        <Mat color={lid} metal={0.5} rough={0.4} />
      </mesh>
      {children}
    </group>
  );
}

/** What's in Grandma's fridge (the fridge's inspect text lists the same things). */
function FridgeContents({ w, h, d }: { w: number; h: number; d: number }) {
  const note = useLabel("FOR SUNDAY", { bg: "#fbf6e6", fg: "#2a2440", font: "bold 18px 'Segoe Print', 'Comic Sans MS', cursive", w: 128, h: 40 });
  const shelfY = [h * 0.08, h * 0.34, h * 0.58];
  const inner = w - 0.08;
  return (
    <group position={[0, -h / 2, 0]}>
      {shelfY.slice(1).map((y) => (
        <mesh key={y} position={[0, y, -0.02]}>
          <boxGeometry args={[inner, 0.012, d - 0.12]} />
          <meshStandardMaterial color="#d9e6ea" roughness={0.2} transparent opacity={0.7} />
        </mesh>
      ))}
      {/* top shelf: Jell-O ring on a plate, a glass bottle of milk */}
      <group position={[-inner * 0.22, shelfY[2]! + 0.006, -0.04]}>
        <mesh position={[0, 0.004, 0]}>
          <cylinderGeometry args={[0.11, 0.1, 0.008, 14]} />
          <Mat color="#f4efe2" rough={0.3} />
        </mesh>
        <group position={[0, 0.008, 0]}>
          <JelloMold r={0.08} />
        </group>
      </group>
      <group position={[inner * 0.25, shelfY[2]! + 0.006, -0.06]}>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.04, 0.045, 0.2, 10]} />
          <Mat color="#f7f7f2" rough={0.2} />
        </mesh>
        <mesh position={[0, 0.215, 0]}>
          <cylinderGeometry args={[0.025, 0.03, 0.03, 10]} />
          <Mat color="#3f6fb0" rough={0.4} />
        </mesh>
      </group>
      {/* middle shelf: pierogi under foil with the note, a jar of dill pickles */}
      <group position={[-inner * 0.12, shelfY[1]! + 0.006, -0.02]}>
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[0.26, 0.06, 0.18]} />
          <Mat color="#d7d2c4" rough={0.4} />
        </mesh>
        <mesh position={[0, 0.068, 0]} scale={[1, 0.25, 0.7]}>
          <icosahedronGeometry args={[0.14, 1]} />
          <meshStandardMaterial color="#c9ccd1" metalness={0.8} roughness={0.35} flatShading />
        </mesh>
        <mesh position={[0.02, 0.07, 0.092]} rotation={[-0.2, 0, 0.05]}>
          <planeGeometry args={[0.14, 0.045]} />
          <meshStandardMaterial map={note} roughness={1} side={DoubleSide} />
        </mesh>
      </group>
      <group position={[inner * 0.3, shelfY[1]! + 0.006, -0.05]}>
        <Jar r={0.045} h={0.13} glass="#cfe2c0" lid="#c8b04a">
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[(i - 1) * 0.02, 0.06, (i % 2) * 0.01]} rotation={[0, 0, 0.1 * (i - 1)]}>
              <capsuleGeometry args={[0.012, 0.07, 3, 6]} />
              <Mat color="#5f7a2e" />
            </mesh>
          ))}
        </Jar>
      </group>
      {/* bottom: the crisper drawer */}
      <mesh position={[0, shelfY[0]! + 0.07, -0.02]}>
        <boxGeometry args={[inner * 0.9, 0.14, d - 0.14]} />
        <meshStandardMaterial color="#e8f0f2" roughness={0.2} transparent opacity={0.6} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.12 + i * 0.1, shelfY[0]! + 0.05, 0]}>
          <sphereGeometry args={[0.035, 7, 5]} />
          <Mat color={i === 1 ? "#d8b23a" : "#b8352a"} rough={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A 1960s fridge: cream body, chrome handle, freezer at the top. The main door swings open on its left hinge
 * when `open`; inside are the shelves and food. Magnets and a grandkid's drawing on the door.
 */
export function Fridge({ size: [w, h, d], open = false }: { size: Vec3; open?: boolean }) {
  const door = useRef<Group>(null);
  useEased(open ? -1.95 : 0, 5, (v) => {
    if (door.current) door.current.rotation.y = v;
  });
  const drawing = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 80;
    const g = c.getContext("2d")!;
    g.fillStyle = "#fbfbf6";
    g.fillRect(0, 0, 64, 80);
    g.lineWidth = 3;
    // Grandma (a very tall one) with an enormous cup of tea.
    g.strokeStyle = "#7b4fa0";
    g.beginPath();
    g.arc(26, 18, 8, 0, Math.PI * 2);
    g.moveTo(26, 26);
    g.lineTo(26, 58);
    g.lineTo(18, 74);
    g.moveTo(26, 58);
    g.lineTo(34, 74);
    g.moveTo(26, 36);
    g.lineTo(42, 40);
    g.stroke();
    g.fillStyle = "#c46a7a";
    g.fillRect(40, 34, 16, 14);
    g.strokeStyle = "#e0a020";
    g.beginPath();
    g.arc(56, 8, 6, 0, Math.PI * 2);
    g.stroke();
    const t = new CanvasTexture(c);
    t.magFilter = NearestFilter;
    return t;
  }, []);
  const t = 0.035; // wall thickness
  const cream = "#b9d0c0"; // mint, like the fridge in the room (iteration 56)
  const freezerH = h * 0.24;
  const mainH = h - freezerH - 0.02;
  const lit = open ? "#5e5a50" : "#000000";
  return (
    <group>
      {/* the cabinet: back, sides, top, bottom, freezer floor (open at the front) */}
      <mesh position={[0, 0, -d / 2 + t / 2]}>
        <boxGeometry args={[w, h, t]} />
        <meshStandardMaterial color="#f5f4ee" emissive={lit} roughness={0.6} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 - t / 2), 0, -0.01]}>
          <boxGeometry args={[t, h, d - 0.02]} />
          <Mat color={cream} rough={0.45} />
        </mesh>
      ))}
      <mesh position={[0, h / 2 - t / 2, -0.01]}>
        <boxGeometry args={[w, t, d - 0.02]} />
        <Mat color={cream} rough={0.45} />
      </mesh>
      <mesh position={[0, -h / 2 + 0.05, -0.01]}>
        <boxGeometry args={[w, 0.1, d - 0.02]} />
        <Mat color={cream} rough={0.45} />
      </mesh>
      <mesh position={[0, h / 2 - freezerH, -0.01]}>
        <boxGeometry args={[w, 0.03, d - 0.02]} />
        <Mat color={cream} rough={0.45} />
      </mesh>
      {/* inner liner, lit when the door's open */}
      {[-1, 1].map((s) => (
        <mesh key={`l${s}`} position={[s * (w / 2 - t - 0.001), -freezerH / 2, -0.01]} rotation={[0, (-s * Math.PI) / 2, 0]}>
          <planeGeometry args={[d - 0.04, mainH - 0.1]} />
          <meshStandardMaterial color="#f5f4ee" emissive={lit} roughness={0.6} />
        </mesh>
      ))}
      <FridgeContents w={w} h={h} d={d} />
      {/* freezer door (stays shut) */}
      <mesh position={[0, h / 2 - freezerH / 2, d / 2 - 0.01]}>
        <boxGeometry args={[w, freezerH - 0.01, 0.05]} />
        <Mat color={cream} rough={0.45} />
      </mesh>
      <mesh position={[w / 2 - 0.07, h / 2 - freezerH + 0.05, d / 2 + 0.03]}>
        <boxGeometry args={[0.025, 0.1, 0.03]} />
        <Mat color="#d8dcdf" metal={0.9} rough={0.25} />
      </mesh>
      {/* main door, hinged on the left edge */}
      <group ref={door} position={[-w / 2, -freezerH / 2 - 0.01, d / 2 - 0.01]}>
        <group position={[w / 2, 0, 0]}>
          <mesh>
            <boxGeometry args={[w, mainH, 0.05]} />
            <Mat color={cream} rough={0.45} />
          </mesh>
          {/* chrome handle */}
          <mesh position={[w / 2 - 0.07, mainH / 2 - 0.22, 0.045]}>
            <boxGeometry args={[0.025, 0.3, 0.03]} />
            <Mat color="#d8dcdf" metal={0.9} rough={0.25} />
          </mesh>
          {/* the drawing and magnets */}
          <mesh position={[-0.05, 0.12, 0.026]} rotation={[0, 0, 0.05]}>
            <planeGeometry args={[0.2, 0.25]} />
            <meshStandardMaterial map={drawing} roughness={1} />
          </mesh>
          {[
            [-0.13, 0.25, "#d94a3a"],
            [0.04, 0.25, "#3a7ad9"],
            [0.12, -0.2, "#e0b020"],
          ].map(([x, y, c]) => (
            <mesh key={c as string} position={[x as number, y as number, 0.03]}>
              <cylinderGeometry args={[0.018, 0.018, 0.012, 8]} />
              <meshStandardMaterial color={c as string} roughness={0.4} />
            </mesh>
          ))}
          {/* door shelves on the inside: butter dish and a row of eggs */}
          <group position={[0, 0, -0.025]} rotation={[0, Math.PI, 0]}>
            {[-0.18, 0.2].map((y) => (
              <mesh key={y} position={[0, y, 0.05]}>
                <boxGeometry args={[w - 0.12, 0.08, 0.07]} />
                <meshStandardMaterial color="#e8f0f2" roughness={0.2} transparent opacity={0.6} />
              </mesh>
            ))}
            {[0, 1, 2, 3, 4].map((i) => (
              <mesh key={i} position={[-0.2 + i * 0.1, 0.25, 0.05]} scale={[1, 1.3, 1]}>
                <sphereGeometry args={[0.024, 7, 5]} />
                <Mat color="#f6efe0" rough={0.5} />
              </mesh>
            ))}
            <mesh position={[0.05, -0.12, 0.05]}>
              <boxGeometry args={[0.16, 0.05, 0.06]} />
              <Mat color="#f2e48c" rough={0.5} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
