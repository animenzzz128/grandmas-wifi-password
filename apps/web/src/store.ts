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
import { cardFlick, fridgeDoor } from "./audio.ts";
import type { AskResponse, NoteChoice } from "@gwp/engine";
import { topicQuestion } from "@gwp/engine";

export type Panel = { type: "inspect"; objectId: string } | { type: "note" } | { type: "router" } | { type: "notebook" } | { type: "settings" } | null;

export interface LogLine {
  /** Increasing id (survives trimming the log), so the scene can tell a new line from an old one. */
  seq?: number;
  who: "grandma" | "player" | "system" | "michael";
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
  noteSeen: boolean;
  /** Bumped to ask the chat box to take keyboard focus. */
  chatFocusTick: number;
  /** True while the chat box has keyboard focus ("talk mode"). */
  talking: boolean;
  /** A short message shown for a moment (e.g. "Grandma can't hear you from over here"). */
  hint: { text: string; at: number } | null;
  /** The last thing Grandma misheard (shown big for a moment: "PASS THE SWORD?!"). */
  mishear: { as: string; at: number } | null;
  /** Clue objects the player has inspected this visit (for the objectives strip). */
  inspected: string[];
  /** Fixtures standing open (the fridge door). */
  opened: string[];
  notebook: NoteEntry[];
  /** Quotes the player pinned from the chat (game design §5: highlight to pin). */
  pins: string[];
  /** Grandma's voice is playing (browser speech). Drives her talking animation. */
  grandmaSpeaking: boolean;
  /** The microphone is listening for the player's question. */
  listening: boolean;
  /** Bumped by the V key to start listening (the chat box owns the microphone). */
  voiceTick: number;
  /** The camera view: a view id from the scene ("grandma", "table", …) or "focus:<object id>". */
  view: string;
  /** The sticky notes to choose from on the title screen (null until loaded). */
  notes: NoteChoice[] | null;
  /** The topic card picked in the card strip (its two ask buttons show). */
  pickedTopic: string | null;
  /** The card of the last question (asking it again is a cheaper follow-up), as the server counts it. */
  lastTopic: string | null;

  init(): Promise<void>;
  start(difficulty: "easy" | "medium" | "hard"): Promise<void>;
  /** Visit with one chosen sticky note. */
  startNote(recipeId: string): Promise<void>;
  /** Move the camera to a view. */
  goView(view: string): void;
  /** The player tapped an object in the room. */
  tapObject(id: string): void;
  /** Show a clue to Grandma straight from its close-up card. */
  showObject(id: string): Promise<void>;
  /** Give Grandma the kolaczki from the plate. */
  offerCookie(): Promise<void>;
  /** Ring Uncle Michael on the hall phone for a hint (twice a visit). */
  callMichael(): Promise<void>;
  /** Pick a topic card (or put it down with null). */
  pickTopic(id: string | null): void;
  /** Ask about a topic card. */
  askTopic(id: string, mode: "about" | "when"): Promise<boolean>;
  /** From the result card: a new visit at the same difficulty, with a different puzzle (design plan D4). */
  another(): Promise<void>;
  /** Visit today's Daily Grandma. */
  startDaily(): Promise<void>;
  /** Fetch today's Daily Grandma again (after a visit, or when the day rolls over). */
  refreshDaily(): void;
  /** Ask Grandma; resolves false if the question didn't reach her (so the box can keep it). */
  ask(text: string, voice?: { confidence: number }, topic?: { id: string; mode: "about" | "when" }): Promise<boolean>;
  /** Returns how the guess went, or null if it couldn't be sent. */
  guess(parts: string[]): Promise<{ correct: boolean; partsCorrect?: number; partsTotal?: number; partsRight?: boolean[] } | null>;
  openPanel(panel: Panel): void;
  focusChat(): void;
  setFocus(id: string | null): void;
  /** Open or shut a fixture's door (the fridge). */
  setOpened(id: string, open: boolean): void;
  setTalking(talking: boolean): void;
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

  /**
   * The first time the player picks something up (or opens it), Grandma reacts: a canned line, no model call,
   * no tea, no facts. The room and the conversation feed each other (plan C2).
   */
  const bark = (objId: string) => {
    const run = get().run;
    if (run?.status !== "playing" || barked.has(objId)) return;
    barked.add(objId);
    const variants = ["a", "b"].map((v) => `bark.${objId}.${v}`).filter(hasString);
    const pickIt = variants[(run.runId.length + objId.length + barked.size) % Math.max(1, variants.length)];
    if (pickIt) push({ who: "grandma", text: t(pickIt), mood: "teasing" });
  };

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

  /** A new topic card turned up: say so, with a flick of paper. */
  const newCards = (labels: string[]) => {
    push({ who: "system", text: t("cards.new", { labels: labels.join(", ") }) });
    cardFlick();
  };

  /** Everything a reply from Grandma does to the log and the state. */
  const afterReply = (res: AskResponse) => {
    push({ who: "grandma", text: res.reply, mood: res.mood, cost: res.cost, costWhy: costWhy(res.costParts) });
    if (res.after) push({ who: "grandma", text: res.after, mood: "sleepy" });
    if (res.nudge) push({ who: "grandma", text: res.nudge, mood: "nostalgic" });
    learn(res.reply, "grandma");
    if (res.newTopics?.length) newCards(res.newTopics);
    set({ run: res.run });
  };

  /** Enter a freshly created visit. */
  const enter = async (run: RunView) => {
    const scene = get().scene?.id === run.sceneId ? get().scene : await api.scene(run.sceneId);
    barked.clear();
    set({ run, scene, log: [{ who: "grandma", text: run.greeting, mood: "happy", seq: ++seq }], panel: null, noteSeen: false, talking: false, inspected: [], opened: [], notebook: [], pins: [], hint: null, mishear: null, view: "grandma", pickedTopic: null });
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
    noteSeen: false,
    chatFocusTick: 0,
    talking: false,
    hint: null,
    mishear: null,
    inspected: [], opened: [],
    notebook: [],
    pins: [],
    grandmaSpeaking: false,
    listening: false,
    voiceTick: 0,
    view: "grandma",
    notes: null,
    pickedTopic: null,
    lastTopic: null,

    async init() {
      void api.notes().then(
        (r) => set({ notes: r.notes }),
        () => set({ notes: [] }),
      );
      // The room shows behind the title screen, so fetch it now.
      void api.scene("rosie-living-room").then(
        (scene) => set((s) => (s.scene ? {} : { scene })),
        () => undefined,
      );
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

    async startNote(recipeId) {
      markVisited();
      await act(async () => enter(await api.createRunFor(recipeId, useSettings.getState().relaxed)));
    },

    goView(view) {
      if (get().view !== view) set({ view });
    },

    tapObject(id) {
      const g = get();
      const it = g.scene?.interactables.find((i) => i.id === id);
      if (!it || g.run?.status !== "playing") return;
      if (it.kind === "grandma") {
        set({ view: "grandma" });
        return g.focusChat();
      }
      if (it.view) set({ view: it.view });
      if (it.kind === "note") return g.openPanel({ type: "note" });
      if (it.kind === "router") return g.openPanel({ type: "router" });
      if (it.kind === "fixture") g.setOpened(it.id, true);
      g.openPanel({ type: "inspect", objectId: it.id });
    },

    async showObject(id) {
      const { run } = get();
      const obj = get().scene?.interactables.find((i) => i.id === id);
      if (!run || !obj) return;
      if (get().busy) return get().showHint(t("talk.wait"));
      set({ panel: null, view: "grandma" });
      push({ who: "player", text: `[shows the ${obj.label}]` });
      set({ lastTopic: null });
      const res = await act(() => api.show(run.runId, obj.id));
      if (!res) {
        push({ who: "system", text: t("error.showFailed", { item: obj.label }) });
        return;
      }
      afterReply(res);
    },

    async offerCookie() {
      const run = get().run;
      if (!run) return;
      if (get().busy) return get().showHint(t("talk.wait"));
      set({ panel: null, view: "grandma" });
      const res = await act(() => api.cookie(run.runId));
      if (!res) {
        push({ who: "system", text: t("error.showFailed", { item: t("cookie.label") }) });
        return;
      }
      push({ who: "grandma", text: res.line, mood: "happy" });
      set({ run: res.run });
    },

    async callMichael() {
      const run = get().run;
      if (!run) return;
      const res = await act(() => api.phone(run.runId));
      if (!res) return;
      push({ who: "michael", text: res.line });
      if (res.newTopics?.length) newCards(res.newTopics);
      set({ run: res.run, panel: null });
    },

    pickTopic(id) {
      set({ pickedTopic: id });
    },

    async askTopic(id, mode) {
      const run = get().run;
      const card = run?.topics.find((c) => c.id === id);
      if (!run || !card) return false;
      // A smudged part reads "…" in the chat, not raw █ blocks.
      const ok = await get().ask(topicQuestion(card.label.replace(/█+/g, "…"), mode, card.kind), undefined, { id, mode });
      if (ok) set({ pickedTopic: null });
      return ok;
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

    async ask(text, voice, topic) {
      const run = get().run;
      if (!run || !text.trim() || get().busy) return false;
      // She should be in view while she answers (floor: the protagonist is visible while you talk).
      set({ view: "grandma" });
      push({ who: "player", text });
      const res = await act(() => api.ask(run.runId, text, voice, topic));
      if (!res) {
        push({ who: "system", text: t("error.askFailed") });
        return false;
      }
      set({ lastTopic: topic?.id ?? null });
      if (res.misheard) {
        push({ who: "system", text: t("mishear.line", { heard: res.misheard.heard }) });
        set({ mishear: { as: res.misheard.as, at: Date.now() } });
      }
      afterReply(res);
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

    async putOnGlasses() {
      const run = get().run;
      if (!run) return;
      const res = await act(() => api.glasses(run.runId));
      if (!res) return;
      push({ who: "grandma", text: res.line, mood: "happy" });
      const cleared = !run.glasses && res.run.glasses;
      set({ run: res.run, panel: cleared ? { type: "note" } : null, noteSeen: true });
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
      if (run0 && panel?.type === "inspect" && run0.status === "playing") {
        // Looking closely can bring up topic cards (names on a photo); the server says which.
        void api.look(run0.runId, panel.objectId).then(
          (r) => {
            if (get().run?.runId !== r.run.runId) return;
            set({ run: r.run });
            if (r.newTopics.length) newCards(r.newTopics);
          },
          () => undefined,
        );
      }
      set({ panel, noteSeen: get().noteSeen || panel?.type === "note" });
      if (panel?.type === "inspect") {
        const obj = get().scene?.interactables.find((i) => i.id === panel.objectId);
        if (obj?.kind === "clue" && !get().inspected.includes(obj.id)) set({ inspected: [...get().inspected, obj.id] });
        if (obj?.inspect_text) learn(obj.inspect_text, "object");
        if (obj) bark(obj.id);
      }
    },
    setOpened(id, open) {
      const opened = get().opened;
      if (opened.includes(id) === open) return;
      set({ opened: open ? [...opened, id] : opened.filter((o) => o !== id) });
      fridgeDoor(open);
      if (open) bark(id);
    },
    focusChat() {
      set((s) => ({ panel: null, chatFocusTick: s.chatFocusTick + 1 }));
    },
    setFocus(id) {
      if (get().focusId !== id) set({ focusId: id });
    },
    setTalking(talking) {
      if (get().talking !== talking) set({ talking });
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
      // Leave the text box: by what has focus, not only the talking flag (focus events can be missed).
      const el = document.activeElement;
      if ((talking || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el instanceof HTMLElement && el !== document.body) {
        el.blur();
        set({ talking: false });
        return true;
      }
      return false;
    },
    leave() {
      window.speechSynthesis?.cancel();
      set({ run: null, log: [], panel: null, talking: false, grandmaSpeaking: false, hint: null, mishear: null });
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
