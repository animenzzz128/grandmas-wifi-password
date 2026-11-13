import { existsSync } from "node:fs";
import { relative } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApp } from "./app.ts";
import { loadEnv, readConfig } from "./config.ts";
import { loadGameData } from "./data.ts";
import { LlmBrain, MockBrain } from "./grandma.ts";
import { RunStore } from "./store.ts";

const dotenv = loadEnv();
const config = readConfig(process.env, dotenv, process.argv);
const data = loadGameData(config.dataDir);
const brain = config.grandmaMode === "llm" ? new LlmBrain(config.grandmaModel, { apiKey: config.apiKey!, baseURL: config.apiBaseUrl }) : new MockBrain();
const store = new RunStore(config.varDir);
const app = createApp({ data, brain, store, asksPerMinute: config.asksPerMinute });

// In production the server also serves the built web client (npm run build first).
if (existsSync(config.webDist)) {
  const root = relative(process.cwd(), config.webDist);
  app.use("/*", serveStatic({ root }));
  app.get("/*", serveStatic({ root, path: "index.html" }));
}

serve({ fetch: app.fetch, port: config.port }, (info) => {
  const mode = brain.mode === "llm" ? `LLM (${config.grandmaModel})` : "MOCK (no API key found; set ANTHROPIC_API_KEY in .env for the real Grandma)";
  console.log(`Grandma's server on http://localhost:${info.port}  ·  Grandma: ${mode}`);
  console.log(`Loaded ${data.worlds.size} Grandma(s), ${data.scenes.size} scene(s). Runs and logs in ${config.varDir}`);
});
