# Violation — `decision.no-resulting`

**[Standard 1 — The Fundamental Invariant](../../standards/01-the-fundamental-invariant.md) · forbidden · manual-review · assurance: none**

> A winning wager is never treated as proof it was a good bet, and a losing wager is never treated as proof it was a bad one. Bet quality is judged from the information available at decision time. Both directions are one behaviour and one rule.

## What it looks like

A wager wins and goes in the mental file of good calls. Another loses and the approach that produced it gets abandoned. Both bullets of the source — a win as proof of a good bet, a loss as proof of a bad one — are the same behaviour and share this rule.

## Why it matters

Judging decisions by outcomes teaches the wrong lesson from every result. A lucky win reinforces a process that will lose over time; an unlucky loss discards one that would have won. Over a career the error compounds in the direction of abandoning discipline exactly when it is working.

The structure defends it even though no check detects it — results live outside the digested decision block, so nothing about a decision changes when its outcome arrives. `examples/decisions/005-settled-loss-that-beat-the-close.md` is the worked case.

## How this repository treats it

**Not mechanically detected, and deliberately not faked.** This prohibits a way of reasoning, and reasoning is not in the record: a review concluding "bad bet, it lost" looks identical in the ledger to one that examined the price.

This rule reports **not-evaluated** until a human records an attestation. It will never report as satisfied because nothing was found — an automated run that looked at nothing has established nothing.

## If it fires

Review the decision against what was known when it was made. If the process was sound, a loss changes nothing about it.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
