# Violation — `ev.no-fabricated-ev`

**[Standard 8 — Expected Value](../../standards/08-expected-value.md) · forbidden · structural · assurance: partial**

> No expected value is stated that does not follow from a recorded probability, price, and stake.

## What it looks like

An expected value is quoted that was never computed — estimated from a feeling about the wager, or carried over from a similar-looking one.

## Why it matters

An invented expected value is worse than none at all: it carries the authority of a calculation while having none of the substance.

## How this repository treats it

Detected as a finding bound to `ev.no-fabricated-ev`, at error severity.

The known-negative fixture `test/fixtures/ledger-negative/ev-mismatch.json` exercises it, and a test asserts the specific finding fires.

**What the check does not establish.** Detects an expected value inconsistent with its recorded inputs. One computed correctly from fabricated inputs passes here.

## If it fires

Recompute expected value from the recorded inputs, or correct the inputs to those actually used.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
