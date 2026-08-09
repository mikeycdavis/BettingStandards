# Concept model

The brief that commissioned this repository listed fifteen candidate concepts from policy-as-code and
evidence-based standards evaluation, and instructed that they not be implemented blindly — each had to
be judged against this domain, and the reasoning documented. This is that document.

The domain is betting and gambling decisions: whether a prediction, at an offered price, justifies
risking money. Two properties of the domain drive nearly every decision below.

**The evidence is numeric.** A wagering decision is a chain of arithmetic from a price and a
probability to a stake. That makes most of this pack's evidence *re-derivable*: a checker can recompute
every recorded number and disagree. Very little of the framework has to rest on assertion.

**The outcome is not the evidence.** A wager can win and have been a bad decision; it can lose and have
been a good one. Every mechanism here has to judge decisions from what was known when they were made,
which is why so much of the design is about immutability, timestamps, and digests rather than results.

---

## The fifteen concepts

### requirement — adopt

Realized as catalog rules with `level: "required"`.

Nothing about this domain changes what a requirement is. "Record the overround for every market you
quote" is a requirement in exactly the sense policy-as-code already means: it applies, it can fail, and
failing it is a compliance problem rather than a stop-work condition. Adopted unchanged.

### prohibition — adopt, and promote

Realized as catalog rules with `level: "forbidden"`, `severity: "error"`, `nonExemptible: true`, with
their normative text as MUST NOT requirements inside the standard that owns the subject matter, and a
register of all of them in [Standard 21](../standards/21-prohibited-behaviors-and-the-integrity-invariant.md).

This is the concept the domain cares about most. The source prompt lists twenty-three behaviors that
must never happen, and they are not stylistic preferences — chasing losses, Martingale sizing,
fabricating odds, and silently editing history are the behaviors that turn a betting process into a
way to lose money quickly. So prohibitions get the *same* machinery as requirements and not a
weaker one: catalog entries, detectors where mechanically possible, known-negative fixtures, dedicated
`explain` output, and a worked example each under `examples/violations/`.

Three deliberate consequences:

- A prohibition is violated by the **presence of a behavior**, not by the absence of an artifact. This
  is why a prohibition can be `not-evaluated` and yet the project is not thereby failing it — nothing
  observed it. Reporting an unobserved prohibition as satisfied would be the purest false green.
- A prohibition admits **no exception** (see *exceptions* below).
- A confirmed prohibition violation produces **`BLOCKED_BY_INVARIANT`**, not `NON_COMPLIANT` (see
  *compliant / non-compliant*).

### recommendation — adopt

Realized as `level: "recommended"`. Four rules use it: `line.movement-recorded`, `line.clv-computed`,
`evaluation.review-cadence`, and `probability.fair-source-recorded`'s advisory sibling behavior.

The temptation was to drop the tier and make everything required or forbidden — a two-valued system is
easier to reason about. It was kept for one honest reason: closing-line and line-movement data are not
always obtainable. A bettor using a book that publishes no closing price cannot record closing-line
value, and a framework that made it required would push that person toward either a permanent exception
or an invented number. Both are worse than an advisory rule. Where data availability is genuinely
outside the bettor's control, `recommended` is the truthful level.

### decision rule — adopt, and it is this pack's central object

Realized as the BET gate in [`scripts/decisions.mjs`](../scripts/decisions.mjs), against thresholds in
`betting-policy.yml`, recorded per decision in `schemas/decision-record.schema.json`.

This concept has no equivalent in general-purpose standards frameworks, and it is the reason this
repository is not just a document collection. A decision rule is the mechanical conjunction that a BET
must satisfy: edge after uncertainty discount at or above the minimum, positive expected value, stake
within unit and single-bet caps, group and total exposure within caps, odds and prediction fresh
enough, decision made before the event starts, and the longshot discount floor met. Anything short of
all of them is a PASS.

The rule exists to encode a specific failure mode: **a computed number is not a verdict.** A positive
expected value is an input to the decision, not the decision. Making the gate a conjunction of
independent conditions means no single attractive number can authorize risking money on its own.

### applicability — adopt

Realized as the `applicability` map in `project-policy.yml`: `status: not-applicable` plus a mandatory
`reason`, and optional `reviewedAt` and `revisitWhen`.

Adopted for the reason the general framework adopts it, plus one domain-specific use: a project may
place no wagers at all. This repository is such a project, which is why its own policy declares the
operational rules not-applicable and exercises them against `examples/` instead. The `reason` is
mandatory because a not-applicable declaration with no reason is indistinguishable from a rule someone
forgot.

### evidence — adopt, extended with a new kind

Three kinds of evidence exist here:

1. **Decision records** — the domain-specific addition. A JSON record per decision, capturing every
   pipeline stage value at decision time. Machine-checkable by re-derivation.
2. **Audit findings** — automated scans over the repository or project.
3. **Attestations** — recorded human review for rules whose evaluator is a person, with content-digest
   staleness so a review stops counting when what it reviewed changes.

The extension is justified by the domain's numeric nature. General frameworks lean on evidence that is
structural (a file exists, a field is set) or attested (a human says so). Betting evidence is
primarily *arithmetic*, and arithmetic can be checked rather than believed. Designing the record format
first, and the rules second, is what lets so many rules in this pack carry `assurance: full`.

### verification — adopt

Realized as the scripts suite, the test suite, and CI.

The domain-appropriate verification form is **re-derivation**: recompute every recorded number from the
recorded inputs and fail on disagreement beyond tolerance. This is stronger than checking that a field
is present and weaker than knowing the inputs were true, and the catalog says exactly that per rule
via `assurance` and `$assuranceNote`.

### exceptions — adopt, but restricted

Realized as the `exceptions` array in `project-policy.yml`, with `reason`, `approvedBy`, `approvedAt`,
and optional `expires`. An expired exception is a compliance failure, not a resolution.

The restriction is the domain call: **an exception may never be declared against a forbidden rule.**
The compliance engine rejects the attempt and reports it. A waivable prohibition is not a prohibition,
and the twenty-three behaviors in the source prompt are exactly the ones a motivated bettor would most
want to waive at the moment they matter. The only escape from a prohibition is that the whole pack does
not apply — a project that places no wagers cannot chase losses.

### severity — adapt, simplified

Realized as `severity: "error" | "warning"`. The general framework's third value (`info`) is not used,
and the `optional` *level* is not used either.

Reasoning: in this domain a rule either gates a decision to risk money or it advises. There is no
observed third case. An `info` tier would be a place for findings nobody acts on, and an `optional`
level would be indistinguishable from `recommended` in practice. Both were dropped rather than carried
as unused surface. Severity is kept distinct from level because they answer different questions: level
says how the rule binds, severity says how loudly a finding reports.

### invariants — adopt as a distinguished use of prohibition

Realized as the `integrity` rule category, currently one rule:
`integrity.no-standard-weakening`.

An invariant here is a prohibition whose subject is the standards system itself rather than a wager.
The brief requires one specifically: no human or AI may bypass, weaken, remove, reclassify,
reinterpret, falsify evidence for, or manipulate a standard, test, applicability determination,
evidence requirement, or verification mechanism solely because it prevents a desired conclusion.

It is worth separating conceptually because violating it invalidates the evaluator's own output — every
other finding becomes untrustworthy. It is *not* given a separate verdict from other prohibitions,
because the required response is identical: stop. See ADR 0002.

How it is protected and tested is documented in
[Standard 21](../standards/21-prohibited-behaviors-and-the-integrity-invariant.md) and summarized in
`design/architecture-and-milestones.md`.

### revisit conditions — adopt, extended

Three mechanisms, in increasing order of mechanical strength:

1. **`revisitWhen`** on an applicability declaration — prose describing what would make the
   declaration wrong. Human-checked; surfaced by `standards status`.
2. **Attestation staleness** — a human review records a digest over the paths it reviewed; when those
   files change, the digest stops matching and the rule returns to `not-evaluated`. Mechanical.
3. **Policy digest pinning** — the domain-specific extension. Every decision record pins the digest of
   the `betting-policy.yml` it was decided under. Changing a threshold does not silently re-judge past
   decisions; it makes them verifiably decisions made under a different policy.

The third exists because thresholds are exactly what a bettor is tempted to relax after a losing week,
and a framework that let a relaxed threshold retroactively legitimize old bets would be helping.

### not-applicable — adopt

Realized as a per-rule disposition, sourced from the policy's `applicability` map. Kept strictly
distinct from an exception: not-applicable says the rule has no subject here; an exception says the
rule applies and the project is knowingly not satisfying it. Collapsing the two is the known failure
mode this separation exists to prevent — it hides real non-compliance inside a claim of irrelevance.

### not-evaluated — adopt

Realized as a disposition for any rule nothing looked at: rules outside the evaluator's detector set,
manual-review rules without a fresh attestation, and any check run against an empty ledger.

This is the concept the whole system's honesty rests on. **A skip must never count as a pass.** A false
red has a complainant — someone is annoyed and investigates. A false green has none, by construction,
which makes it the higher-severity defect. `not-evaluated` is also how this pack realizes the brief's
required "insufficient evidence" conclusion.

### compliant / non-compliant — adopt, extended

Verdicts: `COMPLIANT`, `COMPLIANT_WITH_EXCEPTIONS`, `NON_COMPLIANT`, `NOT_EVALUATED`, and
**`BLOCKED_BY_INVARIANT`**.

The fifth is the extension, and it maps onto the brief's requirement that an AI be able to conclude
"blocked by invariant". It is a distinct verdict rather than a flavor of `NON_COMPLIANT` because the
remediation differs in kind: non-compliance means fix it and re-run; a prohibition violation means
stop, report, and do not proceed. Collapsing them would let a stop-work condition be triaged like a
backlog item.

Alongside every verdict the tooling reports `frameworkCoverage` — how much of the framework is machine
represented at all — as a separate number that is never folded into the score. `COMPLIANT` must read as
"everything that was checked passed", never as "everything was checked".

---

## Concepts considered and rejected

### Rule-id aliases — rejected

The reference framework this repository's machinery was forked from carries an alias mechanism, because
a legacy camelCase spelling of its rule ids leaked into circulation before the canonical kebab-case
form was fixed, and both had to keep resolving.

This repository is greenfield and has no legacy spelling to absorb. Canonical
`category.kebab-case-name` ids are fixed from the first commit and the catalog loader rejects anything
else outright. Carrying an alias table here would be carrying a scar from an injury this repository
never suffered, and an alias table is a place where two names for one rule can drift apart.

### A mutating `standards decide` command — rejected

An early CLI sketch had a command that would compute a decision and write the resulting record to the
ledger. It was rejected on a separation-of-powers ground: decision records are *evidence*, and a tool
that authors the evidence it later evaluates cannot be an independent check on it. The bettor or agent
writes the record; the tool checks it. `standards check --record <draft> --dry-run` covers the real
workflow need — evaluating a decision before committing to it — without the tool ever becoming the
author.

### An `info` severity and an `optional` level — rejected

Covered under *severity* above. Both were dropped as unused surface rather than carried empty.

### Correlation coefficients — rejected for v1

Exposure aggregation assumes full correlation within a declared correlation group: stakes sum. A
coefficient-weighted model would be more precise in principle, but a coefficient is an unverifiable
input — nothing in a decision record could falsify a claim that two bets are "0.3 correlated", and the
number would let real exposure be discounted by assertion. Binary grouping is coarser and honest. See
[Standard 14](../standards/14-correlated-bets.md).
