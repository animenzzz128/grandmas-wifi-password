# CPSC 1710 Final Project: Market Research and Design for a "Boring-but-Viral" Game

> Research date: 2026-11-11. Steam numbers are snapshots that change over time, and second-hand sources vary in reliability; each one is labeled below.
> Drafting credit: Drafted with Claude Code (Claude Opus 5.5) under Jacky Yao's direction. Sections that require team members' real experiences, such as personal motivation, are placeholders only. Please rewrite them yourselves and verify all numbers before submitting.
> The original Chinese version is kept outside this repo.

---

## 0. One-line conclusion

We recommend building **_Grandma's Wi‑Fi Password_** (working title), a *conversational* needle-in-a-haystack game. Grandma's 80 years and roughly a million words of memories are the haystack, and the Wi‑Fi password hidden in them is the needle. The only way to dig it out is by chatting (typing or voice) with an LLM-powered Grandma.

- **Why it could go viral:** The premise is absurd and fits in one sentence. It also streams and clips well, because Grandma goes on tangents, mishears you, and nods off mid-story. Viewers can participate too.
- **Why it fits an AI course:** "Needle in a Haystack" is a classic benchmark for testing LLM long-context retrieval. We flip it: **the human takes the needle-in-a-haystack test, and the AI is the haystack.** The project uses RAG, structured output, guardrails, speech, LLM-as-judge evaluation, and AI agents that play the game automatically.
- **Why it can ship on Steam:**
  - The scope is small and the price can be low ($3–5).
  - The core fun comes from system-generated content, which an "AI cloner" can't easily copy.
  - The runtime cost with Claude Haiku 5.5 is estimated at about $0.02 per run.

---

## 1. Case study: the story of Find The Needle

### 1.1 Timeline (2026)

| Date | Event | Source |
|---|---|---|
| 8/22 | Indie developer Nas Nakarus (Studio BitDot) tweets a prototype: "find 1 needle in 5 million pieces of hay." About 23.3M views | Kotaku / explainx |
| Within a week | The original, *Needle In A Haystack Simulator*, gets a Steam page. **Two clone coming-soon pages appear the same day** | HowToMarketAGame |
| Late Aug | The original's playtest gets 23K sign-ups. It signs Polden Publishing on 9/1 | HowToMarketAGame |
| Sep | The clone **Find The Needle** (Needless Games) is first to release a **publicly downloadable demo** | HowToMarketAGame |
| From 9/23 | YouTuber Orbital Potato finds the demo. Within about 13 days it spreads to many YouTube creators | HowToMarketAGame |
| 10/5 | Find The Needle passes the original in Steam followers | HowToMarketAGame |
| Oct | One of the top demos at Steam Next Fest. GamesRadar reports the original faced about 8 clones before release | HowToMarketAGame / GamesRadar |
| 10/27 | At Steam Indie Connect, Valve responds to cloning by saying developers should make their games "harder to copy" | 80.lv |
| 11/6 | Find The Needle launches in Early Access at $14.99, with 15% off at launch | Steam store page |
| 11/7–8 | Enters France's top 20 Steam best-sellers. SteamDB concurrent-player peak: 5,778 (11/8) | univers-simu / SteamDB |

### 1.2 The product itself
- **Gameplay:**
  - First-person. You start by digging through hay by hand with a shovel, wheelbarrow, and metal detector, and sell the hay for money.
  - The money buys conveyors, compressors, scanners, robotic arms, and drones that automate the search.
  - There are 24 needles, 5 industrial stages, and 300+ upgrades. A standard run takes 7–10 hours.
- **Tags:** Simulation / Incremental / Automation / Physics / Funny / Idler. It supports 17 languages.
- **Reception:** Mostly Positive when we checked, with 77% of 496 reviews positive. On 11/7 it was only about 68%.
  - What players like: the absurd premise, and the satisfaction of automating a tedious manual task.
  - What players complain about:
    - progression gated behind delivery orders;
    - slow pacing;
    - annoying space and power limits;
    - performance problems.
- **Streaming:** Streamstats shows a 66,426-viewer peak on Twitch/Kick in the last 30 days. Streaming interest during the demo period was higher than at launch.

### 1.3 Takeaways
1. **The premise should be "one sentence plus one ridiculous number."** "Find 1 needle in 5 million pieces of hay" fits on a thumbnail.
2. **Whoever ships a playable demo first wins.** A closed playtest is not enough; YouTubers want a demo they can download right away. The clone overtook the original by releasing its demo first.
3. **Cloning is a real risk.** Pure mechanic-based ideas can be "vibe-cloned." Valve's stance is that developers should make their games harder to copy, so the moat has to come from **systems and content**, not the idea alone.
4. **Don't gate progression the way it did.** Most of its negative reviews come from forced orders and slow pacing. Our game should be fun within the first 30 seconds.

---

## 2. Comparison of similar "boring / absurd" viral hits

| Game | One-line premise | Key data (check sources) | Why it took off |
|---|---|---|---|
| **A Game About Digging A Hole** (Feb 2025) | Dig a hole in your backyard | 100K+ wishlists before launch. 250K copies in week one. Publisher says 1M by Aug 2025 (third-party Raijin estimates about 430K on Steam; the two don't agree) | A side project by a solo artist. Millions of TikTok views. Priced around $5 |
| **Meccha Chameleon** (Jun 2026) | Paint your body to blend in during hide-and-seek | 2 developers, about 2 months, $5. 500K wishlists before launch. Peak 132K+ concurrent players. Sales reports vary widely: Automaton says 2M in 5 days, and a Windows Central headline says 15M in a month | **Viewers can join the streamer's lobby**, the visuals are clip-friendly, and the price is an impulse buy |
| **Only Up!** (2023) | Just keep climbing up | Solo developer. Went viral as streamers suffered on it, then was pulled from Steam due to stress | "Streamer suffers, audience laughs" |
| **Crab Game** (2021) | Free Squid Game-style party game | Peak 283K concurrent players | Free, multiplayer, streamers played with viewers |
| **Suck Up!** (Steam version Oct 2025) | A vampire uses **voice** to trick AI characters into opening their doors | 850K hours watched and a 12.5K peak on Twitch/Kick in one 7-day window. Raijin estimates only about 5,600 Steam copies at $16.99. Earlier versions sold outside Steam, so this number may be an underestimate | **AI dialogue streams well**, but streaming buzz doesn't always turn into Steam sales |
| **Whispers from the Star** (Aug 2025) | Voice conversations with an AI-driven alien girl | 92% positive early on (202 reviews) | A real voice actor works with the AI, and the store page discloses how AI is used |
| **Lakera "Gandalf"** (web) | Get the AI to reveal the password it guards | A prompt-injection mini-game that spread widely | An intellectual challenge of "jailbreaking the AI." **Our closest competitor**; see §4.6 for how we differ |

### Common patterns (design checklist)
- ✅ An absurd premise you can understand in one sentence, ideally with an exaggerated number
- ✅ An "aha" or laugh within the first 30 seconds
- ✅ Every run is different, so streamers can play repeatedly and make series videos
- ✅ The audience can take part (Meccha's viewer lobbies, chat voting)
- ✅ A low $3–5 price, a free demo, and a Next Fest entry
- ⚠️ AI is a controversial topic on Steam. Disclose it honestly, make the art ourselves where possible, and make AI *the gameplay itself*, not cost-cutting "AI slop"

### Steam's AI policy (updated Jan 2026)
- AI tools used only in the development process, such as writing code, **do not need to be disclosed**.
- **Pre-generated content** (AI art, text, or voice shipped with the game) and **live-generated content** (produced by an LLM at runtime) must both be disclosed. For live-generated content, developers must also describe the guardrails that prevent illegal output.
- The Steam overlay provides a report button. According to second-hand sources, live-generated adults-only sexual content is banned.
- → Our game counts as "live-generated," so the guardrail design itself becomes a technical highlight of the course project.

---

## 3. Scoring the candidate ideas (for team discussion)

| Idea | Streamer potential | AI depth | 4-week feasibility | Hard to clone | Steam risk | Recommendation |
|---|---|---|---|---|---|---|
| **A. Grandma's Wi‑Fi Password**: conversational needle in a haystack | ★★★★ | ★★★★★ | ★★★★ | ★★★★ | Medium (AI controversy) | ⭐ **First choice** |
| B. 1 Human vs. 999 AIs: viewers hide in a group chat of AI bots, and the streamer finds the human | ★★★★★ | ★★★★ | ★★ (real-time multiplayer, Twitch API, high cost) | ★★★ | High | Could become a ceiling mode for A |
| C. Infinite-zoom spot-the-difference: find one error in an AI-generated gigapixel picture | ★★★ | ★★ (AI mostly generates art offline) | ★★★ | ★★ | High (AI art draws criticism) | ✗ |
| D. Customer Service Hell: an LLM support bot keeps passing you around while you try to get a refund | ★★★ | ★★★★ | ★★★★ | ★★ | Medium | Backup |

(See [game-ideas.md](game-ideas.md) for a full explanation of each idea.)

---

## 4. Detailed design of the recommended idea: _Grandma's Wi‑Fi Password_

### 4.1 Elevator pitch
> Grandma's Wi‑Fi password is on a sticky note that only says "first dog's name + the year I married Grandpa." Grandma is 87 and remembers everything. She just can't tell which memory you're asking about. You get 20 questions before she dozes off.

### 4.2 Core loop (5–10 minutes per run)
1. **Draw a sticky note** with a password recipe, e.g. `[first pet's name][wedding year]` or `[city of first love]+[favorite cookie]`.
2. **Ask Grandma questions** by typing or voice. She answers, but she **goes off on tangents, tells long stories, and mixes up names** ("Was it Biscuit or Buttons... that was the year we moved to Ohio..."). Everything she says is true. It's just buried under a lot of irrelevant information.
3. **Stamina bar.** Every question drains Grandma's energy, and wordy questions drain more. When it runs out she falls asleep and the run ends. Items help: cookies restore stamina, and flipping through the photo album helps pin down years.
4. **Enter the password** into the router. You get three tries, and if you fail you have to keep asking.
5. **Share card** (Wordle-style): `👵 Grandma #127 — 7 questions, 2 naps, 1 cookie 🍪 🔑`.

### 4.3 Why it's funny and streamable
- Grandma's tangents are ready-made clips. A question can turn into a World War II love story, gossip about the neighbors, or comments on your girlfriend.
- **Hard-of-hearing mechanic.** When speech recognition confidence is low, Grandma "mishears" you, e.g. "password" becomes "pass the sword." Recognition errors turn into jokes.
- **Streamer mode** (ceiling goal). Viewers in chat play "the other grandkids." They vote on the next question or spend points to give Grandma cookies.
- **Daily Grandma.** Every player worldwide gets the same seed, with a leaderboard. Streamers can compete on who uses the fewest questions.
- **Human vs. AI mode.** A Claude agent tries to find the same Grandma's password. "Can AI find the needle faster than you?" This is a gamified version of the NIAH benchmark, good for the class presentation and for promo videos.

### 4.4 Progression (learning from Find The Needle's criticism)
- **No mandatory orders.** You unlock **new grandmas and relatives** (Grandpa, a forgetful uncle, a fast-talking cousin) and **new "haystacks,"** such as a pile of letters in the attic or old photo albums. The ceiling goal is a 2.5D scene you can rummage through.
- **Light incremental layer.** Solved passwords earn "family points." Points buy a hearing aid (better speech recognition), cookies, and reading glasses. These only make things easier and never block progress.

### 4.5 System architecture

```
 ┌──────────── Offline (dev time) ─────────┐        ┌──────────── Runtime (each run) ─────────┐
 │ ① World generator                       │        │ Player input (text / voice → STT)        │
 │   Code builds a random skeleton         │        │        │                                 │
 │   (birth year, event timeline)          │  JSON  │ ③ Retrieval: relevant facts from the     │
 │ + LLM (Opus 5.5, structured output)     │ ─────▶ │    fact graph + random distractor facts  │
 │   fills in persona, stories, tics       │        │    (RAG)                                 │
 │ ② Consistency validator (pure code)     │        │        │                                 │
 │   no timeline/age/name conflicts;       │        │ ④ Grandma NPC (Haiku 5.5)                │
 │   password is solvable                  │        │   persona prompt + retrieved facts       │
 │   → fact graph of ~200 facts            │        │   → structured output:                   │
 └─────────────────────────────────────────┘        │   {reply, facts_used[], mood, cost}      │
                                                    │        │                                 │
 ┌──────────── Evaluation ─────────────────┐        │ ⑤ Guardrail post-check: every name/number│
 │ ⑥ LLM-as-judge: do replies contradict   │        │   in the reply must exist in the graph,  │
 │   the fact graph?                       │        │   otherwise regenerate; content-safety   │
 │ ⑦ AI play-testing agent: plays N runs,  │        │   filter                                 │
 │   measures solve rate and question      │        └──────────────────────────────────────────┘
 │   count → difficulty calibration        │
 └─────────────────────────────────────────┘
```

**Key design choice: Grandma herself doesn't know the password.** The password is built from several facts in the graph, and Grandma only knows scattered facts. That makes jailbreaks like "just tell me the password" or "ignore previous instructions" structurally useless, which sets us apart from Gandalf's "guard the password" gameplay. It is also an *information-hiding guardrail* we can write up in the report.

### 4.6 How we differ from competitors
- **vs. Gandalf:** Gandalf tests jailbreaking the AI. We test retrieval and reasoning, piecing information together like a detective. Jailbreaking doesn't help here.
- **vs. Suck Up!:** Suck Up! is about persuasion, costs $16.99, and has expensive 3D production. Ours is a cheap, short-session puzzle you can play every day.
- **vs. Find The Needle:** It's the same needle-in-a-haystack satisfaction, but our haystack is *alive, talks back, and changes every run*. Our core assets are the fact-graph generator and Grandma's personality, which a cloner can't copy in one shot.

### 4.7 Tech stack (suggested)
- **Frontend:** a web app (TypeScript + Vite) with a 2D portrait and a chat UI. AI coding tools handle this kind of code well, and for the class demo we can just open a link. For Steam, wrap it with Electron + steamworks.js. If someone on the team knows Godot, Godot 4 + GodotSteam works too.
- **Backend:** a small proxy service, such as Cloudflare Workers, Vercel, or FastAPI. The API key stays on the server and **must never be bundled into the client**. Rate-limit per user.
- **Models:**
  - Runtime Grandma: `claude-haiku-5-5` ($0.10 / $0.50 per million input/output tokens, for requests ≤100K tokens).
  - Offline world generation and LLM judging: `claude-opus-5-5` ($4 / $20).
- **Voice** (mid-term goal): the browser Web Speech API or Whisper for speech-to-text. Text-to-speech is a ceiling goal, with one fixed voice for Grandma.

### 4.8 Cost estimate
- **Per run:** about 25 questions. Each call uses about 6K input tokens (prompt caching can cover the persona part) and about 150 output tokens. That totals about 150K input and 4K output tokens, or **about $0.017 per run**.
- **Content:** generating one Grandma offline takes about 20–30K output tokens, or about $0.50. Pre-generating 365 "Daily Grandmas" costs about $150–200, and the Batch API halves that.
- **Margin:** at a $4.99 price, 20 runs per player costs about $0.35. The free demo needs a daily run limit. Alternatives are an offline mode with a local small model (llama.cpp) or letting players bring their own API key.

### 4.9 Evaluation plan (for assignment Q2.3, "data and evaluation")

| Metric | Method | Target |
|---|---|---|
| Fact consistency | 500 automated dialogue turns. An LLM judge checks each reply against the fact graph for contradictions, and humans spot-check 50 to calibrate the judge | < 3% contradictions |
| Hallucinated key entities | Rule check: every name and year in a reply exists in the graph | < 1% |
| Jailbreak / leakage | Red-team prompt set of 50–100 prompts, including "ignore your instructions" and "just tell me the password" | Password can't be obtained in one step |
| Solvability and difficulty | The AI play-testing agent plays each Grandma 20 times; we record solve rate and median question count | 60–85% solved, median 8–15 questions |
| Latency | p50 / p95 time to first token | p50 < 1.2 s |
| Fun | Playtest with 10–20 people (SUS plus "would you replay or share?"), and count laughs in screen recordings | > 70% would replay |
| Safety | A harmful-input test set, checking Grandma's responses and the content filter | 0 violating outputs |

**Bonus research angle:** run humans and an AI agent on the same seeds and compare question counts and success rates. This becomes a small "interactive NIAH" experiment for the report.

---

## 5. Mapping to the assignment: floor, ceiling, and timeline

### 5.1 Floor (minimum deliverable)
- A web version with typed conversation, one hand-written Grandma, and three procedurally generated Grandmas.
- A full run: sticky note, questions, stamina, password entry, result screen.
- The fact graph and guardrail post-check, plus first results from the consistency evaluation and the AI play-testing agent.

### 5.2 Ceiling (if AI speeds everything up)
- A Steam store page and a free demo, entered in Next Fest.
- Voice input, the hard-of-hearing mechanic, and a voiced Grandma.
- Daily Grandma, leaderboards, and share cards.
- Streamer mode (Twitch chat voting) and Human vs. AI mode.
- More relatives, and a 2.5D living room you can rummage through (a physical "haystack").

### 5.3 Timeline (today is 11/11; proposal due 11/19; presentations 12/8–10; report and code due 12/11)

| Phase | Dates | Work | Est. team hours |
|---|---|---|---|
| 0. Proposal and paper prototype | 11/11–11/19 | Write the proposal. Get "Grandma persona + facts" dialogue working in the Claude Console or a Python script, then play 5 rounds by hand to check that it's fun | 15 h |
| 1. Core engine | 11/19–11/26 (Thanksgiving week) | World generator, consistency validator, retrieval, NPC calls, guardrails. Playable in the command line | 25 h |
| 2. Playable web version | 11/26–12/2 | UI, stamina, sticky note, password entry, share card. Backend proxy and evaluation scripts v1 | 30 h |
| 3. Evaluation and playtesting | 12/2–12/6 | AI play-testing agent, LLM judge, red-team testing, 10+ human playtesters, tuning | 20 h |
| 4. Polish and presentation | 12/6–12/11 | Voice (if time allows), a 30-second promo clip, presentation and report | 15 h |
| After the course (optional) | 2027 | Steam page ($100 Steamworks fee), AI disclosure, demo, creator outreach, Next Fest | — |

**Dependency:** If consistency in Phase 1 can't be achieved, the difficulty evaluation in Phase 3 is meaningless. So in week 1 we need to confirm that Haiku + retrieval keeps the contradiction rate under 5%. If it doesn't, we fall back to a more constrained design where Grandma only selects and rewrites pre-generated answer snippets.

### 5.4 Suggested division of labor (estimated for 3–4 people; adjust to your actual team)
- **AI / backend:** world generator, retrieval, NPC prompts, guardrails, cost control.
- **Evaluation:** LLM judge, AI play-testing agent, red-team set, playtest survey and data analysis.
- **Frontend / gameplay:** UI, stamina and items, game feel, share card, voice.
- **Art / narrative / marketing:**
  - Grandma's portrait, hand-drawn or made by us to avoid AI-art controversy;
  - persona and joke writing;
  - the Steam page and promo clips.

---

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| The LLM invents facts and makes puzzles unfair | The fact graph is the single source of truth. Structured output plus entity validation, with regeneration on failure |
| Latency is too high and hurts pacing | Haiku with streaming output. Play a "Hmm... let me think" animation first. Prompt caching |
| Players reject AI games on Steam | Honest disclosure on the store page. Humans make the art and music. Marketing frames AI as "this character's brain" |
| Ethical concerns about mocking the elderly or dementia | Grandma is **sharp, witty, and just loves telling stories**. Memory loss is never the joke. Have people outside the team review the writing |
| API costs get abused | Server-side rate limits, Steam account authentication, a daily cap for the demo |
| Getting cloned | Ship a playable demo as early as possible (the Find The Needle lesson). Put the core value in the generator, daily seeds, and community |
| Players type harmful content | Moderate both input and output. Grandma has fixed "gently decline / change the subject" responses |

---

## 7. Next steps (this week)
1. Vote as a team on the candidate ideas in Section 3 and settle on a direction, or propose a new one.
2. Each member **writes their own "why"** (Q1.2). This has to be based on real experience and can't be written by AI.
3. Spend 2 hours on a paper prototype: one person plays Grandma by reading from a fact list, the others ask questions, and you time it to see whether it's fun.
4. As Q3.1 requires, discuss the plan in depth with an AI, and book the 15-minute check-in with a TA.

---

## Sources
- Find The Needle Steam store page: https://store.steampowered.com/app/5160800/Find_The_Needle
- SteamDB player counts: https://steamdb.info/app/5160800/charts/
- How To Market A Game, *AI Cloners Are Here. Are Indie Devs Cooked?*: https://howtomarketagame.com/2026/10/28/ai-cloners-are-here-are-indie-devs-cooked/
- Univers Simu review: https://en.univers-simu.com/news/find-the-needle-avis-steam-jeu-automatisation-233372/
- Streamstats: https://streamstats.io/games/find-the-needle
- Kotaku (the original going viral): https://kotaku.com/find-needle-haystack-game-steam-5-million-twitter-x-2000727664
- GamesRadar (clone wave): https://www.gamesradar.com/games/simulation/the-steam-ripoff-market-is-so-bad-that-viral-game-needle-in-a-haystack-simulator-is-facing-8-copycats-before-release-and-has-slapped-original-on-itself-to-clarify/
- 80.lv (the original developer's response to AI clones; Valve's stance): https://80.lv/articles/dev-of-viral-needle-in-a-haystack-game-finds-creative-way-to-mock-ai-clones
- A Game About Digging A Hole sales: https://www.pcgamesn.com/a-game-about-digging-a-hole/one-million-sales ; https://raijin.gg/app/3244220/A_Game_About_Digging_A_Hole
- Meccha Chameleon: https://automaton-media.com/en/news/japanese-developers-marvel-as-self-published-indie-hit-meccha-chameleon-sells-2-million-copies-in-just-five-days/ ; https://onestream.live/blog/meccha-chameleon-twitch-viewer-lobbies/
- Suck Up! data (third-party estimates): https://raijin.gg/app/2726370/Suck_Up ; https://datahumble.com/suck-up-2726370
- Roundup of AI NPC games: https://arcanumrpgs.com/blog/games-with-ai-npcs/
- Steam AI disclosure policy update (Jan 2026): https://www.pcgamer.com/software/ai/steam-updates-ai-disclosure-form-to-specify-that-its-focused-on-ai-generated-content-that-is-consumed-by-players-not-efficiency-tools-used-behind-the-scenes/
- Needle in a Haystack LLM benchmark: https://github.com/gkamradt/LLMTest_NeedleInAHaystack ; RULER: https://www.arxiv.org/pdf/2404.06654
