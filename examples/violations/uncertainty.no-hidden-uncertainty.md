# Violation — `uncertainty.no-hidden-uncertainty`

**[Standard 9 — Uncertainty Discount](../../standards/09-uncertainty-discount.md) · forbidden · structural · assurance: partial**

> No decision presents a probability estimate as more certain than it is by omitting, suppressing, or understating the uncertainty attached to it.

## What it looks like

The model's range was 50–60% and the record shows 55% with a 10% discount, because the wider figure would not have cleared the threshold. Or the discount field is filled in with a habitual number rather than an assessment.

## Why it matters

Nothing is asserted falsely; something true is simply left out. And the omission always runs in the direction that makes a thin edge look like a real one — that directional bias is what makes it a prohibition rather than a matter of style.

The check detects a missing or out-of-range discount. It cannot detect one that is present, in range, and dishonestly small, which is the most likely form of this violation.

## How this repository treats it

Detected as a finding bound to `uncertainty.no-hidden-uncertainty`, at error severity.

**What the check does not establish.** Detects a missing or out-of-range discount and a longshot floor breach. It cannot detect a discount that is present, in range, and dishonestly small — the most likely form of this violation.

## If it fires

Record the uncertainty honestly and let the discounted edge decide. If that turns a BET into a PASS, the PASS was the correct answer all along.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
