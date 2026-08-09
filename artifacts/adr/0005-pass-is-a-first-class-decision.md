# ADR 0005 — PASS is a first-class recorded decision

**Status:** Accepted · **Date:** 2026-08-09 · **Deciders:** repository owner

## Context

The source prompt is explicit: PASS must be treated as a successful decision, and the system should
actively prefer it when edge does not sufficiently exceed uncertainty and costs.

That is easy to agree with and easy to undermine in implementation. If a PASS produces no record, or a
thinner one, or is counted anywhere as inaction, then every threshold in the pack becomes an obstacle
to work around rather than a decision to respect — and the undermining happens quietly, through
reporting rather than through policy.

## Decision

**A PASS produces the same record as a BET**, with a zero stake and the gates that failed.

- The pipeline's gates are conjunctive: a BET requires all of them; anything else is a PASS.
- **A discretionary PASS is always available**, even when every gate passes, recorded as the single
  reason `discretionary`. A BET past a failed gate is never available. That asymmetry is deliberate.
- Recorded PASS reasons must match the gates the checker recomputes.
- No metric in this pack counts a PASS as a missed opportunity or a quiet period as underperformance.

**Gates for a PASS are evaluated against the stake that would have been placed** — the recommended
stake — rather than against the actual zero.

## Alternatives considered

**Record PASSes more briefly: the reason and nothing else.** Rejected. The full pipeline on a PASS is
what makes it possible to ask later whether the thresholds are set sensibly, and that question cannot
be answered from a ledger containing only the wagers that were taken. It is also what lets the checker
verify that the recorded reason is the gate that actually failed.

**Do not record PASSes at all.** Rejected outright: a ledger of BETs cannot distinguish a disciplined
process from one that took every wager it looked at.

**Evaluate PASS gates against the actual stake of zero.** This was the initial implementation and it
was wrong. A zero stake clears every exposure and sizing gate by construction, so a PASS taken
*because* a cap would break could only ever record its reason as `discretionary` — making a
disciplined refusal indistinguishable from a shrug. The bug was caught while building worked example
003, which is exactly that case.

**Require a stated reason for a discretionary PASS.** Rejected. Declining to risk money needs no
justification, and requiring one would create pressure to bet whenever no articulate reason came to
mind. This is also what makes the framework structurally incapable of being forced into a positive
recommendation: there is always a valid answer that risks nothing.

## Consequences

- Three of the five worked examples are PASSes, with genuinely different reasons. A single token PASS
  would not demonstrate what the standard is about.
- The expanded brief's requirement that an AI "must never be forced to produce a positive
  recommendation" is satisfied structurally rather than by instruction: PASS is always available, no
  quota exists, and `discretionary` is a valid reason.
- `decision.pass-is-success` can check that PASSes are recorded with honest reasons. It cannot check
  that the surrounding culture treats a PASS as a success, and its assurance note says so.
