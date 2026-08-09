# Violation — `decision.no-action-bets`

**[Standard 20 — Pass Decisions](../../standards/20-pass-decisions.md) · forbidden · manual-review · assurance: none**

> No wager is placed or recommended because a wager was wanted — because the game is on, because nothing has been bet today, or because passing feels like doing nothing.

## What it looks like

The game is on, nothing has been wagered today, and passing feels like doing nothing. A wager gets placed on something.

## Why it matters

An action bet is a wager placed for the feeling of having one, and the feeling is indifferent to the price. Each one looks small, which is exactly how a disciplined process becomes an undisciplined one — not by a decision to abandon the thresholds but by a series of exceptions that never felt like exceptions.

## How this repository treats it

**Not mechanically detected, and deliberately not faked.** An action bet that clears every threshold is indistinguishable in the record from a considered one, because the difference is why it was taken.

This rule reports **not-evaluated** until a human records an attestation. It will never report as satisfied because nothing was found — an automated run that looked at nothing has established nothing.

## If it fires

Record the PASS. Having no position is a position.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
