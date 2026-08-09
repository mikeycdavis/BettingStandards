# Standard 16 — Stale Predictions

A prediction describes a world. Worlds change — lineups are announced, weather turns, news breaks —
and when the world has moved on, the probability estimate no longer says what it appears to say.

A stale input with an apparent edge is the most dangerous kind, because the number looks like evidence
and is not.

Source: the "stale predictions" item of the "Required standards" list in
[`artifacts/prompts/original-prompt.md`](../artifacts/prompts/original-prompt.md).

## Scope

Applies to both time-sensitive inputs: the probability estimate and the price. Both have shelf lives,
for different reasons.

## Requirements

### R1 — Both inputs carry the moment they were produced

Every decision records when the prediction was made and when the price was captured. Without those
timestamps there is nothing to measure freshness against, and staleness becomes unfalsifiable.

### R2 — Maximum ages are defined in policy

Two limits, set in advance:

- **`maxPredictionAgeMinutes`** — how old an estimate may be at the moment of decision.
- **`maxOddsAgeMinutes`** — how old a price snapshot may be.

The price limit is typically much shorter than the prediction limit, and the asymmetry is not
arbitrary. A price is an *offer*, and an offer withdrawn is simply gone: an edge computed against a
price that is no longer available is an edge against nothing. A prediction is an *estimate*, and it
decays as the information behind it ages rather than vanishing at a moment.

### R3 — No BET on a stale input

A BET requires both inputs to be within their limits and the decision to be recorded before the event
starts. Any of the three failing produces a PASS.

The event-start condition is absolute rather than policy-configurable: a decision recorded at or after
the start is not a prediction about an uncertain event.

### R4 — Material information supersedes the clock

An estimate can be stale well inside its time limit. A prediction made twenty minutes ago is stale if
a starting lineup was announced fifteen minutes ago, because the specific thing it was uncertain about
has since been resolved.

The time limit is a floor on diligence, not a definition of freshness. Where material information has
arrived, the estimate is re-run or the decision is a PASS, regardless of what the clock says.

This requirement is not mechanically checkable and is not pretended to be: nothing in the record says
what happened in the world. It is stated because the mechanical check would otherwise be mistaken for
the whole rule.

### R5 — A stale input with an apparent edge is still a PASS

The temptation this standard exists for: the arithmetic still produces an edge, and the edge may be
large. It is an edge computed from a probability that describes a world that no longer exists, or
against a price that is no longer offered.

[`examples/ledger/DEC-20260809-004.json`](../examples/ledger/DEC-20260809-004.json) is exactly this
case — a prediction nearly twenty-two hours old, predating a lineup announcement, showing an apparent
edge of nearly six points, recorded as a PASS.

## Additions this standard makes beyond the source

The source says "stale predictions". Everything here is this pack's:

- R1's timestamp requirement and R2's two policy limits, including the reasoning for the asymmetry
  between a price (an offer that vanishes) and an estimate (evidence that decays).
- R3's absolute event-start condition.
- R4 in full — the distinction between a time limit and actual freshness, and the explicit
  acknowledgement that the mechanical check is a floor rather than the rule.
- R5's framing of the apparent edge as the temptation, and the worked example.

## Relationship to other standards

[Standard 3](03-odds-conversion.md) R4 requires the capture timestamp this measures.
[Standard 6](06-fair-probability.md) R2 requires the prediction timestamp.
[Standard 15](15-line-movement.md) covers what happened to the price in between.
[Standard 20](20-pass-decisions.md) receives the PASS that R3 and R5 produce.

## Implementation

**Met.** `line.staleness-checked` is evaluated on every record. The checker computes both ages from
the recorded timestamps against the policy limits and reports `stale-odds`, `stale-prediction`, or
`post-start-decision`. On a BET these are errors; on a PASS they are warnings, because declining to
bet on a stale price is the correct response to a stale price rather than a violation.
`test/fixtures/ledger-negative/stale-odds.json` is a BET on a four-hour-old price.

**Not met, and named as such.** R4 is not checkable. The check establishes that the recorded capture
time is within the window; it cannot establish that the price was genuinely current at that time, nor
that no material information arrived. The catalog's assurance note on `line.staleness-checked` states
the first of those limits, and R4 exists so the second is not mistaken for covered.
