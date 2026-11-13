/** npm run validate: check every world, scene and string file under data/. Exits 1 on any problem. */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GrandmaWorld, SceneManifest, Strings, checkScene, checkWorld, computePassword } from "../src/index.ts";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "../../../data");
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8")) as unknown;
let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`✗ ${msg}`);
};

const worlds = new Map<string, GrandmaWorld>();
for (const file of readdirSync(join(dataDir, "grandmas")).filter((f) => f.endsWith(".json"))) {
  const parsed = GrandmaWorld.safeParse(readJson(join(dataDir, "grandmas", file)));
  if (!parsed.success) {
    fail(`grandmas/${file}: ${parsed.error.message}`);
    continue;
  }
  const problems = checkWorld(parsed.data);
  problems.forEach((p) => fail(`grandmas/${file}: ${p}`));
  worlds.set(parsed.data.id, parsed.data);
  if (!problems.length) {
    const recipes = parsed.data.recipes.map((r) => `${r.id}=${computePassword(parsed.data, r)}`).join(", ");
    console.log(`✓ grandmas/${file} (${parsed.data.facts.length} facts; ${recipes})`);
  }
}

for (const file of readdirSync(join(dataDir, "scenes")).filter((f) => f.endsWith(".json"))) {
  const parsed = SceneManifest.safeParse(readJson(join(dataDir, "scenes", file)));
  if (!parsed.success) {
    fail(`scenes/${file}: ${parsed.error.message}`);
    continue;
  }
  const world = worlds.get(parsed.data.world_id);
  if (!world) {
    fail(`scenes/${file}: unknown world ${parsed.data.world_id}`);
    continue;
  }
  const problems = checkScene(parsed.data, new Set(world.facts.map((f) => f.id)));
  problems.forEach((p) => fail(p));
  if (!problems.length) console.log(`✓ scenes/${file} (${parsed.data.interactables.length} interactables)`);
}

for (const file of readdirSync(join(dataDir, "i18n")).filter((f) => f.endsWith(".json"))) {
  const parsed = Strings.safeParse(readJson(join(dataDir, "i18n", file)));
  if (!parsed.success) fail(`i18n/${file}: ${parsed.error.message}`);
  else console.log(`✓ i18n/${file} (${Object.keys(parsed.data.ui).length} UI strings)`);
}

if (failures) {
  console.error(`\n${failures} problem(s).`);
  process.exit(1);
}
