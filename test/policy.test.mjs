/**
 * Tests for policy validation.
 *
 * The fixtures under test/fixtures/*-policies/ are deliberately broken in one specific way each, so a
 * failure names the defect rather than "the policy is invalid". The most important test in this file
 * is the one asserting an exception against a prohibition is REJECTED: that is protection #1 of the
 * standards-integrity invariant, and if it ever stops working, every prohibition in the pack becomes
 * a suggestion.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkPolicy, loadBettingPolicy, coerceNumber } from "../scripts/policy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_SCHEMA = path.join(ROOT, "schemas/project-policy.schema.json");
const BETTING_SCHEMA = path.join(ROOT, "schemas/betting-policy.schema.json");
const rawFixture = (kind, name) => path.join(ROOT, `test/fixtures/${kind}-policies/${name}`);
/**
 * Fixture policies are materialised declaring the version this checkout executes.
 *
 * `checkPolicy` now refuses a subject whose declared `standardVersion` is not the executing one
 * (ADR 0009), and these fixtures are handed straight to it. Stamping the version rather than writing
 * it into the files keeps the fixtures about the thing each one is actually testing — an expired
 * exception, a conflicting classification — instead of adding five files to the list that has to be
 * edited at every release. It is the same reason the other suites read `VERSION` rather than naming
 * a version twice.
 *
 * The stamp is asserted, not attempted: a fixture that declares nothing would otherwise be refused
 * later for a reason that has nothing to do with what it was written to prove.
 */
const PACK_VERSION = readFileSync(path.join(ROOT, "VERSION"), "utf8").trim();
const TEMPORARY = [];
process.on("exit", () => {
  for (const dir of TEMPORARY) rmSync(dir, { recursive: true, force: true });
});

function declaringThisVersion(source) {
  const body = readFileSync(source, "utf8");
  const stamped = body.replace(/^standardVersion:.*$/m, `standardVersion: "${PACK_VERSION}"`);
  if (stamped === body) throw new Error(`${source} declares no standardVersion to stamp`);
  const dir = mkdtempSync(path.join(os.tmpdir(), "bs-fixture-"));
  TEMPORARY.push(dir);
  const out = path.join(dir, path.basename(source));
  writeFileSync(out, stamped, "utf8");
  return out;
}

const fixture = (kind, name) =>
  kind === "project" ? declaringThisVersion(rawFixture(kind, name)) : rawFixture(kind, name);

const TODAY = "2026-08-09";

// --- The repository's own policies ---------------------------------------------------------------

test("this repository's project policy is valid and free of findings", async () => {
  const result = await checkPolicy(path.join(ROOT, "project-policy.yml"), PROJECT_SCHEMA, TODAY);
  assert.equal(result.status, "ok", JSON.stringify(result.errors.concat(result.findings), null, 2));
});

test("this repository's betting policy loads with every numeric field coerced", async () => {
  const policy = await loadBettingPolicy();
  for (const [field, value] of Object.entries(policy)) {
    if (field === "note") continue;
    assert.equal(typeof value, "number", `${field} did not coerce to a number`);
    assert.ok(Number.isFinite(value), `${field} is not finite`);
  }
  assert.equal(policy.minEdge, 0.02);
  assert.equal(policy.kellyMultiplier, 0.25);
  assert.equal(policy.maxOddsAgeMinutes, 15);
});

// The rejection of an exception declared against a prohibition is protection #1 of the
// standards-integrity invariant. It needs the rule catalog to know which rules are non-exemptible, so
// it lives in test/integrity.test.mjs alongside the other four protections rather than here — keeping
// all five in one place is also how a reader finds out what the invariant is actually defended by.

// --- Ordinary compliance conditions ----------------------------------------------------------------

test("an expired exception is a failure, not a resolution", async () => {
  const result = await checkPolicy(fixture("project", "expired-exception.yml"), PROJECT_SCHEMA, TODAY);
  assert.equal(result.status, "findings");
  assert.ok(result.findings.some((f) => f.id === "policy.expired-exception"));
});

test("an exception that has not expired is accepted", async () => {
  const result = await checkPolicy(fixture("project", "expired-exception.yml"), PROJECT_SCHEMA, "2025-06-01");
  assert.equal(result.status, "ok", "the same exception before its expiry date is valid");
});

test("a rule cannot be both not-applicable and excepted", async () => {
  const result = await checkPolicy(fixture("project", "conflicting-classification.yml"), PROJECT_SCHEMA, TODAY);
  assert.equal(result.status, "findings");
  assert.ok(result.findings.some((f) => f.id === "policy.conflicting-classification"));
});

test("a not-applicable declaration without a reason is schema-invalid", async () => {
  const result = await checkPolicy(fixture("project", "missing-reason.yml"), PROJECT_SCHEMA, TODAY);
  assert.equal(result.status, "invalid", "a reason-less declaration is indistinguishable from a forgotten rule");
});

test("a policy with no exceptions is valid", async () => {
  const result = await checkPolicy(fixture("project", "valid.yml"), PROJECT_SCHEMA, TODAY);
  assert.equal(result.status, "ok");
});

// --- Betting policy shape ---------------------------------------------------------------------------

test("a well-formed betting policy loads", async () => {
  const policy = await loadBettingPolicy(fixture("betting", "valid.yml"), BETTING_SCHEMA);
  assert.equal(policy.minEdge, 0.02);
  assert.equal(policy.longshotOddsThreshold, 6);
});

for (const [name, why] of [
  ["bad-number-pattern.yml", "a percentage where a fraction is required"],
  ["missing-cap.yml", "a missing exposure cap"],
  ["out-of-range.yml", "a Kelly multiplier above full Kelly"],
  ["tab-indent.yml", "a tab in the indentation"],
  ["duplicate-key.yml", "a duplicated key"],
  ["unknown-field.yml", "an unrecognised field"],
]) {
  test(`a betting policy with ${why} is refused`, async () => {
    await assert.rejects(
      () => loadBettingPolicy(fixture("betting", name), BETTING_SCHEMA),
      `${name} must not load: an unreadable threshold has to stop the run, not become a comparison that is quietly false`,
    );
  });
}

// --- Coercion ----------------------------------------------------------------------------------------

test("coerceNumber converts valid numeric strings and refuses everything else", () => {
  assert.equal(coerceNumber("0.02", "test"), 0.02);
  assert.equal(coerceNumber("15", "test"), 15);
  assert.equal(coerceNumber(0.02, "test"), 0.02, "an already-numeric value passes through");
  assert.throws(() => coerceNumber("", "test"), /expected a numeric string/);
  assert.throws(() => coerceNumber("2%", "test"), /not a finite number/);
  assert.throws(() => coerceNumber(null, "test"), /expected a numeric string/);
  assert.throws(() => coerceNumber("Infinity", "test"), /not a finite number/);
});
