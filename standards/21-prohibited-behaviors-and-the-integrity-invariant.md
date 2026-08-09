# Standard 21 — Prohibited Behaviors and the Integrity Invariant

Twenty-three behaviours are prohibited outright by this pack. This standard defines what a prohibition
*is* here, indexes all of them, and carries the one that protects the standards system itself.

Its normative content is deliberately narrow: the semantics and the invariant. Each prohibition's
substance lives in the standard that owns its subject matter, because a rule stated twice is a rule
with two definitions.

Source: the "Must-never rules" section of
[`artifacts/prompts/original-prompt.md`](../artifacts/prompts/original-prompt.md), and the "Standards
integrity invariant" section of
[`artifacts/prompts/expanded-brief.md`](../artifacts/prompts/expanded-brief.md).

## Scope

Applies to every prohibition in the catalog, and to every person or agent operating under these
standards — including whoever is maintaining the standards themselves.

## Requirements

### R1 — What a prohibition is

A prohibition is a catalog rule at `level: "forbidden"`, with `severity: "error"` and
`nonExemptible: true`. Four properties follow, and each is enforced mechanically rather than by
convention:

**It is violated by the presence of a behaviour, not the absence of an artifact.** Most rules ask
whether something was done; a prohibition asks whether something was done that should not have been.
The difference matters for reporting: a prohibition nothing observed is `not-evaluated`, never
satisfied. Nothing looked, so nothing was cleared.

**It admits no exception.** An exception declared against a prohibition is *rejected and reported*,
not honoured and not quietly ignored. A waivable prohibition is not a prohibition, and the twenty-three
behaviours here are precisely the ones a motivated bettor would most want to waive at the moment they
apply. The catalog loader refuses to define a forbidden rule that is not also non-exemptible, so the
guarantee cannot be lost through an omission in a single entry.

**The only escape is that it has no subject.** A project that places no wagers cannot chase a loss.
That is an applicability declaration, requires a reason, and is a claim about the project rather than
about the rule.

**The required response is STOP.** A confirmed violation produces the verdict
`BLOCKED_BY_INVARIANT` — not a lower score. The distinction is about what happens next:
non-compliance means fix it and re-run; a prohibition violation means stop, report, and do not
proceed. Triaging a violated prohibition like a backlog item is the wrong response, and a shared
verdict would invite exactly that (ADR 0002).

### R2 — Every prohibition traces to a source obligation

The register below maps each prohibition to the source text that requires it and the standard that
states it normatively. The mapping is pinned in
[`artifacts/standards-source-inventory.json`](../artifacts/standards-source-inventory.json), which is
human-reviewed and never regenerated: a prohibition cannot be added that no brief asked for, and one
cannot be removed, renamed, or demoted without failing `npm run inventory`.

Note that bullets 8 and 9 — treating a win as proof of a good bet, and a loss as proof of a bad one —
are the two directions of one behaviour and share one rule, `decision.no-resulting`.

### The register

| Source bullet | Rule | Stated in |
| --- | --- | --- |
| bet solely because a team/player is likely to win | `edge.no-probability-only-bets` | [7](07-edge.md) R2 |
| recommend a wager without considering the offered price | `decision.no-priceless-recommendations` | [2](02-the-decision-pipeline.md) R4 |
| call something positive EV without supporting calculations | `ev.no-unsupported-ev-claims` | [8](08-expected-value.md) R3 |
| ignore vig | `vig.no-ignored-vig` | [5](05-vig.md) R4 |
| chase losses | `bankroll.no-chasing-losses` | [12](12-unit-sizing.md) R3 |
| use Martingale-style loss recovery | `bankroll.no-martingale` | [12](12-unit-sizing.md) R4 |
| increase bet size because previous bets lost | `bankroll.no-loss-driven-sizing` | [12](12-unit-sizing.md) R5 |
| treat a winning wager as proof it was a good bet | `decision.no-resulting` | [1](01-the-fundamental-invariant.md) R2 |
| treat a losing wager as proof it was a bad bet | `decision.no-resulting` | [1](01-the-fundamental-invariant.md) R3 |
| fabricate odds | `odds.no-fabrication` | [3](03-odds-conversion.md) R5 |
| fabricate line movement | `line.no-fabricated-movement` | [15](15-line-movement.md) R3 |
| fabricate edge | `edge.no-fabricated-edge` | [7](07-edge.md) R3 |
| fabricate expected value | `ev.no-fabricated-ev` | [8](08-expected-value.md) R4 |
| hide uncertainty | `uncertainty.no-hidden-uncertainty` | [9](09-uncertainty-discount.md) R3 |
| recommend a wager merely to create action | `decision.no-action-bets` | [20](20-pass-decisions.md) R4 |
| force a daily bet quota | `decision.no-bet-quota` | [20](20-pass-decisions.md) R5 |
| recommend increasing risk because someone is "due" | `bankroll.no-due-theory` | [12](12-unit-sizing.md) R6 |
| use gambler's-fallacy reasoning | `probability.no-gamblers-fallacy` | [6](06-fair-probability.md) R4 |
| ignore correlated exposure | `exposure.no-ignored-correlation` | [14](14-correlated-bets.md) R3 |
| exceed defined bankroll/exposure constraints | `exposure.no-cap-breaches` | [13](13-maximum-exposure.md) R4 |
| describe any wager as guaranteed | `uncertainty.no-guaranteed-language` | [9](09-uncertainty-discount.md) R4 |
| use historical backtests that leak future information | `evaluation.no-lookahead-backtests` | [19](19-evaluation-of-the-betting-process.md) R5 |
| silently alter historical recommendations after results are known | `record.no-silent-revision` | [18](18-record-keeping.md) R3 |
| *(expanded brief)* | `integrity.no-standard-weakening` | R3 below |

### R3 — The standards-integrity invariant

**A human or AI MUST NEVER bypass, weaken, remove, reclassify, reinterpret, falsify evidence for, or
manipulate a standard, a test, an applicability determination, an evidence requirement, or a
verification mechanism solely because it prevents a desired implementation or conclusion.**

All of the following are the same act:

- Lowering `minEdge` because a particular wager falls just below it.
- Marking an applicable rule `not-applicable` to clear a finding.
- Deleting or skipping a failing test.
- Loosening a tolerance until a mismatch disappears.
- Re-recording a decision under a friendlier policy.
- Rewriting a prohibition's description so a behaviour no longer falls under it.

This is the rule that decides whether any of the others mean anything. A threshold that moves when it
blocks something is not a threshold — and the moment of temptation is exactly the moment it matters,
because nobody weakens a standard that is not currently in their way.

The failure is also self-concealing. Once the check has been changed, the evidence that it used to
fail is gone, and everything downstream reports success. That is why it needs defences rather than
just a statement.

### R4 — How the invariant is defended

Five mechanical defences, each with a test in
[`test/integrity.test.mjs`](../test/integrity.test.mjs) that fails if the defence is removed:

1. **Waivers are rejected.** An exception against any prohibition is refused by both the policy
   checker and the compliance engine, and produces `BLOCKED_BY_INVARIANT` — the attempt to waive is
   itself the finding. The catalog loader additionally refuses to define a waivable prohibition.
2. **The register is pinned.** The human-reviewed source inventory maps every prohibition to its
   source bullet and owning standard. Deleting, renaming, or demoting one fails `npm run inventory`,
   and adding one no brief asked for fails it too.
3. **Lifecycle discipline.** Every rule carries `deprecatedIn`, `supersededBy`, and `removedIn` from
   the first release. A prohibition cannot be removed, only superseded with a recorded successor, and
   the inventory must change in the same commit — making any retirement a two-file, diff-visible act.
4. **Evidence is tamper-evident.** Decision digests make an edited record visible; policy digests make
   a retroactively relaxed threshold visible.
5. **The evaluator cannot quietly stop checking.** Its evaluated-rule set is asserted against its
   actual detectors, no manual-review rule may appear in it, and every checker branch is
   mutation-tested — delete the branch, and a test goes red.

### R5 — The honest limit

**A human with commit access to this repository can change anything in it.** No defence listed above
survives someone editing the catalog, the inventory, and the tests together and committing the result.

The guarantee this pack offers is therefore narrower than "weakening is impossible", and stating the
narrower claim is itself part of R3. What is guaranteed is that **weakening cannot be silent**: every
path either breaks CI or requires editing a human-reviewed file in a diff someone can read. The
remaining defence is review, and review is a human activity that no tool in this repository performs.

A framework that claimed more than this would be doing the thing it prohibits — asserting an assurance
it does not have.

## Additions this standard makes beyond the source

The source supplies the twenty-three bullets and, in the expanded brief, the text of the integrity
invariant. Everything else is this pack's:

- R1's four properties of a prohibition, the `BLOCKED_BY_INVARIANT` verdict, and the argument for a
  distinct verdict rather than a low score.
- R2's requirement that every prohibition trace to a source obligation, and the register itself.
- R3's enumerated examples of the same act, and the observation that the failure is self-concealing.
- R4's five defences in full — the brief asks how the invariant can be protected and tested; this is
  the pack's answer.
- R5 in full. The brief does not require a statement of limits; stating them is this pack's reading of
  what the invariant demands of a framework describing itself.

## Relationship to other standards

Every standard from 1 to 20 states one or more of these prohibitions normatively; this standard indexes
them and supplies the semantics they share.
[Standard 18](18-record-keeping.md) R4 provides two of the five defences.
[Standard 10](10-minimum-edge.md) R5 defers to R3 for the threshold-lowering case.

## Implementation

**Met, for the semantics.** All 23 prohibitions are catalogued at `level: "forbidden"` with
`nonExemptible: true` and `severity: "error"`; the loader rejects any that are not, and a test asserts
the count and the properties. A confirmed violation produces `BLOCKED_BY_INVARIANT`, which outranks an
ordinary required failure in the verdict.

**Not met, for the invariant itself.** `integrity.no-standard-weakening` is `manual-review` with
`assurance: none`, and this is not a gap to be closed later. A rule that could detect its own
circumvention would have to run outside the system it protects. What exists instead is R4's five
defences and R5's honest statement of what they do not cover.

Each prohibition has a worked example under
[`examples/violations/`](../examples/violations/integrity.no-standard-weakening.md), and the
mechanically detectable ones have a known-negative fixture under `test/fixtures/ledger-negative/` that
fires the specific finding.
