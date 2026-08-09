# Violation — `bankroll.no-chasing-losses`

**[Standard 12 — Unit Sizing](../../standards/12-unit-sizing.md) · forbidden · manual-review · assurance: none**

> No wager is placed, and no stake is increased, in order to recover a previous loss. Each decision is made on its own edge, price, and exposure, as though the ledger before it were empty.

## What it looks like

A bad evening. One more wager, on a game that would not have been considered at noon, to end the day level.

## Why it matters

Chasing is what turns a bad night into a bad year. A loss creates an urgency the next wager did not earn: the wager gets placed because money is owed to the past, not because a price is wrong in the present.

## How this repository treats it

**Not mechanically detected, and deliberately not faked.** Chasing is defined by motive, and motive is not in the record — a wager placed to recover a loss is indistinguishable from the same wager placed on its merits. The mechanical shadow is `bankroll.no-loss-driven-sizing`, which catches the sizing pattern chasing usually produces.

This rule reports **not-evaluated** until a human records an attestation. It will never report as satisfied because nothing was found — an automated run that looked at nothing has established nothing.

## If it fires

Evaluate the next decision on its own merits. If it does not clear the threshold on its own, it is a PASS regardless of what came before.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
