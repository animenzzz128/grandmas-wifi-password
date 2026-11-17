import { describe, expect, it } from "vitest";
import { loadProbes, loadScene, loadWorld, renderReport, runObvious, runReach } from "../src/probe.ts";

const world = loadWorld();
const probes = loadProbes();

describe("question probes (review 44)", () => {
  it("every promised route reaches its memory in every run", () => {
    const failed = runReach(world, loadScene(), probes.reach, 6).filter((r) => r.hits < r.runs);
    expect(failed.map((r) => `${r.recipe} ${r.ask ?? `show ${r.show}`}: ${r.hits}/${r.runs} "${r.sample.slice(0, 80)}"`)).toEqual([]);
  });

  it("has ten direct questions for every puzzle and reports each answer part", () => {
    expect(Object.keys(probes.obvious).sort()).toEqual(world.recipes.map((r) => r.id).sort());
    for (const qs of Object.values(probes.obvious)) expect(qs).toHaveLength(10);
    const obvious = runObvious(world, { r_hard: probes.obvious.r_hard! }, 4);
    // Hard hides its year from Grandma: no direct question gives it.
    expect(obvious[0]!.parts.find((p) => p.answer === "1977")!.best).toBeUndefined();
    expect(obvious[0]!.fallsToDirectQuestions).toBe(false);
    expect(renderReport([], obvious)).toContain("| r_hard | Sparrow1977 |");
  });
});

describe("deduction depth (review 44, F2; adopted in iteration 47)", () => {
  it("only the two Mediums still fall to direct questions alone", () => {
    // f2-year-hops made the year one hop in Easy, Easy 2, Easy 3 and Medium 2. Don't let a change undo it.
    const falls = runObvious(world, probes.obvious, 4).filter((o) => o.fallsToDirectQuestions).map((o) => o.recipe);
    expect(falls.sort()).toEqual(["r_medium", "r_medium_3"]);
  });
});

describe("content proposals (eval:probe --patch)", () => {
  it("applies a proposal in memory, reports data problems, and never touches data/", async () => {
    const { applyPatch, loadWorldJson } = await import("../src/probe.ts");
    const ok = applyPatch(loadWorldJson(), probes, {
      id: "t",
      notes: "",
      facts: { f_garden: { text: "I grow tomatoes in the backyard, and the squirrels still get half." } },
      reach_add: [{ recipe: "r_easy", ask: "Tell me about your garden", expect: "squirrels still get half" }],
    });
    expect(ok.problems).toEqual([]);
    expect(runReach(ok.world!, loadScene(), ok.probes.reach.slice(-1), 2)[0]!.hits).toBe(2);
    // The adopted proposal again would add its anchors twice: the data checks say so.
    const { readFileSync } = await import("node:fs");
    const adopted = JSON.parse(readFileSync(new URL("../data/proposals/f2-year-hops.json", import.meta.url), "utf8"));
    expect(adopted.status).toMatch(/Adopted/);
    expect(applyPatch(loadWorldJson(), probes, adopted).problems.join(" ")).toMatch(/a_wedding/);
    expect(loadWorld().facts.find((f) => f.id === "f_garden")!.text).not.toContain("still get half");
  });
});
