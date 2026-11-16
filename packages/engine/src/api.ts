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

export const MoodSchema = z.enum(["happy", "nostalgic", "teasing", "confused", "sleepy", "suspicious", "worried"]);

export const CreateRunRequest = z.strictObject({
  grandmaId: z.string().optional(),
  difficulty: Difficulty.optional(),
  /** Accessibility option: tea doesn't drain. */
  relaxed: z.boolean().optional(),
  /** Today's Daily Grandma (same Grandma and note for everyone); grandmaId and difficulty are ignored. */
  daily: z.boolean().optional(),
});

export const AskRequest = z.strictObject({
  text: z.string().trim().min(1).max(RULES.maxQuestionChars),
  /** Present when the question was spoken: the speech recognizer's confidence (0 = it didn't say). */
  voice: z.strictObject({ confidence: z.number().min(0).max(1) }).optional(),
});

export const ShowRequest = z.strictObject({
  objectId: z.string().min(1),
  text: z.string().trim().max(RULES.maxQuestionChars).optional(),
});

export const ItemRequest = z.strictObject({
  item: z.enum(["cookie", "glasses"]),
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
  questionCount: z.number().int(),
  status: z.enum(["playing", "solved", "failed", "bedtime"]),
  greeting: z.string(),
  relaxed: z.boolean(),
  /** Daily Grandma number, when this visit is the daily puzzle. */
  daily: z.number().int().optional(),
  result: RunResult.optional(),
});

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
  run: RunView,
});

export const ItemResponse = z.strictObject({ line: z.string(), run: RunView });
export const GuessResponse = z.strictObject({
  correct: z.boolean(),
  line: z.string(),
  /** For slot guesses: how many parts were right (never which). */
  partsCorrect: z.number().int().optional(),
  partsTotal: z.number().int().optional(),
  run: RunView,
});
export const HealthResponse = z.strictObject({
  ok: z.boolean(),
  grandmaMode: z.enum(["llm", "mock"]),
  model: z.string().optional(),
  /** Why the real Grandma is offline right now: today's budget is spent, or an operator switched her off. */
  degraded: z.enum(["budget", "kill"]).optional(),
});
export const ErrorResponse = z.strictObject({ error: z.string() });

export type CreateRunRequest = z.infer<typeof CreateRunRequest>;
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
export type DailyInfo = z.infer<typeof DailyInfo>;

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
    questionCount: state.questionCount,
    status: state.status,
    greeting,
    relaxed: Boolean(state.relaxed),
    ...(state.daily ? { daily: state.daily } : {}),
    result: ended
      ? {
          solved: state.status === "solved",
          stars: stars(state, recipe),
          questions: state.questionCount,
          naps: state.naps,
          cookiesUsed: state.cookiesUsed,
          par: recipe.par ?? RULES.defaultPar[recipe.difficulty],
          ...(opts.hidePassword ? {} : { password: recipe.password }),
        }
      : undefined,
  };
}
