# Violation — `vig.no-ignored-vig`

**[Standard 5 — Vig](../../standards/05-vig.md) · forbidden · structural · assurance: partial**

> No edge or expected value is derived from raw implied probabilities. The bookmaker's margin is removed first, from the full market, by a declared method.

## What it looks like

The estimate is compared against the raw implied probability rather than the vig-removed one. Often it is not a decision at all: only one side of the market was recorded, so there was nothing to remove the margin from.

## Why it matters

This treats the house margin as though it were free. On a standard two-way market that is roughly a two-and-a-half point head start handed to the book on every wager — larger than most genuine edges. The result is a process that reports profitable edges on wagers that lose money over time, consistently, in the direction that encourages betting.

## How this repository treats it

Detected as a finding bound to `vig.no-ignored-vig`, at error severity.

The known-negative fixture `test/fixtures/ledger-negative/vig-ignored.json` records a fair probability identical to the raw implied probability, which is what this violation looks like in a record.

**What the check does not establish.** Detects a fair probability that was not derived from the recorded market, including the specific case where it equals the raw implied probability. It cannot detect a market recorded incompletely, which would understate the margin while passing every check here.

## If it fires

Remove the vig from the full market before computing edge, and recompute every downstream value.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
