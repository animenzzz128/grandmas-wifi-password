/** npm run schema: export the API contract and the scene manifest format as JSON Schema (for non-TS clients such as Godot). */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import * as api from "../src/api.ts";
import { PublicScene, SceneManifest } from "../src/scene.ts";

const out = join(dirname(fileURLToPath(import.meta.url)), "../../../data/schema");
const toSchema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input", unrepresentable: "any" });

const apiSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Grandma's Wi-Fi Password API contract",
  description: "Generated from packages/engine/src/api.ts by `npm run schema`. Do not edit by hand.",
  $defs: {
    CreateRunRequest: toSchema(api.CreateRunRequest),
    AskRequest: toSchema(api.AskRequest),
    ShowRequest: toSchema(api.ShowRequest),
    ItemRequest: toSchema(api.ItemRequest),
    GuessRequest: toSchema(api.GuessRequest),
    RunView: toSchema(api.RunView),
    AskResponse: toSchema(api.AskResponse),
    ItemResponse: toSchema(api.ItemResponse),
    GuessResponse: toSchema(api.GuessResponse),
    HealthResponse: toSchema(api.HealthResponse),
    ErrorResponse: toSchema(api.ErrorResponse),
    PublicScene: toSchema(PublicScene),
  },
};
writeFileSync(join(out, "api.schema.json"), JSON.stringify(apiSchema, null, 2) + "\n");
writeFileSync(
  join(out, "scene.schema.json"),
  JSON.stringify({ title: "Scene manifest", description: "Generated from packages/engine/src/scene.ts by `npm run schema`.", ...toSchema(SceneManifest) }, null, 2) + "\n",
);
console.log("wrote data/schema/api.schema.json and data/schema/scene.schema.json");
