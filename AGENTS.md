# AGENTS.md: Grandma's Wi-Fi Password

Short on purpose. Read this first; the design and review guide is the project skill
[`.claude/skills/llm-deduction-game-dev`](.claude/skills/llm-deduction-game-dev/SKILL.md), and the docs index is in the [README](README.md#docs).

## Run and verify

| What | Command | Notes |
|---|---|---|
| Install | `npm ci` | Node 24 (as on Fly) |
| Play locally | `npm run dev` | API on :8787, web on http://localhost:5173. `npm run dev:mock` forces the offline Grandma |
| Typecheck | `npm run typecheck` | |
| Tests | `npm test` | vitest, no key needed |
| Puzzle data | `npm run validate` | |
| Golden transcripts | `npm run eval:golden` | replays 20 saved conversations through the validator |
| Build | `npm run build` | |

CI (`.github/workflows/ci.yml`, job `check`) runs all of the above on every PR, without secrets.

## How changes land

- `main` is protected: no direct pushes. Everything goes through a PR, and `check` and `playtest-gate` must pass.
- One writer per branch. A second Claude or Codex session on this game uses its own branch and `git worktree`, never the same folder: two sessions sharing one working tree mixed uncommitted work on 2026-11-17.
- Commit each loop iteration on the branch as it finishes. Open a PR per phase, not per fifty iterations.
- Reviews and plans go in `docs/` as numbered files and are committed.
- Deploy is manual and separate from merging: `fly deploy --ha=false` (one machine; the rate limits and spend cap live in the server process). Deploy only what is on `main`.

## Playtesting a PR

- The PR description needs a `Playtest:` line (see the PR template). Rules: `.github/scripts/playtest-gate.mjs`.
  - Changes under `apps/web/src`, `apps/web/public`, `apps/server/src`, `packages/engine/src` or `data/` need `Playtest: done — <device, how long, what you saw>`.
  - `Playtest: n/a — <why>` is only accepted when none of those changed.
- **Agents write `needs-playtest` (or `n/a`). Never `done`.** Only the person who played writes it.
  - Why this is a written rule and not a check: agents and Jacky push with the same GitHub account, so the gate can't tell who edited the line.
- An agent's own browser runs (the skill's `scripts/cdp.mjs`, the preview pane) are evidence for "How it was checked", not a playtest.
  - The preview pane throttles frames: twice an agent measured 240 fps while the game stuttered on Jacky's laptop.
  - Report frame times from a normal Chrome tab and name the machine.
- To play a branch: `gh pr checkout <n> && npm ci && npm run dev`.
- Standard scenarios: `.claude/skills/llm-deduction-game-dev/references/playtest.md`.

## Spending money

- Every paid eval tool (`eval --brain llm`, `eval:judge`, `eval:player`, `eval:qgen`, `probe-reasoning`) stops at a hard cap: `--max-usd N`, else `EVAL_MAX_USD` in `.env`, else $1 (`eval/src/spend.ts`).
  - Raise it only by the amount Jacky approved, for that run.
  - `eval/test/spend.test.ts` fails if a tool builds a paid client outside the cap.
- Not capped by this: `npm run chat` (you type every turn), ElevenLabs voice generation (`tools/design-grandma-voice.mjs`, credit-limited by the account), and the live game, which has its own daily budget and kill switch (`apps/server/src/budget.ts`).
- With a direct Anthropic key (no reported price) the cap counts every call at a deliberately high rate, so it trips early; that's expected.

## Known traps

- Only the key in the repo's `.env` is used, never one from the shell. Never print or commit it.
- Puzzle facts live in `data/`; never fix a puzzle by asking the model to remember something (skill, "Working rules").
- Two tests once depended on the offline Grandma's random choices. Keep tests seeded; a test that passes "most runs" is a failing test.
