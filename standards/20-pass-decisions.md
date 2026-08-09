# Standard 20 — Pass Decisions

PASS is always a legitimate, successful decision.

Most edges do not clear the bar. A process that declines most of what it looks at is functioning
correctly, not idling — and unless declining is counted as a success, every threshold in this pack
becomes an obstacle to work around rather than a decision to respect.

Source: the "pass decisions" item of the "Required standards" list and the "PASS" section of
[`artifacts/prompts/original-prompt.md`](../artifacts/prompts/original-prompt.md), which states:

> PASS must be treated as a successful decision.

## Scope

Applies to every decision, and to every metric, report, or review that counts them.

## Requirements

### R1 — PASS is a first-class output, recorded in full

A PASS produces the same record as a BET — every pipeline stage, the same rigour — with a zero stake
and the reasons it was declined. [Standard 18](18-record-keeping.md) R5 requires the record; this
standard says why it matters.

### R2 — PASS is the default; BET is what must be earned

The pipeline's gates are conjunctive: a BET requires every one of them to pass. Anything else is a
PASS. There is no configuration in which a wager is taken by default and declined only on an objection.

The asymmetry is deliberate and runs in one direction: **a discretionary PASS is always available,
even when every gate passes.** A bettor who declines a technically qualifying wager for any reason at
all — or no stated reason — has done nothing wrong, and the record format supports that with an
explicit `discretionary` reason. A BET past a failed gate is never available.

That asymmetry is the structural reason this framework can never be forced to produce a positive
recommendation. There is always a valid answer that risks nothing.

### R3 — The recorded reasons are the gates that actually failed

A PASS records which conditions failed, and they must match what the checker recomputes. A PASS
attributed to discretion when the edge was in fact below the minimum is a mislabelled record, and it
hides the very thing the ledger exists to show — that the threshold did something.

`test/fixtures/ledger-negative/pass-reasons-wrong.json` is that mislabelling.

There is a subtlety the implementation has to get right for this to mean anything. A PASS stakes
nothing, so evaluating a zero stake against an exposure cap would clear it automatically, and a PASS
taken *because* a cap would have broken could only ever record "discretionary". The gates for a PASS
are therefore evaluated against the **stake that would have been placed**. Without that, a disciplined
refusal is indistinguishable from a shrug.

### R4 — No wager is recommended merely to create action

**No wager is placed or recommended because a wager was wanted** — because the game is on, because
nothing has been bet today, or because passing feels like doing nothing.

An action bet is a wager placed for the feeling of having one, and the feeling is indifferent to the
price. Each one looks small, which is exactly how a disciplined process becomes an undisciplined one:
not by a decision to abandon the thresholds, but by a series of exceptions that never felt like
exceptions.

### R5 — No betting quota

**No target, minimum, or expected number of wagers per day, week, or season is set** — in
configuration, in a plan, or as an informal expectation. A period with no wagers is a valid outcome.

A quota inverts the decision. Instead of the edge deciding whether to bet, the calendar does, and the
thresholds become obstacles between the bettor and a number they promised themselves. Every quota is
eventually met, and it is met by lowering the bar — which is
[Standard 21](21-prohibited-behaviors-and-the-integrity-invariant.md)'s violation arriving on a
schedule.

### R6 — No metric penalises a PASS

No report counts declined wagers as missed opportunities, no scorecard treats a quiet period as
underperformance, and no measure of activity is used as a measure of quality.

This is what R1 through R5 rest on. Counting PASSes as failures would restore every incentive the
other requirements remove, and it would do so quietly, through reporting rather than through policy.

## Additions this standard makes beyond the source

The source says "pass decisions", states that PASS must be treated as a successful decision, that the
system should prefer PASS when edge does not sufficiently exceed uncertainty and transaction/vig
costs, and prohibits recommending a wager merely to create action and forcing a daily bet quota.
Everything else is this pack's:

- R2's asymmetry between a discretionary PASS and a gated BET, and the observation that this is what
  makes the framework structurally incapable of being forced into a positive recommendation.
- R3 in full, including the contemplated-stake subtlety — without which the source's own requirement
  that PASS be first-class would be undermined by the implementation.
- R4's account of how action bets accumulate, and R5's of how a quota is eventually met.
- R6 in full. The source does not mention metrics; leaving this out would let every incentive the
  other requirements remove return through reporting.

## Relationship to other standards

[Standard 10](10-minimum-edge.md) produces most PASSes. [Standard 13](13-maximum-exposure.md) and
[Standard 16](16-stale-predictions.md) produce the rest.
[Standard 18](18-record-keeping.md) R5 requires the record.
[Standard 1](01-the-fundamental-invariant.md) is what makes a PASS assessable at all — if decisions
were judged by outcomes, a PASS would have no outcome to be judged by.
[Standard 19](19-evaluation-of-the-betting-process.md) R2 counts PASS discipline as a process metric.

## Implementation

**Met.** `record.pass-recorded` and `decision.pass-is-success` are evaluated on every record. The
schema requires `passReasons` and a zero stake on a PASS; the checker recomputes the failed gates and
reports `pass-reasons-wrong` when the record disagrees, and `pass-with-stake` when a PASS risks money.

Three of the five worked examples are PASSes, with genuinely different reasons — a thin edge after
discounting, a correlated-group cap, and a stale prediction — because a ledger of BETs with one token
PASS would not demonstrate what this standard is about.

`decision.no-bet-quota` is `validationType: configuration` with `assurance: partial`. A declared quota
is detectable, and the betting-policy schema rejects unknown fields, so one cannot even be expressed
there. An informal expectation — a habit, a target held in someone's head, a report that counts only
wagers placed — is invisible, and is the far more common form.

**Not met, and cannot be.** `decision.no-action-bets` is `manual-review` with `assurance: none`. An
action bet that clears every threshold is indistinguishable in the record from a considered one,
because the difference is why it was taken. It reports not-evaluated until a human attests.

R6 is not checkable at all from inside this repository: it governs reporting that happens elsewhere.
It is stated because the failure it describes is the most likely way this standard gets quietly
reversed.
