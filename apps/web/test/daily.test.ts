import { describe, expect, it } from "vitest";
import { dailyStreak, formatCountdown, loadDailyRecords, saveDailyRecord } from "../src/daily.ts";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe("daily record", () => {
  it("keeps only the first finished visit of a day", () => {
    const s = memory();
    expect(saveDailyRecord({ number: 3, solved: false, stars: 0, questions: 20 }, s)).toBe(true);
    expect(saveDailyRecord({ number: 3, solved: true, stars: 3, questions: 4 }, s)).toBe(false);
    expect(loadDailyRecords(s)[3]).toEqual({ number: 3, solved: false, stars: 0, questions: 20 });
  });

  it("survives broken storage", () => {
    const s = memory();
    s.setItem("gwp-daily", "{not json");
    expect(loadDailyRecords(s)).toEqual({});
    const full = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
    expect(saveDailyRecord({ number: 1, solved: true, stars: 1, questions: 9 }, full)).toBe(false);
  });

  it("counts a streak of solved days, ending today or yesterday", () => {
    const rec = (number: number, solved = true) => ({ number, solved, stars: solved ? 2 : 0, questions: 8 });
    const all = { 4: rec(4), 5: rec(5, false), 6: rec(6), 7: rec(7) };
    expect(dailyStreak(all, 7)).toBe(2);
    expect(dailyStreak(all, 8)).toBe(2); // today not played yet
    expect(dailyStreak(all, 9)).toBe(0); // missed a day
    expect(dailyStreak({ ...all, 8: rec(8, false) }, 8)).toBe(0);
  });

  it("formats the countdown to the next Grandma", () => {
    expect(formatCountdown(5 * 3600 + 12 * 60 + 30)).toBe("5h 12m");
    expect(formatCountdown(12 * 60)).toBe("12m");
    expect(formatCountdown(30)).toBe("<1m");
  });
});
