/**
 * npm run chat [-- easy|medium|hard]: play a run in the terminal through the real API code path.
 * Commands: /show <objectId>, /cookie, /guess <password>, /note, /objects, /quit.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createApp } from "../src/app.ts";
import { loadEnv, readConfig } from "../src/config.ts";
import { loadGameData } from "../src/data.ts";
import { LlmBrain, MockBrain } from "../src/grandma.ts";
import type { GrandmaBrain } from "../src/grandma.ts";
import { RunStore } from "../src/store.ts";
import type { AskResponse, GuessResponse, ItemResponse, RunView } from "@gwp/engine";

const dotenv = loadEnv();
const config = readConfig(process.env, dotenv, process.argv);
const data = loadGameData(config.dataDir);
const brain: GrandmaBrain = config.grandmaMode === "llm" ? new LlmBrain(config.grandmaModel, { apiKey: config.apiKey!, baseURL: config.apiBaseUrl, provider: config.provider }) : new MockBrain();
const app = createApp({ data, brain, store: new RunStore(config.varDir), asksPerMinute: 1000 });

const call = async <T>(path: string, payload: unknown): Promise<T> => {
  const res = await app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? res.statusText);
  return json;
};

const difficulty = (process.argv[2] ?? "easy") as "easy" | "medium" | "hard";
let run = await call<RunView>("/api/runs", { difficulty });
const scene = data.scenes.get(run.sceneId)!;
const tea = (r: RunView) => `[tea ${r.stamina}/${r.maxStamina} · naps ${r.naps} · questions ${r.questionCount} · attempts ${r.attemptsLeft} · cookies ${r.cookies}]`;

console.log(`Grandma mode: ${brain.mode}${brain.model ? ` (${brain.model})` : ""} · difficulty: ${run.difficulty}`);
console.log(`Sticky note: "${run.note.text}" (${run.note.rules.join(", ")}; ${run.passwordLength} characters)`);
console.log(`\nGrandma: ${run.greeting}\n${tea(run)}`);

const rl = createInterface({ input: stdin, output: stdout, prompt: "\nYou: " });
rl.prompt();
// Line iteration (not rl.question) so piped input works too, e.g. scripted test sessions.
for await (const raw of rl) {
  const line = raw.trim();
  if (!stdin.isTTY) console.log(line);
  if (!line) {
    rl.prompt();
    continue;
  }
  try {
    if (line === "/quit") break;
    if (line === "/note") {
      console.log(`"${run.note.text}"`);
      rl.prompt();
      continue;
    }
    if (line === "/objects") {
      for (const o of scene.interactables.filter((i) => i.kind === "clue")) console.log(`- ${o.id}: ${o.inspect_text}`);
      rl.prompt();
      continue;
    }
    if (line === "/cookie") {
      const r = await call<ItemResponse>(`/api/runs/${run.runId}/item`, { item: "cookie" });
      run = r.run;
      console.log(`Grandma: ${r.line}\n${tea(run)}`);
    } else if (line.startsWith("/guess ")) {
      const r = await call<GuessResponse>(`/api/runs/${run.runId}/guess`, { password: line.slice(7) });
      run = r.run;
      console.log(`${r.correct ? "✅ Connected!" : "❌ Wrong."} Grandma: ${r.line}\n${tea(run)}`);
    } else {
      const r = line.startsWith("/show ")
        ? await call<AskResponse>(`/api/runs/${run.runId}/show`, { objectId: line.slice(6).trim() })
        : await call<AskResponse>(`/api/runs/${run.runId}/ask`, { text: line });
      run = r.run;
      console.log(`Grandma (${r.mood}): ${r.reply}${r.after ? `\n${r.after}` : ""}\n−${r.cost} tea ${tea(run)}`);
    }
  } catch (e) {
    console.log(`(${(e as Error).message})`);
  }
  if (run.status !== "playing") break;
  rl.prompt();
}
if (run.result) console.log(`\nResult: ${run.result.solved ? "solved" : "not solved"} · ${"⭐".repeat(run.result.stars)} · password ${run.result.password}`);
rl.close();
