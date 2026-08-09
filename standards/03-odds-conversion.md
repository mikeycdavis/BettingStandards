# Standard 3 — Odds Conversion

A price is the first hard fact in a wagering decision, and the only one the bettor does not choose.
Everything downstream — implied probability, edge, expected value, stake — is computed from it, so an
error here does not produce a slightly wrong answer. It produces a confident answer about a different
wager.

This standard fixes the conversions between notations, requires every price to carry its provenance,
and prohibits inventing one.

Source: the "odds conversion" item of the "Required standards" list in
[`artifacts/prompts/original-prompt.md`](../artifacts/prompts/original-prompt.md).

## Scope

Applies to every price recorded in a decision: the price wagered on, every other outcome in the
market, any earlier prices in a line history, and any closing price.

## Requirements

### R1 — Decimal odds are the canonical form

Every price is recorded in decimal, and every calculation uses the decimal value. Other notations may
be recorded alongside it as the form the book displayed, but they are never the basis of a
computation.

The reason is arithmetic rather than aesthetic: decimal odds are a single positive number that
multiplies a stake, so they compose. American odds change formula at a discontinuity, and fractional
odds are not canonical at all.

### R2 — The conversions

| From | To decimal |
| --- | --- |
| American `a`, where `a ≥ 100` | `1 + a / 100` |
| American `a`, where `a ≤ −100` | `1 + 100 / \|a\|` |
| Fractional `n/d` | `1 + n / d` |

And back, where `d` is decimal odds:

| From decimal | To American |
| --- | --- |
| `d ≥ 2` | `+(d − 1) × 100` |
| `1 < d < 2` | `−100 / (d − 1)` |

Three boundary facts, each of which has to be settled explicitly because leaving it implicit is how a
conversion library ends up with two answers:

- **`+100` and `−100` both mean even money** and both convert to decimal `2.0`. Converting back
  yields `+100`; that choice is arbitrary but must be fixed for round-tripping to be testable.
- **American odds with `|a| < 100` are not a price.** The notation expresses a ratio against 100, so
  values in that interval cannot represent a payout. They are refused rather than converted, because
  the input that most often lands there is a typo — `-11` for `-110` — and a typo that silently
  becomes a plausible price is worse than one that stops the run.
- **Decimal odds must exceed 1.** A price of exactly 1 returns the stake and pays nothing, and would
  make the Kelly denominator `d − 1` a division by zero.

There is deliberately **no conversion from decimal back to fractional**. The fractional
representation is not canonical — `10/11` and `20/22` are the same price — so any implementation
would have to invent a convention and then impose it on records. Refusing is more honest than
choosing arbitrarily.

### R3 — Where more than one notation is recorded, they must agree

If a price is recorded as both American `−110` and decimal `1.909091`, the two must be consistent.
A disagreement means at least one of them was typed rather than observed.

### R4 — Every price carries its book and the moment it was observed

A price is a fact about a moment. Without the book and the timestamp, a quote cannot be shown to have
been current, and [Standard 16](16-stale-predictions.md)'s freshness check has nothing to measure.

The selection wagered on must also appear in the recorded market ([Standard 5](05-vig.md) R1 requires
the full market), so the price can be traced to a quote rather than standing alone.

### R5 — Odds MUST NEVER be fabricated

**No price is invented, estimated, recalled from memory, or filled in to complete a record.** Every
price was observed at a named book at a recorded time.

This is the prohibition that the rest of the pack's arithmetic rests on. A fabricated price does not
merely make one record wrong: it produces a full chain of correct-looking computation — implied
probability, edge, expected value, a stake — about a wager that was never on offer. Every check
downstream will pass, because the arithmetic is fine. The number was the lie.

Where a price could not be observed, it is recorded as absent. An absent price is a fact; an
estimated one is a fabrication with a plausible face.

## Additions this standard makes beyond the source

The source says "odds conversion" and, separately, "Never: fabricate odds". Everything else is this
pack's:

- R1's choice of decimal as canonical, and the reason for it.
- Every formula in R2, all three boundary decisions, and the refusal to implement
  decimal-to-fractional conversion.
- R3 and R4 in full, including the requirement that the selection appear in the recorded market.
- R5's reasoning — that a fabricated price passes every downstream check because the arithmetic is
  correct — and the instruction to record an unobserved price as absent.

## Relationship to other standards

[Standard 4](04-implied-probability.md) consumes the decimal price. [Standard 5](05-vig.md) requires
the full market, which is what makes the margin computable. [Standard 15](15-line-movement.md)
governs earlier prices and carries the parallel prohibition on fabricating movement.
[Standard 16](16-stale-predictions.md) uses the capture timestamp this standard requires.

## Implementation

**Met.** `odds.conversion-exact` and `odds.quote-provenance` are evaluated on every record.
[`scripts/betmath.mjs`](../scripts/betmath.mjs) implements every conversion in R2, throws on all three
boundary violations rather than returning a plausible number, and its test suite asserts the
round-trip across the realistic range of American prices. The checker reports `price-format-mismatch`
when notations disagree and `selection-not-in-market` when a price cannot be traced to a quote.

**Partially met, and the limit is the important part.** `odds.no-fabrication` carries
`assurance: partial`. It detects the structural traces of fabrication — a price with no provenance, or
one that disagrees with the market recorded beside it. A plausible invented price with complete
provenance fields is indistinguishable from a real one to any check inside this repository, and the
catalog's assurance note says exactly that. It MUST NOT be reported as establishing that no odds were
fabricated.
