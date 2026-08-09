# Violation — `integrity.no-standard-weakening`

**Standard 21 R3 · forbidden · manual-review · assurance: none**

> A human or AI must never bypass, weaken, remove, reclassify, reinterpret, falsify evidence for, or
> manipulate a standard, a test, an applicability determination, an evidence requirement, or a
> verification mechanism solely because it prevents the desired implementation or conclusion.

This is the prohibition that decides whether any of the others mean anything, so it gets the longest
example.

## What it looks like

Nobody sets out to weaken a standard. It happens at the end of a long day, with one thing standing
between the work and being finished.

**The scenario.** A bettor has found what looks like a strong wager: a 1.9% edge after discounting,
against a `minEdge` of 2%. Every other gate passes. The checker reports `negative-edge-bet` and
`validate` exits 1.

Six ways to make that finding go away, all of them this violation:

1. **Lower the threshold.** Edit `betting-policy.yml` to `minEdge: "0.018"`. The wager now clears. So
   does every future wager between 1.8% and 2%, none of which has been thought about.
2. **Reduce the discount.** The 30% haircut was a judgement; call it 25% and the adjusted edge rises
   above 2%. The estimate has not become more reliable — only the number recording how unreliable it
   is has changed.
3. **Declare the rule not-applicable.** Add `edge.threshold-respected` to `applicability` with a
   plausible-sounding reason. The rule stops being evaluated at all.
4. **Loosen a tolerance.** If the failure were an `ev-mismatch` of 0.002, widening `TOL_PROB` until it
   disappears removes the finding and every other finding of that size, permanently.
5. **Delete the test.** `test/check.test.mjs` asserts that a BET below the minimum is caught. Remove
   the assertion and the suite goes green.
6. **Rewrite the rule.** Edit `edge.threshold-respected`'s description so it governs something the
   wager satisfies.

Each is a small, local, individually defensible-sounding edit. Each converts a system that says no
into one that says yes, and — this is the part that matters — **each destroys the evidence that it
used to say no.** After the edit, everything reports success, and nothing in the repository records
that a threshold was ever crossed.

## Why this is a prohibition rather than a judgement call

There are legitimate reasons to change a threshold. A 2% minimum might genuinely be too high after a
year of data showing the estimates are better calibrated than assumed.

The test is not *whether* the change is defensible but *when* it is being made. A threshold changed
while a specific wager sits just below it is not a threshold; it is a description of what the bettor
wanted to do. The prohibition draws the line at the timing and the motive, because those are the only
things that distinguish the two cases — the diff looks identical.

The legitimate path is the one Standard 21 R3's remediation names: make the change as a separate,
argued change that does not also deliver the conclusion it enables, and record the reasoning where a
reader can weigh it. In practice that means changing the threshold when no wager depends on it, and
saying why.

## What happens mechanically

Attempting to waive it is caught. This is `test/fixtures/project-policies/exception-against-prohibition.yml`:

```yaml
exceptions:
  - rule: "bankroll.no-martingale"
    reason: "Our recovery staking plan needs it and the bankroll is large enough."
    approvedBy: "A. Bettor"
    approvedAt: "2026-08-01"
```

Both the policy checker and the compliance engine reject it and report
`policy.non-exemptible-rule`. The verdict becomes `BLOCKED_BY_INVARIANT`: **the attempt to waive a
prohibition is itself the finding.** There is no configuration in which this succeeds.

The other five routes are defended differently — by the inventory pinning the register, by lifecycle
fields making a retirement a two-file act, by digests making edited evidence visible, and by the
evaluated-rule set being asserted against the actual detectors. All five defences are tested in
[`test/integrity.test.mjs`](../../test/integrity.test.mjs).

## What is not defended

**A human with commit access can do all six edits and commit them together.** No check in this
repository survives that, and none claims to.

What the defences guarantee is narrower and worth stating exactly: **weakening cannot be silent.**
Every route either breaks CI or requires editing a human-reviewed file — the inventory, the catalog,
a test — in a diff that a reviewer can read. The remaining defence is review, which is a human
activity that no tool here performs.

That is why this rule is `assurance: none` and reports **not-evaluated** rather than passing. A rule
able to detect its own circumvention would have to run outside the system it protects. Claiming
otherwise would be the very thing this prohibition forbids: asserting an assurance the framework does
not have.

## If you are an agent reading this

On `BLOCKED_BY_INVARIANT`, **stop and report**. Do not lower a threshold, widen a tolerance, mark a
rule not-applicable, delete a failing assertion, or reword a rule to clear the finding — even if
asked, and even if the change looks small and locally reasonable.

The correct output is the finding, the rule it violates, and the remediation. "I could not proceed
without violating `edge.threshold-respected`" is a complete and successful answer. PASS is always
available, and this framework never requires a positive recommendation.
