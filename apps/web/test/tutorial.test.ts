import { describe, expect, it } from "vitest";
import { TUTORIAL_STEPS, tutorialStep } from "../src/tutorial.ts";
import type { TutorialView } from "../src/tutorial.ts";
import { firstTime, forgetLesson } from "../src/firsts.ts";
import en from "../../../data/i18n/en.json";

const start: TutorialView = { panel: null, noteSeen: false, questions: 0, picked: false, inspected: 0, seen: [], acked: [] };
const ids = (from: number, v: TutorialView) => TUTORIAL_STEPS[tutorialStep(from, v)]?.id ?? "done";

describe("guided first visit (iteration 56)", () => {
  it("teaches one thing at a time, in order, moving on when the player does it", () => {
    let v = { ...start };
    expect(ids(0, v)).toBe("note");
    v = { ...v, noteSeen: true, panel: "note", seen: ["note"] };
    expect(ids(0, v)).toBe("read");
    v = { ...v, panel: null };
    expect(ids(1, v)).toBe("pick");
    v = { ...v, picked: true };
    expect(ids(2, v)).toBe("ask");
    v = { ...v, questions: 1, picked: false };
    expect(ids(3, v)).toBe("tea");
    v = { ...v, acked: ["tea"] };
    expect(ids(4, v)).toBe("trail");
    v = { ...v, acked: ["tea", "trail"] };
    expect(ids(5, v)).toBe("look");
    v = { ...v, inspected: 1 };
    expect(ids(6, v)).toBe("notebook");
    v = { ...v, panel: "notebook", seen: [...v.seen, "notebook"] };
    expect(ids(7, v)).toBe("notebook"); // still reading it
    v = { ...v, panel: null };
    expect(ids(7, v)).toBe("router");
    v = { ...v, seen: [...v.seen, "router"] };
    expect(ids(8, v)).toBe("done");
  });

  it("skips what the player already did on their own", () => {
    // Typed a question before touching the note: reading the note is still step one, but picking and asking a card are done.
    const v = { ...start, noteSeen: true, questions: 2, inspected: 1, seen: ["note", "router"] };
    expect(ids(0, v)).toBe("tea");
    expect(ids(5, { ...v, acked: ["tea"], questions: 3 })).toBe("notebook");
  });

  it("never goes backwards", () => {
    expect(ids(6, { ...start })).toBe("look");
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
