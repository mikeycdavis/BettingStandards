# Worked example 004 — a PASS on a stale prediction, despite a large apparent edge

Record: [`examples/ledger/DEC-20260809-004.json`](../ledger/DEC-20260809-004.json)

The most dangerous record in this repository, and the reason it is included: the arithmetic is
flawless and the conclusion it supports is worthless.

## The situation

Tampa at Halifax. A model gave Tampa 62% — when it ran, at 20:00 the previous evening, nearly 22 hours
before this decision and before the starting pitcher was announced. The book is offering −120.

## The pipeline

Everything computes cleanly:

```text
impliedProb    = 1 / 1.833333 = 0.545455
marketFairProb = 0.521739
rawEdge        = 0.62 − 0.545455 = 0.074545
adjustedEdge   = 0.074545 × (1 − 0.20) = 0.059636
evPerUnit      = 1.833333 × 0.059636 = 0.109333
kellyFraction  = 0.1312  →  recommendedStake = 300.00 (capped)
```

Nearly six points of edge after discounting. Eleven cents of expected value per unit. Nothing is open,
so no exposure cap binds. On every number that matters this is a strong wager.

### Staleness

```text
prediction age = 1305 minutes    limit = 720
```

The estimate is 21 hours 45 minutes old, against a 12-hour limit.

**PASS, reason: `stale-prediction`.**

## Why the numbers are worthless

The 0.62 is not wrong in the way a bad estimate is wrong. It was a reasonable estimate of a different
situation — one in which the starting pitcher was unknown. That uncertainty was part of what produced
the number, and it has since been resolved, in a direction the estimate cannot account for because it
predates the announcement.

So the edge of 5.96 points is a comparison between today's price, which reflects the announced
pitcher, and yesterday's probability, which does not. The subtraction is arithmetically valid and
semantically meaningless. This is what makes a stale input more dangerous than an obviously bad one:
a bad estimate usually looks bad, while a stale estimate looks exactly like a good one and produces a
large, confident, entirely spurious edge.

It is worth noticing which direction the error runs. A price that has moved on new information will
often look like an edge against an estimate that predates it — precisely *because* the market knows
something the estimate does not. Stale inputs therefore tend to manufacture apparent opportunities
rather than hide them, which is the worst possible bias for a system that is deciding whether to risk
money.

## The clock is a floor, not a definition

The policy limit caught this one, but the limit is a minimum standard of diligence rather than a
definition of freshness ([Standard 16](../../standards/16-stale-predictions.md) R4).

An estimate 20 minutes old is stale if a lineup was announced 15 minutes ago. Nothing in the record
says what happened in the world, so no check can catch that case — the timestamp comparison is the
part that can be mechanised, and it is not the whole rule. The honest position, stated in Standard 16
rather than hidden in an assurance note, is that passing the freshness check does not establish that
the input is fresh.

## Why this reports as a warning rather than an error

The checker reports `stale-prediction` on this record at warning severity, not error. The staleness is
real and worth surfacing — but it is also *why the wager was declined*, and reporting a correct
decision as a violation would make the system's own good behaviour look like non-compliance.

On a BET the same finding is an error. The difference is not the staleness; it is whether money was
risked on it.
