/**
 * Best stars per difficulty tier, kept in this browser for the title screen's picker. Notes are drawn from the part
 * bank now (docs/15), so stars belong to the tier ("easy"), not to one note. Stars saved per note before that
 * ("r_easy_2", "medium:street_tv+painted_number") count for their tier.
 */
import { storage as defaultStorage } from "./storage.ts";
import type { KeyValueStore } from "./storage.ts";

const KEY = "gwp-note-stars";

/** The tier a saved key belongs to: "r_easy_2" and "easy:sock_thief+wedding_year" are both "easy". */
export function tierOf(key: string): string {
  const m = /^(?:r_)?(easy|medium|hard|expert)(?![a-z])/.exec(key);
  return m ? m[1]! : key;
}

function load(storage: KeyValueStore): Record<string, number> {
  try {
    const raw = JSON.parse(storage.getItem(KEY) ?? "{}") as unknown;
    return raw && typeof raw === "object" ? (raw as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** Best stars per tier. */
export function loadNoteStars(storage: KeyValueStore = defaultStorage): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(load(storage))) if (typeof v === "number") out[tierOf(k)] = Math.max(out[tierOf(k)] ?? 0, v);
  return out;
}

/** Keep the better of the saved and the new stars for a tier. Returns the best stars per tier. */
export function saveNoteStars(tier: string, stars: number, storage: KeyValueStore = defaultStorage): Record<string, number> {
  const all = loadNoteStars(storage);
  if ((all[tier] ?? -1) < stars) {
    all[tier] = stars;
    storage.setItem(KEY, JSON.stringify(all));
  }
  return all;
}
