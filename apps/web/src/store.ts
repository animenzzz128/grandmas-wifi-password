/**
 * Client state. Note what is NOT here: stamina math, costs, guess checking. The server decides those
 * and returns a RunView; this store only mirrors it and tracks UI state (panels, focus, pointer lock).
 */
import { create } from "zustand";
import type { HealthResponse, PublicScene, RunView } from "@gwp/engine";
import { api } from "./api.ts";
import { t } from "./strings.ts";
import { costWhy, extractNotes } from "./notebook.ts";
import { useSettings } from "./settings.ts";

export type Panel = { type: "inspect"; objectId: string } | { type: "note" } | { type: "router" } | { type: "notebook" } | { type: "settings" } | null;

/** What the player is holding: a clue to show Grandma, or a cookie from the jar. One thing at a time. */
export type Carrying = { kind: "clue"; objectId: string } | { kind: "cookie" } | null;

export interface LogLine {
  /** Increasing id (survives trimming the log), so the scene can tell a new line from an old one. */
  seq?: number;
  who: "grandma" | "player" | "system";
  text: string;
  mood?: string;
  cost?: number;
  /** Why it cost that much, e.g. "8 base, +6 rude". */
  costWhy?: string;
}

/** Something the player learned, collected automatically for the notebook (from text the player saw). */
export interface NoteEntry {
  kind: "year" | "name" | "place" | "number";
  value: string;
  /** The sentence it came from. */
  source: string;
  from: "grandma" | "object";
}

interface GameState {
  health: HealthResponse | null;
  scene: PublicScene | null;
  run: RunView | null;
  log: LogLine[];
  busy: boolean;
  error: string | null;
  panel: Panel;
  focusId: string | null;
  locked: boolean;
  noteSeen: boolean;
  /** Bumped to ask the chat box to take keyboard focus. */
  chatFocusTick: number;
  /** True while the chat box has keyboard focus ("talk mode"). */
  talking: boolean;
  carrying: Carrying;
  /** Within arm's reach of Grandma (set by the player controller). Showing and giving need it. */
  nearGrandma: boolean;
  /** Close enough for Grandma to hear you (a bit farther than arm's reach). Talking needs it. */
  inEarshot: boolean;
  /** A short message shown for a moment (e.g. "Grandma can't hear you from over here"). */
  hint: { text: string; at: number } | null;
  /** The player has looked around with the mouse at least once, so the full controls hint can go. */
  controlsLearned: boolean;
  /** Clue objects the player has inspected this visit (for the objectives strip). */
  inspected: string[];
  notebook: NoteEntry[];

  init(): Promise<void>;
  start(difficulty: "easy" | "medium" | "hard"): Promise<void>;
  ask(text: string): Promise<void>;
  /** Show the carried clue to Grandma (must be near her). */
  showCarried(): Promise<void>;
  /** Give the carried cookie to Grandma (must be near her). */
  giveCookie(): Promise<void>;
  take(item: Carrying): void;
  /** Returns how the guess went, or null if it couldn't be sent. */
  guess(parts: string[]): Promise<{ correct: boolean; partsCorrect?: number; partsTotal?: number } | null>;
  openPanel(panel: Panel): void;
  focusChat(): void;
  setFocus(id: string | null): void;
  setLocked(locked: boolean): void;
  setTalking(talking: boolean): void;
  setNearGrandma(near: boolean): void;
  setInEarshot(inEarshot: boolean): void;
  showHint(text: string): void;
  /** Esc: back out of exactly one layer (card, then talk). Returns false if there was nothing to close. */
  back(): boolean;
  leave(): void;
}

export const useGame = create<GameState>((set, get) => {
  /** Run an API action with the busy flag and error capture. */
  async function act<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (get().busy) return undefined;
    set({ busy: true, error: null });
    try {
      return await fn();
    } catch (e) {
      set({ error: (e as Error).message });
      return undefined;
    } finally {
      set({ busy: false });
    }
  }

  let seq = 0;
  const push = (...lines: LogLine[]) => set((s) => ({ log: [...s.log, ...lines.map((l) => ({ ...l, seq: ++seq }))].slice(-60) }));

  /** Add what a text mentions (years, names, places, numbers) to the notebook, without duplicates. */
  const learn = (text: string, from: NoteEntry["from"]) => {
    const found = extractNotes(text, from);
    if (!found.length) return;
    set((s) => {
      const have = new Set(s.notebook.map((n) => `${n.kind}:${n.value}`));
      const fresh = found.filter((n) => !have.has(`${n.kind}:${n.value}`));
      return fresh.length ? { notebook: [...s.notebook, ...fresh] } : {};
    });
  };

  return {
    health: null,
    scene: null,
    run: null,
    log: [],
    busy: false,
    error: null,
    panel: null,
    focusId: null,
    locked: false,
    noteSeen: false,
    chatFocusTick: 0,
    talking: false,
    carrying: null,
    nearGrandma: false,
    inEarshot: false,
    hint: null,
    controlsLearned: false,
    inspected: [],
    notebook: [],

    async init() {
      try {
        set({ health: await api.health() });
      } catch (e) {
        set({ error: (e as Error).message });
      }
    },

    async start(difficulty) {
      await act(async () => {
        const run = await api.createRun(difficulty, useSettings.getState().relaxed);
        const scene = get().scene?.id === run.sceneId ? get().scene : await api.scene(run.sceneId);
        set({ run, scene, log: [{ who: "grandma", text: run.greeting, mood: "happy" }], panel: null, noteSeen: false, carrying: null, talking: false, inspected: [], notebook: [] });
      });
    },

    async ask(text) {
      const run = get().run;
      if (!run || !text.trim()) return;
      if (!get().inEarshot) return get().showHint(t("talk.tooFar"));
      push({ who: "player", text });
      const res = await act(() => api.ask(run.runId, text));
      if (!res) return;
      push({ who: "grandma", text: res.reply, mood: res.mood, cost: res.cost, costWhy: costWhy(res.costParts) });
      if (res.after) push({ who: "grandma", text: res.after, mood: "sleepy" });
      if (res.nudge) push({ who: "grandma", text: res.nudge, mood: "nostalgic" });
      learn(res.reply, "grandma");
      set({ run: res.run });
    },

    async showCarried() {
      const { run, carrying, nearGrandma } = get();
      if (!run || carrying?.kind !== "clue" || !nearGrandma) return;
      const obj = get().scene?.interactables.find((i) => i.id === carrying.objectId);
      if (!obj) return;
      push({ who: "player", text: `[shows the ${obj.label}]` });
      set({ panel: null, carrying: null });
      const res = await act(() => api.show(run.runId, obj.id));
      if (!res) return;
      push({ who: "grandma", text: res.reply, mood: res.mood, cost: res.cost, costWhy: costWhy(res.costParts) });
      if (res.after) push({ who: "grandma", text: res.after, mood: "sleepy" });
      if (res.nudge) push({ who: "grandma", text: res.nudge, mood: "nostalgic" });
      learn(res.reply, "grandma");
      set({ run: res.run });
    },

    async giveCookie() {
      const { run, carrying, nearGrandma } = get();
      if (!run || carrying?.kind !== "cookie" || !nearGrandma) return;
      set({ carrying: null });
      const res = await act(() => api.cookie(run.runId));
      if (!res) return;
      push({ who: "grandma", text: res.line, mood: "happy" });
      set({ run: res.run, panel: null });
    },

    take(item) {
      set({ carrying: item, panel: null });
    },

    async guess(parts) {
      const run = get().run;
      if (!run) return null;
      const res = await act(() => api.guess(run.runId, parts));
      if (!res) return null;
      push({ who: "grandma", text: res.line, mood: res.correct ? "happy" : "confused" });
      set({ run: res.run, panel: res.run.status === "playing" ? get().panel : null });
      return { correct: res.correct, partsCorrect: res.partsCorrect, partsTotal: res.partsTotal };
    },

    openPanel(panel) {
      set({ panel, noteSeen: get().noteSeen || panel?.type === "note" });
      if (panel?.type === "inspect") {
        const obj = get().scene?.interactables.find((i) => i.id === panel.objectId);
        if (obj && !get().inspected.includes(obj.id)) set({ inspected: [...get().inspected, obj.id] });
        if (obj?.inspect_text) learn(obj.inspect_text, "object");
      }
    },
    focusChat() {
      if (!get().inEarshot) return get().showHint(t("talk.tooFar"));
      set((s) => ({ panel: null, chatFocusTick: s.chatFocusTick + 1 }));
    },
    setFocus(id) {
      if (get().focusId !== id) set({ focusId: id });
    },
    setLocked(locked) {
      set((s) => ({ locked, controlsLearned: s.controlsLearned || locked }));
    },
    setTalking(talking) {
      if (get().talking !== talking) set({ talking });
    },
    setNearGrandma(near) {
      if (get().nearGrandma !== near) set({ nearGrandma: near });
    },
    setInEarshot(inEarshot) {
      if (get().inEarshot !== inEarshot) set({ inEarshot });
    },
    showHint(text) {
      set({ hint: { text, at: Date.now() } });
    },
    back() {
      const { panel, talking } = get();
      if (panel) {
        set({ panel: null });
        return true;
      }
      if (talking && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
        return true;
      }
      return false;
    },
    leave() {
      set({ run: null, log: [], panel: null, carrying: null, talking: false });
    },
  };
});
