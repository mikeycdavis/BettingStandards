/**
 * Tests for the decision checker.
 *
 * Structure: the worked examples must verify clean, and each known-negative fixture must fire its own
 * named finding. The second half is what gives the first meaning — a checker that found nothing would
 * pass the examples too.
 *
 * Each negative fixture breaks exactly one thing, so a test can assert the SPECIFIC finding rather
 * than "there was an error". Asserting only that something failed would be satisfied by a checker
 * that rejects every record for the wrong reason.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkDecisions, checkOwnExamples, checkRecord, canonicalize, decisionDigest } from "../scripts/decisions.mjs";
import { loadBettingPolicy } from "../scripts/policy.mjs";
import { validate, assertSchemaSupported } from "../scripts/jsonschema.mjs";


const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEG = path.join(ROOT, "test/fixtures/ledger-negative");

const schema = JSON.parse(await readFile(path.join(ROOT, "schemas/decision-record.schema.json"), "utf8"));
assertSchemaSupported(schema);
const policy = await loadBettingPolicy();

/** Check one fixture in isolation, so cross-record findings do not blur a single-record assertion. */
async function checkFixture(name) {
  const file = path.join(NEG, name);
  const record = JSON.parse(await readFile(file, "utf8"));
  return checkRecord(record, { policy, schema, file: `test/fixtures/ledger-negative/${name}` });
}

// These fixtures are this repository's own, and are judged against this repository's own thresholds.
// Named rather than defaulted: `checkDecisions` no longer supplies a policy, so a test that omitted
// one would be asking the checker to guess — the habit that produced ADR 0008.
const OWN_POLICY = path.join(ROOT, "betting-policy.yml");

const ids = (findings) => findings.map((f) => f.id);

// --- The worked examples ---------------------------------------------------------------------------

test("every worked example verifies with no errors", async () => {
  const result = await checkOwnExamples();
  const errors = result.findings.filter((f) => f.severity === "error");
  assert.deepEqual(errors, [], `the shipped examples must re-derive cleanly:\n${JSON.stringify(errors, null, 2)}`);
  assert.equal(result.records, 5);
});

test("the examples include both a BET and PASSes with distinct reasons", async () => {
  // A ledger of BETs only cannot demonstrate that anything is ever declined, which is the behaviour
  // Standard 20 exists to make visible.
  const result = await checkOwnExamples();
  assert.equal(result.records, 5);

  const files = ["DEC-20260809-001", "DEC-20260809-002", "DEC-20260809-003", "DEC-20260809-004", "DEC-20260808-005"];
  const decisions = {};
  for (const id of files) {
    const record = JSON.parse(await readFile(path.join(ROOT, `examples/ledger/${id}.json`), "utf8"));
    decisions[id] = { decision: record.decision.decision, reasons: record.decision.passReasons };
  }
  assert.equal(decisions["DEC-20260809-001"].decision, "BET");
  assert.equal(decisions["DEC-20260809-002"].decision, "PASS");
  assert.deepEqual(decisions["DEC-20260809-002"].reasons, ["edge-below-minimum"]);
  assert.deepEqual(decisions["DEC-20260809-003"].reasons, ["group-exposure-cap"]);
  assert.deepEqual(decisions["DEC-20260809-004"].reasons, ["stale-prediction"]);
});

test("an empty ledger reports that nothing was evaluated, and is not a pass", async () => {
  const result = await checkDecisions({ dir: path.join(ROOT, "test/fixtures/empty-ledger"), policyPath: OWN_POLICY });
  assert.equal(result.ledgerPresent, false, "a ledger that does not exist has not been checked");
  assert.deepEqual(result.findings, []);
});

// --- Known negatives -------------------------------------------------------------------------------

test("a recorded EV that does not follow from the inputs is caught", async () => {
  const findings = await checkFixture("ev-mismatch.json");
  assert.ok(ids(findings).includes("ev-mismatch"), ids(findings).join(", "));
  assert.match(findings.find((f) => f.id === "ev-mismatch").message, /expected value per unit/);
});

test("a fair probability equal to the raw implied probability is caught as ignored vig", async () => {
  const findings = await checkFixture("vig-ignored.json");
  assert.ok(ids(findings).includes("vig-ignored"), ids(findings).join(", "));
  assert.ok(
    findings.some((f) => /never removed/.test(f.message)),
    "the report should say the margin was never removed, not merely that a number disagrees",
  );
});

test("a BET below the minimum edge is caught", async () => {
  const findings = await checkFixture("negative-edge-bet.json");
  assert.ok(ids(findings).includes("negative-edge-bet"), ids(findings).join(", "));
});

test("a stake above the recommended stake and the single-bet cap is caught", async () => {
  const findings = await checkFixture("overstaked.json");
  assert.ok(ids(findings).includes("overstaked-bet"), ids(findings).join(", "));
});

test("a BET that breaches the total exposure cap is caught", async () => {
  const findings = await checkFixture("exposure-breach.json");
  assert.ok(ids(findings).includes("exposure-exceeded"), ids(findings).join(", "));
});

test("a BET on a stale price is caught", async () => {
  const findings = await checkFixture("stale-odds.json");
  const hit = findings.find((f) => f.id === "stale-odds");
  assert.ok(hit, ids(findings).join(", "));
  assert.equal(hit.severity, "error", "a stale price on a BET is an error, not advice");
});

test("an edited decision block is caught by the digest", async () => {
  const findings = await checkFixture("edited-history.json");
  assert.ok(ids(findings).includes("edited-history"), ids(findings).join(", "));
});

test("derived figures for a selection absent from the market are caught", async () => {
  const findings = await checkFixture("fabricated-odds.json");
  assert.ok(ids(findings).includes("selection-not-in-market"), ids(findings).join(", "));
});

test("a PASS blamed on discretion when a gate actually failed is caught", async () => {
  const findings = await checkFixture("pass-reasons-wrong.json");
  const hit = findings.find((f) => f.id === "pass-reasons-wrong");
  assert.ok(hit, ids(findings).join(", "));
  assert.match(hit.message, /edge-below-minimum/, "the report should name the gate that actually failed");
});

test("a market priced below certainty is reported as a warning, not an error", async () => {
  const findings = await checkFixture("negative-overround.json");
  const hit = findings.find((f) => f.id === "negative-overround");
  assert.ok(hit, ids(findings).join(", "));
  assert.equal(hit.severity, "warning");
  assert.match(hit.message, /stale or mistyped/, "the report should say what this usually means");
});

test("prose claiming certainty is caught", async () => {
  const findings = await checkFixture("guarantee-language.json");
  assert.ok(ids(findings).includes("guarantee-language"), ids(findings).join(", "));
});

test("a long price without the required discount is caught", async () => {
  const findings = await checkFixture("longshot-no-discount.json");
  assert.ok(ids(findings).includes("longshot-discount-missing"), ids(findings).join(", "));
});

test("a PASS that stakes money is caught", async () => {
  const findings = await checkFixture("pass-with-stake.json");
  assert.ok(ids(findings).includes("pass-with-stake"), ids(findings).join(", "));
});

test("a settlement dated before the decision is caught", async () => {
  const findings = await checkFixture("settled-before-decided.json");
  assert.ok(ids(findings).includes("settled-before-decided"), ids(findings).join(", "));
});

// --- The boundary ------------------------------------------------------------------------------------

test("BOUNDARY: an edge landing exactly on the minimum is a valid BET", async () => {
  // The tie rule. If this starts failing, the gate has silently become "strictly greater than" and
  // every decision sitting on the threshold flips from BET to PASS — a change nobody would notice
  // from the other tests, because they all sit comfortably on one side or the other.
  const record = JSON.parse(await readFile(path.join(NEG, "boundary-edge-exact-min.json"), "utf8"));
  assert.equal(record.decision.derived.adjustedEdge, policy.minEdge, "the fixture must sit exactly on the threshold");

  const findings = await checkFixture("boundary-edge-exact-min.json");
  const errors = findings.filter((f) => f.severity === "error");
  assert.deepEqual(errors, [], `a tie must meet the threshold:\n${JSON.stringify(errors, null, 2)}`);
});

// --- Cross-record ------------------------------------------------------------------------------------

test("a sequence of unsupported stake increases after losses is caught", async () => {
  const result = await checkDecisions({ dir: path.join(NEG, "martingale-seq"), policyPath: OWN_POLICY });
  const found = result.findings.map((f) => f.id);
  assert.ok(found.includes("stake-escalation-after-loss"), `expected the first escalation to warn: ${found.join(", ")}`);
  assert.ok(found.includes("martingale-pattern"), `expected the repeated escalation to error: ${found.join(", ")}`);

  const pattern = result.findings.find((f) => f.id === "martingale-pattern");
  assert.equal(pattern.severity, "error");
  assert.match(pattern.message, /own sizing arithmetic does not support/, "the report must say what makes it detectable");
});

test("disciplined sizing after a loss does NOT fire the escalation detector", async () => {
  // The detector's honesty requirement. A stake that grew because the record's own Kelly arithmetic
  // said so is indistinguishable from discipline, and flagging it would teach people to ignore the
  // finding. Only escalation the bettor's own maths does not support is reported.
  const first = JSON.parse(await readFile(path.join(NEG, "martingale-seq/01-loss.json"), "utf8"));
  const second = JSON.parse(await readFile(path.join(NEG, "martingale-seq/02-loss-doubled.json"), "utf8"));

  // Raise the recommended stake so the larger second wager is fully supported by its own sizing.
  const supported = structuredClone(second);
  supported.decision.derived.recommendedStake = 1000;
  supported.integrity.decisionDigest = decisionDigest(supported.decision);

  const { checkLedger } = await import("../scripts/decisions.mjs");
  const findings = checkLedger([
    { file: "a.json", record: first },
    { file: "b.json", record: supported },
  ]);
  assert.deepEqual(
    findings.filter((f) => f.id === "stake-escalation-after-loss" || f.id === "martingale-pattern"),
    [],
    "a Kelly-justified increase is not chasing",
  );
});

test("two records sharing an id are caught", async () => {
  const { checkLedger } = await import("../scripts/decisions.mjs");
  const record = JSON.parse(await readFile(path.join(ROOT, "examples/ledger/DEC-20260809-001.json"), "utf8"));
  const findings = checkLedger([
    { file: "a.json", record },
    { file: "b.json", record: structuredClone(record) },
  ]);
  assert.ok(findings.some((f) => f.id === "duplicate-record-id"));
});

// --- Digest mechanics --------------------------------------------------------------------------------

test("the digest is stable against key reordering and sensitive to any value change", async () => {
  const record = JSON.parse(await readFile(path.join(ROOT, "examples/ledger/DEC-20260809-001.json"), "utf8"));
  const original = decisionDigest(record.decision);
  assert.equal(original, record.integrity.decisionDigest, "the shipped example must carry a correct digest");

  // Reordering keys changes the JSON text but not the decision.
  const reordered = JSON.parse(JSON.stringify(record.decision));
  const flipped = { decision: reordered.decision, recordedAt: reordered.recordedAt, ...reordered };
  assert.equal(decisionDigest(flipped), original, "a reformat that changed nothing must not look like an edit");

  // Changing one recorded number does change it.
  const edited = structuredClone(record.decision);
  edited.derived.stake += 0.01;
  assert.notEqual(decisionDigest(edited), original, "a one-cent edit must be visible");
});

test("canonicalize sorts object keys but preserves array order", () => {
  const canon = canonicalize({ b: 1, a: [3, 1, 2] });
  assert.deepEqual(Object.keys(canon), ["a", "b"]);
  assert.deepEqual(canon.a, [3, 1, 2], "a line history is chronological; sorting it would destroy information");
});

test("outcome sits outside the digest, so settling a wager never disturbs the decision", async () => {
  const record = JSON.parse(await readFile(path.join(ROOT, "examples/ledger/DEC-20260809-001.json"), "utf8"));
  const before = decisionDigest(record.decision);
  const settled = structuredClone(record);
  settled.outcome = { result: "loss", settledAt: "2026-08-10T01:00:00-04:00", profitUnits: -206.5 };
  assert.equal(decisionDigest(settled.decision), before, "appending a result must not change what was decided");
});

// Every finding must bind to a rule the catalog defines — the mechanical guard on the three-way
// separation. That test needs the catalog, so it lives in test/audit.test.mjs beside the other
// binding assertions rather than here.

test("the shipped schema accepts every worked example", async () => {
  for (const id of ["DEC-20260809-001", "DEC-20260809-002", "DEC-20260809-003", "DEC-20260809-004", "DEC-20260808-005"]) {
    const record = JSON.parse(await readFile(path.join(ROOT, `examples/ledger/${id}.json`), "utf8"));
    assert.deepEqual(validate(record, schema), [], `${id} does not satisfy the record schema`);
  }
});
