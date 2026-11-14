/**
 * Play stats from the server's turn logs (technical design §9 telemetry; roadmap 03 §6 cost dashboard).
 * Reads var/logs/turns-*.jsonl, as written during real play (human playtests or a deployed game), and
 * reports aggregates only: outcomes and questions-to-solve per puzzle (balancing and par), model spend,
 * latency, validator retries and fallbacks. It never prints what players typed or what Grandma said.
 *
 *   npm run stats                         # all days in var/logs
 *   npm run stats -- --since 2026-11-20   # from a day on
 *   npm run stats -- --out eval/reports/playtest-1.md
 *   fly ssh console -C "npm run stats"     # on Fly (VAR_DIR=/data)
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RULES, parseWorld } from "@gwp/engine";
import type { Difficulty } from "@gwp/engine";
import { percentile } from "./metrics.ts";

export interface LogEntry {
  ts: string;
  runId: string;
  worldId: string;
  recipeId: string;
  kind: "ask" | "show" | "item" | "guess";
  status: string;
  grandmaMode?: string;
  latencyMs?: number;
  attempts?: number;
  validatorErrors?: string[];
  fallback?: boolean;
  usage?: { input: number; output: number; cacheRead: number; cacheWrite: number };
  costUsd?: number;
  daily?: number;
}

export interface PuzzleStats {
  key: string;
  runs: number;
  solved: number;
  failed: number;
  bedtime: number;
  unfinished: number;
  /** Questions (ask and show turns) in solved runs. */
  questionsToSolve: number[];
  /** The par the game uses today (recipe par, or the difficulty default); undefined if the puzzle is unknown. */
  par?: number;
}

export interface PlayStats {
  days: string[];
  runs: number;
  turns: number;
  modes: Record<string, number>;
  puzzles: PuzzleStats[];
  dailies: { number: number; runs: number; solved: number }[];
  model: {
    turns: number;
    spendUsd: number;
    p50: number | null;
    p95: number | null;
    retryRate: number;
    fallbackRate: number;
    /** Share of input tokens served from the prompt cache. */
    cacheShare: number | null;
    topErrors: [string, number][];
  };
}

/** Parse JSONL text; torn or foreign lines are skipped. */
export function parseLog(text: string): LogEntry[] {
  const out: LogEntry[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as LogEntry;
      if (e && typeof e.runId === "string" && typeof e.kind === "string") out.push(e);
    } catch {
      // a torn last line after a crash
    }
  }
  return out;
}

/** "reply mentions 1958, which isn't…" → "reply mentions <n>, which isn't…": group errors by type, not value. */
const errorType = (e: string) =>
  e
    .replace(/^attempt \d+: /, "")
    .replace(/"[^"]*"|'[^']*'/g, "…")
    .replace(/\b\d+\b/g, "<n>")
    .slice(0, 80);

/** Puzzle key ("rosie/r_easy") -> par in use, from the worlds in data/. */
export type ParOf = (key: string) => number | undefined;

export function playStats(entries: readonly LogEntry[], parOf: ParOf = () => undefined): PlayStats {
  const sorted = [...entries].sort((a, b) => a.ts.localeCompare(b.ts));
  const days = [...new Set(sorted.map((e) => e.ts.slice(0, 10)))];
  const runs = new Map<string, { key: string; status: string; questions: number; daily?: number }>();
  const modes: Record<string, number> = {};
  let turns = 0;
  const model = sorted.filter((e) => (e.kind === "ask" || e.kind === "show") && e.grandmaMode === "llm");
  for (const e of sorted) {
    const r = runs.get(e.runId) ?? { key: `${e.worldId}/${e.recipeId}`, status: "playing", questions: 0, daily: e.daily };
    r.status = e.status;
    if (e.kind === "ask" || e.kind === "show") {
      r.questions++;
      turns++;
      if (e.grandmaMode) modes[e.grandmaMode] = (modes[e.grandmaMode] ?? 0) + 1;
    }
    runs.set(e.runId, r);
  }

  const byPuzzle = new Map<string, PuzzleStats>();
  const byDaily = new Map<number, { number: number; runs: number; solved: number }>();
  for (const r of runs.values()) {
    const p = byPuzzle.get(r.key) ?? { key: r.key, runs: 0, solved: 0, failed: 0, bedtime: 0, unfinished: 0, questionsToSolve: [], par: parOf(r.key) };
    p.runs++;
    if (r.status === "solved") {
      p.solved++;
      p.questionsToSolve.push(r.questions);
    } else if (r.status === "failed") p.failed++;
    else if (r.status === "bedtime") p.bedtime++;
    else p.unfinished++;
    byPuzzle.set(r.key, p);
    if (r.daily) {
      const d = byDaily.get(r.daily) ?? { number: r.daily, runs: 0, solved: 0 };
      d.runs++;
      if (r.status === "solved") d.solved++;
      byDaily.set(r.daily, d);
    }
  }

  const errors = new Map<string, number>();
  for (const e of model) for (const err of e.validatorErrors ?? []) errors.set(errorType(err), (errors.get(errorType(err)) ?? 0) + 1);
  const input = model.reduce((s, e) => s + (e.usage?.input ?? 0), 0);
  const cached = model.reduce((s, e) => s + (e.usage?.cacheRead ?? 0), 0);
  return {
    days,
    runs: runs.size,
    turns,
    modes,
    puzzles: [...byPuzzle.values()].sort((a, b) => a.key.localeCompare(b.key)),
    dailies: [...byDaily.values()].sort((a, b) => a.number - b.number),
    model: {
      turns: model.length,
      spendUsd: sorted.reduce((s, e) => s + (e.costUsd ?? 0), 0),
      p50: percentile(model.flatMap((e) => (e.latencyMs === undefined ? [] : [e.latencyMs])), 50),
      p95: percentile(model.flatMap((e) => (e.latencyMs === undefined ? [] : [e.latencyMs])), 95),
      retryRate: model.length ? model.filter((e) => (e.attempts ?? 1) > 1).length / model.length : 0,
      fallbackRate: model.length ? model.filter((e) => e.fallback).length / model.length : 0,
      cacheShare: input + cached ? cached / (input + cached) : null,
      topErrors: [...errors].sort((a, b) => b[1] - a[1]).slice(0, 5),
    },
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const med = (xs: number[]) => percentile(xs, 50);

export function renderPlayStats(s: PlayStats): string {
  const out: string[] = [];
  out.push(`# Play stats (${s.days.length ? `${s.days[0]} to ${s.days.at(-1)}` : "no logs"})`, "");
  out.push(`Aggregates from the server's turn logs. No player text or Grandma replies are included.`, "");
  out.push(`- Visits: ${s.runs} · questions: ${s.turns} · Grandma mode: ${Object.entries(s.modes).map(([m, n]) => `${m} ${n}`).join(", ") || "—"}`, "");
  out.push("## Puzzles (balancing and par)", "");
  out.push("| Puzzle | Visits | Solved | Out of guesses | Bedtime | Unfinished | Median questions to solve | Par now |", "|---|---|---|---|---|---|---|---|");
  for (const p of s.puzzles) {
    out.push(`| ${p.key} | ${p.runs} | ${p.solved} (${pct(p.runs ? p.solved / p.runs : 0)}) | ${p.failed} | ${p.bedtime} | ${p.unfinished} | ${med(p.questionsToSolve) ?? "—"} | ${p.par ?? "—"} |`);
  }
  out.push("", "Questions count every ask and show turn, including free ones (mishears, \"pardon?\"). Unfinished visits include players who just left.", "");
  if (s.dailies.length) {
    out.push("## Daily Grandma", "", "| # | Visits | Solved |", "|---|---|---|");
    for (const d of s.dailies) out.push(`| ${d.number} | ${d.runs} | ${d.solved} |`);
    out.push("");
  }
  out.push("## Real Grandma (model turns only)", "");
  if (!s.model.turns) out.push("No model turns in these logs (offline Grandma only), so there is no cost or latency to report.");
  else {
    out.push(
      `| Metric | Value |`,
      `|---|---|`,
      `| Model turns | ${s.model.turns} |`,
      `| Spend (list prices) | $${s.model.spendUsd.toFixed(4)} ($${(s.model.spendUsd / s.model.turns).toFixed(5)} per turn) |`,
      `| Latency p50 / p95 | ${s.model.p50 ?? "—"} ms / ${s.model.p95 ?? "—"} ms |`,
      `| Validator retry rate | ${pct(s.model.retryRate)} |`,
      `| Fallback rate | ${pct(s.model.fallbackRate)} |`,
      `| Prompt-cache share of input | ${s.model.cacheShare === null ? "—" : pct(s.model.cacheShare)} |`,
    );
    if (s.model.topErrors.length) {
      out.push("", "Most common validator rejections:", "");
      for (const [e, n] of s.model.topErrors) out.push(`- ${n}× ${e}`);
    }
  }
  return out.join("\n") + "\n";
}

/** Par in use for every puzzle in a grandmas/ folder. */
export function parsFromData(dir: string): ParOf {
  const pars = new Map<string, number>();
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
      const w = parseWorld(JSON.parse(readFileSync(join(dir, f), "utf8")));
      for (const r of w.recipes) pars.set(`${w.id}/${r.id}`, r.par ?? RULES.defaultPar[r.difficulty as Difficulty]);
    }
  }
  return (key) => pars.get(key);
}

export function readLogs(dir: string, since?: string): LogEntry[] {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((f) => /^turns-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
    .filter((f) => !since || f.slice(6, 16) >= since)
    .sort();
  return files.flatMap((f) => parseLog(readFileSync(join(dir, f), "utf8")));
}

if (process.argv[1]?.endsWith("playstats.ts")) {
  const arg = (name: string) => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  // Same place the server writes: $VAR_DIR/logs (/data/logs on Fly), else ./var/logs.
  const dir = arg("--dir") ?? join(process.env.VAR_DIR ?? join(process.cwd(), "var"), "logs");
  const report = renderPlayStats(playStats(readLogs(dir, arg("--since")), parsFromData(join(process.cwd(), "data", "grandmas"))));
  const out = arg("--out");
  if (out) {
    writeFileSync(out, report);
    console.log(`wrote ${out}`);
  } else process.stdout.write(report);
}
