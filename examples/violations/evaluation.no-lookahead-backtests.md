# Violation — `evaluation.no-lookahead-backtests`

**[Standard 19 — Evaluation of the Betting Process](../../standards/19-evaluation-of-the-betting-process.md) · forbidden · manual-review · assurance: none**

> No historical simulation uses closing prices as though they were available at the time of the wager, final lineups announced after the simulated decision, revised statistics, or any other information that did not exist at the moment being simulated.

## What it looks like

A strategy is tested against last season using a data set assembled afterwards: closing prices used as though they were available at bet time, final lineups, revised statistics, a cleaned box score.

## Why it matters

This is the most consequential prohibition in the pack. A leaked backtest produces a confident, quantified, entirely false expectation of profit — in the direction that encourages betting, at a scale the bettor then sizes against. It is rarely deliberate: a data set assembled after the fact simply contains what became known later, and using it feels like using history.

The remedy is to reconstruct the information set as it stood, using data timestamped at or before each simulated decision. Where that is not possible, the honest answer is that the backtest cannot be run — not that it can be run with what is available.

## How this repository treats it

**Not mechanically detected, and deliberately not faked.** Leakage is a property of how a data set was assembled, not a string that appears in a file. A backtest can be entirely leaked without any artifact in this repository looking wrong, and a heuristic here would produce exactly the false confidence the rule is about.

This rule reports **not-evaluated** until a human records an attestation. It will never report as satisfied because nothing was found — an automated run that looked at nothing has established nothing.

## If it fires

Reconstruct the information set as it stood at each simulated decision, using prices and data with timestamps at or before it. Where the historical information set cannot be reconstructed, say so rather than substituting what is available now.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
