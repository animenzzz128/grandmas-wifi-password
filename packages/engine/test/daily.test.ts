import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DAILY_EPOCH, dailyNumber, dailyPick, dailyPool, parseWorld, secondsToNextDaily } from "../src/index.ts";
import type { GrandmaWorld } from "../src/index.ts";

const data = join(dirname(fileURLToPath(import.meta.url)), "../../../data");
const rosie = parseWorld(JSON.parse(readFileSync(join(data, "grandmas/rosie.json"), "utf8")));
const day = (n: number, time = "12:00:00") => new Date(Date.parse(`${DAILY_EPOCH}T${time}Z`) + (n - 1) * 86_400_000);
/** A second, fake Grandma: Rosie's data under another id, to grow the pool. */
const twin: GrandmaWorld = { ...rosie, id: "zelda" };

describe("Daily Grandma (GDD §5)", () => {
  it("numbers days from the epoch in UTC", () => {
    expect(dailyNumber(day(1, "00:00:00"))).toBe(1);
    expect(dailyNumber(day(1, "23:59:59"))).toBe(1);
    expect(dailyNumber(day(2, "00:00:00"))).toBe(2);
    expect(dailyNumber(new Date("2026-01-01T00:00:00Z"))).toBe(1);
    expect(dailyNumber(new Date("2027-11-13T08:00:00Z"))).toBe(366);
  });

  it("counts down to UTC midnight", () => {
    expect(secondsToNextDaily(day(1, "23:59:00"))).toBe(60);
    expect(secondsToNextDaily(day(1, "00:00:00"))).toBe(86_400);
  });

  it("is the same puzzle for everyone all day", () => {
    const a = dailyPick([rosie], day(5, "00:00:01"))!;
    const b = dailyPick([rosie], day(5, "23:59:59"))!;
    expect(a).toEqual(b);
    expect(a.number).toBe(5);
    expect(a.date).toBe(day(5).toISOString().slice(0, 10));
  });

  it("does not depend on the order the Grandmas were loaded", () => {
    for (let n = 1; n <= 12; n++) expect(dailyPick([rosie, twin], day(n))).toEqual(dailyPick([twin, rosie], day(n)));
  });

  for (const worlds of [[rosie], [rosie, twin]]) {
    const pool = dailyPool(worlds);
    it(`plays every puzzle once per cycle and never repeats a day (pool of ${pool.length})`, () => {
      const picks = Array.from({ length: pool.length * 40 }, (_, i) => dailyPick(worlds, day(i + 1))!);
      for (let c = 0; c < 40; c++) {
        const keys = picks.slice(c * pool.length, (c + 1) * pool.length).map((p) => `${p.worldId}/${p.recipeId}`);
        expect(new Set(keys).size).toBe(pool.length);
      }
      for (let i = 1; i < picks.length; i++) expect(`${picks[i]!.worldId}/${picks[i]!.recipeId}`).not.toBe(`${picks[i - 1]!.worldId}/${picks[i - 1]!.recipeId}`);
      // Not just the pool order repeated: the cycles differ.
      const firstOfCycles = new Set(Array.from({ length: 40 }, (_, c) => picks[c * pool.length]!.recipeId + picks[c * pool.length]!.worldId));
      expect(firstOfCycles.size).toBeGreaterThan(1);
    });
  }

  it("has nothing to pick with no Grandmas", () => {
    expect(dailyPick([], day(1))).toBeUndefined();
  });
});
