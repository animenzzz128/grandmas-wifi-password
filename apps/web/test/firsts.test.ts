import { describe, expect, it } from "vitest";
import { firstTime, hasVisited, markVisited } from "../src/firsts.ts";
import { safeStorage } from "../src/storage.ts";

const memory = () => {
  const map = new Map<string, string>();
  return safeStorage(() => ({ getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) }));
};

describe("things told only once (plan A1, A4)", () => {
  it("remembers the first visit", () => {
    const s = memory();
    expect(hasVisited(s)).toBe(false);
    markVisited(s);
    expect(hasVisited(s)).toBe(true);
  });

  it("teaches each lesson once", () => {
    const s = memory();
    expect(firstTime("tea", s)).toBe(true);
    expect(firstTime("tea", s)).toBe(false);
    expect(firstTime("nap", s)).toBe(true);
    expect(firstTime("tea", s)).toBe(false);
  });

  it("survives a corrupted record", () => {
    const s = memory();
    s.setItem("gwp-lessons", "{not json");
    expect(firstTime("tea", s)).toBe(true);
  });
});
