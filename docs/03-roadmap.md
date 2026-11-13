# Roadmap, Tasks and Launch Plan

Course dates: proposal due **Thu 11/19**, in-class presentations **Tue 12/8 / Thu 12/10**, final report and code due **Fri 12/11**.
Roles (see §4): **AI** = AI/backend, **EV** = evaluation, **FE** = frontend/gameplay, **AR** = art/writing/marketing. Assign names in §4.

---

## 1. Milestones

| ID | Dates | Goal | Exit criteria (definition of done) |
|---|---|---|---|
| **M0** | 11/11 – 11/19 | Proposal and proof of fun | Proposal submitted. Paper prototype run with ≥ 4 people. Script prototype: Haiku plays Rosie from `rosie.json` for 10+ turns without contradicting her facts |
| **M1** | 11/19 – 11/26 | Core engine (command line) | `engine` validates worlds and runs turns. `/ask` pipeline works end-to-end in the CLI. 4 Grandmas available (1 hand-written + 3 generated) |
| **M2** | 11/26 – 12/2 | Playable web vertical slice | A full run in the 3D room in the browser: walk, inspect clues, show them to Grandma, ask, stamina, cookie, guess at the router, result card. Deployed to a private URL |
| **M3** | 12/2 – 12/6 | Evaluation and playtests | Eval report v1 (consistency, leakage, solvability, latency, cost, config A vs B). ≥ 10 human playtesters. Balancing pass |
| **M4** | 12/6 – 12/11 | Polish, present, report | 30-second trailer clip, live demo, final report and code submitted |
| M5 | 2027 (optional) | Steam demo | Steam page live, demo in Next Fest |

**Critical dependency.** By **11/26**, Grandma (Haiku plus validator) must stay under 5% contradictions on the M1 eval mini-set. If she doesn't, switch to the fallback design: Grandma picks from pre-written answer snippets per fact and only rephrases them. All later milestones depend on this gate.

---

## 2. Task breakdown

### M0: Proposal and proof of fun (≈ 15 h)
- [x] (all) Tech stack: TypeScript everywhere, first-person 3D web client with React Three Fiber, client replaceable by Godot later (technical design §8.3)
- [ ] (all) Confirm the role assignments
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
- [x] (FE) Grey-box 3D room from the scene manifest: walking, collision, interact prompts, UI overlay (scaffolded 11/12)
- [ ] (FE) Playtest the controls and the room layout; tune walking speed, interact distance and the camera

### Phase 1 from the 2026-11-12 playtest: fix the feel (done 11/13)
From `docs/05-playtest-review.md`. Do these before any new features: they make the controls feel broken.
- [x] (FE) B1: pressing E to open the router types "e" into the password box
- [x] (FE) B2: after asking Grandma, the chat box kept keyboard focus and silently swallowed WASD/E. Chosen fix: stay in talk mode (handy for follow-up questions) but show it with a yellow label; Esc or clicking the room returns to walking
- [x] (FE) B3: Esc backs out one layer at a time (card → chat → pointer lock); today cards only close with a mouse click
- [x] (FE/AR) B4: make text match the room (sled "leaning by the door" but lies flat; note "on the router" but on the wall; "Take a cookie" vs "Give Grandma a cookie")
- [x] (FE) B5: Show and Give only work within ~2 m of Grandma
- [x] (FE) B6: hide the "Mock Grandma" badge outside dev; fade the controls banner after the first look/walk
- [x] (FE) Regression check in Chrome with the skill scripts (Easy run; every input-mode scenario; production build hides debug info)
- [ ] (all) A human check of mouse-look feel and the carry-to-Grandma flow

### Phase 2: real deduction (in progress since 11/13)
- [x] (AI/AR) Notes rewritten as inference hops. Medium is now Maple412, with Cherry/27 as the competing answer. Chain maps are in `data/grandmas/rosie.chains.md`
- [x] (AI) `Recipe.separate`: a reply may use only one link of a chain (validator and mock), with tests
- [x] (AI) Persona rule: Grandma doesn't connect memories in time; the player builds the timeline
- [x] (AR) Clue objects carry a route for each slot fact (album, wedding photo, TV plate, house number)
- [x] (FE) Talking needs Grandma within earshot (3.2 m); a hint explains why when you're too far
- [x] (FE/AI) Slot-based router: one box per note slot; the server assembles and formats the password and says how many parts are right
- [x] (AI) Stall nudges: 3 turns off the chain, then an in-character line from the recipe pointing at the first hop
- [x] (EV) Solvability walkthroughs per recipe as API tests (mock: Easy 2, Medium 3, Hard 4 questions on the documented chain)
- [x] (EV) AI player (LLM) built: plays without knowing the chain; run it with the key to set par and check difficulty

### Evaluation pipeline (pulled forward: the design audit of 11/13 found it missing)
- [x] (EV) `eval/`: question bank (60), red-team set (32), batch runner with ablation switches (validator on/off, effort), rule-based metrics, Markdown reports (`npm run eval`)
- [x] (EV/AI) First finding fixed: one fact leaked both Medium answers; `checkWorld` now rejects any fact or story containing every slot value
- [x] (AI) Safety: a self-harm mention gets help resources (988), with no model call and no tea cost; API test added
- [x] (EV) Scripted solvability walkthroughs on the server API (see Phase 2); the LLM-driven AI player waits for the key
- [x] (EV) LLM judge (Opus) with label export and Cohen's κ calibration; AI player (Sonnet) over the HTTP API; Q-bank generator with dedupe. All cost-guarded (`--yes`), tested with a fake client, ready for the key
- [ ] (EV) Run them: judge + calibration (100 human labels), AI player 10 runs per difficulty, Q-bank to 300 (needs the course key)
- [x] (EV) Bootstrap 95% intervals in reports; `npm run eval -- --ablate` writes the §5 ablation table
- [x] (AI) Validator: wrong-year contradictions, password backwards, every slot value in one reply; one shared contradiction check for the game and the eval
- [x] (AI) Data checks: anchor years match their slot facts; fact years are plausible
- [x] (AI) Server: new visits rate-limited (10/min), 300 asks per day per IP, $ cost logged per turn; the shared prompt no longer hard-codes Rosie
- [x] (AI) Each nap costs a star (game design §3.3)
- [ ] (all) **Put the course key in `.env`**, then run `npm run eval -- --brain llm --yes` and `--ablate --brain llm --yes` for the first real numbers

### Phase 3: notebook and feedback (in progress since 11/13)
- [x] (FE) Notebook (Tab). It fills itself with names, years, places and numbers from Grandma's replies and inspect cards, each with its source sentence. It records facts, never connections, and is built only from text the player saw
- [x] (AI/FE) Every cost shows its reason (e.g. "−14 tea (8 +6 rude)"); text in another script is answered in character for free
- [x] (FE) Objectives strip that ticks off; the title screen gives the premise and what each difficulty means; the spawn faces Grandma
- [x] (AI) Showing an object: the mock reacts to that object's first-listed memory (the sled → Michael's arm)
- [x] (FE) Cards sit above the chat; tall cards scroll
- [ ] (all) Human check (Phase 3 exit): 5 testers, nobody scrolls the chat to find a fact, first question within 60 s

### Phase 5: Grandma alive (started 11/13; Phase 4 waits for the course key)
- [x] (FE) Each reply's mood drives her pose: happy laugh bob, nostalgic look up, confused head tilt, suspicious lean back, worried lean in; she nods while "talking"
- [x] (FE) She turns her head toward the player when they are in front of her
- [x] (FE) Voice: babble blips made in code (pitch and pace by mood), plus notebook and router chimes; M mutes; no audio files
- [x] (FE) While talking, the chat moves to the right so she stays visible; outside talk mode the log is shorter
- [ ] (AR) Face pass: older features (Blender, or a stylised face texture)
- [ ] (all) Muted test (Phase 5 exit): 4 of 5 testers can name her mood without reading

### Phase 6: look, sound and settings (started 11/13)
- [x] (FE) Soft contact shadows under furniture (baked once, cheap)
- [x] (FE/AR) Snow outside the window (ties into the snowstorm clue); winter-dusk sky
- [x] (FE) Glint above clues the player hasn't inspected yet, shown only within 3 m
- [x] (FE/AI) Settings (O, or the title screen): mouse sensitivity, field of view, invert Y, relaxed mode (tea never drains; server rule; marked on the result card)
- [x] (FE) Retro post-process: warm grade, 4×4 ordered dither, posterize (Settings: "Retro filter"; `?post=0` to compare)
- [ ] (AR) Set dressing that carries second and third clue routes; Grandma's face pass
- [ ] (all) Two reviewers score rubric dimensions 8 (visuals) and 9 (audio) (Phase 6 exit)

Phases 4 and 7 (live Grandma, balance) need the course key and human playtesters; see `docs/06-skill-review-and-plan.md`.

### M2: Web vertical slice (≈ 30 h)
- [ ] (AI) `apps/server`: Hono endpoints, in-memory session store, rate limiting, `.env` handling
- [ ] (FE) Polish the overlay (chat log, inspect card, note card, router panel, result card) and the interaction feel
- [ ] (FE) Result card and copy-to-clipboard, notebook pinning
- [ ] (FE) Voice input through server-side speech-to-text, mishear pun table (stretch)
- [x] (AR) First art pass: CC0 furniture (KayKit, Kenney), a posed and dressed Quaternius Grandma, code-made clue props; all listed in `CREDITS.md`
- [ ] (AR) Polish: a unified retro palette, Grandma's face (older features), and Blender versions of the code-made props if we want more detail
- [ ] (AR) Low-poly Grandma with 6 mood poses or expressions; clue-object models
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
| Frontend / 3D | _TBD_ | _TBD_ | `apps/web`, 3D room, controls, game feel |
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
| 3D work eats the AI time | Medium | High | One room only, grey-box first, CC0 assets; one person owns 3D so the AI pipeline isn't starved | FE |
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
