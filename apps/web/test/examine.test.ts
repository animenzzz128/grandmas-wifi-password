import { describe, expect, it } from "vitest";
import { facingTurn, stepView, viewCount, viewsFor } from "../src/examine.ts";
import { develop, flipRows } from "../src/scene/develop.ts";
import { ALBUM } from "../src/scene/photos.ts";

describe("examine views (iteration 49)", () => {
  it("the wedding photo has a front and a back; the album has its pages; others have one view", () => {
    expect(viewsFor("WeddingPhoto")).toEqual({ kind: "sides", labels: ["examine.front", "examine.back"] });
    expect(viewCount("PhotoAlbum")).toBe(ALBUM.length);
    expect(viewCount("BowlingTrophy")).toBe(1);
  });

  it("page buttons wrap round at both ends", () => {
    expect(stepView("PhotoAlbum", 0, -1)).toBe(ALBUM.length - 1);
    expect(stepView("PhotoAlbum", ALBUM.length - 1, 1)).toBe(0);
    expect(stepView("BowlingTrophy", 0, 1)).toBe(0);
  });

  it("turns an object so the side the player was looking at faces the camera", () => {
    // Standing in front (+z) of an unturned object: no turn.
    expect(facingTurn(0, 0, 0, 0, 2)).toBe(0);
    // The TV stands against the east wall facing west; the player is west of it: a quarter turn.
    expect(facingTurn(3.65, -0.6, 0, 2.2, -0.6)).toBeCloseTo(Math.PI / 2);
    // The moon plate is itself turned to face west: from the west it needs no turn.
    expect(facingTurn(3.68, -1.12, -Math.PI / 2, 2.5, -1.12)).toBeCloseTo(0);
    // The fridge is turned to face east, into the room; the player is east of it.
    expect(facingTurn(-3.55, -0.35, Math.PI / 2, -2.2, -0.35)).toBeCloseTo(0);
    // From behind: a half turn.
    expect(Math.abs(facingTurn(0, 0, 0, 0, -2))).toBeCloseTo(Math.PI);
  });
});

describe("developing a photo (iteration 49)", () => {
  const solid = (w: number, h: number, rgb: [number, number, number]) => {
    const p = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) p.set([...rgb, 255], i * 4);
    return p;
  };

  it("black and white prints have no colour left (just a warm paper tone)", () => {
    const p = solid(8, 8, [200, 40, 40]);
    develop(p, 8, 8, "bw");
    for (let i = 0; i < p.length; i += 4) {
      expect(Math.abs(p[i]! - p[i + 1]!)).toBeLessThan(12);
      expect(p[i]!).toBeGreaterThanOrEqual(p[i + 2]!); // warm, never blue
    }
  });

  it("faded colour prints keep their colour, but less of it", () => {
    const p = solid(4, 4, [40, 40, 200]);
    develop(p, 4, 4, "faded", 1, false);
    const [r, , b] = [p[20]!, p[21]!, p[22]!];
    expect(b).toBeGreaterThan(r); // still bluish
    expect(b - r).toBeLessThan(160); // but much less saturated
  });

  it("corners are darker than the middle (vignette), and the grain is the same every time", () => {
    const a = solid(32, 32, [180, 180, 180]);
    const b = solid(32, 32, [180, 180, 180]);
    develop(a, 32, 32, "bw", 7);
    develop(b, 32, 32, "bw", 7);
    expect([...a]).toEqual([...b]);
    const at = (x: number, y: number) => a[(y * 32 + x) * 4]!;
    expect(at(0, 0) + at(31, 31)).toBeLessThan(at(15, 15) + at(16, 16));
  });

  it("render-target rows (bottom first) come out top first", () => {
    const raw = new Uint8Array([1, 1, 1, 1, 2, 2, 2, 2]); // 1x2: bottom row 1, top row 2
    expect([...flipRows(raw, 1, 2)]).toEqual([2, 2, 2, 2, 1, 1, 1, 1]);
  });
});

describe("the photo album matches its inspect text", () => {
  it("dogs without names, then Cherry St. and the porch with their captions, then the birth announcement", () => {
    expect(ALBUM[0]!.map((p) => p.photo)).toEqual(["beagle", "cocker"]);
    expect(ALBUM[0]!.every((p) => !p.caption)).toBe(true);
    expect(ALBUM[1]![0]!.caption).toBe("Cherry St., our first home — moved out summer '64");
    expect(ALBUM[1]![1]!.caption).toBe("Summer '69");
    expect(ALBUM[2]!.some((p) => p.card === "announcement")).toBe(true);
  });
});
