# Violation — `odds.no-fabrication`

**[Standard 3 — Odds Conversion](../../standards/03-odds-conversion.md) · forbidden · structural · assurance: partial**

> No price is invented, estimated, or filled in from memory. Every price in a decision record was observed at a named book at a recorded time, and the price wagered on matches the market recorded beside it.

## What it looks like

A price was seen an hour ago and the record is being written now. The book has moved on and the exact number is gone, so it goes in from memory as "about -110". Or a market was never checked at all, and a plausible price is entered so the record looks complete.

## Why it matters

Every number downstream is computed from the price: implied probability, edge, expected value, the stake. A fabricated price does not produce a slightly wrong answer — it produces a full chain of correct-looking arithmetic about a wager that was never on offer. Every check passes, because the arithmetic is fine. The number was the lie.

## How this repository treats it

Detected as a finding bound to `odds.no-fabrication`, at error severity.

The known-negative fixture `test/fixtures/ledger-negative/fabricated-odds.json` states an edge and an expected value for a selection that does not appear in the recorded market, which is the structural trace this leaves.

**What the check does not establish.** Detects only the structural traces of fabrication: a price with no provenance, or one that disagrees with the market recorded alongside it. A plausible invented price with complete provenance fields is INDISTINGUISHABLE from a real one to this check. It MUST NOT be reported as 'no odds were fabricated'.

## If it fires

Remove the record or replace the price with an observed quote and re-derive every value from it. Do not estimate a price that was not seen.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
