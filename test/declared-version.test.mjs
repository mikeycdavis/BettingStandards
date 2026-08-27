/**
 * A project may receive a verdict only from the framework version it declares.
 *
 * WHY THIS EXISTS. `schemas/project-policy.schema.json` has said this since v1.0.0, in the
 * description of the field itself:
 *
 *   > "The framework version this project is evaluated against. An unresolvable version is a
 *   > configuration error, not a compliance failure — exit 2, never a verdict."
 *
 * The implementation never did it. `validate` read `standardVersion`, echoed it into the result
 * envelope, and evaluated with whatever catalog and semantics the executing checkout happened to
 * carry. Nothing checked that the two agreed — nothing even enforced the schema's own `required` or
 * its semver `pattern`, because a target's policy is never validated against that schema.
 *
 * Measured on the 2.0.0 candidate before this fix: a target declaring `standardVersion: "1.0.0"`
 * returned COMPLIANT, score 96, coverage 41, exit 0 — and the envelope said `1.0.0`. A 2.0.0 verdict
 * wearing a v1.0.0 label.
 *
 * WHY IT HAD TO BE FIXED IN 2.0.0 RATHER THAN AFTER. Before this release the mislabel was dormant:
 * a target declaring 1.0.0 got 1.0.x semantics, so the label was accidentally true. 2.0.0 changes
 * what `validate` does to an external target, and `v1.0.0` is the only release anyone can pin — so
 * this is precisely the release at which an unchanged v1 declaration silently crosses a major
 * semantic boundary. Shipping the major without the check would have knowingly published a release
 * that violates a long-standing schema guarantee.
 *
 * SCOPE. Exact equality with the executing `VERSION`. No range, no compatibility window, no "2.x
 * accepts 2.y" — this pack has no such mechanism and inventing one during a fix is how an unreviewed
 * contract gets created.
 *
 * The refusal covers every command that evaluates: `validate`, `audit` and `status`. An earlier draft
 * of this file said `validate` was "the only command touched, because it is the only command that
 * stamps the declared version onto its output". That was wrong, and the second half of this file
 * exists because review caught it — the schema's promise is about which framework evaluates the
 * project, not about which report carries a label. See the note above the widened tests below.
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
const CLI = path.join(ROOT, "scripts/standards.mjs");

/** Read rather than hardcoded: a test that pins the version would fail on the next release for no reason. */
const PACK_VERSION = readFileSync(path.join(ROOT, "VERSION"), "utf8").trim();

const TEMPORARY = [];
process.on("exit", () => {
  for (const dir of TEMPORARY) rmSync(dir, { recursive: true, force: true });
});

/**
 * A complete, otherwise-valid adopting project. Everything about it is in order except the one line
 * under test, so a refusal can only be about the declared version.
 */
function makeTarget(policyBody, { bettingPolicy = "valid" } = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bs-declared-"));
  TEMPORARY.push(dir);
  mkdirSync(path.join(dir, "ledger"));
  mkdirSync(path.join(dir, "standards"));
  cpSync(path.join(ROOT, "examples/ledger"), path.join(dir, "ledger"), { recursive: true });
  cpSync(
    path.join(ROOT, "standards/19-evaluation-of-the-betting-process.md"),
    path.join(dir, "standards/19-evaluation-of-the-betting-process.md"),
  );
  if (bettingPolicy === "valid") {
    cpSync(path.join(ROOT, "betting-policy.yml"), path.join(dir, "betting-policy.yml"));
  } else if (bettingPolicy === "malformed") {
    // Schema-invalid on purpose. Evaluating it produces a loud, specific, *different* refusal, which
    // is what lets the ordering test below distinguish "the version was checked first" from "the
    // version was checked eventually". An ABSENT betting policy would not work here: that case is
    // handled gracefully and reaches the same quiet exit either way.
    writeFileSync(path.join(dir, "betting-policy.yml"), 'minEdge: "not-a-number"\nkellyMultiplier: "0.25"\n', "utf8");
  }
  writeFileSync(path.join(dir, "project-policy.yml"), policyBody, "utf8");
  return dir;
}

const declaring = (version) =>
  version === null
    ? 'project: "unversioned"\nexceptions: []\n'
    : `standardVersion: "${version}"\nproject: "declared-${version}"\nexceptions: []\n`;

/** Never throws: the exit code is the thing under test. */
async function validate(dir) {
  try {
    const { stdout, stderr } = await run(process.execPath, [CLI, "validate", dir, "--json"]);
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
}

const EXIT_INVOCATION = 2;

test("a project declaring the executing version is evaluated normally", async () => {
  const { code, stdout } = await validate(makeTarget(declaring(PACK_VERSION)));
  assert.notEqual(code, EXIT_INVOCATION, "a matching declaration must not be refused");
  const out = JSON.parse(stdout);
  assert.equal(out.standardVersion, PACK_VERSION);
  assert.ok(out.status, "a verdict must be produced");
});

test("a project declaring an older framework gets no verdict from this one", async () => {
  // The specimen. `v1.0.0` is the only release a consumer can pin, so this is not hypothetical.
  const { code, stdout, stderr } = await validate(makeTarget(declaring("1.0.0")));
  assert.equal(code, EXIT_INVOCATION, `a 2.x verdict must not be issued to a project declaring 1.0.0`);
  assert.equal(stdout.trim(), "", "no envelope may be printed: a refusal is not a result");
  assert.match(stderr, /1\.0\.0/, "the refusal must name what was declared");
  assert.match(stderr, new RegExp(PACK_VERSION.replace(/\./g, "\\.")), "and what is executing");
});

test("a declaration that is not a version is a configuration error, not a verdict", async () => {
  const { code, stdout } = await validate(makeTarget(declaring("banana")));
  assert.equal(code, EXIT_INVOCATION);
  assert.equal(stdout.trim(), "");
});

test("a policy with no declared version is a configuration error", async () => {
  // The schema marks `standardVersion` required. Nothing enforced it for a target, so this is the
  // schema's existing requirement finally being applied — not a new rule invented here.
  const { code, stdout } = await validate(makeTarget(declaring(null)));
  assert.equal(code, EXIT_INVOCATION);
  assert.equal(stdout.trim(), "");
});

test("the version is checked before anything is evaluated", async () => {
  // Ordering is the property, not just the outcome. A target that is wrong in two ways must fail for
  // the version, because the alternative is partially executing under the wrong framework and then
  // reporting whatever it tripped over downstream as though the framework question had been settled.
  //
  // THE FIRST VERSION OF THIS TEST DID NOT PROVE THAT, and a mutation caught it: moving the guard to
  // *after* gatherEvidence left this test green, because with an absent betting policy both orders
  // produce the same quiet exit 2 with the same message. Outcome and order are different claims, and
  // only a fixture whose evaluation says something loud and different can tell them apart.
  //
  // Measured, same fixture, both orders:
  //   guard first   →  "this project declares standardVersion 1.0.0, and this checkout is 2.0.0"
  //   guard second  →  "betting policy is schema-invalid — unitPercent: is required but missing; …"
  // The second message is proof that decision evaluation ran under a framework the project never
  // declared, which is the whole thing being prevented.
  const dir = makeTarget(declaring("1.0.0"), { bettingPolicy: "malformed" });
  const { code, stdout, stderr } = await validate(dir);
  assert.equal(code, EXIT_INVOCATION);
  assert.equal(stdout.trim(), "", "nothing may be evaluated before the version is settled");
  assert.match(stderr, /standardVersion 1\.0\.0/, "the reported fault must be the version");
  assert.doesNotMatch(
    stderr,
    /betting policy is schema-invalid/,
    "reaching the betting policy at all means evaluation began under the wrong framework",
  );
});

test("this repository still validates its own ledger under its own declared version", async () => {
  // The self-checkout regression. This repository's project-policy.yml declares the version it ships,
  // so the check it now applies to everyone else must not lock it out of its own gate.
  // `run` rejects on any non-zero exit, so reaching the next line IS the exit-0 assertion.
  const { stdout } = await run(process.execPath, [CLI, "validate", ".", "--json"], { cwd: ROOT });
  const out = JSON.parse(stdout);
  assert.equal(out.status, "COMPLIANT");
  assert.equal(out.standardVersion, PACK_VERSION, "the envelope's version is the one this pack executes");
});

/* ---------------------------------------------------------------------------------------------
 * Every command that evaluates, not just the one that labels.
 *
 * The first implementation of this check sat in `runValidate`, on the reasoning recorded above: only
 * `validate` stamps `standardVersion` onto its output, so only `validate` could mislabel a result.
 * Review found that reasoning too narrow. The schema does not promise "the version printed on the
 * envelope"; it promises *"the framework version this project is evaluated against"*. `audit` and
 * `status` both call `gatherEvidence` directly, so a project declaring 1.0.0 was still evaluated
 * under 2.0.0 semantics through either of them — and `audit --strict` turns that evaluation into a
 * gating failure, which is the same wrong-framework judgement with a CI job attached.
 *
 * The guard therefore belongs at the shared pre-evaluation boundary rather than in a list of
 * commands. This is the same lesson as ADR 0008's rule-ownership addendum: an enumeration maintained
 * outside the thing it describes is correct only until someone adds a member.
 *
 * `plan` is deliberately NOT guarded. It previews what *would* be evaluated from `buildPlan` and
 * never calls `gatherEvidence`, so there is no evaluation to attribute to the wrong framework. The
 * test below pins that, so the boundary cannot be widened by habit.
 * ------------------------------------------------------------------------------------------- */

async function cli(...argv) {
  try {
    const { stdout, stderr } = await run(process.execPath, [CLI, ...argv]);
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
}

test("audit does not gather evidence for a project declaring another framework version", async () => {
  const dir = makeTarget(declaring("1.0.0"));
  const { code, stdout, stderr } = await cli("audit", dir, "--json");
  assert.equal(code, EXIT_INVOCATION, "evidence gathered under the wrong framework is not evidence");
  assert.equal(stdout.trim(), "", "no findings may be printed: they would describe a 2.x evaluation");
  assert.match(stderr, /standardVersion 1\.0\.0/);
});

test("audit --strict reports a configuration error rather than a gating failure", async () => {
  // The distinction this pack refuses to collapse anywhere else. `--strict` is what CI runs; exit 1
  // from it says "this project's records are bad". A version mismatch says nothing about any record.
  const dir = makeTarget(declaring("1.0.0"));
  const { code } = await cli("audit", dir, "--strict", "--json");
  assert.equal(code, EXIT_INVOCATION, "a wrong-framework invocation must never be reported as a failing audit");
});

test("status does not gather evidence for a project declaring another framework version", async () => {
  const dir = makeTarget(declaring("1.0.0"));
  const { code, stdout, stderr } = await cli("status", dir, "--json");
  assert.equal(code, EXIT_INVOCATION);
  assert.equal(stdout.trim(), "", "coverage and record counts are evaluation output like any other");
  assert.match(stderr, /standardVersion 1\.0\.0/);
});

test("plan still previews a project declaring another framework version", async () => {
  // The converse, and the reason it is asserted: a guard applied by habit rather than by evidence
  // would take `plan` with it. `plan` reads the catalog and the project's applicability declarations
  // and evaluates nothing, so refusing it would remove the one command that can tell an adopter on
  // an older version what this one would ask of them.
  const dir = makeTarget(declaring("1.0.0"));
  const { code, stdout } = await cli("plan", dir, "--json");
  assert.equal(code, 0, "plan does not evaluate, so there is no framework to attribute a judgement to");
  assert.ok(JSON.parse(stdout).rules.length > 0, "and it must still produce the preview");
});

test("audit and status on this repository are unaffected", async () => {
  // The self-checkout regression for the widened boundary, matching the one `validate` already has.
  for (const command of ["audit", "status"]) {
    const { code } = await cli(command, ".", "--json");
    assert.equal(code, 0, `${command} must still run against a project declaring the executing version`);
  }
});

test("a target with no betting policy is still refused before its dispositions are computed", async () => {
  // The case that belongs to THIS authority alone. With no betting policy there are no records to
  // judge, so `checkDecisions` is never called and its guard never runs — yet `audit` and `status`
  // would still emit findings, dispositions and a coverage figure derived from the project's policy
  // and documents. That is project-level evidence, and it is evidence produced by a framework the
  // project never declared.
  const dir = makeTarget(declaring("1.0.0"), { bettingPolicy: "absent" });
  for (const command of ["validate", "audit", "status"]) {
    const { code, stdout } = await cli(command, dir, "--json");
    assert.equal(code, EXIT_INVOCATION, `${command} must refuse before producing project-level evidence`);
    assert.equal(stdout.trim(), "", `${command} must print nothing`);
  }
});

test("removing this authority's guard leaks the case only it covers", async () => {
  // The mutation that discriminates PLACEMENT rather than presence — and it has to be run against
  // the fixture this guard uniquely covers.
  //
  // An earlier version of this test used a target WITH a betting policy and asserted all three
  // commands leaked. It failed once `checkDecisions` grew a guard of its own, and the failure was
  // correct: with a betting policy present, the commands reach the record authority, which refuses
  // on its own account. That does not mean this guard is redundant. It means the two guards cover
  // different ground, and a mutation has to name which ground it is testing.
  //
  // With NO betting policy, `checkDecisions` is never called. Everything the three commands would
  // report comes from here, so removing this call site must leak all three — and does.
  //
  // This is the honest shape of the invariant: two authorities produce evidence in this pack, and
  // each guards what it establishes. The mutation for the record authority lives in
  // test/framework-authority.test.mjs and proves the same thing about the other half.
  const pack = mkdtempSync(path.join(os.tmpdir(), "bs-pack-ver-"));
  TEMPORARY.push(pack);
  cpSync(ROOT, pack, {
    recursive: true,
    filter: (src) => !/[\/](\.git|node_modules)$/.test(src) && !/[\/]artifacts[\/]local-ci$/.test(src),
  });
  const file = path.join(pack, "scripts/standards.mjs");
  const before = readFileSync(file, "utf8");
  const guard = /^ *const refusal = await declaredVersionRefusal\(plan\.policyPath\);\r?\n *if \(refusal\) throw new WrongFramework\(refusal\);\r?\n/m;
  assert.match(before, guard, "the guard must be one surgical call site for this mutation to mean anything");
  writeFileSync(file, before.replace(guard, ""), "utf8");

  const dir = makeTarget(declaring("1.0.0"), { bettingPolicy: "absent" });
  const mutated = path.join(pack, "scripts/standards.mjs");
  const leaked = [];
  for (const command of ["validate", "audit", "status"]) {
    try {
      await run(process.execPath, [mutated, command, dir, "--json"]);
      leaked.push(command);
    } catch (error) {
      if (error.code !== EXIT_INVOCATION) leaked.push(command);
    }
  }
  assert.deepEqual(
    leaked.sort(),
    ["audit", "status", "validate"],
    "with the shared guard removed every evaluating command must evaluate under the wrong framework; " +
      "any command still refusing is carrying its own copy of the check",
  );
});
