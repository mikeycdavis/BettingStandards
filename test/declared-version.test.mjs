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
 * SCOPE, DELIBERATELY NARROW. Exact equality with the executing `VERSION`. No range, no compatibility
 * window, no "2.x accepts 2.y" — this pack has no such mechanism and inventing one during a fix is
 * how an unreviewed contract gets created. `validate` is also the only command touched, because it is
 * the only command that stamps the declared version onto its output; `audit` and `status` emit no
 * `standardVersion` and therefore mislabel nothing.
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
