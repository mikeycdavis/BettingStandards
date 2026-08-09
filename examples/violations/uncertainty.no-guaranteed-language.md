# Violation — `uncertainty.no-guaranteed-language`

**[Standard 9 — Uncertainty Discount](../../standards/09-uncertainty-discount.md) · forbidden · document · assurance: partial**

> No wager is described as guaranteed, a lock, a sure thing, risk-free, or unable to lose. No outcome is described as due.

## What it looks like

A wager is described as a lock, a guaranteed winner, free money, or one that cannot lose.

## Why it matters

Every wager can lose, so the language is false about the thing itself. It is also the language that precedes the largest stakes — the certainty does the sizing.

The check is a literal scan for a fixed list of phrases. It catches the careless case and cannot catch a paraphrase.

## How this repository treats it

Detected as a finding bound to `uncertainty.no-guaranteed-language`, at error severity.

The known-negative fixture `test/fixtures/ledger-negative/guarantee-language.json` exercises it, and a test asserts the specific finding fires.

**What the check does not establish.** A literal scan of recorded prose for a fixed list of phrases. It catches the careless case, which is the common one. It cannot catch a paraphrase, and it MUST NOT be reported as establishing that no wager was overclaimed.

## If it fires

State the probability and the edge. Those carry all the confidence the evidence supports and no more.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
