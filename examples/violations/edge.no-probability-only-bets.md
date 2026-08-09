# Violation — `edge.no-probability-only-bets`

**[Standard 7 — Edge](../../standards/07-edge.md) · forbidden · structural · assurance: partial**

> A high probability of winning is not a reason to wager. Every decision passes through the offered price, and the quantity that justifies a BET is edge, never probability alone.

## What it looks like

The favourite is clearly better. The wager gets placed on that basis, and the price is noted afterwards — or not at all.

## Why it matters

This is the most common losing bet there is. The favourite usually does win, so the bettor is repeatedly right about the outcome and repeatedly wrong about the wager, and nothing in the experience prompts a correction. Backing likely winners at any price produces a record of being right most of the time while losing money steadily.

## How this repository treats it

Detected as a finding bound to `edge.no-probability-only-bets`, at error severity.

**What the check does not establish.** Establishes that a price entered the pipeline and that the edge was computed against it. It cannot establish the bettor's motive — a record can show the arithmetic was done and still describe a decision that was really made because the team looked good.

## If it fires

Compute the edge against the offered price. If the price already reflects the probability, the correct decision is PASS.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
