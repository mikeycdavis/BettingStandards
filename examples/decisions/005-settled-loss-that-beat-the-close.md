# Worked example 005 — a wager that lost, and was a good decision

Record: [`examples/ledger/DEC-20260808-005.json`](../ledger/DEC-20260808-005.json)

This is the example the whole pack exists for. A wager was placed, the wager lost, and nothing about
the decision was wrong.

## The decision

Boston at Montreal. The model gave Boston 57% with a range of 54–60%; the book was offering −105.

```text
impliedProb    = 1 / 1.952381 = 0.512195
marketFairProb = 0.489166
rawEdge        = 0.57 − 0.512195 = 0.057805
adjustedEdge   = 0.057805 × (1 − 0.30) = 0.040463
evPerUnit      = 1.952381 × 0.040463 = 0.079000
recommendedStake = 207.38     (quarter Kelly, inside the 3% cap)
```

Four points of edge after a 30% haircut, against a 2% minimum. Every gate passed. **BET, 207.38.**

## The outcome

```text
closing price   = 1.869565
clvPct          = 1.952381 / 1.869565 − 1 = 0.044298
result          = loss
profitUnits     = −207.38
```

Boston lost. The bankroll is 207.38 smaller, and that is a real fact about which this pack has nothing
consoling to say.

## Reading the two facts correctly

**The loss says nothing about the decision.** A wager at 56% to win loses about 44 times in 100. This
was one of those. Treating the loss as evidence that the decision was wrong is
[Standard 1](../../standards/01-the-fundamental-invariant.md) R3's prohibition, and it is the error
that causes sound processes to be abandoned after entirely normal losing stretches.

**The closing line says something about the process.** The price taken was `1.952381`; the market
closed at `1.869565`. The line moved toward the position by 4.4% — the market came to agree that
Boston were better than the opening price implied. That is evidence, on one observation admittedly
weak, that the estimate found something before the market did.

These two facts point in opposite directions, and the second is the one that carries information about
whether to keep doing this. Not because losses do not matter, but because closing-line value is
settled before any ball is thrown: it measures the decision, while profit measures the decision *and*
the outcome, and over any sample a person will actually accumulate the outcome dominates
([Standard 17](../../standards/17-closing-line-value.md) R2).

## What the record structure enforces

The `outcome` block — closing price, result, profit, review — sits **outside** the digested decision
block. Appending it does not change the decision digest, and a test asserts exactly that.

The consequence is structural rather than advisory: there is no way to record this result that also
adjusts what was decided. The stake cannot quietly become smaller now that it is known to have lost.
The estimate cannot be revised to 0.51 so the record looks more careful in hindsight. Any such edit
flips the digest and reports `edited-history`
([Standard 18](../../standards/18-record-keeping.md) R3, R4).

That is the mechanical half of the fundamental invariant. The other half — actually reasoning about
the decision rather than the result — is a human obligation that no digest can enforce, which is why
`decision.no-resulting` is `manual-review` with `assurance: none` and reports not-evaluated rather
than passing.

## The process review

The record's own review reads:

> The wager lost. The process was sound: the price taken was better than the close, which is evidence
> the estimate found something the market later agreed with. Nothing about this record should change
> because of the result.

That last sentence is the standard being applied, not merely quoted.
