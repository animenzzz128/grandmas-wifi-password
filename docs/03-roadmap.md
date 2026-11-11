# Roadmap, Tasks and Launch Plan

Course dates: proposal due **Thu 11/19**, in-class presentations **Tue 12/8 / Thu 12/10**, final report and code due **Fri 12/11**.
Roles (see §4): **AI** = AI/backend, **EV** = evaluation, **FE** = frontend/gameplay, **AR** = art/writing/marketing. Assign names in §4.

---

## 1. Milestones

| ID | Dates | Goal | Exit criteria (definition of done) |
|---|---|---|---|
| **M0** | 11/11 – 11/19 | Proposal and proof of fun | Proposal submitted. Paper prototype run with ≥ 4 people. Script prototype: Haiku plays Rosie from `rosie.json` for 10+ turns without contradicting her facts |
| **M1** | 11/19 – 11/26 | Core engine (command line) | `engine` validates worlds and runs turns. `/ask` pipeline works end-to-end in the CLI. 4 Grandmas available (1 hand-written + 3 generated) |
| **M2** | 11/26 – 12/2 | Playable web vertical slice | A full run in the browser: note, ask, stamina, items, guess, result card. Deployed to a private URL |
| **M3** | 12/2 – 12/6 | Evaluation and playtests | Eval report v1 (consistency, leakage, solvability, latency, cost, config A vs B). ≥ 10 human playtesters. Balancing pass |
| **M4** | 12/6 – 12/11 | Polish, present, report | 30-second trailer clip, live demo, final report and code submitted |
| M5 | 2027 (optional) | Steam demo | Steam page live, demo in Next Fest |

**Critical dependency.** By **11/26**, Grandma (Haiku plus validator) must stay under 5% contradictions on the M1 eval mini-set. If she doesn't, switch to the fallback design: Grandma picks from pre-written answer snippets per fact and only rephrases them. All later milestones depend on this gate.

---

## 2. Task breakdown

### M0: Proposal and proof of fun (≈ 15 h)
- [ ] (all) Vote and confirm the concept, the role assignments and the tech stack **[decide]** items
- [ ] (all) Each member writes their own Q1.2 motivation paragraph
- [ ] (AR) Run the paper prototype (`prototype/paper-prototype.md`) with ≥ 4 people and record the observations
- [ ] (AI) `prototype/` script: load `rosie.json` and chat with Rosie through Haiku 5.5 in the terminal
- [ ] (EV) Write 30 test questions for Rosie (10 direct, 10 vague, 10 adversarial) and hand-check the replies
- [ ] (all) Do the Q3.1 AI consultation and book the TA check-in (Q3.2)
- [ ] (all) Write and submit the proposal

### M1: Core engine (≈ 25 h)
- [ ] (AI) `packages/engine`: zod schemas matching `grandma.schema.json`, world loader, validator for worlds
- [ ] (AI) Turn pipeline: context builder (config A), Haiku call with structured output, reply validator, retry and fallback
- [ ] (AI) Stamina and intent rules, nap logic, guess checking
- [ ] (AI) `packages/worldgen`: seeded skeleton generator, Opus enrichment, recipe selector
- [ ] (EV) Mini eval set of 100 questions × 2 Grandmas, plus a contradiction checker (rule-based first)
- [ ] (AR) Write persona guides and the deflection-line bank (40 lines), and curate the anchor list (30 public events)
- [ ] (FE) Wireframes and component skeleton in `apps/web` with mock data

### M2: Web vertical slice (≈ 30 h)
- [ ] (AI) `apps/server`: Hono endpoints, in-memory session store, rate limiting, `.env` handling
- [ ] (FE) All UI components from technical design §8, wired to the server
- [ ] (FE) Result card and copy-to-clipboard, notebook pinning
- [ ] (FE) Voice input (Chrome), mishear pun table (stretch)
- [ ] (AR) Grandma portrait with 6 moods, living-room background, sticky-note and router art
- [ ] (AR) Babble audio and music loop (licensed or original)
- [ ] (AI) Config B (retrieval) behind a flag
- [ ] (EV) AI player agent v1, which plays through the same server API

### M3: Evaluation and playtests (≈ 20 h)
- [ ] (EV) Full eval runs (`docs/04-evaluation-plan.md`): consistency, entities, leakage, solvability, latency, cost
- [ ] (EV) Calibrate the LLM judge against 100 human-labeled replies (report Cohen's κ)
- [ ] (EV) Ablations: config A vs B, effort level, with/without validator
- [ ] (all) Run human playtests (protocol in eval plan §6), at least 10 participants
- [ ] (AI/FE) Balance stamina costs and par values from the data

### M4: Polish and present (≈ 15 h)
- [ ] (FE) Bug bash, loading and error states, a mobile-width sanity check
- [ ] (AR) 30-second trailer or clip, presentation slides
- [ ] (EV) Final results tables and charts
- [ ] (all) Final report and code submission. Include the AI-assistance disclosure required by the course

---

## 3. Workload estimate
| Milestone | Team hours | Span |
|---|---|---|
| M0 | 15 | 1 week |
| M1 | 25 | 1 week (Thanksgiving, so plan around travel) |
| M2 | 30 | 1 week |
| M3 | 20 | 4–5 days |
| M4 | 15 | 5 days |
| **Total** | **≈ 105** | **4.5 weeks** |

---

## 4. Team and roles (fill in)
| Role | Owner | Backup | Main areas |
|---|---|---|---|
| AI / backend | _TBD_ | _TBD_ | `packages/engine`, `apps/server`, `packages/worldgen` |
| Evaluation | _TBD_ | _TBD_ | `eval/`, playtest protocol, results |
| Frontend / gameplay | _TBD_ | _TBD_ | `apps/web`, game feel, voice |
| Art / writing / marketing | _TBD_ | _TBD_ | portraits, persona writing, deflections, trailer, Steam page |

**Team workflow**
- Branch per task: `feat/<area>-<short-name>`. Open a PR to `main`, and get 1 approval from another member.
- Track tasks on a GitHub Project board or as Issues. Label them by role (`ai`, `eval`, `frontend`, `art`) and milestone.
- Weekly 30-minute sync. A demo every Friday from M1 on.
- Never commit `.env` or API keys. Share keys through a private channel, and give each member their own key with a spend limit.

---

## 5. Risk register
| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Grandma contradicts facts | Medium | High | Validator, retry and fallback; the M1 gate; snippet-based fallback design | AI |
| Latency feels slow | Medium | Medium | Haiku at low effort, streaming, "thinking" animation, prompt caching | AI/FE |
| Puzzles unfair or too easy | Medium | High | Solvability gate, AI play-test par, human playtests | EV |
| Scope creep (voice, streamer mode) | High | Medium | Strictly floor first; stretch features only after M2 is done | all |
| API cost overrun during eval | Low | Medium | Per-key spend limits; Batch API for eval; cache prompts | EV |
| Harmful or offensive outputs | Low | High | Moderation, deflection bank, red-team set, human review of worlds | EV/AR |
| Insensitive portrayal of elderly people | Low | High | Tone rules (GDD §7), outside reviewers | AR |
| Team availability over Thanksgiving | High | Medium | Front-load M1 tasks; async PR reviews | all |

---

## 6. Post-course Steam plan (optional, M5)

1. **Steamworks account and app fee** ($100 per app). Build the store page early: capsule art, 5 screenshots, a 30-second trailer, and tags (Casual, Comedy, Puzzle, Conversation, Detective, Funny, Cozy, AI).
2. **Wishlists before launch.** Post clips on TikTok, YouTube Shorts and Twitter/X (Grandma's best lines). Reach out to variety streamers and YouTubers *with a downloadable demo*. That is the lesson from Find The Needle.
3. **Steam Next Fest.** Check Steamworks for the 2027 dates (historically February, June and October). Register the demo ahead of time.
4. **Pricing:** $4.99, with a launch discount. Free demo: 3 Grandmas plus the Daily mode, with a daily run cap to control API cost.
5. **AI disclosure (draft for the Steamworks form):**
   > *Live-generated content:* Grandma's dialogue is generated in real time by a large language model (Claude by Anthropic), grounded in a pre-written fact database for each character. Guardrails: replies are checked against the character's facts before display; player input and model output are moderated; the model is instructed to keep content PG; harmful input triggers pre-written responses. *Pre-generated content:* character backstories were drafted with AI assistance and reviewed and edited by the team. All art, music and sound are made by humans.
6. **Backend for launch:** a hosted server with per-Steam-account rate limits, a monitoring and cost dashboard, and a kill switch that falls back to a "Grandma's napping" maintenance mode.
