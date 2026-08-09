# Standard 13 — Maximum Exposure

Per-wager sizing bounds the damage from one wrong estimate. Only a cap on aggregate exposure bounds
the damage from several wrong estimates resolving at once — which is the situation that actually ends
bankrolls.

Source: the "maximum exposure" item of the "Required standards" list in
[`artifacts/prompts/original-prompt.md`](../artifacts/prompts/original-prompt.md).

## Scope

Applies to every BET, evaluated against the positions already open at the moment of the decision.

## Requirements

### R1 — Three caps are defined in policy

- **`maxSingleBetPct`** — the largest stake any one wager may risk, as a fraction of bankroll. Applied
  even when [Standard 12](12-unit-sizing.md)'s sizing rule recommends more.
- **`maxGroupExposurePct`** — the largest total stake within one correlation group
  ([Standard 14](14-correlated-bets.md)).
- **`maxTotalExposurePct`** — the largest total open stake across everything.

All three are fractions of the current bankroll, set in advance.

### R2 — Aggregate exposure is computed before the decision, not after

Every decision records the positions already open and the exposure that would result from taking the
wager. A cap can only bind if the total is known at the moment of the decision: computing exposure
afterwards tells you what happened, while computing it before is what stops it.

The record carries `openExposure` explicitly rather than deriving it from the ledger. An empty array
is a positive claim that nothing was open, which is a different statement from a field left out.

### R3 — Correlated stakes count together

Exposure within a correlation group sums. [Standard 14](14-correlated-bets.md) owns what correlation
means and how groups are assigned; this standard is where the group total meets a cap.

### R4 — Bankroll and exposure constraints MUST NEVER be exceeded

**No wager is taken that would push a stake, a correlation group, or total open exposure past its
declared cap.**

The cap binds regardless of how attractive the edge is. This is the requirement's whole point: a cap
that yields to a sufficiently good opportunity is not a cap, and the opportunity always looks
sufficiently good at the moment it is offered, because that is why it is being taken. The constraint
exists precisely for the case where the edge argues against it.

Where a wager would breach a cap, the options are to reduce the stake until it fits or to record a
PASS. [`examples/ledger/DEC-20260809-003.json`](../examples/ledger/DEC-20260809-003.json) is a PASS of
exactly this kind: a genuine edge, declined because the group cap would have broken.

### R5 — The caps rest on the ledger being complete

Every exposure figure in this pack is computed over *recorded* wagers. A wager placed and never
recorded is invisible to every cap here, and it makes every total understate the real position.

This is stated as a requirement rather than left as an implementation note because it changes what a
clean exposure report means. The report says "the recorded book is within its caps". It does not say
"the bettor is within their caps" unless [Standard 18](18-record-keeping.md) R1 is being honoured —
and that is the one thing this pack cannot verify from inside.

## Additions this standard makes beyond the source

The source says "maximum exposure" and "Never: exceed defined bankroll/exposure constraints".
Everything else is this pack's:

- R1's three specific caps. The source names no cap structure.
- R2's requirement that exposure be computed pre-decision, and that an empty `openExposure` be an
  explicit claim rather than an omission.
- R4's argument that a cap must bind precisely when the edge argues against it.
- R5 in full: the scoping of every exposure claim to the recorded universe, and the explicit statement
  of what a clean report does and does not mean.

## Relationship to other standards

[Standard 11](11-bankroll-management.md) provides the bankroll these caps are fractions of, and states
the same prohibition from the bankroll's side. [Standard 12](12-unit-sizing.md) produces the stake
that `maxSingleBetPct` bounds. [Standard 14](14-correlated-bets.md) determines which stakes aggregate.
[Standard 18](18-record-keeping.md) R1 is the assumption R5 names.

## Implementation

**Met.** `exposure.caps-defined` reads all three caps from `betting-policy.yml`, and
`exposure.aggregate-computed` is evaluated on every record: the checker recomputes group and total
exposure from the recorded open positions and reports `exposure-exceeded` when a BET breaches a cap.
`test/fixtures/ledger-negative/exposure-breach.json` is that case.

One implementation detail worth naming, because it changes what a PASS record can say: the gates for a
PASS are evaluated against the **recommended** stake rather than the actual one. A PASS stakes
nothing, so checking a zero stake against an exposure cap would clear it by construction, and a PASS
taken *because* a cap would break could only ever record its reason as "discretionary". That would
make a disciplined refusal indistinguishable from a shrug.

**Partially met.** `exposure.no-cap-breaches` carries `assurance: partial` for the reason R5 states.
The arithmetic over recorded wagers is exact; the claim it supports is narrower than it looks, and the
catalog's assurance note spells that out.
