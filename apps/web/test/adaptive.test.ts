import { describe, expect, it } from "vitest";
import { ADAPT, adapt, qualityStep } from "../src/scene/adaptive.ts";

describe("adaptive resolution (iteration 48)", () => {
  it("steps down after one slow window, to a floor", () => {
    let s = { scale: 0.6, goodStreak: 0 };
    s = adapt(s, 30, 0.6);
    expect(s.scale).toBe(0.55);
    for (let i = 0; i < 20; i++) s = adapt(s, 20, 0.6);
    expect(s.scale).toBe(ADAPT.min);
  });

  it("steps up only after several good windows in a row, never past the default", () => {
    let s = { scale: 0.45, goodStreak: 0 };
    s = adapt(s, 60, 0.6);
    s = adapt(s, 60, 0.6);
    expect(s.scale).toBe(0.45);
    s = adapt(s, 60, 0.6);
    expect(s.scale).toBe(0.5);
    // A middling window resets the streak: no pumping up and down around the threshold.
    s = adapt(s, 60, 0.6);
    s = adapt(s, 50, 0.6);
    s = adapt(s, 60, 0.6);
    s = adapt(s, 60, 0.6);
    expect(s.scale).toBe(0.5);
    for (let i = 0; i < 30; i++) s = adapt(s, 240, 0.6);
    expect(s.scale).toBe(0.6);
  });

  it("never locks at the bottom: it recovers when the machine does", () => {
    let s = { scale: ADAPT.min, goodStreak: 0 };
    for (let i = 0; i < 15; i++) s = adapt(s, 120, 0.6);
    expect(s.scale).toBe(0.6);
  });

  it("takes bigger steps on a high-density screen (iteration 54)", () => {
    expect(adapt({ scale: 2, goodStreak: 0 }, 20, 2).scale).toBe(1.76);
    expect(adapt({ scale: 0.6, goodStreak: 0 }, 20, 0.6).scale).toBe(0.55);
  });
});

describe("automatic quality (iteration 54)", () => {
  it("steps quality down after two slow windows in a row, not one", () => {
    let s = qualityStep(0, 20);
    expect(s).toEqual({ slowStreak: 1, down: false });
    s = qualityStep(s.slowStreak, 50);
    expect(s).toEqual({ slowStreak: 0, down: false });
    expect(qualityStep(qualityStep(0, 20).slowStreak, 25).down).toBe(true);
  });
});
