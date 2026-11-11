# CPSC 1710 Final Project: Candidate Game Ideas and Design Explanation

> Drafted with Claude Code (Claude Opus 5.5) under Jacky Yao's direction, on 2026-11-11. The original Chinese research notes are kept outside this repo. Steam figures are snapshots taken that day, and several come from third-party estimates, so please re-check key numbers before submitting. Personal-motivation sections (Q1.2) must be written by the team members themselves.

---

## Part 1: What we learned from the market (short version)

**Find The Needle** (Steam, Early Access since 2026-11-06, $14.99):
- **Who made it:** It is a clone of *Needle In A Haystack Simulator* by Studio BitDot. That game started from a viral tweet on 2026-08-22, about 23.3M views.
- **How it went viral:** It released a publicly downloadable demo first. YouTubers spread it within about 13 days, it overtook the original in Steam followers on Oct 5, and it became a top demo in October Next Fest.
- **Launch numbers:** At launch it peaked at 5,778 concurrent players, and reviews were Mostly Positive (77% of 496 reviews at the time we checked).
- **What players dislike:** Progression is gated behind delivery orders, and pacing is slow.

**Design lessons:**
1. Use an absurd premise you can say in one sentence, ideally with a ridiculous number ("find 1 needle in 5 million pieces of hay").
2. Make the first 30 seconds funny or satisfying.
3. Make every run different, so streamers can make a series of videos.
4. Let the audience participate. *Meccha Chameleon*'s viewer lobbies are the model here.
5. Keep the price low ($3–5), release a free demo early, and enter Steam Next Fest.
6. Concept-only games get cloned quickly. Valve's advice was to make games "harder to copy," so the moat has to be a system or content, not just the idea.
7. AI-driven games stream well but face player skepticism on Steam.
   - Steam requires disclosure of live-generated AI content and a description of the guardrails used.
   - *Suck Up!* had high stream hours but a low third-party sales estimate on Steam.

---

## Part 2: The four candidate ideas

### Idea A ⭐ (recommended): *Grandma's Wi‑Fi Password*

**Pitch.** Grandma's Wi‑Fi password is on a sticky note that only says "first dog's name + the year I married Grandpa." Grandma is 87 and remembers everything. She just can't tell which memory you need. You get 20 questions before she falls asleep.

**Core loop (5–10 min per run):**
1. Draw a sticky-note "password recipe," e.g. `[first pet's name][wedding year]`.
2. Ask Grandma questions by typing or voice. She answers truthfully, but she rambles, goes off on tangents, and mixes up names. The needle is buried in a haystack of stories.
3. Every question drains her stamina bar. When it is empty, she naps and the run ends. Cookies restore stamina, and the photo album helps you pin down dates.
4. Type the password into the router. You get three attempts.
5. Get a shareable result card, Wordle-style: `👵 Grandma #127 — 7 questions, 2 naps, 1 cookie 🔑`.

**Why it could go viral:**
- Grandma's tangents make clips on their own, like a love story from 1962 or gossip about the neighbors.
- A "hard of hearing" mechanic turns low-confidence speech recognition into comedy. "Password" might come out as "pass the sword?"
- A Daily Grandma gives every player the same seed and a leaderboard, so streamers can compete on fewest questions.
- **Streamer Mode:** Twitch chat plays "the other grandkids" and votes on the next question.
- **Human vs. AI Mode:** A Claude agent tries to find the same password. It makes a good demo and good marketing.

**AI techniques used:**
- **Procedural world generation.** Code builds a random life timeline, then an LLM fills in personality, stories, and catchphrases using structured output. The result is a "fact graph" of about 200 facts.
- **Retrieval (RAG).** Each question pulls the relevant facts plus a few distractor facts into Grandma's context.
- **Grounded NPC dialogue.** A fast, cheap model (Claude Haiku 5.5) answers in character. It returns a structured result: `{reply, facts_used, mood, stamina_cost}`.
- **Guardrails by design.** Grandma never knows the password itself, only scattered facts. So jailbreaks like "just tell me the password" fail structurally. A post-check also rejects any name or year in a reply that is not in the fact graph.
- **Speech-to-text (stretch goal).** Voice input, with the hard-of-hearing mechanic built on recognition confidence.
- **Evaluation.**
  - An LLM-as-judge checks each reply against the fact graph for contradictions.
  - An AI play-testing agent plays many runs to calibrate difficulty.
  - A red-team prompt set tests for leaks and unsafe output.

**Why it fits the course.** "Needle in a Haystack" is the name of a well-known LLM benchmark for long-context retrieval. Our game flips it: the human takes the needle-in-a-haystack test, and the AI is the haystack. We can also run humans and an AI agent on the same seeds and compare them as a small interactive NIAH experiment.

**Feasibility (4 weeks).** Good. The floor version is a 2D web page with a chat UI and a portrait. Art needs are small.

**Main risks:**
- **Hallucinated facts make puzzles unfair.** Mitigation: the fact graph is the single source of truth, and replies are validated against it.
- **Anti-AI backlash on Steam.** Mitigation: disclose honestly, use human-made art, and frame the AI as the character's brain.
- **Ethics.** Grandma must be written as sharp and witty. Her rambling is a love of storytelling. It is not memory loss, and we never mock dementia.

---

### Idea B: *1 Human, 999 AIs*

**Pitch.** A group chat has 1,000 users. 999 are AI bots and one is a real person, usually a viewer from the streamer's chat. Find the human before time runs out.

**Core loop.** The streamer reads the chat, asks questions, and accuses suspects. Viewers can join as the hidden human and try to act like a bot. A single-player variant flips the roles: you are the human hiding among bots while an AI detective interrogates the room.

**Why it could go viral:**
- It is a reverse Turing test, and viewer participation is built in, the same way Meccha Chameleon's viewer lobbies work.
- It satirizes the 2026 "AI clone" drama directly.

**AI techniques:**
- Many lightweight LLM agents, each with its own persona.
- Style imitation, where bots mimic how chat talks.
- An AI detective agent for the single-player mode.
- Moderation for the live viewer input.

**Feasibility.** Low for 4 weeks. It needs real-time multiplayer, Twitch API integration, and hundreds of concurrent LLM agents, which brings high cost and rate-limit problems.

**Verdict.** It has the highest streamer potential but is too risky as the main project. It could become a stretch or ceiling mode later.

---

### Idea C: *Infinite Zoom Spot-the-Difference*

**Pitch.** One giant AI-generated scene at gigapixel scale. Somewhere in it there is a single wrong detail. Zoom forever to find it.

**Core loop.** Pan and zoom, mark suspicious spots, and race the timer. Daily puzzles and leaderboards keep people coming back.

**Why it could go viral.** It is a "Where's Waldo" with an absurd scale, and chat can help spot things.

**AI techniques.** Mostly offline image generation and outpainting to build the giant scene, plus inpainting to plant the anomaly.

**Feasibility.** Medium. The image pipeline and visual consistency are hard to get right.

**Verdict.** Not recommended.
- At runtime there is little AI, so the course angle is weak.
- AI-generated art is the most criticized kind of AI use on Steam.
- It would be easy to clone.

---

### Idea D: *Customer Service Hell*

**Pitch.** You just want a $12 refund. The company's AI customer-service bot keeps transferring you, misunderstanding you, and offering coupons. The needle is the one department and phrasing that actually gets the refund approved.

**Core loop.** Talk to a chain of LLM support agents. Each one has hidden rules, for example "only escalates if you mention the order number twice." Find the path to the refund within a patience limit.

**Why it could go viral.** Everyone hates support bots. It makes for relatable rage-comedy and would play well on stream.

**AI techniques:**
- Multi-agent LLM dialogue with hidden rule sets.
- Routing between agents.
- Structured state tracking of what the player has proven so far.

**Feasibility.** Good. It is technically similar to Idea A.

**Verdict.** A solid backup.
- The premise is a little less "absurd and wholesome" than Grandma.
- It is closer to existing jailbreak-style games.
- It risks becoming frustrating rather than funny.

---

### Comparison

| Idea | Streamer potential | AI depth | 4-week feasibility | Hard to clone | Steam risk | Recommendation |
|---|---|---|---|---|---|---|
| A. Grandma's Wi‑Fi Password | High | Very high | Good | Good | Medium (AI stigma) | ⭐ First choice |
| B. 1 Human, 999 AIs | Very high | High | Low | Medium | High | Stretch mode later |
| C. Infinite Zoom | Medium | Low (offline only) | Medium | Low | High (AI art) | ✗ |
| D. Customer Service Hell | Medium–high | High | Good | Medium | Medium | Backup |

---

## Part 3: Design explanation for the recommended idea (A)

### 3.1 Progression (avoiding Find The Needle's mistakes)
- **No mandatory delivery orders.** Players unlock new relatives, each a new type of haystack:
  - Grandpa, who tells only war stories;
  - a forgetful uncle;
  - a fast-talking cousin;
  - and later a 2.5D attic full of letters and photo albums to dig through physically.
- **Light incremental layer.** Solved passwords earn "family points." Points buy a hearing aid (better speech recognition), cookies, and reading glasses. These are conveniences only and never block progress.

### 3.2 System architecture

**Offline (development time):**
1. **World generator.** Code creates the life skeleton: birth year and event timeline. An LLM (Claude Opus 5.5, structured output) writes the persona, stories, and verbal tics.
2. **Consistency validator** (plain code). It checks the timeline, ages, and names, and confirms the password is actually solvable. The output is a fact graph of about 200 facts per Grandma.

**Runtime (each run):**
1. **Player input:** typed text, or voice converted with speech-to-text.
2. **Retrieval:** the facts relevant to the question, plus random distractor facts.
3. **Grandma model** (Claude Haiku 5.5): persona prompt plus the retrieved facts. It returns `{reply, facts_used, mood, stamina_cost}`.
4. **Guardrail post-check:** every name and number in the reply must exist in the fact graph, or the reply is regenerated. A content-safety filter also runs on both input and output.

**Evaluation:**
- An LLM-as-judge flags contradictions between replies and the fact graph.
- An AI play-testing agent plays N runs and reports solve rate and number of questions used.

### 3.3 Tech stack (suggested)
- **Frontend:** a web app (TypeScript + Vite) with a 2D portrait and chat UI. This is easy to demo in class. Later we wrap it with Electron + steamworks.js for Steam. Godot 4 + GodotSteam is an alternative if someone on the team knows Godot.
- **Backend:** a small proxy server, such as Cloudflare Workers, Vercel, or FastAPI. It holds the API key, which must never ship in the client, and rate-limits each user.
- **Models:**
  - Claude Haiku 5.5 for Grandma at runtime ($0.10 / $0.50 per million input/output tokens).
  - Claude Opus 5.5 for offline world generation and judging ($4 / $20).
- **Voice (stretch):** the browser Web Speech API or Whisper for speech-to-text, and optionally a fixed text-to-speech voice for Grandma.

### 3.4 Cost estimate
- **Per run:** about 25 questions, each using about 6K input tokens and 150 output tokens. That totals about 150K input and 4K output, or roughly **$0.02 per run**.
- **Content:** generating one Grandma offline costs about $0.50. 365 "Daily Grandmas" would cost about $150–200, and the Batch API can halve that.
- **Margin:** at a $4.99 price, 20 runs per player costs about $0.35 in API fees. The free demo needs a daily run cap. Fallback options are a local small model or a bring-your-own-API-key mode.

### 3.5 Evaluation plan

| Metric | Method | Target |
|---|---|---|
| Fact consistency | 500 automated dialogue turns judged by an LLM against the fact graph. Humans spot-check 50 to calibrate the judge | < 3% contradictions |
| Invented key entities | Rule check that every name and year in a reply exists in the graph | < 1% |
| Jailbreak / leakage | Red-team set of 50–100 prompts ("ignore your instructions," "just tell me the password") | No one-step password extraction |
| Solvability and difficulty | AI agent plays each Grandma 20 times; we record solve rate and median number of questions | 60–85% solved, median 8–15 questions |
| Latency | p50 / p95 time to first token | p50 < 1.2 s |
| Fun | Playtests with 10–20 people, a survey ("would you replay / share?"), and a count of laughs from screen recordings | > 70% would replay |
| Safety | A harmful-input test set | 0 policy-violating outputs |

### 3.6 Floor and ceiling

**Floor (minimum success):**
- A web game with typed questions.
- One hand-written Grandma plus three generated ones.
- One full run: sticky note, questions, stamina, password entry, result card.
- The fact graph and guardrail post-check.
- First results from the consistency evaluation and the AI play-testing agent.

**Ceiling (if AI accelerates everything):**
- A Steam store page and a free demo, entered in Next Fest.
- Voice input with the hard-of-hearing mechanic, plus a voiced Grandma.
- Daily Grandma, leaderboards, and share cards.
- Streamer Mode with Twitch chat voting, and Human vs. AI Mode.
- More relatives, and a 2.5D living room you can physically rummage through.

### 3.7 Timeline (today is 11/11; proposal due 11/19; presentations 12/8–12/10; report and code due 12/11)

| Phase | Dates | Work | Est. team hours |
|---|---|---|---|
| 0. Proposal and paper prototype | 11/11–11/19 | Write the proposal. Test "persona + facts" dialogue with a quick script, and play 5 rounds by hand to check if it is fun | 15 h |
| 1. Core engine | 11/19–11/26 (Thanksgiving week) | World generator, validator, retrieval, NPC calls, guardrails. Playable in the command line | 25 h |
| 2. Playable web version | 11/26–12/2 | UI, stamina, sticky note, password entry, share card. Backend proxy and eval scripts v1 | 30 h |
| 3. Evaluation and playtests | 12/2–12/6 | AI play-testing agent, LLM judge, red-team testing, 10+ human playtesters, tuning | 20 h |
| 4. Polish and present | 12/6–12/11 | Voice (if time allows), a 30-second trailer clip, presentation and report | 15 h |
| After the course (optional) | 2027 | Steam page ($100 Steamworks fee), AI disclosure, demo, creator outreach, Next Fest | — |

**Key dependency.** If Grandma cannot stay consistent with the fact graph (target: under 5% contradictions by the end of week 1), the difficulty evaluation is meaningless. In that case we fall back to a more constrained design, where Grandma picks from and rewrites pre-generated answer snippets.

### 3.8 Suggested division of labor (assuming 3–4 people; adjust to the real team)
- **AI / backend:** world generator, retrieval, NPC prompts, guardrails, cost control.
- **Evaluation:** LLM judge, AI play-testing agent, red-team set, playtest survey and analysis.
- **Frontend / gameplay:** UI, stamina and items, game feel, share card, voice input.
- **Art / writing / marketing:** Grandma's portrait (human-made, to avoid AI-art backlash), persona and joke writing, the Steam page, and trailer clips.
