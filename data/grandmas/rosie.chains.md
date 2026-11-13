# Rosie: inference-chain maps

One map per recipe in `rosie.json` (see the `llm-deduction-game-dev` skill, `references/deduction-design.md` §2). Keep these in sync when a recipe, fact or clue object changes.

Rules in code that protect the chains:
- `Recipe.separate`: a reply may use at most one fact of each group, so one question can't jump a hop. The validator rejects it and Grandma retries; the mock never picks such a tangent.
- The persona: Grandma muddles what happened before or after what, so she never connects two memories in time for the player (`prompt.ts`).
- Hidden years (`requires_anchor`): the model never sees them and the validator rejects them.

## Easy: `the sock thief + the year we said 'I do'` → Biscuit1961

```text
Slot 1 "the sock thief" (1 hop)
  routes: photo album (a beagle chewing a sock, no names) → show it or ask about the beagle → Biscuit
          Grandma: "Biscuit stole every sock"; "my first dog was Biscuit, a beagle"
  competing answer: Buttons (the cocker spaniel, Grandma's favorite)
Slot 2 "the year we said 'I do'" (1 hop)
  routes: Grandma: married June 1961 · wedding photo back: "My Sparrow, June 1961" · honeymoon story
  competing answer: 1960 (the pierogi proposal: engaged, not married)
```

## Medium: `the street we lived on the year we got the color TV + the number Grandpa painted crooked` → Maple412

```text
Slot 1 street (2 hops)
  hop 1 when did we get the TV?   → TV card: plate "APOLLO 11 · JULY 20, 1969" · Grandma: bought it for the moon landing (1969)
  hop 2 where did we live in 1969? → Grandma: bought the house on Maple Avenue in 1964, been there ever since
  competing answer: Cherry Street (first home; where mom was born in 1963)
  separate: [f_tv, f_house], [f_moon, f_house]
Slot 2 number (1 hop)
  routes: house-number sign "painted a little crooked: 412" · Grandma: "412 Maple Avenue, Grandpa painted the number crooked"
  competing answer: 27 (the Cherry Street apartment door)
  separate: [f_house, f_house_number] (one reply can't hand over both slots)
```

## Hard: `the bird Grandpa named me after + year of the big snowstorm + !` → Sparrow1977!

```text
Slot 1 "the bird" (1 hop)
  routes: Grandma: Walt calls her Sparrow because she never stops chirping · story s_fair · wedding photo back "My Sparrow"
Slot 2 year (3 hops, 1977 hidden from the model)
  hop 1 the big snowstorm → "the same winter Michael broke his arm"
  hop 2 Michael broke his arm sledding "the winter he was eleven" (sled: MIKEY, cracked runner)
  hop 3 Michael born 1966 → Grandma; album: birth announcement "baby Michael, 1966" → 1966 + 11 = 1977
  separate: [f_snowstorm, f_michael_born], [f_michael_arm, f_michael_born]
Suffix "!" from the note.
```

## Nudges
Each recipe has two `nudges` lines. After 3 turns that touch none of its chain facts, Grandma says the next one: Easy points at the album and the wedding photo, Medium at the moon plate and "the homes we had", Hard at the sled and the fair story.

## Checks
- `npm test`: the inference-chain tests (no reply joins a separated pair; asking the Hard note aloud never yields 1977) and the API walkthroughs (each documented chain reaches the answer through the real HTTP app).
- `npm run validate`: recomputes every password; separate groups must name real facts.
- Still to do (see `docs/06-skill-review-and-plan.md`): an AI player measuring questions-to-solve per difficulty.
