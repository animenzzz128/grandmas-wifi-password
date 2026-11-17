import { describe, expect, it } from "vitest";
import { loadDailyRecords, saveDailyRecord } from "../src/daily.ts";
import { safeStorage } from "../src/storage.ts";

const blocked = () => {
  throw new DOMException("The operation is insecure.", "SecurityError");
};

describe("storage that never throws (review, iteration 39)", () => {
  it("keeps values in memory when the browser blocks storage, even reading it", () => {
    const s = safeStorage(blocked);
    expect(s.getItem("x")).toBeNull();
    s.setItem("x", "1");
    expect(s.getItem("x")).toBe("1");
  });

  it("keeps values in memory when writes fail (storage full)", () => {
    const full = { getItem: () => null, setItem: () => { throw new DOMException("full", "QuotaExceededError"); } };
    const s = safeStorage(() => full);
    s.setItem("k", "v");
    expect(s.getItem("k")).toBeNull(); // the real store answered (it has nothing); no throw either way
  });

  it("uses the real store when it works", () => {
    const map = new Map<string, string>();
    const real = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
    const s = safeStorage(() => real);
    s.setItem("a", "b");
    expect(map.get("a")).toBe("b");
    expect(s.getItem("a")).toBe("b");
  });

  it("the daily record still works with storage blocked", () => {
    const s = safeStorage(blocked);
    expect(loadDailyRecords(s)).toEqual({});
    expect(saveDailyRecord({ number: 3, solved: true, stars: 2, questions: 9 }, s)).toBe(true);
    expect(loadDailyRecords(s)[3]?.stars).toBe(2);
  });
});
