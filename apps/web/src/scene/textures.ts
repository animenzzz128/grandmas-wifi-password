/** Room surfaces drawn in code (tiny canvases, chunky pixels): wood floor, wallpaper, ceiling. */
import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace } from "three";

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat: [number, number]) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.magFilter = NearestFilter;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(...repeat);
  return t;
}

/** Deterministic noise so the floor looks the same every visit. */
function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Planks 1 m long, 4 per meter wide. One tile = 1 x 1 m. */
export function woodFloor(widthM: number, depthM: number) {
  return canvas(
    64,
    64,
    (g) => {
      const r = rand(7);
      const rows = 4;
      for (let i = 0; i < rows; i++) {
        const y = (i * 64) / rows;
        const offset = (i % 2) * 32;
        for (let x = -offset; x < 64; x += 64) {
          const shade = 0.85 + r() * 0.3;
          g.fillStyle = `rgb(${Math.round(120 * shade)},${Math.round(80 * shade)},${Math.round(50 * shade)})`;
          g.fillRect(x, y, 64, 64 / rows);
        }
        g.fillStyle = "rgba(40,25,15,0.8)";
        g.fillRect(0, y, 64, 1);
        g.fillRect(offset, y, 1, 64 / rows); // where this row's planks meet
        for (let k = 0; k < 6; k++) {
          g.fillStyle = "rgba(60,38,22,0.35)";
          g.fillRect(Math.floor(r() * 64), y + 2 + Math.floor(r() * (64 / rows - 4)), 6 + Math.floor(r() * 10), 1);
        }
      }
    },
    [widthM, depthM],
  );
}

/** Wallpaper: soft stripes with little flowers above a wood wainscot. One tile = 0.5 m wide x full wall height. */
export function wallpaper(widthM: number, base: string) {
  return canvas(
    32,
    128,
    (g) => {
      g.fillStyle = base;
      g.fillRect(0, 0, 32, 128);
      g.fillStyle = "rgba(255,255,255,0.12)";
      g.fillRect(0, 0, 8, 88);
      g.fillRect(16, 0, 8, 88);
      for (let y = 6; y < 84; y += 14) {
        g.fillStyle = "rgba(150,70,70,0.45)";
        g.fillRect(11, y, 2, 2);
        g.fillStyle = "rgba(80,110,70,0.45)";
        g.fillRect(27, y + 7, 2, 2);
      }
      // chair rail and wainscot (lower ~1/3 of the wall)
      g.fillStyle = "#6e4a2e";
      g.fillRect(0, 86, 32, 4);
      g.fillStyle = "#83593a";
      g.fillRect(0, 90, 32, 38);
      g.fillStyle = "#6e4a2e";
      g.fillRect(0, 90, 1, 38);
      g.fillRect(16, 90, 1, 38);
      g.fillStyle = "#4e3320";
      g.fillRect(0, 122, 32, 6);
    },
    [widthM / 0.5, 1],
  );
}

export function ceiling(widthM: number, depthM: number, base: string) {
  return canvas(
    16,
    16,
    (g) => {
      g.fillStyle = base;
      g.fillRect(0, 0, 16, 16);
      const r = rand(3);
      for (let i = 0; i < 20; i++) {
        g.fillStyle = "rgba(0,0,0,0.04)";
        g.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1, 1);
      }
    },
    [widthM, depthM],
  );
}
