import { describe, expect, it } from "vitest";
import { BAR, LOOP_BARS, PASSES, SCORE, TEMPO, barAt, hz } from "../src/music.ts";

describe("Rosie's Waltz, the room music (iteration 56)", () => {
  it("is a slow waltz about a minute long before it repeats", () => {
    expect(TEMPO).toBeLessThanOrEqual(96);
    expect(LOOP_BARS).toBe(SCORE.length * PASSES.length);
    expect(LOOP_BARS * BAR).toBeGreaterThan(55);
    expect(barAt(LOOP_BARS)).toEqual(barAt(0)); // wraps
  });

  it("keeps every melody note inside its bar of six eighths", () => {
    for (const bar of SCORE)
      for (const [midi, start, len] of bar.melody) {
        expect(start).toBeGreaterThanOrEqual(0);
        expect(start + len).toBeLessThanOrEqual(6);
        expect(midi).toBeGreaterThanOrEqual(60);
        expect(midi).toBeLessThanOrEqual(90);
      }
  });

  it("leaves room to think: a melody only part of the time, and one pass with none at all", () => {
    const bars = Array.from({ length: LOOP_BARS }, (_, n) => barAt(n));
    const withTune = bars.filter((b) => b.melody.length > 1).length;
    expect(withTune / LOOP_BARS).toBeLessThanOrEqual(0.5);
    expect(bars.some((b) => b.lead === "none" && b.melody.length === 0 && b.arpeggio)).toBe(true);
    // Each pass of the loop sounds different.
    expect(new Set(PASSES).size).toBe(PASSES.length);
  });

  it("tunes to A440", () => {
    expect(hz(69)).toBe(440);
    expect(hz(81)).toBeCloseTo(880);
  });
});
