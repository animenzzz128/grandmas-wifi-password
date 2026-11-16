/**
 * Things a player only needs to be told once, remembered in this browser: whether they have visited before
 * (the title screen shows one big button to first-timers), and which one-time lessons they have seen
 * ("each question drinks some of her tea", taught the first time it happens; plan A1, A4).
 */
import { storage as defaultStorage } from "./storage.ts";
import type { KeyValueStore } from "./storage.ts";

const VISITED = "gwp-visited";
const LESSONS = "gwp-lessons";

export function hasVisited(store: KeyValueStore = defaultStorage): boolean {
  return store.getItem(VISITED) === "1";
}

export function markVisited(store: KeyValueStore = defaultStorage): void {
  store.setItem(VISITED, "1");
}

function seenLessons(store: KeyValueStore): string[] {
  try {
    const raw = JSON.parse(store.getItem(LESSONS) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** True the first time a lesson comes up (and remembers it), false ever after. */
export function firstTime(lesson: string, store: KeyValueStore = defaultStorage): boolean {
  const seen = seenLessons(store);
  if (seen.includes(lesson)) return false;
  store.setItem(LESSONS, JSON.stringify([...seen, lesson]));
  return true;
}
