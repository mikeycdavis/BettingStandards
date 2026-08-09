# Worked example 002 — a PASS because the edge does not survive its own uncertainty

Record: [`examples/ledger/DEC-20260809-002.json`](../ledger/DEC-20260809-002.json)

This is the most common outcome in a disciplined process and the one most likely to feel like a
missed opportunity. There is a real edge here. It is not big enough to trust.

## The situation

Austin are at Denver. The model gives Austin 55%, but with a wide range — 50% to 60% — because two
starters are questionable. The book is offering −115 on Austin, −105 on Denver.

## The pipeline

### Implied probability and vig

```text
impliedProb(Austin) = 1 / 1.869565 = 0.534884
impliedProb(Denver) = 1 / 1.952381 = 0.512195
sum = 1.047079      overround = 0.047079
marketFairProb(Austin) = 0.534884 / 1.047079 = 0.510834
```

The market's fair opinion of Austin is 51.1%, not the 53.5% the price implies.

### Edge, before and after uncertainty

```text
rawEdge      = 0.55 − 0.534884 = 0.015116
adjustedEdge = 0.015116 × (1 − 0.50) = 0.007558
```

Here is the whole example in two lines. The raw edge is 1.5 points — genuinely positive, and enough to
be tempting. But the model's own range is ±5 points, which is more than three times the edge it is
claiming. A 50% haircut is the honest reading of that, and what survives is 0.76 of a point.

### The threshold

```text
0.007558 ≥ 0.02 ?   No.
```

The gate fails. `minEdge` is 2%, and the discounted edge is barely a third of it.

**PASS, reason: `edge-below-minimum`.**

## Why this is a success and not a near miss

The expected value here is positive — `0.01413` per unit — and that is exactly what makes this the
instructive case. A process that bets whenever expected value is positive would take this wager, and
it would be wrong to, for a reason that has nothing to do with how this particular game turns out.

An edge of 0.76 of a point, derived from a model whose own stated uncertainty is ±5 points, is not a
measurement. It is inside the error bar of the thing that produced it. Betting it is betting on noise,
and the fact that the noise is currently pointing in a favourable direction is not information.

Notice also what the record still contains: the full market, the overround, the raw edge, the
discount, the expected value, the recommended stake that was never placed (`40.62`). A PASS records
the whole pipeline. That is what makes it possible, later, to ask whether the thresholds are set
sensibly — a question that cannot be answered from a ledger containing only the wagers that were
taken ([Standard 18](../../standards/18-record-keeping.md) R5).

## What the checker verifies here

That the recorded reason matches the gate that actually failed. A PASS recorded as `discretionary`
when the edge was in fact below the minimum would report `pass-reasons-wrong` — see
`test/fixtures/ledger-negative/pass-reasons-wrong.json`, which is this record with the reason
mislabelled. The distinction matters because a ledger full of discretionary PASSes says nothing about
whether the thresholds are doing any work.
