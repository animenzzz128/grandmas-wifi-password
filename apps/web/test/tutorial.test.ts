import { describe, expect, it } from "vitest";
import { TUTORIAL_STEPS, stepTarget, tutorialStep } from "../src/tutorial.ts";
import type { TutorialView } from "../src/tutorial.ts";
import { firstTime, forgetLesson } from "../src/firsts.ts";
import en from "../../../data/i18n/en.json";

const start: TutorialView = { panel: null, noteSeen: false, questions: 0, picked: false, inspected: 0, seen: [], acked: [] };
const ids = (from: number, v: TutorialView) => TUTORIAL_STEPS[tutorialStep(from, v)]?.id ?? "done";

describe("guided first visit (three steps since the playability review, docs/14 P7)", () => {
  it("teaches the loop once, in order, moving on when the player does it", () => {
    let v = { ...start };
    expect(TUTORIAL_STEPS.map((s) => s.id)).toEqual(["note", "ask", "router"]);
    expect(ids(0, v)).toBe("note");
    v = { ...v, noteSeen: true, panel: "note", seen: ["note"] };
    expect(ids(0, v)).toBe("note"); // still reading it
    v = { ...v, panel: null };
    expect(ids(0, v)).toBe("ask");
    v = { ...v, questions: 1 };
    expect(ids(1, v)).toBe("router");
    v = { ...v, seen: [...v.seen, "router"] };
    expect(ids(2, v)).toBe("done");
  });

  it("points at the card first, then at its ask button", () => {
    const ask = TUTORIAL_STEPS.find((s) => s.id === "ask")!;
    expect(stepTarget(ask, { ...start, noteSeen: true })).toBe(".card-strip .topic.note");
    expect(stepTarget(ask, { ...start, noteSeen: true, picked: true })).toBe(".card-ask");
  });

  it("skips what the player already did on their own", () => {
    const v = { ...start, noteSeen: true, questions: 2, seen: ["note"] };
    expect(ids(0, v)).toBe("router");
  });

  it("never goes backwards", () => {
    expect(ids(2, { ...start })).toBe("router");
  });

  it("leaves the rest to one-time lessons, each with words", () => {
    const ui = (en as { ui: Record<string, string> }).ui;
    for (const k of ["tea", "followUp", "trail", "look", "notebook", "nap", "cookie"]) expect(ui[`lesson.${k}`], k).toBeTruthy();
  });

  it("has words for every step, and can be replayed", () => {
    const ui = (en as { ui: Record<string, string> }).ui;
    for (const s of TUTORIAL_STEPS) expect(ui[`tutorial.${s.id}`], s.id).toBeTruthy();
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    expect(firstTime("tutorial", store)).toBe(true);
    expect(firstTime("tutorial", store)).toBe(false);
    forgetLesson("tutorial", store);
    expect(firstTime("tutorial", store)).toBe(true);
  });
});
