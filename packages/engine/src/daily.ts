/**
 * Daily Grandma (game design §5): everyone gets the same Grandma and note on the same UTC day.
 * The puzzle of day N comes from the pool of every (Grandma, recipe) pair. Each cycle of
 * pool-size days is a seeded shuffle, so every puzzle comes up once per cycle, in an order players
 * can't guess, and never twice in a row across a cycle boundary. Adding Grandmas or recipes to
 * data/ grows the pool; the cycle simply gets longer.
 */
import type { Difficulty, GrandmaWorld } from "./world.ts";
import { hashString, rng } from "./text.ts";

/** Day #1 of the Daily Grandma (UTC). */
export const DAILY_EPOCH = "2026-11-13";

export interface DailyPick {
  /** "Grandma #N": 1 on the epoch day. */
  number: number;
  /** The UTC day, YYYY-MM-DD. */
  date: string;
  worldId: string;
  recipeId: string;
  difficulty: Difficulty;
}

const DAY_MS = 86_400_000;

export const utcDate = (d: Date) => d.toISOString().slice(0, 10);

/** Day number for a date (UTC): 1 on DAILY_EPOCH. Days before the epoch count as day 1. */
export function dailyNumber(now: Date): number {
  const epoch = Date.parse(`${DAILY_EPOCH}T00:00:00Z`);
  const today = Date.parse(`${utcDate(now)}T00:00:00Z`);
  return Math.max(1, Math.floor((today - epoch) / DAY_MS) + 1);
}

/** Seconds until the next UTC midnight (when the daily changes). */
export function secondsToNextDaily(now: Date): number {
  const next = Date.parse(`${utcDate(now)}T00:00:00Z`) + DAY_MS;
  return Math.max(0, Math.ceil((next - now.getTime()) / 1000));
}

type Entry = { worldId: string; recipeId: string; difficulty: Difficulty };

/** Every (Grandma, recipe) pair, in a stable order that doesn't depend on load order. */
export function dailyPool(worlds: Iterable<GrandmaWorld>): Entry[] {
  const pool: Entry[] = [];
  for (const w of worlds) for (const r of w.recipes) pool.push({ worldId: w.id, recipeId: r.id, difficulty: r.difficulty });
  return pool.sort((a, b) => `${a.worldId}/${a.recipeId}`.localeCompare(`${b.worldId}/${b.recipeId}`));
}

function cycleOrder(pool: readonly Entry[], cycle: number): Entry[] {
  const order = [...pool];
  const rand = rng(hashString(`daily:${cycle}`));
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

/** The order of one cycle, fixed so its first puzzle differs from the previous cycle's last. */
function cycle(pool: readonly Entry[], c: number): Entry[] {
  let last: Entry | undefined;
  let order: Entry[] = [];
  for (let k = 0; k <= c; k++) {
    order = cycleOrder(pool, k);
    if (last && order.length > 1 && order[0] === last) [order[0], order[1]] = [order[1]!, order[0]!];
    last = order[order.length - 1];
  }
  return order;
}

export function dailyPick(worlds: Iterable<GrandmaWorld>, now: Date): DailyPick | undefined {
  const pool = dailyPool(worlds);
  if (!pool.length) return undefined;
  const number = dailyNumber(now);
  const i = number - 1;
  const entry = cycle(pool, Math.floor(i / pool.length))[i % pool.length]!;
  return { number, date: utcDate(now), ...entry };
}
