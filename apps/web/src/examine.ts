/**
 * What the examine view offers for each object (iteration 49): extra views you can switch between, like the
 * back of the wedding photo or the pages of the album. Keyed by the scene's node names, like models.ts.
 */
export type ExamineViews = { kind: "sides"; labels: string[] } | { kind: "pages"; count: number } | null;

const VIEWS: Record<string, ExamineViews> = {
  WeddingPhoto: { kind: "sides", labels: ["examine.front", "examine.back"] },
  PhotoAlbum: { kind: "pages", count: 3 },
};

export function viewsFor(node: string): ExamineViews {
  return VIEWS[node] ?? null;
}

/** How many views an object has (1 when there's nothing to switch). */
export function viewCount(node: string): number {
  const v = viewsFor(node);
  if (!v) return 1;
  return v.kind === "sides" ? v.labels.length : v.count;
}

/** The next view index, wrapping at either end. */
export function stepView(node: string, view: number, by: number): number {
  const n = viewCount(node);
  return (((view + by) % n) + n) % n;
}

/** Where the player stands (updated by the player controller), so a close-up shows the side they were facing. */
export const viewer = { x: 0, z: 0 };

/**
 * How far to turn an object (radians about y) so the side facing the viewer faces the close-up camera (+z).
 * Snapped to quarter turns: the objects are boxes, and a square-on view reads best.
 */
export function facingTurn(objX: number, objZ: number, rotationY: number, viewX: number, viewZ: number): number {
  const dx = viewX - objX;
  const dz = viewZ - objZ;
  // Into the object's own frame (undo its rotation about y).
  const c = Math.cos(-rotationY);
  const s = Math.sin(-rotationY);
  const lx = dx * c + dz * s;
  const lz = -dx * s + dz * c;
  const yaw = Math.atan2(lx, lz);
  const snapped = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
  return snapped === 0 ? 0 : -snapped;
}
