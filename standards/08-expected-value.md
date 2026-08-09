# Standard 8 — Expected Value

Expected value converts an edge into money per unit staked. It is the most quoted number in betting
and the most often asserted without arithmetic behind it — "+EV" is the phrase that ends arguments,
and it is most persuasive exactly where it is least earned.

Source: the "expected value" item of the "Required standards" list in
[`artifacts/prompts/original-prompt.md`](../artifacts/prompts/original-prompt.md).

## Scope

Applies to every decision, and to every claim made anywhere that a wager is positive expected value.

## Requirements

### R1 — Expected value per unit staked

```text
evPerUnit = p × decimalOdds − 1
```

where `p` is the probability being acted on — the discounted probability, per
[Standard 9](09-uncertainty-discount.md), not the raw estimate.

An identity worth knowing, because it gives a second route to the same number:

```text
p × d − 1  =  d × (p − 1/d)  =  decimalOdds × edge
```

Both routes are computed and compared. Two ways to reach one number means a transposed input surfaces
as an inconsistency rather than as a plausible figure.

### R2 — Markets that can push are computed with three outcomes

Where a stake can be returned — a total or spread landing exactly on the number — the wager has three
outcomes, not two:

```text
evPerUnit = pWin × (d − 1) − pLose,  where pLose = 1 − pWin − pPush
```

Folding a push into either the win or the loss misstates the wager in a predictable direction, and
whole-number totals push often enough for the error to matter.

### R3 — Nothing is called positive expected value without the calculation behind it

**No output describes a wager as positive EV, or +EV, unless it resolves to a decision record
carrying the probability and price the claim rests on.**

Used without arithmetic, "+EV" is a claim of rigour rather than an instance of one. It borrows the
authority of a calculation while skipping it, and it is difficult to argue with precisely because it
sounds like the argument has already been had.

This applies to every output, not only to records: a message, a summary, a recommendation to another
person. The check can only see recorded prose, and the catalog says so.

### R4 — Expected value MUST NEVER be fabricated

**No expected value is stated that does not follow from a recorded probability, price, and stake.**

An invented expected value is worse than no number at all. It carries the authority of a calculation
while having none of the substance, and of every figure in a record it is the one a reader is least
likely to check by hand.

### R5 — Expected value is an input to the decision, never the decision

A positive expected value does not authorise a wager. It is one condition among several, all of which
must hold: the edge must clear the minimum after discounting, the stake must fit the sizing rule and
the single-bet cap, group and total exposure must stay within their caps, and the price and
prediction must both be fresh.

This is deliberate and structural. A single attractive number must not be able to authorise risking
money on its own, because a single number is exactly what a motivated bettor can produce. The
decision rule is a conjunction for that reason ([Standard 10](10-minimum-edge.md),
[Standard 20](20-pass-decisions.md)).

## Additions this standard makes beyond the source

The source says "expected value", "Never: call something positive EV without supporting probability
and price calculations", "Never: fabricate expected value", and — in the prediction pack's list —
warns against confusing probability with expected value. Everything else is this pack's:

- R1's formula, the identity `EV = d × edge`, and the decision to compute both routes and compare.
- R2 in full: push-aware expected value is not mentioned in the source.
- R3's reasoning about why "+EV" is rhetorically effective, and the scope extension to outputs
  outside the ledger.
- R5 in full — the source does not say that expected value must not be sufficient on its own, and
  this is the standard's most substantive addition.

## Relationship to other standards

[Standard 7](07-edge.md) produces the edge this converts. [Standard 9](09-uncertainty-discount.md)
supplies the discounted probability R1 requires. [Standard 10](10-minimum-edge.md) and
[Standard 20](20-pass-decisions.md) implement R5's conjunction.
[Standard 12](12-unit-sizing.md) sizes from the same discounted probability rather than from this
number directly.

## Implementation

**Met.** `ev.computed-and-recorded` is evaluated on every record: the checker recomputes expected
value by both routes of R1 and reports a finding if they disagree with each other or with the recorded
value. [`scripts/betmath.mjs`](../scripts/betmath.mjs) implements the push-aware form of R2, and its
tests assert that it reduces to the plain form when the push probability is zero.

R5 is implemented as the shape of the code rather than as a check: there is no `shouldBet()` function
in `betmath.mjs`, and the module's documentation says why. The gate is a conjunction in
[`scripts/decisions.mjs`](../scripts/decisions.mjs), evaluated independently of what the record
decided.

**Partially met.** `ev.no-unsupported-ev-claims` scans recorded prose for EV claims that do not
resolve to a calculation; outputs outside the ledger are invisible to it. `ev.no-fabricated-ev`
detects an expected value inconsistent with its recorded inputs, but one computed correctly from
fabricated inputs passes. Both assurance notes say so.
