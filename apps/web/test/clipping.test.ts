import { describe, expect, it } from "vitest";
import { LIMITS, limitHead, soft, softRange } from "../src/scene/poseLimits.ts";
import { Vector3 } from "three";
import { dropTriangles, twoBoneElbow, uncoveredTriangles } from "../src/scene/body.ts";
import { drapeSurfaceY, liftToClear } from "../src/scene/blanket.ts";

describe("Grandma's pose limits (clipping plan step 2)", () => {
  it("soft limits barely change small motions and never pass the limit", () => {
    expect(soft(0.05, 0.5)).toBeCloseTo(0.05, 2);
    for (const x of [1, 5, 50, -50]) expect(Math.abs(soft(x, 0.5))).toBeLessThanOrEqual(0.5);
    expect(softRange(-10, 0.2, 0.5)).toBeGreaterThanOrEqual(-0.2);
    expect(softRange(10, 0.2, 0.5)).toBeLessThanOrEqual(0.5);
  });

  it("every control pushed to either extreme stays inside its limit", () => {
    for (const big of [-100, 100]) {
      const p = limitHead({ yaw: big, pitch: big, tilt: big, lean: big, doze: 1 });
      expect(Math.abs(p.neckYaw + p.headYaw)).toBeLessThanOrEqual(LIMITS.yaw + 1e-9);
      expect(p.headPitch).toBeLessThanOrEqual(LIMITS.pitchDown);
      expect(p.headPitch).toBeGreaterThanOrEqual(-LIMITS.pitchUp);
      expect(Math.abs(p.headTilt)).toBeLessThanOrEqual(LIMITS.tilt);
      expect(p.spineLean).toBeLessThanOrEqual(LIMITS.leanForward);
      expect(p.spineLean).toBeGreaterThanOrEqual(-LIMITS.leanBack);
      expect(p.neckPitch).toBeLessThanOrEqual(LIMITS.neckDoze);
    }
  });

  it("a look is shared between neck and head", () => {
    const p = limitHead({ yaw: 0.5, pitch: 0, tilt: 0, lean: 0, doze: 0 });
    expect(p.neckYaw).toBeGreaterThan(0);
    expect(p.headYaw).toBeGreaterThan(p.neckYaw);
  });
});

describe("hiding the body under the cardigan (clipping plan step 1)", () => {
  // A strip of 4 triangles over 6 vertices: 0-1-2-3 are covered (region 1), 4-5 are skin.
  //   0 - 2 - 4
  //   | / | / |
  //   1 - 3 - 5
  const region = [1, 1, 1, 1, 0, 0];
  const index = [0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5];

  it("keeps the rim where the cardigan meets skin, and everything uncovered", () => {
    const { keep, hidden } = uncoveredTriangles(index, region, 1);
    // Vertices 2 and 3 touch skin (triangle 2-3-4), so every covered triangle here is on the rim: none hidden.
    expect(hidden).toBe(0);
    expect(keep).toEqual(index);
  });

  it("hides covered triangles away from the rim", () => {
    const wide = [1, 1, 1, 1, 1, 1, 0, 0];
    // Extend the strip: 4-5 covered now, 6-7 skin.
    const idx = [...index, 4, 5, 6, 6, 5, 7];
    const { keep, hidden } = uncoveredTriangles(idx, wide, 1);
    expect(hidden).toBe(2); // the two triangles over 0-1-2-3 are fully inside
    expect(keep).toEqual([2, 3, 4, 4, 3, 5, 4, 5, 6, 6, 5, 7]);
  });
});

describe("two-bone IK for her arms (clipping plan step 3)", () => {
  const shoulder = new Vector3(0, 1, 0);
  const a = 0.3;
  const b = 0.25;

  it("puts the wrist on a reachable target with both bones at their lengths", () => {
    const target = new Vector3(0.1, 0.6, 0.3);
    const { elbow, wrist } = twoBoneElbow(shoulder, target, a, b, new Vector3(1, 0, -1));
    expect(wrist.distanceTo(target)).toBeLessThan(1e-6);
    expect(elbow.distanceTo(shoulder)).toBeCloseTo(a, 6);
    expect(elbow.distanceTo(wrist)).toBeCloseTo(b, 6);
  });

  it("bends the elbow toward the pole", () => {
    const target = new Vector3(0, 0.6, 0.2);
    const out = twoBoneElbow(shoulder, target, a, b, new Vector3(1, 0, 0)).elbow;
    const inn = twoBoneElbow(shoulder, target, a, b, new Vector3(-1, 0, 0)).elbow;
    expect(out.x).toBeGreaterThan(0);
    expect(inn.x).toBeLessThan(0);
  });

  it("reaches as far as it can toward a target out of reach", () => {
    const { elbow, wrist } = twoBoneElbow(shoulder, new Vector3(0, -2, 0), a, b, new Vector3(0, 0, 1));
    expect(wrist.distanceTo(shoulder)).toBeCloseTo(a + b, 3);
    expect(elbow.distanceTo(shoulder)).toBeCloseTo(a, 6);
  });
});

describe("the lap blanket is shaped from her legs (clipping plan step 4)", () => {
  const hips = new Vector3(0, 0.5, 0);
  const knees = new Vector3(0, 0.48, 0.4);

  it("its surface follows the thigh line and drops toward the side edges", () => {
    const mid = drapeSurfaceY(hips, knees, 0.5, { lift: 0.1, sag: 0.09 }, 0, 0.2)!;
    const edge = drapeSurfaceY(hips, knees, 0.5, { lift: 0.1, sag: 0.09 }, 0.24, 0.2)!;
    expect(mid).toBeCloseTo(0.5 + 0.1 - 0.01, 3);
    expect(edge).toBeLessThan(mid);
    expect(drapeSurfaceY(hips, knees, 0.5, {}, 0.3, 0.2)).toBeNull(); // past the side edge
    expect(drapeSurfaceY(hips, knees, 0.5, {}, 0, 0.5)).toBeNull(); // past the knees (the roll)
  });

  it("is lifted exactly enough to clear every point by the gap", () => {
    const points = [new Vector3(0, 0.6, 0.2), new Vector3(0.2, 0.55, 0.3), new Vector3(-0.1, 0.58, 0.1)];
    const opts = { sag: 0.09 };
    const lift = liftToClear(hips, knees, 0.5, opts, points, 0.008);
    let tightest = Infinity;
    for (const p of points) tightest = Math.min(tightest, drapeSurfaceY(hips, knees, 0.5, { ...opts, lift }, p.x, p.z)! - p.y);
    expect(tightest).toBeCloseTo(0.008, 6);
  });
});

describe("thigh triangles under the blanket aren't drawn", () => {
  it("drops every triangle that touches a flagged vertex and keeps the rest", () => {
    const index = [0, 1, 2, 2, 1, 3, 2, 3, 4];
    const { keep, dropped } = dropTriangles(index, (v) => v === 3);
    expect(dropped).toBe(2);
    expect(keep).toEqual([0, 1, 2]);
  });
});
