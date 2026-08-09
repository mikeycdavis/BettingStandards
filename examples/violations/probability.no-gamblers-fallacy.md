# Violation — `probability.no-gamblers-fallacy`

**[Standard 6 — Fair Probability](../../standards/06-fair-probability.md) · forbidden · manual-review · assurance: none**

> No probability estimate is raised or lowered on the grounds that an independent outcome is overdue, has 'run hot', or must balance out. Streaks in independent events carry no information about the next one.

## What it looks like

Nine heads in a row, so tails is more likely now. Or: this team has covered five straight, so they are unlikely to cover again.

## Why it matters

The fallacy is persuasive because a streak is real, observable, and salient — it feels like evidence. But a probability adjusted for a streak has been moved by something carrying no information, and every number downstream inherits the error while looking exactly as rigorous as before.

Where a streak genuinely is informative — fatigue, a cumulative injury, an adaptation — the causal mechanism belongs in the estimate, recorded so it can be examined. "They are due" is not a mechanism.

## How this repository treats it

**Not mechanically detected, and deliberately not faked.** Reasoning is not in the record, and a text scan for words like "due" would catch the careless case while missing the substance and flagging honest prose.

This rule reports **not-evaluated** until a human records an attestation. It will never report as satisfied because nothing was found — an automated run that looked at nothing has established nothing.

## If it fires

Estimate the probability from causal factors. If a streak is genuinely informative — fatigue, injury, a changed system — record the causal mechanism, not the streak.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
