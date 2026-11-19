// Playtest gate: a pull request that changes the game can't merge until a person has played it.
//
// The PR description must carry one line:
//   Playtest: done — <device, how long, what you saw>     a person played this branch
//   Playtest: n/a — <why>                                 only allowed when no game file changed
//   Playtest: needs-playtest                              blocks the merge until someone plays it
//
// Game files are the paths matched by GAMEPLAY_PATHS (a regex, set per repo in the workflow), minus
// NON_GAMEPLAY_PATHS (tests). A PR may not change .github/ and game files together, so the gate can't be
// loosened in the same PR it would block.
//
// Run by .github/workflows/playtest-gate.yml on every PR open, edit and push. Tested by playtest-gate.test.mjs.

import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const MIN_DONE_DETAIL = 15;
const MIN_NA_REASON = 5;

/** The Playtest line's value, ignoring HTML comments (the PR template keeps its instructions in one). */
export function playtestValue(body) {
  const text = String(body ?? "").replace(/<!--[\s\S]*?-->/g, "");
  const m = /^[ \t>*_-]*Playtest\**\s*:[\s*_]*(.*)$/im.exec(text);
  return m ? m[1].trim() : null;
}

const detail = (value, word) =>
  value
    .slice(word.length)
    .replace(/^[\s:—–\-,.]+/, "")
    .trim();

/**
 * Decide the gate. Pure: no network, no environment.
 * @returns {{ ok: boolean, message: string }}
 */
export function evaluate({ body, files, gameplay, nonGameplay }) {
  const isGame = (f) => gameplay.test(f) && !(nonGameplay && nonGameplay.test(f));
  const gameFiles = files.filter(isGame);
  const gateFiles = files.filter((f) => f.startsWith(".github/"));
  const list = (fs) => fs.slice(0, 10).map((f) => `  - ${f}`).join("\n") + (fs.length > 10 ? `\n  - … and ${fs.length - 10} more` : "");

  if (gameFiles.length > 0 && gateFiles.length > 0) {
    return {
      ok: false,
      message: `This PR changes both .github/ and game files. Split it: CI and gate changes go in their own PR.\n.github/:\n${list(gateFiles)}\nGame files:\n${list(gameFiles)}`,
    };
  }

  const value = playtestValue(body);
  if (value === null || value === "") {
    return { ok: false, message: "No `Playtest:` line in the PR description. Add `Playtest: done — <device, how long, what you saw>`, or `Playtest: n/a — <why>` if no game file changed." };
  }
  const lower = value.toLowerCase();

  if (lower.startsWith("done")) {
    const d = detail(value, "done");
    if (d.length < MIN_DONE_DETAIL) {
      return { ok: false, message: `\`Playtest: done\` needs a note on what was played: device, how long, what you saw (at least ${MIN_DONE_DETAIL} characters). Got: "${d}"` };
    }
    return { ok: true, message: `Played by a person: ${d}` };
  }

  if (lower.startsWith("n/a")) {
    const d = detail(value, "n/a");
    if (d.length < MIN_NA_REASON) {
      return { ok: false, message: "`Playtest: n/a` needs a reason, e.g. `Playtest: n/a — docs only`." };
    }
    if (gameFiles.length > 0) {
      return {
        ok: false,
        message: `\`Playtest: n/a\` is only for PRs that don't change the game, and these files do:\n${list(gameFiles)}\nPlay the branch, then write \`Playtest: done — <device, how long, what you saw>\`.`,
      };
    }
    return { ok: true, message: `No game files changed (${files.length} files): ${d}` };
  }

  if (lower.startsWith("needs-playtest")) {
    return { ok: false, message: "Waiting for a person to play this branch. When they have, change the line to `Playtest: done — <device, how long, what you saw>`." };
  }

  return { ok: false, message: `Unrecognised \`Playtest:\` value "${value}". Use \`done — …\`, \`n/a — …\` or \`needs-playtest\`.` };
}

async function changedFiles(repo, number, token) {
  const files = [];
  for (let page = 1; page <= 30; page++) {
    const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${number}/files?per_page=100&page=${page}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status} listing PR files: ${await res.text()}`);
    const batch = await res.json();
    for (const f of batch) {
      files.push(f.filename);
      if (f.previous_filename) files.push(f.previous_filename); // a rename out of the game is still a game change
    }
    if (batch.length < 100) break;
  }
  return files;
}

async function main() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const pr = event.pull_request;
  if (!pr) throw new Error("Not a pull_request event.");
  if (!process.env.GAMEPLAY_PATHS) throw new Error("GAMEPLAY_PATHS is not set in the workflow.");
  const files = await changedFiles(process.env.GITHUB_REPOSITORY, pr.number, process.env.GITHUB_TOKEN);
  const result = evaluate({
    body: pr.body,
    files,
    gameplay: new RegExp(process.env.GAMEPLAY_PATHS),
    nonGameplay: process.env.NON_GAMEPLAY_PATHS ? new RegExp(process.env.NON_GAMEPLAY_PATHS) : null,
  });
  const line = `${result.ok ? "✅ Playtest gate passed" : "❌ Playtest gate failed"}\n\n${result.message}\n`;
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, line);
  if (!result.ok) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
