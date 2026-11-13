/**
 * AI player agent (docs/04-evaluation-plan.md §4). An LLM plays through the same HTTP API as the web
 * client, seeing only what a human sees: the note, its rules, how many parts, the room's objects, what
 * Grandma says, and the inspect cards it chooses to read. It does NOT see the chain maps or facts.
 *
 *   npm run eval:player -- [--runs 3] [--recipes easy,medium,hard] [--grandma mock|llm] [--model claude-sonnet-5-5] [--yes]
 *
 * Output: questions-to-solve (median, IQR) and solve rate per difficulty, against the plan's targets.
 */
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { AskResponse, GuessResponse, PublicScene, RunView } from "@gwp/engine";
import { createApp } from "../../apps/server/src/app.ts";
import { REPO_ROOT, loadEnv, readConfig } from "../../apps/server/src/config.ts";
import { loadGameData } from "../../apps/server/src/data.ts";
import { LlmBrain, MockBrain } from "../../apps/server/src/grandma.ts";
import type { GrandmaBrain } from "../../apps/server/src/grandma.ts";
import { RunStore } from "../../apps/server/src/store.ts";
import { percentile } from "./metrics.ts";
import { MODELS, arg, realClient, stamp, structured } from "./llm.ts";
import type { ParseClient } from "./llm.ts";

export const Action = z.object({
  thought: z.string().describe("one or two sentences of private reasoning"),
  action: z.enum(["ask", "inspect", "show", "guess"]),
  text: z.string().optional().describe("for ask: the question to Grandma"),
  objectId: z.string().optional().describe("for inspect/show: an object id from the room list"),
  parts: z.array(z.string()).optional().describe("for guess: one entry per part of the note"),
});
export type Action = z.infer<typeof Action>;

export const PLAYER_SYSTEM = `You are playing "Grandma's Wi-Fi Password", a deduction game. Grandma's Wi-Fi password is a riddle on a sticky note made of her memories. Work it out by asking her questions and looking at objects in her living room, then enter it at the router.

Rules:
- Each question costs some of Grandma's tea. When it runs out she naps; after three naps the visit ends. Fewer questions is better.
- She never knows the password. Asking for it wastes tea.
- She answers one memory at a time and muddles which came first, so you have to connect events yourself (e.g. birth year + age = a year).
- "inspect" reads an object's description for free. "show" hands Grandma an object and costs tea like a question.
- "guess" enters one value per part of the note; capitals and spaces don't matter. You have 3 guesses, and a wrong one tells you how many parts were right.

Each turn, choose exactly one action. Keep your thought short.`;

export function stateForPlayer(run: RunView, scene: PublicScene, transcript: string[]): string {
  const objects = scene.interactables.filter((i) => i.kind === "clue" || i.kind === "cookie_jar").map((i) => `${i.id} (${i.label})`);
  return [
    `STICKY NOTE: "${run.note.text}"${run.note.rules.length ? ` (rules: ${run.note.rules.join(", ")})` : ""}`,
    `PARTS TO ENTER: ${run.slots}${run.suffix ? `, then the fixed ending "${run.suffix}"` : ""} · password length ${run.passwordLength}`,
    `TEA: ${run.stamina}/${run.maxStamina} · naps ${run.naps}/${run.maxNaps} · guesses left ${run.attemptsLeft} · questions so far ${run.questionCount}`,
    `OBJECTS IN THE ROOM: ${objects.join(", ")}`,
    `WHAT HAS HAPPENED SO FAR:\n${transcript.join("\n") || "(nothing yet)"}`,
  ].join("\n\n");
}

export interface PlayResult {
  recipe: string;
  solved: boolean;
  questions: number;
  naps: number;
  guesses: number;
  steps: number;
  tokens: { input: number; output: number };
}

/** Play one visit to the end. `app` is the real HTTP app (in-process); `client` drives the player. */
export async function playOnce(args: { app: ReturnType<typeof createApp>; client: ParseClient; model: string; difficulty: string; maxSteps?: number }): Promise<PlayResult> {
  const post = async (path: string, payload: unknown) => {
    const res = await args.app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    return JSON.parse(await res.text()) as unknown;
  };
  let run = RunView.parse(await post("/api/runs", { difficulty: args.difficulty }));
  const scene = PublicScene.parse(JSON.parse(await (await args.app.request(`/api/scenes/${run.sceneId}`)).text()));
  const transcript = [`Grandma: ${run.greeting}`];
  const tokens = { input: 0, output: 0 };
  let guesses = 0;
  let steps = 0;
  for (; steps < (args.maxSteps ?? 50) && run.status === "playing"; steps++) {
    const { output: a, usage } = await structured(args.client, { model: args.model, system: PLAYER_SYSTEM, user: stateForPlayer(run, scene, transcript), schema: Action, effort: "low" });
    tokens.input += usage.input;
    tokens.output += usage.output;
    if (!a) break;
    if (a.action === "ask" && a.text) {
      const r = AskResponse.parse(await post(`/api/runs/${run.runId}/ask`, { text: a.text.slice(0, 280) }));
      transcript.push(`You asked: ${a.text}`, `Grandma: ${r.reply}`, ...(r.after ? [`Grandma: ${r.after}`] : []), ...(r.nudge ? [`Grandma: ${r.nudge}`] : []));
      run = r.run;
    } else if (a.action === "inspect" && a.objectId) {
      const obj = scene.interactables.find((i) => i.id === a.objectId);
      transcript.push(obj ? `You looked at the ${obj.label}: ${obj.inspect_text ?? "nothing special"}` : `There is no object "${a.objectId}".`);
    } else if (a.action === "show" && a.objectId) {
      const raw = await post(`/api/runs/${run.runId}/show`, { objectId: a.objectId });
      const r = AskResponse.safeParse(raw);
      if (r.success) {
        transcript.push(`You showed Grandma the ${a.objectId}.`, `Grandma: ${r.data.reply}`);
        run = r.data.run;
      } else transcript.push(`You can't show "${a.objectId}".`);
    } else if (a.action === "guess" && a.parts?.length) {
      guesses++;
      const r = GuessResponse.parse(await post(`/api/runs/${run.runId}/guess`, { parts: a.parts }));
      transcript.push(`You entered: ${a.parts.join(" + ")} → ${r.correct ? "connected!" : `wrong (${r.partsCorrect ?? 0} of ${r.partsTotal ?? run.slots} parts right)`}`, `Grandma: ${r.line}`);
      run = r.run;
    } else {
      transcript.push("(That action was missing what it needed.)");
    }
  }
  return { recipe: args.difficulty, solved: run.status === "solved", questions: run.questionCount, naps: run.naps, guesses, steps, tokens };
}

export function summarizePlays(results: PlayResult[]) {
  const by = new Map<string, PlayResult[]>();
  for (const r of results) by.set(r.recipe, [...(by.get(r.recipe) ?? []), r]);
  return [...by.entries()].map(([recipe, rs]) => {
    const solved = rs.filter((r) => r.solved);
    const q = solved.map((r) => r.questions);
    return {
      recipe,
      runs: rs.length,
      solveRate: solved.length / rs.length,
      median: percentile(q, 50),
      q1: percentile(q, 25),
      q3: percentile(q, 75),
      tokens: rs.reduce((s, r) => s + r.tokens.input + r.tokens.output, 0),
    };
  });
}

const TARGETS: Record<string, string> = { easy: "4–10", medium: "6–14", hard: "8–18" };

async function main() {
  const runs = Number(arg("runs", "3"));
  const difficulties = arg("recipes", "easy,medium,hard").split(",");
  const model = arg("model", MODELS.player);
  const grandma = arg("grandma", "mock");
  const steps = runs * difficulties.length;
  console.log(`AI player ${model} vs ${grandma} Grandma: ${runs} runs × ${difficulties.length} difficulties (up to ~50 player calls per run${grandma === "llm" ? ", plus Grandma's" : ""}).`);
  if (!process.argv.includes("--yes")) {
    console.log("This calls Claude and costs money. Re-run with --yes to go ahead.");
    return;
  }
  const data = loadGameData(join(REPO_ROOT, "data"));
  const config = readConfig({}, loadEnv());
  const brain: GrandmaBrain = grandma === "llm" && config.apiKey ? new LlmBrain(config.grandmaModel, { apiKey: config.apiKey, baseURL: config.apiBaseUrl }) : new MockBrain();
  const client = realClient();
  const results: PlayResult[] = [];
  for (const d of difficulties) {
    for (let i = 0; i < runs; i++) {
      const app = createApp({ data, brain, store: new RunStore(null), asksPerMinute: 10_000, asksPerDay: 100_000, runsPerMinute: 10_000 });
      results.push(await playOnce({ app, client, model, difficulty: d }));
      process.stdout.write(results.at(-1)!.solved ? "✓" : "✗");
    }
  }
  console.log(` (${steps} runs)`);
  const rows = summarizePlays(results);
  const fmt = (x: number | null) => (x === null ? "n/a" : String(x));
  const md = [
    `# AI player: ${model} vs ${grandma} Grandma (${stamp()})`,
    "| Difficulty | Runs | Solved | Questions to solve: median [IQR] | Target (eval plan §2) | Tokens |",
    "|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.recipe} | ${r.runs} | ${(r.solveRate * 100).toFixed(0)}% | ${fmt(r.median)} [${fmt(r.q1)}–${fmt(r.q3)}] | ${TARGETS[r.recipe] ?? "?"} | ${r.tokens} |`),
    "",
    "Solve-rate target: 60–85% per difficulty band. Use this to set `par` per recipe and as the solvability gate.",
  ].join("\n");
  mkdirSync(join(REPO_ROOT, "eval/reports"), { recursive: true });
  const file = join(REPO_ROOT, "eval/reports", `${stamp()}-player.md`);
  writeFileSync(file, md + "\n");
  console.log(`Report: ${file}`);
}

if (process.argv[1]?.endsWith("player.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
