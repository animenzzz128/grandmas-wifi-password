/** Player settings, saved in this browser (Game Accessibility Guidelines basics). */
import { create } from "zustand";

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
}

const KEY = "gwp-settings";
const DEFAULTS: Settings = { sensitivity: 1, fov: 70, invertY: false, relaxed: false, retro: true, voice: typeof window !== "undefined" && "speechSynthesis" in window ? "spoken" : "blips", textScale: 1, readableFont: false, roomSound: true, typeOut: true };

function load(): Settings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
}

/** Push the text settings onto the page (CSS reads --text-scale and the .readable class). */
export function applyTextSettings(s: Pick<Settings, "textScale" | "readableFont">, root: HTMLElement = document.documentElement) {
  const scale = Math.min(1.6, Math.max(0.85, s.textScale || 1));
  root.style.setProperty("--text-scale", String(scale));
  root.classList.toggle("readable", s.readableFont);
}

export const useSettings = create<Settings & { set(patch: Partial<Settings>): void }>((set) => ({
  ...load(),
  set(patch) {
    set(patch);
    const { set: _omit, ...plain } = { ...useSettings.getState(), ...patch };
    localStorage.setItem(KEY, JSON.stringify(plain));
  },
}));
