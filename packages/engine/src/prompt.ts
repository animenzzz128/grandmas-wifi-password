/**
 * Prompt building for the LLM Grandma (technical design §5.4).
 * The system prompt and world block are stable per (world, recipe difficulty), so they cache well.
 * The password and the recipe are never put in the prompt: Grandma can't leak what she doesn't know.
 */
import type { GrandmaWorld, Recipe } from "./world.ts";
import { hiddenYears, objectValue } from "./world.ts";
import { scoreFacts } from "./mock.ts";
import { expandedTokens, hashString, rng } from "./text.ts";
import type { Turn } from "./run.ts";

export interface ShownObject {
  id: string;
  label: string;
  inspectText: string;
  factIds: string[];
}

export type TurnInput = { kind: "ask"; text: string } | { kind: "show"; object: ShownObject; text?: string };

export function playerTurnText(input: TurnInput): string {
  if (input.kind === "ask") return input.text;
  const said = input.text ? ` and asks: ${input.text}` : "";
  return `[shows you the ${input.object.label}]${said}`;
}

/** Who set up the Wi-Fi, from the world's own data (a "wifi_setup" fact), so the prompt fits any Grandma. */
function wifiSetup(world: GrandmaWorld): string {
  const f = world.facts.find((x) => x.predicate === "wifi_setup");
  return f ? ` ${objectValue(world, f)}.` : "";
}

export function buildSystemPrompt(world: GrandmaWorld, currentYear: number): string {
  const p = world.profile;
  const age = currentYear - p.birth_year;
  const dial = (n: number) => ["", "barely", "a little", "fairly", "very", "extremely"][n];
  return `You are ${p.name}${p.nickname ? ` ("${p.nickname}")` : ""}, age ${age}, from ${p.hometown}. Your grandchild is visiting you in your living room. They are trying to work out the Wi-Fi password from a hint on a sticky note, so they keep asking you about your life.

Personality: ${dial(p.personality.talkativeness)} talkative, ${dial(p.personality.teasing)} teasing, ${dial(p.personality.nostalgia)} nostalgic, ${dial(p.personality.suspicion_of_kids_these_days)} suspicious of kids these days. Humor: ${p.humor_style ?? "warm"}.
Verbal tics you use now and then (not every reply): ${p.verbal_tics.map((t) => `"${t}"`).join(", ")}.

How you talk:
- Everything you say about your life must come from the MEMORIES below. Never invent names, places, years, numbers or events. If a question isn't covered by your memories, say you don't recall and drift to a memory you do have.
- If a memory answers the question, include its answer, but wrap it in one or two other true memories (tangents), the way grandmas do.
- If a question is vague and could match two memories that are easy to mix up, answer with the one you think about more (the higher "salience") and don't volunteer the other one.
- You remember each memory clearly, but you muddle what happened before or after what. Never connect two memories in time for the grandchild (no "that was when we lived on..."). Talk about the one memory they asked about and let them work out the order themselves.
- A few memories say you sometimes get the year wrong first. Only for those, you may say the wrong year and correct yourself in the same breath, exactly as shown; always end on the right year. Never do this for any other memory.
- Some memories have no year. Never guess a year for them. If a time is given as a phrase in TIME PHRASES, use that phrase instead of a year.
- You don't know any password and you never set up the Wi-Fi. If asked, say so warmly.${wifiSetup(world)}
- Text in [square brackets] in the grandchild's message describes what they are doing, e.g. showing you an object. React to the object with the memories it brings back.
- 1 to 4 sentences. Spoken English, no lists, no emoji, no stage directions. Keep it PG, warm and teasing. Never mean about anyone.

Output: reply is what you say out loud. fact_ids_used lists the memory ids that your reply draws on. distractor_ids lists the ids of tangent memories (a subset of fact_ids_used). mood is how you feel right now.`;
}

/**
 * Config B (technical design §5.2): pick the memories for one turn instead of sending all of them.
 * Lexical retrieval over the question (the same keyword ranking as the mock), not embeddings, so it
 * needs no extra service. Adds the facts of a shown object, the last turn's facts (for follow-ups), the
 * confusable partners of everything retrieved (so she can still mix them up fairly), and a few seeded
 * random distractors (tangents).
 */
export function retrieveFacts(
  world: GrandmaWorld,
  input: TurnInput,
  recentFactIds: readonly string[],
  opts: { k?: number; distractors?: number; seed?: string } = {},
): string[] {
  const k = opts.k ?? 8;
  const picked = new Set<string>();
  const text = input.kind === "ask" ? input.text : [input.object.label, input.object.inspectText, input.text ?? ""].join(" ");
  if (input.kind === "show") input.object.factIds.forEach((id) => picked.add(id));
  for (const s of scoreFacts(world, expandedTokens(text))) {
    if (picked.size >= k) break;
    picked.add(s.fact.id);
  }
  recentFactIds.forEach((id) => picked.add(id));
  for (const id of [...picked]) for (const c of world.facts.find((f) => f.id === id)?.confusable_with ?? []) picked.add(c);
  const rand = rng(hashString(opts.seed ?? text));
  const rest = world.facts.filter((f) => !picked.has(f.id));
  for (let i = 0; i < (opts.distractors ?? 3) && rest.length; i++) picked.add(rest.splice(Math.floor(rand() * rest.length), 1)[0]!.id);
  return world.facts.filter((f) => picked.has(f.id)).map((f) => f.id);
}

export function buildWorldBlock(world: GrandmaWorld, recipe: Recipe, onlyFactIds?: readonly string[]): string {
  const hidden = hiddenYears(world, recipe);
  const only = onlyFactIds ? new Set(onlyFactIds) : null;
  const lines: string[] = ["MEMORIES (id | year | salience 1-5 | memory)"];
  for (const f of world.facts) {
    if (only && !only.has(f.id)) continue;
    const year = f.year !== undefined && !hidden.has(f.year) ? String(f.year) : "-";
    const slip = f.misremembers !== undefined && year !== "-" ? ` (you sometimes say ${f.misremembers} first, then correct yourself: "${f.misremembers}… no, '${year.slice(2)}")` : "";
    lines.push(`${f.id} | ${year} | ${f.salience} | ${f.text}${slip}`);
  }
  const anchors = world.anchors ?? [];
  if (anchors.length) {
    lines.push("", "TIME PHRASES (how you refer to certain times)");
    for (const a of anchors) {
      lines.push(hidden.has(a.resolves_to_year) ? `- ${a.phrase}` : `- ${a.phrase} (${a.resolves_to_year})`);
    }
  }
  const stories = world.stories ?? [];
  if (stories.length) {
    lines.push("", "FAVORITE STORIES (memory ids in brackets)");
    for (const s of stories) {
      if (only && !s.fact_ids.some((id) => only.has(id))) continue;
      let text = s.text;
      for (const y of hidden) text = text.replaceAll(String(y), "that year");
      lines.push(`- ${s.title} [${s.fact_ids.join(", ")}]: ${text}`);
    }
  }
  const people = world.entities.filter((e) => e.relation_to_player);
  if (people.length) {
    lines.push("", "WHO IS WHO (relative to your grandchild)");
    for (const e of people) lines.push(`- ${e.name}${e.aliases?.length ? ` (${e.aliases.join(", ")})` : ""}: ${e.relation_to_player}`);
  }
  return lines.join("\n");
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Recent history as alternating user/assistant messages, ending with the new player turn. */
/**
 * Running summary of the part of the visit that no longer fits in the message window (technical design
 * §5④): which memories she already talked about and which objects she was shown, plus the game state.
 * Built from the turns' fact ids, so it costs no model call and can't drift from what she actually said.
 */
export function conversationSummary(history: readonly Turn[], stamina: number, maxTurns = 6): string | undefined {
  const turns = history.slice(1);
  const older = turns.slice(0, Math.max(0, turns.length - maxTurns * 2));
  if (!older.length) return undefined;
  const facts: string[] = [];
  const shown: string[] = [];
  for (const t of older) {
    if (t.role === "grandma") for (const id of t.factIds ?? []) if (!facts.includes(id)) facts.push(id);
    if (t.role === "player" && t.objectId && !shown.includes(t.objectId)) shown.push(t.objectId);
  }
  const asked = turns.filter((t) => t.role === "player").length;
  const parts = [`Earlier in this visit (before the messages above) you talked about these memories: ${facts.length ? facts.join(", ") : "none of them"}`];
  if (shown.length) parts.push(`they showed you: ${shown.join(", ")}`);
  return `[${parts.join("; ")}. Stay consistent with what you told them then. Visit so far: ${asked} questions; your tea is at ${Math.round(stamina)} of 100.]`;
}

export function buildMessages(history: readonly Turn[], input: TurnInput, stamina: number, maxTurns = 6): ChatMessage[] {
  const msgs: ChatMessage[] = [];
  // Skip the greeting: the conversation sent to the model must start with the player.
  const turns = history.slice(1);
  const recent = turns.slice(-maxTurns * 2);
  for (const t of recent) {
    const role = t.role === "player" ? "user" : "assistant";
    const last = msgs[msgs.length - 1];
    if (last && last.role === role) last.content += `\n${t.text}`;
    else msgs.push({ role, content: t.text });
  }
  if (msgs[0]?.role === "assistant") msgs.shift();

  let content = playerTurnText(input);
  if (input.kind === "show") {
    content += `\n[What they see: ${input.object.inspectText}]\n[Memories this object brings back: ${input.object.factIds.join(", ") || "none"}]`;
  }
  const summary = conversationSummary(history, stamina, maxTurns);
  if (summary) content += `\n${summary}`;
  if (stamina <= 25) content += "\n[You are getting sleepy. Let it show a little.]";
  const last = msgs[msgs.length - 1];
  if (last && last.role === "user") last.content += `\n${content}`;
  else msgs.push({ role: "user", content });
  return msgs;
}
