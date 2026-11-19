/**
 * Play stats from the server's turn logs (technical design §9 telemetry; roadmap 03 §6 cost dashboard). Pure: the
 * server's /admin dashboard and `npm run stats` (eval/src/playstats.ts, which reads the files) both use it.
 * Aggregates only: it never returns what players typed or what Grandma said.
 */

/** Nearest-rank percentile; null for no values. */
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
}

/** The tier of a note id: "easy:sock_thief+wedding_year" and the old "r_easy_2" are both "easy". */
export function tierOfNote(recipeId: string): string {
  const m = /^(?:r_)?(easy|medium|hard|expert)(?![a-z])/.exec(recipeId);
  return m ? m[1]! : "other";
}

export interface LogEntry {
  ts: string;
  runId: string;
  worldId: string;
  recipeId: string;
  kind: "ask" | "show" | "item" | "guess" | "start" | "event";
  status: string;
  /** For kind "event": what the player did (a name, never text), and on which object. */
  event?: string;
  objectId?: string;
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

/** The play funnel (design plan E3): of the visits that started, how many reached each step. */
export interface Funnel {
  visits: number;
  steps: { step: string; visits: number }[];
  /** Median seconds from the start of a visit to its first question. */
  secondsToFirstQuestion: number | null;
  /** Share of visits that looked at each object (which clues get found). */
  objects: { objectId: string; visits: number }[];
}

/** Visits per UTC day (by the day each visit started). */
export interface DayStats {
  day: string;
  visits: number;
  solved: number;
  questions: number;
  spendUsd: number;
}

/** Outcomes per difficulty tier (docs/15: notes are drawn per tier, so this is the balancing view). */
export interface TierStats {
  tier: string;
  runs: number;
  solved: number;
  questionsToSolve: number[];
}

export interface PlayStats {
  funnel: Funnel;
  byDay: DayStats[];
  tiers: TierStats[];
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
  const runs = new Map<string, { key: string; status: string; questions: number; daily?: number; started?: string; firstQuestion?: string; did: Set<string>; objects: Set<string> }>();
  const modes: Record<string, number> = {};
  let turns = 0;
  const model = sorted.filter((e) => (e.kind === "ask" || e.kind === "show") && e.grandmaMode === "llm");
  for (const e of sorted) {
    const r = runs.get(e.runId) ?? { key: `${e.worldId}/${e.recipeId}`, status: "playing", questions: 0, daily: e.daily, did: new Set<string>(), objects: new Set<string>() };
    r.status = e.status;
    if (e.kind === "start") r.started ??= e.ts;
    if ((e.kind === "ask" || e.kind === "show") && !r.firstQuestion) r.firstQuestion = e.ts;
    if (e.kind === "ask" || e.kind === "show") r.did.add("asked");
    if (e.kind === "guess") r.did.add("guessed");
    if (e.kind === "event" && e.event) r.did.add(e.event);
    if (e.kind === "event" && e.event === "inspect" && e.objectId) r.objects.add(e.objectId);
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

  // The funnel counts only visits whose start was logged (logs from before iteration 43 have none).
  const started = [...runs.values()].filter((r) => r.started);
  const reached = (step: string) => started.filter((r) => (step === "solved" ? r.status === "solved" : r.did.has(step))).length;
  const objectCounts = new Map<string, number>();
  for (const r of started) for (const o of r.objects) objectCounts.set(o, (objectCounts.get(o) ?? 0) + 1);
  const funnel: Funnel = {
    visits: started.length,
    steps: ["note", "asked", "inspect", "notebook", "pin", "guessed", "solved", "share"].map((step) => ({ step, visits: reached(step) })),
    secondsToFirstQuestion: percentile(
      started.flatMap((r) => (r.firstQuestion ? [(Date.parse(r.firstQuestion) - Date.parse(r.started!)) / 1000] : [])),
      50,
    ),
    objects: [...objectCounts].map(([objectId, visits]) => ({ objectId, visits })).sort((a, b) => b.visits - a.visits || a.objectId.localeCompare(b.objectId)),
  };

  // Per day (the day a visit started; visits from before iteration 43 have no start and use their first turn).
  const firstTs = new Map<string, string>();
  for (const e of sorted) if (!firstTs.has(e.runId)) firstTs.set(e.runId, e.ts);
  const dayMap = new Map<string, DayStats>();
  const dayOf = (runId: string, r: { started?: string }) => (r.started ?? firstTs.get(runId) ?? "").slice(0, 10);
  for (const [id, r] of runs) {
    const d = dayMap.get(dayOf(id, r)) ?? { day: dayOf(id, r), visits: 0, solved: 0, questions: 0, spendUsd: 0 };
    d.visits++;
    if (r.status === "solved") d.solved++;
    d.questions += r.questions;
    dayMap.set(d.day, d);
  }
  for (const e of sorted) if (e.costUsd) {
    const d = dayMap.get(e.ts.slice(0, 10));
    if (d) d.spendUsd += e.costUsd;
  }
  const tierMap = new Map<string, TierStats>();
  for (const r of runs.values()) {
    const tier = tierOfNote(r.key.split("/").slice(1).join("/"));
    const t = tierMap.get(tier) ?? { tier, runs: 0, solved: 0, questionsToSolve: [] };
    t.runs++;
    if (r.status === "solved") {
      t.solved++;
      t.questionsToSolve.push(r.questions);
    }
    tierMap.set(tier, t);
  }
  const tierOrder = ["easy", "medium", "hard", "expert"];

  const errors = new Map<string, number>();
  for (const e of model) for (const err of e.validatorErrors ?? []) errors.set(errorType(err), (errors.get(errorType(err)) ?? 0) + 1);
  const input = model.reduce((s, e) => s + (e.usage?.input ?? 0), 0);
  const cached = model.reduce((s, e) => s + (e.usage?.cacheRead ?? 0), 0);
  return {
    funnel,
    byDay: [...dayMap.values()].sort((a, b) => a.day.localeCompare(b.day)),
    tiers: [...tierMap.values()].sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier)),
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
  if (s.tiers.length) {
    out.push("## By difficulty", "", "| Tier | Visits | Solved | Median questions to solve |", "|---|---|---|---|");
    for (const t of s.tiers) out.push(`| ${t.tier} | ${t.runs} | ${t.solved} (${pct(t.runs ? t.solved / t.runs : 0)}) | ${med(t.questionsToSolve) ?? "—"} |`);
    out.push("");
  }
  const f = s.funnel;
  out.push("## Play funnel", "");
  if (!f.visits) out.push("No visit starts in these logs (they begin with iteration 43), so there is no funnel yet.", "");
  else {
    const label: Record<string, string> = { note: "Read the note", asked: "Asked Grandma something", inspect: "Looked at an object", notebook: "Opened the notebook", pin: "Pinned a quote", guessed: "Tried the router", solved: "Solved it", share: "Copied the result" };
    out.push("| Step | Visits | Share |", "|---|---|---|");
    for (const st of f.steps) out.push(`| ${label[st.step] ?? st.step} | ${st.visits} | ${pct(st.visits / f.visits)} |`);
    out.push("", `Of ${f.visits} visits. Median time to the first question: ${f.secondsToFirstQuestion === null ? "—" : `${Math.round(f.secondsToFirstQuestion)} s`} (target under 60 s).`, "");
    if (f.objects.length) {
      out.push("Clues found (share of visits that looked at each object; under about a third means the clue needs another route):", "");
      for (const o of f.objects) out.push(`- ${o.objectId}: ${pct(o.visits / f.visits)}`);
      out.push("");
    }
  }
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

