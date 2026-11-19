// Self-test for the playtest gate (run first in playtest-gate.yml: a gate that silently passes everything is worse than none).
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, playtestValue } from "./playtest-gate.mjs";

const cfg = { gameplay: /^(src\/|index\.html$)/, nonGameplay: /\.test\.ts$/ };
const run = (body, files) => evaluate({ ...cfg, body, files });

test("reads the Playtest line and ignores the template's comment", () => {
  assert.equal(playtestValue("<!-- Playtest: done — example in a comment -->\nPlaytest: needs-playtest"), "needs-playtest");
  assert.equal(playtestValue("## Checks\n- **Playtest:** n/a — docs only"), "n/a — docs only");
  assert.equal(playtestValue("no line here"), null);
});

test("game change without a person playing it fails", () => {
  assert.equal(run("Playtest: needs-playtest", ["src/game/engine.ts"]).ok, false);
  assert.equal(run("", ["src/game/engine.ts"]).ok, false);
  assert.equal(run("Playtest: n/a — refactor only", ["src/game/engine.ts"]).ok, false);
  assert.equal(run("Playtest: done", ["src/game/engine.ts"]).ok, false, "done needs a note");
  assert.equal(run("Playtest: maybe later", ["src/game/engine.ts"]).ok, false);
});

test("game change played by a person passes", () => {
  const r = run("Playtest: done — Chrome on laptop, 15 min, two runs to floor 6, no issues", ["src/game/engine.ts"]);
  assert.equal(r.ok, true, r.message);
});

test("n/a passes only when no game file changed", () => {
  assert.equal(run("Playtest: n/a — docs only", ["README.md", "docs/review/a.md"]).ok, true);
  assert.equal(run("Playtest: n/a — tests only", ["src/game/maze.test.ts"]).ok, true);
  assert.equal(run("Playtest: n/a", ["README.md"]).ok, false, "n/a needs a reason");
});

test("a renamed-away game file still counts", () => {
  // changedFiles() adds previous_filename, so a move out of src/ is listed under its old path too.
  assert.equal(run("Playtest: n/a — moved", ["archive/engine.ts", "src/game/engine.ts"]).ok, false);
});

test(".github and game files can't change in one PR", () => {
  const r = run("Playtest: done — Chrome, 20 min, full run, fine", [".github/scripts/playtest-gate.mjs", "src/App.tsx"]);
  assert.equal(r.ok, false);
  assert.match(r.message, /Split it/);
  assert.equal(run("Playtest: n/a — CI only", [".github/workflows/ci.yml"]).ok, true);
});
