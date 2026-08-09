/**
 * Known-answer tests for the betting arithmetic.
 *
 * Every vector here has a value computed by hand, not captured from a run. A test that asserts
 * whatever the code produced today is a change detector, not a correctness check, and it would happily
 * lock in a wrong formula. Where a value is exact in decimal (0.40, 0.05, 0.10) it is asserted
 * exactly; where it is a repeating fraction it is asserted against the fraction (21/11, 11/21, 96/251)
 * rather than against a copied decimal expansion.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  BetMathError,
  EPS,
  DP_PROB,
  DP_MONEY,
  decimalFromAmerican,
  americanFromDecimal,
  decimalFromFractional,
  impliedFromDecimal,
  overround,
  fairProbsMultiplicative,
  edge,
  evPerUnit,
  evPerUnitWithPush,
  adjustedEdge,
  adjustedProb,
  kellyFraction,
  stakeFromKelly,
  unitStake,
  bankrollPercent,
  exposureTotals,
  clvPercent,
  profitUnits,
  roundTo,
  nearlyEqual,
} from "../scripts/betmath.mjs";

const close = (actual, expected, tol = EPS, message) =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    message ?? `expected ${expected}, got ${actual} (difference ${Math.abs(actual - expected)})`,
  );

// --- Odds conversion -----------------------------------------------------------------------------

test("−110 is 21/11 in decimal and records as 1.909091", () => {
  close(decimalFromAmerican(-110), 21 / 11);
  assert.equal(roundTo(decimalFromAmerican(-110), DP_PROB), 1.909091);
});

test("+150 is 2.50 exactly, implying 0.40 exactly", () => {
  assert.equal(decimalFromAmerican(150), 2.5);
  assert.equal(impliedFromDecimal(2.5), 0.4);
});

test("−110 implies 11/21, recorded as 0.523810", () => {
  close(impliedFromDecimal(decimalFromAmerican(-110)), 11 / 21);
  assert.equal(roundTo(impliedFromDecimal(decimalFromAmerican(-110)), DP_PROB), 0.52381);
});

test("both +100 and −100 mean even money", () => {
  assert.equal(decimalFromAmerican(100), 2);
  assert.equal(decimalFromAmerican(-100), 2);
  assert.equal(americanFromDecimal(2), 100, "+100 is the canonical spelling of 2.0");
});

test("american odds inside (−100, 100) are not a price", () => {
  assert.throws(() => decimalFromAmerican(99), BetMathError);
  assert.throws(() => decimalFromAmerican(-99), BetMathError);
  assert.throws(() => decimalFromAmerican(0), BetMathError);
  assert.throws(() => decimalFromAmerican(-11), BetMathError, "the -110 typo must stop the run");
});

test("american odds must be whole numbers", () => {
  assert.throws(() => decimalFromAmerican(-110.5), BetMathError);
});

test("american ↔ decimal round-trips across the realistic range", () => {
  for (const a of [-10000, -500, -110, -105, -100, 100, 105, 110, 150, 500, 10000]) {
    const back = americanFromDecimal(decimalFromAmerican(a));
    const expected = a === -100 ? 100 : a; // −100 and +100 are the same price; +100 is canonical.
    close(back, expected, 1e-9, `american ${a} did not round-trip (got ${back})`);
  }
});

test("10/11 fractional is the same price as −110", () => {
  close(decimalFromFractional(10, 11), decimalFromAmerican(-110));
});

test("fractional odds reject non-positive terms", () => {
  assert.throws(() => decimalFromFractional(0, 11), BetMathError);
  assert.throws(() => decimalFromFractional(10, 0), BetMathError, "denominator zero is not 'infinite odds'");
});

test("decimal odds of 1 or less are refused", () => {
  assert.throws(() => impliedFromDecimal(1), BetMathError, "a price of 1 pays nothing");
  assert.throws(() => impliedFromDecimal(0.5), BetMathError);
});

// --- Vig -----------------------------------------------------------------------------------------

test("a two-way −110/−110 market carries 1/21 overround and devigs to 0.50/0.50", () => {
  const implied = [decimalFromAmerican(-110), decimalFromAmerican(-110)].map(impliedFromDecimal);
  close(overround(implied), 1 / 21);
  close(overround(implied), 0.047619047619, 1e-9, "the familiar 4.76% hold");

  const fair = fairProbsMultiplicative(implied);
  assert.equal(fair[0], 0.5, "a symmetric market devigs to exactly even");
  assert.equal(fair[1], 0.5);
});

test("a three-way market devigs to shares that sum to 1", () => {
  const implied = [2.5, 3.2, 3.0].map(impliedFromDecimal);
  close(implied[0], 0.4);
  close(implied[1], 0.3125);
  close(implied[2], 1 / 3);
  close(overround(implied), 11 / 240);

  const fair = fairProbsMultiplicative(implied);
  close(fair[0], 96 / 251);
  close(fair[1], 75 / 251);
  close(fair[2], 80 / 251);
  close(fair.reduce((a, b) => a + b, 0), 1, EPS, "fair probabilities must re-sum to certainty");
});

test("overround needs the whole market, not one price", () => {
  assert.throws(() => overround([0.5]), BetMathError, "one outcome cannot show a margin");
  assert.throws(() => overround([]), BetMathError);
});

test("a market priced under 100% yields a negative overround rather than an error", () => {
  const implied = [2.1, 2.1].map(impliedFromDecimal);
  close(overround(implied), -1 / 21);
  // The arithmetic is fine; judging it is the checker's job, which reports it as a warning because a
  // claimed arbitrage is far more often a stale snapshot than free money.
});

// --- Edge and EV ---------------------------------------------------------------------------------

test("edge is fair minus implied, and EV is decimal times edge", () => {
  // Float reality, and the reason every comparison in this pack runs through a tolerance: the edge
  // of a 0.55 estimate at even money is not exactly 0.05 in binary, so `=== 0.05` is false.
  assert.notEqual(edge(0.55, 0.5), 0.05);
  close(edge(0.55, 0.5), 0.05);
  close(evPerUnit(0.55, 2.0), 0.1);
  close(evPerUnit(0.55, 2.0), 2.0 * edge(0.55, 0.5), EPS, "the identity EV = d·edge must hold");
});

test("a 0.55 estimate at −110 has a small edge and exactly 0.05 EV per unit", () => {
  const d = decimalFromAmerican(-110);
  const implied = impliedFromDecimal(d);
  close(edge(0.55, implied), 0.55 - 11 / 21);
  close(edge(0.55, implied), 0.0261904761904, 1e-9);
  close(evPerUnit(0.55, d), 0.05, EPS, "0.55 × 21/11 − 1 is exactly 0.05");
  close(evPerUnit(0.55, d), d * edge(0.55, implied), EPS);
});

test("edge cannot be computed without both a probability and a price", () => {
  assert.throws(() => edge(0.55, 0), BetMathError);
  assert.throws(() => edge(0.55, 1), BetMathError);
  assert.throws(() => edge(1, 0.5), BetMathError, "certainty is not a probability estimate");
});

test("push-aware EV accounts for the returned stake", () => {
  close(evPerUnitWithPush(0.5, 0.1, 1.91), 0.055, 1e-12);
  close(evPerUnitWithPush(0.5, 0, 2.0), evPerUnit(0.5, 2.0), EPS, "no push reduces to the plain form");
});

test("push-aware EV rejects impossible probability splits", () => {
  assert.throws(() => evPerUnitWithPush(0.7, 0.5, 2.0), BetMathError);
});

// --- Uncertainty ---------------------------------------------------------------------------------

test("the uncertainty discount shrinks edge toward the price", () => {
  close(adjustedEdge(0.05, 0.3), 0.035);
  close(2.0 * adjustedEdge(0.05, 0.3), 0.07, EPS, "the discounted EV at even money");
  assert.equal(adjustedEdge(0.05, 1), 0, "total uncertainty leaves no edge, which is a PASS");
  assert.equal(adjustedEdge(0.05, 0), 0.05, "no discount leaves the raw edge");
});

test("a discount outside [0, 1] is refused", () => {
  assert.throws(() => adjustedEdge(0.05, 1.5), BetMathError);
  assert.throws(() => adjustedEdge(0.05, -0.1), BetMathError, "a negative discount would inflate edge");
});

test("the adjusted probability is the implied price plus the discounted edge", () => {
  const implied = impliedFromDecimal(decimalFromAmerican(-110));
  const adj = adjustedEdge(edge(0.55, implied), 0.3);
  close(adjustedProb(implied, adj), implied + adj);
  assert.ok(adjustedProb(implied, adj) < 0.55, "discounting must move the estimate toward the market");
});

// --- Sizing --------------------------------------------------------------------------------------

test("Kelly at even money on a 0.55 estimate is 10% of bankroll", () => {
  close(kellyFraction(0.55, 2.0), 0.1);
  close(stakeFromKelly(1000, kellyFraction(0.55, 2.0), 0.25), 25, EPS, "quarter Kelly on 1000");
});

test("Kelly at −110 on a 0.55 estimate is 5.5% of bankroll", () => {
  close(kellyFraction(0.55, decimalFromAmerican(-110)), 0.055, 1e-12);
});

test("a negative-EV wager gets a Kelly fraction of zero, never a negative stake", () => {
  assert.equal(kellyFraction(0.48, 2.0), 0);
  assert.equal(stakeFromKelly(1000, kellyFraction(0.48, 2.0), 0.25), 0);
});

test("full Kelly on an estimated probability is refused as an over-bet", () => {
  assert.doesNotThrow(() => stakeFromKelly(1000, 0.1, 1));
  assert.throws(() => stakeFromKelly(1000, 0.1, 1.5), BetMathError);
  assert.throws(() => stakeFromKelly(1000, 0.1, 0), BetMathError);
});

test("unit sizing is a percentage of bankroll", () => {
  close(unitStake(10000, 0.01, 1), 100);
  close(unitStake(10000, 0.01, 2.5), 250);
  close(bankrollPercent(100, 10000), 0.01);
});

test("a non-positive bankroll is refused everywhere it appears", () => {
  assert.throws(() => stakeFromKelly(0, 0.1, 0.25), BetMathError);
  assert.throws(() => unitStake(-1, 0.01, 1), BetMathError);
  assert.throws(() => bankrollPercent(10, 0), BetMathError, "division by a zero bankroll must not yield Infinity");
});

// --- Exposure ------------------------------------------------------------------------------------

test("exposure sums in total and within each correlation group", () => {
  const { total, byGroup } = exposureTotals([
    { stake: 150, correlationGroup: "slate-a" },
    { stake: 100, correlationGroup: "slate-a" },
    { stake: 75, correlationGroup: "slate-b" },
    { stake: 50, correlationGroup: null },
  ]);
  assert.equal(total, 375);
  assert.equal(byGroup.get("slate-a"), 250, "correlated stakes count together, not independently");
  assert.equal(byGroup.get("slate-b"), 75);
  assert.equal(byGroup.has(null), false, "an ungrouped position contributes to the total only");
});

test("an empty book has zero exposure", () => {
  const { total, byGroup } = exposureTotals([]);
  assert.equal(total, 0);
  assert.equal(byGroup.size, 0);
});

// --- Settlement ----------------------------------------------------------------------------------

test("closing-line value compares the price taken with the close", () => {
  close(clvPercent(2.1, 2.0), 0.05);
  close(clvPercent(2.0, 2.1), 2.0 / 2.1 - 1, EPS, "a line that moved against the bet is negative CLV");
  assert.equal(clvPercent(2.0, 2.0), 0);
});

test("profit is stake times net odds on a win, minus stake on a loss, zero on a push", () => {
  close(profitUnits("win", 100, decimalFromAmerican(-110)), 100 * (21 / 11 - 1));
  close(profitUnits("win", 100, decimalFromAmerican(-110)), 90.909090909, 1e-8);
  assert.equal(profitUnits("loss", 100, 2.0), -100);
  assert.equal(profitUnits("push", 100, 2.0), 0, "a push returns the stake; it is not a loss");
  assert.equal(profitUnits("void", 100, 2.0), 0);
  assert.throws(() => profitUnits("nearly", 100, 2.0), BetMathError);
});

// --- Recording -------------------------------------------------------------------------------------

test("rounding is decimal-correct at the boundary", () => {
  assert.equal(roundTo(1.005, DP_MONEY), 1.01, "the stored double is a hair below 1.005; a reader still expects 1.01");
  assert.equal(roundTo(2.675, DP_MONEY), 2.68);
  assert.equal(roundTo(0.5235, 3), 0.524);
  assert.equal(roundTo(-1.005, DP_MONEY), -1.01);
});

test("recorded precision round-trips through JSON unchanged", () => {
  // The decision digest is taken over serialized JSON, so a value that does not survive
  // parse→stringify would make an untouched record appear edited.
  for (const value of [0.52381, 0.047619, 1.909091, 100.83, 0.018333, -0.021141]) {
    assert.equal(JSON.parse(JSON.stringify({ v: value })).v, value);
  }
});

test("nearlyEqual compares within tolerance rather than by identity", () => {
  assert.ok(nearlyEqual(0.1 + 0.2, 0.3, EPS), "the classic float case must compare equal");
  assert.equal(0.1 + 0.2 === 0.3, false, "and it is genuinely not identical");
  assert.ok(!nearlyEqual(0.5, 0.6, EPS));
});

test("no function returns NaN or Infinity for any accepted input", () => {
  // The guarantee that makes threshold comparisons meaningful: a NaN would make every `>=` false and
  // every `<=` false, and a record full of NaN would pass gates it should fail.
  const values = [
    decimalFromAmerican(-110),
    impliedFromDecimal(1.91),
    overround([0.52, 0.52]),
    edge(0.55, 0.5),
    evPerUnit(0.55, 2),
    adjustedEdge(0.05, 0.3),
    kellyFraction(0.55, 2),
    bankrollPercent(100, 1000),
    clvPercent(2.1, 2.0),
    profitUnits("win", 100, 2),
    roundTo(1.005, 2),
  ];
  for (const [i, v] of values.entries()) {
    assert.ok(Number.isFinite(v), `value ${i} is not finite: ${v}`);
  }
});
