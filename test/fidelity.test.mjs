/**
 * Tests for the source fidelity check.
 *
 * fidelity.mjs runs as a script rather than exporting a function, so these tests drive it the way CI
 * does: as a subprocess, against the real repository, with a planted defect. That is deliberate —
 * testing an extracted helper would leave the actual entry point unproven, and the entry point is
 * what CI runs.
 *
 * The planted files use numbers outside the committed series (90+) so they cannot be confused with a
 * real standard.
 *
 * THEY ARE PLANTED IN A COPY OF THE REPOSITORY, NEVER IN THE REPOSITORY. They used to be written
 * into the real `standards/` directory and removed in a `finally`, which kept the tree clean but left
 * the directory *mutable while other test files were reading it*. `node --test` runs test files in
 * parallel processes, so `baseline.test.mjs` — which walks `standards/` and reads every entry —
 * could list a fixture and then find it deleted, failing with ENOENT somewhere unrelated to what it
 * was testing. That is the intermittent CI failure recorded in ADR 0007, and it is the same mistake
 * as the shared image tag one level down: a fixed path shared between concurrent runs is a crossover,
 * and "each test cleans up after itself" does not address it.
 *
 * `fidelity.mjs` resolves its own root from its own location, so a copy of the tree is a complete and
 * independent subject. Nothing in the checker was changed to make it testable.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { writeFile, rm } from "node:fs/promises";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** A private copy of the tree, planted into and discarded. Skips history and transient output: the
 *  checker reads neither, and copying `.git` would dominate the cost of an otherwise 1 MB tree. */
const WORK = mkdtempSync(path.join(os.tmpdir(), "bs-fidelity-"));
cpSync(ROOT, WORK, {
  recursive: true,
  filter: (src) => !/[\\/](\.git|node_modules)$/.test(src)
    && !/[\\/]artifacts[\\/]local-ci$/.test(src),
});
process.on("exit", () => rmSync(WORK, { recursive: true, force: true }));

/** Run the checker against a tree. Never throws on a non-zero exit — the exit code is under test. */
async function fidelity(root = WORK) {
  try {
    const { stdout } = await run(process.execPath, [path.join(root, "scripts/fidelity.mjs"), "--json"], { cwd: root });
    return { code: 0, report: JSON.parse(stdout) };
  } catch (error) {
    return { code: error.code, report: JSON.parse(error.stdout) };
  }
}

async function withStandard(name, body, fn) {
  const file = path.join(WORK, "standards", name);
  await writeFile(file, body, "utf8");
  try {
    return await fn();
  } finally {
    await rm(file, { force: true });
  }
}

test("the repository as committed has no unverified claims", async () => {
  // The one test that must read the REAL tree — a copy would only prove the copy is sound. It is
  // read-only, so it races with nothing.
  const { code, report } = await fidelity(ROOT);
  assert.equal(code, 0, `fidelity failed on the committed tree: ${JSON.stringify(report, null, 2)}`);
  assert.equal(report.ok, true);
});

test("fixtures are planted outside the repository", () => {
  // The falsifier for the race described in this file's header. Against the previous implementation
  // WORK was ROOT and this fails outright.
  assert.notEqual(path.resolve(WORK), path.resolve(ROOT));
  assert.ok(
    !path.resolve(WORK).startsWith(path.resolve(ROOT) + path.sep),
    "fixtures are planted inside the repository, where a concurrent test file can observe them half-existing"
  );
});

test("a true verbatim claim passes", async () => {
  const body = [
    "# Standard 90 — Fixture",
    "",
    "Reproduced verbatim from the source:",
    "",
    "```text",
    "chase losses",
    "```",
    "",
  ].join("\n");
  const { code, report } = await withStandard("90-fidelity-true-claim.md", body, fidelity);
  assert.equal(code, 0, `a genuine quotation must pass: ${JSON.stringify(report.failures)}`);
  assert.ok(report.claims >= 1, "the claim should have been counted, not skipped");
});

test("a false verbatim claim is caught", async () => {
  const body = [
    "# Standard 91 — Fixture",
    "",
    "Reproduced verbatim from the source:",
    "",
    "```text",
    "chase losses only when the edge is large",
    "```",
    "",
  ].join("\n");
  const { code, report } = await withStandard("91-fidelity-false-claim.md", body, fidelity);
  assert.equal(code, 1, "an invented quotation must fail");
  const hit = report.failures.find((f) => f.file === "standards/91-fidelity-false-claim.md");
  assert.ok(hit, `expected a failure for the planted file, got ${JSON.stringify(report.failures)}`);
  assert.match(hit.diverges, /only when the edge is large/, "the report should point at the edit");
});

test("formatting added to a quotation breaks it, which is the point", async () => {
  // The failure mode this check exists for: the words are right, the rendering is not. Backticks
  // around an identifier make the text no longer what the source says.
  const body = [
    "# Standard 92 — Fixture",
    "",
    "Reproduced verbatim from the source:",
    "",
    "```text",
    "`chase losses`",
    "```",
    "",
  ].join("\n");
  const { code } = await withStandard("92-fidelity-backticks.md", body, fidelity);
  assert.equal(code, 1, "added backticks must not pass as verbatim");
});

test("authored prose making no claim is not checked", async () => {
  const body = [
    "# Standard 93 — Fixture",
    "",
    "This pack requires a minimum edge of two percent, a figure the source does not state.",
    "",
    "```text",
    "this text appears in no source and claims nothing",
    "```",
    "",
  ].join("\n");
  const { code } = await withStandard("93-fidelity-authored.md", body, fidelity);
  assert.equal(code, 0, "original writing must not be forbidden by a check about quotations");
});

test("a claim quoting the expanded brief rather than the original prompt passes", async () => {
  const body = [
    "# Standard 94 — Fixture",
    "",
    "Reproduced verbatim from the source:",
    "",
    "> It must never be forced to produce a positive recommendation.",
    "",
  ].join("\n");
  const { code, report } = await withStandard("94-fidelity-brief.md", body, fidelity);
  assert.equal(code, 0, `both briefs are sources: ${JSON.stringify(report.failures)}`);
});

test("citing an example file that does not exist is caught", async () => {
  const body = [
    "# Standard 95 — Fixture",
    "",
    "See the worked example in [a record](../examples/ledger/DEC-99999999-999.json).",
    "",
  ].join("\n");
  const { code, report } = await withStandard("95-fidelity-missing-example.md", body, fidelity);
  assert.equal(code, 1, "a cited example that does not exist must fail");
  assert.ok(
    report.missingPaths.some((m) => m.cited.includes("DEC-99999999-999.json")),
    `expected the missing path to be reported, got ${JSON.stringify(report.missingPaths)}`,
  );
});
