/**
 * The offline mock Grandma: keyword retrieval over the facts, no LLM.
 * Uses: running the game without an API key, fast tests, and a baseline for the eval
 * ("how much does the LLM add over a keyword matcher?").
 */
import type { Fact, GrandmaWorld, Recipe } from "./world.ts";
import { chainFacts, containsAllSlots, entityById, factById, hiddenYears, slotAnswers } from "./world.ts";
import type { TurnInput } from "./prompt.ts";
import type { GrandmaOutput } from "./validator.ts";
import { expandedTokens, factKeywords, hashString, pick, rng, scrubYears, tokens } from "./text.ts";

const MOOD_BY_TAG: Record<string, GrandmaOutput["mood"]> = {
  funny: "teasing",
  romance: "nostalgic",
  childhood: "nostalgic",
  milestone: "nostalgic",
  pets: "happy",
};

/**
 * Words that say what kind of answer is wanted, not which memory: every dated fact is a "year". Scoring them
 * pulled the proposal (engaged_year) into every "What year did you…" question (review 44, F3).
 */
const NOT_A_TOPIC = new Set(["year", "time", "in", "at", "for", "of", "big", "best"]);
/** Family words are how the player names people, but they aren't names (so "grandpa" isn't Walt's name bonus). */
const KIN = new Set(["grandpa", "grandma", "granny", "nana", "mom", "dad", "uncle", "aunt"]);

/**
 * Rank memories for a question. A memory scores one per shared keyword, one more for each word of its
 * predicate (not generic ones), and one more when the player typed the name of someone or something in it
 * ("Biscuit"). When the question is about "you", her own memories win ties over her family's ("When were
 * you born?" is Rosie, not Linda; F4).
 */
export function scoreFacts(world: GrandmaWorld, query: Set<string>, text = ""): { fact: Fact; score: number }[] {
  const typed = new Set(tokens(text));
  const aboutHer = /\byou(rs?|rself)?\b/i.test(text);
  return world.facts
    // Pointer memories ("the falls everyone honeymoons at…") answer a note line's card only, never a typed question.
    .filter((fact) => !(fact.tags ?? []).includes("pointer"))
    .map((fact) => {
      let score = 0;
      for (const k of factKeywords(world, fact)) if (query.has(k) && !NOT_A_TOPIC.has(k)) score += 1;
      for (const k of fact.predicate.split("_")) if (query.has(k) && !NOT_A_TOPIC.has(k)) score += 1; // predicate words count double
      for (const id of [fact.subject, typeof fact.object === "string" ? fact.object : ""]) {
        const e = id && id !== world.id ? entityById(world, id) : undefined;
        if (e && tokens([e.name, ...(e.aliases ?? [])].join(" ")).some((n) => typed.has(n) && !KIN.has(n))) {
          score += 1;
          break;
        }
      }
      if (score > 0 && aboutHer && fact.subject === world.id) score += 0.5;
      return { fact, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.fact.salience - a.fact.salience);
}

/** Greetings and small talk: short, and about her, not about any memory ("How are you today, Grandma?"). */
export function isSmallTalk(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.split(/\s+/).length > 8) return false;
  return /^(hi|hello|hey|hiya|morning|good (morning|afternoon|evening)|nice to see you|thank(s| you)|i love you|love you|bye|goodbye)\b/.test(t) || /\bhow (are|r) (you|u)\b|\bhow('?s| is) it going\b|\bhow do you feel\b|\bhow have you been\b/.test(t);
}

export function mockGrandmaReply(args: {
  world: GrandmaWorld;
  recipe: Recipe;
  input: TurnInput;
  seed: string;
  recentFactIds: readonly string[];
  /** Everything she has told this visit: asides prefer memories she hasn't (review 2, F4: one filler told 3 times). */
  heardFactIds?: readonly string[];
}): GrandmaOutput {
  const { world, input } = args;
  const rand = rng(hashString(args.seed));
  const hidden = hiddenYears(world, args.recipe);

  // The password's own parts never come up as a random aside: a tangent that says "our house number is 412"
  // to a question about nothing hands over half of Medium (iteration 56). Asked for, they're fine.
  const slotIds = new Set(args.recipe.slots.map((s) => s.fact_id));
  for (const f of world.facts) if ((f.tags ?? []).includes("pointer")) slotIds.add(f.id); // not as asides either
  // Nor any memory that says an answer word in passing ("bowling league with Marge" on the Marge note).
  const answerWords = slotAnswers(world, args.recipe)
    .flat()
    .map((a) => String(a).toLowerCase())
    .filter((a) => a.length >= 3);
  for (const f of world.facts) if (answerWords.some((a) => f.text.toLowerCase().includes(a))) slotIds.add(f.id);

  const small = world.profile.small_talk;
  if (input.kind === "ask" && !input.focus && small?.length && isSmallTalk(input.text)) {
    return { reply: pick(small, rand), fact_ids_used: [], distractor_ids: [], mood: "happy" };
  }

  let main: Fact | undefined;
  const focus = input.kind === "ask" ? input.focus : undefined;
  if (focus) {
    // A topic card picked the memory already (topics.ts).
    main = factById(world, focus.factId);
  } else if (input.kind === "show") {
    // The scene lists an object's facts most-relevant first, so Grandma reacts to *that* object, and to the
    // memory of it that matters for this note when there is one: the one the note asks about, else another
    // link of its chain (the album means Linda's birth on Easy 2, not the Maple house; F6). A part behind
    // an anchor is the riddle itself, so there the object gives a link instead (the sled: Michael's arm).
    const linked = input.object.factIds.map((id) => factById(world, id)).filter((f): f is Fact => Boolean(f));
    const query = expandedTokens(input.text ?? "");
    const chain = chainFacts(world, args.recipe);
    const asked = new Set(args.recipe.slots.filter((s) => !s.requires_anchor).map((s) => s.fact_id));
    main =
      (input.text && scoreFacts(world, query, input.text).find((s) => linked.includes(s.fact))?.fact) ||
      linked.find((f) => asked.has(f.id)) ||
      linked.find((f) => chain.has(f.id)) ||
      linked[0];
  } else {
    // She doesn't tell the same memory twice in a row when another fits almost as well: asking about the
    // job her last answer mentioned ("two summers after I started cooking at Lincoln Elementary") gets the job.
    const ranked = scoreFacts(world, expandedTokens(input.text), input.text);
    const top = ranked[0];
    main = top && args.recentFactIds.includes(top.fact.id) ? (ranked.find((s) => !args.recentFactIds.includes(s.fact.id) && s.score >= top.score - 1) ?? top).fact : top?.fact;
  }

  // Every memory she tells loses its hidden years cleanly ("married in June of 1961 at…" → "in June at…").
  const scrub = (text: string) => scrubYears(text, hidden);

  const tic = pick(world.profile.verbal_tics, rand);
  if (!main) {
    // Nothing matched: she says so and points at what she does know, without a random memory (review 2, F4:
    // "What was the beagle called" got an unrelated story at full price). The server charges less for it.
    const lost = pick(["Hmm. I don't recall anything about that, sweetheart.", "Oh, my memory. I don't know about that one, dear.", "Now where was I. That one's gone, sweetheart."], rand);
    const steer = pick(["Ask me about the people on your cards, I'm good at those.", "Try me on the family, or the old days. Names help.", "Use a name, dear. My memory hangs everything on names."], rand);
    return { reply: `${lost} ${steer}`, fact_ids_used: [], distractor_ids: [], mood: "confused" };
  }

  // One tangent: prefer a fact sharing a tag, never the confusable partner (that would be too helpful),
  // never the next link of the recipe's chain (Recipe.separate), and never one that, together with the
  // main memory, spells out every part of the password (the validator would reject the reply).
  // Self-corrections (GDD §3.2) use their own random stream, so the rest of the reply stays the same.
  const slip = rng(hashString(`${args.seed}:slip`));
  const say = (f: Fact) => {
    let t = scrub(f.text);
    if (f === main && f.misremembers !== undefined && f.year !== undefined && !hidden.has(f.year) && slip() < 0.5) {
      t = t.replace(String(f.year), `${f.misremembers}… no, '${String(f.year).slice(2)}`);
    }
    return t;
  };
  // "When was that?" is about one date: no tangent. A retold memory doesn't get one either.
  if (focus && (focus.mode === "when" || focus.repeat)) {
    return { reply: say(main), fact_ids_used: [main.id], distractor_ids: [], mood: MOOD_BY_TAG[(main.tags ?? []).find((t) => t in MOOD_BY_TAG) ?? ""] ?? "happy" };
  }
  const chained = (args.recipe.separate ?? []).filter((g) => g.includes(main!.id)).flat();
  const avoid = new Set([main.id, ...(main.confusable_with ?? []), ...args.recentFactIds, ...chained]);
  // Nor anything easily mixed up with a memory like this one: "our first home, Cherry Street" next to "our house
  // number is 412" reads as one place (review 2, F9).
  for (const f of world.facts)
    if ((f.confusable_with ?? []).includes(main.id) || ((f.confusable_with?.length ?? 0) > 0 && (main.confusable_with?.length ?? 0) > 0 && (f.tags ?? []).some((t) => (main!.tags ?? []).includes(t)))) avoid.add(f.id);
  const tags = new Set(main.tags ?? []);
  // Nor an aside that repeats a number she just said ("My best score was 212. My best bowling score ever was 212").
  const saidNumbers = new Set(main.text.match(/\d{2,}/g) ?? []);
  const pool = world.facts.filter((f) => !avoid.has(f.id) && !slotIds.has(f.id) && f.salience >= 2 && !(f.text.match(/\d{2,}/g) ?? []).some((n) => saidNumbers.has(n)) && !containsAllSlots(world, args.recipe, `${main!.text} ${f.text}`));
  const heard = new Set(args.heardFactIds ?? []);
  const fresh = pool.filter((f) => !heard.has(f.id));
  if (fresh.length) pool.splice(0, pool.length, ...fresh);
  const related = pool.filter((f) => (f.tags ?? []).some((t) => tags.has(t)));
  const tangent = related.length && rand() < 0.7 ? pick(related, rand) : pool.length ? pick(pool, rand) : undefined;

  // A tic that comments on what she just said ("Don't tell your grandfather I said that") can't open a reply.
  const openers = world.profile.verbal_tics.filter((x) => !/said that/i.test(x));
  const opener = rand() < 0.5 && openers.length ? `${pick(openers, rand)}. ` : "";
  const reply = tangent ? `${opener}${say(main)} ${say(tangent)}` : `${opener}${say(main)}`;
  const mood = MOOD_BY_TAG[(main.tags ?? []).find((t) => t in MOOD_BY_TAG) ?? ""] ?? "happy";
  return {
    reply,
    fact_ids_used: tangent ? [main.id, tangent.id] : [main.id],
    distractor_ids: tangent ? [tangent.id] : [],
    mood,
  };
}
