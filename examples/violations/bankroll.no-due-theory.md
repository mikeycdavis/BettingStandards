# Violation — `bankroll.no-due-theory`

**[Standard 12 — Unit Sizing](../../standards/12-unit-sizing.md) · forbidden · manual-review · assurance: none**

> No stake is raised on the grounds that a person, team, or outcome is overdue, owed a result, or bound to turn.

## What it looks like

A team has lost six in a row and is "due". The estimate stays where it was; the stake goes up.

## Why it matters

Nothing is ever due. This is the gambler's fallacy applied to sizing rather than to probability, and it is more dangerous there — the untouched probability estimate hides the error while the stake carries it.

## How this repository treats it

**Not mechanically detected, and deliberately not faked.** The reasoning behind a stake is not in the record. The prose scan for the phrase "due for" catches the careless case only.

This rule reports **not-evaluated** until a human records an attestation. It will never report as satisfied because nothing was found — an automated run that looked at nothing has established nothing.

## If it fires

Size from the edge. If the belief that something is due is real, it belongs in the probability estimate with a causal justification, where it can be examined.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
