import { describe, expect, it } from "vitest";
import { parseLog, playStats, renderPlayStats } from "../src/playstats.ts";
import type { LogEntry } from "../src/playstats.ts";

let clock = 0;
const e = (runId: string, kind: LogEntry["kind"], status: string, extra: Partial<LogEntry> = {}): LogEntry => ({
  ts: new Date(Date.UTC(2026, 10, 20, 10, 0, clock++)).toISOString(),
  runId,
  worldId: "rosie",
  recipeId: "r_easy",
  kind,
  status,
  ...extra,
});
const llm = (latencyMs: number, extra: Partial<LogEntry> = {}): Partial<LogEntry> => ({
  grandmaMode: "llm",
  latencyMs,
  attempts: 1,
  usage: { input: 100, output: 50, cacheRead: 900, cacheWrite: 0 },
  costUsd: 0.001,
  ...extra,
});

const SECRET_INPUT = "my secret question about Biscuit";

describe("play stats from turn logs", () => {
  const log: LogEntry[] = [
    // Solved in 3 questions (an item use doesn't count as a question), a daily.
    e("a", "ask", "playing", { ...llm(800), daily: 8 }),
    e("a", "item", "playing", { daily: 8 }),
    e("a", "show", "playing", { ...llm(1200), daily: 8 }),
    e("a", "ask", "playing", { ...llm(900, { attempts: 2, validatorErrors: ['attempt 1: reply mentions "1958", which is not in her memories'] }), daily: 8 }),
    e("a", "guess", "solved", { daily: 8 }),
    // Out of guesses after 1 question; a fallback turn.
    e("b", "ask", "playing", llm(3000, { attempts: 3, fallback: true, validatorErrors: ["attempt 1: reply mentions \"1960\", which is not in her memories", "attempt 2: x"] })),
    e("b", "guess", "playing"),
    e("b", "guess", "failed"),
    // Left mid-visit, offline Grandma, medium.
    { ...e("c", "ask", "playing", { grandmaMode: "mock" }), recipeId: "r_medium" },
  ];
  const stats = playStats(log, (k) => ({ "rosie/r_easy": 7, "rosie/r_medium": 10 })[k]);

  it("counts visits, questions and outcomes per puzzle", () => {
    expect(stats.runs).toBe(3);
    expect(stats.turns).toBe(5);
    expect(stats.modes).toEqual({ llm: 4, mock: 1 });
    const easy = stats.puzzles.find((p) => p.key === "rosie/r_easy")!;
    expect(easy).toMatchObject({ runs: 2, solved: 1, failed: 1, unfinished: 0, questionsToSolve: [3], par: 7 });
    expect(stats.puzzles.find((p) => p.key === "rosie/r_medium")).toMatchObject({ runs: 1, unfinished: 1, par: 10 });
    expect(stats.dailies).toEqual([{ number: 8, runs: 1, solved: 1 }]);
  });

  it("reports the real Grandma's cost, latency, retries and cache use", () => {
    expect(stats.model.turns).toBe(4);
    expect(stats.model.spendUsd).toBeCloseTo(0.004);
    expect(stats.model.p50).toBe(1200);
    expect(stats.model.p95).toBe(3000);
    expect(stats.model.retryRate).toBe(0.5);
    expect(stats.model.fallbackRate).toBe(0.25);
    expect(stats.model.cacheShare).toBeCloseTo(0.9);
    // Errors are grouped by type, not by the year in them.
    expect(stats.model.topErrors[0]).toEqual(["reply mentions …, which is not in her memories", 2]);
  });

  it("never prints what players typed or what Grandma said", () => {
    const withText = log.map((x) => ({ ...x, input: SECRET_INPUT, reply: "Biscuit stole every sock" }));
    const md = renderPlayStats(playStats(withText));
    expect(md).not.toContain("secret");
    expect(md).not.toContain("Biscuit");
    expect(md).toContain("| rosie/r_easy | 2 | 1 (50.0%) | 1 | 0 | 0 | 3 | — |");
  });

  it("skips torn lines and says so when there are no model turns", () => {
    const text = `${JSON.stringify(log[8])}\n{"ts":"2026-11-2`;
    const entries = parseLog(text);
    expect(entries).toHaveLength(1);
    expect(renderPlayStats(playStats(entries))).toContain("No model turns");
  });
});

describe("play funnel (design plan E3)", () => {
  it("counts how far visits got, the time to the first question and which clues were found", () => {
    const log: LogEntry[] = [
      e("x", "start", "playing"),
      e("x", "event", "playing", { event: "note" }),
      e("x", "ask", "playing", { grandmaMode: "mock" }), // 2 s after the start (one log line a second here)
      e("x", "event", "playing", { event: "inspect", objectId: "sled" }),
      e("x", "event", "playing", { event: "pin" }),
      e("x", "guess", "solved"),
      e("x", "event", "solved", { event: "share" }),
      e("y", "start", "playing"),
      e("y", "event", "playing", { event: "note" }),
      e("y", "event", "playing", { event: "inspect", objectId: "photo_album" }),
      e("y", "event", "playing", { event: "inspect", objectId: "sled" }),
      // An older visit without a start line: not in the funnel.
      e("z", "ask", "playing", { grandmaMode: "mock" }),
    ];
    const s = playStats(log);
    const step = (name: string) => s.funnel.steps.find((x) => x.step === name)!.visits;
    expect(s.funnel.visits).toBe(2);
    expect([step("note"), step("asked"), step("inspect"), step("pin"), step("guessed"), step("solved"), step("share")]).toEqual([2, 1, 2, 1, 1, 1, 1]);
    expect(s.funnel.secondsToFirstQuestion).toBe(2);
    expect(s.funnel.objects).toEqual([
      { objectId: "sled", visits: 2 },
      { objectId: "photo_album", visits: 1 },
    ]);
    expect(s.turns).toBe(2); // start and event lines are not questions
    const md = renderPlayStats(s);
    expect(md).toContain("## Play funnel");
    expect(md).toContain("Median time to the first question: 2 s");
    expect(md).toContain("- sled: 100.0%");
  });
});
