# Standard 7 — Edge

Edge is the quantity the entire pipeline exists to produce: the distance between what you believe and
what you are being charged. It is a comparison, which means it cannot exist without both terms — and
the term people skip is the price.

Source: the "edge" item of the "Required standards" list in
[`artifacts/prompts/original-prompt.md`](../artifacts/prompts/original-prompt.md).

## Scope

Applies to every decision, BET and PASS alike. A PASS with a recorded negative edge is doing exactly
what this standard asks of it.

## Requirements

### R1 — Edge is the estimated fair probability minus the implied probability

```text
rawEdge = estimatedFairProb − impliedProb
```

Additive, and recorded that way. The ratio form — `estimatedFairProb / impliedProb − 1` — is
derivable from the same two inputs; storing one and deriving the other keeps a single definition,
whereas storing both creates two numbers that can drift apart.

The edge is signed. A negative edge is a real and extremely common finding, and recording it is how a
PASS shows its work rather than merely asserting a conclusion.

### R2 — A wager MUST NEVER be placed only because an outcome is likely to win

**A high probability of winning is not a reason to wager.** The favourite usually does win. The price
already says so, and often says so generously.

This is the most common losing bet there is, and its structure is worth naming: backing likely
winners at any price produces a record of being right most of the time while losing money steadily.
The feedback is inverted — the bettor is repeatedly correct about the outcome and repeatedly wrong
about the wager — so nothing in the experience prompts a correction.

The requirement is structural, not attitudinal: the price enters the pipeline, the edge is computed
against it, and if the price already reflects the probability the decision is a PASS.

### R3 — Edge MUST NEVER be fabricated

**No edge is stated that does not follow from a recorded probability and a recorded price.** A stated
edge that does not recompute from its inputs is a fabrication, not a rounding difference.

Edge is the number that authorises risking money. Stating one that does not follow from its inputs is
the shortest available path from a wish to a wager, and it is the number a reader is least likely to
recompute by hand.

### R4 — The edge that matters downstream is the discounted one

The raw edge computed here is an intermediate value. What
[Standard 10](10-minimum-edge.md)'s threshold compares, and what
[Standard 12](12-unit-sizing.md) sizes from, is the edge after
[Standard 9](09-uncertainty-discount.md)'s discount has been applied.

Recording both is deliberate. The raw edge shows what the estimate claimed; the discounted edge shows
what the bettor was willing to act on. A record carrying only one of them hides either the claim or
the caution.

## Additions this standard makes beyond the source

The source says "edge", "Never: bet solely because a team/player is likely to win", and "Never:
fabricate edge". Everything else is this pack's:

- R1's choice of the additive form, the decision to derive rather than store the ratio form, and the
  requirement that a negative edge be recorded rather than discarded.
- R2's account of *why* probability-only betting persists — that the bettor is repeatedly right about
  the outcome and wrong about the wager, so the experience never prompts a correction.
- R3's distinction between a fabrication and a rounding difference.
- R4 in full: the separation of raw and discounted edge, and the reason for recording both.

## Relationship to other standards

[Standard 4](04-implied-probability.md) and [Standard 6](06-fair-probability.md) produce the two
terms. [Standard 5](05-vig.md) ensures the implied side has had the margin removed — without it every
edge here is overstated. [Standard 9](09-uncertainty-discount.md) discounts this number and
[Standard 10](10-minimum-edge.md) judges the result. [Standard 8](08-expected-value.md) converts it
into money per unit staked.

## Implementation

**Met.** `edge.computed-from-inputs` is evaluated on every record: the checker recomputes the raw
edge from the recorded fair and implied probabilities. The function signature in
[`scripts/betmath.mjs`](../scripts/betmath.mjs) enforces R2 at the type level in the only way code can
— `edge(fairProb, impliedProb)` cannot be called without a price, and both arguments are constrained
to the open interval `(0, 1)`.

**Partially met.** Two prohibitions carry `assurance: partial`, and for different reasons.

`edge.no-fabricated-edge` detects an edge inconsistent with its recorded inputs. An edge computed
*correctly* from a fabricated probability or price passes it, and is caught — if at all — by the
provenance rules in [Standard 3](03-odds-conversion.md).

`edge.no-probability-only-bets` establishes that a price entered the pipeline and that the edge was
computed against it. It cannot establish motive: a record can show the arithmetic was performed and
still describe a decision that was really made because the team looked good, with the numbers
assembled afterwards. The catalog says so.
