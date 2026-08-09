# Violation — `bankroll.no-loss-driven-sizing`

**[Standard 12 — Unit Sizing](../../standards/12-unit-sizing.md) · forbidden · structural · assurance: partial**

> The size of a wager is a function of its own edge, price, and the declared sizing rule. Prior results are not an input to it.

## What it looks like

Not a formal progression — just a slightly larger stake than usual, because the last few went badly and it would be good to get back to level.

## Why it matters

Past results carry no information about the next wager's edge, so letting them move the stake adds variance without adding expectation. It is the gambler's fallacy expressed in money rather than in probability, and it is harder to see because the probability estimate is left untouched while the stake carries the mistake.

## How this repository treats it

Detected as a finding bound to `bankroll.no-loss-driven-sizing`, at error severity.

The known-negative fixture `test/fixtures/ledger-negative/martingale-seq/` exercises it, and a test asserts the specific finding fires.

**What the check does not establish.** Detects a stake that grew after a loss AND exceeds the record's own recommended stake. A loss-driven increase that stays within the recommended stake is not distinguishable from ordinary sizing and is not reported.

## If it fires

Recompute the stake from this wager's own edge and the sizing rule.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
