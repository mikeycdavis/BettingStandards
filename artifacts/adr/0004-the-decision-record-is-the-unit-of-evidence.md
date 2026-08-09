# ADR 0004 — The decision record is the unit of evidence

**Status:** Accepted · **Date:** 2026-08-09 · **Deciders:** repository owner

## Context

General standards frameworks check evidence that is structural (a file exists, a field is set) or
attested (a human says so). Betting evidence is different in kind: a wagering decision is a chain of
arithmetic from a price and a probability to a stake, and arithmetic can be **recomputed** rather than
believed.

The source prompt asks that odds, implied probability, edge, expected value, bankroll, and exposure
calculations be mechanically verifiable "where possible". This ADR decides what carries that
verification.

## Decision

**One JSON decision record per wagering decision — BET and PASS alike — is the unit of evidence for
the entire pack.**

- Every pipeline stage value is recorded as it stood at decision time.
- Nothing under `derived` is trusted: the checker recomputes each value from the inputs beside it and
  disagrees when they differ.
- The decision block is immutable and covered by a SHA-256 digest; `outcome` sits outside the digest
  so settlement can be appended without disturbing what was decided.
- Each record pins the digest of the betting policy it was decided under.
- **Every assurance claim in the catalog is scoped to the recorded universe, and that scoping is
  stated rather than implied.**

Records are JSON, read with `JSON.parse`. Human-authored configuration stays YAML.

## Alternatives considered

**Records in YAML, using the existing parser.** Rejected on a specific technical ground. That parser
returns every scalar as a string on purpose — type coercion belongs to the schema, and a parser that
turned `1.0` into a number would defeat a pattern check before it ran. That design is right for a
policy file with a dozen fields and wrong for a record with twenty numeric fields per entry. Extending
it to coerce numbers would weaken it for the job it actually has.

**A ledger as one append-only file rather than a file per record.** Rejected: a single file means every
write touches the whole ledger, which makes an edit to an old entry indistinguishable from an append
in a diff. One file per record makes tampering visible in version control as well as in the digest.

**Digest the whole record including the outcome.** Rejected: recording a result would then invalidate
the digest of every settled record, and the mechanism that exists to detect tampering would fire on
normal use. Splitting the digest at the decision boundary is what lets it mean exactly one thing.

**A `standards record` command that writes decision records.** Rejected on separation-of-powers
grounds: a tool that authors the evidence it later evaluates is not an independent check on it. The
bettor or agent writes the record and the tool checks it. `standards check --record <draft> --dry-run`
covers the real need — evaluating a decision before committing to it — without the tool becoming the
author.

## Consequences

- Roughly forty rules can carry `assurance: full` or `partial` on the strength of re-derivation, which
  is far more mechanical verification than a prose-based framework can offer.
- The pack's largest limitation follows directly and is stated in Standard 18 R1: **nothing inside a
  ledger can show what was left out of it.** A wager placed and never recorded is invisible to every
  exposure cap and every metric. `record.decision-record-required` carries an assurance note saying so
  in capitals, and `exposure.no-cap-breaches` names it as a load-bearing assumption.
- Tolerances are part of the contract. Recorded values carry six decimal places for probabilities and
  two for money, and comparisons use half a unit in the last place plus a small float allowance — set
  after a correctly rounded value at an exact boundary was rejected by a tolerance of exactly half.
