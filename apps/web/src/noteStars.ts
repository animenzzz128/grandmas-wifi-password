/** Best stars per sticky note, kept in this browser for the title screen's note picker. */
import { storage as defaultStorage } from "./storage.ts";
import type { KeyValueStore } from "./storage.ts";

const KEY = "gwp-note-stars";

export function loadNoteStars(storage: KeyValueStore = defaultStorage): Record<string, number> {
  try {
    const raw = JSON.parse(storage.getItem(KEY) ?? "{}") as unknown;
    return raw && typeof raw === "object" ? (raw as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** Keep the better of the saved and the new stars. Returns the record. */
export function saveNoteStars(noteId: string, stars: number, storage: KeyValueStore = defaultStorage): Record<string, number> {
  const all = loadNoteStars(storage);
  if ((all[noteId] ?? -1) < stars) {
    all[noteId] = stars;
    storage.setItem(KEY, JSON.stringify(all));
  }
  return all;
}
