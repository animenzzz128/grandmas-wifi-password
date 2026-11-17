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
