/**
 * Golden transcripts (technical design §11): recorded conversations replayed against the validator, so
 * any change to its rules shows up as a diff instead of silently letting leaks through (or blocking
 * good replies).
 *
 * - `npm run eval:golden` replays eval/data/golden.v1.json and reports mismatches (also run by Vitest).
 * - `npm run eval:golden -- --record` re-records: mock conversations are regenerated, and every turn's
 *   expected validator errors are recomputed. Review the diff before committing it.
 *
 * Two kinds of transcript:
 * - "mock": Grandma's replies come from the deterministic mock brain, over questions from the Q-bank.
 * - "handwritten": replies written by hand to probe the validator (leaks, invented names, hidden years,
 *   joined chain links, contradictions). Each such turn says what the validator must do (`must`).
 * LLM transcripts can be added once the course key is in .env (source "llm"; record them from logs).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mockGrandmaReply, recipeById, validateReply, validationContext } from "@gwp/engine";
import type { GrandmaOutput, GrandmaWorld } from "@gwp/engine";

export interface GoldenTurn {
  player: string;
  grandma: GrandmaOutput;
  /** The validator's errors when recorded ([] = the reply passes). */
  errors: string[];
  /** Handwritten intent: "pass", or a regex the joined errors must match. */
  must?: string;
}

export interface GoldenTranscript {
  id: string;
  recipeId: string;
  source: "mock" | "handwritten" | "llm";
  turns: GoldenTurn[];
}

export interface GoldenFile {
  version: string;
  notes: string;
  /** Fixed "today" so the plausibility checks don't drift with the calendar. */
  currentYear: number;
  transcripts: GoldenTranscript[];
}

export interface Mismatch {
  id: string;
  turn: number;
  problem: string;
}

export function validate(world: GrandmaWorld, recipeId: string, out: GrandmaOutput, currentYear: number): string[] {
  const recipe = recipeById(world, recipeId);
  if (!recipe) return [`unknown recipe ${recipeId}`];
  return validateReply(world, out, validationContext(world, recipe, currentYear));
}

/** Replay every transcript; empty means the validator still behaves exactly as recorded. */
export function replayGolden(file: GoldenFile, world: GrandmaWorld): Mismatch[] {
  const out: Mismatch[] = [];
  for (const t of file.transcripts) {
    t.turns.forEach((turn, i) => {
      const got = validate(world, t.recipeId, turn.grandma, file.currentYear);
      if (JSON.stringify(got) !== JSON.stringify(turn.errors)) {
        out.push({ id: t.id, turn: i, problem: `errors changed: recorded ${JSON.stringify(turn.errors)}, now ${JSON.stringify(got)}` });
      }
      if (turn.must === "pass" && got.length) out.push({ id: t.id, turn: i, problem: `must pass, but: ${got.join("; ")}` });
      else if (turn.must && turn.must !== "pass" && !new RegExp(turn.must, "i").test(got.join(" | "))) {
        out.push({ id: t.id, turn: i, problem: `must be flagged /${turn.must}/, but got ${JSON.stringify(got)}` });
      }
    });
  }
  return out;
}

/** Deterministic mock conversations: each takes a run of Q-bank questions against one recipe. */
export function recordMock(world: GrandmaWorld, questions: readonly string[], perTranscript: number, count: number): GoldenTranscript[] {
  const recipes = world.recipes;
  const out: GoldenTranscript[] = [];
  for (let n = 0; n < count; n++) {
    const recipe = recipes[n % recipes.length]!;
    const turns: GoldenTurn[] = [];
    let recent: string[] = [];
    for (let k = 0; k < perTranscript; k++) {
      const player = questions[(n * perTranscript + k) % questions.length]!;
      const grandma = mockGrandmaReply({ world, recipe, input: { kind: "ask", text: player }, seed: `golden-${n}:${k}`, recentFactIds: recent });
      if (grandma.fact_ids_used.length) recent = grandma.fact_ids_used;
      turns.push({ player, grandma, errors: [] });
    }
    out.push({ id: `mock-${String(n + 1).padStart(2, "0")}-${recipe.difficulty}`, recipeId: recipe.id, source: "mock", turns });
  }
  return out;
}

/** Recompute every turn's recorded errors (after a deliberate validator change, or for new turns). */
export function rerecord(file: GoldenFile, world: GrandmaWorld): GoldenFile {
  return {
    ...file,
    transcripts: file.transcripts.map((t) => ({ ...t, turns: t.turns.map((turn) => ({ ...turn, errors: validate(world, t.recipeId, turn.grandma, file.currentYear) })) })),
  };
}

// ---- CLI ----
const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("eval/src/golden.ts");
if (isMain) {
  const { loadGameData } = await import("../../apps/server/src/data.ts");
  const { REPO_ROOT } = await import("../../apps/server/src/config.ts");
  const path = join(REPO_ROOT, "eval/data/golden.v1.json");
  const world = loadGameData(join(REPO_ROOT, "data")).worlds.get("rosie")!;
  const file = JSON.parse(readFileSync(path, "utf8")) as GoldenFile;
  if (process.argv.includes("--record")) {
    const questions = (JSON.parse(readFileSync(join(REPO_ROOT, "eval/data/rosie-qbank.v1.json"), "utf8")) as { items: { text: string }[] }).items.map((q) => q.text);
    const handwritten = file.transcripts.filter((t) => t.source !== "mock");
    const next = rerecord({ ...file, transcripts: [...recordMock(world, questions, 5, 14), ...handwritten] }, world);
    writeFileSync(path, JSON.stringify(next, null, 2) + "\n");
    const flagged = next.transcripts.flatMap((t) => t.turns).filter((t) => t.errors.length).length;
    console.log(`recorded ${next.transcripts.length} transcripts (${flagged} flagged turns) → ${path}`);
  }
  const mismatches = replayGolden(JSON.parse(readFileSync(path, "utf8")) as GoldenFile, world);
  for (const m of mismatches) console.log(`✗ ${m.id} turn ${m.turn}: ${m.problem}`);
  console.log(mismatches.length ? `${mismatches.length} mismatches` : "golden transcripts: all match");
  process.exitCode = mismatches.length ? 1 : 0;
}
