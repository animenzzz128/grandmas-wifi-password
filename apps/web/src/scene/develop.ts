/**
 * "Developing" a rendered photo: turns raw render pixels into an old print. Pure (no DOM, no WebGL), so it's
 * unit-tested.
 *
 * - `bw`: a 1950s–60s black-and-white print (warm paper tone, a little contrast).
 * - `faded`: a 1960s colour snapshot that has sat in an album (warm cast, lifted blacks, less saturation).
 *
 * Both get film grain and a vignette. Grain comes from a seeded generator, so a photo is the same every visit.
 */
export type PhotoStyle = "bw" | "faded";

/** Linear (what a render target holds) to sRGB, as a lookup table. */
const TO_SRGB = (() => {
  const t = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    const l = i / 255;
    const s = l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
    t[i] = Math.round(s * 255);
  }
  return t;
})();

function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/**
 * Develops `pixels` (RGBA, rows top to bottom) in place. `linear`: the pixels are linear light (straight
 * from a render target) and need converting to sRGB first.
 */
export function develop(pixels: Uint8ClampedArray, w: number, h: number, style: PhotoStyle, seed = 1, linear = true): void {
  const rand = seeded(seed);
  const cx = w / 2;
  const cy = h / 2;
  const maxD = Math.hypot(cx, cy);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = pixels[i]!;
      let g = pixels[i + 1]!;
      let b = pixels[i + 2]!;
      if (linear) {
        r = TO_SRGB[r]!;
        g = TO_SRGB[g]!;
        b = TO_SRGB[b]!;
      }
      const d = Math.hypot(x - cx, y - cy) / maxD;
      const vignette = 1 - 0.45 * d * d;
      const grain = (rand() - 0.5) * 22;
      if (style === "bw") {
        let l = 0.3 * r + 0.59 * g + 0.11 * b;
        l = (l - 128) * 1.15 + 128; // contrast
        l = l * vignette + grain;
        pixels[i] = l * 1.0 + 6;
        pixels[i + 1] = l * 0.97 + 4;
        pixels[i + 2] = l * 0.9;
      } else {
        const l = 0.3 * r + 0.59 * g + 0.11 * b;
        const sat = 0.62;
        r = l + (r - l) * sat;
        g = l + (g - l) * sat;
        b = l + (b - l) * sat;
        // Lifted blacks, warm cast, a slightly cyan-starved print.
        r = (28 + r * 0.86) * 1.06;
        g = 24 + g * 0.84;
        b = (30 + b * 0.78) * 0.9;
        pixels[i] = r * vignette + grain;
        pixels[i + 1] = g * vignette + grain;
        pixels[i + 2] = b * vignette + grain;
      }
      pixels[i + 3] = 255;
    }
  }
}

/** Render targets read bottom row first; images go top row first. */
export function flipRows(pixels: Uint8Array, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length);
  const row = w * 4;
  for (let y = 0; y < h; y++) out.set(pixels.subarray((h - 1 - y) * row, (h - y) * row), y * row);
  return out;
}
