# Violation — `line.no-fabricated-movement`

**[Standard 15 — Line Movement](../../standards/15-line-movement.md) · forbidden · structural · assurance: partial**

> No price history, closing price, or claim about how a line moved is invented, back-filled from memory, or reconstructed after the fact.

## What it looks like

The closing price was not captured before the event. Filling it in afterwards from a different book, or from where the line "must have" gone, completes the record.

## Why it matters

Fabricated movement corrupts the one metric that grades process rather than outcome. A ledger showing the line moved toward every position would make a losing process look skilled indefinitely — and closing-line value is exactly what Standard 19 leans on when profit is too noisy to read. It is also the easiest number in the ledger to invent, because nobody can check a price that no longer exists.

An unobserved price is recorded as **absent**. Absence is a fact; an estimate in its place is a fabrication with a plausible face.

## How this repository treats it

Detected as a finding bound to `line.no-fabricated-movement`, at error severity.

**What the check does not establish.** Detects only structural impossibilities — a history whose timestamps or prices are inconsistent with the record around them. An invented but plausible price history passes this check entirely. It MUST NOT be reported as establishing that line movement is genuine.

## If it fires

Record only observed prices with their capture times. An unobserved price is recorded as absent.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
