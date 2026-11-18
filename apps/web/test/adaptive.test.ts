import { describe, expect, it } from "vitest";
import { ADAPT, adapt, medianFps, qualityStep, shouldDraw } from "../src/scene/adaptive.ts";
import { qualityFor } from "../src/settings.ts";

describe("adaptive resolution (iteration 48)", () => {
  it("steps down after one slow window, to a floor", () => {
    let s = { scale: 1, goodStreak: 0 };
    s = adapt(s, 30, 1);
    expect(s.scale).toBe(0.95);
    for (let i = 0; i < 20; i++) s = adapt(s, 20, 1);
    expect(s.scale).toBe(ADAPT.min);
  });

  it("steps up only after several good windows in a row, never past the default", () => {
    let s = { scale: 0.8, goodStreak: 0 };
    s = adapt(s, 60, 1);
    s = adapt(s, 60, 1);
    expect(s.scale).toBe(0.8);
    s = adapt(s, 60, 1);
    expect(s.scale).toBe(0.85);
    // A middling window resets the streak: no pumping up and down around the threshold.
    s = adapt(s, 60, 1);
    s = adapt(s, 50, 1);
    s = adapt(s, 60, 1);
    s = adapt(s, 60, 1);
    expect(s.scale).toBe(0.85);
    for (let i = 0; i < 30; i++) s = adapt(s, 240, 1);
    expect(s.scale).toBe(1);
  });

  it("never locks at the bottom: it recovers when the machine does", () => {
    let s = { scale: ADAPT.min, goodStreak: 0 };
    for (let i = 0; i < 30; i++) s = adapt(s, 120, 1);
    expect(s.scale).toBe(1);
  });

  it("never goes below 0.6 (iteration 56): the picture turns to mush and Low quality helps more", () => {
    expect(ADAPT.min).toBe(0.6);
  });

  it("takes bigger steps on a high-density screen (iteration 54)", () => {
    expect(adapt({ scale: 2, goodStreak: 0 }, 20, 2).scale).toBe(1.76);
    expect(adapt({ scale: 0.8, goodStreak: 0 }, 20, 1).scale).toBe(0.75);
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

describe("steadier frame rate (iteration 56)", () => {
  it("judges a window by its median frame, so a few outside hitches don't count", () => {
    const frames = Array.from({ length: 120 }, (_, i) => (i % 10 === 0 ? 0.3 : 1 / 60));
    // The average says ~22 fps (would cut resolution); the median says 60.
    expect(frames.length / frames.reduce((a, b) => a + b)).toBeLessThan(25);
    expect(Math.round(medianFps(frames))).toBe(60);
    expect(medianFps([])).toBe(0);
  });

  it("draws about 60 frames a second, whatever the screen's refresh rate", () => {
    // Simulate a screen: refreshes every `hz`, where the refresh right after a drawn frame is sometimes skipped.
    const run = (hz: number, skipAfterDraw: boolean) => {
      const r = 1000 / hz;
      let t = 0, drawn = -1e9, frames = 0, skip = false;
      while (t < 1000) {
        t += skip ? 2 * r : r;
        skip = false;
        if (shouldDraw(t - drawn, r)) {
          drawn = t;
          frames++;
          skip = skipAfterDraw;
        }
      }
      return frames;
    };
    const near = (got: number, want: number) => expect(Math.abs(got - want), `${got} vs ${want}`).toBeLessThanOrEqual(1);
    near(run(60, false), 60);
    near(run(120, false), 60);
    near(run(144, false), 72);
    near(run(240, false), 60);
    // The case measured on a 240 Hz laptop: counting refreshes gave 48 fps, timing gives 60.
    near(run(240, true), 60);
    near(run(30, false), 30);
  });

  it("starts integrated GPUs on Medium, software renderers and touch on Low", () => {
    expect(qualityFor("ANGLE (Intel, Intel(R) Graphics (0x00007D67) Direct3D11 vs_5_0 ps_5_0, D3D11)", false)).toBe("medium");
    expect(qualityFor("ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)", false)).toBe("medium");
    expect(qualityFor("ANGLE (AMD, AMD Radeon RX 7600 Direct3D11 vs_5_0 ps_5_0, D3D11)", false)).toBe("high");
    expect(qualityFor("ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)", false)).toBe("high");
    expect(qualityFor("Apple M2", false)).toBe("high");
    expect(qualityFor("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)", false)).toBe("low");
    expect(qualityFor("ANGLE (NVIDIA, NVIDIA GeForce RTX 4060)", true)).toBe("low");
  });
});
