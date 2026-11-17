> Drafted with Claude Code (Claude Opus 5.5) under Jacky Yao's direction, 2026-11-16 (loop iteration 44, the re-score step of `docs/08-design-improvement-plan.zh.md` §5). The scores come from an independent review agent and a browser pass, not from people playing. Treat them as a starting point for the team's own review.

# Design re-score: build of 2026-11-16 (iteration 44)

**Coverage.**
- **Independent review agent:** read the rubric, data and code, and probed the offline Grandma through the real server API, with 12 runs for each question or object. It did not see the earlier fixes or my opinion of them.
- **My browser pass:** title screen, first visit, chips, talking to Grandma, the router (dev build, Chrome in the app's browser pane).

**Not covered:**
- the live LLM Grandma (no course key), so dimension 4 is the offline Grandma only;
- real players;
- the sound mix (nobody listened);
- visual cohesion (dimension 8), which wasn't re-scored.

The AI player (`eval:player`) wasn't run, because it needs an LLM for the player.

## Verdict

The build is much closer to a game than the 11-12 build (average about 3.5). Controls, feedback, character and robustness are now solid. Two things hold it below the pass bar.

1. **Deduction depth.** On four of the eight puzzles, asking the note's own words gets the whole answer. Medium 2 plays like an Easy.
2. **The offline Grandma's retrieval** sent obvious questions to the wrong memory. The offline Grandma matters: it is also the live fallback when the model is slow, over budget or switched off. **Iteration 44 fixed the retrieval findings** (below).

The deduction findings change puzzle content, so they are proposals for the team.

## Scorecard (before the iteration-44 fixes)

Pass bar: no P0, average at least 6, no dimension below 4.

| # | Dimension | Score | Evidence | Confidence |
|---|---|---|---|---|
| 1 | Deduction depth | **4** | 4/8 recipes solved by the note's own words (12/12). Real multi-hop work only in the Hard years and Medium 3's door number. | high |
| 2 | World as evidence | 5 | Objects rule out decoys, and two objects together give 412. But every recipe can be solved without touching an object. | high |
| 3 | Character presence | 7 | A pose per mood, mouth, nods, glasses gesture, dozing, voice blips (code and browser). | medium |
| 4 | Conversation craft | **4** | Offline: retrieval misfires (F3–F7), the same four verbal tics. LLM not tested. | medium |
| 5 | Fairness and feedback | 6 | Partial confirmation, cost breakdown, nudges, notebook. But "Niagara Falls" was a wrong guess (F1) and two nudges led nowhere offline. | medium |
| 6 | Controls and input | 7 | Esc in every mode, guarded typing, keys can be rebound. | medium |
| 7 | Onboarding and clarity | 6 | One-button first visit, checklist, chips, first-time lessons. The first 60 s haven't been timed with a real person. | low |
| 8 | Visual cohesion | — | Not re-scored. | — |
| 9 | Audio | 7 | Blips, chimes, clock, music loop, snore, three volume channels. The mix is unheard. | low |
| 10 | Robustness and safety | 7 | No hidden year in about 1,000 probe replies; budget and kill switch; rate limits. Weak spot: the fallback brain. | medium |

**Average of the nine scored: about 5.9.** Pass bar not met: the average is just under 6.

## Findings and what iteration 44 did

| ID | Sev | Finding | Status |
|---|---|---|---|
| F1 | P1 | "Niagara Falls" / "Marge Novak" at the router were wrong guesses and cost an attempt, though they show the player solved it. | **Fixed.** A first-word part also accepts the whole name (`slotAnswers`). The password itself is unchanged. |
| F2 | P1 | Asking the note's own words gives a whole part on 4 of 8 recipes. | **Team decision.** Move the year or name one hop away from the fact the note points at (proposals below). |
| F3 | P1 | Offline: any "What year…" question pulled the proposal (1960). "What year did you win the blue ribbon?" gave 1972 in 0/12. | **Fixed.** "year" no longer scores. Now 12/12. |
| F4 | P1 | Offline: "When were you born?" gave Linda (1963) 12/12, so the Hard 2 nudge "Ask me when I was born" led nowhere. | **Fixed.** A question about "you" breaks ties toward her own memories; a typed name ("Biscuit") counts extra. Now 1940 12/12. |
| F5 | P2 | "Tell me about the sled" got "I don't recall" 11/12 (stemming: "sledding" became "sledd"). | **Fixed.** Doubled consonants are undone after "-ing"/"-ed". Now 12/12. |
| F6 | P2 | Showing the album on Easy 2 never mentioned Linda; the wedding photo never mentioned the honeymoon. | **Fixed.** Showing an object prefers its memory on this note's chain. Both now 12/12. |
| F7 | P2 | "What's your house number?" gave Maple and the decoy 27, never 412. | **Fixed.** "house" no longer expands to street/avenue. Now 412 12/12, 27 0/12. |
| F8 | P2 | Hard 2's year has a single route (talk). No object gives "age nine", and there is no decoy. | **Team decision.** For example a photo "Rosie, age 9, with Biscuit". |
| F9 | P2 | Par is loose: Easy and Medium 2 solve in 2 questions against par 7 and 10. | **Team decision**, after F2 (par should come from measured minimums). |
| F10 | P3 | A Medium 3 nudge said "the dogs" lay by the 1969 TV, but Biscuit was long gone. | **Fixed:** "Our dog". (Not "Buttons", which would skip the hop.) |
| F11 | P3 | "When did you say 'I do'?" (the note's own words) found the wedding only 2/12. | **Fixed.** "said 'I do'" means the wedding. Wedding is now the top memory in every run. |
| B1 | P3 | Browser: the "Please play on a computer" warning showed on a desktop whose window was narrow when the page loaded. | **Fixed.** The check is now "is there a mouse or trackpad", not the window width. |
| B2 | P2 | Browser: suggested questions repeated Grandma's voice ("Do you remember the bird Grandpa named **me** after?", "the **where** we spent…"). | **Fixed.** Chips switch to the player's pronouns; quoted words like 'I do' stay as they are. Tested on all eight notes. |

The retrieval fixes have regression tests: `engine.test.ts`, "answers the obvious wording…" and "showing an object…".

## Proposals for the team (F2, F8, F9)

These change puzzle content, so per the plan's ground rules they wait for your yes.

- **Medium 2 ("the friend I bowl with every Tuesday + the year your grandpa lost three dollars at the fair"):**
  - Today "Who do you bowl with?" gives Marge, and the fair memory states 1958.
  - Option: take the year out of the fair memory ("the summer I started at the switchboard"), so the year comes from the job memory (1958). That is one hop.
- **Easy 3 and Easy 2:** these are Easy, so one direct slot is acceptable. But both slots being direct makes them two-question puzzles. Option: make one slot of each a hop. For example, "the year your mom was born" could become "the year we moved out of the apartment, minus one".
- **Hard 2:** add a second route for "nine" (a photo caption) and a decoy year (for example, Buttons's 1968).
- **Par:** set par per recipe from the measured minimum plus a margin, once the content is settled.

## Next

- If the team accepts F2, F8 and F9, re-run the review's question probes (12 runs per question through the server API; worth porting into `eval/` as a script) and re-score.
- Score dimension 8 in a person-led session, and dimensions 4 and 9 once the key arrives and someone listens.
