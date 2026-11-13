/**
 * Copies the models we use from the extracted CC0 packs into apps/web/public/models.
 * Only needed to update or add art; the copied files are already in the repo. Sources: CREDITS.md.
 *
 * usage: node tools/import-assets.mjs <kaykit-dir> <kenney-dir> <quaternius-dir>
 *   kaykit-dir      the unzipped "KayKit_Furniture_Bits_1.0_FREE" folder
 *   kenney-dir      the unzipped Kenney "Furniture Kit" folder (has Models/ and License.txt)
 *   quaternius-dir  the unzipped "Universal Base Characters[Standard]" folder
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const [kaykitDir, kenneyDir, quaterniusDir] = process.argv.slice(2);
if (!quaterniusDir) {
  console.error("usage: node tools/import-assets.mjs <kaykit-dir> <kenney-dir> <quaternius-dir>");
  process.exit(1);
}
const out = fileURLToPath(new URL("../apps/web/public/models/", import.meta.url));

// --- KayKit Furniture Bits (gltf + bin + one shared texture) ---
const kk = join(kaykitDir, "Assets/gltf");
const kkOut = join(out, "kaykit");
mkdirSync(kkOut, { recursive: true });
const kayKit = [
  "armchair_pillows", "couch_pillows", "table_low", "cabinet_medium", "lamp_standing", "lamp_table",
  "rug_rectangle_stripes_A", "book_single", "book_set", "pictureframe_standing_A", "pictureframe_large_A",
  "pictureframe_small_B", "pillow_A", "cactus_small_A", "shelf_B_small",
];
for (const n of kayKit) {
  const g = JSON.parse(readFileSync(join(kk, `${n}.gltf`), "utf8"));
  for (const b of g.buffers) cpSync(join(kk, b.uri), join(kkOut, b.uri));
  for (const i of g.images ?? []) cpSync(join(kk, i.uri), join(kkOut, i.uri));
  cpSync(join(kk, `${n}.gltf`), join(kkOut, `${n}.gltf`));
}

// --- Kenney Furniture Kit (self-contained glb) ---
const ke = join(kenneyDir, "Models/GLTF format");
const keOut = join(out, "kenney");
mkdirSync(keOut, { recursive: true });
for (const n of [
  "kitchenFridge", "televisionVintage", "cabinetTelevision", "kitchenCabinet", "kitchenCabinetDrawer",
  "kitchenCabinetUpper", "pottedPlant", "radio", "plantSmall2", "coatRackStanding", "rugDoormat", "lampSquareCeiling",
]) cpSync(join(ke, `${n}.glb`), join(keOut, `${n}.glb`));

// --- Quaternius Universal Base Characters: female base + parted hairstyle ---
const q = quaterniusDir;
const qOut = join(out, "quaternius");
mkdirSync(qOut, { recursive: true });

/** Keep only base-color textures (smaller download, simpler look) and point them at files we copy. */
function slim(srcGltf, srcDir, name, colorMap) {
  const g = JSON.parse(readFileSync(srcGltf, "utf8"));
  for (const m of g.materials ?? []) {
    delete m.normalTexture;
    delete m.occlusionTexture;
    if (m.pbrMetallicRoughness) delete m.pbrMetallicRoughness.metallicRoughnessTexture;
  }
  const used = new Set();
  for (const m of g.materials ?? []) {
    const t = m.pbrMetallicRoughness?.baseColorTexture;
    if (t) used.add(g.textures[t.index].source);
  }
  for (const [idx, img] of (g.images ?? []).entries()) {
    if (!used.has(idx)) {
      img.uri = "unused.png"; // never fetched: no texture points at it
      continue;
    }
    const file = colorMap[img.uri] ?? img.uri;
    const src = [join(srcDir, file), join(q, "Base Characters/Textures", file), join(q, "Hairstyles/Textures", file)].find(existsSync);
    if (!src) throw new Error(`missing texture ${file}`);
    cpSync(src, join(qOut, file));
    img.uri = file;
  }
  // Drop the unused image entries' textures cleanly: re-index is unnecessary because nothing references them.
  for (const b of g.buffers) {
    const bin = `${name}.bin`;
    cpSync(join(srcDir, b.uri), join(qOut, bin));
    b.uri = bin;
  }
  writeFileSync(join(qOut, `${name}.gltf`), JSON.stringify(g));
}

const bodyDir = join(q, "Base Characters/Godot - UE");
slim(join(bodyDir, "Superhero_Female_FullBody.gltf"), bodyDir, "grandma_body", {
  "T_Superhero_Female_Dark_BaseColor.png": "T_Superhero_Female_Light_BaseColor.png",
});
const hairDir = join(q, "Hairstyles/Origin at 0/glTF (Godot)");
slim(join(hairDir, "Hair_SimpleParted.gltf"), hairDir, "hair_parted", {});
console.log("done");
