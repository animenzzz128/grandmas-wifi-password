/**
 * `npm run stats`: play stats from the server's turn logs, as Markdown. The aggregation lives in the engine
 * (packages/engine/src/playstats.ts) so the server's /admin dashboard shows the same numbers; this file reads the
 * log files.
 *
 *   npm run stats                         # all days in var/logs
 *   npm run stats -- --since 2026-11-20   # from a day on
 *   npm run stats -- --out eval/reports/playtest-1.md
 *   fly ssh console -C "npm run stats"     # on Fly (VAR_DIR=/data)
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RULES, parseLog, parseWorld, playStats, renderPlayStats } from "@gwp/engine";
import type { Difficulty, LogEntry, ParOf } from "@gwp/engine";

export { parseLog, playStats, renderPlayStats } from "@gwp/engine";
export type { DayStats, Funnel, LogEntry, ParOf, PlayStats, PuzzleStats, TierStats } from "@gwp/engine";

/** Par in use for every puzzle in a grandmas/ folder. */
export function parsFromData(dir: string): ParOf {
  const pars = new Map<string, number>();
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
      const w = parseWorld(JSON.parse(readFileSync(join(dir, f), "utf8")));
      for (const r of [...w.recipes, ...(w.retired ?? [])]) pars.set(`${w.id}/${r.id}`, r.par ?? RULES.defaultPar[r.difficulty as Difficulty]);
    }
  }
  return (key) => pars.get(key);
}

export function readLogs(dir: string, since?: string): LogEntry[] {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((f) => /^turns-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
    .filter((f) => !since || f.slice(6, 16) >= since)
    .sort();
  return files.flatMap((f) => parseLog(readFileSync(join(dir, f), "utf8")));
}

if (process.argv[1]?.endsWith("playstats.ts")) {
  const arg = (name: string) => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  // Same place the server writes: $VAR_DIR/logs (/data/logs on Fly), else ./var/logs.
  const dir = arg("--dir") ?? join(process.env.VAR_DIR ?? join(process.cwd(), "var"), "logs");
  const report = renderPlayStats(playStats(readLogs(dir, arg("--since")), parsFromData(join(process.cwd(), "data", "grandmas"))));
  const out = arg("--out");
  if (out) {
    writeFileSync(out, report);
    console.log(`wrote ${out}`);
  } else process.stdout.write(report);
}
