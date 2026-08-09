# ADR 0002 — Prohibition and invariant semantics

**Status:** Accepted · **Date:** 2026-08-09 · **Deciders:** repository owner

## Context

The source prompt lists 23 behaviours that must never happen, and the expanded brief is emphatic that
must-never rules are first-class standards which must not be buried in documentation.

The reference framework this repository's machinery was forked from defines `level: "forbidden"` and
`nonExemptible: true` in its schema and catalog loader — and uses neither. There was no implemented
prohibition layer anywhere to copy, so its semantics had to be designed.

Three questions needed answering: what a prohibition means mechanically, where its normative text
lives, and what verdict a violation produces.

## Decision

**A prohibition is a catalog rule at `level: "forbidden"`, with `severity: "error"` and
`nonExemptible: true`.** The catalog loader refuses to define one that is not, so the guarantee cannot
be lost through an omission in a single entry.

**Its normative text lives in the standard that owns its subject matter**, not in a single
prohibitions chapter. Standard 21 defines the semantics, indexes all 23, and states only the integrity
invariant itself.

**A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`**, which outranks `NON_COMPLIANT`.

**An exception declared against a prohibition is rejected and reported**, never honoured and never
silently ignored. The only escape is an applicability declaration that the rule has no subject in the
project.

## Alternatives considered

**One monolithic "prohibited behaviours" standard.** Rejected. Twenty-three prohibitions spanning
twelve subject areas would either duplicate the topical standards or hollow them out — a reader of
Standard 12 would find the sizing rules but not the prohibition on chasing, which is the substance of
that standard. One normative home per rule also means a rule cannot be stated twice and drift.

**Treat prohibitions as ordinary required rules with error severity.** Rejected. It loses the
distinction the brief insists on and, more practically, it makes them exemptible. A waivable
prohibition is not a prohibition.

**Two verdict tiers: `BLOCKED_BY_INVARIANT` for `integrity.*`, `NON_COMPLIANT` for domain
prohibitions.** Considered seriously and rejected. The two would carry different names and identical
instructions — stop, report, do not proceed. Surface without a behavioural difference eventually gets
misused, and a bettor who has just ignored the vig needs the same response as one who has just lowered
a threshold.

**Let an attestation clear a prohibition.** Rejected. An attestation records that a human reviewed
something; a prohibition violation is a fact about what happened. Allowing a review to clear an
observed violation would make attestation a waiver in disguise. Attestations are how manual-review
prohibitions move from `not-evaluated` to evaluated — they never override a finding.

## Consequences

- This is the first pack in the family to use `level: "forbidden"`, so these semantics set the
  precedent.
- The verdict enum gains a fifth value, mapping onto the expanded brief's required AI conclusion
  "blocked by invariant".
- Eight prohibitions are `manual-review` with `assurance: none` and can only ever report
  `not-evaluated`. That is the honest state for rules prohibiting motives, and the tooling is
  explicitly forbidden from reporting them satisfied because nothing was found.
- Standard 21's register table and the source inventory are two views of one mapping, and
  `npm run inventory` fails if they disagree.
