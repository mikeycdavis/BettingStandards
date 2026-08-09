# Changelog

## 1.0.0 — 2026-08-09

First release. Everything below is introduced in this version, so every catalog rule carries
`introducedIn: "1.0.0"`.

### Standards

21 numbered documents following the source's own decision pipeline. Standards 1 and 2 are the
constitution — the fundamental invariant and the stage sequence. Standards 3 to 14 walk the pipeline.
15 to 17 handle time and the market. 18 and 19 are accountability. 20 is the terminal decision, and 21
is the prohibition register and the integrity invariant.

### Rules

51 rules across 13 categories: 25 required, 3 recommended, **23 forbidden**.

The 23 prohibitions carry the source prompt's 23 must-never bullets — with the two directions of
judging a decision by its result sharing one rule — plus `integrity.no-standard-weakening` from the
expanded brief. All are non-exemptible with error severity, and the catalog loader refuses to define
one that is not.

Eight rules are `manual-review` with `assurance: none` and report `not-evaluated` until a human
attests. They prohibit motives that no record contains.

### Tooling

- `scripts/betmath.mjs` — the betting arithmetic. Pure, throws rather than returning NaN, rounds only
  when recording.
- `scripts/decisions.mjs` — re-derives every recorded number and re-evaluates the decision rule.
- `scripts/standards.mjs` — seven subcommands: `init`, `plan`, `check`, `audit`, `validate`,
  `explain`, `status`.
- Invariant checks: `inventory`, `fidelity`, `policy`, `diagrams`.
- Verdict `BLOCKED_BY_INVARIANT` added to the four inherited from the reference framework.

144 tests, zero third-party dependencies. CI has no install step, which is the dependency policy made
structural rather than documented.

### Divergences from the reference framework

Recorded in ADR 0006. The machinery was forked, not depended upon, and has diverged in five ways, each
because this domain needed it: no alias mechanism (ADR 0003), no `optional` level and no `info`
severity, numeric bounds in the schema evaluator, the `BLOCKED_BY_INVARIANT` verdict (ADR 0002), and a
catalog loader that rejects a waivable prohibition.

### Known limits, stated rather than deferred

- Nothing inside a ledger can show what was left out of it (Standard 18 R1).
- A human with commit access can change anything here; the guarantee is that weakening cannot be
  silent (Standard 21 R5).
- Vig removal is multiplicative only. Its known longshot bias is answered by a mechanical discount
  floor rather than hidden (Standard 6 R1, Standard 9 R5).
- Correlation is binary rather than coefficient-weighted, because a coefficient is an unverifiable
  input that could only ever make exposure look smaller (Standard 14 R2).
