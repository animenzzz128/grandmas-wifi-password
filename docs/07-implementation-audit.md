# Implementation audit: design docs vs code (2026-11-13)

A read-only audit comparing what docs 01–04 and 06 promise with what the code implements. **Status: DONE · PARTIAL · MISSING.** Evidence paths are relative to the repo root. Re-run this audit at the start of each development loop and update the statuses.

**Updates since the audit (same day):** Phase 2 started.
- The notes are rewritten as inference hops.
- `Recipe.separate` is enforced by the validator and the mock.
- Talking needs earshot (`docs/03-roadmap.md` Phase 2).

## Gameplay
| Feature | Doc | Status | Evidence / gap |
|---|---|---|---|
| Stamina costs (base 8, long +4, rude +6, follow-up −3) | GDD §3.3 | DONE | `packages/engine/src/rules.ts` |
| Nap to 50; the 3rd nap ends the run | GDD §3.3 | DONE | `run.ts` |
| "Each nap costs a star" | GDD §3.3 | PARTIAL | Naps only block 3★ |
| 3 guesses with Grandma comments | GDD §3.4 | DONE | `run.ts`, `app.ts` |
| Stars and par | GDD §3.5 | PARTIAL | Par uses hard-coded defaults; recipes have `par: null` |
| Cookie | GDD §4 | DONE | Carried to Grandma (Phase 1) |
| Photo album item, reading glasses, hearing aid | GDD §4 | MISSING / PARTIAL | The album is a clue object; the smudged note can't be cleared |
| Notebook | GDD §4 | MISSING | Phase 3 |
| Expert difficulty | GDD §3.1 | MISSING | In the schema only |
| Confusable pairs, relative dates | GDD §3.2 | DONE | Prompt rules, hidden years, validator |
| Self-corrections | GDD §3.2 | MISSING | |
| Daily, Random, Human vs AI and Streamer modes; 4 Grandmas | GDD §5 | MISSING | One Grandma |
| Talk only near Grandma | P06 N1 | DONE (11/13) | Earshot 3.2 m |
| Slot router, stall nudges, cost breakdown | P06 N6–N8 | MISSING | Phase 2–3 |

## Grandma / LLM
| Feature | Doc | Status | Evidence / gap |
|---|---|---|---|
| Haiku structured output and prompt caching | TDD §5 | DONE, **never run live** | `apps/server/src/grandma.ts`; no `.env` key yet |
| Context: last 6 turns, summary, game state | TDD §5④ | PARTIAL | No running summary |
| Password never in the prompt | TDD §5.1 | DONE | Tested |
| Validator: ids, names and numbers, hidden years | TDD §5⑥ | DONE | `validator.ts` |
| Validator: one link per reply | 06 N3 | DONE (11/13) | `Recipe.separate` |
| Validator: contradiction of cited facts | TDD §5⑥c | MISSING | |
| Validator: leak variants (adjacent slots) | TDD §5⑥d | PARTIAL | Exact normalized password; separate groups cover adjacent slots in a reply |
| Input moderation, harmful-input deflection, self-harm stop | TDD §5①, GDD §7 | MISSING | Regex rudeness only |
| Config B (retrieval), effort flag | TDD §5.2 | MISSING | Effort hard-coded to low |
| Shared prompt free of Rosie specifics | TDD §6 | CONTRADICTS | The prompt mentions "Michael set it up" |

## Server / API, client, data
| Feature | Doc | Status | Evidence / gap |
|---|---|---|---|
| 7 endpoints, zod contract, secrets server-side | TDD §4 | DONE | `app.ts`, `api.ts`, tests |
| Run store, JSONL logs | TDD §9 | DONE | `store.ts` |
| Telemetry: $ cost, time to first text, opt-in | TDD §9 | PARTIAL | |
| Rate limits | TDD §4 | PARTIAL | 30/min on ask/show; no daily cap; `POST /runs` unlimited |
| SSE streaming | TDD §4 | MISSING | |
| Golden transcripts | TDD §11 | MISSING | |
| R3F room, controls, HUD, Phase 1 fixes | TDD §8 | DONE | |
| Mood shown on Grandma | GDD §8.1 | MISSING | The server returns `mood`; the client ignores it |
| Audio, accessibility settings | GDD §8.2, §10 | MISSING | |
| World schema and Rosie; i18n | TDD §3, §8.3 | DONE | A few literals left ("z z z", the SSID) |
| Data validator extras (age plausibility, conflicts, anchors) | TDD §6.3 | PARTIAL | |
| World generator, solvability gate | TDD §6–7 | MISSING | README only |
| Deployment, cost dashboard, kill switch | 03 §6 | MISSING | |

## Evaluation (the course's core deliverable)
| Feature | Doc | Status |
|---|---|---|
| Question bank, red-team set, human labels | EVAL §1 | MISSING |
| Metrics (contradiction, invented entities, recall, leaks, latency, cost) | EVAL §2 | MISSING (raw logs only) |
| LLM judge and κ calibration | EVAL §3 | MISSING |
| AI player agent | EVAL §4 | MISSING |
| Ablation runner | EVAL §5 | MISSING |
| Report generator | EVAL §8 | MISSING |
| Human playtest protocol | EVAL §6 | Written, not run |

## Top gaps for the course demo
1. The real Grandma has never run. Put the course key in `.env` and test the retry path against the API.
2. No evaluation code: question bank, metrics, report.
3. No LLM judge or calibration.
4. No AI player, which blocks par, the solvability gate and the human-vs-AI comparison.
5. No ablation switches (retrieval, validator on/off, effort).
6. Validator gaps: contradiction check, leak variants.
7. No red-team set; no input moderation or safety deflections.
8. No world generator; Rosie specifics remain in the shared prompt.
9. Deduction depth: being fixed in Phase 2.
10. Latency and cost aren't measured or shown; no streaming; no deployed URL.

---
*Audit produced with Claude Code (Claude Opus 5.5) under Jacky Yao's direction; spot-check before relying on it.*

## Update after the development loop (2026-11-13)

Six loop iterations (self-check, plan, build, verify) closed these gaps. Statuses in the tables above are from the morning audit; this list supersedes them.

| Area | Now done | Evidence |
|---|---|---|
| Deduction | Notes as inference hops; `Recipe.separate`; persona rule against connecting memories; earshot; slot router with partial confirmation; stall nudges; solvability walkthrough tests | `data/grandmas/rosie.chains.md`, `apps/server/test/api.test.ts` |
| Evaluation | Question bank (60), red-team set (32), batch runner with ablation switches, rule metrics, reports; data check that no memory holds a whole answer | `eval/`, `npm run eval` |
| Safety | Self-harm mentions get help resources (988), free; non-English input gets a free "pardon" | `rules.ts`, API tests |
| Feedback | Notebook (Tab), cost reasons, objectives strip, title premise, object-specific show replies | `apps/web/src/notebook.ts`, `Hud.tsx` |
| Character | Mood poses, talking nods, looks at the player, babble voice and chimes (WebAudio), chat moves aside while talking | `Grandma.tsx`, `audio.ts` |
| Look and settings | Contact shadows, snowy window, clue glints, settings (sensitivity, FOV, invert Y, relaxed mode) | `Room.tsx`, `Glint.tsx`, `settings.ts` |

**Still open, and blocked on people rather than code:**
1. The course API key in `.env`: the live Grandma, the LLM eval run, the LLM judge, the LLM AI player and Q-bank growth.
2. Human playtests: Phase 3 and 5 exit checks, mouse feel, balance (Phase 7).
3. Art beyond code: Grandma's face, a palette pass, more set dressing.
4. A commit: everything since the art pass is uncommitted.

### Iteration 7 (same day)
Validator contradiction and leak-variant checks (audit items TDD §5⑥c/d); world-generic prompt (the "CONTRADICTS" row); anchor-year and fact-year data checks (TDD §6.3); bootstrap CIs and the ablation table (EVAL §5); per-IP daily cap, run-creation limit and $ cost per turn (TDD §4, §9); naps cost stars (GDD §3.3); the router SSID and the dozing bubble moved to i18n.

### Iteration 8 (same day)
LLM judge with human-label calibration (EVAL §3), AI player agent over the HTTP API (EVAL §4) and the Q-bank generator (EVAL §1) are built, cost-guarded and tested with a fake client. They have not been run: that needs the course key.

### Iteration 9 (same day)
- **Config B (TDD §5.2):** retrieval context behind a brain option. It uses lexical top-k rather than embeddings, so no extra service is needed. It adds a shown object's facts, recent facts, confusable partners and seeded distractors. The ablation now has the B1/B2 rows (LLM only).
- **LLM brain tests:** the request flow (config A vs B system blocks, validator retry with the rejection note, fallback) is tested with a fake client.
- **Retro post-process** (art bible palette).
- **Deployment config:** Dockerfile, .dockerignore, fly.toml with volume and secrets. Not deployed, and not built in Docker locally (no Docker installed).
- **Rate limits** now key on Fly-Client-IP.

### Iterations 10–15 (same day)
- **Grandma alive (GDD §8.1):** no clipping in the chair (plain armchair, tucked elbows, a draped cloth blanket in `scene/blanket.ts`, unit-tested); relaxed fingers; a teacup whose tea follows the meter, sipped every 12–22 s; a palm-up talking gesture; she pushes up her glasses when puzzled; a mouth that opens while she talks (no jaw bone in the model, so it is an overlay, not lip sync).
- **Voice (GDD §9):** she reads her lines aloud (browser speech, prosody by mood); the player can ask out loud (V or 🎤); mishears from a pun table, capped at 1 in 5, free, not counted, and answered with a canned line so they never leak a fact (`packages/engine/src/mishear.ts`). Server-side STT and the hearing-aid item are still MISSING.
- **Notebook pinning (GDD §4):** highlight any of Grandma's words, or click 📌 on her line.
- **Errors and loading (03 M4):** friendly messages instead of status lines or schema dumps; a failed question stays in the box; a loading pill; a keyboard-needed note on phones.
- **Accessibility (GDD §10):** text size (85–160%) and a readable-font option in Settings. A bundled dyslexia font (e.g. OpenDyslexic) is not included; the option uses system Verdana/Tahoma with wider spacing.

**Re-audit of the original MISSING rows (2026-11-13, end of day):**

| Row | Now |
|---|---|
| Notebook; slot router, stall nudges, cost breakdown; mood shown on Grandma; audio and accessibility settings; validator contradiction and leak variants; input moderation and self-harm stop; Config B and effort flag; question bank, red-team set, metrics, judge, AI player, ablations, report | DONE (code), LLM-dependent parts not yet run |
| Photo album item, reading glasses, hearing aid | PARTIAL (the photo album is a clue object; reading glasses DONE in iteration 16; no hearing aid) |
| Expert difficulty | MISSING (schema only) |
| Self-corrections | DONE in iteration 18 |
| Daily, Random, Human vs AI, Streamer modes; 4 Grandmas | Daily DONE in iterations 21 and 27 (pool of 3 puzzles until more Grandmas or recipes exist; global stats from the run store); the others MISSING (one Grandma) |
| Running summary in the context | DONE in iteration 20 |
| SSE streaming | MISSING |
| Golden transcripts | DONE in iteration 17 (mock and handwritten; LLM ones need the key) |
| World generator, solvability gate | MISSING (solvability walkthrough tests exist for Rosie) |
| Cost dashboard, kill switch; deployment | Kill switch and daily budget DONE in iteration 19; spend, latency and solve-rate report DONE in iteration 22 (`npm run stats`, no web UI); not deployed |
| Human labels; human playtests | Blocked on people |

### Iteration 16 (same day)
- **Reading glasses (GDD §4):** folded on the coffee table. Putting them on (once per visit) reveals the smudged part of the note (Medium: "col█r TV" → "color TV"), opens the note and gets a line from Grandma; on notes without a smudge they aren't used up. Server rule (`wearGlasses`, `noteText` in `run.ts`), `RunView.note.smudged` and `RunView.glasses`, API test.
- Fixes found while checking: a missing prompt string, and non-clue objects (cookie jar, glasses) no longer tick "Find proof in the room".

### Iteration 17 (same day)
- **Golden transcripts (TDD §11):** 20 recorded conversations (14 mock, 6 handwritten probes) replayed against the validator in the test suite; a tampered verdict is caught. While writing the probes, a suspected gap in the backwards-password check turned out to be a typo in the probe (the reversal of "Biscuit1961" is "1691tiucsib"); the check works.

### Iteration 18 (same day)
- **Self-corrections (GDD §3.2):** a fact may carry `misremembers` (a wrong year within 3 of the true one; data check refuses it on years a recipe hides). She may say "1962… no, '61" for those memories only (prompt rule, mock 50%), always ending on the true year. The validator resolves marked slips before its year checks, accepts short years ('61) of known memories, and flags any other self-correction. The notebook records the year she settled on. Rosie: the wedding (1962→1961) and the color TV (1970→1969).
- **Two validator gaps found by the new golden probes and fixed:** the design's own example "'61" was flagged as an unknown number, and an unmarked slip to a year that exists elsewhere in her life ("1958… no, '61") passed.

### Iteration 19 (same day)
- **Cost guard (03 §6):** `BudgetBrain` wraps the LLM Grandma. Past `GRANDMA_DAILY_BUDGET_USD` (default $5, UTC day, restored from the turn logs on restart) or while `var/KILL` exists, the offline Grandma answers; `/api/health` reports `degraded: budget | kill` and the title screen tells players. Tested with a priced fake brain (budget, next-day reset, kill file, log restore, health).
- The new test keeps its scratch files in the OS temp folder instead of deleting them (the project avoids permanent deletes in code).

### Iteration 20 (same day)
- **Running summary (TDD §5④):** once a visit outgrows the 6-exchange window, the new user turn carries a summary built from the turns' fact ids (memories already told, objects shown) plus the game state (questions so far, tea). No extra model call, and the cached system blocks are untouched. Tested in the engine and through the LLM brain with a fake client. Whether it measurably improves consistency needs the course key (contradiction rate on long visits).

### Iteration 21 (same day)
- **Daily Grandma (GDD §5):** `packages/engine/src/daily.ts` picks the day's (Grandma, recipe) from every pair in `data/`: day #1 is 2026-11-13 (UTC), each cycle of pool-size days is a seeded shuffle, so every puzzle comes up once per cycle and never twice in a row. `GET /api/daily` says which one (without the note); `POST /api/runs {daily: true}` starts it with the same greeting for everyone. The browser keeps the first finished result of each day (replays are marked practice), a streak and a countdown; the result card reads "Grandma #N · Daily". Tested in the engine, the API and the client, and played in the browser. With one Grandma the pool is only 3 puzzles; it grows with every Grandma or recipe added. Global stats ("38% solved today") would need a server counter and are not built.
- **Flaky test fixed at the root:** the easy walkthrough failed about 1 run in 40. The offline Grandma's random tangent sometimes completed the password ("Biscuit… We got married in 1961"), the validator rightly rejected it, and the retry repeated the same reply, so the player got a "say that again?" that still cost tea (about 1–2% of on-chain questions on Easy). Tangents that would spell out every part together with the main memory are now never picked; 30,000 seeded replies show 0 rejections (was 85).
- **A test that couldn't fail:** a mishear test's year regex had been mangled into control characters by shell escaping in iteration 11, so it matched nothing. Repaired; it passes.
- "Solved in 1 questions" now reads "1 question" (`<key>.one` string variants).

### Iteration 22 (same day)
- **Play stats (TDD §9, 03 §6 cost dashboard):** `npm run stats` (`eval/src/playstats.ts`) reads the server's turn logs and reports per puzzle visits, solves, out-of-guesses, bedtimes, unfinished, and median questions to solve next to the par in use (from `data/`), daily results, and for model turns spend, latency p50/p95, validator retry and fallback rates, prompt-cache share and the commonest rejection types (grouped by type, not value). It prints aggregates only, never player text or replies (tested). Daily visits are now marked in the logs. This is the tool the human playtests need for their numbers (eval plan §6 now says how to use it). Run on today's local logs it shows only the mock Grandma and automated test visits, so its numbers mean nothing yet.
- Not a web dashboard: on Fly it runs over `fly ssh console -C "npm run stats"` (it reads `$VAR_DIR/logs`; the image includes `eval/` and tsx, but this has not been tried on Fly). A page would need operator auth; not worth it for the course.

### Iteration 23 (same day)
- **Juice and ambience (GDD §8.2–8.3):** confetti over the router screen on a solve (90 CSS pieces, decorative, skipped under `prefers-reduced-motion`); soft snores every few seconds while Grandma dozes (low tea or bedtime), next to the existing "z z z" bubble; a quiet ticking clock while a visit is on, with a "Room sounds" setting. All sounds are made in code with WebAudio (no files, nothing to license); muting (M) silences them. Players who ask for reduced motion also lose the mishear pop and the loading pulse.
- **Checked:** confetti mounts on a solve and its keyframes move the pieces (seeked in the browser, since the hidden preview pane doesn't advance animations); the snore and clock run without errors. **Not checked:** what they sound like. Someone needs to listen (and say whether the clock is soothing or annoying). No music or kettle yet; eyes closing as tea drops needs eyelids the model doesn't have.

### Iteration 24 (same day)
- **Type-out (GDD §8.1 "speech bubble types out text"):** Grandma's new lines appear word by word in the chat (about 55 characters a second, never longer than 3.5 s a line) with a blinking caret. A nap or nudge line after a reply waits its turn. Clicking the chat, or asking the next question, shows everything at once; a setting and `prefers-reduced-motion` turn it off. The pin button and highlighting work on the whole line. Pure rules in `apps/web/src/typeout.ts` (tested); checked in the browser (text grows over ~2.4 s for a 126-character reply; a click shows it all).

### Iteration 25 (same day)
- **Self-check, colour-only information (GDD §10):** passes. A wrong router slot is red *and* gets the "N of M parts right" line; the tea bar has its number; objectives use ticks and strike-through; nothing in the room is coded by colour alone.
- **First-load size:** Grandma's three 2048 px PNG textures were ~4.6 MB of a ~6 MB download, far more detail than the low-pixel-ratio retro render shows. `tools/shrink-textures.py` (Pillow) resizes opaque textures to 1024 px JPEG and repoints the .gltf files: 4.6 MB → 224 KB; `apps/web/public` 6.0 → 1.8 MB, the built site 7.3 → 3.1 MB. Same-view screenshots before and after look the same. The old PNGs went to the Recycle Bin (the script itself deletes nothing). `tools/import-assets.mjs` now says to run it after an import.
- Still large: the JS bundle (1.4 MB, 395 KB gzipped, mostly three.js) and Grandma's mesh (0.97 MB). Code-splitting the 3D scene: done in iteration 26.

### Iteration 26 (same day)
- **Title screen first:** the 3D room and HUD (three.js, drei) are a lazily loaded chunk (`apps/web/src/Game.tsx`). The title screen's JS is 344 KB (107 KB gzipped) instead of 1.4 MB (395 KB); the game chunk (289 KB gzipped) starts downloading as soon as the title shows, so a click rarely waits, and a "Knocking on Grandma's door…" screen covers the rest. Checked in the browser: the chunk is fetched while the title is up, and starting a visit mounts the canvas and HUD.

### Iteration 27 (same day)
- **Daily global stats (GDD §5):** `GET /api/daily` now carries today's finished visits, how many were solved and the median questions of the solved ones, from the run store (`RunStore.dailyStats`, a JSON query over the runs table). Shown on the title screen ("Everyone today: 2 of 4 finished visits solved it (50%) · usually in 1 question") only once 3 visits have finished. They count visits, not people (no accounts), so practice replays count too; that is said in the code and the API schema. API test covers the threshold, unfinished and non-daily visits; checked on the title screen in the browser.

### Iteration 28 (same day)
- **Production build smoke test:** the built site served by the real server (`node --import tsx apps/server/src/main.ts --mock`, as `npm start` does) in the browser: the title screen fetched only its own 107 KB-gzipped JS and then prefetched the game chunk; a visit started, the room and Grandma loaded (8 model files, JPEG textures), the greeting showed, and no dev hooks (`__game`) or debug badge were exposed. No console errors (one three.js deprecation warning). Not tried: the Docker image itself (no Docker here).
- An independent code review (fresh context, read-only) was started to find defects for the next rounds.

### Iteration 29 (same day): fixes from the independent review
The fresh-context review (read-only, 15 findings) is the work list for iterations 29–32. This round: its P1 and the three P2s that matter before a live LLM run.
- **P1, leak check missed other forms of the answer:** "Biscuit… married in '61", "nineteen sixty-one", "B-i-s-c-u-i-t" passed on Easy. `leakForms` (`text.ts`) now adds short years, spelled years ("nineteen hundred and sixty-one"), runs of digit words ("four one two") and letter-by-letter words before the every-part check; r_easy also got a `separate` group (dog, wedding), like the other recipes. Tested both ways (caught when all parts are there, allowed one part at a time). The one golden probe that changed verdict (it now also gets the separate-group error) was re-recorded on purpose; the mock eval still shows 0% leaks and fallbacks.
- **P2, fallbacks cost tea:** when Grandma's reply fails validation twice or the model call fails, the "say that again?" line is now free and doesn't count as a question or toward a nudge, like a mishear. API test with a brain that always falls back.
- **P2, no timeout on the model call:** the Anthropic client now gives up after 12 s with no SDK retry (the validation loop already tries twice), so the worst case is about 24 s instead of minutes; the player gets the free fallback line.
- **P2, the question cap didn't end the visit:** the 40th question now ends it as bedtime (`endAtQuestionCap`), with the goodnight line and the result card, also in relaxed mode. Before, the server kept answering 409 and the client never showed a result. API test.

### Iteration 30 (same day): review findings 5, 7, 8, 9
- **Fair questions charged as rude or deflected:** "Whatever happened to Grandpa's sled?", "Was the snowstorm boring?" and "Were you in a hurry to get married?" cost +6 as rude, and so did any caps-lock question; "What does the password hint mean?" and "Who set up the wifi password?" got the canned deflection. Rudeness now has to be aimed at her ("you're boring", "hurry up", "just answer", "stop rambling", "your cookies are terrible", shouting = all caps *with* "!"), and questions about the hint, its meaning or who set the Wi-Fi up go to Grandma (Michael set it up is one of her memories). All six rude items in the question bank still count as rude; the direct and extraction password asks are still deflected. Tested both ways.
- **Hard nudge pointed at the wrong story:** "Ask me how your grandpa and I met… with a bird in it" led to the county-fair memory, which has no bird. It now says "Ask me what your grandpa calls me, dear. He's had a pet name for me since the day we met." (the Sparrow hop). Also "meet" and "met" now match each other in retrieval.
- **Items lost while she was thinking:** showing a clue or giving the cookie during a reply took it out of your hands, left "[shows the …]" in the chat and sent nothing. Now you keep it and get "Grandma is still answering. Give her a moment."; a failed request gives it back with a note. Checked in the browser.
- **Keyboard stuck on cards:** Tab and Space were swallowed while a card was open, so keyboard players couldn't reach its buttons, and the Settings dropdown ignored the arrow keys. With a card open those keys now do their usual jobs; in the room Tab still opens the notebook and Esc still closes cards (checked in the browser).

### Iteration 31 (same day): review findings 6, 10, 12, 14
- **Only her last line was voiced, and never the greeting:** a reply that came with a nap line or a nudge was spoken as the nudge alone, and the greeting was silent. Every new Grandma line is now voiced (spoken or babbled) in order as one utterance, the greeting included. Checked in the browser by recording what the page sent to speech synthesis. (Her pose still follows the newest line.)
- **Leftovers from the last visit:** the hint toast and the big mishear banner ("PASS THE SWORD?!") replayed when the next visit started. Starting and leaving a visit now clear them (checked).
- **Stale Daily box:** the title screen's countdown and stats came from one fetch at page load. Leaving a visit now refetches today's daily, the countdown ticks every 30 s, and when it reaches zero the box fetches the new Grandma (checked: leaving refetches).
- **Router feedback vanished:** "1 of 2 parts are right" disappeared on the next keystroke. Each wrong try now stays in the chat: "(Router: tried biscuit + 1900.) Not quite. 1 of 2 parts are right." (checked).

### Iteration 32 (same day): review findings 11, 13, 15, and the end of the review list
- **Router objective:** it compared attempts left with the nap limit (both happen to be 3). `RunView.maxAttempts` now exists and the objective uses it (checked: one wrong try ticks it). `data/schema/*.json` regenerated (`npm run schema`), which also picks up the daily fields from iterations 21 and 27.
- **Follow-up discount could be gamed:** starting every question with "And…" or "So…" made it 3 tea cheaper. An opener now counts only if the question doesn't bring up another memory ("And then what happened?" and "Really? Why?" still do; "And when did you get married?" after the dog story doesn't). Sharing a keyword with her last reply still counts, as before. Tested.
- **Cookie jar text:** "a ceramic jar full of apricot kolaczki" contradicted the one-cookie rule; it now holds "one last apricot kolaczki".

**Review list status:** all 15 findings fixed in iterations 29–32 (P1: 1; P2: 2–9; P3: 10–15). Still not covered by anyone: real browser play by a person, how the sounds feel, and the live LLM.
