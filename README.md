# 👵🔑 Grandma's Wi‑Fi Password *(working title)*

> Grandma's Wi‑Fi password is on a sticky note that only says *"first dog's name + the year I married Grandpa."*
> Grandma is 87 and remembers everything. She just can't tell which memory you need.
> You have until her teacup is empty.

A conversational needle-in-a-haystack puzzle game. Grandma, powered by an LLM, is the haystack. The password is the needle.

This is the final project for **CPSC 1710: Introduction to AI Applications** (Yale, Fall 2026), and a possible future Steam release.

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
| [Skill-based review and plan](docs/06-skill-review-and-plan.md) | Second review with the project skill: scorecard, floors, findings, a 7-phase plan with exit checks |
| [Dev skill](.claude/skills/llm-deduction-game-dev/SKILL.md) | Our Claude Code skill for designing, building, reviewing and playtesting this game |
| [Market research](docs/research/market-research.md) | Find The Needle case study, comparable games, Steam AI policy |
| [Idea shortlist](docs/research/game-ideas.md) | The four candidate concepts and why we picked this one |
| [Paper prototype kit](prototype/paper-prototype.md) | Test the loop with no code (M0) |
| [Credits](CREDITS.md) | Every third-party asset, its source and license |

## Repository layout
```
apps/web/            client: React + Vite + TypeScript + React Three Fiber (first-person 3D room)
apps/web/public/models/  CC0 3D models (KayKit, Kenney, Quaternius); see CREDITS.md
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
**M0 (through 11/19):** proposal, paper prototype, and a first Haiku script prototype. The code skeleton is in: a furnished 3D living room you can walk around (CC0 furniture, a dressed-up seated Grandma, props made in code), a server that owns the rules, and Grandma in mock or Haiku mode. See the [roadmap](docs/03-roadmap.md).

## Getting started
Requirements: Node 22.13+ (we use 24) and npm.

```bash
npm install
npm run dev        # API server on :8787 and the web client on :5173
```

Open http://localhost:5173. Click to look around, WASD to walk, E to interact, Enter to talk to Grandma, Esc to back out (card → talk → mouse). Take a clue or a cookie to Grandma and press E on her to show or give it; Q puts it back.

**Grandma's brain**
- **Mock mode (no key):** a keyword matcher that answers from her facts. Good for building the room, UI and controls. `npm run dev:mock` forces it even when a key is set.
- **LLM mode:** copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY` (use the course key). Grandma then runs on Claude Haiku 5.5. **Never commit `.env`.**
- Only the key in this repo's `.env` is used. A key that other tools put in your shell environment is ignored on purpose, so the game never spends money on the wrong account. (For a deployment, set `GRANDMA_MODE=llm` plus the key as a secret.)

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

**Deploying (Fly.io, not done yet):** `Dockerfile` and `fly.toml` are ready. The steps are at the top of `fly.toml`: create the app and a volume, set `ANTHROPIC_API_KEY` and `GRANDMA_MODE=llm` as Fly secrets, then `fly deploy`. The key never goes into the image.

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
