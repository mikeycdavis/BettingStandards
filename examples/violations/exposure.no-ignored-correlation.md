# Violation — `exposure.no-ignored-correlation`

**[Standard 14 — Correlated Bets](../../standards/14-correlated-bets.md) · forbidden · structural · assurance: partial**

> No decision treats correlated wagers as independent, and none omits the correlation assessment.

## What it looks like

Three wagers on one game are recorded as three independent positions, each comfortably within the single-bet cap.

## Why it matters

The book looks diversified and is one large position. The failure is invisible until the correlated leg resolves, at which point every ticket settles the same way at once.

The check establishes that an assessment was recorded and applied. A bettor who marks every wager as uncorrelated passes it while ignoring correlation completely.

## How this repository treats it

Detected as a finding bound to `exposure.no-ignored-correlation`, at error severity.

**What the check does not establish.** Establishes that an assessment was recorded and applied. It cannot establish that the assessment was right: a bettor who marks every wager as uncorrelated passes this check while ignoring correlation completely.

## If it fires

Record the correlation assessment and aggregate correlated stakes against the group cap.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
