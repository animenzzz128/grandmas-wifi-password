/** Player settings, saved in this browser (Game Accessibility Guidelines basics). */
import { create } from "zustand";
import { storage } from "./storage.ts";

/** Actions a player can put on other keys (Game Accessibility Guidelines: remappable controls). Arrows always walk. */
export const ACTIONS = ["forward", "back", "left", "right", "use", "putBack", "notebook", "speak"] as const;
export type Action = (typeof ACTIONS)[number];
export const DEFAULT_KEYS: Record<Action, string> = { forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD", use: "KeyE", putBack: "KeyQ", notebook: "Tab", speak: "KeyV" };

/** Bind a key to an action; if another action had that key, it takes this action's old key (a swap). */
export function rebind(keys: Record<Action, string>, action: Action, code: string): Record<Action, string> {
  const next = { ...keys };
  const other = ACTIONS.find((a) => a !== action && next[a] === code);
  if (other) next[other] = next[action];
  next[action] = code;
  return next;
}

const ARROWS: Record<string, string> = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };

/** "KeyW" → "W", "Digit1" → "1", "ArrowUp" → "↑", "Tab" → "Tab". */
export function keyLabel(code: string): string {
  return ARROWS[code] ?? code.replace(/^Key/, "").replace(/^Digit/, "").replace(/^Numpad/, "Num ");
}

export interface Settings {
  /** Multiplies mouse-look speed (0.3–2.5). */
  sensitivity: number;
  /** Vertical field of view in degrees (60–95). */
  fov: number;
  invertY: boolean;
  /** Tea doesn't drain (applies from the next visit). */
  relaxed: boolean;
  /** Retro palette and dither post-process. */
  retro: boolean;
  /** Grandma's voice: read aloud by the browser, babble blips, or none. */
  voice: "spoken" | "blips" | "off";
  /** Size of all game text and panels (0.85–1.6). GDD §10. */
  textScale: number;
  /** Plain, widely spaced sans-serif everywhere (including the handwritten note). GDD §10. */
  readableFont: boolean;
  /** The room's ambience (a ticking clock). GDD §8.2. */
  roomSound: boolean;
  /** Grandma's new lines type out word by word (GDD §8.1); off shows them at once. */
  typeOut: boolean;
  /** Volumes (0–1) for the three sound channels (Game Accessibility Guidelines: separate volume controls). */
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  /** Which key does what. */
  keys: Record<Action, string>;
  /** While you talk, the camera eases round to face Grandma (plan C3). */
  cameraAssist: boolean;
  /** Darker, opaque panels and bolder text (Xbox Accessibility Guideline 102). */
  highContrast: boolean;
}

const KEY = "gwp-settings";
const DEFAULTS: Settings = { sensitivity: 1, fov: 70, invertY: false, relaxed: false, retro: true, voice: typeof window !== "undefined" && "speechSynthesis" in window ? "spoken" : "blips", textScale: 1, readableFont: false, roomSound: true, typeOut: true, musicVolume: 0.35, sfxVolume: 1, voiceVolume: 1, keys: DEFAULT_KEYS, cameraAssist: true, highContrast: false };

function load(): Settings {
  try {
    const saved = JSON.parse(storage.getItem(KEY) ?? "{}") as Partial<Settings>;
    return { ...DEFAULTS, ...saved, keys: { ...DEFAULT_KEYS, ...(saved.keys ?? {}) } };
  } catch {
    return DEFAULTS;
  }
}

/** Push the text settings onto the page (CSS reads --text-scale and the .readable class). */
export function applyTextSettings(s: Pick<Settings, "textScale" | "readableFont"> & { highContrast?: boolean }, root: HTMLElement = document.documentElement) {
  const scale = Math.min(1.6, Math.max(0.85, s.textScale || 1));
  root.style.setProperty("--text-scale", String(scale));
  root.classList.toggle("readable", s.readableFont);
  root.classList.toggle("contrast", Boolean(s.highContrast));
}

export const useSettings = create<Settings & { set(patch: Partial<Settings>): void }>((set) => ({
  ...load(),
  set(patch) {
    set(patch);
    const { set: _omit, ...plain } = { ...useSettings.getState(), ...patch };
    storage.setItem(KEY, JSON.stringify(plain));
  },
}));
