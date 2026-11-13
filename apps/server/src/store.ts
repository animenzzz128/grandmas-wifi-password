/**
 * Run storage: live runs in memory, a snapshot of each run in SQLite (survives restarts),
 * and an append-only JSONL log of every turn (the raw material for eval and balancing).
 * Uses Node's built-in node:sqlite, so there is no native dependency to install.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { RunState } from "@gwp/engine";

export interface TurnLog {
  ts: string;
  runId: string;
  worldId: string;
  recipeId: string;
  kind: "ask" | "show" | "item" | "guess";
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
  usage?: { input: number; output: number; cacheRead: number; cacheWrite: number };
  /** Model cost of this turn in USD (list prices). */
  costUsd?: number;
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
    if (hit) return hit;
    const row = this.db.prepare("SELECT state FROM runs WHERE id = ?").get(id) as { state: string } | undefined;
    if (!row) return undefined;
    const state = JSON.parse(row.state) as RunState;
    this.live.set(id, state);
    return state;
  }

  save(state: RunState): void {
    this.live.set(state.id, state);
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
}
