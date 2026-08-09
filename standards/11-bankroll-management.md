# Standard 11 — Bankroll Management

The bankroll is the money set aside for wagering, and it is the denominator of every constraint in
this pack. A stake is not "large" or "small" in itself; it is a fraction of a bankroll, and without a
declared bankroll the caps in [Standards 12](12-unit-sizing.md) and [13](13-maximum-exposure.md) are
fractions of nothing.

Source: the "bankroll management" item of the "Required standards" list in
[`artifacts/prompts/original-prompt.md`](../artifacts/prompts/original-prompt.md).

## Scope

Applies to any project or person placing wagers under these standards.

## Requirements

### R1 — The bankroll is declared and ring-fenced

A bankroll is an explicitly stated amount, separate from money needed for anything else. It is
declared in configuration and recorded on every decision, with the currency or unit it is measured in
and the moment it was current.

Ring-fencing is what makes the figure meaningful. A bankroll that quietly extends to whatever is
available is not a constraint, and the caps computed from it describe nothing. The declaration is
also what makes a breach visible: without a stated figure, no exposure is ever "too much".

### R2 — Every stake and exposure figure is a fraction of the current bankroll

All sizing and all caps are proportional. Recording the bankroll on each decision, rather than
referring to a single global figure, is what lets a record be checked against the bankroll as it
actually stood — a wager sized against last month's larger balance is a different wager.

Proportional sizing also means the constraints track the bankroll downward. After losses the unit
shrinks, which is the correct direction and the opposite of what
[Standard 12](12-unit-sizing.md) R3–R6 prohibit.

### R3 — Only the bankroll is at risk

No wager is funded from outside the declared bankroll: not borrowed money, not funds committed
elsewhere, not an anticipated future balance. If the bankroll cannot support a wager, the wager is
not available — that is what the figure is for.

### R4 — Bankroll and exposure constraints MUST NEVER be exceeded

**No wager is taken that would push a stake, a correlation group, or total open exposure past its
declared cap.**

This prohibition is stated here and enforced in [Standard 13](13-maximum-exposure.md), which owns the
caps. It appears in both places because the two standards answer different halves of it: this one
establishes the denominator, that one sets the limits and aggregates against them.

The constraint binds regardless of how attractive the edge is. A cap that yields to a good enough
opportunity is not a cap — and the opportunity always looks good enough at the moment it is offered,
because that is why it is being taken.

### R5 — Bankroll changes are recorded, not assumed

The bankroll figure on a decision is the figure at that moment. Deposits, withdrawals, and settled
results move it, and each decision records where it stood rather than inferring it from history.

Recording rather than deriving matters because a derived bankroll depends on every prior record being
complete — and [Standard 18](18-record-keeping.md) R1's assurance note is explicit that completeness
is the one thing this pack cannot verify.

## Additions this standard makes beyond the source

The source says "bankroll management" and "Never: exceed defined bankroll/exposure constraints".
Everything else is this pack's:

- R1's requirement that the bankroll be ring-fenced, declared in configuration, and recorded per
  decision with a currency and a timestamp.
- R2 in full, including the observation that proportional sizing makes constraints track the bankroll
  downward.
- R3 in full — the source does not address funding wagers from outside the bankroll.
- R4's reasoning about why a cap must bind precisely when the edge argues against it.
- R5 in full, and its dependence on the completeness limitation stated in Standard 18.

## Relationship to other standards

[Standard 12](12-unit-sizing.md) defines the unit as a fraction of this bankroll and sizes individual
wagers. [Standard 13](13-maximum-exposure.md) sets the caps and owns the prohibition R4 states.
[Standard 14](14-correlated-bets.md) determines which stakes count together against those caps.
[Standard 18](18-record-keeping.md) carries the recorded bankroll figure.

## Implementation

**Met.** `bankroll.defined-in-policy` and `bankroll.unit-defined` read `betting-policy.yml`, and the
decision-record schema requires `bankroll.current`, `bankroll.unit`, and `bankroll.asOf` on every
record, with `current` constrained to be strictly positive.
[`scripts/betmath.mjs`](../scripts/betmath.mjs) refuses a non-positive bankroll everywhere it appears,
so a division that would produce `Infinity` throws instead.

**Not checkable.** Whether the declared figure is money genuinely set aside — R1's ring-fencing and
R3's funding requirement — is outside what any record can establish. The catalog's assurance note on
`bankroll.defined-in-policy` says so: full assurance that a bankroll is declared and recorded, none
that the declaration is true.

In this repository the operational bankroll rules are declared **not-applicable** in
`project-policy.yml`, with a reason and a revisit condition, because this repository defines the
standards and places no bets. The figures in `betting-policy.yml` exist to make the worked examples
checkable. That declaration is an applicability decision, not an exception — the distinction
[Standard 21](21-prohibited-behaviors-and-the-integrity-invariant.md) depends on.
