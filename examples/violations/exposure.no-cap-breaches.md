# Violation — `exposure.no-cap-breaches`

**[Standard 13 — Maximum Exposure](../../standards/13-maximum-exposure.md) · forbidden · structural · assurance: partial**

> No wager is taken that would push a stake, a correlation group, or total open exposure past its declared cap. The cap binds regardless of how attractive the edge is.

## What it looks like

A strong edge appears while the book is already near a cap. The wager is taken anyway, because this one is different.

## Why it matters

A cap that yields to a sufficiently attractive edge is not a cap — and the opportunity always looks sufficiently attractive at the moment it is offered, because that is why it is being taken. The constraint exists precisely for the case where the edge argues against it.

## How this repository treats it

Detected as a finding bound to `exposure.no-cap-breaches`, at error severity.

The known-negative fixture `test/fixtures/ledger-negative/exposure-breach.json` exercises it, and a test asserts the specific finding fires.

**What the check does not establish.** Full arithmetic assurance over RECORDED wagers, which is a narrower claim than it appears: a wager placed and never recorded is invisible to this check, and would make every exposure figure understate the real position. This rule rests entirely on record.decision-record-required being satisfied.

## If it fires

Reduce the stake to fit, or record a PASS. A PASS taken because a cap would break is a successful decision.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
