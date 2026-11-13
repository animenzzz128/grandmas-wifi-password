---
name: llm-deduction-game-dev
description: Design, build, review and playtest guide for games where the player deduces a hidden answer by talking in free text to an LLM character and exploring a small 3D space, such as Grandma's Wi-Fi Password (React Three Fiber client, Hono server, Claude Haiku Grandma). Use it whenever someone designs or changes a puzzle, recipe, clue object, Grandma's prompt or validator, the stamina/tea economy, controls, HUD, art, audio or onboarding; asks for a review, critique, score, playtest or "what should we fix next"; or plans a milestone. It also applies to other LLM-NPC mystery or interrogation games. Not for generic three.js API questions or Claude API syntax (use claude-api for that).
---

# LLM deduction game: development and review guide

Distilled from postmortems of LLM-NPC games (1001 Nights, Vaudeville, Event[0], Suck Up!, Hidden Door, Ubisoft NEO NPC, Façade), deduction design (Obra Dinn, Golden Idol, Outer Wilds, Her Story, the Three Clue Rule), game feel and accessibility guidelines, and existing game-dev agent skills. Every principle in `references/` cites its source; see `references/sources.md`.

## The promise this genre makes

The player should feel: *"I worked it out myself, from what she said and what I found."* Every decision is judged against five pillars:

1. **Deduction, not dictation.** The answer is assembled by the player through inference hops. If asking the note aloud solves it, the puzzle has failed.
2. **The world holds evidence.** Exploring the room yields facts that talking alone can't. Conversation and space feed each other.
3. **A character, not a chatbot.** She has moods, flaws, a body and a voice. Her limits are part of her personality (forgetful, rambling), not error messages.
4. **The truth is fixed and fair.** Every solution fact exists before play, in data, reachable by at least three routes. The model words facts; it never invents or decides them.
5. **Frictionless hands.** Look, walk, talk, read and type never fight each other. The player always knows which mode they're in and how to get out.

## Pick the job, then read only what it needs

| Job | Do | Read first |
|---|---|---|
| Design or change a puzzle, recipe, note, clue object | Write an inference-chain map before content; check the fairness checklist | `references/deduction-design.md` |
| Change Grandma: prompt, persona, validator, mood, latency, cost, safety | Keep game logic in code; check the leak and consistency rules | `references/llm-character.md` |
| Controls, HUD, cards, chat box, onboarding, feedback, accessibility | Check the input-mode rules and the quality floors | `references/feel-ui-input.md` |
| Art, lighting, props, audio, credits, Steam page | Follow the build order; log every asset | `references/art-audio.md` |
| Review, critique, score, "what next" | Run the review procedure below; score with the rubric; do not edit code | `references/review-rubric.md` |
| Playtest (automated or with people) | Use the bundled scripts; record evidence | `references/playtest.md` |

When a job touches several rows, read each matching file, but don't load files the job doesn't need.

## Quality floors (the minimum before anything ships to players)

These come from repeated failures in the sources. A build below any floor gets a P0 or P1 finding, whatever else is good.

- **No keystroke goes to the wrong place.** The key that opens a panel never types into it; WASD never silently types into a text box; Esc always backs out exactly one layer.
- **The protagonist is visible while you talk to her.** No UI covers Grandma during conversation.
- **Every cost and every failure explains itself.** Tea costs show their reason; a wrong guess says something useful; refusals happen in character.
- **The secret can't leak from the model.** The assembled answer and the riddle-to-fact mapping are never in the prompt; an output check catches the password, its parts and spelled-out variants.
- **Something happens within ~100 ms of every input.** Moves, highlights, a "thinking" pose while the model works; nothing freezes.
- **Text matches the world.** Descriptions, prompts, labels and the 3D scene agree.
- **Players are never stuck in silence.** After N unproductive turns or seconds, the game nudges.
- **Debug info is invisible to players.** Mode badges, FPS and dev hooks only in development.

## Working rules

- **Fixed truth first, words second.** Puzzle facts live in `data/grandmas/*.json` and are checked by `npm run validate`. Never solve a design problem by asking the model to "remember" or "make up" something.
- **Mechanics in code, flavour in the model.** Stamina, guesses, confirmation, nudges and state changes are server rules. The model chooses wording and mood within them.
- **Evidence before "done".** A feature is done when there is proof: a test, a validator rule, a screenshot from a real browser, or a playtest log. "The code looks right" isn't evidence for anything a player touches.
- **Smallest change that moves a pillar.** Prefer fixing a floor or a pillar gap over adding a feature.
- **Keep portability rules** (technical design §8.3): scene as data, strings in `data/i18n`, no game rules in the client.
- **Respect the team's choices.** In a review, report and recommend; change code only when asked. Before a big change, make sure there's a commit to return to.

## Review procedure

Use this for "review / critique / score / what should we fix". Don't edit code during a review.

1. **Gather evidence.** Read the design docs, the data (worlds, scenes, strings) and the relevant code. Play the current build: `references/playtest.md` has a scripted Chrome session. Note what you couldn't test (for example LLM mode without a key) and say so.
2. **Check the floors** above. Each failure is a finding with a repro.
3. **Check each pillar** with the questions in `references/review-rubric.md`.
4. **Score** the ten rubric dimensions using the anchors, not gut feel.
5. **Write findings** with severity (P0 blocks play · P1 breaks a pillar · P2 hurts quality · P3 polish), evidence and a concrete fix.
6. **Plan**: order the fixes into phases; each phase has a goal tied to a pillar, tasks, a size and an exit check that proves it worked.

Report template:

```markdown
# Review: <build/date>
Coverage: what was played and how · what was not tested
## Verdict (3–5 sentences, tied to the pillars)
## Scorecard (10 dimensions, score /10, one-line reason; pass bar = no P0, average ≥ 6, no dimension < 4)
## Floors (pass/fail each, with evidence)
## Findings (ID · severity · pillar · evidence · fix)
## Plan (phases: goal · tasks · size · exit check)
```

## Bundled scripts

- `scripts/launch-chrome.ps1`: opens a separate Chrome window with remote debugging (throwaway profile).
- `scripts/cdp.mjs`: no-dependency Chrome DevTools driver: keys, typing, clicks, mouse motion, screenshots, page JS. Run it; don't read it unless it breaks.
- `scripts/page-helpers.js`: injected into the page for FPS, state, asking Grandma and movement traces. Needs the dev build's `__game`, `__camera` and `__view` hooks.

Usage and the standard scenario list are in `references/playtest.md`.
