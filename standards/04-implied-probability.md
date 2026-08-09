# Standard 4 — Implied Probability

The implied probability is what the price charges. It is not what anyone believes, and keeping those
two things in separate fields is the whole substance of this standard.

Source: the "implied probability" item of the "Required standards" list in
[`artifacts/prompts/original-prompt.md`](../artifacts/prompts/original-prompt.md).

## Scope

Applies to every price in a decision record: the one wagered on and every other outcome in the
market.

## Requirements

### R1 — Implied probability is the reciprocal of decimal odds

```text
impliedProb = 1 / decimalOdds
```

At decimal `2.50` that is `0.40` exactly. At American `−110` — decimal `21/11` — it is `11/21`,
recorded as `0.523810`.

### R2 — Raw implied probability and fair probability are separate recorded fields

The implied probability includes the bookmaker's margin. The fair probability does not. They are
different numbers with different meanings, and a record carries both.

This is the requirement that does the work in this standard. Conflating them is not a labelling
error: on a standard two-way market the margin is roughly two and a half percentage points, so an
edge computed against the raw implied probability is overstated by about that much on every wager.
That is comfortably larger than most real edges, which means the conflation reliably turns a losing
process into one that looks profitable on paper — and it does so consistently, in the direction that
encourages betting, on every single decision.

[Standard 5](05-vig.md) governs removing the margin. This standard's job is only to insist that the
number before removal and the number after are never the same field.

### R3 — Implied probabilities are computed for the whole market, not just the selection

The market's margin cannot be seen from one price. Computing the implied probability of every outcome
is what makes the overround visible at all, and it is why [Standard 5](05-vig.md) R1 requires the
complete market to be recorded.

### R4 — Implied probability is strictly between 0 and 1

A recorded implied probability of 0 or 1 is a claim of impossibility or certainty, which no price
expresses and no evidence supports. Values outside the open interval are refused rather than clamped.

## Additions this standard makes beyond the source

The source says "implied probability". Everything here is this pack's: the formula, the requirement
that raw and fair probabilities occupy separate fields, the quantification of what conflating them
costs, the requirement to compute across the whole market, and the domain constraint in R4.

The estimate of the margin's size — "roughly two and a half percentage points" on a standard two-way
market — follows from the arithmetic of a −110/−110 market, whose overround is `1/21`, split across
two outcomes. It is stated here as the reason the conflation matters, and is this pack's reasoning
rather than the source's.

## Relationship to other standards

[Standard 3](03-odds-conversion.md) produces the decimal price this standard consumes.
[Standard 5](05-vig.md) removes the margin to produce the market's fair probability.
[Standard 7](07-edge.md) compares an estimate against the implied probability, which is why the two
must never have been conflated by the time it runs.

## Implementation

**Met.** `probability.implied-from-price` is evaluated on every record: the checker recomputes
`1 / decimal` and reports `ev-mismatch` bound to this rule on any disagreement beyond tolerance. The
schema enforces R4 by constraining every probability to the open interval `(0, 1)`, and the schema
evaluator's numeric bounds exist for exactly this purpose. R2 is enforced structurally — `impliedProb`
and `marketFairProb` are separate required fields, and the checker reports `vig-ignored` when they
are equal.
