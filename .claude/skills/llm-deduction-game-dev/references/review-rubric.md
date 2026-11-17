# Review rubric

Score each dimension 0–10 using the anchors, so that two reviewers land within ±1. **Pass bar for a player-facing build:** no P0 findings, an average of at least 6, and no dimension below 4.

## Severity

| Level | Meaning | Example |
|---|---|---|
| P0 | Blocks or corrupts play | A keystroke types into the password box and wastes an attempt |
| P1 | Breaks a pillar | The note can be solved by reading it aloud; Grandma hidden while talking |
| P2 | Clearly hurts quality | Costs unexplained; flat lighting; no audio |
| P3 | Polish | Typos, small alignment issues |

## Dimensions and anchors

| # | Dimension | 2 | 5 | 8 |
|---|---|---|---|---|
| 1 | **Deduction depth** | Direct questions solve every slot | Some slots need a hop; one difficulty is real deduction | Every slot needs ≥ 1 hop; competing answers; ≥ 3 routes per fact |
| 2 | **World as evidence** | Objects are optional decoration | Some objects confirm facts | The room holds facts talk can't give; objects prompt questions |
| 3 | **Character presence** | A chat log with a name | A visible body that idles | Mood-driven poses and face, look-at, voice blips, readable while talking |
| 4 | **Conversation craft** | Repetitive, off-topic, or invents facts | Grounded but bland; deflections repeat | Grounded, in character, varied; refusals are fun; latency hidden |
| 5 | **Fairness and feedback** | Silent failures; brute force wins | Wrong guesses respond; costs partly explained | Partial confirmation, explained costs, stall nudges, a notebook |
| 6 | **Controls and input** | Keys go to the wrong place; can't back out | Works with known quirks | Clear modes, Esc layering, generous targeting, settings |
| 7 | **Onboarding and clarity** | Player doesn't know the goal or where to go | Goal clear after reading text | The first 60 s teach by doing; an objective strip |
| 8 | **Visual cohesion and readability** | Mixed styles; clues invisible | Cohesive at a glance; uneven up close | One palette, shadows, clues stand out, set dressing tells the story |
| 9 | **Audio** | None | Some UI sounds | Room tone, character blips, event chimes, music, all mixed |
| 10 | **Robustness and safety** | Secret leakable; crashes; no fallback | Secret safe; edge input costs or confuses | Layered defences, in-character refusals, budgets, mock fallback, perf headroom |

## Pillar questions (step 3 of the review)

1. **Deduction:** Ask the ten most obvious questions. Does any one of them return a whole slot? How many hops does each difficulty actually need?
2. **World:** Can the game be solved without moving? What does each object add that talk can't?
3. **Character:** Mute the text. Can you tell her mood? Is she visible while you talk?
4. **Fixed truth:** Is every solution fact in data with ≥ 3 routes? Can the model contradict it, and does the validator catch that?
5. **Hands:** In each mode, what do W, E, Enter, Esc and Tab do? Does anything go to the wrong place?

## Evidence standards

- Bugs: steps to reproduce plus the observed result (a screenshot or state dump).
- Design claims: a transcript excerpt or a count (questions to solve, tea left).
- Say what wasn't covered (for example LLM mode without a key, real mouse feel) and lower your confidence in those dimensions.
