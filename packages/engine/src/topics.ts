/**
 * Topic cards (ported from the Godot edition). Every name Grandma says, or a clue mentions, becomes a card the
 * player can tap: "Tell me about it" tells that topic's next memory, "When was that?" its dated one. The cards
 * are a second way to ask, next to typing: they work on a phone, show the player what they know, and turn the
 * search into following a trail instead of guessing keywords.
 *
 * The card decides WHICH memory she tells (deterministic, so every puzzle stays testable); the LLM, when it's
 * on, only decides how she tells it. A year the note hides is never said: she says its time phrase instead.
 */
import type { Fact, GrandmaWorld, Recipe, Topic } from "./world.ts";
import { factById } from "./world.ts";

export type TopicKind = Topic["kind"] | "note";
export type AskMode = "about" | "when";

/** A card as the server knows it: its memories stay server-side. */
export interface TopicDef {
  id: string;
  label: string;
  kind: TopicKind;
  match: string[];
  facts: string[];
}

const NOTE = "note_";

/** The world's topics, or, for a world without curated ones (a generated Grandma), one per entity. */
export function worldTopics(world: GrandmaWorld): TopicDef[] {
  if (world.topics?.length) return world.topics.map((t) => ({ id: t.id, label: t.label, kind: t.kind, match: t.match ?? [], facts: t.facts }));
  const kindOf = (type: string): Topic["kind"] => (type === "person" || type === "pet" || type === "place" || type === "event" ? type : "thing");
  return world.entities
    .filter((e) => e.id !== world.id)
    .map((e) => ({
      id: e.id.replace(/[^a-z0-9_]/g, "_"),
      label: e.relation_to_player ? `${e.name} (${e.relation_to_player.replace(/^your /, "")})` : e.name,
      kind: kindOf(e.type),
      match: [e.name, ...(e.aliases ?? [])],
      facts: world.facts.filter((f) => f.subject === e.id || f.object === e.id).map((f) => f.id),
    }))
    .filter((t) => t.facts.length > 0);
}

/** The note's parts, split at "+", without a bare suffix like "!". */
export function noteParts(text: string): string[] {
  return text
    .split("+")
    .map((p) => p.trim())
    .filter((p) => /[a-z]{2,}/i.test(p));
}

/** The note's own cards: one per part, labelled with the part as the player can read it now. */
export function noteTopics(recipe: Recipe, shownNote: string): TopicDef[] {
  const shown = noteParts(shownNote);
  return noteParts(recipe.note_text).map((part, i) => ({
    id: `${NOTE}${i}`,
    label: shown[i] ?? part,
    kind: "note" as const,
    match: [],
    facts: recipe.note_facts?.[i] ?? [recipe.slots[i]?.fact_id].filter((x): x is string => Boolean(x)),
  }));
}

/** Can the player read this card? A note part still smudged (█) can't be asked about until the glasses go on. */
export function topicReadable(topic: TopicDef): boolean {
  return !topic.label.includes("█");
}

export function topicById(world: GrandmaWorld, recipe: Recipe, shownNote: string, id: string): TopicDef | undefined {
  return id.startsWith(NOTE) ? noteTopics(recipe, shownNote).find((t) => t.id === id) : worldTopics(world).find((t) => t.id === id);
}

/** The cards a visit starts with: the note's parts first, then the world's starting cards. */
export function startingTopics(world: GrandmaWorld, recipe: Recipe): string[] {
  const all = new Set(worldTopics(world).map((t) => t.id));
  const start = (world.start_topics ?? []).filter((id) => all.has(id));
  return [...noteTopics(recipe, recipe.note_text).map((t) => t.id), ...start];
}

const isLetter = (c: string | undefined) => c !== undefined && /[a-z]/i.test(c);

/** Does `haystack` contain `needle` as whole words? A plural "s" after it counts ("the dogs" has "dog"). */
export function hasPhrase(haystack: string, needle: string): boolean {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (!n) return false;
  for (let at = h.indexOf(n); at >= 0; at = h.indexOf(n, at + 1)) {
    const end = at + n.length;
    if (!isLetter(h[at - 1]) && (!isLetter(h[end]) || (h[end] === "s" && !isLetter(h[end + 1])))) return true;
  }
  return false;
}

/** Cards that `text` unlocks and the player doesn't have yet, in the world's order. */
/**
 * A capitalised name must appear capitalised: "a jar of dill pickles" in the fridge mustn't unlock "Pickles the
 * cat" (review 3, F9). Her replies and the object texts are written properly, so names always are.
 */
function capitalisedIn(text: string, name: string): boolean {
  const lower = text.toLowerCase();
  const n = name.toLowerCase();
  for (let at = lower.indexOf(n); at >= 0; at = lower.indexOf(n, at + 1)) if (text[at] === name[0]) return true;
  return false;
}

export function discoverTopics(world: GrandmaWorld, text: string, known: readonly string[]): string[] {
  const have = new Set(known);
  return worldTopics(world)
    .filter((t) => !have.has(t.id) && t.match.some((m) => hasPhrase(text, m) && (!/^\p{Lu}/u.test(m) || capitalisedIn(text, m))))
    .map((t) => t.id);
}

export type TopicPick =
  | { kind: "fact"; factId: string; repeat: boolean }
  /** "When was that?" about something with no date. */
  | { kind: "no_year" }
  /** A card with no memories at all (shouldn't happen with checked data). */
  | { kind: "nothing" };

/**
 * Which memory a card ask tells. "about": the topic's first memory she hasn't told yet, else (a repeat) its first.
 * "when": its first dated memory she hasn't dated yet, else (a repeat) its first dated one.
 */
export function pickTopicFact(world: GrandmaWorld, topic: TopicDef, mode: AskMode, heard: readonly string[], heardWhen: readonly string[]): TopicPick {
  const facts = topic.facts.map((id) => factById(world, id)).filter((f): f is Fact => Boolean(f));
  if (mode === "when") {
    const dated = facts.filter((f) => f.year !== undefined);
    if (!dated.length) return { kind: "no_year" };
    const fresh = dated.find((f) => !heardWhen.includes(f.id));
    return { kind: "fact", factId: (fresh ?? dated[0]!).id, repeat: !fresh };
  }
  if (!facts.length) return { kind: "nothing" };
  const fresh = facts.find((f) => !heard.includes(f.id));
  return { kind: "fact", factId: (fresh ?? facts[0]!).id, repeat: !fresh };
}

/** What the player says when they tap a card, in their own words (logged, and shown in the chat). */
export function topicQuestion(label: string, mode: AskMode, kind: TopicKind): string {
  const what = kind === "note" ? `"${label}"` : label;
  return mode === "when" ? `${what.charAt(0).toUpperCase()}${what.slice(1)}: when was that?` : `Tell me about ${what}.`;
}
