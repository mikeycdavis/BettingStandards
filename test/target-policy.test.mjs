/**
 * `validate <target>` must judge the target against the TARGET's betting policy.
 *
 * The defect these tests were written against: `gatherEvidence` called `checkDecisions({ dir })` with
 * no `policyPath`, and `checkDecisions` defaults that to `<this pack>/betting-policy.yml`. So
 * `validate` read the target's `project-policy.yml` and the target's `betting-policy.yml` — and then
 * evaluated the target's decision records against THIS repository's thresholds. Measured before the
 * fix: a target declaring `minEdge: "0.90"` whose records carry an adjusted edge of 0.040463 returned
 * COMPLIANT, exit 0, `denominator.scored: 25`. It cleared every gate a consumer could check.
 *
 * ADR 0008 records where the question came from and why it was settled by running the tool rather
 * than by reading it. This file is that determination, kept executable.
 *
 * The property under test is stronger than "the argument is threaded", because threading one
 * argument fixes one specimen while another threshold keeps leaking:
 *
 *   > For an external target, changing THIS pack's own betting-policy.yml must never change that
 *   > target's findings or verdict. Changing the target's betting-policy.yml must.
 *
 * Both halves are load-bearing. The first alone is satisfied by an evaluator that reads no policy at
 * all; the second alone is satisfied by the defect itself, since the target's policy still drives
 * `policyFindings`.
 *
 * FIXTURES LIVE IN TEMPORARY DIRECTORIES, NEVER IN THE REPOSITORY. These tests must mutate a betting
 * policy to observe anything, and `node --test` runs test files in parallel processes — mutating the
 * real `betting-policy.yml` would be the shared-fixture race of ADR 0007 with a worse blast radius,
 * since `check.test.mjs` reads that exact file. The pack under test is therefore a copy of the tree,
 * which is a complete subject: every script resolves its root from its own location.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The evaluator under test: a private copy, so its policy can be perturbed without touching the tree. */
const PACK = mkdtempSync(path.join(os.tmpdir(), "bs-pack-"));
cpSync(ROOT, PACK, {
  recursive: true,
  filter: (src) => !/[\\/](\.git|node_modules)$/.test(src) && !/[\\/]artifacts[\\/]local-ci$/.test(src),
});

const TEMPORARY = [PACK];
process.on("exit", () => {
  for (const dir of TEMPORARY) rmSync(dir, { recursive: true, force: true });
});

const PACK_POLICY = path.join(PACK, "betting-policy.yml");
const PACK_POLICY_AS_COMMITTED = readFileSync(PACK_POLICY, "utf8");

/**
 * Set one field of a betting policy in place, and prove the field was there to set. The assertion is
 * on the field being FOUND rather than on the text changing: setting a threshold to the value it
 * already holds is a legitimate no-op here, and a diff-based guard would fail on it while missing the
 * case that matters — a renamed field, where the fixture would silently stop perturbing anything and
 * every independence assertion would pass for the wrong reason.
 */
function setThreshold(file, field, value) {
  const before = readFileSync(file, "utf8");
  const pattern = new RegExp(`^${field}: ".*"$`, "m");
  assert.match(before, pattern, `${field} is not declared in ${file}; the fixture would perturb nothing`);
  writeFileSync(file, before.replace(pattern, `${field}: "${value}"`), "utf8");
}

/**
 * An adopting project, outside both this repository and the pack copy: a ledger of the worked
 * examples, its own two policy files, and the one document `validate` looks for.
 */
function makeTarget(minEdge) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bs-target-"));
  TEMPORARY.push(dir);
  mkdirSync(path.join(dir, "ledger"));
  mkdirSync(path.join(dir, "standards"));
  cpSync(path.join(ROOT, "examples/ledger"), path.join(dir, "ledger"), { recursive: true });
  cpSync(path.join(ROOT, "templates/project-policy.yml"), path.join(dir, "project-policy.yml"));
  cpSync(path.join(ROOT, "betting-policy.yml"), path.join(dir, "betting-policy.yml"));
  cpSync(
    path.join(ROOT, "standards/19-evaluation-of-the-betting-process.md"),
    path.join(dir, "standards/19-evaluation-of-the-betting-process.md"),
  );
  setThreshold(path.join(dir, "betting-policy.yml"), "minEdge", minEdge);
  return dir;
}

/** Run the copy's validate against a target. Never throws: the exit code is under test. */
async function validate(target) {
  try {
    const { stdout } = await run(process.execPath, [path.join(PACK, "scripts/standards.mjs"), "validate", target, "--json"]);
    return { code: 0, report: JSON.parse(stdout) };
  } catch (error) {
    return { code: error.code, report: JSON.parse(error.stdout) };
  }
}

/**
 * Everything about a verdict that a policy could move, with the timestamp dropped — `auditedAt` is
 * today's date and would make an identity assertion fail across a midnight boundary rather than
 * because something leaked.
 */
function comparable(report) {
  return {
    status: report.status,
    score: report.score,
    summary: report.summary,
    denominator: report.denominator,
    results: (report.results ?? []).map((r) => [r.ruleId, r.status, r.message]),
  };
}

test("the target's own threshold decides its verdict", async () => {
  // Row 1 of the measured table: a target whose records violate its OWN declared minimum must fail,
  // whatever this pack's number is. Before the fix this returned COMPLIANT with scored: 25.
  const strict = makeTarget("0.90");
  const { code, report } = await validate(strict);

  assert.equal(report.status, "NON_COMPLIANT", `expected the target's 0.90 minimum to bite; got ${report.status}`);
  assert.equal(code, 1);
  const failed = report.results.filter((r) => r.status === "failed").map((r) => r.ruleId);
  assert.ok(
    failed.includes("edge.threshold-respected"),
    `expected edge.threshold-respected among the failures; got ${JSON.stringify(failed)}`,
  );
});

test("a target that satisfies its own threshold passes, whatever this pack declares", async () => {
  // Row 2: the same records, the same evaluator, an ordinary target threshold — and this pack's own
  // policy set to a value that would fail them if it were the one being applied.
  const ordinary = makeTarget("0.02");
  setThreshold(PACK_POLICY, "minEdge", "0.90");
  try {
    const { code, report } = await validate(ordinary);
    assert.equal(report.status, "COMPLIANT", `this pack's 0.90 leaked into the target's verdict: ${report.status}`);
    assert.equal(code, 0);
  } finally {
    writeFileSync(PACK_POLICY, PACK_POLICY_AS_COMMITTED, "utf8");
  }
});

test("no threshold in this pack's policy can move an external target's result", async () => {
  // The independence property, and the reason it perturbs six fields rather than the one specimen
  // that was measured: threading `policyPath` into one call site fixes `minEdge` while any other
  // threshold read from a second unthreaded call site keeps leaking, and the suite would be green.
  //
  // Every value below is schema-valid and extreme enough to change a verdict if it were consulted —
  // a one-minute price expiry, a cap of one millionth of bankroll, a longshot floor that catches
  // every price. If the target's result is identical across all of them, this pack's policy is not
  // being read.
  const target = makeTarget("0.02");
  const baseline = comparable((await validate(target)).report);

  const perturbations = [
    ["minEdge", "0.9"],
    ["maxSingleBetPct", "0.000001"],
    ["maxTotalExposurePct", "0.000001"],
    ["maxGroupExposurePct", "0.000001"],
    ["maxOddsAgeMinutes", "1"],
    ["longshotOddsThreshold", "1"],
  ];

  try {
    for (const [field, value] of perturbations) {
      writeFileSync(PACK_POLICY, PACK_POLICY_AS_COMMITTED, "utf8");
      setThreshold(PACK_POLICY, field, value);
      const after = comparable((await validate(target)).report);
      assert.deepEqual(
        after,
        baseline,
        `setting this pack's ${field} to ${value} changed an external target's result, so the target ` +
          "is being judged against a policy it does not own",
      );
    }
  } finally {
    writeFileSync(PACK_POLICY, PACK_POLICY_AS_COMMITTED, "utf8");
  }
});

test("a target with no betting policy is not judged against this pack's", async () => {
  // The absent-policy case, which the defect hid completely: with no betting-policy.yml in the
  // target, `checkDecisions` still loaded this pack's and evaluated the records against it. The
  // honest result is that the threshold rules were not evaluated — there is no policy that governs
  // them — and the four missing-policy findings say so. Perturbing this pack's numbers must not move
  // that, because a target with no policy is exactly where a fallback is most tempting.
  const target = makeTarget("0.02");
  rmSync(path.join(target, "betting-policy.yml"));

  const baseline = comparable((await validate(target)).report);
  assert.notEqual(baseline.status, "COMPLIANT", "a target with no betting policy cannot be compliant");
  assert.ok(
    baseline.results.some((r) => r[0] === "edge.minimum-threshold-defined" && r[1] === "failed"),
    "the missing betting policy should fail the rules that require it",
  );

  try {
    setThreshold(PACK_POLICY, "minEdge", "0.9");
    assert.deepEqual(
      comparable((await validate(target)).report),
      baseline,
      "this pack's policy was consulted for a target that declares none",
    );
  } finally {
    writeFileSync(PACK_POLICY, PACK_POLICY_AS_COMMITTED, "utf8");
  }
});

/** The other command that is handed a target and re-derives its records. */
async function check(target) {
  try {
    const { stdout } = await run(process.execPath, [path.join(PACK, "scripts/standards.mjs"), "check", target, "--json"]);
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.code, stdout: error.stdout, stderr: error.stderr };
  }
}

test("`check` re-derives a target's records against the target's policy", async () => {
  // `validate` was the command measured, but it is not the only one handed someone else's ledger.
  // `check` reached the same defaulted policy by a different route, and fixing only the command in
  // the adapter contract would have left a shipped command judging other people's decisions against
  // this pack's numbers.
  const target = makeTarget("0.02");
  const baseline = await check(target);

  try {
    setThreshold(PACK_POLICY, "minEdge", "0.9");
    const after = await check(target);
    assert.equal(after.stdout, baseline.stdout, "this pack's minEdge moved `check`'s findings for an external target");
    assert.equal(after.code, baseline.code);
  } finally {
    writeFileSync(PACK_POLICY, PACK_POLICY_AS_COMMITTED, "utf8");
  }
});

test("`check` refuses a target that declares no policy rather than lending it this pack's", async () => {
  const target = makeTarget("0.02");
  rmSync(path.join(target, "betting-policy.yml"));

  const { code, stderr } = await check(target);
  assert.equal(code, 2, "an undeclared policy is an invocation problem, not a statement about any record");
  assert.match(stderr, /no betting-policy\.yml/);
});

test("the fixtures are outside the repository", () => {
  // The guard on the guard. These tests mutate a betting policy; if PACK ever resolved to the real
  // tree, they would corrupt it under whatever else is reading it in parallel.
  for (const dir of TEMPORARY) {
    assert.notEqual(path.resolve(dir), path.resolve(ROOT));
    assert.ok(
      !path.resolve(dir).startsWith(path.resolve(ROOT) + path.sep),
      `${dir} is inside the repository; fixtures must be planted outside it`,
    );
  }
});
