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

### Iteration 33 (11/14): end screen and card accessibility
A full Medium visit in the browser (9 questions, one wrong try, solved) worked end to end. Fixes from it:
- **End screen:** the look hint and the controls line stayed on top of the result card, and so did the objectives list (with "Read the note" still unticked after a win). They now hide once the visit is over. If the visit ends while the mouse is captured, the card releases it.
- **Result card for keyboard and screen readers:** it is now a labelled dialog, "Copy result" has focus when it opens (Enter copies, Tab reaches "Visit again"), and the stars read as "2 of 3 stars" instead of three emoji names.
- **Copy could fail silently:** where the browser refuses the clipboard (insecure page, permission), the card now selects the share text and says to press Ctrl+C. Checked in the preview, which refuses the clipboard.
- **Cards are labelled dialogs:** the note, router, notebook, object and Settings cards (in the room and on the title screen) have `role="dialog"` named by their heading.
- A fresh read-only security and robustness review of the server was started for the next rounds.

### Iteration 34 (11/14): security review, finding A (the leak check read only ASCII)
The security review found 3 P1 and 3 P2 problems. None hands out the answer through the API, the bundle or a dev hook. The list, to be worked through in the next rounds:
- **A (P1), fixed here:** replies in look-alike characters got past every leak check: fullwidth "Ｂｉｓｃｕｉｔ１９６１", digits one at a time ("1 9 6 1"), a zero-width space inside a name, and a hidden Hard year as "１９７７". The one-memory-per-reply rule trusted the model's own list of memories, so citing none skipped it. Now every check reads the reply folded to plain characters (NFKC, invisible characters removed). Letters from other scripts (Cyrillic look-alikes) and non-ASCII digits get the reply retried; accented Latin like "kołaczki" is fine. Digits said one at a time count as one number. Memories told in the text count even when the model lists none (a sentence with the memory's year and one of its own words, or its number). Each bypass was confirmed to pass before and is caught now (tested); 28,800 mock replies over the question bank still get no false rejections. Whether Haiku would follow such an injection is untested (no key).
- **B (P1):** the daily budget can be drained from many IPv6 addresses, and fallback turns make model calls without counting toward any cap.
- **C (P1):** no request-body limit, no rate limit on `/item` and `/guess`, and every no-op item call is written to the database and the turn log (the log can grow until the budget's restart read fails).
- **D (P2):** parallel asks on one run aren't serialized; status and the question cap aren't re-checked after the model call.
- **E (P2):** failing a daily on purpose with three free wrong guesses reveals the daily password, and can skew the shared daily stats.
- **F (P2):** text typed with "show" skips the self-harm, language and password checks.
- P3: the in-memory run map never evicts; no security headers; bracketed player text can imitate game notes.

### Iteration 35 (11/14): security review, findings C, D and F
- **C, request floods (fixed):** request bodies over 8 KB are turned away before they are read (413; the largest real body is a 280-character question). Guesses and item uses are limited to 60 a minute per address. Item uses that change nothing (a second cookie, glasses on an unsmudged note) are no longer saved or logged, so repeating them can't fill the disk. The budget's restart read goes through the day's log in 1 MB chunks instead of loading it whole. Tested: oversized body, rate limit, no-op items leave no log line, a 3 MB log with lines split across chunks.
- **D, parallel requests (fixed):** each visit handles one request at a time; a second ask, show, guess or item use while Grandma is still answering gets 409 "Grandma's still answering". So parallel asks can't pass the 40-question cap, and a guess can't land in the middle of a reply. Tested with a held model call. (The game's own client never overlaps requests; it already waits.)
- **F, show text (fixed):** text typed while showing an object now gets the same checks as a question: the self-harm reply, the language check and the password deflection, none of which call the model. Tested.
- Still open: **B** (budget drain from many addresses; fallback turns making uncounted model calls) and **E** (daily password revealed by failing on purpose), plus the P3 items.

### Iteration 36 (11/14): security review, findings B and E
- **E, daily password (fixed):** a daily that ends without a solve no longer shows its password until the next daily is up ("Today's password stays a secret until tomorrow's Grandma"). Ordinary visits and solved dailies still show it. Visits that end without a single question (three wrong guesses straight away, as a script would) no longer count toward the shared daily stats. Tested, and checked in the browser on today's daily. `RunResult.password` is now optional in the API schema (regenerated).
- **B, budget drain (fixed as far as one server can):**
  - Rate limits count a whole IPv6 /64 as one client (a home connection usually gets one), so rotating addresses inside it doesn't help; IPv4 addresses still count one by one, and IPv4-in-IPv6 is read as IPv4.
  - A server-wide limit of 120 questions a minute from all players together, so no spread of addresses can spend faster than that.
  - Fallback replies are free only 8 times a visit; after that they cost and count like any question, so questions built to fail every check can't buy model calls for nothing.
  - `max_tokens` lowered from 2000 to 1000 (a reply is at most 700 characters).
  - Tested: /64 keys, a shared limit across a /64, the server-wide cap, the fallback cap.
  - Not checked: whether Fly's proxy overwrites a client-supplied `Fly-Client-IP` (needs a deployed test). Limits and the budget live in one process, so if Fly ever runs more than one machine, each gets its own; `fly.toml` doesn't pin the count, so deploy with one machine (`fly scale count 1`).
- **Security review status:** A–F fixed (iterations 34–36). P3 items left: the in-memory run map never evicts, no security headers, and bracketed player text can imitate game notes.

### Iteration 37 (11/14): security review P3 items, and a flaky test
- **Security headers:** every response, the built game included, now carries a content security policy (same site only; `data:`/`blob:` for three.js textures; `'wasm-unsafe-eval'` for the mesh decoder's WebAssembly; no plugins; no framing), `nosniff`, and a permissions policy that allows the microphone on this site only. Checked on the production server (`--mock`, port 8790): the first version of the policy left out `'wasm-unsafe-eval'`, and the room stopped loading at 47%; with it, the room loads fully, all 50 assets arrive, the API works, and the page reports no policy violations. The header test pins the policy so this can't regress silently.
- **Run memory:** only visits in progress stay in memory, at most 2,000 (least recently used go first); finished ones are read from SQLite when asked for. Tested (finished visits leave memory; an evicted visit still plays on from the database).
- **Bracketed player text:** square brackets are the game's own notes to Grandma ("[shows you the photo]", "[Memories this object brings back: …]"), so typed brackets now become round ones before the model or the logs see them. Tested, and seen in the production log.
- **Flaky test fixed at the root:** "nudges toward the first hop" failed about 1 run in 14. Visits get random IDs, and when the offline Grandma's random tangent touches a chain memory, that counts as progress and resets the stall count, as designed. A 1,000-visit probe showed 7% had no nudge within the test's 6 questions and none lacked one within 12, so the test now allows 12.
- **Security review: all items fixed** (A–F and the P3s, iterations 34–37).

### Iteration 38 (11/14): deploy readiness
- **Container build, simulated:** there's no Docker on this machine, so the image's steps were run by hand on a clean copy that leaves out exactly what `.dockerignore` leaves out: `npm ci --include=dev`, `npm run validate`, `npm run build`, then `npm start` with `NODE_ENV=production`, `GRANDMA_MODE=mock` and a fresh `VAR_DIR`. Every step passed; the server answered health, the page, a deep link (served the app) and a full visit with a question. Not covered: the Linux base image itself (`node:24-slim`) and Fly.
- **One machine on Fly:** rate limits, the one-request-per-visit lock, live visits and the daily budget live in the server process, so a second machine would double the limits and the budget. `fly.toml` and the README now say to deploy with `--ha=false` and check `fly scale show`.
- A fresh read-only review of gameplay and the client was started for the next rounds.

### Iteration 39 (11/14): gameplay review, P1s and P2s
The gameplay and client review found 2 P1s, 3 P2s and 6 P3s (code reading only). Fixed this round:
- **P1, keys on the result screen:** after a visit ended, the room's key handler still took Enter, Space and Tab: "Copy result" couldn't be pressed from the keyboard, Tab opened the notebook hidden behind the card, and E opened hidden cards. The room's keys now stand down once the visit is over. Checked in the browser: on the result card no key is swallowed and nothing opens behind it; during a visit Tab still opens the notebook.
- **P1, blocked storage gave a blank page:** with cookies blocked, merely reading `localStorage` throws, and the mute setting (read when the sound module loads) and the daily record (read while drawing the title screen) did so outside any guard. All storage now goes through `apps/web/src/storage.ts`, which never throws and keeps values in memory for the tab when the browser refuses. Tested (blocked reads, failing writes, the daily record with storage blocked).
- **P2, no error boundary:** a browser without WebGL, or a failed download of the game chunk, left a blank page. The room now sits in an error boundary that says what happened in plain words, with Reload and "Back to the start". (Not triggered in a real browser: the preview always has WebGL.)
- **P2, Hard's year had two fair answers:** "Michael broke his arm the winter he was eleven" plus "born 1966" gives 1977 only if he was born late in the year; otherwise that winter runs into 1978. The fact now says "the year he turned eleven" (the anchor is still "the winter Michael broke his arm"). Golden transcripts re-recorded: only the wording of some offline tangents changed, no verdicts (78 clean turns before and after).
- **P2, the Medium nudge pointed at a plate you couldn't use:** "That moon-landing plate by the TV… Have a look" led to a decoration outside the TV's hit box. The plate is now a clue of its own (memories `f_moon`, `f_tv`; "Grandpa bought it the same summer as the TV"). Checked in the browser: its card opens and the year goes into the notebook; its memory IDs are not sent to the client.
- **P3, Enter far from Grandma** no longer drops mouse look just to say "she can't hear you" (checked).
- Left for the next rounds (P3): a cookie given at full tea is wasted silently, and the empty jar still says "Take a cookie"; the floating "Pin to notebook" button can be stranded; the stall count ignores one-step clue facts on Easy; the reading glasses never matter (Medium's smudge is obvious, Easy and Hard have none); screen readers don't hear new chat lines, toasts or router feedback.

### Iteration 40 (11/14): gameplay review, P3s
- **Cookie at full tea:** the only cookie used to vanish when given early (tea is capped at 100, so it did nothing) while Grandma said she felt ten years younger. While her tea is at 80 or more she now says "Save that for later, dear…" and the player keeps it (`RULES.cookieRefuseAt`, new `cookie_full` lines). The empty jar's prompt reads "Look at the empty cookie jar". Tested; checked in the browser (refused at 100 and kept in hand; eaten at 68, tea to 93).
- **Stranded pin button:** the floating "Pin to notebook" button now goes away when the highlight is cleared or the mouse is captured again, so it can't float over the room and pin stale text (checked).
- **Screen readers:** a single polite live region reads each new line from Grandma ("Grandma says: …") or the game, in full rather than while it types out, and each hint. Errors are announced as alerts, the question box has a label, and the chat is labelled (checked that the region updates). Not tried with an actual screen reader.
- Still open from the review (both design calls): the stall count ignores one-step clue facts on Easy, and the reading glasses never change anything (Medium's smudge "col█r" is guessable, Easy and Hard have none). Both are puzzle-design changes for the team.

### Iteration 41 (11/14): the stall nudge counts facts about the answer
- The nudge counted only chain facts as progress, so on Easy "Who stole the socks?" (→ Biscuit, the answer to the first part) still counted as stalling. New `progressFacts` adds any fact about the answer itself when a part of the answer is a person, pet or place: Biscuit's breed and sock stealing on Easy, Michael born in the Maple Avenue house on Medium; nothing changes on Hard (its answers are a word and a year). `chainFacts` keeps its meaning. Tested; golden transcripts unchanged.
- **Gameplay review status:** all code-level findings fixed (iterations 39–41). Left for the team: the reading glasses never matter (needs a new smudge on the notes).

### Iteration 42 (11/16): design plan, phases A and C (docs/08-design-improvement-plan.zh.md)
A designer's review of the build against the GDD, the project skill's rubric and published practice (three-clue rule, Golden Idol, Obra Dinn, LLM-NPC postmortems, Wordle-style dailies, Game Accessibility Guidelines) produced a plan in six phases (A–F), saved as `docs/08-design-improvement-plan.zh.md`. This iteration did the parts that need no team decision:
- **A1 First visit:** a first-time player sees one big "Visit Grandma" button (straight into Easy). The daily, Medium and Hard sit behind "More ways to play", and the key list behind "Controls". Returning players see the full title screen as before. In the room the first hint lists only the basic keys. (`apps/web/src/firsts.ts`)
- **A2 Suggested questions:** up to three chips over the ask box: the object just looked at ("Tell me about the photo album"), each part of the note ("Do you remember the sock thief?"; long or smudged parts are cut to their first idea, so Medium offers "the street we lived on"), and a cheap follow-up once she has answered. A chip only fills the box; the player still sends it, and a chip that was asked goes away. They never say more than the note or an object's name. (`apps/web/src/suggest.ts`, tested)
- **A4 Lessons when they happen:** the first time tea drops, a follow-up gets its discount, she naps, or her tea falls to 40 with a cookie left, one short line in the chat explains it. Each is shown once per browser.
- **C1/C2 Grandma reacts:** the first time the player picks up each object she says a short canned line ("Oh, the album! Mind the loose pages, sweetheart."): 2 per object, no facts, no model call, no tea. When her tea first dips under 30 she says she's getting sleepy.
- **C3 Talk camera:** while talking, the view eases round to frame her face. It's off with a setting or reduced motion. Checked: it ends within 0.03 rad of her.
- **C4/C5 Sound:** three channels (music, effects, voice) with separate volume sliders, which voice synthesis honours too. The room has a short original music loop ("Kolaczki Rag", 8 bars, oom-pah bass under a music-box melody, synthesised). Pinning a quote plays a light "tack". **The music was written by Claude Code (AI), and `CREDITS.md` now says so**; it replaces the old line saying no AI-generated music is used. Nobody has listened to it yet.
- **C6 Remappable keys:** walk, use, put back, notebook and speak can be rebound in Settings (click, press a key; a key in use swaps; reset). Every on-screen key hint follows the bindings ("F · Talk to Grandma"). Tested; checked in the browser.
- **C7 High contrast:** opaque black panels and bold white text (checked).
- Layout fix found while checking: the "Talking to Grandma" label covered the last chat line; it now has its own space, and the chips sit in the layout rather than floating over the chat.
- Checks: 173 tests, validate, golden, build. Browser: first-visit flow, chips, lessons, reactions, camera, settings, contrast.
- **Not done here:** A5 per-slot router feedback, phase B (puzzle content), D1 (more recipes) and the music style all wait for the team. Phase E needs the course key; phase F needs a deploy go-ahead. No person has played or listened to these changes, and the rubric hasn't been re-scored independently.

### Iteration 43 (11/16): the rest of the design plan (A5, B, D, E3, F prep)
Done at Jacky's request ("继续做剩下的"); every content change below is a draft for the team to review.
- **A5 Which part was right:** on Easy and Medium a wrong router try now says which part was right ("Part 1 is right. Part 2 isn't."), and the box turns green with a ✓ or red. Hard still only says how many. Tested; checked in the browser.
- **B The room gives hops, not answers:**
  - The wedding photo no longer says "June 1961" or "My Sparrow". It says "To my little songbird. Married the June after the pierogi", which still needs the proposal year (and rules out the 1960 decoy) and which bird.
  - The house-number sign lost its middle digit ("4…2"). The album gained two pages: "Cherry St., our first home, moved out summer '64" rules Cherry Street out for 1969, and a "Summer '69" porch whose mailbox reads "41" with the last digit hidden. Sign plus porch photo give 412.
  - The reading glasses now matter. Medium's smudge hides "painted crooked", which separates 412 from 27; Hard's hides "snowstorm". Easy has none.
  - New tests: no object's text contains a whole answer part (the old data failed this); every answer part has a room object that brings up its memory; the smudges hide the deciding words. `rosie.chains.md` updated.
- **D More puzzles:**
  - Five new recipes from Rosie's existing memories: Easy Niagara1963 and Buttons1972; Medium Marge1958 and Buttons27; Hard Biscuit1949! (new anchor "the year Biscuit came home", 1949 hidden from the model: she was nine, born 1940).
  - That makes 3/3/2 puzzles. A visit gets a random one of its difficulty; "Try another {difficulty} puzzle" on the result card never repeats the one just played. The daily cycles through all 8, never the same two days running.
  - Each new puzzle has a chain map and an API walkthrough with the offline Grandma; 38,400 offline replies across all 8 puzzles were rejected 0 times.
  - The probe found a false positive in iteration 34's text-based memory check ("We **got** married in 1961" counted as the 1961 honeymoon because "Walt got soaked"); short and everyday words no longer count.
  - Tests and the AI player can pin a puzzle with `recipeId`. The daily streak now counts days played, not days solved (a bad day doesn't wipe it out).
- **E3 Play funnel:** each visit logs a "start" line. The browser reports note opened, object inspected, notebook opened, quote pinned and result copied: names only, never text, each once per visit, rate-limited. `npm run stats` shows the funnel, the median time to the first question (target under 60 s) and the share of visits that found each clue. Tested; checked end to end in the dev build.
- **F prep:**
  - `EMBED_ORIGINS` lets listed sites frame the game (an itch.io embed); the default stays "nobody". Tested.
  - `docs/09-demo-and-launch-kit.md`: a 3-minute demo script with fallbacks, an itch.io page draft (with AI disclosure and accessibility list), shot lists for the cover, screenshots and a 45-second trailer, and a launch checklist.
- Checks: 188 tests, validate, golden, schema, build; browser: varied visits, "Try another", router marks, funnel events.
- **Still not done:**
  - E1/E2: the live model, streaming and the real eval need the course key.
  - F: deploying and publishing are the team's (Fly account, key, page).
  - Nobody has played the new puzzles or listened to the music; the new clue texts, puzzles and nudges are drafts for the team.

### Iteration 44 (11/16): independent re-score, retrieval and router fixes
- **Re-score** (`docs/10-design-rescore.md`): an independent review agent, offline only, scored nine of the ten rubric dimensions at about 5.9 on average. The pass bar is 6. There was no P0. The weakest dimensions were deduction depth (4) and conversation craft (4).
- **Fixed in this round:**
  - **F1:** a full name at the router ("Niagara Falls", "Marge Novak") now counts for a first-word part. The password is unchanged.
  - **F3–F7 and F11, the offline Grandma's retrieval** (it is also the live fallback):
    - "year" no longer scores.
    - A question about "you" prefers her own memories.
    - A typed name counts extra.
    - "sledding" now matches "sled".
    - Showing an object prefers its memory on this note's chain.
    - "house" no longer means street.
    - "said 'I do'" means the wedding.
    - The reviewer's probes went, for example, from 0/12 to 12/12 for "When were you born?" → 1940, "Tell me about the sled" → Michael's arm, and "What's your house number?" → 412. Regression tests were added.
  - **F10:** a Medium 3 nudge put Biscuit in the 1969 house; it now says "Our dog".
  - **Browser:** the "play on a computer" warning showed on a desktop whose window was narrow at load. It now checks for a mouse or trackpad.
  - **Browser:** suggested questions spoke in Grandma's voice ("the bird Grandpa named me after"). They now use the player's pronouns, with quotes kept as they are. Tested on all eight notes.
  - A test I wrote through a shell script had `\b` turned into a backspace character, so it could never fail. It was fixed and now also asserts that it saw chips.
- **Left for the team:** F2 (four puzzles fall to their own wording), F8 (Hard 2 has one route), F9 (par). Proposals are in `docs/10`.
- **Checks:** typecheck, 194 tests, validate, golden.

### Iteration 45 (11/16): question probes as a tool, visual score
- Committed iterations 43–44 (190a115) at Jacky's request.
- **`npm run eval:probe`** (`eval/src/probe.ts`, `eval/data/probes.v1.json`) turns the review's question probes into a free, repeatable tool:
  - **Reach:** 20 promised routes, 12 runs each, through the validator. Vitest requires all of them in every run, so a retrieval change can't quietly break a nudge or an object route again.
  - **Direct questions:** the ten most direct questions per puzzle. The report says which answer parts one reply hands over whole, and which puzzles fall to direct questions alone.
- **Today's probe result:** 20/20 routes work. 6 of 8 puzzles fall to direct questions; only the two Hards hold, because their years are hidden from Grandma. This is review finding F2, now measured; content changes wait for the team.
- **Visual cohesion (rubric 8):** scored 6 from browser screenshots, with low confidence. The ten-dimension average is 5.9 before the iteration-44 fixes.
- **Checks:** typecheck, 196 tests, validate, golden.

### Iteration 46 (11/16): a measured proposal for F2
- **The direct-question bank is now note-only.** Three questions already contained a hop's answer: "in 1968", "in 1969", "the Cherry Street apartment". Even note-only, 6 of 8 puzzles fall to direct questions.
- **`eval:probe -- --patch`** applies a content proposal in memory:
  - rewordings, new anchors, slots put behind anchors, and probe changes;
  - it runs the same cross-checks as `npm run validate`, and reports problems rather than crashing;
  - it prints before and after.
- **Proposal `eval/data/proposals/f2-year-hops.json`** (for the team; `data/` is unchanged): the year becomes one hop in Easy, Easy 2, Easy 3 and Medium 2.
  - **Result:** data checks pass, 28/28 routes work, and falling puzzles go from 6/8 to 2/8.
  - The data check caught a conflict in my first draft: a hidden year can't have a self-correction, so the wedding loses its "1962… no, '61".
  - Medium and Medium 3 still fall and need a different idea. Details are in `docs/10`.
- **Live offline-Grandma changes found by measuring the proposal:**
  - A hidden year leaves the sentence cleanly. This is a no-op today, and the golden transcripts are unchanged.
  - Showing an object prefers the memory the note asks about, unless that part is behind an anchor.
  - She doesn't retell the memory she just told when another fits almost as well. As a result, asking the same question twice gets a related memory.
- **Tests:** the proposal stays valid (data checks, routes, which puzzles fall); the sled on Hard; no immediate retelling.
- **Checks:** typecheck, 198 tests, validate, golden.

### Iteration 47 (11/16): F2 year hops adopted
- At Jacky's request ("Apply it"), `eval/data/proposals/f2-year-hops.json` went into `data/grandmas/rosie.json`, applied by the same code that measured it.
  - In Easy, Easy 2, Easy 3 and Medium 2 the year is one hop: "the June after Walt proposed", "the year before we moved to Maple Avenue", "two summers after I started cooking at Lincoln Elementary", "the summer I turned eighteen".
  - Passwords are unchanged. The proposal file stays as a record, marked adopted.
- **Found while adopting:**
  - **The model's prompt kept hidden years inside memory texts.** Only the year column was blanked. On Hard this never mattered, because its hidden memories have no year in their text. Fixed with a shared `scrubYears` for the memories, the stories and the offline Grandma. A new test checks that no puzzle's prompt contains its hidden year.
  - **The offline Grandma's "I don't recall" tangent didn't remove hidden years.** Fixed; the validator test found this.
  - **The wedding loses its self-correction** (a hidden year can't have one). It moves to the Maple house ("1965… no, '64").
  - **The switchboard memory and the fair story were reworded** so they read cleanly once the year is removed.
- **Updated:**
  - chain maps for the four puzzles;
  - walkthroughs, which now take the hop and check that the hidden year never appears;
  - the AI-player test;
  - golden transcripts: one handwritten conversation rewritten for the new Easy, the rest re-recorded, diff reviewed.
- **Checks:** typecheck, 200 tests, validate, golden, `eval:probe` (28/28 routes; 2/8 puzzles fall to direct questions, down from 6/8). Browser: Easy now answers "the June after Walt proposed", then the proposal year.
- **Not verified:** the live model (no key), and people playing the new hops.

### Iteration 48 (11/16): frame rate
Jacky reported a very low frame rate in the web build. Measured in a debug Chrome on this laptop (Intel Graphics, Meteor Lake) with the playtest CDP driver; the Claude app's preview pane throttles and pauses its own drawing, so its numbers aren't used.
- **Cause: the look ray tested Grandma's skinned mesh.** Every frame the player's ray tested all interactable models, triangle by triangle. When it reached Grandma, three.js re-posed all 16,220 of her vertices in JavaScript.
  - Cost: 4.6 ms per frame on this CPU, and more on a slower or battery-throttled one, for as long as you looked at her (most of the game).
  - In a software-rendered Chrome, looking at her dropped 60 fps to 48, with JavaScript per frame at 6.2 ms (p95 11 ms) against 1.1 ms when looking away.
- **Fix:** hit boxes live on their own layer (`HITBOX_LAYER`), and the ray tests only that layer: one box per object.
  - The ray now takes 0.01 ms.
  - Looking at her: 240 fps on the real GPU, JavaScript p50 0.4 ms.
  - Targeting re-checked on Grandma, the sticky note, the router, the photo album and the reading glasses.
- **Other situations measured after the fix:** spawn, a 30-line chat log, a reply typing out, the notebook open, and walking. All had JavaScript p95 under 2 ms, and the Long Animation Frames API found no long frames.
- **Safety net: adaptive resolution** (`scene/adaptive.ts`).
  - Over 2-second windows: below 45 fps, step the render scale down 0.05 (floor 0.35); after three windows at 55+ fps, step back up to the default 0.6. It never locks.
  - `?px=` pins the resolution.
  - The retro pass now resizes when the pixel ratio changes.
  - drei's `PerformanceMonitor` was tried first and dropped: it hit its flip-flop limit at once and locked at the minimum.
  - Tested by throttling the CPU 20× over CDP: 0.6 went down to 0.4, then back to 0.6 about 22 s after the throttle ended.
  - It helps a weak or software-rendered GPU; a CPU-bound slowdown it can't fix.
- **Dev only:** `window.__three` (renderer and scene) and `window.__dprLog` for performance checks; both are stripped from the production build.
- **Checks:** typecheck, 203 tests, build.
- **Not verified:** the frame rate on other people's machines, and in Firefox or Safari.

### Iteration 49 (11/17): looking at things up close; Grandma's clipping plan
Jacky asked for real object interaction (a close-up and a description, not a text popup; photos showing Grandma with the people in them; a fridge that opens with food inside) and a plan for Grandma's clipping based on how other games handle it.
- **Examine card** (`ui/Examine.tsx`): the object in 3D on the left, which you can drag to turn and scroll to zoom, and its text and buttons on the right.
  - It shows the side you were facing in the room (`facingTurn`). The TV used to show its back.
  - The room behind stops redrawing while the card is open (`frameloop="demand"`).
- **Generated photos** (`scene/photos.ts`, `people.ts`, `develop.ts`). Each photo is a small 3D set rendered once off screen, then given an old-print look.
  - **Wedding photo:** black and white, young Rosie in a gown and veil with a bouquet, and Walt in a suit, on the church steps. It now shows in the frame in the room too. The back has Grandpa's inscription; the frame's brass plate says "Moon River". Front and Back buttons.
  - **Album:** three spreads with page buttons. The beagle with the sock and the cocker spaniel, uncaptioned. Cherry St. and the Maple porch, with Grandma's captions. An empty photo slot and the birth announcement.
  - **The porch mailbox shows only "41".** A rose cane covers where the third digit would be. The answer digit is never drawn anywhere a camera can see.
- **Fridge** (`scene/props.tsx`; new object kind `fixture`). The first E opens the door in the room, with a sound and a line from Grandma; the second E shows the inside up close. Inside: a Jell-O ring, milk, pickles, apples, eggs, butter, and pierogi under foil marked "FOR SUNDAY". A grandkid's drawing is on the door. The door shuts when you walk away or press "Close the fridge". Its text is flavour only: no facts, can't be carried.
- **Shared body helpers** (`scene/body.ts`): painted clothes, hair colour, chest softening and bone aiming moved out of `Grandma.tsx`, so the people in the photos reuse them. Grandma looks the same (checked in the browser).
- **Test bug found:** the "no object's text contains an answer part" test built its regex in a template literal, where the word boundary became a backspace, so it never checked anything. Fixed with `String.raw`, extended to the fridge, and now proves it can fail. It passes: no object text leaks an answer.
- **Grandma's clipping:** the plan is in `docs/11-grandma-clipping-plan.zh.md`. Observed in the browser:
  - her hands pass through each other on her lap;
  - the teacup floats beside her hand;
  - her left arm sinks into the armrest.

  The plan has seven steps, ranked cheapest first. Nothing is implemented yet.
- **Checks:** typecheck, 211 tests, validate, golden, build (dev hooks stripped). Browser: the wedding front and back, all three album spreads, the fridge (open, look inside, close, shut on walking away), the TV facing the right way.
- **Not verified:**
  - Firefox and Safari;
  - how long the first photo takes to render on a slow machine (once per visit, cached);
  - keyboard-only turning in the 3D view (the text and buttons carry everything you need).

### Iteration 50 (11/17): Grandma clipping, steps 1, 2 and 5
Jacky approved steps 1, 2 and 5 of `docs/11-grandma-clipping-plan.zh.md`.
- **Step 1, the body under the cardigan isn't drawn** (`uncoveredTriangles` in `scene/body.ts`): 2,794 triangles. A rim where the cardigan meets skin is kept, so no gaps open at the neck, cuffs or waist. The legs under the blanket are not hidden yet: the blanket is too narrow (step 4).
- **Step 2, soft pose limits** (`scene/poseLimits.ts`). Mood, nods, idle sway, dozing and looking at the player now add up first and then pass through tanh limits:
  - turn ±0.75 rad, split neck 35% and head 65%;
  - nod down 0.5 and back 0.22; tilt 0.28;
  - lean forward 0.2 and back 0.1;
  - neck droop while dozing 0.3.
- **Step 5, keep-out for the sip.** The cup and fingers must stay at least 1.2 cm in front of her lips (the cup plus its radius) and 3 cm below her glasses; otherwise the wrist target moves forward or down. The whole motion is checked at 11 points.
  - Tightest point measured: 3.1 cm from her face and 3.5 cm below her glasses.
  - The old pose already passed. The check is now a guard for future changes.
- **Dev only:** `__grandma.pose({ yaw, pitch, tilt, sip, talk, glasses })` holds a pose; `__grandma.info` reports the clearances. Stripped from the build.
- **Checks:**
  - typecheck, 216 tests (5 new in `clipping.test.ts`), build;
  - browser screenshots at the extremes (sip at her lips; fully turned, nodding and tilted; the reverse with the talking gesture): no clipping seen.
- **Not done:** the hands passing through each other, the floating cup, the arm in the armrest and the narrow blanket. These are steps 3 and 4.

### Iteration 51 (11/17): Grandma clipping, steps 3 and 4
Jacky asked to go on with steps 3 and 4.
- **Measured first.**
  - Raycasts against the armchair as fitted: seat top 0.47 m; backrest front face sloping back (−2.10 m at 0.6 m high, −2.20 m at 0.9 m); armrest inner faces ±0.333 m from her centre; armrest tops at 0.94 m.
  - Her posed vertices: the lowest hip vertex was 9 mm into the seat, her back 8 mm into the backrest.
  - **Her arms had 13–15 cm of room inside the armrests.** The "arm in the armrest" seen from the side was the very tall armrest hiding it, not clipping. Fixing that is a chair art change and was left alone.
  - The numbers live in `CHAIR` in `Grandma.tsx`. Measure again if the chair's art or boxes change.
- **Seat:** she is placed from her posed vertices: hips and thighs 3 mm above the cushion, her back (cardigan included) 5 mm in front of the sloping backrest. The hand-tuned offset is gone.
- **Blanket** (`blanket.ts`: `drapeSurfaceY`, `liftToClear`):
  - as wide as her thighs plus 3.5 cm each side;
  - lifted just enough to clear every thigh vertex from a quarter of the way to the knee by 8 mm;
  - sides drop 9 cm.
- **Hands:** two-bone IK (`twoBoneElbow` in `body.ts`) puts each wrist over its own thigh, elbows out and back; left palm down, right palm up. Each hand is then raised until its lowest point is on top of the blanket.
- **Cup:** its base sits on the middle of the palm, upright along the palm's normal.
- **Measured** (`__grandma.info.fit`, metres in the room): hands 6 mm above the blanket, 6.2 cm apart (they used to pass through each other), arms 7.8 cm inside the armrests; sip clearance 3.0 cm from her face and 3.1 cm below her glasses.
- **Checks:** typecheck, 221 tests (5 new), build (dev hooks stripped). Screenshots from the front and side.
- **Not done:**
  - the fit gaps aren't an automated test yet, because the glTF body doesn't load under Vitest;
  - the blanket looks thick, about 13 cm above the thigh line, so that its sides cover the widest part of the thighs;
  - the tall armrests.

### Iteration 52 (11/17): a thinner blanket
Jacky found the blanket too thick.
- **Cause:** measured by tenths of the way from hip to knee, the base body's athletic thighs rise up to 13.8 cm above the bone line mid-thigh. A blanket clearing all of that looked like a box; smaller side drops changed nothing.
- **Fix:**
  - The blanket is lifted only to clear the knees (from 80% of the way), where it rolls over. Lift is now 8.0 cm, down from 12.7 cm.
  - The 242 thigh triangles that would poke up through it aren't drawn: the blanket covers that spot from above, like the cardigan over her arms. Nothing behind the hip joints is hidden, so no holes open where her body rises out of the blanket.
  - The sides drop 3.5 cm (was 9 cm) and reach 1.5 cm past her thighs (was 3.5 cm).
- **Measured:** hands 7.5 mm above the blanket, 6.2 cm apart; arms 9.2 cm inside the armrests.
- **Checks:** screenshots from the front and a low three-quarter view, where holes would show (none); 222 tests; typecheck; build.

### Iteration 53 (11/17): Grandma's voice from ElevenLabs
Jacky found her voice too "AI". It was the browser's speech voice (Windows Zira or Aria), which can't be run through audio effects. Of the options offered (ElevenLabs; Kokoro in the browser plus an aging filter; a retro mumble), Jacky chose ElevenLabs.
- **Server** (`apps/server/src/voice.ts`, `POST /api/runs/:id/voice`) speaks through ElevenLabs text-to-speech (default `eleven_flash_v2_5`, MP3 at 64 kbps).
  - **Only her own words:** every line must be one Grandma said in that visit, or one of her canned `bark.*` reactions. Anything else is a 400, so nobody can spend the budget on their own text.
  - **Mood:** sets stability, style and speed (slower and steadier when sleepy or nostalgic).
  - **Cost:** lines are cached on disk by voice, model, mood and text, so repeats are free. A daily character cap applies (`VOICE_DAILY_CHARS`, default 3,000). A failed call doesn't count against it. Stage directions like *sips tea* are dropped.
  - **Off by default:** it needs `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`. The key is read from the repo's `.env` only, like the Anthropic key (or from the environment with `GRANDMA_VOICE=elevenlabs` on purpose).
  - **Health** reports `voice: "elevenlabs" | "browser"`.
- **Client** (`voice.ts`, `audio.ts`): plays the clip on the voice channel, so the voice volume setting applies, and drives her talking animation from it. A newer line cancels an older one that is still loading. If there's no key, the cap is reached or a request fails, the browser voice takes over.
- **Her voice:** `tools/design-grandma-voice.mjs` uses ElevenLabs Voice Design ("late seventies, Buffalo, faint Polish-American accent, warm and teasing, slightly thin and wavering"). It writes three previews to `var/voice-design/`; `--save <id>` keeps one and prints the `.env` line. Correction after the first real calls: creating a voice through the API needs a paid plan (403 "feature_not_available" on free), so on the free plan she's designed on the ElevenLabs website and only her voice ID goes in `.env`. Text-to-speech through the API does work on free (a test line returned audio). Voice Library voices need a paid plan for API use.
- **Found along the way:** another program on this laptop, Grok Bot, listens on 127.0.0.1:8787, so in dev every API call reached it ("Not found.").
  - Fixed locally with `API_PORT=8788` in a new git-ignored `.env`, made from `.env.example`.
  - The server now checks its own port at startup and warns if something else answers.
- **Checks:** typecheck, 229 tests (7 new for the voice route: health, real lines only, cache, cap, failures, config), build.
  - In the browser, a stand-in clip played through the voice channel with the talking flag on and then off, and the browser voice wasn't used.
  - With no voice on the server, the request got a 404 and the browser voice spoke instead.
- **Verified with a real key (11/17, free plan):** Jacky designed the voice on the ElevenLabs website and put its ID in `.env`. Through the game server, a new line took 0.4–0.7 s and a repeated line came from the cache in about 4 ms. In the browser, the greeting played as her recorded voice and the browser voice stayed silent. Jacky listened to two sample lines and approved the voice. The test used about 300 characters, about 150 of the free plan's 10,000 monthly credits on Flash.
- **Dev port:** Vite now follows `PORT` (default 5173), so the preview can run on another port when 5173 is busy.

### Iteration 56 (11/17): steady frame rate, a guided first visit, new music
Jacky played the iteration 55 build and found it choppy, the onboarding thin and the music unpleasant.

**Frame rate.** Measured in a debug Chrome on this laptop (Intel integrated GPU, 240 Hz screen, 1.5× scaling):
- **Causes found:**
  - The game drew as fast as the screen refreshed (90–240 fps), so the GPU had no headroom.
  - It started on High on an integrated GPU. At 1920×1080, High (glow, richer materials) took 20–30 ms a frame; Medium and Low took 6–11 ms.
  - Wallpaper Engine's web wallpaper was using about 66% of the GPU's 3D engine. Other game tabs left open also compete.
  - Its spikes made the auto-scaler cut resolution down to 0.35×, a blurred picture that was no faster.
  - Shader compiles were ruled out: visiting each view a second time cost no more than the first.
- **Fixes:**
  - **Frame cap:** at most about 60 fps, timed from the last drawn frame. Counting refreshes gave 48 fps on the 240 Hz screen, because the browser skips a refresh while drawing. `FrameCap` in `GameCanvas.tsx`, `shouldDraw` in `adaptive.ts`.
  - **Default quality:** chosen by GPU (`qualityFor` in `settings.ts`): integrated GPUs start on Medium; software renderers and touch-only devices on Low. Saves still on automatic quality are re-checked once (`qualityRules`).
  - **Auto-scaler:** judges each two-second window by its median frame, so outside spikes don't count, and never goes below 0.6×.
- **Result:** a steady 60 fps on Medium (p95 16.9 ms, worst ~21 ms), standing still, while the camera moves, and at full HD. High still runs at 34–39 fps on this GPU, which is why integrated GPUs now start on Medium.

**Guided first visit** (`tutorial.ts`, `ui/Tutorial.tsx`).
- **What it is:** nine steps, each spotlighting the one thing to do and moving on when the player does it: read the note → close it → pick a note card → "Tell me about it" → her tea → the trail of names and free typing → look for proof in another view → the notebook → the router (and Uncle Michael's phone).
- **Behaviour:** two steps only explain and wait for "Got it". Steps the player already did are skipped, and the tutorial can be skipped at any time. Clicks go through to the game. It waits while a close-up card is open.
- **When it runs:** on the first visit; "How to play" on the title has "Show me how" to replay it. The old objective checklist and how-to line hide while it runs, and the one-time tea lesson in the chat is not repeated.
- **Model:** small, guided first cases you solve rather than read (The Case of the Golden Idol), and one new idea at a time, learned by doing (Portal, Baba Is You, Nintendo's introduce–practise–test pattern).
- **Checked:** the whole run in a real browser, with a screenshot of each step.

**Music: "Rosie's Waltz"** (`music.ts`), replacing "Kolaczki Rag".
- **Composition:** an original slow waltz (88 bpm). A curious D-minor phrase is answered by a warm F-major one.
- **Instruments:** felt piano, music box, plucked bass and chords, and a quiet accordion pad in musette tuning, with a generated reverb and a gentle low-pass.
- **Form:** a 32-bar loop (about a minute) in four passes, each with a different lead: piano, music box, none (only "thinking" arpeggios), then a thinned-out piano. Half the time or less there is a melody, so it stays behind the thinking.
- **Basis:** described practice in puzzle scores: Layton's accordion-and-waltz whimsy, sparse music for concentration (Ashi), and loops with variation.
- **Checks:** rendered offline (`renderMusicWav`, dev only), peak 0.18 with no clipping before the music volume. In game, it schedules about 15 oscillators a second with no errors and no frame-time cost.
- **Tests:** 260 pass (new: tutorial steps, frame pacing on 60/120/144/240 Hz screens, median-based scaling, quality by GPU, the music's form).
- **Not verified:** how the music and the tutorial feel to people (needs a listen and a playtest); other GPUs and phones.

### Iteration 57 (11/17): review loop, round 1
I played every view, every close-up and a full Easy visit, chatted with the offline Grandma on Medium, checked the keys in each mode, and looked at the phone layout. Then I fixed what I found:
- **Answer leak (P1):** the offline Grandma's random aside could be a part of the password. "asdfgh qwerty" on Medium got "Our house number is 412", half of Maple412.
  - **Fix:** asides never use the recipe's slot facts (`mock.ts`).
  - **Test:** `packages/engine/test/mock.test.ts`, 7 off-topic questions × 40 seeds × every recipe.
- **Small talk:** "How are you today?" got "Don't tell your grandfather I said that. I don't recall anything about that."
  - **Fix:** greetings and small talk now get a warm line from `profile.small_talk` in `rosie.json` (new optional field), with no memory and no aside. The "don't know" case uses its own openers.
- **Photos:** the room's photo frames showed the Godot model's grey silhouettes while their close-ups showed real photos.
  - **Fix:** each frame now shows a generated photo (wedding, dogs, Cherry Street), with planar UVs facing into the room and a crop that doesn't stretch (`RoomPhotos` in `House.tsx`).
- **Tap targets:** tapping the moon plate opened the TV, because the TV's enlarged hit box covered the plate.
  - **Fix:** of the targets near the front, the smallest wins (`ViewRig.tsx`).
- **View tabs:** the tab bar was cut off ("Living roo…"), because a `left: 50%` box shrink-wraps to half the window.
  - **Fix:** `width: max-content`.
- **Stale hover label:** a hover label stayed on screen after the camera moved ("moon-landing plate" in the kitchen).
  - **Fix:** hover clears on every view change.
- **Fridge and phone:** they had no sparkle.
  - **Fix:** they sparkle now, until looked at (`looked` in the store, kept apart from the "Find proof" clues).
- **Fridge colour:** the fridge close-up was cream while the room's fridge is mint. It is mint now.
- **Grandma close up:**
  - **Neck:** a thin neck stood in a ring-shaped collar. It is now fuller and set a little lower.
  - **Chair doily:** the upright antimacassar smeared the flat lace pattern into torn-looking streaks. It is plain linen now.
  - **Steam:** the cup's steam was square points. It is soft round puffs now.
- **Dev aid:** the 3D crash screen now keeps its cause in `window.__gameError` (dev only).
- **Checks:** 262 tests pass; typecheck, data validation and golden transcripts pass.

### Iteration 58 (11/17): review loop, round 2 (after an independent review)
A separate review agent played the build blind: tutorial, Easy, Easy 2, Medium and Hard solved, the attack set, phone layout, frame times. It scored **7.0 / 10** with no P0. Fixed from its findings:
- **F1 (P1, deduction): note-line cards handed over a whole part** ("where we spent our honeymoon" → "Niagara Falls").
  - **Pointer memories:** each word part now has one for its note line (`*_ptr` facts, tagged `pointer`, set in `note_facts`). Each points at the next step instead:
    - "the big falls on the Canadian border";
    - "the cocker spaniel we got after the kids";
    - "Grandpa painted the number on the mailbox… the hall sign… a porch photo in the album";
    - "like the little brown birds at the feeder… the back of our wedding photo";
    - "our beagle… a picture of the rascal in the album";
    - "my oldest friend from the switchboard days".
  - **Free text and asides:** pointers answer only cards, never typed questions or random asides. Asides also never contain an answer word.
  - **Test:** for all 8 notes, no note-line card says its part (`topics-api.test.ts`). The fairness bot still solves every note with cards alone.
- **F3:** the router card now names which part is right ("Part 2 is right. Part 1 isn't."). It already kept the entries and marked them; the reviewer had called `guess()` from script, which skips the card.
- **F4:** a card asked again, when she can only retell, costs 2 tea, not 8 (`RULES.retellCost`).
- **F5:** the notebook now:
  - reads letters in any alphabet ("Kraków") and keeps names together ("Niagara Falls", "Marge Novak");
  - reads "Cherry St." as Cherry Street, and stops counting "St" or "Summer" as names;
  - records '64 and '69 as years;
  - quotes only the sentence a clue came from.
- **F6:**
  - **Keyboard mash** ("asdkj qwe zxcmn") is free and gets "Say it again, dear" (`isGibberish`).
  - **Rudeness** gets an answer in character; the +6 penalty stays.
  - **Openers:** "Don't tell your grandfather I said that" no longer opens a reply.
- **F7:** tutorial bubbles never cover the chat or the view tabs. A target in the bottom panel gets the bubble above the panel; a target up top gets it below the tabs.
- **F8:** the hint line has a dark backing; "Drag to turn it" is readable; on phones the view tabs fade at the edge to show they scroll.
- **F9:** each album page has its own description.
- **F10:** a lost visit says "Out of guesses" or "Bedtime", not "Gave up", and explains each part. For hidden years it shows the memories that resolve them (`explainParts`, sent with the password once it is revealed).
- **F11:** the result card waits 1.8 s so Grandma's reaction is seen first (shown at once with calm camera).
- **F12:** N closes the note it opened. Tab stays inside an open card.
- **F13:** the music ducks about 6 dB while she speaks. A quiet wind past the snowy window joins the clock (room sound).
- **F14:** Uncle Michael now quotes Grandma ("You know how Grandma tells it: ‘…’"), so the voices don't run together.
- **Not changed:**
  - **F2:** the note's character count rules out the decoys. This is a puzzle-data decision for the team.
  - **F15:** High is slow on integrated GPUs, which now start on Medium.
  - **F16:** the checklist and the pinned note follow the same flag; I couldn't reproduce it.
- **Checks:** 268 tests, three full runs in a row; typecheck, data validation, golden transcripts and build pass.

### Iteration 59 (11/17): review loop, round 3 (after a second independent review)
A second, fresh review agent scored **7.3 / 10**, with no P0. Fixed from its findings:
- **F1:** clicking a topic card while typing did nothing. The press blurred the box, the chat log collapsed, and the card jumped from under the pointer. Pressing a card no longer takes focus from the box.
- **F2:** the plate shows about ten kolaczki, but its text said "one last" and she said "I had two". The text now says they're for Sunday and she may have one.
- **F3:** the result card states the star rule with this visit's numbers.
- **F4:**
  - **Unmatched questions:** they no longer get a random memory at full price. The offline Grandma says she doesn't recall and asks for a name.
  - **Cost:** any brain reply that tells no memory costs 4 (`RULES.noFactCost`); canned lines keep their price.
  - **Asides:** they prefer memories she hasn't told this visit.
  - **Other languages:** Spanish, French, German and Italian count as not English, so they're free.
- **F5:** in Grandma's view, tutorial bubbles move to the side away from her. A step waits until her latest line has typed out.
- **F6:** on screens held upright, each view aims at the weighted middle of its objects (tools count three times), so the hall shows the phone, router and note.
- **F7:** "Show Grandma" shows its cost.
- **F8:** a card for something her last reply mentioned counts as a follow-up (−3), as the tutorial says.
- **F9:** asides avoid memories easily confused with the one she's telling (Cherry Street next to "number 412").
- **F15:** the how-to line goes once anything has been looked at, not only a clue.
- **Not changed:**
  - **F10, F2 (round 1):** each Medium has one part a direct question answers, and the character count rules out the decoys. These are puzzle-data decisions for the team.
  - **F11:** queueing system lines behind her typing.
  - **F12:** prop art: the album cover, the mannequin-like figures in the wedding photo.
  - **F14:** Tab stays the focus key inside cards; Esc closes them.
- **Checks:** 269 tests, typecheck, data validation, golden transcripts and build pass.

**Where it stands.** Both reviewers say the rest of the way to 9 can't come from code alone:
- **Conversation (5):** needs the LLM Grandma run with a key: eval, attack set and transcripts.
- **Deduction, fairness, onboarding:** need human playtest data: solve rate, questions to solve, time to first question.
- **Character and audio:** need eyes and ears on her moods, the ElevenLabs voice and the mix.

### Iteration 60 (11/17): feel, character, accessibility, robustness, art
Another loop, on the dimensions the reviews hadn't reached:
- **Feel:**
  - **Message order:** lines after the one typing out ("New topic cards", a nap) now wait for it (`revealPlan`).
  - **Title music:** the waltz plays from the first click or key there.
- **Character:**
  - **Mood emote:** a small bubble beside her face as each line arrives (😊 😏 💭 ❓ 🤨 😟), so her mood reads with the sound off.
  - **Fixed along the way:** the "z z Z" and the emote were placed relative to the chair, which put them above the frame in her close view. They're attached to her head now.
- **Accessibility:**
  - **"Things here" (H, or the button under the tabs):** lists what can be opened in this view as buttons. Keyboard and screen-reader players had no way to open anything in the room.
  - **Enter and Space:** on a focused button they press that button, never a game shortcut (Enter on a list item used to open the chat instead).
  - **Esc:** closes the list.
  - **High contrast:** the chat kept its dark ink on the new black background, and the stat line too. Both are light now.
  - **Large text:** the tea panel ran into the view tabs. The tabs get their own row at large sizes (`big-text`).
- **Robustness:**
  - **Going offline mid-visit:** checked. It shows "can't hear you", costs nothing, and recovers.
  - **Resume:** a reload or a closed tab now offers "Continue your visit" on the title. New `GET /api/runs/:id` returns the run and what was said; the notebook is rebuilt from her lines.
- **Art:**
  - **Metals:** they were near black, because three.js metal with nothing to reflect stays dark. They now reflect a soft room map (metals only, so the lighting is unchanged). The album's gold label, the trophy, frames, handles and glasses read as gold and brass, still at 60 fps.
  - **Title on a phone held upright:** it aims lower, so Grandma and the room show above the text instead of the ceiling.
- **Probe (`npm run eval:probe`, offline):** 2/8 notes still fall to direct typed questions, both Mediums with two word parts (puzzle data, team decision). The other 6 need a hop on the year and a step on the word.

### Iteration 61 (11/17): review loop, round 4 (third independent review)
A third fresh review agent scored **7.1 / 10** with no P0. The three reviews (7.0, 7.3, 7.1) agree within the rubric's ±1. Fixed:
- **F1 (P1, keyboard):** Tab was the notebook key, so keyboard players could never reach the cards or the "Things here" items.
  - **Notebook key:** now **J**; saves still on Tab migrate.
  - **Tab:** never a game key now; it moves focus.
  - **Cards:** picking one with the keyboard focuses "Tell me about it".
  - **Checked:** in the browser, Shift+Tab from the question box reaches the cards, and J opens and closes the notebook.
- **F3 (fixed truth):** Biscuit was her childhood dog (1949), yet lines spoke of "our beagle" in 1968 and later. They now say "the beagle I had as a girl", "my old beagle's memory", and "he still blames the cocker spaniel".
- **F10 (fixed truth):** the wedding song "Moon River" came out in October 1961, after the June 1961 wedding. It's now "Unchained Melody" (1955) in the data, the frame plate, the topic card and the golden transcripts.
- **F15:** the sled's "cracked runner" didn't match the model; it's now "the red paint on the runners is worn thin".
- **F11:** taps pick the object actually under the pointer (its meshes) before the enlarged hit boxes. Tapping the router opens the router, except where the note is stuck on it.
- **F9:** a capitalised card name must appear capitalised. "Dill pickles" in the fridge no longer unlocks "Pickles the cat" (test added).
- **F6:** canned lines go round in order per visit (random start), so no deflection repeats before the others have been said.
- **F12:** ← and → turn album pages.
- **F16:** on phones, only the hall's must-reach tools pull the framing, so the album stays on screen in the coffee table view.
- **F17:** a solve cuts to Grandma for her reaction.
- **F4:** at large text sizes the pinned note gives way to the tabs (it's still under Note).
- **Tests:** two seed-dependent tests that failed about 1 run in 4 now test the property, not a lucky path. 271 tests pass, three full runs in a row.
- **Not changed (puzzle data, for the team):**
  - **F2:** "Where did you spend your honeymoon?" and "What did Grandpa call you?" each give a word part directly.
  - **F8:** Medium's per-part router feedback plus the half-visible sign make 412 easy to brute-force.
  - **Not done:**
    - **F7:** "Spoken" falls back to browser speech without a server voice; with the ElevenLabs voice configured, as planned for the deploy, it plays her voice.
    - **F5:** the HUD covers about 40% of each view.
    - **F13:** a resumed visit loses the cost tags.
    - **F14:** some tutorial bubbles still cover their target.

## Iteration 62 (2026-11-18): the course key is an OpenRouter key

- **Found:** the key in `.env` is an OpenRouter key (`sk-or-…`), not an Anthropic one. The server would have sent it to Anthropic and every turn would have fallen back to her "lost my train of thought" line.
- **OpenRouter client** (`apps/server/src/openrouter.ts`): same `messages.parse` shape as the Anthropic SDK, so the Grandma brain, the eval, the judge and the AI player run unchanged. It asks for:
  - strict JSON, with enums given an explicit type for OpenAI's strict mode;
  - only providers that honour every parameter and don't keep prompts;
  - the call's real price, which the daily budget and the eval now count instead of the Haiku price table.
  The world block keeps its cache mark. Claude runs without extended thinking; other families get a low reasoning effort.
- **Config:** `OPENROUTER_API_KEY`, or an `sk-or-` key under the old name, selects OpenRouter. Claude ids map (`claude-haiku-5-5` → `anthropic/claude-haiku-5.5`). Keys from the environment still count only with `GRANDMA_MODE=llm`.
- **Eval models:** `JUDGE_MODEL`, `AGENT_MODEL` and `WORLDGEN_MODEL` are now read from `.env`; they were fixed in code before.
- **Model choice:** written up in `docs/13-model-choice.md`.
  - Grandma stays on Claude Haiku 5.5.
  - Judge and AI player move to `openai/gpt-6.1-terra`: another family, a quarter of Opus's price.
  - A ~$5 bake-off is proposed and waits for approval.
- **Key check:** the free `/key` endpoint answered with status 200, a $40 limit and $0 used. No model has been called yet.
- **Tests:** `apps/server/test/openrouter.test.ts`, with a fake network. 277 tests pass, two runs in a row; typecheck, validate, golden and build pass.

## Iteration 63 (2026-11-18): the model bake-off

Full results and the decision are in `docs/13-model-choice.md`. The bake-off spent $5.07 of the key's $40, as approved. In short:
- **Claude thought by default.** Through OpenRouter it spent ~490 hidden tokens a turn. Thinking is now off for Claude, so a Haiku turn has a 1.30 s median (was 2.81 s) at half the cost. Models that must reason (Sonnet 5.5) are retried at low effort, then remembered.
- **Validator fixes:**
  - quoted names: 'Unchained Melody' made every "Melody" fail;
  - plurals of known names and days.
- **The judge** now sees her stories, people and profile.
- **Dangerous requests** ("how do I make something that explodes") get a canned refusal before the model. The first run's only unsafe reply sent the player to "ask your uncle Michael".
- **Eval tools:**
  - `--model` and `--concurrency`;
  - the judge samples across notes, runs concurrently and records cost;
  - `eval/src/compare.ts` and `eval/src/probe-reasoning.ts`.
- **Decision:**
  - Grandma stays on Claude Haiku 5.5: 0 leaks, the only model under the 1.5 s median target, about $0.002 a visit.
  - Its weak spot is small embellishments: 42% of sampled replies by an uncalibrated OpenAI judge, against 22% for GPT-6 Luna.
  - GPT-6 Luna is the backup. Sonnet 5.5 is dropped.
- **Tests:** 280 pass.

## Iteration 64 (2026-11-18): colour, not clues

Details are in `docs/13-model-choice.md`, section "Colour instead of retrieval". In short:
- **Little things:** 47 authored colour items (the world's `colour`), guarded by `checkColour` in `npm run validate`. It refuses digits, answer words, time words, puzzle subjects, places and hiding spots in the house, and new names.
- **Prompt:** colour is allowed; clue-like inventions are not (names, places, years, ages, times, events, links between people, where things are kept).
- **Visit memory:** her last 10 older replies, 40 words each, ride in the running summary.
- **Judge:** verdicts are consistent, contradiction, misleading or unsafe, plus a list of colour and a charm score.
- **RAG:** not built. The world is about 4,000 tokens and cached; retrieval would risk the look-alike memories and lose the cache.
- **Result:**
  - misleading 20% → 15% (most of what's left is the judge being strict);
  - harmless colour 44% → 52%;
  - charm 3.9, unchanged;
  - 0 leaks;
  - latency median 1.35 s.
  One colour line of mine ("hide the cookie tin behind the flour") caused a misleading reply; it is reworded and the validator now catches hiding words.
- **Spend:** $1.12 this round, $6.21 in total of the key's $40 (about $0.40 over the approved $5.80).
- **Tests:** 282 pass.

## Iteration 65 (2026-11-18): live on Fly

- **Live:** https://grandmas-wifi-password.fly.dev. One shared-cpu machine (512 MB) in ewr, plus a 1 GB encrypted volume for runs and turn logs.
- **Build:** the image is built on Fly's remote builder; `.dockerignore` keeps `.env` and `var/` out of it.
- **Secrets:** `OPENROUTER_API_KEY` and `GRANDMA_MODE=llm`, set by Jacky from `.env` without the key passing through the assistant.
- **Checked on the live site:**
  - the health check says LLM mode (`anthropic/claude-haiku-5.5`) and the browser voice;
  - the home page loads in 0.09 s, with the CSP and HSTS headers;
  - a new visit's payload has no answer;
  - "What was your very first dog called?" got an in-character Haiku reply in 2.2 s, and the tea went to 92;
  - the title screen renders in Chrome.
- **Snag:** flyctl 0.4.120 broke itself while auto-updating (it rejects versions that are "severely out of date"). Re-installing with the official script brought it to 0.5.12.
- **README:**
  - play link at the top;
  - how the AI is used and the leak results;
  - current status and keys;
  - deploy notes;
  - the team table is left as it was for now.
