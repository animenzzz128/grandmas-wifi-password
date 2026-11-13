/**
 * The offline mock Grandma: keyword retrieval over the facts, no LLM.
 * Uses: running the game without an API key, fast tests, and a baseline for the eval
 * ("how much does the LLM add over a keyword matcher?").
 */
import type { Fact, GrandmaWorld, Recipe } from "./world.ts";
import { factById, hiddenYears } from "./world.ts";
import type { TurnInput } from "./prompt.ts";
import type { GrandmaOutput } from "./validator.ts";
import { expandedTokens, factKeywords, hashString, pick, rng } from "./text.ts";

const MOOD_BY_TAG: Record<string, GrandmaOutput["mood"]> = {
  funny: "teasing",
  romance: "nostalgic",
  childhood: "nostalgic",
  milestone: "nostalgic",
  pets: "happy",
};

export function scoreFacts(world: GrandmaWorld, query: Set<string>): { fact: Fact; score: number }[] {
  return world.facts
    .map((fact) => {
      let score = 0;
      for (const k of factKeywords(world, fact)) if (query.has(k)) score += 1;
      for (const k of fact.predicate.split("_")) if (query.has(k)) score += 1; // predicate words count double
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
    // The scene lists an object's facts most-relevant first, so Grandma reacts to *that* object.
    const linked = input.object.factIds.map((id) => factById(world, id)).filter((f): f is Fact => Boolean(f));
    const query = expandedTokens(input.text ?? "");
    main = (input.text && scoreFacts(world, query).find((s) => linked.includes(s.fact))?.fact) || linked[0];
  } else {
    main = scoreFacts(world, expandedTokens(input.text))[0]?.fact;
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
  // and never the next link of the recipe's chain (Recipe.separate).
  const chained = (args.recipe.separate ?? []).filter((g) => g.includes(main!.id)).flat();
  const avoid = new Set([main.id, ...(main.confusable_with ?? []), ...args.recentFactIds, ...chained]);
  const tags = new Set(main.tags ?? []);
  const pool = world.facts.filter((f) => !avoid.has(f.id) && f.salience >= 2);
  const related = pool.filter((f) => (f.tags ?? []).some((t) => tags.has(t)));
  const tangent = related.length && rand() < 0.7 ? pick(related, rand) : pool.length ? pick(pool, rand) : undefined;

  const say = (f: Fact) => {
    let t = f.text;
    for (const y of hidden) t = t.replaceAll(String(y), "that year");
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
