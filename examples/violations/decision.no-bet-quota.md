# Violation — `decision.no-bet-quota`

**[Standard 20 — Pass Decisions](../../standards/20-pass-decisions.md) · forbidden · configuration · assurance: partial**

> No target, minimum, or expected number of wagers per day, week, or season is set, whether in configuration, in a plan, or as an informal expectation. A period with no wagers is a valid outcome.

## What it looks like

A plan to place five wagers a week, a daily target, or a report that counts only wagers placed and therefore rewards placing them.

## Why it matters

A quota inverts the decision: instead of the edge deciding whether to bet, the calendar does, and the thresholds become obstacles between the bettor and a number they promised themselves. Every quota is eventually met, and it is met by lowering the bar.

A declared quota is detectable — the betting-policy schema rejects unknown fields, so one cannot even be expressed there. An informal expectation, a habit, or a report that counts only placed wagers is invisible, and is the far more common form.

## How this repository treats it

Detected as a finding bound to `decision.no-bet-quota`, at error severity.

**What the check does not establish.** A declared quota in configuration is detectable. An informal expectation — a habit, a target someone holds in their head, a report that counts only wagers placed — is not, and is the far more common form.

## If it fires

Remove the quota. Count PASSes as decisions in whatever reporting replaced it.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
