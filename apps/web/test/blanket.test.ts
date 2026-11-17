import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { drapedBlanket, drapePath } from "../src/scene/blanket.ts";

// Roughly Grandma's seated joints in model space (+z forward, +y up).
const hips = new Vector3(0, 0.9, 0);
const knees = new Vector3(0, 0.88, 0.42);
const width = 0.5;

describe("draped lap blanket", () => {
  it("covers the thighs from behind the hips past the knees", () => {
    const pos = drapedBlanket(hips, knees, width).attributes.position!;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      minZ = Math.min(minZ, pos.getZ(i));
      maxZ = Math.max(maxZ, pos.getZ(i));
    }
    expect(minZ).toBeLessThan(hips.z);
    expect(maxZ).toBeGreaterThan(knees.z);
  });

  it("stays above the thigh line along the centre, so the legs can't poke through", () => {
    const pos = drapedBlanket(hips, knees, width).attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      if (Math.abs(x) > 0.1 || z < hips.z || z > knees.z) continue;
      const f = (z - hips.z) / (knees.z - hips.z);
      const thighTop = hips.y + (knees.y - hips.y) * f + 0.06;
      expect(pos.getY(i)).toBeGreaterThan(thighTop);
    }
  });

  it("rolls over the knees and hangs down instead of ending in a flat edge", () => {
    const path = drapePath(hips, knees, { lift: 0.085, back: 0.05, roll: 0.06, hang: 0.24, sag: 0.07 });
    const [endZ, endY] = path.at(-1)!;
    expect(endY).toBeLessThan(knees.y - 0.15);
    expect(endZ).toBeGreaterThan(knees.z);
    expect(endZ).toBeLessThan(knees.z + 0.15);
  });

  it("lets the side edges fall below the centre over the lap", () => {
    const pos = drapedBlanket(hips, knees, width).attributes.position!;
    let centre = -Infinity;
    let edge = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      if (Math.abs(z - 0.2) > 0.03) continue;
      if (Math.abs(pos.getX(i)) < 0.01) centre = Math.max(centre, pos.getY(i));
      if (Math.abs(Math.abs(pos.getX(i)) - width / 2) < 0.01) edge = Math.min(edge, pos.getY(i));
    }
    expect(edge).toBeLessThan(centre - 0.04);
  });
});
