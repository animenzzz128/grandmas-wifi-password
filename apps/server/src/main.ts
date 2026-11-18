import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApp } from "./app.ts";
import { loadEnv, readConfig } from "./config.ts";
import { loadGameData } from "./data.ts";
import { LlmBrain, MockBrain } from "./grandma.ts";
import { BudgetBrain } from "./budget.ts";
import { RunStore } from "./store.ts";
import { GrandmaVoice } from "./voice.ts";

const dotenv = loadEnv();
const config = readConfig(process.env, dotenv, process.argv);
const data = loadGameData(config.dataDir);
// The LLM Grandma sits behind a daily budget and a kill-switch file; past either, the offline Grandma answers.
const brain =
  config.grandmaMode === "llm"
    ? new BudgetBrain(new LlmBrain(config.grandmaModel, { apiKey: config.apiKey!, baseURL: config.apiBaseUrl, provider: config.provider }), new MockBrain(), {
        dailyUsd: config.dailyBudgetUsd,
        killFile: join(config.varDir, "KILL"),
        logDir: join(config.varDir, "logs"),
      })
    : new MockBrain();
const store = new RunStore(config.varDir);
const voice = config.voice ? new GrandmaVoice({ ...config.voice, cacheDir: join(config.varDir, "voice") }) : undefined;
const app = createApp({ data, brain, store, voice, asksPerMinute: config.asksPerMinute, embedOrigins: config.embedOrigins });

// In production the server also serves the built web client (npm run build first).
if (existsSync(config.webDist)) {
  const root = relative(process.cwd(), config.webDist);
  app.use("/*", serveStatic({ root }));
  app.get("/*", serveStatic({ root, path: "index.html" }));
}

serve({ fetch: app.fetch, port: config.port }, (info) => {
  const mode = brain.mode === "llm" ? `LLM (${config.grandmaModel}${config.provider === "openrouter" ? " via OpenRouter" : ""})` : "MOCK (no API key found; set OPENROUTER_API_KEY or ANTHROPIC_API_KEY in .env for the real Grandma)";
  console.log(`Grandma's server on http://localhost:${info.port}  ·  Grandma: ${mode}`);
  if (brain instanceof BudgetBrain) console.log(`Daily model budget: ${config.dailyBudgetUsd.toFixed(2)} (spent today: ${brain.spentToday.toFixed(4)}). Kill switch: create ${join(config.varDir, "KILL")}`);
  console.log(voice ? `Grandma's voice: ElevenLabs (${config.voice!.model}), up to ${config.voice!.dailyChars} characters a day; lines cached in ${join(config.varDir, "voice")}` : "Grandma's voice: the browser's own (set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in .env for hers)");
  console.log(`Loaded ${data.worlds.size} Grandma(s), ${data.scenes.size} scene(s). Runs and logs in ${config.varDir}`);
  // On Windows another program can hold the same port on 127.0.0.1 while this server gets [::]; then the dev
  // proxy reaches that program and the game sees "Not found." (iteration 53). Say so instead of failing quietly.
  void fetch(`http://127.0.0.1:${info.port}/api/health`)
    .then(async (res) => ((await res.json().catch(() => null)) as { grandmaMode?: string } | null)?.grandmaMode)
    .catch(() => undefined)
    .then((mode) => {
      if (!mode) console.warn(`
!! Something else answers on 127.0.0.1:${info.port}. Set API_PORT to a free port in .env (e.g. API_PORT=8788) and restart.
`);
    });
});
