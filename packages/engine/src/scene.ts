/**
 * Scene manifest: the room layout and its interactable objects, as engine-neutral data.
 * The web client builds a grey-box room from it today; a glTF from Blender (or a Godot scene)
 * can later replace the shapes as long as its node names match `node`.
 *
 * Coordinates are meters, y up, room centered on the origin. `position` is the center of the shape.
 */
import { z } from "zod";

const Vec3 = z.tuple([z.number(), z.number(), z.number()]);

const Shape = z.enum(["box", "cylinder", "figure"]);

const Prop = z.strictObject({
  id: z.string(),
  node: z.string(),
  shape: Shape,
  size: Vec3,
  position: Vec3,
  rotation_y: z.number().optional(),
  color: z.string(),
  collide: z.boolean().default(true),
  /**
   * The node in the room model (room.glb, built in Blender) that draws this object, e.g. "PROP_album". Without
   * it the client draws the object itself (models.ts).
   */
  model: z.string().optional(),
});

/** A camera view of the room (tap-to-look play): where the camera stands, what it looks at, its field of view. */
const View = z.strictObject({
  id: z.string(),
  label: z.string(),
  pos: Vec3,
  look: Vec3,
  fov: z.number(),
});

/** `fixture`: something you open and look into (the fridge), but can't carry. */
export const InteractKind = z.enum(["grandma", "clue", "note", "router", "cookie_jar", "glasses", "fixture", "phone"]);
export type InteractKind = z.infer<typeof InteractKind>;

const Interactable = Prop.extend({
  kind: InteractKind,
  label: z.string(),
  inspect_text: z.string().optional(),
  /** The view it's best seen from (tapping it from elsewhere moves the camera there first). */
  view: z.string().optional(),
  /** SERVER-ONLY: which of Grandma's facts this object brings to mind when shown to her. */
  fact_ids: z.array(z.string()).optional(),
});

export const SceneManifest = z.strictObject({
  id: z.string(),
  world_id: z.string(),
  room: z.strictObject({
    width: z.number(),
    depth: z.number(),
    height: z.number(),
    wall_color: z.string(),
    floor_color: z.string(),
    ceiling_color: z.string(),
    fog_color: z.string(),
  }),
  spawn: z.strictObject({ position: Vec3, yaw: z.number() }),
  /** The room model the props live in (a glTF under the web client's public folder), if any. */
  model: z.string().optional(),
  /** Camera views, the first one the overview. */
  views: z.array(View).optional(),
  props: z.array(Prop),
  interactables: z.array(Interactable),
});

export type SceneManifest = z.infer<typeof SceneManifest>;
export type SceneProp = z.infer<typeof Prop>;
export type SceneInteractable = z.infer<typeof Interactable>;

/** What the client is allowed to see: everything except the fact links. */
export const PublicScene = SceneManifest.extend({
  interactables: z.array(Interactable.omit({ fact_ids: true })),
});
export type PublicScene = z.infer<typeof PublicScene>;

export function toPublicScene(scene: SceneManifest): PublicScene {
  return {
    ...scene,
    interactables: scene.interactables.map(({ fact_ids: _hidden, ...rest }) => rest),
  };
}

/** Cross-checks between a scene and its world. */
export function checkScene(scene: SceneManifest, factIds: Set<string>): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const item of [...scene.props, ...scene.interactables]) {
    if (ids.has(item.id)) problems.push(`scene ${scene.id}: duplicate id ${item.id}`);
    ids.add(item.id);
  }
  for (const it of scene.interactables) {
    for (const f of it.fact_ids ?? []) {
      if (!factIds.has(f)) problems.push(`scene ${scene.id}: ${it.id} links unknown fact ${f}`);
    }
    if ((it.kind === "clue" || it.kind === "fixture") && !it.inspect_text) problems.push(`scene ${scene.id}: ${it.kind} ${it.id} has no inspect_text`);
  }
  for (const kind of ["grandma", "note", "router"] as const) {
    if (!scene.interactables.some((i) => i.kind === kind)) problems.push(`scene ${scene.id}: missing a ${kind}`);
  }
  const [sx, , sz] = scene.spawn.position;
  const r = PLAYER_RADIUS;
  if (Math.abs(sx) > scene.room.width / 2 - r || Math.abs(sz) > scene.room.depth / 2 - r) {
    problems.push(`scene ${scene.id}: spawn is outside the room`);
  }
  for (const item of [...scene.props, ...scene.interactables]) {
    if (item.collide === false) continue;
    const [x, , z] = item.position;
    const [w, , d] = item.size;
    if (Math.abs(sx - x) < w / 2 + r && Math.abs(sz - z) < d / 2 + r) {
      problems.push(`scene ${scene.id}: spawn is inside ${item.id}; the player would be stuck`);
    }
  }
  return problems;
}

/** Player collision radius in meters (clients use the same value). */
export const PLAYER_RADIUS = 0.28;
