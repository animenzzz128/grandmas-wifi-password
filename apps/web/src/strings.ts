/** Player-facing text comes from data/i18n (technical design §8.3 rule 4). Never hard-code UI copy in components. */
import en from "../../../data/i18n/en.json";
import { fill } from "@gwp/engine";
import { keyLabel, useSettings } from "./settings.ts";

/** The player's current keys, for strings like "{use} · Talk to Grandma" (keys can be remapped in Settings). */
function keyVars(): Record<string, string> {
  const k = useSettings.getState().keys;
  const move = [k.forward, k.left, k.back, k.right].map(keyLabel);
  return {
    move: move.every((m) => m.length === 1) ? move.join("") : move.join("/"),
    use: keyLabel(k.use),
    putBack: keyLabel(k.putBack),
    notebook: keyLabel(k.notebook),
    speak: keyLabel(k.speak),
  };
}

const ui: Record<string, string> = en.ui;

/** Whether a UI string exists (for optional lines, such as Grandma's reaction to an object). */
export function hasString(key: string): boolean {
  return ui[key] !== undefined;
}

/** Looks up a UI string. With n === 1, a `<key>.one` variant wins if there is one ("1 question"). */
export function t(key: string, vars: Record<string, string | number> = {}): string {
  const template = (vars.n === 1 ? ui[`${key}.one`] : undefined) ?? ui[key];
  if (template === undefined) {
    if (import.meta.env.DEV) console.warn(`missing string: ${key}`);
    return key;
  }
  return fill(template, /{(move|use|putBack|notebook|speak)}/.test(template) ? { ...keyVars(), ...vars } : vars);
}
