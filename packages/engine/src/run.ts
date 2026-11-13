/**
 * Run state and the pure state transitions. The server stores RunState and only ever sends RunView
 * (see api.ts) to the client.
 */
import type { Difficulty, GrandmaWorld, Recipe } from "./world.ts";
import { RULES } from "./rules.ts";
import { chainFacts, slotParts } from "./world.ts";

export type RunStatus = "playing" | "solved" | "failed" | "bedtime";

export type Mood = "happy" | "nostalgic" | "teasing" | "confused" | "sleepy" | "suspicious" | "worried";

export interface Turn {
  role: "player" | "grandma";
  text: string;
  /** For player turns made by showing an object. */
  objectId?: string;
  factIds?: string[];
  mood?: Mood;
}

export interface RunState {
  id: string;
  worldId: string;
  recipeId: string;
  difficulty: Difficulty;
  sceneId: string;
  stamina: number;
  naps: number;
  attemptsLeft: number;
  cookies: number;
  cookiesUsed: number;
  questionCount: number;
  lastFactIds: string[];
  history: Turn[];
  guesses: string[];
  /** Accessibility: tea doesn't drain (no naps, no bedtime). Shown on the result card. */
  relaxed?: boolean;
  /** Consecutive turns that touched none of the recipe's chain facts (for nudges). */
  stall?: number;
  /** How many nudges Grandma has given (which line comes next). */
  nudges?: number;
  status: RunStatus;
  createdAt: string;
  endedAt?: string;
}

export function createRunState(args: {
  id: string;
  world: GrandmaWorld;
  recipe: Recipe;
  sceneId: string;
  greeting: string;
  relaxed?: boolean;
  now?: Date;
}): RunState {
  return {
    id: args.id,
    worldId: args.world.id,
    recipeId: args.recipe.id,
    difficulty: args.recipe.difficulty,
    sceneId: args.sceneId,
    stamina: RULES.maxStamina,
    naps: 0,
    attemptsLeft: RULES.attempts,
    cookies: RULES.cookies,
    cookiesUsed: 0,
    questionCount: 0,
    lastFactIds: [],
    history: [{ role: "grandma", text: args.greeting, mood: "happy" }],
    guesses: [],
    status: "playing",
    relaxed: args.relaxed || undefined,
    createdAt: (args.now ?? new Date()).toISOString(),
  };
}

export interface CostOutcome {
  napped: boolean;
  bedtime: boolean;
}

/** Spend stamina for one question. Grandma answers first, then naps if the teacup is empty. */
export function spendStamina(state: RunState, cost: number, now = new Date()): CostOutcome {
  state.questionCount += 1;
  if (state.relaxed) return { napped: false, bedtime: false };
  state.stamina -= cost;
  if (state.stamina > 0) return { napped: false, bedtime: false };
  state.naps += 1;
  if (state.naps >= RULES.maxNaps) {
    state.stamina = 0;
    state.status = "bedtime";
    state.endedAt = now.toISOString();
    return { napped: true, bedtime: true };
  }
  state.stamina = RULES.napRefill;
  return { napped: true, bedtime: false };
}

export function giveCookie(state: RunState): boolean {
  if (state.cookies <= 0) return false;
  state.cookies -= 1;
  state.cookiesUsed += 1;
  state.stamina = Math.min(RULES.maxStamina, state.stamina + RULES.cookieStamina);
  return true;
}

/** Exact match, as a real router would do. Leading/trailing spaces are forgiven. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface PartsResult {
  correct: boolean;
  partsCorrect: number;
  partsTotal: number;
}

/**
 * Guess by slots, the way the note is laid out ([name] + [year] + !). The game assembles the password, so
 * case, spaces and punctuation never cost a guess. A wrong guess says how many parts were right, not which
 * (partial confirmation, as in Golden Idol / Obra Dinn).
 */
export function checkGuessParts(state: RunState, world: GrandmaWorld, recipe: Recipe, parts: readonly string[], now = new Date()): PartsResult {
  const expected = slotParts(world, recipe);
  const partsCorrect = expected.filter((e, i) => parts[i] !== undefined && norm(parts[i]!) === norm(e)).length;
  const correct = partsCorrect === expected.length && parts.length === expected.length;
  state.guesses.push(parts.join(" + "));
  if (correct) {
    state.status = "solved";
    state.endedAt = now.toISOString();
  } else {
    state.attemptsLeft -= 1;
    if (state.attemptsLeft <= 0) {
      state.status = "failed";
      state.endedAt = now.toISOString();
    }
  }
  return { correct, partsCorrect, partsTotal: expected.length };
}

/**
 * Track whether the player is getting anywhere. Returns the nudge line to say now, if any: after
 * `after` turns in a row that used none of the recipe's chain facts.
 */
export function stallNudge(state: RunState, world: GrandmaWorld, recipe: Recipe, usedFactIds: readonly string[], after = 3): string | undefined {
  const chain = chainFacts(world, recipe);
  state.stall = usedFactIds.some((id) => chain.has(id)) ? 0 : (state.stall ?? 0) + 1;
  const lines = recipe.nudges ?? [];
  if (state.stall < after || !lines.length) return undefined;
  const line = lines[(state.nudges ?? 0) % lines.length]!;
  state.nudges = (state.nudges ?? 0) + 1;
  state.stall = 0;
  return line;
}

export function checkGuess(state: RunState, recipe: Recipe, guess: string, now = new Date()): boolean {
  const g = guess.trim();
  state.guesses.push(g);
  if (g === recipe.password) {
    state.status = "solved";
    state.endedAt = now.toISOString();
    return true;
  }
  state.attemptsLeft -= 1;
  if (state.attemptsLeft <= 0) {
    state.status = "failed";
    state.endedAt = now.toISOString();
  }
  return false;
}

export function parFor(recipe: Recipe): number {
  return recipe.par ?? RULES.defaultPar[recipe.difficulty];
}

/** Stars (game design §3.5): 3 = at or under par with no naps, 2 = within 2x par, 1 = solved. */
export function stars(state: RunState, recipe: Recipe): number {
  if (state.status !== "solved") return 0;
  const par = parFor(recipe);
  const base = state.questionCount <= par ? 3 : state.questionCount <= par * 2 ? 2 : 1;
  return Math.max(1, base - state.naps); // each nap costs a star (game design §3.3)
}
