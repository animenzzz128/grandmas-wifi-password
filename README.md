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
| Speech input with a "hard of hearing" mechanic | `apps/web` |
| LLM-as-judge (calibrated against human labels) and an AI player agent | `eval/` |

## Docs
| Doc | What it covers |
|---|---|
| [Game design](docs/01-game-design.md) | Pillars, core loop, stamina, items, modes, tone rules, UI |
| [Technical design](docs/02-technical-design.md) | Architecture, data model, API, turn pipeline, worldgen, fairness checks |
| [Roadmap](docs/03-roadmap.md) | Milestones M0–M5, task checklist, roles, risks, Steam plan |
| [Evaluation plan](docs/04-evaluation-plan.md) | Datasets, metrics, judge calibration, ablations, playtests, human vs. AI study |
| [Market research](docs/research/market-research.md) | Find The Needle case study, comparable games, Steam AI policy |
| [Idea shortlist](docs/research/game-ideas.md) | The four candidate concepts and why we picked this one |
| [Paper prototype kit](prototype/paper-prototype.md) | Test the loop with no code (M0) |

## Repository layout
```
apps/web/            client: React + Vite + TypeScript (planned)
apps/server/         API server: Hono + TypeScript, holds the API key and the secret world data (planned)
packages/engine/     shared rules, schemas, validator, retrieval (planned)
packages/worldgen/   world generation CLI (planned)
eval/                AI player agent, LLM judge, red-team runner, reports (planned)
data/schema/         JSON Schema for a Grandma world
data/grandmas/       worlds; rosie.json is a hand-written sample (3 recipes)
prototype/           paper prototype kit and quick scripts
docs/                design docs and research
```

## Status
**M0 (through 11/19):** proposal, paper prototype, and a first Haiku script prototype. See the [roadmap](docs/03-roadmap.md).

## Getting started (once code lands)
1. Copy `.env.example` to `.env` and add your own Anthropic API key. **Never commit `.env`.**
2. Requirements: Node 20+ and pnpm. Setup commands will be added with the first code milestone (M1).

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
