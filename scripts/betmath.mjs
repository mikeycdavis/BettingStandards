/**
 * The betting arithmetic. Pure functions: no I/O, no state, no clock.
 *
 * This module is what makes the pack's central claim mechanical. A decision record states a price, a
 * probability, and a stake, and then states what it derived from them; the checker recomputes every
 * derived value through this module and disagrees when they differ. That is the difference between a
 * standard that says "show your work" and one that can tell whether the work is right.
 *
 * TWO DESIGN RULES, both about honesty rather than mathematics:
 *
 * 1. **Never return NaN or Infinity.** Every domain violation throws `BetMathError`. A NaN that
 *    reaches a report is a false green wearing a number: `NaN >= minEdge` is false, `NaN <= cap` is
 *    false, and a record full of NaN sails through comparisons that were meant to stop it. Failing
 *    loudly at the source is the only way a threshold check means anything.
 *
 * 2. **Compute at full precision; round only to record.** Rounding inside a chain compounds, and a
 *    chain that rounds at every step produces a number nobody can reproduce. `roundTo` exists for
 *    writing values into a record and for nothing else.
 *
 * WHAT THIS MODULE DOES NOT DO. It does not decide anything. There is no `shouldBet()` here. Expected
 * value is an input to a decision, never the decision — the gate lives in scripts/decisions.mjs and
 * is a conjunction of independent conditions precisely so that no single attractive number can
 * authorise risking money on its own (Standard 8 R2, Standard 10).
 */

export class BetMathError extends Error {
  constructor(message) {
    super(message);
    this.name = "BetMathError";
  }
}

/**
 * Internal equality tolerance. Used for identities that should hold exactly in real arithmetic but
 * do not in binary floating point — fair probabilities summing to 1, for instance.
 */
export const EPS = 1e-9;

/**
 * Tolerance when comparing a recomputed value against a RECORDED one.
 *
 * Records carry probabilities at 6 decimal places, so a correctly rounded value differs from the true
 * value by at most 5e-7. Anything beyond that is not rounding — it is a different calculation, which
 * is exactly what the checker is looking for.
 *
 * The trailing slack matters and was added after a real failure. A value landing exactly on a
 * rounding boundary (40.625 recorded as 40.63) differs from the true value by *precisely* the
 * half-unit, and in binary floating point the subtraction lands a hair above it — so a tolerance of
 * exactly half a unit rejects correctly rounded values. The slack is far too small to admit any real
 * miscalculation: the smallest meaningful arithmetic error is orders of magnitude larger.
 *
 * It also means the checker accepts either rounding direction at a boundary, which is deliberate. The
 * job is to catch a different calculation, not to impose one rounding convention on every tool that
 * might produce a record.
 */
export const TOL_PROB = 5e-7 + 1e-12;

/** The same idea for money, recorded at 2 decimal places: half a cent, plus the same slack. */
export const TOL_MONEY = 0.005 + 1e-9;

/** Decimal places for each recorded kind. The record format and the checker both read these. */
export const DP_PROB = 6;
export const DP_MONEY = 2;

function requireFinite(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BetMathError(`${name} must be a finite number, got ${JSON.stringify(value)}`);
  }
}

function requireProbability(p, name) {
  requireFinite(p, name);
  if (p <= 0 || p >= 1) {
    throw new BetMathError(`${name} must be strictly between 0 and 1, got ${p}`);
  }
}

/**
 * Decimal odds must exceed 1. A decimal of exactly 1 pays nothing and would make `1/(d-1)` a division
 * by zero in the Kelly fraction; below 1 it pays less than the stake. Neither is a price, so neither
 * is accepted as one.
 */
function requireDecimal(d, name = "decimal odds") {
  requireFinite(d, name);
  if (d <= 1) throw new BetMathError(`${name} must be greater than 1, got ${d}`);
}

// --- Odds conversion -----------------------------------------------------------------------------

/**
 * American → decimal.
 *
 * Both +100 and −100 mean even money and convert to 2.0. The open interval between them is not a
 * price at all: American odds express a ratio against 100, so |a| < 100 would claim a payout that the
 * notation cannot represent. It throws rather than silently producing a plausible number, because a
 * typo like `-11` for `-110` is exactly the input that should stop a run.
 */
export function decimalFromAmerican(american) {
  requireFinite(american, "american odds");
  if (!Number.isInteger(american)) {
    throw new BetMathError(`american odds must be an integer, got ${american}`);
  }
  if (american >= 100) return 1 + american / 100;
  if (american <= -100) return 1 + 100 / Math.abs(american);
  throw new BetMathError(
    `american odds must satisfy |odds| >= 100 (both +100 and -100 mean even money), got ${american}`,
  );
}

/**
 * Decimal → American.
 *
 * 2.0 maps to +100 rather than −100: the two are numerically identical and one canonical form is
 * needed for round-tripping to be a testable property.
 */
export function americanFromDecimal(decimal) {
  requireDecimal(decimal);
  if (decimal >= 2) return (decimal - 1) * 100;
  return -100 / (decimal - 1);
}

/** Fractional → decimal. `10/11` is the fractional spelling of −110. */
export function decimalFromFractional(numerator, denominator) {
  requireFinite(numerator, "fractional numerator");
  requireFinite(denominator, "fractional denominator");
  if (numerator <= 0) throw new BetMathError(`fractional numerator must be positive, got ${numerator}`);
  if (denominator <= 0) throw new BetMathError(`fractional denominator must be positive, got ${denominator}`);
  return 1 + numerator / denominator;
}

// There is deliberately no `fractionalFromDecimal`. The fractional representation is not canonical —
// 10/11 and 20/22 are the same price — so any implementation would have to invent a convention and
// then quietly impose it on records. Refusing to convert is more honest than converting arbitrarily.

// --- Probability ---------------------------------------------------------------------------------

/**
 * The probability a price implies, before any vig removal.
 *
 * This is what you are being charged, not what anyone believes. Keeping it distinct from the fair
 * probability is the whole substance of Standard 4 R2: conflate them and the bookmaker's margin
 * disappears into an edge calculation as though it were free.
 */
export function impliedFromDecimal(decimal) {
  requireDecimal(decimal);
  return 1 / decimal;
}

/**
 * The market's overround: how much more than 100% the implied probabilities sum to.
 *
 * Requires the whole market. One outcome's price says nothing about the margin, which is why the
 * record format demands every outcome and why `vig-ignored` is mechanically detectable at all.
 *
 * A negative result is arithmetically fine and means the prices sum to less than certainty. The
 * checker treats that as a warning rather than an error: it is usually a stale or mistyped snapshot,
 * occasionally a genuine arbitrage, and never something to assume in the bettor's favour.
 */
export function overround(impliedProbs) {
  if (!Array.isArray(impliedProbs) || impliedProbs.length < 2) {
    throw new BetMathError("overround needs the whole market: at least two outcomes");
  }
  let sum = 0;
  for (const [i, p] of impliedProbs.entries()) {
    requireFinite(p, `implied probability [${i}]`);
    if (p <= 0 || p > 1) throw new BetMathError(`implied probability [${i}] must be in (0, 1], got ${p}`);
    sum += p;
  }
  return sum - 1;
}

/**
 * Remove the vig proportionally: each outcome keeps its share of the total.
 *
 * This is the only method v1 supports, and `vigMethod` is recorded on every decision so a future
 * method cannot be introduced without the records saying which was used.
 *
 * Why only this one. The additive method (subtracting the margin equally) produces negative fair
 * probabilities at long prices, which is not a rounding problem but a wrong answer. Power and Shin
 * methods need iterative solvers, and every line of solver is surface that has to be verified before
 * anyone can trust a number that came out of it — more unverified machinery than the bias it removes.
 *
 * The known cost, stated rather than hidden: the proportional method overstates the fair probability
 * of longshots, because bookmakers load more margin onto them than onto favourites. Standard 9 R5
 * answers that with a mechanical floor — long prices require a minimum uncertainty discount — rather
 * than pretending the distortion is not there.
 */
export function fairProbsMultiplicative(impliedProbs) {
  overround(impliedProbs); // Validates shape and domain; the sum is recomputed below.
  const sum = impliedProbs.reduce((a, b) => a + b, 0);
  const fair = impliedProbs.map((p) => p / sum);

  // A self-check, not a formality: if this ever fails the method is broken, and a broken devig would
  // otherwise surface as a plausible-looking edge rather than as an error.
  const total = fair.reduce((a, b) => a + b, 0);
  if (Math.abs(total - 1) > EPS) {
    throw new BetMathError(`vig removal produced probabilities summing to ${total}, not 1`);
  }
  return fair;
}

// --- Edge and expected value ---------------------------------------------------------------------

/**
 * Edge: fair probability minus the probability the price implies.
 *
 * Additive, and recorded that way. The ratio form (fair/implied − 1) is derivable from the same two
 * inputs, so storing one and deriving the other keeps a single definition; storing both would create
 * two numbers that can disagree.
 *
 * Note what this signature forces: edge cannot be computed without a price. A high probability of
 * winning is not an edge, and the type system of this function says so (Standard 7 R2).
 */
export function edge(fairProb, impliedProb) {
  requireProbability(fairProb, "fair probability");
  requireProbability(impliedProb, "implied probability");
  return fairProb - impliedProb;
}

/**
 * Expected value per unit staked: `p·d − 1`.
 *
 * Identity worth knowing, and asserted in the tests: this equals `decimal × edge` exactly, because
 * `p·d − 1 = d·(p − 1/d)`. The checker uses the identity as a cross-check — two routes to the same
 * number that must agree.
 */
export function evPerUnit(prob, decimal) {
  requireProbability(prob, "probability");
  requireDecimal(decimal);
  return prob * decimal - 1;
}

/**
 * Expected value per unit for a market that can push (stake returned).
 *
 * A push is not a win and not a loss, and folding it into either misstates the wager. Totals and
 * spreads on whole numbers push often enough that ignoring the case would make their EV wrong in a
 * predictable direction.
 */
export function evPerUnitWithPush(pWin, pPush, decimal) {
  requireProbability(pWin, "win probability");
  requireFinite(pPush, "push probability");
  if (pPush < 0 || pPush >= 1) throw new BetMathError(`push probability must be in [0, 1), got ${pPush}`);
  if (pWin + pPush > 1 + EPS) {
    throw new BetMathError(`win and push probabilities sum to ${pWin + pPush}, which exceeds 1`);
  }
  requireDecimal(decimal);
  const pLose = 1 - pWin - pPush;
  return pWin * (decimal - 1) - pLose;
}

// --- Uncertainty ---------------------------------------------------------------------------------

/**
 * Apply the uncertainty discount as a haircut on edge.
 *
 * The discount shrinks the estimated edge toward the market's price, which is the conservative
 * direction: being unsure about a probability should make you bet less, never more. A discount of 1
 * removes the edge entirely and the decision becomes a PASS, which is the correct answer when the
 * estimate carries no confidence at all.
 *
 * Discounting the edge rather than the probability is the choice here because edge is what the
 * minimum-edge gate compares against (Standard 10 R3), and applying the haircut anywhere else would
 * leave the gate reading an undiscounted number.
 */
export function adjustedEdge(rawEdge, discount) {
  requireFinite(rawEdge, "raw edge");
  requireFinite(discount, "uncertainty discount");
  if (discount < 0 || discount > 1) {
    throw new BetMathError(`uncertainty discount must be in [0, 1], got ${discount}`);
  }
  return rawEdge * (1 - discount);
}

/** The probability implied by the discounted edge: what the bettor is effectively claiming. */
export function adjustedProb(impliedProb, adjEdge) {
  requireProbability(impliedProb, "implied probability");
  requireFinite(adjEdge, "adjusted edge");
  const p = impliedProb + adjEdge;
  if (p <= 0 || p >= 1) {
    throw new BetMathError(`adjusted probability ${p} is outside (0, 1); the discount or edge is wrong`);
  }
  return p;
}

// --- Sizing --------------------------------------------------------------------------------------

/**
 * The full-Kelly fraction of bankroll: `(p·d − 1) / (d − 1)`.
 *
 * Clamped at zero. A negative Kelly fraction is the mathematics saying "bet the other side", and
 * returning it would let a negative-EV wager produce a positive-looking recommended stake once
 * multiplied by a negative Kelly multiplier somewhere downstream. Zero is the honest answer: this
 * wager gets no money.
 *
 * Full Kelly is a bankroll-growth optimum under the assumption that `p` is correct, and `p` here is
 * an estimate. That is why the policy multiplier exists and why Standard 12 R2 requires it to be at
 * most 1 — fractional Kelly is the standard response to estimation error, and this pack treats full
 * Kelly on an estimated probability as an over-bet rather than an optimum.
 */
export function kellyFraction(prob, decimal) {
  requireProbability(prob, "probability");
  requireDecimal(decimal);
  const f = (prob * decimal - 1) / (decimal - 1);
  return Math.max(0, f);
}

/** Stake from a Kelly fraction and a policy multiplier (quarter Kelly = 0.25). */
export function stakeFromKelly(bankroll, kellyFull, multiplier) {
  requireFinite(bankroll, "bankroll");
  if (bankroll <= 0) throw new BetMathError(`bankroll must be positive, got ${bankroll}`);
  requireFinite(kellyFull, "kelly fraction");
  if (kellyFull < 0) throw new BetMathError(`kelly fraction must not be negative, got ${kellyFull}`);
  requireFinite(multiplier, "kelly multiplier");
  if (multiplier <= 0 || multiplier > 1) {
    throw new BetMathError(`kelly multiplier must be in (0, 1]; full Kelly on an estimate is an over-bet`);
  }
  return bankroll * kellyFull * multiplier;
}

/** Stake as a count of units, where a unit is a policy-defined percentage of bankroll. */
export function unitStake(bankroll, unitPercent, units) {
  requireFinite(bankroll, "bankroll");
  if (bankroll <= 0) throw new BetMathError(`bankroll must be positive, got ${bankroll}`);
  requireFinite(unitPercent, "unit percent");
  if (unitPercent <= 0 || unitPercent > 1) {
    throw new BetMathError(`unit percent must be in (0, 1] as a fraction, got ${unitPercent}`);
  }
  requireFinite(units, "units");
  if (units < 0) throw new BetMathError(`units must not be negative, got ${units}`);
  return bankroll * unitPercent * units;
}

/** A stake as a fraction of bankroll. */
export function bankrollPercent(stake, bankroll) {
  requireFinite(stake, "stake");
  if (stake < 0) throw new BetMathError(`stake must not be negative, got ${stake}`);
  requireFinite(bankroll, "bankroll");
  if (bankroll <= 0) throw new BetMathError(`bankroll must be positive, got ${bankroll}`);
  return stake / bankroll;
}

/**
 * Aggregate open exposure, in total and per correlation group.
 *
 * Within a group, stakes SUM: the model assumes full correlation. That is deliberately pessimistic
 * and deliberately coarse. A coefficient-weighted model would be more precise in principle, but a
 * correlation coefficient is an unverifiable input — nothing in a record could falsify a claim that
 * two bets are "0.3 correlated" — and the number would let real exposure be discounted by assertion.
 * Binary grouping can be checked by reading the records; a coefficient cannot (Standard 14 R2).
 */
export function exposureTotals(openPositions) {
  if (!Array.isArray(openPositions)) throw new BetMathError("open positions must be an array");
  const byGroup = new Map();
  let total = 0;
  for (const [i, position] of openPositions.entries()) {
    requireFinite(position?.stake, `open position [${i}] stake`);
    if (position.stake < 0) throw new BetMathError(`open position [${i}] stake must not be negative`);
    total += position.stake;
    const group = position.correlationGroup ?? null;
    if (group !== null) byGroup.set(group, (byGroup.get(group) ?? 0) + position.stake);
  }
  return { total, byGroup };
}

// --- Closing-line value --------------------------------------------------------------------------

/**
 * Closing-line value: how much better the price taken was than the closing price.
 *
 * Positive means the price shortened after the bet — the market moved toward the position. This is a
 * process metric and nothing more: it says the decision found a price the market later agreed with,
 * which is evidence about method rather than proof about any single wager (Standard 17 R2).
 */
export function clvPercent(takenDecimal, closingDecimal) {
  requireDecimal(takenDecimal, "taken decimal odds");
  requireDecimal(closingDecimal, "closing decimal odds");
  return takenDecimal / closingDecimal - 1;
}

/**
 * Profit in units for a settled wager. A push or a void returns the stake: profit zero, not a loss.
 */
export function profitUnits(result, stake, decimal) {
  requireFinite(stake, "stake");
  if (stake < 0) throw new BetMathError(`stake must not be negative, got ${stake}`);
  requireDecimal(decimal);
  switch (result) {
    case "win":
      return stake * (decimal - 1);
    case "loss":
      return -stake;
    case "push":
    case "void":
      return 0;
    default:
      throw new BetMathError(`unknown result '${result}'; expected win, loss, push, or void`);
  }
}

// --- Presentation --------------------------------------------------------------------------------

/**
 * Round for recording. The ONLY rounding function, and it is never used mid-calculation.
 *
 * Uses an epsilon nudge before rounding so that values sitting exactly on a rounding boundary in
 * decimal — but a hair below it in binary — round the way a reader expects. Without it, 1.005 at two
 * places rounds to 1.00 because the stored double is fractionally less than 1.005, and a record whose
 * numbers do not match hand arithmetic is a record nobody trusts.
 */
export function roundTo(value, dp) {
  requireFinite(value, "value");
  if (!Number.isInteger(dp) || dp < 0 || dp > 15) throw new BetMathError(`invalid decimal places ${dp}`);
  const factor = 10 ** dp;
  const scaled = value * factor;
  const nudged = scaled >= 0 ? scaled + Number.EPSILON * Math.abs(scaled) : scaled - Number.EPSILON * Math.abs(scaled);
  return Math.round(nudged) / factor;
}

/** Compare two numbers within a tolerance. Never `===` on doubles that came from different routes. */
export function nearlyEqual(a, b, tolerance) {
  requireFinite(a, "first value");
  requireFinite(b, "second value");
  requireFinite(tolerance, "tolerance");
  return Math.abs(a - b) <= tolerance;
}
