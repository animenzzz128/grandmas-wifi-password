/**
 * Cost guard for a deployed game (roadmap 03 §6: cost dashboard, kill switch). It wraps the LLM Grandma:
 * - Daily budget: once today's model spend (UTC day, list prices) reaches the limit, Grandma switches to
 *   the free offline brain until midnight UTC. Today's spend is restored from the turn logs on restart.
 * - Kill switch: while the file `<varDir>/KILL` exists, Grandma is offline (e.g. `fly ssh console -C
 *   "touch /data/KILL"`), without a redeploy. Delete the file to turn her back on.
 * Players keep playing either way; the health endpoint says why, and the title screen tells them.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { costUsd } from "@gwp/engine";
import type { BrainResult, GrandmaBrain, ReplyArgs } from "./grandma.ts";

export type Degraded = "budget" | "kill";

const utcDay = (d: Date) => d.toISOString().slice(0, 10);

/** Sum of `costUsd` in a day's turn log (var/logs/turns-YYYY-MM-DD.jsonl). Missing file: 0. */
export function spentInLog(logDir: string, day: string): number {
  const file = join(logDir, `turns-${day}.jsonl`);
  if (!existsSync(file)) return 0;
  let total = 0;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as { costUsd?: number };
      if (typeof entry.costUsd === "number") total += entry.costUsd;
    } catch {
      // a torn last line after a crash: skip it
    }
  }
  return total;
}

export class BudgetBrain implements GrandmaBrain {
  private day: string;
  private spent: number;

  constructor(
    private llm: GrandmaBrain,
    private offline: GrandmaBrain,
    private opts: { dailyUsd: number; killFile?: string; logDir?: string; now?: () => Date },
  ) {
    this.day = utcDay(this.now());
    this.spent = opts.logDir ? spentInLog(opts.logDir, this.day) : 0;
  }

  private now(): Date {
    return this.opts.now ? this.opts.now() : new Date();
  }

  /** Why Grandma is offline right now, if she is. */
  get degraded(): Degraded | undefined {
    if (this.opts.killFile && existsSync(this.opts.killFile)) return "kill";
    this.rollDay();
    return this.spent >= this.opts.dailyUsd ? "budget" : undefined;
  }

  get mode(): "llm" | "mock" {
    return this.degraded ? this.offline.mode : this.llm.mode;
  }

  get model(): string | undefined {
    return this.degraded ? this.offline.model : this.llm.model;
  }

  /** Today's model spend so far (USD). */
  get spentToday(): number {
    this.rollDay();
    return this.spent;
  }

  async reply(args: ReplyArgs): Promise<BrainResult> {
    if (this.degraded) return this.offline.reply(args);
    const result = await this.llm.reply(args);
    this.spent += costUsd(result.usage);
    return result;
  }

  private rollDay() {
    const today = utcDay(this.now());
    if (today !== this.day) {
      this.day = today;
      this.spent = 0;
    }
  }
}
