/**
 * The /admin play-stats page: how many people play, how far they get, which tiers they solve, what the real
 * Grandma costs. It reads the server's own turn logs (on the Fly volume), so no third-party service sees play
 * data, and it shows aggregates only: never what a player typed or what Grandma said.
 *
 * Locked with ADMIN_TOKEN (HTTP Basic auth, any user name). Without the token set, /admin doesn't exist.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { PlayStats } from "@gwp/engine";
import { percentile } from "@gwp/engine";

/** Does this Authorization header carry the token? Constant-time, whatever the lengths. */
export function adminAuthorized(header: string | undefined, token: string): boolean {
  const m = /^Basic\s+([A-Za-z0-9+/=]+)$/.exec(header ?? "");
  if (!m) return false;
  const decoded = Buffer.from(m[1]!, "base64").toString("utf8");
  const given = decoded.slice(decoded.indexOf(":") + 1);
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(given), h(token));
}

const esc = (s: string | number) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
const med = (xs: number[]) => percentile(xs, 50) ?? "—";

const STEP_LABEL: Record<string, string> = {
  note: "Read the note",
  asked: "Asked Grandma something",
  inspect: "Looked at an object",
  notebook: "Opened the notebook",
  pin: "Pinned a quote",
  guessed: "Tried the router",
  solved: "Solved it",
  share: "Copied the result",
};

function bar(value: number, max: number): string {
  const w = max ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return `<span class="track"><span class="bar" style="width:${w}%"></span></span>`;
}

function table(head: string[], rows: (string | number)[][], raw = new Set<number>()): string {
  if (!rows.length) return `<p class="dim">Nothing yet.</p>`;
  return `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c, i) => `<td>${raw.has(i) ? c : esc(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

export function renderDashboard(s: PlayStats, opts: { days: number; since: string; now: Date; goatcounter?: string }): string {
  const today = opts.now.toISOString().slice(0, 10);
  const t = s.byDay.find((d) => d.day === today);
  const solved = s.tiers.reduce((n, x) => n + x.solved, 0);
  const maxVisits = Math.max(0, ...s.byDay.map((d) => d.visits));
  const f = s.funnel;
  const cards: [string, string][] = [
    ["Visits", String(s.runs)],
    ["Solved", `${solved} (${pct(solved, s.runs)})`],
    ["Questions asked", String(s.turns)],
    ["Today", `${t?.visits ?? 0} visits · ${t?.solved ?? 0} solved`],
    ["Model spend", `$${s.model.spendUsd.toFixed(2)}`],
    ["Time to first question", f.secondsToFirstQuestion === null ? "—" : `${Math.round(f.secondsToFirstQuestion)} s`],
  ];
  const traffic = opts.goatcounter
    ? `<p>Page views, where players come from, browsers and countries: <a href="${esc(opts.goatcounter.replace(/\/count$/, ""))}">GoatCounter</a>.</p>`
    : `<p class="dim">Page views and where players come from aren't counted. Set GOATCOUNTER_CODE to turn on GoatCounter (README, "Play stats").</p>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Play stats · Grandma's Wi-Fi Password</title>
<style>
body{font:15px/1.45 system-ui,sans-serif;margin:0;background:#f6f1e7;color:#2b2420}
main{max-width:980px;margin:0 auto;padding:24px 18px 60px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 8px}
.dim{color:#7a6e64}.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin:16px 0}
.card{background:#fff;border-radius:10px;padding:12px 14px;box-shadow:0 1px 2px #0001}.card b{display:block;font-size:20px;margin-top:2px}
table{border-collapse:collapse;width:100%;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 2px #0001}
th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #eee4d6;font-variant-numeric:tabular-nums}th{background:#efe6d6;font-weight:600}
.track{display:inline-block;width:180px;max-width:40vw;height:10px;border-radius:5px;background:#efe6d6;vertical-align:middle}.bar{display:block;height:100%;border-radius:5px;background:#c8553d}
code{background:#efe6d6;padding:1px 4px;border-radius:4px}
</style></head><body><main>
<h1>Play stats</h1>
<p class="dim">Last ${esc(opts.days)} days (since ${esc(opts.since)}, UTC), from the server's turn logs. Aggregates only: no player text or Grandma replies. JSON: <code>/api/admin/stats?days=${esc(opts.days)}</code></p>
<div class="cards">${cards.map(([k, v]) => `<div class="card">${esc(k)}<b>${esc(v)}</b></div>`).join("")}</div>
${traffic}
<h2>By day</h2>
${table(
  ["Day", "Visits", "", "Solved", "Questions", "Model spend"],
  [...s.byDay].reverse().map((d) => [d.day, d.visits, bar(d.visits, maxVisits), `${d.solved} (${pct(d.solved, d.visits)})`, d.questions, `$${d.spendUsd.toFixed(3)}`]),
  new Set([2]),
)}
<h2>By difficulty</h2>
${table(
  ["Tier", "Visits", "Solved", "Median questions to solve"],
  s.tiers.map((x) => [x.tier, x.runs, `${x.solved} (${pct(x.solved, x.runs)})`, med(x.questionsToSolve)]),
)}
<h2>Play funnel</h2>
${f.visits ? table(["Step", "Visits", "", "Share"], f.steps.map((st) => [STEP_LABEL[st.step] ?? st.step, st.visits, bar(st.visits, f.visits), pct(st.visits, f.visits)]), new Set([2])) : `<p class="dim">No visits yet.</p>`}
<h2>Clues found</h2>
${table(["Object", "Visits that looked", "Share"], f.objects.map((o) => [o.objectId, o.visits, pct(o.visits, f.visits)]))}
<h2>Notes played</h2>
${table(
  ["Note", "Visits", "Solved", "Out of guesses", "Bedtime", "Unfinished", "Median questions"],
  [...s.puzzles].sort((a, b) => b.runs - a.runs).map((p) => [p.key.replace(/^[^/]+\//, ""), p.runs, p.solved, p.failed, p.bedtime, p.unfinished, med(p.questionsToSolve)]),
)}
${s.dailies.length ? `<h2>Daily Grandma</h2>${table(["#", "Visits", "Solved"], [...s.dailies].reverse().map((d) => [d.number, d.runs, `${d.solved} (${pct(d.solved, d.runs)})`]))}` : ""}
<h2>Real Grandma (model)</h2>
${
  s.model.turns
    ? table(
        ["Metric", "Value"],
        [
          ["Model turns", s.model.turns],
          ["Spend", `$${s.model.spendUsd.toFixed(4)} ($${(s.model.spendUsd / s.model.turns).toFixed(5)} a turn)`],
          ["Latency p50 / p95", `${s.model.p50 ?? "—"} ms / ${s.model.p95 ?? "—"} ms`],
          ["Validator retries", pct(s.model.retryRate * 1000, 1000)],
          ["Fallback replies", pct(s.model.fallbackRate * 1000, 1000)],
          ["Prompt-cache share", s.model.cacheShare === null ? "—" : pct(s.model.cacheShare * 1000, 1000)],
        ],
      )
    : `<p class="dim">No model turns in this period (offline Grandma only).</p>`
}
</main></body></html>`;
}
