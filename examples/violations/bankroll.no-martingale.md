# Violation — `bankroll.no-martingale`

**[Standard 12 — Unit Sizing](../../standards/12-unit-sizing.md) · forbidden · structural · assurance: partial**

> No staking scheme increases the stake after a loss with the intent of recovering it, whether by doubling or by any other progression.

## What it looks like

After a loss, the next stake doubles to recover it. After the next loss, it doubles again.

## Why it matters

Martingale converts a series of survivable losses into one catastrophic loss, and it feels safe right up until it is not. Each step is individually affordable; the sequence is bounded only by the bankroll, and the bankroll always runs out before the losing streak does.

The detector fires only when the increase exceeds what the record's own sizing arithmetic recommended. An increase the bettor's own Kelly maths justifies is indistinguishable from discipline, so a progression that stays inside the recommended stake evades this check.

## How this repository treats it

Detected as a finding bound to `bankroll.no-martingale`, at error severity.

The known-negative fixture `test/fixtures/ledger-negative/martingale-seq/` is a four-record sequence — 100, 200, 400, 800 — where the first escalation reports a warning and the second reports this violation.

**What the check does not establish.** Detects repeated stake increases following losses that the records' own sizing arithmetic does not support. A single escalation reports as a warning; two or more consecutive escalations report as this violation. An escalation the bettor's own Kelly maths justifies does NOT fire, because it is indistinguishable from discipline — so this check can be evaded by a progression that stays inside the recommended stake.

## If it fires

Size every wager from its own edge and the declared rule. Delete the progression.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
