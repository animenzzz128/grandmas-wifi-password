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
}

const KEY = "gwp-settings";
const DEFAULTS: Settings = { sensitivity: 1, fov: 70, invertY: false, relaxed: false, retro: true };

function load(): Settings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
}

export const useSettings = create<Settings & { set(patch: Partial<Settings>): void }>((set) => ({
  ...load(),
  set(patch) {
    set(patch);
    const { set: _omit, ...plain } = { ...useSettings.getState(), ...patch };
    localStorage.setItem(KEY, JSON.stringify(plain));
  },
}));
