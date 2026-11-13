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
