/**
 * The offline mock Grandma: keyword retrieval over the facts, no LLM.
 * Uses: running the game without an API key, fast tests, and a baseline for the eval
 * ("how much does the LLM add over a keyword matcher?").
 */
import type { Fact, GrandmaWorld, Recipe } from "./world.ts";
import { chainFacts, containsAllSlots, entityById, factById, hiddenYears } from "./world.ts";
import type { TurnInput } from "./prompt.ts";
import type { GrandmaOutput } from "./validator.ts";
import { expandedTokens, factKeywords, hashString, pick, rng, tokens } from "./text.ts";

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

export function mockGrandmaReply(args: {
  world: GrandmaWorld;
  recipe: Recipe;
  input: TurnInput;
  seed: string;
  recentFactIds: readonly string[];
}): GrandmaOutput {
  const { world, input } = args;
  const rand = rng(hashString(args.seed));
  const hidden = hiddenYears(world, args.recipe);

  let main: Fact | undefined;
  if (input.kind === "show") {
    // The scene lists an object's facts most-relevant first, so Grandma reacts to *that* object, and to the
    // memory of it that matters for this note when there is one (the album means Linda's birth on Easy 2; F6).
    const linked = input.object.factIds.map((id) => factById(world, id)).filter((f): f is Fact => Boolean(f));
    const query = expandedTokens(input.text ?? "");
    const chain = chainFacts(world, args.recipe);
    main =
      (input.text && scoreFacts(world, query, input.text).find((s) => linked.includes(s.fact))?.fact) ||
      linked.find((f) => chain.has(f.id)) ||
      linked[0];
  } else {
    main = scoreFacts(world, expandedTokens(input.text), input.text)[0]?.fact;
  }

  const tic = pick(world.profile.verbal_tics, rand);
  if (!main) {
    const tangent = pick(
      world.facts.filter((f) => f.salience >= 4 && !args.recentFactIds.includes(f.id)),
      rand,
    );
    return {
      reply: `${tic}. I don't recall anything about that, sweetheart. ${tangent.text}`,
      fact_ids_used: [tangent.id],
      distractor_ids: [tangent.id],
      mood: "confused",
    };
  }

  // One tangent: prefer a fact sharing a tag, never the confusable partner (that would be too helpful),
  // never the next link of the recipe's chain (Recipe.separate), and never one that, together with the
  // main memory, spells out every part of the password (the validator would reject the reply).
  const chained = (args.recipe.separate ?? []).filter((g) => g.includes(main!.id)).flat();
  const avoid = new Set([main.id, ...(main.confusable_with ?? []), ...args.recentFactIds, ...chained]);
  const tags = new Set(main.tags ?? []);
  const pool = world.facts.filter((f) => !avoid.has(f.id) && f.salience >= 2 && !containsAllSlots(world, args.recipe, `${main!.text} ${f.text}`));
  const related = pool.filter((f) => (f.tags ?? []).some((t) => tags.has(t)));
  const tangent = related.length && rand() < 0.7 ? pick(related, rand) : pool.length ? pick(pool, rand) : undefined;

  // Self-corrections (GDD §3.2) use their own random stream, so the rest of the reply stays the same.
  const slip = rng(hashString(`${args.seed}:slip`));
  const say = (f: Fact) => {
    let t = f.text;
    for (const y of hidden) t = t.replaceAll(String(y), "that year");
    if (f === main && f.misremembers !== undefined && f.year !== undefined && !hidden.has(f.year) && slip() < 0.5) {
      t = t.replace(String(f.year), `${f.misremembers}… no, '${String(f.year).slice(2)}`);
    }
    return t;
  };
  const opener = rand() < 0.5 ? `${tic}. ` : "";
  const reply = tangent ? `${opener}${say(main)} ${say(tangent)}` : `${opener}${say(main)}`;
  const mood = MOOD_BY_TAG[(main.tags ?? []).find((t) => t in MOOD_BY_TAG) ?? ""] ?? "happy";
  return {
    reply,
    fact_ids_used: tangent ? [main.id, tangent.id] : [main.id],
    distractor_ids: tangent ? [tangent.id] : [],
    mood,
  };
}
