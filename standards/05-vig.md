# Standard 5 — Vig

The vig is the bookmaker's margin: the amount by which a market's prices sum to more than certainty.
It is the bettor's first and most reliable cost, it is charged on every wager whether it wins or
loses, and it is the single easiest thing to leave out of a calculation while producing numbers that
look complete.

Source: the "vig" item of the "Required standards" list in
[`artifacts/prompts/original-prompt.md`](../artifacts/prompts/original-prompt.md).

## Scope

Applies to every decision that quotes a market. Where a market has only one observable price and the
margin genuinely cannot be computed, that is a reason to record the limitation and treat the fair
probability as unavailable — not a reason to proceed with the raw implied probability.

## Requirements

### R1 — The full market is recorded

Every outcome in the market is recorded with its price. Not the selection alone, not the two sides a
bettor happens to care about — every outcome.

This is a hard requirement rather than a preference because the margin is a property of the market,
not of a price. One price says nothing about the hold. Recording the full market is what makes the
overround computable, and therefore what makes ignoring the vig *detectable* rather than a matter of
trust. A record with outcomes missing produces a smaller overround, a larger apparent edge, and no
warning at all.

### R2 — The overround is computed and recorded

```text
overround = (Σ impliedProbᵢ) − 1
```

For a standard two-way market priced −110 on both sides, each implied probability is `11/21`, so the
overround is `1/21` — about 4.76%. That is the figure the bettor is paying for access to the market.

A **negative** overround means the recorded prices sum to less than certainty. This is arithmetically
fine and is recorded as computed, but it is treated as a warning rather than an opportunity: a
claimed arbitrage is far more often a stale snapshot, a mistyped price, or an incompletely recorded
market than it is free money. It must be verified against the live market before anything is acted
on.

### R3 — The fair probability is derived from the full market by a declared method

The method used to convert implied probabilities into fair ones is recorded on every decision.
[Standard 6](06-fair-probability.md) governs the method itself; what this standard requires is that a
method was named and applied, so the result can be reproduced and compared.

### R4 — Vig MUST NEVER be ignored

**No edge and no expected value is derived from raw implied probabilities.** The margin is removed
first, from the full market, by a declared method.

Comparing an estimate against the raw implied probability treats the house margin as though it were
free. On a standard two-way market that hands the book roughly a two-and-a-half point head start on
every wager — larger than most genuine edges. The consequence is not a slightly optimistic record: it
is a process that reports a profitable edge on wagers that lose money in the long run, consistently,
in the direction that encourages betting.

The specific form this violation takes in a record is a fair probability equal to the raw implied
probability. That case is detected by name.

### R5 — Vig is part of the cost the edge must clear

The margin is not merely removed and forgotten. It is one of the costs that
[Standard 10](10-minimum-edge.md)'s threshold exists to clear: a minimum edge set below the market's
typical hold is a threshold that permits wagers whose expected value the book has already taken.

## Additions this standard makes beyond the source

The source says "vig" and "Never: ignore vig". Everything else is this pack's:

- R1's requirement for the complete market, and the reasoning that this is what makes the violation
  detectable rather than a matter of trust.
- R2's formula, the worked −110/−110 figure, and the treatment of a negative overround as a warning
  with a stated most-likely cause.
- R3 and R5 in full.
- R4's quantification of the cost, and the identification of "fair probability equals raw implied
  probability" as the detectable form.

## Relationship to other standards

[Standard 4](04-implied-probability.md) produces the implied probabilities this standard sums.
[Standard 6](06-fair-probability.md) owns the removal method and its known biases.
[Standard 7](07-edge.md) consumes the fair probability, and would be systematically overstated
without this standard. [Standard 10](10-minimum-edge.md) sets a threshold that must exceed this cost.

## Implementation

**Met.** `vig.overround-computed` and `vig.removal-method-declared` are evaluated on every record. The
schema requires `fullMarket` to carry at least two outcomes, so a record cannot omit the market and
remain valid. The checker recomputes the overround from the recorded market and reports
`negative-overround` as a warning with its likely cause.

**Partially met.** `vig.no-ignored-vig` carries `assurance: partial`. It detects a fair probability
that was not derived from the recorded market, including the specific case where it equals the raw
implied probability — `test/fixtures/ledger-negative/vig-ignored.json` is exactly that record, and it
fires. What it cannot detect is a market recorded *incompletely*: the arithmetic over a two-outcome
subset of a three-way market is internally consistent and understates the margin. The catalog's
assurance note says so, and R1 exists to make that omission a separate, visible violation.
