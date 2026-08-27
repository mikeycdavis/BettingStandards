/**
 * Adapter-contract fidelity, against an external target.
 *
 * standards-adapter.json declares how this pack is invoked by StandardsEnforcer. A declaration that
 * drifts from the CLI it describes is worse than no declaration: the enforcer would run something,
 * get JSON back, and report a verdict for a question nobody asked. This pack has a `check`
 * subcommand that answers something other than its verdict, so that is not hypothetical.
 *
 * WHAT THE FIRST VERSION OF THIS TEST ESTABLISHED, AND WHAT IT DID NOT. It compared the contract
 * against a `DIRECT` constant declared a few lines above it, and it evaluated the standards
 * repository itself. Both were weaker than they read:
 *
 *   - A constant edited in the same commit as the contract is not an independent oracle. It catches
 *     the JSON changing without the test changing, and cannot catch both being wrong together.
 *   - With target == ROOT, the one configuration the adapter exists for — a standards checkout that
 *     is not the thing being evaluated — was never exercised. An evaluator that ignored its target
 *     and graded its own tree would have passed.
 *
 * SO THIS VERSION ASSERTS THREE THINGS THE OLD ONE COULD NOT:
 *
 *   1. TARGET IDENTITY — the result carries evidence attributable to the external target, not merely
 *      the same JSON from two commands.
 *   2. INVOCATION INDEPENDENCE — the direct oracle's subcommand is read from README.md at run time.
 *      Editing standards-adapter.json cannot move it.
 *   3. CROSS-CHECKOUT — pointed at ROOT instead of the target, the run produces a different result.
 *      That is the mutation: if it did not differ, this file would be proving nothing about targets.
 *
 * None of this changes what the contract says. It changes what this pack can honestly claim to have
 * checked about it.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// A fixture project must declare the version that is going to evaluate it. `validate` refuses a
// mismatch with exit 2 (see test/declared-version.test.mjs), so a hardcoded version here would make
// every fixture below fail on the next release for a reason that has nothing to do with what it
// tests. Read, never written down twice.
const PACK_VERSION = fs.readFileSync(path.join(ROOT, "VERSION"), "utf8").trim();
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, "standards-adapter.json"), "utf8"));

/** Distinctive enough that finding it in a report proves which tree produced the report. */
const TARGET_PROJECT = "FIDELITY-EXTERNAL-TARGET";

/**
 * The verdict subcommand, read from this pack's own README at run time.
 *
 * This is what makes the oracle independent. The README is the surface a human integrator reads, it
 * is not derived from standards-adapter.json, and it is not edited to make this test pass. If the
 * documented command and the declared command ever disagree, one of them is lying to somebody.
 */
function documentedSubcommand() {
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const row = readme.split("\n").find((l) => /^\|\s*`standards \w+ <dir>`/.test(l) && /CI gate/i.test(l));
  assert.ok(row, "README.md no longer documents a verdict command marked as the CI gate");
  return row.match(/`standards (\w+) <dir>`/)[1];
}

/** A target that is emphatically not this repository. */
function externalTarget() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "betting-fidelity-"));
  fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "project-policy.yml"),
    `standardVersion: "${PACK_VERSION}"\nproject: "${TARGET_PROJECT}"\nexceptions: []\n`,
  );
  fs.writeFileSync(path.join(dir, "README.md"), "# A governed project, not a standards pack\n");
  return dir;
}

function run(args, cwd = ROOT) {
  const r = spawnSync(process.execPath, [path.join(ROOT, contract.evaluation.entrypoint), ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    cwd,
  });
  assert.ok(r.stdout && r.stdout.trim(), "no stdout: " + (r.stderr || "").split("\n")[0]);
  return JSON.parse(r.stdout);
}

/** Timestamps differ between two runs and say nothing about fidelity. */
function stable(report) {
  const { auditedAt, evaluatedAt, asOf, ...rest } = report;
  return rest;
}

const viaContract = (target) => run(contract.evaluation.arguments.map((a) => a.replaceAll("{target}", target)));
const viaDocumented = (target) => run([documentedSubcommand(), target, "--json"]);

// ---- The contract describes this pack. ----

test("the declared entrypoint exists in this pack", () => {
  assert.ok(
    fs.existsSync(path.join(ROOT, contract.evaluation.entrypoint)),
    "standards-adapter.json names " + contract.evaluation.entrypoint + ", which is not in this repository",
  );
});

test("the contract substitutes a target, and passing is a subset of the declared statuses", () => {
  assert.ok(
    contract.evaluation.arguments.some((a) => a.includes("{target}")),
    "no argument carries {target}; the enforcer would evaluate whatever this pack defaults to",
  );
  for (const s of contract.result.passing) {
    assert.ok(contract.result.statuses.includes(s), "passing lists " + s + ", which is not in statuses");
  }
});

test("the declared verdict command is the one the README documents as the CI gate", () => {
  assert.equal(contract.evaluation.arguments[0], documentedSubcommand());
});

// ---- Fidelity, across a checkout boundary. ----

test("invoking through the contract equals the documented invocation, on an external target", () => {
  const target = externalTarget();
  try {
    assert.deepEqual(stable(viaContract(target)), stable(viaDocumented(target)));
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("TARGET IDENTITY: the result is attributable to the external target", () => {
  const target = externalTarget();
  try {
    const report = viaContract(target);
    // Not "both commands agreed" — this is the report naming the tree it actually read.
    assert.equal(report.project, TARGET_PROJECT);
    assert.notEqual(report.project, "BettingStandards", "the pack graded itself while claiming a target");
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("CROSS-CHECKOUT: pointing at ROOT instead of the target produces a different result", () => {
  // The deliberate mutation. If an evaluator ignored its target argument and graded its own tree,
  // every assertion above would still pass while proving nothing. This is the assertion that would
  // go red, and it is the one the Financial path defect showed is worth writing out.
  const target = externalTarget();
  try {
    const onTarget = stable(viaContract(target));
    const onRoot = stable(viaContract(ROOT));
    assert.notDeepEqual(onTarget, onRoot, "target and ROOT produced identical reports; the target is being ignored");
    assert.equal(onTarget.project, TARGET_PROJECT);
    assert.notEqual(onRoot.project, TARGET_PROJECT);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("INVOCATION INDEPENDENCE: the oracle does not come from the contract", () => {
  // Mutating a copy of the contract must not move the documented invocation. Were the oracle derived
  // from standards-adapter.json, this pack would only ever be proving the file equals itself.
  const before = documentedSubcommand();
  const mutated = JSON.parse(JSON.stringify(contract));
  mutated.evaluation.arguments = ["check", "{target}", "--json"];
  assert.equal(documentedSubcommand(), before);
  assert.notEqual(
    mutated.evaluation.arguments[0],
    documentedSubcommand(),
    "the mutation should disagree with the README, which is exactly what the fidelity test must catch",
  );
});

test("the status this pack reports is one it declared", () => {
  const target = externalTarget();
  try {
    const report = viaContract(target);
    assert.ok(typeof report.status === "string", "the report carries no top-level status");
    assert.ok(
      contract.result.statuses.includes(report.status),
      "reported " + report.status + ", which standards-adapter.json does not declare",
    );
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});
