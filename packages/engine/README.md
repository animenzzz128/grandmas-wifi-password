# packages/engine

Shared, pure TypeScript (no Node or browser APIs), used by the server, the client and future eval tools.

- `world.ts`: zod schema for a Grandma world, password computation, cross-reference checks, hidden years for hard mode
- `scene.ts`: scene manifest schema, public (client) view, spawn and fact-link checks
- `rules.ts`: stamina costs, follow-up discount, rude/long penalties, password-request detection
- `run.ts`: run state and transitions (naps, cookies, guesses, stars)
- `api.ts`: the client/server contract (zod; exported to JSON Schema by `npm run schema`)
- `prompt.ts`: system prompt, world block and message history for the LLM Grandma
- `validator.ts`: reply checks (unknown ids, invented numbers and names, hidden years, password leaks)
- `mock.ts`: the offline keyword-matching Grandma
