# Worked example 001 — a BET with a clear edge

Record: [`examples/ledger/DEC-20260809-001.json`](../ledger/DEC-20260809-001.json)

The straightforward case, walked stage by stage so the arithmetic in every other example can be read
against it. Every number below is recomputed by `npm run check`; none of them is taken on trust.

## The situation

Portland Rain are at home against Sacramento, who played the night before. A team-strength model, run
25 minutes before the decision, gives Portland a 58% chance with a stated range of 55–61%. The book is
offering −110 on both sides.

## The pipeline

### 1–2. Prediction and offered odds

| | |
| --- | --- |
| Estimated fair probability | `0.58` |
| Source | team-strength model v3, run 2026-08-09T13:40Z |
| Offered price | American `−110`, decimal `1.909091` |
| Captured | 5 minutes before the decision |

The estimate is an input. This pack does not evaluate whether the model is any good — that is upstream
([Standard 2](../../standards/02-the-decision-pipeline.md) R2). What it requires is that the estimate
name its source and its time, so it can be checked for staleness and cannot be confused with a number
chosen after the fact.

### 3. Implied probability

```text
impliedProb = 1 / 1.909091 = 0.523809
```

This is what the price charges, margin included. It is not what anyone believes.

### 4. Vig removal

Both sides are −110, so both imply `0.523809` and the market sums to `1.047619`.

```text
overround = 1.047619 − 1 = 0.047619        (about 4.76%)
marketFairProb = 0.523809 / 1.047619 = 0.500000
```

The market's honest opinion is a coin flip. The extra 4.76% is the book's margin, and it is charged
whether the wager wins or loses. Note what would have happened without this step: comparing 0.58
against 0.523809 instead of 0.50 would have understated the edge — in this case in the *conservative*
direction, but on the other side of the market it runs the other way, and it is always wrong.

### 5–6. Edge and uncertainty

```text
rawEdge      = 0.58 − 0.523809 = 0.056191
adjustedEdge = 0.056191 × (1 − 0.30) = 0.039333
```

The model's range of 55–61% is roughly ±3 points around 58%, so a 30% haircut on the edge is a
defensible reading of its own stated uncertainty. The discount shrinks the edge toward the market —
never away ([Standard 9](../../standards/09-uncertainty-discount.md) R2).

### 7. Expected value

```text
evPerUnit = 1.909091 × 0.039333 = 0.075091
```

Seven and a half cents per unit staked. The identity check: `adjustedProb × d − 1` where
`adjustedProb = 0.523809 + 0.039333 = 0.563142` gives the same figure. Two routes, one number — a
transposed input would show up as a disagreement rather than as a plausible result.

### 8. The threshold

`0.039333 ≥ 0.02`. The edge clears the minimum with room to spare, which is what makes this the
simple example.

### 9. Sizing

```text
kellyFraction    = (0.563142 × 1.909091 − 1) / (1.909091 − 1) = 0.0826
kellyStake       = 10000 × 0.25 × 0.0826 = 206.50
singleBetCap     = 10000 × 0.03 = 300.00
recommendedStake = min(206.50, 300.00) = 206.50
```

Quarter Kelly, not full Kelly. Full Kelly is optimal only if 0.58 is exactly right, and it is an
estimate ([Standard 12](../../standards/12-unit-sizing.md) R2). The stake lands at 2.065% of bankroll,
inside the 3% cap, so the cap does not bind here.

### 10. Exposure

Nothing is open. Group and total exposure after this wager are both `206.50` — 2.065% of bankroll,
against caps of 6% and 15%.

### 11. Decision

Every gate passes: edge above minimum, positive expected value, stake at the recommended amount,
within all three caps, price 5 minutes old, prediction 25 minutes old, decision well before the
19:00 start.

**BET, 206.50.**

## What this example does and does not establish

It establishes that the arithmetic is internally consistent and that the decision follows the rule.

It does not establish that Portland were really 58% to win, that the book was really showing −110, or
that the model is any good. Re-derivation proves the arithmetic is consistent with the inputs; it
never proves the inputs are true. Every assurance note in the catalog says a version of this, and it is
worth reading the clean check result with that in mind.
