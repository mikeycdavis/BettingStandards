# Worked example 003 — a PASS on a good edge, because the edge was not the only question

Record: [`examples/ledger/DEC-20260809-003.json`](../ledger/DEC-20260809-003.json)

The edge here is the best of any example in this repository. The wager is still declined, and that is
the point: a strong edge is a necessary condition for a BET, not a sufficient one.

## The situation

The Over on the Portland/Sacramento total, at −110. A pace-and-efficiency model gives it 60%, with
enough confidence to justify only a 25% haircut. Two positions are already open on the same game:
the Portland moneyline from [example 001](001-bet-clear-edge.md) at 137.50, and an earlier wager at
420.00 — 557.50 in the group already.

## The pipeline

### Edge and expected value

```text
impliedProb    = 1 / 1.909091 = 0.523809
marketFairProb = 0.500000
rawEdge        = 0.60 − 0.523809 = 0.076191
adjustedEdge   = 0.076191 × (1 − 0.25) = 0.057143
evPerUnit      = 1.909091 × 0.057143 = 0.109091
```

Nearly six points of edge after discounting, against a 2% minimum, and eleven cents of expected value
per unit staked. On the numbers so far this is the best opportunity in the ledger.

### Sizing

```text
kellyFraction    = 0.12
kellyStake       = 10000 × 0.25 × 0.12 = 300.00
singleBetCap     = 10000 × 0.03 = 300.00
recommendedStake = 300.00
```

The single-bet cap and quarter Kelly happen to coincide at 300.

### Correlation — where it stops

The Over on this total and the Portland moneyline are not independent wagers. They are two positions
on the same game, driven by the same events: if Portland run away with a high-scoring game, both win
together; if the game is a low-scoring loss, both lose together. Assigning them the same correlation
group is what makes that visible ([Standard 14](../../standards/14-correlated-bets.md) R1).

```text
group exposure already open  = 137.50 + 420.00 = 557.50
group cap = 10000 × 0.06     = 600.00
would become 557.50 + 300.00 = 857.50
```

857.50 against a cap of 600. The gate fails.

**PASS, reason: `group-exposure-cap`.**

## Why the cap wins

This is precisely the case a cap exists for. The edge argues loudly for taking the wager — and the
opportunity always argues loudly at the moment it is offered, because that is why it is being
considered. A cap that yields to a sufficiently attractive edge is not a cap
([Standard 13](../../standards/13-maximum-exposure.md) R4).

The specific risk being bounded is not "losing 300 on this wager". It is that 857.50 — 8.6% of the
bankroll — would ride on the outcome of one game, while the ledger would show three independent-looking
positions. Correlated exposure is how a book that looks diversified turns out to be a single large
bet, and the discovery arrives when the correlated leg resolves and everything settles the same way at
once.

## A subtlety in how this record is checked

A PASS stakes nothing. If the exposure gate were evaluated against the *actual* stake of zero, it
would pass trivially, and this decision could only ever record its reason as `discretionary` — making
a disciplined refusal indistinguishable from a shrug.

So the gates for a PASS are evaluated against the **stake that would have been placed**: the
recommended 300. That is what lets this record say honestly *why* it was declined
([Standard 20](../../standards/20-pass-decisions.md) R3).

The alternative available here, and not taken, was to reduce the stake to 42.50 so the group total
landed exactly on the cap. That would have been legitimate. Declining entirely is also legitimate, and
needs no further justification — a discretionary PASS is always available.
