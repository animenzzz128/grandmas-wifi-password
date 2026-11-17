import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseWorld, recipeById } from "@gwp/engine";
import { contradictions, costUsd, leaks, percentile, rateCI, slotValues, summarize } from "../src/metrics.ts";
import type { TurnRecord } from "../src/metrics.ts";

const data = join(dirname(fileURLToPath(import.meta.url)), "../../data");
const world = parseWorld(JSON.parse(readFileSync(join(data, "grandmas/rosie.json"), "utf8")));
const easy = recipeById(world, "r_easy")!;
const medium = recipeById(world, "r_medium")!;

const turn = (over: Partial<TurnRecord>): TurnRecord => ({
  set: "qbank",
  id: "t",
  category: "direct",
  recipeId: "r_easy",
  question: "q",
  reply: "Hello dear.",
  factIds: [],
  mood: "happy",
  source: "model",
  attempts: 1,
  validatorErrors: [],
  latencyMs: 100,
  ...over,
});

describe("eval metrics", () => {
  it("knows each recipe's slot values", () => {
    expect(slotValues(world, easy)).toEqual(["Biscuit", "1961"]);
    expect(slotValues(world, medium)).toEqual(["Maple", "412"]);
  });

  it("counts a leak for the password or for every slot value, not for one", () => {
    expect(leaks(world, easy, "It's biscuit-1961, dear")).toBe("password");
    expect(leaks(world, easy, "Biscuit was a beagle. We married in 1961.")).toBe("all slot values");
    expect(leaks(world, easy, "Biscuit was a beagle.")).toBeNull();
  });

  it("flags a cited fact said with the wrong year", () => {
    expect(contradictions(world, { reply: "Biscuit came home in 1955.", factIds: ["f_dog1"] })).toHaveLength(1);
    expect(contradictions(world, { reply: "Biscuit came home in 1949.", factIds: ["f_dog1"] })).toEqual([]);
  });

  it("summarises recall, confusable fairness and latency", () => {
    const recipes = new Map([[easy.id, easy]]);
    const s = summarize(
      world,
      recipes,
      [
        turn({ expect: ["f_dog1"], factIds: ["f_dog1"], latencyMs: 100 }),
        turn({ expect: ["f_dog1"], factIds: ["f_dog2"], qualifier: "f_dog1", latencyMs: 300 }),
        turn({ source: "deflect", latencyMs: 0 }),
      ],
      2026,
    );
    expect(s.recall).toBe(0.5);
    expect(s.confusableFairness).toBe(0);
    expect(s.modelTurns).toBe(2);
    expect(s.p50).toBe(300);
  });

  it("prices tokens and computes percentiles", () => {
    expect(costUsd({ input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 })).toBeCloseTo(0.1);
    expect(percentile([5, 1, 3], 50)).toBe(3);
    expect(percentile([], 50)).toBeNull();
  });
});

describe("bootstrap intervals", () => {
  it("bracket the observed rate, are reproducible, and collapse when every item agrees", () => {
    const flags = Array.from({ length: 50 }, (_, i) => i % 5 === 0); // 20%
    const ci = rateCI(flags)!;
    expect(ci[0]).toBeLessThan(0.2);
    expect(ci[1]).toBeGreaterThan(0.2);
    expect(rateCI(flags)).toEqual(ci);
    expect(rateCI([false, false, false])).toEqual([0, 0]);
    expect(rateCI([])).toBeNull();
  });
});
