/**
 * The player's Daily Grandma record, kept in this browser (game design §5). Only the first finished
 * visit of a day counts; replays that day are practice. Global stats would need the server.
 */
import { storage as defaultStorage } from "./storage.ts";
import type { KeyValueStore } from "./storage.ts";

export interface DailyRecord {
  number: number;
  solved: boolean;
  stars: number;
  questions: number;
}

type Store = KeyValueStore;
const KEY = "gwp-daily";
/** Records older than this many days are dropped (enough for any streak worth showing). */
const KEEP = 400;

export function loadDailyRecords(storage: Store = defaultStorage): Record<number, DailyRecord> {
  try {
    const raw = JSON.parse(storage.getItem(KEY) ?? "{}") as unknown;
    return raw && typeof raw === "object" ? (raw as Record<number, DailyRecord>) : {};
  } catch {
    return {};
  }
}

/** Save a finished daily. Returns false (and keeps the old one) if that day already has a record. */
export function saveDailyRecord(rec: DailyRecord, storage: Store = defaultStorage): boolean {
  const all = loadDailyRecords(storage);
  if (all[rec.number]) return false;
  all[rec.number] = rec;
  for (const n of Object.keys(all)) if (Number(n) <= rec.number - KEEP) delete all[Number(n)];
  try {
    storage.setItem(KEY, JSON.stringify(all));
  } catch {
    return false; // storage full or blocked: the game still plays
  }
  return true;
}

/** Days solved in a row, ending today (or yesterday, if today isn't played yet). */
export function dailyStreak(records: Record<number, DailyRecord>, today: number): number {
  let n = records[today] ? today : today - 1;
  let streak = 0;
  while (records[n]?.solved) {
    streak++;
    n--;
  }
  return streak;
}

/** "5h 12m", "12m", "<1m". */
export function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  return m ? `${m}m` : "<1m";
}
