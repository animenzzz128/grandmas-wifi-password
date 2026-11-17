# Review: build of 2026-11-12, using the `llm-deduction-game-dev` skill

This is the second review of the same build. The first (`docs/05-playtest-review.md`) was an ad-hoc critique. This one follows the project skill in `.claude/skills/llm-deduction-game-dev/`: five pillars, eight quality floors, a ten-dimension rubric with anchors, and a plan in which every phase has an exit check.

**Coverage.** Four runs in Chrome 157 (Windows 11, Intel iGPU), driven by the skill's `cdp.mjs`:
- Easy and Hard played to a win.
- Medium tested with obvious questions from the spawn point.
- The attack set (password ask, letter count, reverse, role-play as Michael, rhyme, insult, prompt injection, gibberish, Chinese, a 40-word ramble).
- The input-mode scenarios.

I also read the design docs, the world and scene data, the prompt, the validator and the client code.

**Not tested:**
- **The real Grandma.** There's no `.env` key, so everything ran on the keyword mock. Dimensions 4 and 10 are low-confidence.
- **Mouse-look feel.** Synthetic mouse motion is unreliable under pointer lock.
- **Audio.** There is none.

## Verdict

The technical foundation already meets the skill's hardest bar. The truth is fixed in data, the model never sees the password or the riddle mapping, a validator checks every reply, and the game runs at 240 fps on integrated graphics. But the build fails the genre's promise on two pillars:
- **Deduction.** Easy and Medium each fall to two obvious questions, and Hard's nickname slot to one.
- **The world.** Every difficulty can be solved standing at the spawn point, talking to Grandma from across the room, without touching an object.

Grandma is also hidden behind the chat while you talk. Three input bugs make the hands fight the player. The build fails the pass bar: three P0s, an average of 3.5, and one dimension at 0.

## Scorecard

Pass bar: no P0, average ≥ 6, no dimension below 4.

| # | Dimension | Score | Reason (anchor) |
|---|---|---|---|
| 1 | Deduction depth | 4 | Easy and Medium are solved by 2 direct questions. Hard's year needs 3 hops (snowstorm → Michael's arm at 11 → born 1966 → 1977), which is good |
| 2 | World as evidence | 2 | Every run is solvable from spawn; objects are optional; Show works from across the room |
| 3 | Character presence | 4 | Visible body with breathing and dozing. Covered by the chat while talking; `mood` is returned but unused |
| 4 | Conversation craft *(mock only)* | 4 | Grounded and in character, but the three deflection lines repeat and filler sentences wander off-topic |
| 5 | Fairness and feedback | 3 | Wrong guesses get a line. No cost reasons, no notebook, no partial confirmation, no stall nudges |
| 6 | Controls and input | 3 | Movement is excellent (first-frame response, ~50 ms to full speed), but three P0 focus/key bugs |
| 7 | Onboarding and clarity | 4 | The greeting points to the note. No premise on the title, no objective strip, and the kitchen is behind you |
| 8 | Visual cohesion and readability | 5 | Warm and cohesive at a glance. Mixed styles, no shadows, flat window, small clues |
| 9 | Audio | 0 | None |
| 10 | Robustness and safety *(mock only)* | 6 | No leaks; rate limit; mock fallback; strong performance. No streaming; no input screen; attack turns cost tea |
| | **Average** | **3.5** | Fails the bar |

## Floors

| Floor | Result | Evidence |
|---|---|---|
| No keystroke goes to the wrong place | **Fail** | E types "e" into the password box; after asking, WASD/E type into the chat ("eew"); Esc doesn't close cards |
| The protagonist is visible while you talk | **Fail** | Screenshot 04 in `docs/screenshots/playtest-2026-11-12/` |
| Every cost and failure explains itself | **Fail** | Costs of 14 or 12 tea are shown with no reason |
| The secret can't leak from the model | Pass *(mock)* | Password and recipe absent from the prompt (`prompt.ts`); normalised leak check; 10 attacks, 0 leaks. Re-run in LLM mode |
| Response within ~100 ms | Pass for movement | The "…" bubble exists, but no thinking pose; LLM latency not measured |
| Text matches the world | **Fail** | Sled "leaning by the door" lies flat; the note "on the router" is on the wall; "Take" vs "Give" a cookie |
| Never stuck in silence | **Fail** | No stall nudges |
| Debug info invisible | **Fail** | "Mock Grandma (no API key)" badge in play |

## Findings

IDs B1–B6 match `docs/05-playtest-review.md` and the Phase 1 list in the roadmap. **N-numbered findings are new**: the skill's pillar questions surfaced them, and the first review missed them.

| ID | Sev | Pillar | Finding and evidence | Fix |
|---|---|---|---|---|
| B1 | P0 | Hands | E leaks into the router field | Open on keyup / preventDefault / focus next frame |
| B2 | P0 | Hands | The chat keeps focus after sending; WASD types | Blur after send or a visible talk mode; Esc returns to walking |
| B3 | P0 | Hands | Esc doesn't close cards | Esc backs out one layer |
| **N1** | **P1** | **World** | **You can interrogate Grandma from anywhere** (all Hard and Medium questions were asked from spawn, about 4 m away across the room) | Talk only within ~2.5 m. Farther away, she says "Come closer, dear, I can't hear you" (free) |
| **N2** | **P1** | **Deduction** | **Easy and Medium notes are dictation**: 2 questions each. Hard's nickname slot takes 1 | Rewrite every note as hops, with an inference-chain map (skill: `deduction-design.md` §2) |
| **N3** | **P1** | **Deduction** | **One answer resolves a whole slot plus its competing answer.** "Apartment door number?" also gives "Cherry Street", wiping out the good Maple/412 red herring | Split facts so each reply gives one link; the validator flags replies that join two slot facts |
| B4 | P1 | Truth | Text contradicts the scene | Align the text and the scene |
| B5 | P1 | World | Show and Cookie work at range | Proximity |
| N4 | P1 | Character | Grandma is hidden by the chat; `mood` is returned by the server but unused by the client | Side-panel dialogue plus camera framing; map mood to pose and face |
| N5 | P2 | Fairness | No notebook, so players scroll the chat for years and names | Auto notebook: known, heard about and unknown; slot ↔ evidence |
| N6 | P2 | Fairness | The router is free text with format rules, and a wrong guess just says wrong | Slot inputs ([name][year][!]) with "1 of 2 parts correct"; wrong guesses cost tea instead of a strike |
| N7 | P2 | Fairness | Costs are unexplained; gibberish, other languages and attack turns cost full price | Show the breakdown; unparseable input is free ("Pardon, dear?") |
| N8 | P2 | Fairness | No stall nudge | After 3 turns with no slot progress, she brings up an object on the chain's first hop |
| N9 | P2 | Character | Deflections rotate 3 lines and attacks never get a fun response | Larger bank in `data/i18n`; a first-time "Are you feeling alright, dear?" beat |
| N10 | P2 | World | Showing the sled got a reply about Michael's birth, not the sled; inspect cards don't suggest a question | Object-specific memory lines; an "Ask about it" chip on each card |
| N11 | P2 | Robustness | No streaming; no input screen beyond rudeness | Stream the reply into the bubble; cheap Haiku input screen for abuse; measure time to first word |
| N12 | P2 | Clarity | No premise on the title, no objective strip, spawn faces away from the note | One-line premise; objective strip; start facing Grandma |
| N13 | P2 | Look | Style mix, no shadows, flat window, small clues | Art bible, palette post-process, contact shadows, snow outside, clue glints |
| N14 | P2 | Sound | No audio | CC0 SFX set and Grandma's babble blips |
| N15 | P2 | Hands | No settings (sensitivity, FOV, invert Y), no accessibility options | Settings panel with saved values; relaxed-tea option |
| B6 | P2 | Clarity | Debug badge and permanent controls banner | Dev-only badge; fade the banner |
| N16 | P3 | Evidence | No AI player or attacker bot yet, so difficulty claims rest on one tester | Build them on the existing API (eval plan) |

## Plan

Each phase has a goal tied to a pillar and an **exit check** that proves it worked. Phases 1–4 are what the course demo needs (the AI is the course's core); 5–7 are what a Steam page needs.

| Phase | Goal (pillar) | Tasks | Size | Exit check |
|---|---|---|---|---|
| **1. Fix the hands** *(marked in the roadmap)* | Hands | B1–B3, B5, B6, B4 text fixes; a mode indicator | 1–2 days | The skill's input-mode scenarios all pass in Chrome; floors 1, 6 and 8 pass |
| **2. Real deduction** | Deduction, World, Truth | N2/N3: rewrite the three notes as hops with inference-chain maps in `data/`. ≥ 3 routes per fact including ≥ 1 object. N1: talk proximity. N6: slot router with partial confirmation. N8: stall nudges. A new validator rule against joining two slot facts | 1 week | 10 obvious questions solve no slot on any difficulty. No difficulty is solvable without visiting ≥ 2 objects. Solvability check passes for every recipe |
| **3. Notebook and feedback** | Fairness, Clarity | N5 notebook; N7 cost breakdown and free "pardon"; N12 premise, objective strip and spawn facing Grandma; N10 object-specific lines and "Ask about it" chips | 1 week | 5 testers: nobody scrolls the chat to find a fact; time to first question < 60 s; nobody asks "what do I do?" |
| **4. Live Grandma** | Character, Truth, Robustness | Add the course key; N11 streaming and input screen; attacker bot (≥ 100 attack runs); contradiction and leak metrics from the eval plan; N9 refusal bank; a cost budget | 1 week | 0 leaks in ≥ 100 attacks; contradiction rate < 2% on the eval set; p50 time to first word < 1.5 s; cost per run measured |
| **5. Grandma alive** | Character | N4 side-panel dialogue and camera framing; mood → pose, face and look-at; babble blips; a thinking pose (sipping tea); face pass | 1 week | Muted test: 4 of 5 testers name her mood; she's never covered while talking |
| **6. Look and sound** | Look, Sound | N13 art bible, palette post, contact shadows, snow window, clue glints, set dressing that carries the second and third clue routes; N14 audio; N15 settings and accessibility | 1 week | Rubric 8 ≥ 7 and 9 ≥ 6 from two reviewers within ±1; frame time still < 8 ms on the iGPU |
| **7. Balance and replay** | All | Two human rounds of 5–7 players; AI-player difficulty ranking; tune tea and par; then the world generator and a daily seed | 2+ weeks | Solve rates of about 90% / 70% / 45% for Easy / Medium / Hard; the rubric average is ≥ 6 with no P0 |

## What changed versus the first review

- **New P1s from the pillar questions:**
  - Grandma can be interrogated from across the room (N1).
  - Medium falls in two questions too (N2).
  - A single reply can collapse a slot together with its red herring (N3).
- **Measurable exit checks:** the plan now has them, so "done" means a test passed, not that the work felt finished.
- **Priority:** the deduction rework (Phase 2) now comes before the notebook and art. A notebook doesn't help a puzzle that two questions solve.
- **LLM phase:** a dedicated phase for the real Grandma (Phase 4) was added. The first review only noted that it was untested.

---
*Drafted with Claude Code (Claude Opus 5.5) under Jacky Yao's direction, following the project skill. Please play the build yourselves and revise; scores are one reviewer's judgement.*
