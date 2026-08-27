/**
 * The decision checker owns the set of rules its execution establishes.
 *
 * WHAT WENT WRONG. `gatherEvidence` needed to know which rules lose their evidence when decision
 * evaluation does not run, and it answered by matching rule-id prefixes — `record.`, `decision.`,
 * `odds.`, `edge.computed`, and a handful more — maintained by hand in `standards.mjs`, one module
 * away from the checker that actually produces the findings.
 *
 * That approximation was survivable only while the single way to reach zero checked records was an
 * absent or empty ledger, where nothing was there to mislead anyone. Binding the target's betting
 * policy (ADR 0008) created a second, legitimate route: a target with a full ledger and no
 * `betting-policy.yml` skips the checker entirely. Measured on a five-record ledger carrying
 * `templates/project-policy.yml`, the prefix list missed SEVEN rules — `bankroll.no-martingale`,
 * `bankroll.no-loss-driven-sizing`, `bankroll.stake-within-unit-rules`, `edge.threshold-respected`,
 * `edge.no-fabricated-edge`, `edge.no-probability-only-bets` and `exposure.no-cap-breaches` — and
 * `validate` reported all seven as `passed`, `disposition: evaluated`, two of them at full assurance
 * and five at partial, from a ledger no code had opened. The same false green as the policy leak,
 * through a different door.
 *
 * The first reproduction found three, because it used the pack's OWN `project-policy.yml`, which
 * declares the four `bankroll.*` and `exposure.*` rules not-applicable. That fixture measured the
 * pack against its own exemptions rather than against what an adopter gets from `standards init`.
 * ADR 0008 records the correction; the fixture below uses the template for that reason.
 *
 * THE PROPERTY.
 *
 *   > If decision-record evaluation does not execute successfully, no rule whose evidence that
 *   > evaluator supplies may remain `passed` or `evaluated` on the strength of default state. The
 *   > evaluator itself owns the exact set of rules whose dispositions it can establish.
 *
 * WHY A MUTATION TEST IS PART OF THE ACCEPTANCE. A regression built from one fixture proves only
 * that the three rules that fixture happened to expose are covered. The mutation below removes one
 * rule from the checker's declared set and requires the regression to go red, which is what
 * distinguishes "the mechanism is load-bearing" from "the list currently happens to be long enough".
 *
 * Fixtures live in temporary directories and the evaluator under test is a copy of the tree, for the
 * reason given at the head of target-policy.test.mjs: these tests mutate an evaluator, and
 * `node --test` runs files in parallel.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { SUPPLIED_RULES, FINDING_RULES, checkDecisions, checkOwnExamples } from "../scripts/decisions.mjs";
import { EVALUATED_RULES } from "../scripts/standards.mjs";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPORARY = [];
process.on("exit", () => {
  for (const dir of TEMPORARY) rmSync(dir, { recursive: true, force: true });
});

function copyPack() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bs-pack-"));
  TEMPORARY.push(dir);
  cpSync(ROOT, dir, {
    recursive: true,
    filter: (src) => !/[\\/](\.git|node_modules)$/.test(src) && !/[\\/]artifacts[\\/]local-ci$/.test(src),
  });
  return dir;
}

/**
 * The specimen: a project that adopted the pack, recorded decisions, and never declared its
 * thresholds. The ledger is real and full; the betting policy is the one thing missing.
 */
function makeTargetWithoutBettingPolicy() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bs-nopolicy-"));
  TEMPORARY.push(dir);
  mkdirSync(path.join(dir, "ledger"));
  mkdirSync(path.join(dir, "standards"));
  cpSync(path.join(ROOT, "examples/ledger"), path.join(dir, "ledger"), { recursive: true });
  cpSync(path.join(ROOT, "templates/project-policy.yml"), path.join(dir, "project-policy.yml"));
  cpSync(
    path.join(ROOT, "standards/19-evaluation-of-the-betting-process.md"),
    path.join(dir, "standards/19-evaluation-of-the-betting-process.md"),
  );
  const records = readdirSync(path.join(dir, "ledger")).filter((f) => f.endsWith(".json"));
  assert.ok(records.length > 0, "the fixture must carry records, or it proves nothing about skipping them");
  return { dir, records: records.length };
}

async function validate(pack, target) {
  try {
    const { stdout } = await run(process.execPath, [path.join(pack, "scripts/standards.mjs"), "validate", target, "--json"]);
    return { code: 0, report: JSON.parse(stdout) };
  } catch (error) {
    return { code: error.code, report: JSON.parse(error.stdout) };
  }
}

const GREEN = new Set(["COMPLIANT", "COMPLIANT_WITH_EXCEPTIONS"]);

test("a ledger the checker never opened leaves every rule the checker supplies unevaluated", async () => {
  const pack = copyPack();
  const { dir, records } = makeTargetWithoutBettingPolicy();
  const { code, report } = await validate(pack, dir);

  assert.ok(!GREEN.has(report.status), `a target with undeclared thresholds must not be green, got ${report.status}`);
  assert.notEqual(code, 0, "and must not exit 0");

  const claimed = report.results.filter(
    (r) => SUPPLIED_RULES.includes(r.ruleId) && (r.status === "passed" || r.disposition === "evaluated"),
  );
  assert.deepEqual(
    claimed.map((r) => `${r.ruleId} ${r.status}/${r.disposition}/${r.assurance}`),
    [],
    `these rules were claimed from ${records} records that were never loaded`,
  );
});

test("removing one rule from the checker's declared set makes that regression fail", async () => {
  // The seam under test. If the outer evaluator were still trimming by its own prefix list, or by a
  // second copy of this set, deleting an entry here would change nothing and this test would pass —
  // which is precisely the failure it exists to detect.
  const victim = "record.decision-record-required";
  assert.ok(SUPPLIED_RULES.includes(victim), `${victim} must be in the declared set for the mutation to mean anything`);

  const pack = copyPack();
  const file = path.join(pack, "scripts/decisions.mjs");
  const before = readFileSync(file, "utf8");
  const line = new RegExp(`^ *"${victim}",\\r?\\n`, "m");
  assert.match(before, line, "the declared set must list one rule per line for this mutation to be surgical");
  writeFileSync(file, before.replace(line, ""), "utf8");

  const { dir } = makeTargetWithoutBettingPolicy();
  const { report } = await validate(pack, dir);
  const mutated = report.results.find((r) => r.ruleId === victim);
  assert.ok(
    mutated.status === "passed" || mutated.disposition === "evaluated",
    "with the rule removed from the checker's declaration the false green must return; " +
      `it did not, so the outer evaluator is not reading that declaration (got ${mutated?.status}/${mutated?.disposition})`,
  );
});

test("the checker reports the set it supplied alongside the findings it produced", async () => {
  const result = await checkOwnExamples();
  assert.ok(result.records > 0, "the self-checkout must actually read this repository's examples");
  assert.deepEqual(
    [...result.suppliedRules].sort(),
    [...SUPPLIED_RULES].sort(),
    "a run must report the same ownership the module declares",
  );
});

test("the checker refuses to judge records without being told which policy judges them", async () => {
  // The residual seam from ADR 0008. `parseArgs` refuses `--dir`/`--record` without `--policy`, but
  // a default on this function would leave the same mistake one direct call away for any caller that
  // never goes through the CLI. The self-checkout convenience is a separate, named door.
  await assert.rejects(
    () => checkDecisions({ dir: path.join(ROOT, "examples/ledger") }),
    /requires policyPath/,
    "a checker that will silently supply the numbers is not a general checker",
  );
});

test("every rule the checker can produce a finding for is one it declares it supplies", () => {
  // The drift guard on the declaration itself: adding a finding bound to a rule outside the set
  // would make that rule silently survive a skipped run.
  const supplied = new Set(SUPPLIED_RULES);
  const undeclared = [...new Set(Object.values(FINDING_RULES))].filter((r) => !supplied.has(r)).sort();
  assert.deepEqual(undeclared, [], "these rules carry findings from the checker but are not declared supplied");
});

test("the supplied set and the policy-established rules partition what validate claims to evaluate", () => {
  // Neither side may grow a rule the other does not know about. A rule in EVALUATED_RULES that
  // belongs to neither source is a rule nothing establishes, which would pass by default forever.
  const supplied = new Set(SUPPLIED_RULES);
  const POLICY_ESTABLISHED = [
    "edge.minimum-threshold-defined",
    "bankroll.defined-in-policy",
    "bankroll.unit-defined",
    "exposure.caps-defined",
    "decision.no-bet-quota",
    "evaluation.process-metrics-defined",
  ];
  assert.deepEqual(
    SUPPLIED_RULES.filter((r) => !EVALUATED_RULES.includes(r)),
    [],
    "the checker declares rules validate does not claim to evaluate",
  );
  assert.deepEqual(
    EVALUATED_RULES.filter((r) => !supplied.has(r) && !POLICY_ESTABLISHED.includes(r)),
    [],
    "these rules are claimed as evaluated but no source establishes them",
  );
  assert.deepEqual(
    POLICY_ESTABLISHED.filter((r) => supplied.has(r)),
    [],
    "a rule established from the policy must not also be claimed by the record checker",
  );
});
