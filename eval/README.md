# eval

The evaluation pipeline from `docs/04-evaluation-plan.md`: datasets, a batch runner, rule-based metrics and Markdown reports. It runs today on the mock Grandma (free) and on Claude Haiku once the course key is in the repo's `.env`.

## Run it

```bash
npm run eval                                   # mock Grandma, validator on, all sets, all recipes
npm run eval -- --set redteam                  # just the red-team set
npm run eval -- --brain llm                    # prints how many calls it would make, then stops
npm run eval -- --brain llm --yes              # real run with Haiku (costs money; uses only .env's key)
npm run eval -- --ablate                       # the plan's ablation configs side by side, one table (mock: A0/A1; llm: A0/A1/A2)
```

Options:
- `--brain mock|llm`
- `--validate on|off`
- `--effort low|medium|high` (LLM only)
- `--set qbank|redteam|all`
- `--recipes easy,medium,hard`
- `--limit N` (first N items of each set)

- `--context full|retrieval` (LLM only): config A (every memory, cached) or B (this turn's memories)

Ablations (eval plan §5); `--ablate` runs them all:
- A0: `--validate off`
- A1: the default
- A2: `--effort medium`
- B1 / B2: `--context retrieval` at low / medium effort. This is lexical top-k plus the shown object's memories, recent memories, confusable partners and seeded distractors. It uses lexical matching rather than embeddings, so no extra service is needed.

## What's here

| Path | What |
|---|---|
| `data/rosie-qbank.v1.json` | 60 hand-written questions in the plan's 7 categories, with expected facts and confusable qualifiers |
| `data/redteam.v1.json` | 32 attacks: jailbreak, injection, role-play, extraction, social pressure, harmful, personal data |
| `src/run.ts` | Runner. Each item runs in a fresh visit on each recipe, through the same turn logic as the server (safety line, password deflection, then the brain) |
| `src/metrics.ts` | Rule metrics: invented entities, year-mismatch contradictions, hidden-year leaks, joined chain links, password/slot leaks, recall, confusable fairness, retries, fallbacks, latency, cost |
| `src/report.ts` | Writes `reports/<stamp>-<config>.md`: metric tables against the plan's targets, per-category and per-recipe breakdowns, example failures |
| `results/` | Raw turn records (JSONL), git-ignored |
| `reports/` | Generated reports (keep the ones you cite) |

Reports show 95% bootstrap intervals (1000 resamples, seeded, so reruns match) next to each rate.

## Findings so far
- **2026-11-13, mock:** the first run found Medium leaking both answers in one reply (6.7%): a single fact said "412 Maple Avenue". The fact was reworded, and `checkWorld` now rejects any fact or story that contains every slot value of a recipe. The leak rate is now 0% on both sets.
- **Mock baseline** (to compare with Haiku): recall 84%, confusable fairness 75%, follow-ups 50%. The keyword matcher ignores context, which is exactly what the LLM should add.
- **Mock ablation:** validator on and off give identical numbers. The keyword mock never invents or contradicts, so the validator has nothing to catch. Its value can only be measured with the LLM (A0 vs A1 with the key).
- **Safety:** the red-team self-harm prompt now gets a caring out-of-character reply with help resources, with no model call and no tea cost.

## LLM tools (ready; they need the course key in `.env`)
Each prints how many calls it would make and stops unless you add `--yes`. All three are tested against a fake client (`eval/test/llm-tools.test.ts`).

| Command | What it does |
|---|---|
| `npm run eval:judge -- eval/results/<run>.jsonl --yes` | **LLM judge (§3):** Claude Opus checks each reply against her full memory list for contradictions, invented details and safety. Writes `*-judged.jsonl` and a verdict report |
| `npm run eval:judge -- --export-labels eval/results/<llm run>.jsonl` | Samples 100 replies for two people to label (consistent / contradiction / invented / unsafe) |
| `npm run eval:judge -- --calibrate eval/data/labels.json eval/results/<judged>.jsonl` | Cohen's κ between judge and humans; the plan's bar is 0.7 |
| `npm run eval:player -- --runs 10 --grandma llm --yes` | **AI player (§4):** Claude Sonnet plays through the real HTTP API, seeing only what a human sees. Reports solve rate and questions-to-solve (median, IQR) per difficulty, against the plan's targets |
| `npm run eval:qgen -- --per-category 30 --yes` | **Q-bank growth (§1):** Claude Opus writes questions per category; invalid ids and near-duplicates are dropped; output is marked unreviewed for a spot-check |

Prices for Opus and Sonnet aren't in our docs, so these tools report tokens rather than dollars.

## Still to build (eval plan)
- The human vs AI comparison (§7) once playtests happen.
- **Time to first text,** once replies stream.
