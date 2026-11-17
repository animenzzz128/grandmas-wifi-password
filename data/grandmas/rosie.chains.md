# Rosie: inference-chain maps

One map per recipe in `rosie.json` (see the `llm-deduction-game-dev` skill, `references/deduction-design.md` §2). Keep these in sync when a recipe, fact or clue object changes.

Objects give a hop, never an answer: no clue text contains a whole answer part (tested, iteration 43). Design plan B in `docs/08-design-improvement-plan.zh.md`; these clue texts are drafts for the team to review.

Rules in code that protect the chains:
- `Recipe.separate`: a reply may use at most one fact of each group, so one question can't jump a hop. The validator rejects it and Grandma retries; the mock never picks such a tangent.
- The persona: Grandma muddles what happened before or after what, so she never connects two memories in time for the player (`prompt.ts`).
- Hidden years (`requires_anchor`): the model never sees them and the validator rejects them.

## Easy: `the sock thief + the year we said 'I do'` → Biscuit1961

Self-corrections (GDD §3.2): she sometimes says "1965… no, '64" for the Maple house and "1970… no, '69" for the color TV (`misremembers` in rosie.json). She always ends on the true year; the walkthrough tests accept either form. (The wedding's "1962… no, '61" went in iteration 47: Easy now hides 1961, and a hidden year can't have one.)

Year hops (iteration 47, `eval/data/proposals/f2-year-hops.json`, adopted at Jacky's request): in Easy, Easy 2, Easy 3 and Medium 2 the year is hidden from Grandma for that puzzle (`requires_anchor`), and she says a phrase instead. Before this, 6 of 8 puzzles fell to direct questions alone; now 2 (`npm run eval:probe`).

Separate (`Recipe.separate`, added 11/13 after a review): the dog and the wedding are never told in one reply, so one answer can't hand over both parts.

```text
Slot 1 "the sock thief" (1 hop)
  routes: photo album (a beagle chewing a sock, no names) → show it or ask about the beagle → Biscuit
          Grandma: "Biscuit stole every sock"; "my first dog was Biscuit, a beagle"
  competing answer: Buttons (the cocker spaniel, Grandma's favorite)
Slot 2 "the year we said 'I do'" (1 hop, 1961 hidden from the model: anchor a_wedding)
  hop 1 the wedding → Grandma: "the June after Walt proposed" · wedding photo back: "Married the June after the pierogi"
  hop 2 the proposal → Grandma: "Walt proposed on Christmas Eve, 1960, with a ring hidden in a pierogi" → June 1961
  competing answer: 1960 (the proposal itself: engaged, not married). "The June after" rules it out
  separate: [f_wedding, f_engaged]
```

## Medium: `the street we lived on the year we got the color TV + the number Grandpa painted crooked` → Maple412

```text
Slot 1 street (2 hops)
  hop 1 when did we get the TV?   → TV card: plate "APOLLO 11 · JULY 20, 1969" · Grandma: bought it for the moon landing (1969)
  hop 2 where did we live in 1969? → Grandma: bought the house on Maple Avenue in 1964, been there ever since
                                   → album: "Cherry St., our first home, moved out summer '64" and a porch labeled "Summer '69" → ask whose porch → Maple Avenue
  competing answer: Cherry Street (first home; where mom was born in 1963). The album rules it out for 1969
  separate: [f_tv, f_house], [f_moon, f_house]
Slot 2 number (1 hop)
  routes: Grandma: "Our house number is 412. Your grandpa painted it on the mailbox himself, crooked"
          sign (first digit 4, last 2, middle flaked off) + album porch photo (mailbox "41", last digit behind a rosebush) → 412
  competing answer: 27 (the Cherry Street apartment door). Smudged note: "the number Grandpa ███████ ███████"; the
  reading glasses show "painted crooked", which points at the mailbox (412), not the apartment door (27)
  separate: [f_house, f_house_number] (one reply can't hand over both slots)
```

## Hard: `the bird Grandpa named me after + year of the big snowstorm + !` → Sparrow1977!

```text
Slot 1 "the bird" (1 hop)
  routes: Grandma: Walt calls her Sparrow because she never stops chirping · story s_fair
          wedding photo back "To my little songbird" → ask which bird → Sparrow
Slot 2 year (3 hops, 1977 hidden from the model)
  hop 1 the big snowstorm → "the same winter Michael broke his arm"
  hop 2 Michael broke his arm sledding "the year he turned eleven" (sled: MIKEY, cracked runner). Not "the winter he was eleven": for most birth months that winter runs into the next year, so 1978 would be a fair answer too (review, iteration 39)
  hop 3 Michael born 1966 → Grandma; album: birth announcement "baby Michael, 1966" → 1966 + 11 = 1977
  separate: [f_snowstorm, f_michael_born], [f_michael_arm, f_michael_born]
Suffix "!" from the note.
Smudged note: "year of the big █████████"; the reading glasses show "snowstorm". Without them, asking about big
winters, the sled or Michael's arm still gets there.
```

## More puzzles (iteration 43, design plan D1: drafts for the team to review)

Each difficulty now has several puzzles; a visit gets one at random (never the one just played), and the daily
cycles through all eight. Every map below is checked by an API walkthrough with the offline Grandma.

### Easy 2: `where we spent our honeymoon + the year your mom was born` → Niagara1963

```text
Slot 1 honeymoon (1 hop)
  routes: Grandma: "Our honeymoon was at Niagara Falls" · wedding photo (brings up the honeymoon when shown)
  competing answer: Cherry Street (the first home "after the wedding"), Presque Isle (Stan's cabin)
Slot 2 the year mom was born (1 hop, 1963 hidden from the model: anchor a_linda_moved)
  hop 1 mom's birth → Grandma: "born at the Cherry Street apartment, the year before we moved to Maple Avenue"
  hop 2 the move → Grandma: "In 1964 we bought the house on Maple Avenue" (she may say "1965… no, '64")
          album: "Cherry St., our first home — moved out summer '64" (showing it brings up the move) → 1963
  competing answer: 1966 (Michael), 1964 (the move itself)
  separate: [f_honeymoon, f_linda_born], [f_linda_born, f_house]
```

### Easy 3: `my favorite dog + the year I won the blue ribbon` → Buttons1972

```text
Slot 1 favorite dog (1 hop)
  routes: Grandma: "Buttons, our cocker spaniel... she was my favorite" · album: the spaniel on the porch step
  competing answer: Biscuit (the first dog, the sock thief)
Slot 2 the blue ribbon year (1 hop, 1972 hidden from the model: anchor a_pie)
  hop 1 the ribbon → Grandma: "two summers after I started cooking at Lincoln Elementary" · the ribbon on the wall (shown: the same)
  hop 2 the job → Grandma: "From 1970 I cooked in the cafeteria at Lincoln Elementary" → 1972
  competing answer: 1958 (the other county-fair memory: meeting Grandpa), 1970 (the job itself)
  separate: [f_dog2, f_pie], [f_pie, f_job2]
```

### Medium 2: `the friend I bowl with every Tuesday + the year your grandpa lost three dollars at the fair` → Marge1958

```text
Slot 1 the Tuesday friend (1 hop + a name to pick out)
  routes: Grandma: "Every Tuesday is bowling league with Marge"; "Marge Novak has been my best friend"
          bowling trophy: TUESDAY LEAGUE (brings up Marge when shown)
Slot 2 the three dollars (1 hop + a competing fair memory, 1958 hidden from the model: anchor a_met)
  hop 1 the fair → Grandma: met Grandpa at the Erie County Fair "the summer I turned eighteen", he lost three dollars on a stuffed bear · story s_fair
          blue ribbon (brings up the fair)
  hop 2 her age → Grandma: "I was born in Erie in 1940" → 1958
  competing answer: 1972 (the pie ribbon, also at the fair)
  separate: [f_marge, f_met_walt], [f_bowling, f_met_walt], [f_met_walt, f_birth]
```

### Medium 3: `the dog we got the year before the men walked on the moon + the number on the door of our first home` → Buttons27

```text
Slot 1 dog (2 hops)
  hop 1 the moon landing → 1969 (TV card, moon plate, Grandma) → the year before: 1968
  hop 2 the dog that came in 1968 → Buttons (Grandma; the album has both dogs, unnamed)
  competing answer: Biscuit (the first dog, 1949)
  separate: [f_dog2, f_moon], [f_dog2, f_tv]
Slot 2 the first home's door (2 hops)
  hop 1 first home → the Cherry Street apartment (Grandma; album "Cherry St., our first home")
  hop 2 its number → 27 (Grandma)
  competing answer: 412 (the Maple Avenue house: the sign and the porch photo)
```

### Hard 2: `the sock thief + the year the sock thief came home + !` → Biscuit1949!

```text
Slot 1 the sock thief (1 hop): as Easy (Biscuit)
Slot 2 year (3 hops, 1949 hidden from the model: anchor a_biscuit "the year Biscuit came home")
  hop 1 the sock thief → Biscuit
  hop 2 Biscuit came home when Grandma was nine (Grandma; album shows the beagle)
  hop 3 Grandma was born in 1940 (Grandma) → 1940 + 9 = 1949
  separate: [f_dog1, f_birth]
Suffix "!" from the note.
```

## Nudges
Each recipe has two `nudges` lines. After 3 turns that touch none of its chain facts, Grandma says the next one: Easy points at the album and the wedding photo, Medium at the moon plate and "the homes we had", Hard at the sled and the fair story.

## Checks
- `npm test`: the inference-chain tests (no reply joins a separated pair; asking the Hard note aloud never yields 1977) and the API walkthroughs (each documented chain reaches the answer through the real HTTP app).
- `npm run validate`: recomputes every password; separate groups must name real facts.
- Still to do (see `docs/06-skill-review-and-plan.md`): an AI player measuring questions-to-solve per difficulty.
