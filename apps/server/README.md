# apps/server

API server (Hono on Node). It owns every game rule and the secret world data, holds the API key, and runs Grandma's turn pipeline (technical design §4–5).

- `src/app.ts`: HTTP routes (`/api/runs`, `/ask`, `/show`, `/item`, `/guess`, `/scenes/:id`, `/health`)
- `src/grandma.ts`: Grandma's brain: `LlmBrain` (Claude Haiku 5.5, structured output) or `MockBrain`, both behind the reply validator with one retry and a fallback line
- `src/store.ts`: runs in memory + SQLite snapshots (`node:sqlite`) + JSONL turn logs in `var/`
- `src/config.ts`: settings; only the key in the repo's `.env` is used
- `scripts/chat.ts`: terminal client (`npm run chat`)
- `test/`: contract tests (no password or fact ids ever reach the client)
