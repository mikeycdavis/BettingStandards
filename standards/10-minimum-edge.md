# Standard 10 — Minimum Edge

The minimum edge is where this pack's caution lives. It is the number that separates a wager worth
making from one that merely looks like it, and it exists because a small positive edge is
indistinguishable from an estimation error.

Source: the "minimum edge" item of the "Required standards" list in
[`artifacts/prompts/original-prompt.md`](../artifacts/prompts/original-prompt.md).

## Scope

Applies to every BET. A PASS is unaffected by the threshold — declining a wager never requires
clearing a bar.

## Requirements

### R1 — The minimum edge is defined in policy, in advance

The threshold is a configuration value, set before the decisions it governs. A threshold decided case
by case is not a threshold; it is a description of what was done.

Recording it in configuration is also what makes it possible to say afterwards whether a decision
respected it, and — because every decision record pins the digest of the policy it was made under
([Standard 18](18-record-keeping.md) R5) — to tell a decision made under a stricter policy from one
made under a looser one.

### R2 — The threshold is compared against the discounted edge

The comparison uses the edge after [Standard 9](09-uncertainty-discount.md)'s discount, never the raw
edge.

Comparing the raw edge would let an uncertain estimate clear a gate that a confident one would have to
earn, which inverts the intent: uncertainty is supposed to make a wager harder to justify, not easier.

### R3 — No BET below the threshold. A tie meets it

```text
BET requires:  adjustedEdge ≥ minEdge
```

The comparison is inclusive. An edge landing exactly on the threshold meets it, and that boundary is
fixed by a test fixture — `test/fixtures/ledger-negative/boundary-edge-exact-min.json` is a valid BET
sitting precisely on the minimum. If the gate ever silently became "strictly greater than", every
decision on the boundary would flip to PASS and nothing else in the suite would notice.

An edge below the threshold produces a PASS. Not a smaller wager, not a wager taken with a note: a
PASS. A stake that scales down with a shrinking edge still risks money on a signal the bettor has
already judged too weak to trust.

### R4 — The threshold exceeds the costs it must clear

A minimum edge is only meaningful if it is set above what the wager actually costs. Three things
consume edge, and the threshold should exceed all of them together:

- **The margin.** [Standard 5](05-vig.md) removes it from the price, but a threshold set below the
  market's typical hold permits wagers whose value the book has already taken.
- **Estimation error.** An edge smaller than the error bar on the probability that produced it is
  noise. This is the largest of the three and the hardest to quantify, which is why
  [Standard 9](09-uncertainty-discount.md)'s discount is applied first rather than folded in here.
- **Transaction costs** — anything the bettor pays to place, hold, or settle the wager.

Setting the number is a judgement this pack does not make for anyone. What it requires is that the
judgement be made deliberately, recorded, and not revised to admit a particular wager
([Standard 21](21-prohibited-behaviors-and-the-integrity-invariant.md)).

### R5 — A threshold is not lowered to admit a wager

Changing `minEdge` because a specific opportunity falls just below it is the standards-integrity
invariant's central example, and it is prohibited by
[Standard 21](21-prohibited-behaviors-and-the-integrity-invariant.md) rather than here.

The mechanical consequence: because each record pins its policy digest, a threshold change does not
retroactively legitimise past decisions. Old records remain visibly decisions made under different
rules.

## Additions this standard makes beyond the source

The source says "minimum edge". Everything here is this pack's:

- R1's requirement that the threshold be configuration rather than judgement at decision time.
- R2's insistence on the discounted edge, and the reasoning that comparing the raw edge would invert
  the purpose of measuring uncertainty.
- R3's tie rule, its fixture, and the refusal to allow a scaled-down wager below the threshold.
- R4's enumeration of the three costs, and the decision to handle estimation error via the discount
  rather than by inflating the threshold.
- R5's mechanical consequence via policy digest pinning.

## Relationship to other standards

[Standard 7](07-edge.md) and [Standard 9](09-uncertainty-discount.md) produce the number this
compares. [Standard 5](05-vig.md) sets one of the costs R4 requires it to exceed.
[Standard 20](20-pass-decisions.md) receives every decision that fails this gate and establishes that
the result is a success. [Standard 21](21-prohibited-behaviors-and-the-integrity-invariant.md)
prohibits moving the threshold to admit a wager.

## Implementation

**Met.** `edge.minimum-threshold-defined` reads `minEdge` from `betting-policy.yml` and
`edge.threshold-respected` is evaluated on every record. The gate is implemented in
[`scripts/decisions.mjs`](../scripts/decisions.mjs) as one condition in a conjunction, and it is
recomputed independently of what the record decided: a BET below the threshold reports
`negative-edge-bet` no matter what the record claims.

The tie rule of R3 is guarded by its own fixture, which is a *valid* record among the known-negatives
precisely so that a regression in the comparison operator fails a test rather than passing silently.

**Not checkable.** R4 — whether the threshold is set high enough — is a judgement no check can make.
The catalog's assurance note on `edge.minimum-threshold-defined` says exactly that: full assurance
that a threshold exists and is well-formed, none that it is adequate.
