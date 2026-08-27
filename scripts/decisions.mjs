#!/usr/bin/env node
/**
 * The decision checker: re-derive every recorded number, then re-evaluate the decision rule.
 *
 * This is the part of the pack that cannot be argued with. A decision record states a price, a
 * probability estimate, an uncertainty discount, a bankroll, and then states what it derived from
 * them. This module recomputes every derived value and disagrees when they differ. Nothing under
 * `derived` is trusted, including the decision itself: whether a record should have been a BET is
 * recomputed from the policy thresholds, and a BET that fails any gate is a finding no matter what
 * the record says.
 *
 * WHY RE-DERIVATION IS THE RIGHT VERIFICATION FORM HERE. Most standards frameworks can only check
 * that a field is present, because the field's content is prose. Betting evidence is arithmetic, and
 * arithmetic can be checked. That is what lets so many rules in this pack carry `assurance: full`.
 *
 * WHAT IT STILL CANNOT ESTABLISH, stated plainly because the catalog states it per rule: that the
 * recorded odds were the odds the book was actually showing, that the probability estimate was
 * produced honestly, or that every wager placed was recorded at all. Re-derivation proves the
 * arithmetic is consistent with the inputs. It does not prove the inputs are true. Every finding
 * below is scoped to the recorded universe, and Standard 18 R1 is the load-bearing assumption that
 * the recorded universe is the whole one.
 *
 * Exit 0 verified (including "nothing to verify"), 1 findings, 2 unreadable schema or policy.
 * Exit 2 is never reported as a record failure: "the policy could not be read" and "this record is
 * wrong" are different facts.
 */

import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { validate, assertSchemaSupported } from "./jsonschema.mjs";
import { loadBettingPolicy } from "./policy.mjs";
import * as bm from "./betmath.mjs";

const EXIT_OK = 0;
const EXIT_FINDINGS = 1;
const EXIT_INVOCATION = 2;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SCHEMA = path.join(ROOT, "schemas/decision-record.schema.json");

/**
 * THIS PACK's betting policy. It governs THIS pack's worked examples and nothing else.
 *
 * A caller evaluating anyone else's records must name the policy those records were decided under.
 * Falling back to this file for a directory that is not this repository's is how a project's
 * decisions get judged against thresholds it never declared — a verdict about the wrong numbers,
 * shaped exactly like a correct one.
 */
const OWN_POLICY = path.join(ROOT, "betting-policy.yml");

/**
 * Phrases that claim certainty about a wager.
 *
 * This is a string scan and is documented as one, in the catalog and here. It catches the careless
 * case, which is the common one; it cannot catch a paraphrase, and reporting it as though it proved
 * the absence of overclaiming would be exactly the false assurance this pack refuses elsewhere. The
 * rule it binds to carries assurance `partial` for that reason.
 */
const CERTAINTY_PHRASES = [
  "guaranteed",
  "guarantee",
  "can't lose",
  "cannot lose",
  "sure thing",
  "lock",
  "risk-free",
  "riskless",
  "no-brainer",
  "due for",
  "due to win",
  "must win",
];

/** Every finding this checker can produce, with the catalog rule each binds to. */
export const FINDING_RULES = {
  "unparseable-record": "record.decision-record-required",
  "schema-invalid": "record.decision-record-required",
  "duplicate-record-id": "record.decision-record-required",
  "ev-mismatch": "ev.computed-and-recorded",
  "vig-ignored": "vig.no-ignored-vig",
  "fabricated-odds": "odds.no-fabrication",
  "selection-not-in-market": "odds.quote-provenance",
  "price-format-mismatch": "odds.conversion-exact",
  "negative-edge-bet": "edge.threshold-respected",
  "overstaked-bet": "bankroll.stake-within-unit-rules",
  "exposure-exceeded": "exposure.no-cap-breaches",
  "stale-odds": "line.staleness-checked",
  "stale-prediction": "line.staleness-checked",
  "post-start-decision": "decision.pipeline-complete",
  "edited-history": "record.no-silent-revision",
  "pass-reasons-wrong": "decision.pass-is-success",
  "pass-with-stake": "record.pass-recorded",
  "negative-overround": "vig.overround-computed",
  "longshot-discount-missing": "uncertainty.discount-applied",
  "guarantee-language": "uncertainty.no-guaranteed-language",
  "stake-escalation-after-loss": "bankroll.no-loss-driven-sizing",
  "martingale-pattern": "bankroll.no-martingale",
  "settled-before-decided": "record.results-separated",
  "outcome-without-digest": "record.no-silent-revision",
  "clv-mismatch": "line.clv-computed",
};

/**
 * Every catalog rule whose disposition a run of this checker establishes.
 *
 * WHY THIS LIVES HERE AND NOT IN THE EVALUATOR. `standards validate` has to know which rules lose
 * their evidence when decision evaluation does not run — an absent ledger, an empty one, or a target
 * that never declared the thresholds its records would be judged against. It used to answer that by
 * matching rule-id prefixes in `standards.mjs`, a hand-maintained approximation of this module's
 * behaviour kept one file away from the code that produces the findings.
 *
 * That approximation was wrong and was measured wrong: it missed `edge.threshold-respected`,
 * `edge.no-fabricated-edge` and `edge.no-probability-only-bets`, so a 25-record ledger the checker
 * never opened still reported those three as passed with full assurance. An enumeration maintained
 * outside the authority that creates the findings cannot be kept true, because nothing forces the two
 * to move together. This list is inside that authority, and test/supplied-rules.test.mjs mutates it
 * to prove the evaluator reads it rather than a second copy.
 *
 * MOST OF THESE RULES PASS SILENTLY. Only the rules named in FINDING_RULES can carry a finding; the
 * rest are established by this checker running to completion over records and disagreeing with
 * nothing. That is exactly why they must be listed: a rule that passes by the absence of a finding is
 * a rule that passes by default when no finding could have been produced at all.
 *
 * NOT INCLUDED, because a different source establishes them: `edge.minimum-threshold-defined`,
 * `bankroll.defined-in-policy`, `bankroll.unit-defined`, `exposure.caps-defined`,
 * `decision.no-bet-quota` (all from the betting policy's own contents) and
 * `evaluation.process-metrics-defined` (from a document). Those survive a skipped ledger honestly,
 * because their evidence was never in the records.
 */
export const SUPPLIED_RULES = [
  // Re-derived arithmetic.
  "probability.implied-from-price",
  "vig.overround-computed",
  "vig.no-ignored-vig",
  "vig.removal-method-declared",
  "edge.computed-from-inputs",
  "edge.threshold-respected",
  "edge.no-fabricated-edge",
  "ev.computed-and-recorded",
  "ev.no-fabricated-ev",
  "uncertainty.discount-applied",
  "uncertainty.estimate-recorded",
  "bankroll.stake-within-unit-rules",
  "exposure.aggregate-computed",
  "exposure.correlated-bets-aggregated",
  "exposure.no-cap-breaches",
  "line.staleness-checked",
  "line.clv-computed",
  "line.movement-recorded",
  // The record's structure and provenance fields.
  "odds.conversion-exact",
  "odds.quote-provenance",
  "odds.no-fabrication",
  "probability.fair-source-recorded",
  "edge.no-probability-only-bets",
  "decision.pipeline-complete",
  "decision.no-priceless-recommendations",
  "decision.pass-is-success",
  "record.decision-record-required",
  "record.pass-recorded",
  "record.results-separated",
  "record.no-silent-revision",
  // Scans of recorded prose.
  "uncertainty.no-guaranteed-language",
  "uncertainty.no-hidden-uncertainty",
  "ev.no-unsupported-ev-claims",
  // Established across records rather than within one.
  "bankroll.no-martingale",
  "bankroll.no-loss-driven-sizing",
];

/**
 * Canonical JSON: object keys sorted recursively, arrays left in order.
 *
 * Array order is meaningful here (a line history is chronological, a market's outcomes are as quoted)
 * so sorting them would destroy information. Key order is not meaningful, so fixing it is what makes
 * the digest stable against a reformat that changed nothing.
 */
export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
    return out;
  }
  return value;
}

/** The digest a record's `decision` block must carry. */
export function decisionDigest(decision) {
  return createHash("sha256").update(JSON.stringify(canonicalize(decision))).digest("hex");
}

const finding = (id, message, extra = {}) => ({
  id,
  rule: FINDING_RULES[id] ?? null,
  severity: extra.severity ?? "error",
  message,
  ...extra,
});

const minutesBetween = (later, earlier) => (Date.parse(later) - Date.parse(earlier)) / 60000;

/**
 * Check one record. `policyDigest` is the digest of the betting policy as it is on disk now.
 *
 * Returns findings only — no exceptions for bad data, because a malformed record is a finding rather
 * than a crash. The one thing that does throw is a policy or schema that cannot be read, and that is
 * handled by the caller as exit 2.
 */
export function checkRecord(record, { policy, policyDigest, schema, file }) {
  const findings = [];
  const at = (id, message, extra) => findings.push(finding(id, message, { file, ...extra }));

  const errors = validate(record, schema);
  if (errors.length > 0) {
    for (const error of errors.slice(0, 10)) {
      at("schema-invalid", `${error.path || "(document)"}: ${error.message}`);
    }
    return findings; // Every check below assumes the shape the schema guarantees.
  }

  const d = record.decision;
  const derived = d.derived;
  const isBet = d.decision === "BET";

  // --- Tamper evidence -------------------------------------------------------------------------
  // Checked first: if the decision block was edited after recording, nothing else in it can be
  // relied on, and the arithmetic agreeing would only mean the editor was careful.
  const expectedDigest = decisionDigest(d);
  if (record.integrity.decisionDigest !== expectedDigest) {
    at(
      "edited-history",
      `the decision digest does not match its contents (recorded ${record.integrity.decisionDigest.slice(0, 12)}…, computed ${expectedDigest.slice(0, 12)}…). A decision-time field changed after the record was written.`,
    );
  }
  if (record.outcome && !record.integrity?.decisionDigest) {
    at("outcome-without-digest", "a settled record carries no decision digest, so nothing fixes what was decided");
  }

  // --- Provenance ------------------------------------------------------------------------------
  // A price with no source or timestamp, or a probability with no source, cannot be distinguished
  // from one that was invented. The schema already requires the fields; this checks they are not
  // hollow and that the quoted price is internally consistent.
  const offered = d.market.offered;
  if (offered.format === "american" && offered.american !== undefined) {
    let fromAmerican = null;
    try {
      fromAmerican = bm.decimalFromAmerican(offered.american);
    } catch (error) {
      at("fabricated-odds", `the quoted american odds are not a price: ${error.message}`);
    }
    if (fromAmerican !== null && !bm.nearlyEqual(fromAmerican, offered.decimal, bm.TOL_PROB)) {
      at(
        "price-format-mismatch",
        `american ${offered.american} converts to decimal ${bm.roundTo(fromAmerican, 6)}, but the record states ${offered.decimal}`,
      );
    }
  }
  if (offered.format === "fractional" && offered.fractional) {
    const fromFractional = bm.decimalFromFractional(offered.fractional.numerator, offered.fractional.denominator);
    if (!bm.nearlyEqual(fromFractional, offered.decimal, bm.TOL_PROB)) {
      at(
        "price-format-mismatch",
        `fractional ${offered.fractional.numerator}/${offered.fractional.denominator} converts to decimal ${bm.roundTo(fromFractional, 6)}, but the record states ${offered.decimal}`,
      );
    }
  }

  const outcomes = d.market.fullMarket;
  const selected = outcomes.find((o) => o.selection === d.event.selection);
  if (!selected) {
    at(
      "selection-not-in-market",
      `the selection '${d.event.selection}' does not appear in the recorded market, so the price cannot be traced to a quote`,
    );
  } else if (!bm.nearlyEqual(selected.decimal, offered.decimal, bm.TOL_PROB)) {
    at(
      "fabricated-odds",
      `the offered price ${offered.decimal} does not match the market's price for '${d.event.selection}' (${selected.decimal})`,
    );
  }

  // --- Re-derivation ---------------------------------------------------------------------------
  // The core of the check. Each stage is recomputed from the inputs beside it, so a disagreement
  // names the stage that is wrong rather than reporting that the record "does not add up".
  const impliedProbs = outcomes.map((o) => bm.impliedFromDecimal(o.decimal));

  // Each stage binds to the rule that governs it, rather than every mismatch reporting under one
  // generic id. The precision is what lets the evaluator claim honestly that it evaluated
  // `probability.implied-from-price` — a coarse binding would mean a broken implied probability was
  // reported as an expected-value problem, and the implied-probability rule would have been checked
  // by nothing while appearing to pass.
  const expect = (id, rule, label, actual, expected, tolerance) => {
    if (!bm.nearlyEqual(actual, expected, tolerance)) {
      findings.push(
        finding(id, `${label}: recorded ${actual}, recomputes to ${bm.roundTo(expected, tolerance === bm.TOL_MONEY ? bm.DP_MONEY : bm.DP_PROB)}`, {
          file,
          rule,
        }),
      );
      return false;
    }
    return true;
  };

  const impliedProb = bm.impliedFromDecimal(offered.decimal);
  expect("ev-mismatch", "probability.implied-from-price", "implied probability", derived.impliedProb, impliedProb, bm.TOL_PROB);

  const over = bm.overround(impliedProbs);
  expect("ev-mismatch", "vig.overround-computed", "overround", derived.overround, over, bm.TOL_PROB);
  if (over < -bm.TOL_PROB) {
    at(
      "negative-overround",
      `the recorded market's prices sum to less than certainty (overround ${bm.roundTo(over, 6)}). A claimed arbitrage is far more often a stale or mistyped snapshot than free money; verify the quote before acting on it.`,
      { severity: "warning" },
    );
  }

  if (derived.vigMethod !== "multiplicative") {
    at("vig-ignored", `unknown vig removal method '${derived.vigMethod}'`);
  }
  if (selected) {
    const fairProbs = bm.fairProbsMultiplicative(impliedProbs);
    const marketFair = fairProbs[outcomes.indexOf(selected)];
    // The comparison below is against the RECORDED implied probability, not the freshly computed one.
    // Both recorded values carry the same rounding, so they can be compared at a single rounding's
    // tolerance; comparing a rounded value against a full-precision one needs twice that, and using
    // the tighter tolerance there silently missed the very case this branch exists to catch.
    if (
      !expect("vig-ignored", "vig.no-ignored-vig", "market fair probability", derived.marketFairProb, marketFair, bm.TOL_PROB) &&
      bm.nearlyEqual(derived.marketFairProb, derived.impliedProb, bm.TOL_PROB)
    ) {
      at(
        "vig-ignored",
        "the recorded fair probability equals the raw implied probability, so the bookmaker's margin was never removed",
      );
    }
  }

  const rawEdge = d.prediction.fairProb - impliedProb;
  expect("ev-mismatch", "edge.computed-from-inputs", "raw edge", derived.rawEdge, rawEdge, bm.TOL_PROB);

  const adjEdge = bm.adjustedEdge(rawEdge, d.uncertaintyDiscount);
  expect("ev-mismatch", "uncertainty.discount-applied", "adjusted edge", derived.adjustedEdge, adjEdge, bm.TOL_PROB);
  expect("ev-mismatch", "uncertainty.discount-applied", "adjusted probability", derived.adjustedProb, impliedProb + adjEdge, bm.TOL_PROB);

  const ev = offered.decimal * adjEdge;
  expect("ev-mismatch", "ev.computed-and-recorded", "expected value per unit", derived.evPerUnit, ev, bm.TOL_PROB);
  // The identity EV = adjustedProb x decimal - 1 is the same number by another route. Checking both
  // means a single transposed input shows up as an inconsistency rather than as a plausible figure.
  const evViaProb = (impliedProb + adjEdge) * offered.decimal - 1;
  if (!bm.nearlyEqual(ev, evViaProb, bm.TOL_PROB)) {
    at("ev-mismatch", `the two routes to expected value disagree: ${ev} via edge, ${evViaProb} via probability`);
  }

  const kelly = adjEdge > 0 ? bm.kellyFraction(impliedProb + adjEdge, offered.decimal) : 0;
  expect("ev-mismatch", "bankroll.stake-within-unit-rules", "full Kelly fraction", derived.kellyFullFraction, kelly, bm.TOL_PROB);

  const bankroll = d.bankroll.current;
  const kellyStake = bankroll * policy.kellyMultiplier * kelly;
  const capStake = bankroll * policy.maxSingleBetPct;
  const recommended = Math.min(kellyStake, capStake);
  expect("ev-mismatch", "bankroll.stake-within-unit-rules", "recommended stake", derived.recommendedStake, recommended, bm.TOL_MONEY);

  expect(
    "ev-mismatch",
    "bankroll.defined-in-policy",
    "stake as a percentage of bankroll",
    derived.stakePercentOfBankroll,
    derived.stake / bankroll,
    bm.TOL_PROB,
  );

  const open = d.openExposure ?? [];
  const totals = bm.exposureTotals(open);
  const groupBefore = d.correlationGroup ? (totals.byGroup.get(d.correlationGroup) ?? 0) : 0;
  expect("ev-mismatch", "exposure.correlated-bets-aggregated", "group exposure after", derived.groupExposureAfter, groupBefore + derived.stake, bm.TOL_MONEY);
  expect("ev-mismatch", "exposure.aggregate-computed", "total exposure after", derived.totalExposureAfter, totals.total + derived.stake, bm.TOL_MONEY);

  // --- The decision rule -----------------------------------------------------------------------
  // Recomputed independently of what the record decided. Comparisons use the RECORDED values, which
  // the re-derivation above has already confirmed are honest, and are exact: a tie meets a threshold.
  //
  // The stake the gates are evaluated against is the CONTEMPLATED one, which differs by decision.
  // For a BET it is the stake actually placed. For a PASS it is the recommended stake — the amount
  // the pipeline would have staked had it got that far — because a PASS stakes nothing, and
  // evaluating a zero stake against an exposure cap would clear every stake-related gate by
  // construction. Without this distinction a PASS taken *because* it would have breached a cap could
  // only ever record its reason as "discretionary", which is precisely the wrong lesson: it would
  // make a disciplined refusal indistinguishable from a shrug.
  const contemplatedStake = isBet ? derived.stake : derived.recommendedStake;
  const contemplatedGroup = derived.groupExposureAfter - derived.stake + contemplatedStake;
  const contemplatedTotal = derived.totalExposureAfter - derived.stake + contemplatedStake;

  const gates = [];
  const fail = (name, detail) => gates.push({ name, detail });

  if (derived.adjustedEdge < policy.minEdge) {
    fail("edge-below-minimum", `adjusted edge ${derived.adjustedEdge} is below the minimum ${policy.minEdge}`);
  }
  if (derived.evPerUnit <= 0) {
    fail("non-positive-ev", `expected value per unit is ${derived.evPerUnit}`);
  }
  if (contemplatedStake / bankroll > policy.maxSingleBetPct + bm.TOL_PROB) {
    fail(
      "single-bet-cap",
      `a stake of ${bm.roundTo(contemplatedStake, bm.DP_MONEY)} is ${bm.roundTo(contemplatedStake / bankroll, bm.DP_PROB)} of bankroll, above the cap ${policy.maxSingleBetPct}`,
    );
  }
  if (contemplatedStake > derived.recommendedStake + bm.TOL_MONEY) {
    fail("over-recommended-stake", `stake ${derived.stake} exceeds the recommended ${derived.recommendedStake}`);
  }
  if (contemplatedGroup > bankroll * policy.maxGroupExposurePct + bm.TOL_MONEY) {
    fail(
      "group-exposure-cap",
      `group exposure would reach ${bm.roundTo(contemplatedGroup, bm.DP_MONEY)}, above the cap ${bm.roundTo(bankroll * policy.maxGroupExposurePct, bm.DP_MONEY)}`,
    );
  }
  if (contemplatedTotal > bankroll * policy.maxTotalExposurePct + bm.TOL_MONEY) {
    fail(
      "total-exposure-cap",
      `total exposure would reach ${bm.roundTo(contemplatedTotal, bm.DP_MONEY)}, above the cap ${bm.roundTo(bankroll * policy.maxTotalExposurePct, bm.DP_MONEY)}`,
    );
  }

  const oddsAge = minutesBetween(d.recordedAt, d.market.capturedAt);
  if (oddsAge > policy.maxOddsAgeMinutes) {
    fail("stale-odds", `the price was captured ${Math.round(oddsAge)} minutes before the decision`);
  }
  const predictionAge = minutesBetween(d.recordedAt, d.prediction.predictedAt);
  if (predictionAge > policy.maxPredictionAgeMinutes) {
    fail("stale-prediction", `the prediction was made ${Math.round(predictionAge)} minutes before the decision`);
  }
  if (Date.parse(d.recordedAt) >= Date.parse(d.event.eventStartsAt)) {
    fail("event-already-started", "the decision was recorded at or after the event start");
  }
  if (offered.decimal >= policy.longshotOddsThreshold && d.uncertaintyDiscount < policy.longshotMinDiscount) {
    fail(
      "longshot-discount-floor",
      `a price of ${offered.decimal} requires an uncertainty discount of at least ${policy.longshotMinDiscount}, but the record applies ${d.uncertaintyDiscount}`,
    );
  }

  const failedGates = gates.map((g) => g.name);

  if (isBet && gates.length > 0) {
    // A BET past a failed gate. The specific finding matters, because remediation differs: a thin
    // edge is a PASS, an overstake is a smaller stake, a stale price is a fresh quote.
    for (const gate of gates) {
      const id =
        gate.name === "edge-below-minimum" || gate.name === "non-positive-ev"
          ? "negative-edge-bet"
          : gate.name === "single-bet-cap" || gate.name === "over-recommended-stake"
            ? "overstaked-bet"
            : gate.name === "group-exposure-cap" || gate.name === "total-exposure-cap"
              ? "exposure-exceeded"
              : gate.name === "stale-odds"
                ? "stale-odds"
                : gate.name === "stale-prediction"
                  ? "stale-prediction"
                  : gate.name === "event-already-started"
                    ? "post-start-decision"
                    : "longshot-discount-missing";
      at(id, `BET recorded despite a failed gate — ${gate.detail}`);
    }
  }

  if (!isBet) {
    if (derived.stake !== 0) {
      at("pass-with-stake", `a PASS record stakes ${derived.stake}; a PASS risks nothing`);
    }
    // A PASS is always legitimate, so the check is not "should this have been a PASS" but "does the
    // record say honestly why". A discretionary PASS with every gate passing is valid and common.
    const recorded = [...d.passReasons].sort();
    const expected = failedGates.length > 0 ? [...failedGates].sort() : ["discretionary"];
    if (recorded.length === 0) {
      at("pass-reasons-wrong", "a PASS record states no reason");
    } else if (recorded.join(",") !== expected.join(",")) {
      at(
        "pass-reasons-wrong",
        `the recorded PASS reasons [${recorded.join(", ")}] do not match the gates that actually failed [${expected.join(", ")}]`,
      );
    }
  } else if (d.passReasons.length > 0) {
    at("pass-reasons-wrong", "a BET record carries PASS reasons");
  }

  // Stale inputs on a PASS are worth knowing about but are not a failure: declining to bet on a stale
  // price is the correct response to a stale price.
  if (!isBet) {
    if (failedGates.includes("stale-odds")) {
      at("stale-odds", "the price behind this PASS was already stale", { severity: "warning" });
    }
    if (failedGates.includes("stale-prediction")) {
      at("stale-prediction", "the prediction behind this PASS was already stale", { severity: "warning" });
    }
  }

  // --- Language --------------------------------------------------------------------------------
  const prose = [d.rationale, d.prediction.rationale, record.outcome?.processReview].filter(Boolean).join(" ");
  const lowered = prose.toLowerCase();
  for (const phrase of CERTAINTY_PHRASES) {
    if (lowered.includes(phrase)) {
      at("guarantee-language", `the record's prose claims certainty: '${phrase}'`);
      break;
    }
  }

  // --- Settlement ------------------------------------------------------------------------------
  if (record.outcome) {
    const o = record.outcome;
    if (o.settledAt && Date.parse(o.settledAt) <= Date.parse(d.recordedAt)) {
      at("settled-before-decided", "the settlement timestamp is at or before the decision timestamp");
    }
    if (o.closingDecimal !== undefined && o.clvPct !== undefined) {
      expect("clv-mismatch", "line.clv-computed", "closing-line value", o.clvPct, bm.clvPercent(offered.decimal, o.closingDecimal), bm.TOL_PROB);
    }
    if (o.result !== undefined && o.profitUnits !== undefined) {
      expect(
        "ev-mismatch",
        "record.results-separated",
        "profit",
        o.profitUnits,
        bm.profitUnits(o.result, derived.stake, offered.decimal),
        bm.TOL_MONEY,
      );
    }
  }

  return findings;
}

/**
 * Cross-record checks: the things no single record can show.
 *
 * The escalation detector deserves its caveat in the open. It fires when a stake grows after a loss
 * AND exceeds what the record's own Kelly arithmetic recommended. A stake that grew because the
 * bettor's own numbers said so is indistinguishable from discipline, and flagging it would train
 * people to ignore the finding. What is detectable is escalation the bettor's own maths does not
 * support, following losses — which is what chasing looks like from the outside. Intent is not
 * mechanically knowable, and the catalog says so.
 */
export function checkLedger(records) {
  const findings = [];
  const at = (id, message, extra = {}) => findings.push(finding(id, message, extra));

  const byId = new Map();
  for (const { file, record } of records) {
    if (byId.has(record.id)) {
      at("duplicate-record-id", `record id ${record.id} is used by both ${byId.get(record.id)} and ${file}`, { file });
    } else {
      byId.set(record.id, file);
    }
  }

  const bets = records
    .filter(({ record }) => record.decision.decision === "BET")
    .sort((a, b) => Date.parse(a.record.decision.recordedAt) - Date.parse(b.record.decision.recordedAt));

  let consecutiveEscalations = 0;
  for (let i = 1; i < bets.length; i++) {
    const previous = bets[i - 1].record;
    const current = bets[i].record;
    const previousLost = previous.outcome?.result === "loss";
    const grew = current.decision.derived.stakePercentOfBankroll > previous.decision.derived.stakePercentOfBankroll;
    const unsupported =
      current.decision.derived.stake > current.decision.derived.recommendedStake + bm.TOL_MONEY;

    if (previousLost && grew && unsupported) {
      consecutiveEscalations++;
      if (consecutiveEscalations >= 2) {
        at(
          "martingale-pattern",
          `${current.id} continues a sequence of stake increases following losses that the records' own sizing arithmetic does not support — ${consecutiveEscalations + 1} consecutive escalations`,
          { file: bets[i].file },
        );
      } else {
        at(
          "stake-escalation-after-loss",
          `${current.id} stakes more than ${previous.id} after that wager lost, and more than its own recommended stake`,
          { file: bets[i].file, severity: "warning" },
        );
      }
    } else {
      consecutiveEscalations = 0;
    }
  }

  return findings;
}

async function readLedger(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return null; // No ledger. Distinct from an empty one, and reported as such.
  }
  const records = [];
  const findings = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) {
      const nested = await readLedger(path.join(dir, entry.name));
      if (nested) {
        records.push(...nested.records);
        findings.push(...nested.findings);
      }
      continue;
    }
    if (!entry.name.endsWith(".json")) continue;
    const file = path.join(dir, entry.name);
    const relative = path.relative(ROOT, file).replace(/\\/g, "/");
    try {
      records.push({ file: relative, record: JSON.parse(await readFile(file, "utf8")) });
    } catch (error) {
      findings.push(finding("unparseable-record", `${relative}: ${error.message}`, { file: relative }));
    }
  }
  return { records, findings };
}

/**
 * Programmatic entry point, shared by the CLI and by `standards audit`.
 *
 * `policyPath` is REQUIRED and has no default. It used to default to this pack's own
 * `betting-policy.yml`, which is how `validate <target>` came to judge someone else's decisions
 * against our thresholds (ADR 0008). The command layer now refuses `--dir`/`--record` without
 * `--policy`, but a default here would leave the same mistake one direct call away from being made
 * again by a caller that never passes through `parseArgs`. A checker that will silently supply the
 * numbers is not a general checker; the one legitimate case has its own door, `checkOwnExamples`.
 */
export async function checkDecisions({ dir, schemaPath = DEFAULT_SCHEMA, policyPath, record: single } = {}) {
  if (!policyPath) {
    throw new Error(
      "checkDecisions requires policyPath: records are judged against the policy they were decided under.\n" +
        "  For this repository's own worked examples, call checkOwnExamples().",
    );
  }
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  assertSchemaSupported(schema);
  // One path, resolved once. It used to be defaulted twice — `loadBettingPolicy` supplied its own
  // fallback and the digest read supplied another — which agreed only because both happened to name
  // the same file. Two defaults that must stay in step are a digest that can end up describing a
  // policy other than the one the records were judged under.
  const policy = await loadBettingPolicy(policyPath);
  const policyDigest = createHash("sha256").update(await readFile(policyPath, "utf8")).digest("hex");

  let records = [];
  const findings = [];

  if (single) {
    const relative = path.relative(ROOT, single).replace(/\\/g, "/");
    try {
      records = [{ file: relative, record: JSON.parse(await readFile(single, "utf8")) }];
    } catch (error) {
      findings.push(finding("unparseable-record", `${relative}: ${error.message}`, { file: relative }));
    }
  } else {
    const ledger = await readLedger(dir);
    if (ledger === null) return { records: 0, findings: [], ledgerPresent: false, suppliedRules: SUPPLIED_RULES };
    records = ledger.records;
    findings.push(...ledger.findings);
  }

  for (const { file, record } of records) {
    findings.push(...checkRecord(record, { policy, policyDigest, schema, file }));
  }
  findings.push(...checkLedger(records));

  // `suppliedRules` travels with the result so a caller deciding what this run established never has
  // to reconstruct it. It is the same list whether the run found records or none, because what the
  // checker OWNS does not depend on what it found — only on whether it ran.
  return { records: records.length, findings, ledgerPresent: true, suppliedRules: SUPPLIED_RULES };
}

/**
 * Check this repository's own worked examples against this repository's own betting policy.
 *
 * The self-checkout case, given its own name so the only legitimate use of `OWN_POLICY` cannot be
 * mistaken for generic behaviour. Every other caller names the policy its records were decided under.
 */
export async function checkOwnExamples({ schemaPath = DEFAULT_SCHEMA } = {}) {
  return checkDecisions({ dir: path.join(ROOT, "examples/ledger"), schemaPath, policyPath: OWN_POLICY });
}

function parseArgs(argv) {
  const options = { dir: null, record: null, policyPath: null, json: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") options.json = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--record") options.record = argv[++i];
    else if (arg === "--dir") options.dir = argv[++i];
    else if (arg === "--policy") options.policyPath = argv[++i];
    else if (arg.startsWith("--")) throw new Error(`unknown flag '${arg}'`);
    else if (options.dir === null) options.dir = arg;
    else throw new Error(`unexpected argument '${arg}'`);
  }

  // Records from somewhere else need a policy from somewhere else. Refusing is the whole point: the
  // alternative is this pack's thresholds silently judging another project's decisions, which exits 0
  // and reads as a clean bill of health. `standards validate` needs no flag because it knows the
  // target's root and reads the policy from it; `check` is handed a ledger directory and cannot
  // derive a repository root from it without guessing.
  if ((options.dir || options.record) && !options.policyPath) {
    throw new Error(
      "records outside this repository must be checked against their own policy — pass --policy <path>.\n" +
        "  With no --dir and no --record, this command checks this repository's own examples/ledger\n" +
        "  against its own betting-policy.yml, which is the only case where the default is the truth.",
    );
  }

  // Explicit rather than left null, so the value that reaches `checkDecisions` is the value this
  // function decided on. A null would silently take the parameter default instead, which is the
  // second place a default could live.
  options.policyPath ??= OWN_POLICY;

  if (options.record && !options.dir) return options;
  options.dir ??= path.join(ROOT, "examples/ledger");
  return options;
}

export function render(result, { dryRun }) {
  const out = [];
  const errors = result.findings.filter((f) => f.severity === "error");
  const warnings = result.findings.filter((f) => f.severity === "warning");

  if (!result.ledgerPresent) {
    out.push("No ledger directory found. NOTHING WAS EVALUATED.");
    out.push("");
    out.push("This is not a pass. A ledger that does not exist has not been checked, and an absent");
    out.push("ledger is also how an unrecorded wager stays unrecorded.");
    return out.join("\n") + "\n";
  }

  out.push(dryRun ? "Draft decision (not yet in the ledger)" : `Decision records checked: ${result.records}`);
  out.push(`Errors:   ${errors.length}`);
  out.push(`Warnings: ${warnings.length}`);
  out.push("");

  for (const f of [...errors, ...warnings]) {
    out.push(`  ${f.severity.toUpperCase()} ${f.id}${f.file ? ` — ${f.file}` : ""}`);
    out.push(`      ${f.message}`);
    if (f.rule) out.push(`      rule: ${f.rule}`);
    out.push("");
  }

  if (result.records === 0) {
    out.push("The ledger is empty. NOTHING WAS EVALUATED — this is not a pass.");
  } else if (errors.length === 0 && warnings.length === 0) {
    out.push("Every recorded number re-derives from its inputs, and every decision matches the rule.");
    out.push("");
    out.push("This establishes that the arithmetic is consistent with what was recorded. It does not");
    out.push("establish that the recorded odds were real, that the probability estimates were honest,");
    out.push("or that every wager placed was recorded at all.");
  } else if (errors.length === 0) {
    out.push("No errors. The warnings above are worth reading before acting on these records.");
  }
  return out.join("\n") + "\n";
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`standards check: ${error.message}\n`);
    process.exit(EXIT_INVOCATION);
  }

  let result;
  try {
    result = await checkDecisions(options);
  } catch (error) {
    // Unreadable schema or policy. Exit 2, never 1: this is not a statement about any record.
    process.stderr.write(`standards check: ${error.message}\n`);
    process.exit(EXIT_INVOCATION);
  }

  if (options.json) {
    process.stdout.write(JSON.stringify({ schemaVersion: "1.0", ...result }, null, 2) + "\n");
  } else {
    process.stdout.write(render(result, options));
  }

  process.exit(result.findings.some((f) => f.severity === "error") ? EXIT_FINDINGS : EXIT_OK);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
