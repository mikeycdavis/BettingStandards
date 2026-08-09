# Standard 15 — Line Movement

How a price moved before a decision is information about what the market learned. Recording it is
recommended rather than required, because not every book publishes a history — but inventing one is
prohibited outright, and the asymmetry between those two positions is the substance of this standard.

Source: the "line movement" item of the "Required standards" list in
[`artifacts/prompts/original-prompt.md`](../artifacts/prompts/original-prompt.md).

## Scope

Applies to any recorded price other than the one wagered on: earlier observations of the same market,
and the closing price ([Standard 17](17-closing-line-value.md)).

## Requirements

### R1 — Where earlier prices are observable, they are recorded with their timestamps

A line history is a list of observed prices, each with the moment it was seen and the source it came
from. Oldest first.

This is `recommended`, not `required`, and the reason is worth stating plainly: many books publish no
price history, and a requirement that cannot be satisfied honestly is a requirement that gets
satisfied dishonestly. Making it mandatory would push a bettor toward reconstructing prices from
memory, which is the behaviour R3 prohibits. A rule that manufactures its own violations is a badly
designed rule.

### R2 — Movement is interpreted as information, not as confirmation

A line moving toward a position means the market has come to agree with it. That is evidence about
the estimate — mildly encouraging — and it is not evidence that the wager will win.

A line moving *against* a position is decision-relevant in the other direction: the market has learned
something, and if the bettor cannot say what it was, that is itself worth knowing before committing.
Movement against a position is not a reason to increase a stake to "get the better number back", which
is [Standard 12](12-unit-sizing.md) R5's prohibition arriving by a different route.

### R3 — Line movement MUST NEVER be fabricated

**No price history, closing price, or claim about how a line moved is invented, back-filled from
memory, or reconstructed after the fact.**

This prohibition matters more than its subject suggests, because fabricated movement corrupts the one
metric that grades process rather than outcome. A record showing the line moved toward every position
would make a losing process look skilled indefinitely — and closing-line value is exactly the metric
[Standard 19](19-evaluation-of-the-betting-process.md) leans on when profit is too noisy to read.

It is also the easiest number in the ledger to invent, because nobody can check a price that no longer
exists. That combination — high value, low verifiability — is why it is a prohibition rather than a
data-quality preference.

### R4 — An unobserved price is recorded as absent

Where a price was not seen, the field is left absent. Absence is a fact and is recorded as one; an
estimate presented in its place is a fabrication with a plausible face.

This is the same rule as [Standard 3](03-odds-conversion.md) R5 and
[Standard 17](17-closing-line-value.md) R3, stated once per context because the temptation arrives
differently in each.

## Additions this standard makes beyond the source

The source says "line movement" and "Never: fabricate line movement". Everything else is this pack's:

- R1's decision to make recording *recommended* rather than required, and the reasoning that a rule
  which cannot be satisfied honestly gets satisfied dishonestly.
- R2 in full — the interpretation of movement in both directions, and the observation that chasing a
  moved line is loss-driven sizing in disguise.
- R3's argument for why this prohibition carries more weight than it appears to: fabricated movement
  corrupts the pack's primary process metric, and is the least verifiable number in the ledger.
- R4's explicit instruction to record absence.

## Relationship to other standards

[Standard 3](03-odds-conversion.md) governs the conversion and provenance of every price this records.
[Standard 16](16-stale-predictions.md) uses capture timestamps to judge freshness.
[Standard 17](17-closing-line-value.md) is where the closing price becomes a metric, and inherits R3's
prohibition. [Standard 19](19-evaluation-of-the-betting-process.md) is the consumer whose conclusions
fabricated movement would corrupt.

## Implementation

**Met, narrowly.** `line.movement-recorded` is evaluated where a history is present: the schema
constrains each entry to a valid price with a capture timestamp, and
[`examples/ledger/DEC-20260809-001.json`](../examples/ledger/DEC-20260809-001.json) carries one as a
worked example. Absence of a history is not distinguishable from a book that publishes none, which is
why the rule is recommended and why its assurance note says exactly that.

**Barely met, and stated as such.** `line.no-fabricated-movement` carries `assurance: partial`, and
the partial is generous. It detects only structural impossibilities — a history whose timestamps or
prices are inconsistent with the record around them. An invented but plausible price history passes it
entirely. The catalog's assurance note says it MUST NOT be reported as establishing that line movement
is genuine, and in this repository the rule sits outside the evaluated set, reporting not-evaluated
rather than passing.
