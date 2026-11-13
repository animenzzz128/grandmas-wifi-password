/** Loads and validates everything under data/ once at startup. A bad file stops the server with a clear error. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SceneManifest, Strings, checkScene, parseWorld } from "@gwp/engine";
import type { GrandmaWorld } from "@gwp/engine";

export interface GameData {
  worlds: Map<string, GrandmaWorld>;
  scenes: Map<string, SceneManifest>;
  /** world id -> scene id */
  sceneForWorld: Map<string, string>;
  strings: Strings;
}

const readJson = (p: string): unknown => JSON.parse(readFileSync(p, "utf8"));
const jsonFiles = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".json"));

export function loadGameData(dataDir: string, lang = "en"): GameData {
  const worlds = new Map<string, GrandmaWorld>();
  for (const f of jsonFiles(join(dataDir, "grandmas"))) {
    const world = parseWorld(readJson(join(dataDir, "grandmas", f)));
    worlds.set(world.id, world);
  }
  const scenes = new Map<string, SceneManifest>();
  const sceneForWorld = new Map<string, string>();
  for (const f of jsonFiles(join(dataDir, "scenes"))) {
    const scene = SceneManifest.parse(readJson(join(dataDir, "scenes", f)));
    const world = worlds.get(scene.world_id);
    if (!world) throw new Error(`scene ${scene.id}: unknown world ${scene.world_id}`);
    const problems = checkScene(scene, new Set(world.facts.map((x) => x.id)));
    if (problems.length) throw new Error(problems.join("\n"));
    scenes.set(scene.id, scene);
    if (!sceneForWorld.has(world.id)) sceneForWorld.set(world.id, scene.id);
  }
  const strings = Strings.parse(readJson(join(dataDir, "i18n", `${lang}.json`)));
  return { worlds, scenes, sceneForWorld, strings };
}
