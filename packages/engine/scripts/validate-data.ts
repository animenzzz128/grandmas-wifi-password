/** npm run validate: check every world, scene and string file under data/. Exits 1 on any problem. */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GrandmaWorld, SceneManifest, Strings, TIERS, checkParts, checkScene, checkWorld, computePassword, expandWorld, generateRecipes } from "../src/index.ts";

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
  const world = expandWorld(parsed.data);
  const problems = [...checkWorld(world), ...checkParts(world)];
  if (!world.recipes.length) problems.push("no notes: give the world recipes, or parts and tiers");
  problems.forEach((p) => fail(`grandmas/${file}: ${p}`));
  worlds.set(world.id, world);
  if (!problems.length) {
    if (world.parts?.length) {
      // The generator (docs/15): how many notes each tier gets, and which pairs were left out and why.
      const count = TIERS.map((t) => `${t} ${world.recipes.filter((r) => r.difficulty === t).length}`).join(", ");
      console.log(`✓ grandmas/${file} (${world.facts.length} facts; ${world.parts.length} parts → ${world.recipes.length} notes: ${count})`);
      if (process.argv.includes("--notes")) {
        for (const r of world.recipes) console.log(`    ${r.id} = ${computePassword(world, r)} · ${r.note_text}`);
        for (const r of generateRecipes(parsed.data).rejected) console.log(`    left out ${r.id}: ${r.why.join("; ")}`);
      }
    } else {
      const recipes = world.recipes.map((r) => `${r.id}=${computePassword(world, r)}`).join(", ");
      console.log(`✓ grandmas/${file} (${world.facts.length} facts; ${recipes})`);
    }
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
