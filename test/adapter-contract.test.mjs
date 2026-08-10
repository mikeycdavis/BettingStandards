/**
 * Adapter-contract fidelity.
 *
 * standards-adapter.json declares how this pack is invoked by StandardsEnforcer. A declaration that
 * drifts from the CLI it describes is worse than no declaration: the enforcer would run something,
 * get JSON back, and report a verdict for a question nobody asked. This pack has a `check`
 * subcommand that answers something other than its verdict, so that is not hypothetical.
 *
 * This test is the pack keeping its own promise. It builds the argv from the contract, runs it, runs
 * the documented invocation directly, and requires the two results to be identical.
 */

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(await readFile(path.join(ROOT, "standards-adapter.json"), "utf8"));

/** The documented verdict invocation, written out rather than derived from the contract under test. */
const DIRECT = ["validate", "{ROOT}", "--json"];

/** Timestamps differ between two runs and say nothing about fidelity. */
function stable(report) {
  const { auditedAt, evaluatedAt, asOf, ...rest } = report;
  return rest;
}

function run(args) {
  const r = spawnSync(process.execPath, [path.join(ROOT, contract.evaluation.entrypoint), ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    cwd: ROOT,
  });
  const firstErrorLine = (r.stderr || "").split("\n")[0];
  assert.ok(r.stdout && r.stdout.trim(), "no stdout: " + firstErrorLine);
  return JSON.parse(r.stdout);
}

const withTarget = () => contract.evaluation.arguments.map((a) => a.replace("{target}", ROOT));

test("the declared entrypoint exists in this pack", () => {
  assert.ok(
    existsSync(path.join(ROOT, contract.evaluation.entrypoint)),
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

test("invoking through the declared contract equals invoking this pack directly", () => {
  const viaContract = run(withTarget());
  const direct = run(DIRECT.map((a) => a.replace("{ROOT}", ROOT)));
  assert.deepEqual(stable(viaContract), stable(direct));
});

test("the status this pack reports is one it declared", () => {
  const report = run(withTarget());
  assert.ok(typeof report.status === "string", "the report carries no top-level status");
  assert.ok(
    contract.result.statuses.includes(report.status),
    "reported " + report.status + ", which standards-adapter.json does not declare",
  );
});
