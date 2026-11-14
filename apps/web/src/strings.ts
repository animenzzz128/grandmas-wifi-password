/** Player-facing text comes from data/i18n (technical design §8.3 rule 4). Never hard-code UI copy in components. */
import en from "../../../data/i18n/en.json";
import { fill } from "@gwp/engine";

const ui: Record<string, string> = en.ui;

/** Looks up a UI string. With n === 1, a `<key>.one` variant wins if there is one ("1 question"). */
export function t(key: string, vars: Record<string, string | number> = {}): string {
  const template = (vars.n === 1 ? ui[`${key}.one`] : undefined) ?? ui[key];
  if (template === undefined) {
    if (import.meta.env.DEV) console.warn(`missing string: ${key}`);
    return key;
  }
  return fill(template, vars);
}
