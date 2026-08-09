# Violation — `record.no-silent-revision`

**[Standard 18 — Record Keeping](../../standards/18-record-keeping.md) · forbidden · structural · assurance: partial**

> No decision-time field is edited after the record is written. A correction is a new record referencing the original, never an amendment to it.

## What it looks like

A wager lost. The recorded stake is quietly reduced so the loss looks smaller, or the estimate is nudged so the decision looks more careful in hindsight.

## Why it matters

This is how a betting record becomes a story about how well someone has been doing. It also destroys every other guarantee at once: once records can change, no metric computed from them means anything and no check that reads them proves anything.

A correction is legitimate — as a NEW record referencing the original. What is prohibited is the silent alteration, where the ledger afterwards shows no sign anything was different.

## How this repository treats it

Detected as a finding bound to `record.no-silent-revision`, at error severity.

The known-negative fixture `test/fixtures/ledger-negative/edited-history.json` exercises it, and a test asserts the specific finding fires.

**What the check does not establish.** The decision digest detects any edit to a decision-time field after the record was written, and the policy digest detects a decision re-judged under thresholds it was not made under. Both are defeated by an edit made BEFORE the record was first written, and by rewriting the digest along with the content — the latter being visible in version control history rather than here.

## If it fires

Restore the original values and record the correction as a new record referencing the original.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
