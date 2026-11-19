/**
 * Run storage: live runs in memory, a snapshot of each run in SQLite (survives restarts),
 * and an append-only JSONL log of every turn (the raw material for eval and balancing).
 * Uses Node's built-in node:sqlite, so there is no native dependency to install.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseLog } from "@gwp/engine";
import type { LogEntry, RunState } from "@gwp/engine";

export interface TurnLog {
  ts: string;
  runId: string;
  worldId: string;
  recipeId: string;
  kind: "ask" | "show" | "item" | "guess" | "start" | "event";
  /** For kind "event": what the player did (an event name, never text) and on which object. */
  event?: string;
  objectId?: string;
  input: string;
  reply?: string;
  factIds?: string[];
  cost?: number;
  stamina: number;
  status: string;
  grandmaMode?: string;
  latencyMs?: number;
  attempts?: number;
  validatorErrors?: string[];
  fallback?: boolean;
  usage?: { input: number; output: number; cacheRead: number; cacheWrite: number; costUsd?: number };
  /** Model cost of this turn in USD (list prices). */
  costUsd?: number;
  /** Daily Grandma number, for visits to the daily puzzle. */
  daily?: number;
}

export class RunStore {
  private live = new Map<string, RunState>();
  private db: DatabaseSync;
  private logDir: string | null;

  /** Pass varDir = null for an in-memory store with no log files (tests). */
  constructor(varDir: string | null) {
    if (varDir) {
      mkdirSync(join(varDir, "logs"), { recursive: true });
      this.db = new DatabaseSync(join(varDir, "runs.db"));
      this.logDir = join(varDir, "logs");
    } else {
      this.db = new DatabaseSync(":memory:");
      this.logDir = null;
    }
    this.db.exec(`CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      state TEXT NOT NULL
    )`);
  }

  get(id: string): RunState | undefined {
    const hit = this.live.get(id);
    if (hit) {
      // Most recently used goes to the back of the line for eviction.
      this.live.delete(id);
      this.live.set(id, hit);
      return hit;
    }
    const row = this.db.prepare("SELECT state FROM runs WHERE id = ?").get(id) as { state: string } | undefined;
    if (!row) return undefined;
    const state = JSON.parse(row.state) as RunState;
    this.remember(state);
    return state;
  }

  /** Runs kept in memory (the rest are read back from SQLite when asked for). */
  get liveCount(): number {
    return this.live.size;
  }

  /**
   * Memory holds only visits in progress, at most MAX_LIVE of them (least recently used go first); finished
   * visits live in SQLite only. Before this the map grew with every visit ever started (security review P3).
   */
  private remember(state: RunState): void {
    this.live.delete(state.id);
    if (state.status !== "playing") return;
    this.live.set(state.id, state);
    while (this.live.size > RunStore.MAX_LIVE) this.live.delete(this.live.keys().next().value!);
  }

  static MAX_LIVE = 2000;

  /**
   * How today's Daily Grandma is going for everyone: finished visits, how many were solved, and the
   * median questions of the solved ones. Counts visits, not people (there are no accounts), so
   * practice replays count too.
   */
  dailyStats(daily: number): { finished: number; solved: number; medianQuestions?: number } {
    const rows = this.db
      .prepare(
        `SELECT status, json_extract(state, '$.questionCount') AS q FROM runs
         WHERE json_extract(state, '$.daily') = ? AND status != 'playing' AND json_extract(state, '$.questionCount') >= 1`,
      )
      .all(daily) as { status: string; q: number }[];
    const solvedQs = rows.filter((r) => r.status === "solved").map((r) => r.q).sort((a, b) => a - b);
    const median = solvedQs.length ? solvedQs[Math.floor((solvedQs.length - 1) / 2)] : undefined;
    return { finished: rows.length, solved: solvedQs.length, ...(median !== undefined ? { medianQuestions: median } : {}) };
  }

  save(state: RunState): void {
    this.remember(state);
    this.db
      .prepare(
        `INSERT INTO runs (id, world_id, recipe_id, status, created_at, updated_at, state)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at, state = excluded.state`,
      )
      .run(state.id, state.worldId, state.recipeId, state.status, state.createdAt, new Date().toISOString(), JSON.stringify(state));
  }

  log(entry: TurnLog): void {
    if (!this.logDir) return;
    const day = entry.ts.slice(0, 10);
    appendFileSync(join(this.logDir, `turns-${day}.jsonl`), JSON.stringify(entry) + "\n");
  }

  /** The turn logs from a UTC day on (YYYY-MM-DD), for the /admin play stats. Empty without a log folder. */
  readLogs(since?: string): LogEntry[] {
    const dir = this.logDir;
    if (!dir || !existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => /^turns-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f) && (!since || f.slice(6, 16) >= since))
      .sort()
      .flatMap((f) => parseLog(readFileSync(join(dir, f), "utf8")));
  }
}
