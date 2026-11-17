import { describe, expect, it } from "vitest";
import { eighthOffsets } from "../src/audio.ts";

describe("music loop timing (plan C4)", () => {
  it("swings the eighth notes and keeps them inside the bar", () => {
    const beat = 0.5;
    const o = eighthOffsets(beat, 0.62);
    expect(o).toHaveLength(8);
    expect(o[0]).toBe(0);
    expect(o[1]).toBeCloseTo(0.31); // the off-beat comes late: swing
    expect(o[2]).toBe(beat);
    for (let i = 1; i < o.length; i++) expect(o[i]!).toBeGreaterThan(o[i - 1]!);
    expect(o.at(-1)!).toBeLessThan(4 * beat);
  });
});
