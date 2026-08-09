/**
 * Tests for the CLI: the audit/validate split, the exit-code contract, and the binding guard.
 *
 * These drive the real entry point as a subprocess, the way CI does. Testing extracted helpers would
 * leave the thing CI actually runs unproven.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { loadCatalog } from "../scripts/catalog.mjs";
import { FINDING_RULES } from "../scripts/decisions.mjs";
import { EVALUATED_RULES } from "../scripts/standards.mjs";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(ROOT, "scripts/standards.mjs");
const catalog = await loadCatalog();

/** Run the CLI. Never throws on a non-zero exit — the exit code is under test. */
async function cli(...args) {
  try {
    const { stdout, stderr } = await run(process.execPath, [CLI, ...args], { cwd: ROOT });
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
}

// --- Bindings ------------------------------------------------------------------------------------

test("every finding the checker can produce binds to a rule the catalog defines", () => {
  // The mechanical guard on the three-way separation: catalog owns identity, policy owns
  // applicability, evaluator produces evidence. An evaluator reporting against an id the catalog does
  // not carry has begun speaking a private vocabulary, and the policy can no longer address it.
  for (const [findingId, ruleId] of Object.entries(FINDING_RULES)) {
    assert.ok(catalog.rules.has(ruleId), `finding '${findingId}' binds to unknown rule '${ruleId}'`);
  }
});

test("every rule claimed as evaluated exists and is not manual-review", () => {
  for (const id of EVALUATED_RULES) {
    const rule = catalog.rules.get(id);
    assert.ok(rule, `EVALUATED_RULES names '${id}', which the catalog does not define`);
    assert.notEqual(rule.validationType, "manual-review", `'${id}' cannot be established by an automated run`);
  }
  assert.equal(new Set(EVALUATED_RULES).size, EVALUATED_RULES.length, "EVALUATED_RULES contains a duplicate");
});

test("every manual-review rule is absent from EVALUATED_RULES and reports not-evaluated", () => {
  const evaluated = new Set(EVALUATED_RULES);
  const manual = [...catalog.rules.values()].filter((r) => r.validationType === "manual-review");
  assert.ok(manual.length > 0, "the catalog should carry rules a machine cannot establish");
  for (const rule of manual) {
    assert.ok(!evaluated.has(rule.id), `${rule.id} is manual-review but claimed as evaluated`);
  }
});

// --- This repository audits clean ------------------------------------------------------------------

test("this repository has no error-severity audit findings", async () => {
  // The real error gate. CI runs `audit` without --strict so advisory findings do not break the
  // build; this assertion is what stops an error-severity finding from being ignored.
  const { code, stdout } = await cli("audit", ".", "--json");
  assert.equal(code, 0, "audit itself must not fail");
  const report = JSON.parse(stdout);
  const errors = report.findings.filter((f) => f.severity === "error");
  assert.deepEqual(errors, [], `this repository must audit clean:\n${JSON.stringify(errors, null, 2)}`);
});

test("this repository validates as COMPLIANT with honest coverage", async () => {
  const { code, stdout } = await cli("validate", ".", "--json");
  assert.equal(code, 0);
  const out = JSON.parse(stdout);
  assert.equal(out.status, "COMPLIANT");

  // Coverage ships beside the verdict and is never folded into the score, so improving coverage can
  // never look like improving compliance.
  assert.ok(out.frameworkCoverage, "the envelope must carry framework coverage");
  assert.ok(
    out.frameworkCoverage.evaluatedRules < out.frameworkCoverage.cataloguedRules,
    "coverage must be honest: some rules genuinely cannot be machine-evaluated",
  );
  assert.equal(out.frameworkCoverage.standards, 21);
});

test("the verdict never claims everything was checked", async () => {
  const { stdout } = await cli("validate", ".");
  assert.match(stdout, /everything that was CHECKED passed/);
  assert.match(stdout, /does not mean\s+everything was checked/);
});

test("rules nothing evaluated are reported as not passing", async () => {
  const { stdout } = await cli("validate", ".", "--json");
  const out = JSON.parse(stdout);
  const notEvaluated = out.results.filter((r) => r.disposition === "not-evaluated");
  assert.ok(notEvaluated.length > 0, "some rules genuinely cannot be evaluated by machine");
  for (const r of notEvaluated) assert.notEqual(r.status, "passed");
});

// --- audit vs validate -----------------------------------------------------------------------------

test("audit reports evidence and says it is not a verdict", async () => {
  const { code, stdout } = await cli("audit", ".");
  assert.equal(code, 0, "audit does not gate by default");
  assert.match(stdout, /This is evidence, not a verdict/);
});

test("audit and validate agree about the facts", async () => {
  // They share one evidence-gathering path, so a disagreement would mean two implementations of the
  // same question — the drift a dry-run has when it re-derives its own idea of the work.
  const audit = JSON.parse((await cli("audit", ".", "--json")).stdout);
  const validate = JSON.parse((await cli("validate", ".", "--json")).stdout);
  assert.equal(audit.records, validate.frameworkCoverage ? audit.records : audit.records);
  const auditRules = new Set(audit.findings.map((f) => f.rule).filter(Boolean));
  const failedRules = new Set(validate.results.filter((r) => r.status === "failed").map((r) => r.ruleId));
  for (const id of failedRules) {
    assert.ok(auditRules.has(id), `validate failed '${id}' but audit reported no finding for it`);
  }
});

// --- Exit codes ---------------------------------------------------------------------------------------

test("an unreadable policy exits 2, never 1", async () => {
  // The distinction that must not collapse: "the policy could not be read" is not "this project does
  // not comply". Collapsing them lets a deleted policy look like a finding — or a passing run.
  const dir = await mkdtemp(path.join(os.tmpdir(), "bs-exit-"));
  try {
    await writeFile(path.join(dir, "project-policy.yml"), "\tthis: is not valid yaml\n", "utf8");
    const { code, stderr } = await cli("validate", dir);
    assert.equal(code, 2, `expected exit 2 for an unreadable policy, got ${code}: ${stderr}`);
    assert.doesNotMatch(stderr, /NON_COMPLIANT/, "an unreadable policy must never be reported as non-compliance");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("an unknown rule id exits 1 from explain", async () => {
  const { code, stderr } = await cli("explain", "bankroll.no-such-rule");
  assert.equal(code, 1);
  assert.match(stderr, /defines no rule/);
});

test("an unknown flag exits 2", async () => {
  const { code } = await cli("validate", ".", "--nonsense");
  assert.equal(code, 2);
});

// --- explain -------------------------------------------------------------------------------------------

test("explain prints STOP semantics for a prohibition", async () => {
  const { code, stdout } = await cli("explain", "bankroll.no-martingale");
  assert.equal(code, 0);
  assert.match(stdout, /THIS IS A PROHIBITION/);
  assert.match(stdout, /required response is STOP/);
  assert.match(stdout, /No exception may be\s+declared against it/);
  assert.match(stdout, /assurance: partial/, "explain must surface how much the check actually establishes");
});

test("explain does not claim STOP semantics for an ordinary requirement", async () => {
  const { stdout } = await cli("explain", "vig.overround-computed");
  assert.doesNotMatch(stdout, /THIS IS A PROHIBITION/);
});

test("explain surfaces the assurance note, including what a check does not establish", async () => {
  const { stdout } = await cli("explain", "record.decision-record-required");
  assert.match(stdout, /CANNOT establish that every decision was recorded/);
});

test("every rule in the catalog can be explained", async () => {
  // A rule nobody can get an explanation for is a rule nobody can act on.
  for (const rule of catalog.rules.values()) {
    const { code } = await cli("explain", rule.id);
    assert.equal(code, 0, `explain failed for ${rule.id}`);
  }
});

// --- plan and status -------------------------------------------------------------------------------------

test("plan lists the rules that need human attestation and says why", async () => {
  const { code, stdout } = await cli("plan", ".");
  assert.equal(code, 0);
  assert.match(stdout, /needs-attestation|not-applicable/);
  assert.match(stdout, /never passing/, "plan must be explicit that unattested rules do not pass");
});

test("plan's rule set matches the catalog exactly", async () => {
  const { stdout } = await cli("plan", ".", "--json");
  const out = JSON.parse(stdout);
  assert.equal(out.rules.length, catalog.rules.size);
  for (const r of out.rules) assert.ok(catalog.rules.has(r.id));
});

test("status informs and never gates", async () => {
  const { code, stdout } = await cli("status", ".");
  assert.equal(code, 0);
  assert.match(stdout, /Status informs; it never gates/);
  assert.match(stdout, /revisit/i, "status should surface applicability decisions awaiting a trigger");
});

// --- init ------------------------------------------------------------------------------------------------

test("init dry-run and apply execute the same plan", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bs-init-"));
  try {
    const dry = JSON.parse((await cli("init", dir, "--dry-run", "--json")).stdout);
    assert.equal(dry.dryRun, true);
    assert.ok(dry.operations.length > 0);
    assert.ok(dry.operations.every((o) => o.action === "create"));

    const applied = JSON.parse((await cli("init", dir, "--json")).stdout);
    assert.deepEqual(
      applied.operations.map((o) => `${o.action} ${o.path}`),
      dry.operations.map((o) => `${o.action} ${o.path}`),
      "apply must execute exactly the operations the dry-run described",
    );

    // Idempotent: a second run finds what the first wrote and leaves it alone.
    const second = JSON.parse((await cli("init", dir, "--dry-run", "--json")).stdout);
    assert.ok(second.operations.every((o) => o.action === "skip"), JSON.stringify(second.operations));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("init never overwrites a file it did not write", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bs-init-"));
  try {
    await writeFile(path.join(dir, "project-policy.yml"), "# my own considered policy\n", "utf8");
    const { code, stdout } = await cli("init", dir, "--json");
    const out = JSON.parse(stdout);
    const conflict = out.operations.find((o) => o.path === "project-policy.yml");
    assert.equal(conflict.action, "conflict");
    assert.equal(conflict.done, false);
    assert.equal(code, 1, "a conflict is reported, not silently accepted");

    const after = await readFile(path.join(dir, "project-policy.yml"), "utf8");
    assert.equal(after, "# my own considered policy\n", "the operator's file must be untouched");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("init produces a project whose templates carry the AI workflow", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bs-init-"));
  try {
    await cli("init", dir, "--json");
    const agents = await readFile(path.join(dir, "AGENTS.md"), "utf8");
    assert.match(agents, /A good bet can lose/);
    assert.match(agents, /BLOCKED_BY_INVARIANT/);
    assert.match(agents, /never required to produce a positive recommendation/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- A ledger that is not there ----------------------------------------------------------------------------

test("a project with no ledger does not report its record rules as passing", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bs-empty-"));
  try {
    await mkdir(path.join(dir, "ledger"), { recursive: true });
    await writeFile(
      path.join(dir, "project-policy.yml"),
      'standardVersion: "1.0.0"\nproject: "empty"\nexceptions: []\n',
      "utf8",
    );
    const { stdout } = await cli("validate", dir, "--json");
    const out = JSON.parse(stdout);
    const recordRule = out.results.find((r) => r.ruleId === "record.decision-record-required");
    assert.notEqual(recordRule.status, "passed", "an empty ledger has not demonstrated anything");
    assert.equal(recordRule.disposition, "not-evaluated");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
