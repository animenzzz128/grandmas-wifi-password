/**
 * The client/server contract. Any client (the React Three Fiber one today, a Godot one later)
 * implements exactly these shapes. `npm run schema` exports them to data/schema/api.schema.json.
 */
import { z } from "zod";
import { Difficulty } from "./world.ts";
import type { GrandmaWorld, Recipe } from "./world.ts";
import type { RunState } from "./run.ts";
import { RULES } from "./rules.ts";
import { noteText, stars } from "./run.ts";
import { noteParts, noteTopics, topicReadable, worldTopics } from "./topics.ts";
import { factById, slotParts } from "./world.ts";

export const MoodSchema = z.enum(["happy", "nostalgic", "teasing", "confused", "sleepy", "suspicious", "worried"]);

/** Things players do that only the browser sees, for the play funnel (design plan E3). Names only, never text. */
export const PlayEvent = z.enum(["note", "inspect", "pin", "notebook", "share"]);
export const EventRequest = z.strictObject({
  kind: PlayEvent,
  /** Which object, for "inspect". */
  objectId: z.string().max(64).optional(),
});

export const CreateRunRequest = z.strictObject({
  grandmaId: z.string().optional(),
  difficulty: Difficulty.optional(),
  /** Accessibility option: tea doesn't drain. */
  relaxed: z.boolean().optional(),
  /** Today's Daily Grandma (same Grandma and note for everyone); grandmaId and difficulty are ignored. */
  daily: z.boolean().optional(),
  /** A specific puzzle (tests, the eval's AI player). Without it, a visit gets one of the difficulty's puzzles. */
  recipeId: z.string().max(64).optional(),
  /** The visit just finished: the next one avoids its puzzle when there's another ("Visit again"). */
  after: z.string().max(64).optional(),
});

export const AskRequest = z.strictObject({
  text: z.string().trim().min(1).max(RULES.maxQuestionChars),
  /** Asked with a topic card (topics.ts): the card's id and which button. The card picks the memory. */
  topic: z.strictObject({ id: z.string().max(64), mode: z.enum(["about", "when"]) }).optional(),
  /** Present when the question was spoken: the speech recognizer's confidence (0 = it didn't say). */
  voice: z.strictObject({ confidence: z.number().min(0).max(1) }).optional(),
});

export const ShowRequest = z.strictObject({
  objectId: z.string().min(1),
  text: z.string().trim().max(RULES.maxQuestionChars).optional(),
});

export const ItemRequest = z.strictObject({
  item: z.enum(["cookie", "glasses", "phone"]),
});

/** Either the whole password, or one entry per slot of the note (preferred: the game assembles it). */
export const GuessRequest = z
  .strictObject({
    password: z.string().min(1).max(64).optional(),
    parts: z.array(z.string().max(40)).min(1).max(6).optional(),
  })
  .refine((g) => Boolean(g.password) !== Boolean(g.parts), { message: "send either password or parts" });

export const RunResult = z.strictObject({
  solved: z.boolean(),
  stars: z.number().int().min(0).max(3),
  questions: z.number().int(),
  naps: z.number().int(),
  cookiesUsed: z.number().int(),
  par: z.number().int(),
  /**
   * Only revealed once the run is over, and for a daily not solved, only from the next day on: otherwise
   * failing on purpose with three free guesses would give away today’s answer (security review E).
   */
  password: z.string().optional(),
  /** With the password: how each part follows from the clues (iteration 56, review F10). */
  explain: z.array(z.string()).optional(),
});

/** A topic card as the player sees it. */
export const TopicView = z.strictObject({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["note", "person", "pet", "place", "event", "thing"]),
  /** Appeared since the player last asked about it. */
  fresh: z.boolean(),
  /** False for a note part that is still smudged. */
  readable: z.boolean(),
});

export const RunView = z.strictObject({
  runId: z.string(),
  grandma: z.strictObject({ name: z.string(), nickname: z.string().optional() }),
  difficulty: Difficulty,
  sceneId: z.string(),
  /** The note as the player can read it; `smudged` until they put on the reading glasses. */
  note: z.strictObject({ text: z.string(), rules: z.array(z.string()), smudged: z.boolean() }),
  /** The reading glasses are on (once per visit). */
  glasses: z.boolean(),
  /** How many parts the note asks for, and the fixed ending (e.g. "!"), for the router's slot inputs. */
  slots: z.number().int(),
  suffix: z.string(),
  passwordLength: z.number().int(),
  stamina: z.number(),
  maxStamina: z.number(),
  naps: z.number().int(),
  maxNaps: z.number().int(),
  attemptsLeft: z.number().int(),
  maxAttempts: z.number().int(),
  cookies: z.number().int(),
  /** Calls to Uncle Michael left this visit. */
  callsLeft: z.number().int(),
  questionCount: z.number().int(),
  status: z.enum(["playing", "solved", "failed", "bedtime"]),
  greeting: z.string(),
  relaxed: z.boolean(),
  /** Daily Grandma number, when this visit is the daily puzzle. */
  daily: z.number().int().optional(),
  /** The topic cards the player has, note parts first. */
  topics: z.array(TopicView),
  /** Which sticky note this is (the title screen keeps the best stars per note). */
  noteId: z.string().optional(),
  result: RunResult.optional(),
});

/** One sticky note to choose from on the title screen (no answers: the note is what the player reads anyway). */
/** A difficulty tier on the title's picker (docs/15): each visit draws a new note of it from the part bank. */
export const TierChoice = z.strictObject({
  difficulty: Difficulty,
  /** How many different notes the tier has. */
  notes: z.number().int(),
});
export const NotesResponse = z.strictObject({ tiers: z.array(TierChoice) });

/** A visit still in progress, to pick it up again after a reload (iteration 56): the run and what was said. */
export const ResumeResponse = z.strictObject({
  run: RunView,
  history: z.array(z.strictObject({ role: z.enum(["player", "grandma"]), text: z.string(), mood: z.string().optional() })),
});
export type ResumeResponse = z.infer<typeof ResumeResponse>;

/** Looking at an object can bring up new topic cards (names on a photo, a label). */
export const LookResponse = z.strictObject({ newTopics: z.array(z.string()), run: RunView });

/** Today's Daily Grandma, without spoiling the note. */
export const DailyInfo = z.strictObject({
  number: z.number().int(),
  date: z.string(),
  grandma: z.strictObject({ name: z.string(), nickname: z.string().optional() }),
  difficulty: Difficulty,
  /** Until the next daily (UTC midnight). */
  resetsInSeconds: z.number().int(),
  /** Everyone's finished visits so far today (visits, not people). Absent until there are a few. */
  stats: z.strictObject({ finished: z.number().int(), solved: z.number().int(), medianQuestions: z.number().int().optional() }).optional(),
});

/** Global stats are shown only once this many visits have finished, so one player isn't "100%". */
export const DAILY_STATS_MIN = 3;

export const CostBreakdownSchema = z.strictObject({
  base: z.number().int(),
  long: z.number().int(),
  rude: z.number().int(),
  followUp: z.number().int(),
});

export const AskResponse = z.strictObject({
  reply: z.string(),
  mood: MoodSchema,
  cost: z.number().int(),
  /** Why it cost what it did (shown next to the cost). Absent when the turn was free. */
  costParts: CostBreakdownSchema.optional(),
  napped: z.boolean(),
  /** A canned line said after the reply (nap, bedtime). */
  after: z.string().optional(),
  /** Grandma's nudge when the player seems stuck. */
  nudge: z.string().optional(),
  /** Voice mode: she misheard a word and answered the misheard question (this turn was free). */
  misheard: z.strictObject({ heard: z.string(), said: z.string(), as: z.string() }).optional(),
  /** Labels of topic cards this reply brought up. */
  newTopics: z.array(z.string()).optional(),
  run: RunView,
});

export const ItemResponse = z.strictObject({
  line: z.string(),
  /** Who said the line: Grandma, or Uncle Michael on the phone. */
  who: z.enum(["grandma", "michael"]).optional(),
  /** Labels of topic cards the line brought up. */
  newTopics: z.array(z.string()).optional(),
  run: RunView,
});
export const GuessResponse = z.strictObject({
  correct: z.boolean(),
  line: z.string(),
  /** For slot guesses: how many parts were right; on Easy and Medium also which ones. */
  partsCorrect: z.number().int().optional(),
  partsTotal: z.number().int().optional(),
  partsRight: z.array(z.boolean()).optional(),
  run: RunView,
});
export const HealthResponse = z.strictObject({
  ok: z.boolean(),
  grandmaMode: z.enum(["llm", "mock"]),
  model: z.string().optional(),
  /** Why the real Grandma is offline right now: today's budget is spent, or an operator switched her off. */
  degraded: z.enum(["budget", "kill"]).optional(),
  /** Grandma's spoken voice: ElevenLabs through the server, or the player's browser voice. */
  voice: z.enum(["elevenlabs", "browser"]).optional(),
  /** GoatCounter's count URL, when the operator turned page-view counting on (README, "Play stats"). */
  goatcounter: z.string().url().optional(),
});

/**
 * Ask the server to say lines aloud. Each line must be one Grandma said in this visit (or one of her canned
 * reactions), so the voice can't be used to read out anything else.
 */
export const VoiceRequest = z.strictObject({
  lines: z.array(z.string().min(1).max(1200)).min(1).max(6),
  mood: z.string().max(20).optional(),
});
export const ErrorResponse = z.strictObject({ error: z.string() });

export type CreateRunRequest = z.infer<typeof CreateRunRequest>;
export type EventRequest = z.infer<typeof EventRequest>;
export type AskRequest = z.infer<typeof AskRequest>;
export type ShowRequest = z.infer<typeof ShowRequest>;
export type ItemRequest = z.infer<typeof ItemRequest>;
export type GuessRequest = z.infer<typeof GuessRequest>;
export type RunView = z.infer<typeof RunView>;
export type RunResult = z.infer<typeof RunResult>;
export type AskResponse = z.infer<typeof AskResponse>;
export type ItemResponse = z.infer<typeof ItemResponse>;
export type GuessResponse = z.infer<typeof GuessResponse>;
export type HealthResponse = z.infer<typeof HealthResponse>;
export type VoiceRequest = z.infer<typeof VoiceRequest>;
export type DailyInfo = z.infer<typeof DailyInfo>;
export type TopicView = z.infer<typeof TopicView>;
export type TierChoice = z.infer<typeof TierChoice>;
export type LookResponse = z.infer<typeof LookResponse>;

export function toRunView(state: RunState, world: GrandmaWorld, recipe: Recipe, opts: { hidePassword?: boolean } = {}): RunView {
  const ended = state.status !== "playing";
  const greeting = state.history[0]?.text ?? "";
  return {
    runId: state.id,
    grandma: { name: world.profile.name, nickname: world.profile.nickname },
    difficulty: state.difficulty,
    sceneId: state.sceneId,
    note: {
      ...noteText(state, recipe),
      rules: recipe.format.rules_shown_on_note ?? [],
    },
    glasses: Boolean(state.glassesOn),
    passwordLength: recipe.password.length,
    slots: recipe.slots.length,
    suffix: recipe.literal_suffix ?? "",
    stamina: state.stamina,
    maxStamina: RULES.maxStamina,
    naps: state.naps,
    maxNaps: RULES.maxNaps,
    attemptsLeft: state.attemptsLeft,
    maxAttempts: RULES.attempts,
    cookies: state.cookies,
    callsLeft: Math.max(0, RULES.phoneCalls - (state.calls ?? 0)),
    questionCount: state.questionCount,
    status: state.status,
    greeting,
    relaxed: Boolean(state.relaxed),
    ...(state.daily ? { daily: state.daily } : {}),
    topics: topicViews(state, world, recipe),
    noteId: recipe.id,
    result: ended
      ? {
          solved: state.status === "solved",
          stars: stars(state, recipe),
          questions: state.questionCount,
          naps: state.naps,
          cookiesUsed: state.cookiesUsed,
          par: recipe.par ?? RULES.defaultPar[recipe.difficulty],
          ...(opts.hidePassword ? {} : { password: recipe.password, explain: explainParts(world, recipe) }),
        }
      : undefined,
  };
}

/**
 * After the visit: each note line, its answer, and the memories that lead there for the hidden years
 * ("year of the big snowstorm → 1977: the winter Michael broke his arm sledding…").
 */
export function explainParts(world: GrandmaWorld, recipe: Recipe): string[] {
  const lines = noteParts(recipe.note_text);
  const answers = slotParts(world, recipe);
  return recipe.slots.map((slot, i) => {
    const head = `${lines[i] ?? `part ${i + 1}`} → ${answers[i]}`;
    const anchor = slot.requires_anchor ? (world.anchors ?? []).find((a) => a.id === slot.requires_anchor) : undefined;
    if (!anchor) return head;
    const via = (anchor.via_fact_ids ?? []).map((id) => factById(world, id)?.text).filter(Boolean);
    return `${head}: ${anchor.phrase}${via.length ? `. ${via.join(" ")}` : ""}`;
  });
}

/** The player's cards, note parts first, labelled as they can read them now. */
export function topicViews(state: RunState, world: GrandmaWorld, recipe: Recipe): TopicView[] {
  const shown = noteText(state, recipe).text;
  const defs = new Map([...noteTopics(recipe, shown), ...worldTopics(world)].map((t) => [t.id, t]));
  const fresh = new Set(state.freshTopics ?? []);
  return (state.topics ?? [])
    .map((id) => defs.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .map((t) => ({ id: t.id, label: t.label, kind: t.kind, fresh: fresh.has(t.id), readable: topicReadable(t) }));
}
