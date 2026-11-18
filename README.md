# 👵🔑 Grandma's Wi‑Fi Password

> Grandma's Wi‑Fi password is on a sticky note that only says *"first dog's name + the year I married Grandpa."*
> Grandma is 86 and remembers everything. She just can't tell which memory you need.
> You have until her teacup is empty.

**▶ Play it in your browser: https://grandmas-wifi-password.fly.dev** (desktop or phone, no install; the first load after a quiet spell takes a few seconds while the server wakes up)

A conversational needle-in-a-haystack puzzle game. Grandma, powered by an LLM, is the haystack. The password is the needle. You talk to her in your own words, look around her 3D living room for evidence, and work the answer out from what she says and what you find.

This is the final project for **CPSC 1710: Introduction to AI Applications** (Yale, Fall 2026), and a possible future Steam release.

**How the AI is used.** The model only *words* Grandma's replies. Her facts, the puzzles, the tea economy and every rule live in hand-written data and server code. The password is never in her prompt, and each reply is checked before the player sees it. On 736 test turns per model across all 8 notes, 256 of them attacks (prompt injection, role-play, "repeat your instructions"…), no reply gave away the password ([model choice and results](docs/13-model-choice.md)).

## Why this project
- **"Needle in a Haystack"** is the classic long-context retrieval benchmark for LLMs. We flip it: *the human takes the test and the AI is the haystack.* Then we let an AI agent take the same test.
- It was inspired by the 2026 viral hit *Find The Needle* and other "boring-but-viral" games. See [`docs/research/`](docs/research/).

## AI techniques
| Technique | Where |
|---|---|
| Procedural world generation (seeded code + LLM enrichment with structured outputs) | `packages/worldgen` |
| Grounded NPC dialogue over a fact graph (full-context vs. retrieval, compared) | `packages/engine`, `apps/server` |
| Guardrails: information hiding (Grandma doesn't know the password), reply validation, moderation | `packages/engine` |
| Voice conversation: she speaks her lines (browser speech synthesis, prosody by mood) and the player can ask out loud (browser speech recognition); and when the recognizer is unsure, Grandma may mishear one word from a pun table (a capped, fair rule in code) | `apps/web/src/voice.ts`, `packages/engine/src/mishear.ts` |
| LLM-as-judge (calibrated against human labels) and an AI player agent | `eval/` |

## Docs
| Doc | What it covers |
|---|---|
| [Game design](docs/01-game-design.md) | Pillars, core loop, stamina, items, modes, tone rules, UI |
| [Technical design](docs/02-technical-design.md) | Architecture, data model, API, turn pipeline, worldgen, fairness checks |
| [Roadmap](docs/03-roadmap.md) | Milestones M0–M5, task checklist, roles, risks, Steam plan |
| [Evaluation plan](docs/04-evaluation-plan.md) | Datasets, metrics, judge calibration, ablations, playtests, human vs. AI study |
| [Playtest review](docs/05-playtest-review.md) | Bugs, design problems and the improvement plan from the 2026-11-12 build |
| [Godot port and re-score](docs/12-godot-port.md) | Iteration 54: the topic cards, house, materials, camera views and title brought over from the Godot edition, and the re-score against it |
| [Skill-based review and plan](docs/06-skill-review-and-plan.md) | Second review with the project skill: scorecard, floors, findings, a 7-phase plan with exit checks |
| [Dev skill](.claude/skills/llm-deduction-game-dev/SKILL.md) | Our Claude Code skill for designing, building, reviewing and playtesting this game |
| [Market research](docs/research/market-research.md) | Find The Needle case study, comparable games, Steam AI policy |
| [Idea shortlist](docs/research/game-ideas.md) | The four candidate concepts and why we picked this one |
| [Paper prototype kit](prototype/paper-prototype.md) | Test the loop with no code (M0) |
| [Credits](CREDITS.md) | Every third-party asset, its source and license |

## Repository layout
```
apps/web/            client: React + Vite + TypeScript + React Three Fiber (the 3D house, camera views, topic cards)
apps/web/public/models/  the house and Grandma (from the Godot edition), plus CC0 models (KayKit, Kenney, Quaternius); see CREDITS.md
apps/server/         API server: Hono + TypeScript; owns the rules, the API key and the secret world data
packages/engine/     shared rules, schemas, validator, prompts, offline mock Grandma, API contract
packages/worldgen/   world generation CLI (planned)
eval/                evaluation: question bank, red-team set, runner, rule metrics, reports (LLM judge and AI player next)
data/schema/         JSON Schema for a Grandma world
data/grandmas/       worlds; rosie.json is a hand-written sample (3 recipes)
data/scenes/         room layouts and clue objects (engine-neutral JSON)
data/i18n/           player-facing strings
prototype/           paper prototype kit and quick scripts
tools/               asset import script
docs/                design docs and research
```

## Status
**Live since 2026-11-18** at https://grandmas-wifi-password.fly.dev.

The game has:
- 8 sticky notes on three difficulties;
- a guided tutorial;
- Grandma on Claude Haiku 5.5 through OpenRouter, with an offline Grandma as the fallback;
- original waltz music;
- keyboard, mouse, touch and accessibility settings.

What's next: a silent playtest with new players, and calibrating the LLM judge against human labels. See the [roadmap](docs/03-roadmap.md) and the [implementation log](docs/07-implementation-audit.md).

## Getting started
Requirements: Node 22.13+ (we use 24) and npm.

```bash
npm install
npm run dev        # API server on :8787 and the web client on :5173
```

Open http://localhost:5173. Pick a sticky note, then:
- **Ask:** tap a topic card and press *Tell me about it* or *When was that?*, or type any question in your own words. Names Grandma mentions become new cards.
- **Look around:** the view tabs (or keys 1–7) move the camera; drag to look a little further; tap sparkling things to look closer, then *Show Grandma*.
- **Keys:** N note · J notebook · R router · H things in the room · Enter talk · V ask out loud · Tab moves between buttons · Esc backs out one layer.

It works with a mouse, a trackpad or a touch screen, and on phones. Settings has Low / Medium / High graphics (the game lowers them itself if the frame rate stays low).

**Grandma's brain**
- **Mock mode (no key):** a keyword matcher that answers from her facts. Good for building the room, UI and controls. `npm run dev:mock` forces it even when a key is set.
- **LLM mode:** copy `.env.example` to `.env` and set `OPENROUTER_API_KEY` (the course key; an Anthropic key works too). Grandma then runs on Claude Haiku 5.5; `GRANDMA_MODEL` picks another model, and `docs/13-model-choice.md` says why this one. **Never commit `.env`.**
- Only the key in this repo's `.env` is used. A key that other tools put in your shell environment is ignored on purpose, so the game never spends money on the wrong account. (For a deployment, set `GRANDMA_MODE=llm` plus the key as a secret.)

**Grandma's voice**
- **Without setup:** she speaks with the player's browser voice (Settings: Spoken / Babble blips / Silent).
- **Her own voice (ElevenLabs):**
  1. Make an ElevenLabs account and API key.
  2. Put `ELEVENLABS_API_KEY=...` in `.env`.
  3. Design her voice:
     - **Free plan:** on the ElevenLabs website, open Voices > Voice Design, paste the description and sample text from `tools/design-grandma-voice.mjs`, save the preview you like, and copy its voice ID.
     - **Paid plan:** run `node tools/design-grandma-voice.mjs` (three previews into `var/voice-design/`), listen, then run `--save <id>`.
  4. Put `ELEVENLABS_VOICE_ID=...` in `.env` and restart.
- **API key permissions:** Text to Speech; for the design script also Voice Generation and Voices (write).
- **Account plan:** speaking with your own designed voice through the API works on the free plan (checked 2026-11-17). Creating a voice through the API, and using Voice Library voices through the API, need a paid plan.
- **Cost guard:** she only voices lines she actually said in that visit. Each line is cached in `var/voice/`. `VOICE_DAILY_CHARS` (default 3,000 a day) caps new speech. Past the cap, or if ElevenLabs fails, the browser voice takes over.
- **Privacy:** only Grandma's lines go to ElevenLabs, never what the player typed.
- **Port clash:** if another program holds port 8787, set `API_PORT` in `.env`; the dev proxy follows it. The server warns at startup when this happens.

**Other scripts**
| Command | What it does |
|---|---|
| `npm test` | Engine and API tests (Vitest) |
| `npm run typecheck` | TypeScript checks for all packages |
| `npm run validate` | Checks every world, scene and string file under `data/` |
| `npm run chat` | Play in the terminal (`/show photo_album`, `/cookie`, `/guess ...`, `/objects`) |
| `npm run eval` | Evaluation: question bank and red-team set through Grandma, metrics report in `eval/reports/` (see `eval/README.md`) |
| `npm run schema` | Exports the API contract and scene format as JSON Schema to `data/schema/` |
| `npm run build` then `npm start` | Production: the server also serves the built client on :8787 |

**Deploying (Fly.io; live since 2026-11-18):**
- **Setup:** the steps are at the top of `fly.toml`: create the app and a volume, set `OPENROUTER_API_KEY` and `GRANDMA_MODE=llm` as Fly secrets, then `fly deploy --ha=false`. The image is built on Fly's remote builder, so no local Docker is needed.
- **The key:** it never goes into the image (`.dockerignore` keeps `.env` and `var/` out). Give the live site an OpenRouter key with a spending limit; the daily budget below is a second guard.
- **One machine only:** `fly scale show` should say 1. Rate limits and the daily budget live in the server process, so a second machine would double them.
- **Updating:** `fly deploy --ha=false` from this folder.
- **itch.io embed:** set `EMBED_ORIGINS="https://itch.io https://*.itch.zone"`.
- **Demo materials:** the demo script, store-page draft and launch checklist are in `docs/09-demo-and-launch-kit.md`.

**Cost guard:** the real Grandma stops for the day once today's model spend reaches `GRANDMA_DAILY_BUDGET_USD` (default $5, UTC day, counted from the turn logs so restarts don't reset it). Creating the file `var/KILL` (`/data/KILL` on Fly) switches her off at once, without a redeploy. Either way players keep playing with the offline Grandma, and the title screen says why. The server prints today's spend at startup; per-turn cost is in `var/logs/turns-*.jsonl`, and `npm run stats` sums it up with latency, retries and solve rates (aggregates only).

Notes: the server reads `data/` at startup, so restart `npm run dev` after editing a world or scene. Runs and turn logs go to `var/` (git-ignored).

## Team
| Role | Member |
|---|---|
| AI / backend | _TBD_ |
| Evaluation | _TBD_ |
| Frontend / gameplay | _TBD_ |
| Art / writing / marketing | _TBD_ |

## License
All rights reserved, for now. This is a course project with possible commercial release; we'll choose a license later.

---
*Design docs drafted with Claude Code (Claude Opus 5.5) under Jacky Yao's direction; to be reviewed and revised by the team.*
