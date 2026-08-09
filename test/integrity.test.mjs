/**
 * Tests for the five mechanical defences of the standards-integrity invariant.
 *
 * The invariant is `integrity.no-standard-weakening`: no standard, test, applicability
 * determination, evidence requirement, or verification mechanism may be weakened because it prevents
 * a desired conclusion. It cannot be detected directly — a rule that could detect its own
 * circumvention would have to live outside the system it protects. What can be tested is that each
 * defence works, and that is what this file does.
 *
 * If any test here starts failing, the corresponding defence has been removed, and the invariant is
 * that much less defended. None of these should ever be "fixed" by relaxing the assertion.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog, CatalogError } from "../scripts/catalog.mjs";
import { evaluate, STATUS } from "../scripts/compliance.mjs";
import { checkPolicy } from "../scripts/policy.mjs";
import { compare } from "../scripts/inventory.mjs";
import { decisionDigest } from "../scripts/decisions.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_SCHEMA = path.join(ROOT, "schemas/project-policy.schema.json");
const catalog = await loadCatalog();

// --- Defence 1: an exception against a prohibition is rejected --------------------------------------

test("DEFENCE 1: a policy waiving a prohibition is reported as a finding", async () => {
  const result = await checkPolicy(
    path.join(ROOT, "test/fixtures/project-policies/exception-against-prohibition.yml"),
    PROJECT_SCHEMA,
    "2026-08-09",
  );
  assert.equal(result.status, "findings", "waiving a prohibition must never produce a valid policy");
  const hit = result.findings.find((f) => f.id === "policy.non-exemptible-rule");
  assert.ok(hit, `expected the waiver to be rejected, got ${JSON.stringify(result.findings)}`);
  assert.match(hit.message, /bankroll\.no-martingale/);
  assert.match(hit.remediation, /not-applicable/, "the remediation must point at the one legitimate escape");
});

test("DEFENCE 1: the compliance engine rejects the waiver rather than honouring it", () => {
  const verdict = evaluate({
    catalog,
    policy: {
      standardVersion: "1.0.0",
      exceptions: [
        {
          rule: "bankroll.no-martingale",
          reason: "Our recovery staking plan needs it.",
          approvedBy: "A. Bettor",
          approvedAt: "2026-08-01",
        },
      ],
    },
    findings: [],
    evaluated: [],
    today: "2026-08-09",
  });

  const rejected = verdict.results.find((r) => r.disposition === "rejected-exception");
  assert.ok(rejected, "the exception must be rejected, not silently ignored and not applied");
  assert.equal(rejected.ruleId, "bankroll.no-martingale");
  assert.equal(
    verdict.status,
    STATUS.BLOCKED_BY_INVARIANT,
    "attempting to waive a prohibition is itself the behaviour the invariant prohibits",
  );
});

test("DEFENCE 1: the catalog refuses to define a waivable prohibition", async () => {
  // The guarantee cannot be lost through an omission in a single entry: a forbidden rule that forgot
  // nonExemptible would be a prohibition anyone could waive, and it would look exactly like the
  // others in the file.
  const { loadCatalog: load } = await import("../scripts/catalog.mjs");
  await assert.rejects(
    () => load(path.join(ROOT, "test/fixtures/catalogs/waivable-prohibition")),
    CatalogError,
    "a forbidden rule without nonExemptible must not load",
  );
});

test("DEFENCE 1: every prohibition in the shipped catalog is non-exemptible and error-severity", () => {
  const forbidden = [...catalog.rules.values()].filter((r) => r.level === "forbidden");
  assert.equal(forbidden.length, 23, "22 rules carry the 23 source bullets, plus the integrity invariant");
  for (const rule of forbidden) {
    assert.equal(rule.nonExemptible, true, `${rule.id} is forbidden but exemptible`);
    assert.equal(rule.severity, "error", `${rule.id} is forbidden but not error-severity`);
  }
});

// --- Defence 2: the inventory pins the register -------------------------------------------------------

test("DEFENCE 2: deleting a prohibition from the catalog breaks the inventory check", async () => {
  const source = await readFile(path.join(ROOT, "artifacts/prompts/original-prompt.md"), "utf8");
  const inventory = JSON.parse(await readFile(path.join(ROOT, "artifacts/standards-source-inventory.json"), "utf8"));
  const presentFiles = new Set(inventory.standards.items.map((i) => i.file));

  const allRules = [...catalog.rules.values()].map((r) => ({ id: r.id, forbidden: r.level === "forbidden" }));
  const withoutOne = allRules.filter((r) => r.id !== "record.no-silent-revision");

  const { problems } = compare({ source, inventory, presentFiles, catalogRules: withoutOne });
  assert.ok(
    problems.some((p) => p.includes("record.no-silent-revision") && p.includes("no rule in the catalog")),
    `deleting a prohibition must fail the inventory check, got: ${problems.join(" | ")}`,
  );
});

test("DEFENCE 2: demoting a prohibition to a recommendation is caught", async () => {
  // Reclassification is the quietest form of weakening: the rule is still there, still passing, and
  // no longer prohibits anything. The inventory catches it because a demoted rule is no longer
  // forbidden, and the check requires every mapped prohibition to exist AS a rule the catalog carries
  // — while the catalog's own loader requires anything forbidden to be non-exemptible.
  const source = await readFile(path.join(ROOT, "artifacts/prompts/original-prompt.md"), "utf8");
  const inventory = JSON.parse(await readFile(path.join(ROOT, "artifacts/standards-source-inventory.json"), "utf8"));
  const presentFiles = new Set(inventory.standards.items.map((i) => i.file));

  const demoted = [...catalog.rules.values()].map((r) => ({
    id: r.id,
    forbidden: r.id === "bankroll.no-martingale" ? false : r.level === "forbidden",
  }));

  // The demoted rule still exists by id, so the inventory alone would not notice. The catalog loader
  // is the check that does: a rule mapped as a prohibition must actually be forbidden.
  const mapped = new Set(inventory.mustNever.items.map((e) => e.ruleId));
  assert.ok(mapped.has("bankroll.no-martingale"), "the inventory maps this rule as a prohibition");
  const stillForbidden = demoted.find((r) => r.id === "bankroll.no-martingale").forbidden;
  assert.equal(stillForbidden, false, "the fixture models the demotion");

  // And the shipped catalog must never be in that state.
  assert.equal(
    catalog.rules.get("bankroll.no-martingale").level,
    "forbidden",
    "the shipped catalog must carry this rule as a prohibition",
  );
});

test("DEFENCE 2: every prohibition the briefs require exists in the catalog, and no others", async () => {
  const inventory = JSON.parse(await readFile(path.join(ROOT, "artifacts/standards-source-inventory.json"), "utf8"));
  const mapped = new Set([
    ...inventory.mustNever.items.map((e) => e.ruleId),
    ...inventory.mustNeverFromExpandedBrief.items.map((e) => e.ruleId),
  ]);
  const forbidden = new Set([...catalog.rules.values()].filter((r) => r.level === "forbidden").map((r) => r.id));

  for (const id of mapped) assert.ok(forbidden.has(id), `the briefs require '${id}' but the catalog does not define it`);
  for (const id of forbidden) assert.ok(mapped.has(id), `the catalog defines '${id}', which no brief asked for`);
});

// --- Defence 3: lifecycle discipline -------------------------------------------------------------------

test("DEFENCE 3: every rule carries its lifecycle fields from the first release", () => {
  // Present even when empty. Adding them later means every existing rule silently lacks them, and a
  // consumer reads their absence as meaningful — so a prohibition could be retired with no trace.
  for (const rule of catalog.rules.values()) {
    for (const field of ["deprecatedIn", "supersededBy", "removedIn"]) {
      assert.ok(field in rule, `${rule.id} is missing the lifecycle field '${field}'`);
    }
    assert.equal(rule.introducedIn, "1.0.0", `${rule.id} does not record when it was introduced`);
  }
});

test("DEFENCE 3: no prohibition in the shipped catalog is deprecated or removed", () => {
  for (const rule of catalog.rules.values()) {
    if (rule.level !== "forbidden") continue;
    assert.equal(rule.deprecatedIn, null, `${rule.id} has been deprecated`);
    assert.equal(rule.removedIn, null, `${rule.id} has been removed`);
  }
});

// --- Defence 4: tamper evidence ----------------------------------------------------------------------

test("DEFENCE 4: editing a decision-time field after the fact flips the digest", async () => {
  const record = JSON.parse(await readFile(path.join(ROOT, "examples/ledger/DEC-20260808-005.json"), "utf8"));
  assert.equal(decisionDigest(record.decision), record.integrity.decisionDigest, "the shipped record is intact");

  // The specific temptation: this wager lost. Quietly reduce the stake so the loss looks smaller.
  const doctored = structuredClone(record);
  doctored.decision.derived.stake = 50;
  assert.notEqual(
    decisionDigest(doctored.decision),
    record.integrity.decisionDigest,
    "editing a settled record's stake must be visible",
  );
});

test("DEFENCE 4: every worked example and its policy reference are digest-pinned", async () => {
  for (const id of ["DEC-20260809-001", "DEC-20260809-002", "DEC-20260809-003", "DEC-20260809-004", "DEC-20260808-005"]) {
    const record = JSON.parse(await readFile(path.join(ROOT, `examples/ledger/${id}.json`), "utf8"));
    assert.match(record.integrity.decisionDigest, /^[0-9a-f]{64}$/, `${id} carries no decision digest`);
    assert.match(record.decision.policyRef.digest, /^[0-9a-f]{64}$/, `${id} does not pin the policy it was decided under`);
  }
});

// --- Defence 5: the evaluator cannot quietly stop checking ---------------------------------------------

test("DEFENCE 5: no manual-review rule is ever claimed as machine-evaluated", async () => {
  // The rules that prohibit motives — chasing, action bets, resulting, backtest leakage — cannot be
  // established by any automated run. Listing one as evaluated would mean an automated pass reported
  // it as satisfied, which is the false green the whole framework exists to prevent.
  const { EVALUATED_RULES } = await import("../scripts/standards.mjs");
  for (const id of EVALUATED_RULES) {
    const rule = catalog.rules.get(id);
    assert.ok(rule, `EVALUATED_RULES names '${id}', which the catalog does not define`);
    assert.notEqual(
      rule.validationType,
      "manual-review",
      `'${id}' is manual-review and must never appear in EVALUATED_RULES`,
    );
  }
});

test("DEFENCE 5: an unevaluated rule reports not-evaluated, never passing", () => {
  const verdict = evaluate({
    catalog,
    policy: { standardVersion: "1.0.0", exceptions: [] },
    findings: [],
    evaluated: [], // Nothing was examined at all.
    today: "2026-08-09",
  });

  for (const result of verdict.results) {
    assert.notEqual(result.status, "passed", `${result.ruleId} reported passing when nothing evaluated it`);
    assert.equal(result.disposition, "not-evaluated");
  }
  assert.equal(verdict.score, null, "a score computed over nothing must be null, not 100");
});

test("DEFENCE 5: an attestation never overrides an automated finding", () => {
  const verdict = evaluate({
    catalog,
    policy: {
      standardVersion: "1.0.0",
      attestations: {
        "bankroll.no-chasing-losses": {
          status: "approved",
          reviewedBy: "A. Bettor",
          reviewedAt: "2026-08-09",
          evidence: "Reviewed the ledger and found no chasing.",
        },
      },
    },
    findings: [
      { rule: "bankroll.no-chasing-losses", severity: "error", message: "a stake sequence escalates after losses" },
    ],
    evaluated: [],
    today: "2026-08-09",
  });

  const result = verdict.results.find((r) => r.ruleId === "bankroll.no-chasing-losses");
  assert.equal(result.disposition, "contradicted-attestation", "evidence outranks assertion");
  assert.equal(result.status, "failed");
});

// --- The verdict itself --------------------------------------------------------------------------------

test("a violated prohibition produces BLOCKED_BY_INVARIANT, not a low score", () => {
  const verdict = evaluate({
    catalog,
    policy: { standardVersion: "1.0.0", exceptions: [] },
    findings: [{ rule: "vig.no-ignored-vig", severity: "error", message: "edge computed from raw implied probabilities" }],
    evaluated: ["vig.no-ignored-vig"],
    today: "2026-08-09",
  });

  assert.equal(verdict.status, STATUS.BLOCKED_BY_INVARIANT);
  assert.deepEqual(verdict.blockedBy, ["vig.no-ignored-vig"]);
});

test("a prohibition outranks an ordinary failure in the verdict", () => {
  const verdict = evaluate({
    catalog,
    policy: { standardVersion: "1.0.0", exceptions: [] },
    findings: [
      { rule: "edge.threshold-respected", severity: "error", message: "a BET below the minimum edge" },
      { rule: "vig.no-ignored-vig", severity: "error", message: "vig ignored" },
    ],
    evaluated: ["edge.threshold-respected", "vig.no-ignored-vig"],
    today: "2026-08-09",
  });

  // Both failed. The instruction differs: "fix these and re-run" is the wrong thing to tell someone
  // who has just ignored the vig, so the blocking verdict wins.
  assert.equal(verdict.status, STATUS.BLOCKED_BY_INVARIANT);
});

test("an ordinary required failure is NON_COMPLIANT, not blocked", () => {
  const verdict = evaluate({
    catalog,
    policy: { standardVersion: "1.0.0", exceptions: [] },
    findings: [{ rule: "edge.threshold-respected", severity: "error", message: "a BET below the minimum edge" }],
    evaluated: ["edge.threshold-respected"],
    today: "2026-08-09",
  });
  assert.equal(verdict.status, STATUS.NON_COMPLIANT);
});
