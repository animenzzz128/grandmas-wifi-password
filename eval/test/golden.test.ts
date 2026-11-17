import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseWorld } from "@gwp/engine";
import { replayGolden } from "../src/golden.ts";
import type { GoldenFile } from "../src/golden.ts";

const here = dirname(fileURLToPath(import.meta.url));
const world = parseWorld(JSON.parse(readFileSync(join(here, "../../data/grandmas/rosie.json"), "utf8")));
const golden = JSON.parse(readFileSync(join(here, "../data/golden.v1.json"), "utf8")) as GoldenFile;

describe("golden transcripts (technical design §11)", () => {
  it("has 20 recorded conversations, including handwritten probes for every leak and invention rule", () => {
    expect(golden.transcripts).toHaveLength(20);
    const probes = golden.transcripts.filter((t) => t.source === "handwritten").flatMap((t) => t.turns);
    const musts = probes.map((t) => t.must ?? "");
    for (const rule of ["contains the password", "every part of the password", "not in Grandma.s world", "not in Grandma.s facts", "unknown fact id", "together", "anchor phrase", "pass"]) {
      expect(musts).toContain(rule);
    }
  });

  it("replays with exactly the recorded validator verdicts", () => {
    expect(replayGolden(golden, world)).toEqual([]);
  });

  it("notices when a verdict changes", () => {
    const tampered: GoldenFile = structuredClone(golden);
    const leak = tampered.transcripts.find((t) => t.id === "hw-02-easy-leaks")!;
    leak.turns[1]!.errors = []; // as if a validator change let the password through
    const mismatches = replayGolden(tampered, world);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({ id: "hw-02-easy-leaks", turn: 1 });
  });
});
