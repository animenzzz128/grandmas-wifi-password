/**
 * Client state. Note what is NOT here: stamina math, costs, guess checking. The server decides those
 * and returns a RunView; this store only mirrors it and tracks UI state (panels, focus, pointer lock).
 */
import { create } from "zustand";
import type { DailyInfo, HealthResponse, PublicScene, RunView } from "@gwp/engine";
import { api } from "./api.ts";
import { hasString, t } from "./strings.ts";
import { addPin, costWhy, extractNotes } from "./notebook.ts";
import { useSettings } from "./settings.ts";
import { firstTime, markVisited } from "./firsts.ts";

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
  /** Today's Daily Grandma (null if the server couldn't say). */
  daily: DailyInfo | null;
  /** When `daily` was fetched (ms), so the countdown can tick without asking the server. */
  dailyAt: number;
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
  /** The last thing Grandma misheard (shown big for a moment: "PASS THE SWORD?!"). */
  mishear: { as: string; at: number } | null;
  /** The player has looked around with the mouse at least once, so the full controls hint can go. */
  controlsLearned: boolean;
  /** Clue objects the player has inspected this visit (for the objectives strip). */
  inspected: string[];
  notebook: NoteEntry[];
  /** Quotes the player pinned from the chat (game design §5: highlight to pin). */
  pins: string[];
  /** Grandma's voice is playing (browser speech). Drives her talking animation. */
  grandmaSpeaking: boolean;
  /** The microphone is listening for the player's question. */
  listening: boolean;
  /** Bumped by the V key to start listening (the chat box owns the microphone). */
  voiceTick: number;

  init(): Promise<void>;
  start(difficulty: "easy" | "medium" | "hard"): Promise<void>;
  /** From the result card: a new visit at the same difficulty, with a different puzzle (design plan D4). */
  another(): Promise<void>;
  /** Visit today's Daily Grandma. */
  startDaily(): Promise<void>;
  /** Fetch today's Daily Grandma again (after a visit, or when the day rolls over). */
  refreshDaily(): void;
  /** Ask Grandma; resolves false if the question didn't reach her (so the box can keep it). */
  ask(text: string, voice?: { confidence: number }): Promise<boolean>;
  /** Show the carried clue to Grandma (must be near her). */
  showCarried(): Promise<void>;
  /** Give the carried cookie to Grandma (must be near her). */
  giveCookie(): Promise<void>;
  take(item: Carrying): void;
  /** Returns how the guess went, or null if it couldn't be sent. */
  guess(parts: string[]): Promise<{ correct: boolean; partsCorrect?: number; partsTotal?: number; partsRight?: boolean[] } | null>;
  openPanel(panel: Panel): void;
  focusChat(): void;
  setFocus(id: string | null): void;
  setLocked(locked: boolean): void;
  setTalking(talking: boolean): void;
  setNearGrandma(near: boolean): void;
  setInEarshot(inEarshot: boolean): void;
  showHint(text: string): void;
  /** Pin a quote to the notebook; returns false if it was too short or already pinned. */
  pin(text: string): boolean;
  /** Put on Grandma's reading glasses (once per visit); opens the now-readable note. */
  putOnGlasses(): Promise<void>;
  unpin(index: number): void;
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
  /** "Part 1 is right, part 2 isn't." (Easy and Medium; design plan A5.) */
  const partsLine = (right: readonly boolean[]) =>
    right.every((r) => !r) ? t("router.noneRight") : right.map((r, i) => t(r ? "router.partRight" : "router.partWrong", { n: i + 1 })).join(" ");
  /** Objects Grandma has already reacted to this visit. */
  const barked = new Set<string>();
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

  /** Enter a freshly created visit. */
  const enter = async (run: RunView) => {
    const scene = get().scene?.id === run.sceneId ? get().scene : await api.scene(run.sceneId);
    barked.clear();
    set({ run, scene, log: [{ who: "grandma", text: run.greeting, mood: "happy", seq: ++seq }], panel: null, noteSeen: false, carrying: null, talking: false, inspected: [], notebook: [], pins: [], hint: null, mishear: null });
  };

  return {
    health: null,
    daily: null,
    dailyAt: 0,
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
    mishear: null,
    controlsLearned: false,
    inspected: [],
    notebook: [],
    pins: [],
    grandmaSpeaking: false,
    listening: false,
    voiceTick: 0,

    async init() {
      // The daily is optional: the title screen just hides it if this fails.
      void api.daily().then(
        (daily) => set({ daily, dailyAt: Date.now() }),
        () => set({ daily: null }),
      );
      try {
        set({ health: await api.health() });
      } catch (e) {
        set({ error: (e as Error).message });
      }
    },

    async start(difficulty) {
      markVisited();
      await act(async () => enter(await api.createRun(difficulty, useSettings.getState().relaxed)));
    },

    async another() {
      const run = get().run;
      if (!run) return;
      window.speechSynthesis?.cancel();
      await act(async () => enter(await api.createRun(run.difficulty, useSettings.getState().relaxed, run.runId)));
    },

    async startDaily() {
      markVisited();
      await act(async () => enter(await api.createDaily(useSettings.getState().relaxed)));
    },

    async ask(text, voice) {
      const run = get().run;
      if (!run || !text.trim() || get().busy) return false;
      if (!get().inEarshot) {
        get().showHint(t("talk.tooFar"));
        return false;
      }
      push({ who: "player", text });
      const res = await act(() => api.ask(run.runId, text, voice));
      if (!res) {
        push({ who: "system", text: t("error.askFailed") });
        return false;
      }
      if (res.misheard) {
        push({ who: "system", text: t("mishear.line", { heard: res.misheard.heard }) });
        set({ mishear: { as: res.misheard.as, at: Date.now() } });
      }
      push({ who: "grandma", text: res.reply, mood: res.mood, cost: res.cost, costWhy: costWhy(res.costParts) });
      if (res.after) push({ who: "grandma", text: res.after, mood: "sleepy" });
      if (res.nudge) push({ who: "grandma", text: res.nudge, mood: "nostalgic" });
      learn(res.reply, "grandma");
      // Her tea dips under 30: she says she's flagging, so tiredness shows before the first nap (plan C1).
      if (run.stamina > 30 && res.run.stamina <= 30 && res.run.status === "playing" && !res.napped) push({ who: "grandma", text: t("bark.yawn"), mood: "sleepy" });
      set({ run: res.run });
      // Teach each rule the first time it happens, once per browser (plan A4), not in a wall of text up front.
      const lesson = (key: string, when: boolean) => when && firstTime(key) && push({ who: "system", text: t(`lesson.${key}`) });
      lesson("tea", res.cost > 0 && !res.run.relaxed);
      lesson("followUp", (res.costParts?.followUp ?? 0) < 0);
      lesson("nap", res.napped && res.run.status === "playing");
      lesson("cookie", res.run.status === "playing" && !res.run.relaxed && res.run.cookies > 0 && res.run.stamina <= 40);
      return true;
    },

    async showCarried() {
      const { run, carrying, nearGrandma } = get();
      if (!run || carrying?.kind !== "clue" || !nearGrandma) return;
      const obj = get().scene?.interactables.find((i) => i.id === carrying.objectId);
      if (!obj) return;
      // She's still answering: keep the clue in hand rather than losing it to a skipped request.
      if (get().busy) return get().showHint(t("talk.wait"));
      push({ who: "player", text: `[shows the ${obj.label}]` });
      set({ panel: null, carrying: null });
      const res = await act(() => api.show(run.runId, obj.id));
      if (!res) {
        push({ who: "system", text: t("error.showFailed", { item: obj.label }) });
        set({ carrying });
        return;
      }
      push({ who: "grandma", text: res.reply, mood: res.mood, cost: res.cost, costWhy: costWhy(res.costParts) });
      if (res.after) push({ who: "grandma", text: res.after, mood: "sleepy" });
      if (res.nudge) push({ who: "grandma", text: res.nudge, mood: "nostalgic" });
      learn(res.reply, "grandma");
      set({ run: res.run });
    },

    async giveCookie() {
      const { run, carrying, nearGrandma } = get();
      if (!run || carrying?.kind !== "cookie" || !nearGrandma) return;
      if (get().busy) return get().showHint(t("talk.wait"));
      set({ carrying: null });
      const res = await act(() => api.cookie(run.runId));
      if (!res) {
        push({ who: "system", text: t("error.showFailed", { item: t("cookie.label") }) });
        set({ carrying });
        return;
      }
      push({ who: "grandma", text: res.line, mood: "happy" });
      // Not eaten (her tea is still high): the cookie stays in the player's hand for later.
      const kept = res.run.cookies === run.cookies && res.run.cookies > 0;
      set({ run: res.run, panel: null, carrying: kept ? carrying : null });
    },

    async putOnGlasses() {
      const run = get().run;
      if (!run) return;
      const res = await act(() => api.glasses(run.runId));
      if (!res) return;
      push({ who: "grandma", text: res.line, mood: "happy" });
      const cleared = !run.glasses && res.run.glasses;
      set({ run: res.run, panel: cleared ? { type: "note" } : null, noteSeen: true });
    },

    take(item) {
      set({ carrying: item, panel: null });
    },

    async guess(parts) {
      const run = get().run;
      if (!run) return null;
      const res = await act(() => api.guess(run.runId, parts));
      if (!res) return null;
      if (!res.correct) {
        const tried = t("router.tried", { guess: parts.join(" + ") });
        const count = res.partsRight
          ? ` ${partsLine(res.partsRight)}`
          : res.partsTotal
            ? ` ${t("router.partial", { n: res.partsCorrect ?? 0, total: res.partsTotal })}`
            : "";
        push({ who: "system", text: `${tried}${count}` });
      }
      push({ who: "grandma", text: res.line, mood: res.correct ? "happy" : "confused" });
      set({ run: res.run, panel: res.run.status === "playing" ? get().panel : null });
      return { correct: res.correct, partsCorrect: res.partsCorrect, partsTotal: res.partsTotal, partsRight: res.partsRight };
    },

    pin(text) {
      const pins = get().pins;
      const next = addPin(pins, text);
      if (next === pins) return false;
      set({ pins: next });
      const run = get().run;
      if (run) api.event(run.runId, "pin");
      return true;
    },

    unpin(index) {
      set({ pins: get().pins.filter((_, i) => i !== index) });
    },

    openPanel(panel) {
      const run0 = get().run;
      if (run0 && panel && (panel.type === "note" || panel.type === "notebook")) api.event(run0.runId, panel.type);
      if (run0 && panel?.type === "inspect") api.event(run0.runId, "inspect", panel.objectId);
      set({ panel, noteSeen: get().noteSeen || panel?.type === "note" });
      if (panel?.type === "inspect") {
        const obj = get().scene?.interactables.find((i) => i.id === panel.objectId);
        if (obj?.kind === "clue" && !get().inspected.includes(obj.id)) set({ inspected: [...get().inspected, obj.id] });
        if (obj?.inspect_text) learn(obj.inspect_text, "object");
        // The first time the player picks something up, Grandma reacts: a canned line, no model call, no tea,
        // no facts. The room and the conversation feed each other (plan C2).
        const run = get().run;
        if (obj && run?.status === "playing" && !barked.has(obj.id)) {
          barked.add(obj.id);
          const variants = ["a", "b"].map((v) => `bark.${obj.id}.${v}`).filter(hasString);
          const pickIt = variants[(run.runId.length + obj.id.length + barked.size) % Math.max(1, variants.length)];
          if (pickIt) push({ who: "grandma", text: t(pickIt), mood: "teasing" });
        }
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
      window.speechSynthesis?.cancel();
      set({ run: null, log: [], panel: null, carrying: null, talking: false, grandmaSpeaking: false, hint: null, mishear: null });
      get().refreshDaily();
    },

    refreshDaily() {
      void api.daily().then(
        (daily) => set({ daily, dailyAt: Date.now() }),
        () => undefined, // keep what we had
      );
    },
  };
});
