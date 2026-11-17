/**
 * A lap blanket draped over a seated figure: it lies on the thighs, rolls over the knees and hangs
 * toward the floor, with the side edges sagging. Built from a subdivided plane bent along a path in
 * the figure's side view (z forward, y up), so nothing pokes through it the way a box did.
 */
import { PlaneGeometry, Vector3 } from "three";

export interface DrapeOptions {
  /** Height of the cloth above the hip and knee joints (thigh thickness). */
  lift?: number;
  /** How far the cloth starts behind the hips. */
  back?: number;
  /** Radius of the roll over the knees. */
  roll?: number;
  /** Length that hangs below the knees. */
  hang?: number;
  /** How far the side edges sag over the lap. */
  sag?: number;
}

/** Points along the centre line of the cloth (side view: [z, y]), spaced by `step`. */
export function drapePath(hips: Vector3, knees: Vector3, o: Required<DrapeOptions>, step = 0.005): [number, number][] {
  const thigh = Math.hypot(knees.z - hips.z, knees.y - hips.y);
  const phi1 = Math.atan2(knees.y - hips.y, knees.z - hips.z); // thigh slope
  const phi2 = -Math.PI / 2 + 0.12; // hanging, a touch forward
  const pts: [number, number][] = [];
  let z = hips.z - o.back * Math.cos(phi1);
  let y = hips.y + o.lift - o.back * Math.sin(phi1);
  const flat = thigh + o.back;
  const arc = o.roll * (phi1 - phi2);
  const total = flat + arc + o.hang;
  for (let s = 0; s <= total + 1e-9; s += step) {
    pts.push([z, y]);
    const phi = s < flat ? phi1 : s < flat + arc ? phi1 - (s - flat) / o.roll : phi2;
    z += Math.cos(phi) * step;
    y += Math.sin(phi) * step;
  }
  return pts;
}

export const DRAPE_DEFAULTS: Required<DrapeOptions> = { lift: 0.085, back: 0.05, roll: 0.06, hang: 0.24, sag: 0.07 };

/**
 * Height of the cloth's top at (x, z) over the lap, between its back edge and the knees; null elsewhere (the
 * roll and the hanging part). Same shape as `drapedBlanket`, so a body can be checked against it.
 */
export function drapeSurfaceY(hips: Vector3, knees: Vector3, width: number, opts: DrapeOptions, x: number, z: number): number | null {
  const o = { ...DRAPE_DEFAULTS, ...opts };
  const half = width / 2;
  const edge = Math.abs(x - hips.x) / half;
  if (edge > 1) return null;
  const phi1 = Math.atan2(knees.y - hips.y, knees.z - hips.z);
  const along = (z - hips.z) / Math.cos(phi1); // distance from the hips along the thigh line
  if (along < -o.back || z > knees.z) return null;
  return hips.y + o.lift + along * Math.sin(phi1) - o.sag * edge ** 4;
}

/**
 * The smallest `lift` that keeps the cloth at least `gap` above every point (the posed thigh vertices), with
 * the given width and sag. Clipping plan step 4: the blanket is shaped from her legs, not guessed.
 */
export function liftToClear(hips: Vector3, knees: Vector3, width: number, opts: DrapeOptions, points: Vector3[], gap: number): number {
  let lift = 0;
  for (const p of points) {
    const y0 = drapeSurfaceY(hips, knees, width, { ...opts, lift: 0 }, p.x, p.z);
    if (y0 !== null) lift = Math.max(lift, p.y + gap - y0);
  }
  return lift;
}

export function drapedBlanket(hips: Vector3, knees: Vector3, width: number, opts: DrapeOptions = {}) {
  const o: Required<DrapeOptions> = { ...DRAPE_DEFAULTS, ...opts };
  const step = 0.005;
  const path = drapePath(hips, knees, o, step);
  const length = (path.length - 1) * step;
  const flatEnd = Math.hypot(knees.z - hips.z, knees.y - hips.y) + o.back;
  const geo = new PlaneGeometry(width, length, 10, 28);
  const pos = geo.attributes.position!;
  const half = width / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const s = length / 2 - pos.getY(i); // 0 at the back edge
    const k = Math.min(path.length - 1, Math.max(0, s / step));
    const a = path[Math.floor(k)]!;
    const b = path[Math.ceil(k)]!;
    const f = k - Math.floor(k);
    let z = a[0] + (b[0] - a[0]) * f;
    let y = a[1] + (b[1] - a[1]) * f;
    const edge = Math.abs(x) / half; // 0 centre, 1 side edge
    const hanging = Math.min(1, Math.max(0, (s - flatEnd) / 0.08));
    // Over the lap the sides fall over the outside of the thighs; once hanging they curl back a little.
    y -= o.sag * edge ** 4 * (1 - hanging);
    z -= 0.03 * edge ** 2 * hanging;
    // Soft folds in the hanging part.
    z += 0.008 * Math.sin(x * 38) * hanging;
    pos.setXYZ(i, hips.x + x, y, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}
