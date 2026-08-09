# Violation — `decision.no-priceless-recommendations`

**[Standard 2 — The Decision Pipeline](../../standards/02-the-decision-pipeline.md) · forbidden · structural · assurance: partial**

> No wager is recommended, suggested, or placed without the offered price entering the decision. A recommendation with no price attached is void, not merely weak.

## What it looks like

A recommendation is made — to oneself or to someone else — before the market has been checked. "Take Portland tonight."

## Why it matters

Without a price there is no implied probability, no edge, and no expected value: only an opinion about who will win. The price is not one input among several, it is the input that makes the others mean anything.

## How this repository treats it

Detected as a finding bound to `decision.no-priceless-recommendations`, at error severity.

**What the check does not establish.** Establishes that a price is present in every recorded decision. A recommendation made outside the ledger — in conversation, a message, a spreadsheet — is not visible to this check.

## If it fires

Obtain the price, run the pipeline, and record the decision. If no price is available, there is no decision to make.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
