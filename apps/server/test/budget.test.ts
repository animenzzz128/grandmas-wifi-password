import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HealthResponse, costUsd } from "@gwp/engine";
import { BudgetBrain, spentInLog } from "../src/budget.ts";
import type { BrainResult, GrandmaBrain, ReplyArgs } from "../src/grandma.ts";
import { createApp } from "../src/app.ts";
import { readConfig } from "../src/config.ts";
import { loadGameData } from "../src/data.ts";
import { MockBrain } from "../src/grandma.ts";
import { RunStore } from "../src/store.ts";

const USAGE = { input: 1_000_000, output: 100_000, cacheRead: 0, cacheWrite: 0 };
const PER_REPLY = costUsd(USAGE);

/** A pretend LLM brain with a fixed cost per reply. */
class PricyBrain implements GrandmaBrain {
  mode = "llm" as const;
  model = "pricy";
  calls = 0;
  async reply(): Promise<BrainResult> {
    this.calls++;
    return {
      output: { reply: "Oh, sweetheart.", fact_ids_used: [], distractor_ids: [], mood: "happy" },
      attempts: 1,
      validatorErrors: [],
      fallback: false,
      latencyMs: 1,
      usage: USAGE,
    };
  }
}

// Scratch folders in the OS temp directory (a few bytes each). Deliberately not deleted by the test:
// the project avoids permanent deletes in code; the OS cleans its temp folder.
const tmp = () => mkdtempSync(join(tmpdir(), "gwp-budget-"));

const args = {} as ReplyArgs;

describe("cost guard (roadmap 03 §6)", () => {
  it("switches to the offline Grandma once today's budget is spent, and back the next UTC day", async () => {
    let now = new Date("2026-11-13T10:00:00Z");
    const llm = new PricyBrain();
    const brain = new BudgetBrain(llm, new MockBrain(), { dailyUsd: PER_REPLY * 2.5, now: () => now });
    expect(brain.mode).toBe("llm");
    for (let i = 0; i < 3; i++) await brain.reply(args);
    expect(brain.spentToday).toBeCloseTo(PER_REPLY * 3);
    expect(brain.degraded).toBe("budget");
    expect(brain.mode).toBe("mock");
    now = new Date("2026-11-14T00:00:01Z");
    expect(brain.degraded).toBeUndefined();
    expect(brain.mode).toBe("llm");
  });

  it("goes offline while the kill-switch file exists, without spending", async () => {
    const dir = tmp();
    const killFile = join(dir, "KILL");
    const llm = new PricyBrain();
    const brain = new BudgetBrain(llm, new MockBrain(), { dailyUsd: 100, killFile });
    writeFileSync(killFile, "");
    expect(brain.degraded).toBe("kill");
    expect(llm.calls).toBe(0);
  });

  it("restores today's spend from the turn logs after a restart", () => {
    const logs = join(tmp(), "logs");
    mkdirSync(logs);
    writeFileSync(join(logs, "turns-2026-11-13.jsonl"), ['{"costUsd":1.5}', '{"kind":"item"}', '{"costUsd":2}', '{"costUs'].join("\n"));
    expect(spentInLog(logs, "2026-11-13")).toBe(3.5);
    const brain = new BudgetBrain(new PricyBrain(), new MockBrain(), { dailyUsd: 3, logDir: logs, now: () => new Date("2026-11-13T12:00:00Z") });
    expect(brain.degraded).toBe("budget");
  });

  it("tells players why on /api/health", async () => {
    const brain = new BudgetBrain(new PricyBrain(), new MockBrain(), { dailyUsd: 0 });
    const app = createApp({ data: loadGameData(readConfig({}, {}).dataDir), brain, store: new RunStore(null), asksPerMinute: 1000 });
    const health = HealthResponse.parse(await (await app.request("/api/health")).json());
    expect(health).toMatchObject({ grandmaMode: "mock", degraded: "budget" });
  });
});
