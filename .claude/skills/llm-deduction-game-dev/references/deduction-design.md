# Deduction and puzzle design

Contents: 1. Make the player deduce · 2. Inference-chain map (template) · 3. Clues and fairness · 4. Notebook · 5. Confirmation and guessing · 6. Checklist

## 1. Make the player deduce

- **The note must not name the question.** "First dog's name + year I married Grandpa" is dictation: the player just reads it aloud. Phrase slots as memories that need a hop: "the dog who ate Grandpa's wedding shoes + the year we lost the Cherry Street apartment". Golden Idol removed a clue when testers used it to skip several reasoning steps; one question that solves a slot is the same shortcut. [Golden Idol testing]
- **Difficulty comes from inference hops, not from hiding things.** Easy: one hop per slot. Medium: two hops, or one hop plus a competing answer. Hard: three hops, or a hidden year that must be computed (birth year + age). Not tiny objects or pixel hunts. [Room Escape Artist; Golden Idol]
- **Knowledge is the key.** The player progresses because they understood something, not because they found an item. That is where the "aha" comes from. [GMTK; Outer Wilds analysis]
- **Grandma reminisces; she does not solve.** A character who connects the dots for the player removes the player's sense of authorship. [Three pillars of investigative gameplay]

## 2. Inference-chain map (write it before any content)

Golden Idol's team mapped every step the player must take (their "Thought Path") and which steps are sequential or parallel. Do the same for every recipe and keep it next to the world data:

```text
Recipe r_hard: "what Grandpa calls me + year of the big snowstorm + !"
Slot 1 nickname:  Q about Grandpa's pet name → "Sparrow"     (also: wedding photo engraving, letter in the album)
Slot 2 year:      Q snowstorm → "winter Michael broke his arm sledding" (hop 1)
                  → sled says MIKEY / Grandma: "he was eleven"         (hop 2)
                  → Michael born 1966 (album, birth announcement)      (hop 3) → 1977
Competing answers: 1978 blizzard on TV news clipping (ruled out by "he was eleven")
Routes per slot fact: ≥ 3 (conversation, object, second object)
Shortcuts to block: "what year was the snowstorm" must not return 1977 (hidden year)
```

## 3. Clues and fairness

- **Three-clue rule.** For each conclusion, plant at least three clues, because players miss, skip or misread clues. Mix the channels: Grandma's memory, an object's text, a second object. [The Alexandrian]
- **Reward unplanned but reasonable approaches.** A sensible question you didn't anticipate should give something useful, not a dead end. [The Alexandrian]
- **Nudge on stalls.** After N unproductive questions or seconds, have something happen: Grandma: "Have you seen my old sled by the door?" [The Alexandrian]
- **Few red herrings, and never fake puzzles.** Players already invent their own wrong theories. Every eye-catching object should matter. Things that look like puzzles but aren't feel like a betrayal. [Room Escape Artist]
- **Good red herrings are plausible competing answers** that one further clue rules out (a second nickname, a second snowy year), not decoy objects. [Golden Idol]
- **Keep the clue set small.** Only clues that lead to the solution or are deliberate misdirection; extra details overload memory. [Golden Idol]
- **More than one route** to each answer. [Golden Idol]
- **Fixed truth.** Every solution fact exists before play and is never generated. Contradictory or invented clues ruin a mystery (a top complaint about Vaudeville). [Bicking on Hidden Door; Vaudeville reviews]
- **Every readable text pays off.** If inspecting things often yields nothing, players stop inspecting. [Outer Wilds analysis]

## 4. Notebook

- **The notebook records facts automatically; the player makes the leaps.** Obra Dinn logs the facts and leaves deduction to the player. Shadows of Doubt's case board updates with facts, never connections. [Obra Dinn; Shadows of Doubt]
- **Show known, rumoured and unknown.** Outer Wilds' ship log greys out "heard about" entries and marks gaps with "?". Gaps tell the player what to do next. [Outer Wilds analysis]
- **Link facts to the riddle.** A small "riddle slot ↔ evidence" view turns a pile of notes into a web. [Outer Wilds critical analysis]
- **Recaps.** Players of open dialogue asked for recaps. Let the notebook replace scrolling through the chat. [Symbolically Scaffolded Play]

## 5. Confirmation and guessing

- **Confirm only when the player commits.** No waypoints or reveals before the player commits an answer. [Three pillars]
- **Batch and partial confirmation.** Obra Dinn confirms fates in threes to deter guessing. Golden Idol found a flat "wrong" frustrating and moved to hints such as "two or fewer are wrong". For a password: "1 of 2 parts correct", without saying which. [Obra Dinn; Golden Idol]
- **Slot input beats free text and multiple choice.** Use fill-in fields that mirror the note ([name][year][!]); the game assembles the string and applies the rules (capital letter, no spaces). Free text frustrates players with format errors; multiple choice removes the deduction. [Golden Idol]
- **Keep the answer space large** so brute force doesn't pay. [Obra Dinn critique]
- **Soft costs over hard fails.** Three strikes discourages experimenting. Prefer the router "rebooting" (costs tea) or Grandma tutting. [Three pillars]
- **Checkpoints.** Mark a slot "confirmed" when two independent pieces of evidence agree, so players feel progress. [Golden Idol]

## 6. Checklist for a new or changed recipe

- [ ] The note phrases each slot as a memory needing ≥ 1 hop (≥ 2 on Medium, ≥ 3 on Hard)
- [ ] An inference-chain map exists; every slot fact has ≥ 3 routes, including ≥ 1 object in the room
- [ ] No single question returns a whole slot answer (test with the 10 most obvious questions)
- [ ] Competing answers are ruled out by a clue the player can find
- [ ] The assembled password and the slot mapping are not in the model's prompt
- [ ] Notebook entries are defined for every fact the chain uses
- [ ] Stall nudges point at the chain's first hop
- [ ] `npm run validate` passes; a solvability check (AI player or by hand) reaches the answer
