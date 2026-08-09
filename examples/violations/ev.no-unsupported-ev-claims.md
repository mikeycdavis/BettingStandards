# Violation — `ev.no-unsupported-ev-claims`

**[Standard 8 — Expected Value](../../standards/08-expected-value.md) · forbidden · document · assurance: partial**

> No output describes a wager as positive EV, or +EV, unless it resolves to a decision record carrying the probability and price the claim rests on.

## What it looks like

"This is +EV" appears in a message, a tip, or a summary, with no probability and no price behind it.

## Why it matters

Used without arithmetic, "+EV" is a claim of rigour rather than an instance of one. It borrows the authority of a calculation while skipping it, and it is hard to argue with precisely because it sounds like the argument has already been had.

The check scans recorded prose. A claim made in conversation, a message, or a spreadsheet is invisible to it — which is most of where this violation actually happens.

## How this repository treats it

Detected as a finding bound to `ev.no-unsupported-ev-claims`, at error severity.

**What the check does not establish.** Scans recorded prose for EV claims that do not resolve to a calculation. Outputs outside the ledger — a message, a conversation, a spreadsheet — are not visible to this check at all.

## If it fires

Either produce the decision record with the probability and price behind the claim, or drop the claim.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
