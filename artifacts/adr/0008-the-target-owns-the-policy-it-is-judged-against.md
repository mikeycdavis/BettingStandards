# ADR 0008 — The target owns the policy it is judged against

**Status:** Accepted · **Date:** 2026-08-16 · **Deciders:** repository owner

## Context

`standards validate <target>` is this pack's authoritative verdict command, and it is meant to be
pointed at somebody else's repository. It read the target's `project-policy.yml` from the target. It
read the target's `betting-policy.yml` from the target, for the rules that only ask whether the
thresholds are declared at all. And then it evaluated the target's decision *records* against **this
repository's** thresholds.

The mechanism was a defaulted argument. `gatherEvidence` called `checkDecisions({ dir })` with no
`policyPath`, and `checkDecisions` defaulted that to `<this pack>/betting-policy.yml`. Nothing
errored. Nothing was logged. The two policy files sat side by side in the target, one of them
consulted and one of them not.

### How it was found

An external enforcement project, building an adapter for a sibling pack, measured the same defect
there: pointed at a target, that pack resolved an absent policy flag to its own file, audited the
target against it, and exited 0. Its inventory recorded the equivalent question about this pack as
open, and specified how to settle it — *"whether the contract needs to express it depends on whether
`validate` reads it; determine that by execution rather than by reading."*

Reading the source would have answered it. Running the tool proved it, and produced the number that
makes the consequence legible.

### The measurement

An adopting project was constructed outside both repositories: this pack's worked ledger, its own
`project-policy.yml`, its own `betting-policy.yml`. Only the two `minEdge` values differ between runs.

| target `minEdge` | this pack's `minEdge` | result |
| --- | --- | --- |
| **0.90** | 0.02 | `COMPLIANT`, exit 0, `denominator.scored: 25`, 0 findings |
| 0.02 | **0.90** | `NON_COMPLIANT`, exit 1, `edge.threshold-respected` failed |

The verdict on an *unchanged* target moved because a file in *this* repository was edited. Row one is
the dangerous one: the target declared that it would not bet below a 90% edge, its records carry an
adjusted edge of 0.040463, and the tool said it was compliant. The failure message from row two names
the leaked number outright:

```text
edge.threshold-respected | BET recorded despite a failed gate — adjusted edge 0.040463 is below the minimum 0.9
```

This is the framework's own no-false-green rule failing inside the framework. It is worse than a
verdict that is merely wrong, because it clears every gate a consumer could check: a real status, a
real exit code, and `scored: 25` — positive evidence that twenty-five required rules were genuinely
evaluated. There is no signal available to a caller that would distinguish it from a correct pass.

One thing it did *not* do: the envelope reported `"project"` from the target's own policy, so the
report was never mislabelled with this pack's name. The verdict was wrong; its provenance was not
disguised.

## Decision

**The policy whose presence establishes adoption is the policy the target is judged against. This
pack's `betting-policy.yml` governs this pack's worked examples and nothing else.**

1. `gatherEvidence` passes `plan.bettingPath` — the target's file, already resolved for the rules that
   check whether it exists — into `checkDecisions`.
2. `standards check <target>` binds the same path. It is the other command handed somebody else's
   ledger, and it reached the same default by a different route. Fixing only the command named in
   `standards-adapter.json` would have left a shipped command with the defect.
3. **A target that declares no `betting-policy.yml` is not lent this one.** `validate` leaves the
   record-derived rules unevaluated and reports them as such; the four findings that already fail when
   the policy is missing continue to say why. `check` exits 2, which is an invocation problem rather
   than a statement about any record.
4. `checkDecisions` resolves its policy path **once**. It previously defaulted twice — once inside
   `loadBettingPolicy` and once for the digest read — which agreed only because both named the same
   constant. Two defaults that must stay in step are a recorded digest that can end up describing a
   policy other than the one the records were judged under.
5. `node scripts/decisions.mjs` gains `--policy`, and refuses a supplied `--dir` or `--record` without
   it. Unlike `validate`, that entry point is handed a *ledger* directory and cannot find the
   repository root above it without guessing.

### What is deliberately not done

- **No path is derived from another.** `validate` knows the target root because it was given one, and
  joins the policy filename onto it once. Nothing walks up a directory tree looking for a policy, and
  nothing falls back when the join finds no file. A search that succeeds in the wrong place is how the
  sibling pack's version of this defect works.
- **`standards-adapter.json` is unchanged.** Its declared invocation, `validate {target} --json`, was
  correct before and is correct now; what changed is what the pack does with the target. The
  requirement that the target declare its own policy is a precondition of adoption, not a property of
  the calling convention, and it is already visible as an exit 2 rather than a verdict.

## Consequences

**This is an evaluator semantics change, and it is externally observable.** A target that passed only
because of the leak will now report what it actually is. That is a correction rather than a
regression, but describing it as "no semantic change" would be false, so `v1.0.1` is left standing
with the defect it shipped and this ships as a new release. The historical release stays reproducible.

`standards check` is stricter: pointed at a project with no `betting-policy.yml`, it now exits 2 where
it used to produce a report. That report was derived from thresholds the project never declared.

### Why the test perturbs six thresholds rather than the one that was measured

Threading one argument into one call site fixes `minEdge` and leaves any other threshold read from any
other unthreaded call site leaking — with a green suite, because the specimen that was measured is the
specimen that is asserted. `test/target-policy.test.mjs` therefore asserts the property rather than
the repair:

> For an external target, changing this pack's own `betting-policy.yml` must never change that
> target's findings or verdict. Changing the target's `betting-policy.yml` must.

Both halves are load-bearing. The first alone is satisfied by an evaluator that reads no policy at
all; the second alone is satisfied by the defect itself, since the target's policy still drove the
declared-thresholds findings the whole time.

Every guard was run against a mutant of the code it protects before it was trusted:

```text
tests written first, against the unfixed tree      4 of 4 red, each naming the leak
drop the policy binding from `check`               exactly the `check` independence test red
drop `check`'s refusal, restore the fallback       exactly the refusal test red
```

The fixtures live in temporary directories, and the pack under test is a **copy** of the tree. These
tests must mutate a betting policy to observe anything, and `node --test` runs test files in parallel
processes: mutating the real `betting-policy.yml` would be ADR 0007's shared-fixture race with a worse
blast radius, since `check.test.mjs` reads that exact file. Every script resolves its root from its
own location, so a copy is a complete subject and nothing was changed for testability.

## Alternatives considered

**Declare the pack unresolved to external consumers instead.** Truthful about composability, and it
would have left the defect in place: `validate <target>` would still claim to validate an external
target while part of the evaluation was governed by this pack's numbers. The error occurs *inside*
this pack, after the target's policy has already been located. This pack owns the correction.

**Fall back to this pack's policy when the target declares none, and say so in the report.** A warning
next to a verdict is not a substitute for not producing the verdict. The rules in question ask whether
the thresholds are defined; answering them from a file the project never wrote is answering a
different question.

## Addendum: the checker owns the set of rules it establishes

Binding the target's policy created a second legitimate route to "no records were checked". Before,
the only way to reach it was an absent or empty ledger; now a target with a full ledger and no
`betting-policy.yml` skips decision evaluation entirely, because there is nothing to judge the
records against. The route is correct. What it exposed was not.

`gatherEvidence` had to know which rules lose their evidence when the checker does not run, and it
answered with a **prefix match over rule ids** — `record.`, `decision.`, `odds.`, `edge.computed`,
and seven more — maintained by hand in `standards.mjs`, one module away from the code that produces
the findings. Two representations of one fact, kept in step by nothing.

Measured on a target with the five worked examples, `templates/project-policy.yml`, and no betting
policy:

```text
bankroll.stake-within-unit-rules   passed   evaluated   assurance: full
bankroll.no-martingale             passed   evaluated   assurance: partial
bankroll.no-loss-driven-sizing     passed   evaluated   assurance: partial
edge.threshold-respected           passed   evaluated   assurance: full
edge.no-probability-only-bets      passed   evaluated   assurance: partial
edge.no-fabricated-edge            passed   evaluated   assurance: partial
exposure.no-cap-breaches           passed   evaluated   assurance: partial
```

Seven rules reporting a clean bill of health from a ledger no code had opened — two at full
assurance, five at partial — the same false green as the policy leak, arriving through a different
door. The prefix list was survivable only while the sole way to reach zero records was an empty
ledger, where there was nothing to be wrong about.

**The first reproduction of this found only three, and recording why matters more than the number.**
It copied *this repository's own* `project-policy.yml` into the fixture, and this repository declares
the four `bankroll.*` and `exposure.*` rules not-applicable — so the fixture hid four of the seven
behind an applicability declaration that no adopting project shares. The widened reproduction uses
`templates/project-policy.yml`, which is what `standards init` actually writes, and therefore
measures what an adopter would actually have hit. A fixture built from the pack's own policy is not a
neutral observer of the pack.

**Decision. The checker declares the exact set of rules its execution establishes, and the evaluator
removes that set — no other — when the checker does not produce record evidence.** `SUPPLIED_RULES`
lives in `decisions.mjs` beside `FINDING_RULES`, travels back on every result as `suppliedRules`, and
the prefix list is deleted rather than extended.

Extending the list was the obvious repair and is the wrong one. A counterexample already existed
proving that an enumeration maintained outside the authority that creates the findings cannot be kept
true; a longer version of the same construction would be correct for exactly as long as nobody added
a rule. This is the same reasoning that rejected the source-scanning guards earlier in this ADR: a
check that can accept its own counterexample is not a check.

Most of the declared rules pass **silently** — only the rules in `FINDING_RULES` can carry a finding,
and the rest are established by the checker running to completion and disagreeing with nothing. That
is precisely why they have to be named. A rule that passes by the absence of a finding is a rule that
passes by default when no finding could have been produced at all. Six rules are deliberately outside
the set, because their evidence was never in the records: five come from the betting policy's own
contents and one from a document, and they survive a skipped ledger honestly.

The mutation is the acceptance criterion. Removing one rule from the declaration must make the
regression go red; a fixture-derived test would otherwise prove only that the three rules that fixture
happened to expose are covered. The victim chosen — `record.decision-record-required` — is one the old
prefix list *would* have caught, so the test discriminates the mechanism rather than the fixture:

```text
                                        prefix list (defect)    declaration (fixed)
acceptance: no supplied rule claimed          RED                     green
mutation: drop one declared rule              RED                     green
```

## Addendum: the residual default at the API boundary

`parseArgs` refused `--dir`/`--record` without `--policy`, which closed the CLI. `checkDecisions`
still defaulted `policyPath` to this pack's file, which left the same mistake one direct call away
for any caller that never passes through the CLI — a future `standards` subcommand, a script, a
sibling tool.

`policyPath` is now **required** and has no default; the one legitimate use has its own named door,
`checkOwnExamples()`. The distinction is that a caller must now say whose numbers it is using. This
pack's policy is still reachable, but only by naming it, which is a greppable act rather than an
omission.
