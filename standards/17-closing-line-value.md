# Standard 17 — Closing-Line Value

Closing-line value measures whether a decision found a price the market later agreed with. It is the
best process metric available to a bettor, for one reason: it needs far fewer samples than profit
does to say anything at all.

Source: the "closing-line value" item of the "Required standards" list in
[`artifacts/prompts/original-prompt.md`](../artifacts/prompts/original-prompt.md).

## Scope

Applies to settled wagers where a closing price is obtainable. It is a property of BETs; a PASS has no
price taken and no closing-line value.

## Requirements

### R1 — The definition

```text
clvPct = takenDecimalOdds / closingDecimalOdds − 1
```

Positive means the price shortened after the wager — the market moved toward the position. Taking
`2.10` on something that closed at `2.00` is `+5%` closing-line value.

### R2 — It is evidence about process, never proof about a wager

Beating the close on one wager means the market moved. It does not mean the wager was good, and it
certainly does not mean it will win. [Standard 1](01-the-fundamental-invariant.md) applies here as
everywhere: a single observation is a single observation.

What closing-line value is good for is the aggregate. Over a sample, consistently beating the close is
evidence that a process finds prices before the market does — and that inference is available on a
sample of dozens, where a profit-based inference on the same wagers would still be dominated by
variance.

The reason for the difference: profit measures the decision *and* the outcome, so it carries the full
variance of the results. Closing-line value measures only the price, which is settled before any
outcome occurs. It is a decision-time metric evaluated after the fact, which is exactly the kind
[Standard 1](01-the-fundamental-invariant.md) permits.

### R3 — A missing closing price is recorded as missing, never estimated

Where no closing price was observed, the field is absent. Not interpolated from a nearby book, not
inferred from where the line "probably" went.

An estimated closing price would corrupt the metric in the direction of whoever estimated it, and
because closing-line value is the pack's primary process metric, corrupting it corrupts the main
feedback loop a bettor has. [Standard 15](15-line-movement.md) R3's prohibition on fabricating
movement covers this case explicitly.

### R4 — Closing-line value does not adjust the decision record

The closing price arrives after the decision and is recorded in the outcome block, outside the
digested decision. It never modifies the price taken, the edge, or anything else decided beforehand.

This is [Standard 18](18-record-keeping.md) R2's separation applied to the specific field most likely
to tempt an edit — because a closing price that makes a decision look bad is precisely the kind of
information someone might want to leave out.

### R5 — Its limits

Two, stated so the metric is not over-read:

- **It measures agreement with the market, not correctness.** A bettor who systematically beats the
  close is finding prices the market later matches. That is strong evidence of a real process and it
  is not the same as being right — closing lines are themselves estimates.
- **It is unavailable where markets do not close cleanly**, or where a book publishes no closing
  price. Those wagers are not failures of the metric; they are simply outside it, and R3 requires
  saying so rather than filling the gap.

## Additions this standard makes beyond the source

The source says "closing-line value". Everything here is this pack's:

- R1's formula and sign convention.
- R2's central argument — that closing-line value needs fewer samples than profit because it excludes
  outcome variance, and is therefore a decision-time metric that Standard 1 permits.
- R3's requirement to record absence, and the reason it matters more here than elsewhere.
- R4's placement of the closing price outside the digest.
- R5's two limits.

## Relationship to other standards

[Standard 1](01-the-fundamental-invariant.md) is why a decision-time metric is needed at all.
[Standard 15](15-line-movement.md) governs the closing price as a recorded price and prohibits
fabricating it. [Standard 18](18-record-keeping.md) places it outside the digest.
[Standard 19](19-evaluation-of-the-betting-process.md) is the consumer: this is the metric that makes
process evaluation possible on a realistic sample.

## Implementation

**Met where data exists.** `line.clv-computed` is evaluated on settled records carrying a closing
price: the checker recomputes the value from the recorded prices and reports `clv-mismatch` on
disagreement. [`examples/ledger/DEC-20260808-005.json`](../examples/ledger/DEC-20260808-005.json) is a
settled wager that **lost while beating the close**, with a process review saying so — the case this
standard and [Standard 1](01-the-fundamental-invariant.md) exist to distinguish from a bad decision.

**Partially met, by construction.** The rule carries `assurance: partial` for a reason worth stating
plainly: there is full arithmetic assurance where a closing price is recorded, and *no assurance at
all* about records where it is absent — because an unobtainable closing price and an unrecorded one
look identical. That is also why the rule is `recommended` rather than `required`: making it required
would penalise bettors whose books publish nothing, and push them toward the estimate R3 prohibits.
