# Changelog

## 1.1.0 — 2026-08-16

**Evaluator semantics corrected. Externally observable: a target that passed only because of this
defect will now report what it actually is.** No normative change — see "Unchanged" below.

`standards validate <target>` judged an external project's decision records against **this
repository's** `betting-policy.yml`. It read the target's `project-policy.yml` from the target, and
the target's `betting-policy.yml` from the target for the rules that ask whether the thresholds are
declared — and then evaluated the records themselves against ours, because the call that does the
evaluating omitted the policy path and the default was this pack's own file.

Measured before the fix: a target declaring `minEdge: "0.90"`, whose records carry an adjusted edge of
0.040463, returned `COMPLIANT`, exit 0, `denominator.scored: 25`. It cleared every gate a consumer
could check. ADR 0008 records the measurement, the two-row table that isolates the cause, and the
mutants each new guard was run against.

### Changed

- `validate` binds the target's `betting-policy.yml`. A target that declares none is no longer lent
  this one: the record-derived rules are reported unevaluated, and the findings that already fail for
  a missing policy continue to say why.
- `standards check <target>` binds the same path, and **exits 2** where a target declares no betting
  policy. It previously produced a report derived from thresholds that project never declared. This is
  the one strictly breaking change in this release.
- `node scripts/decisions.mjs` accepts `--policy <path>`, and refuses `--dir` or `--record` without
  it. That entry point is handed a ledger directory and cannot find the repository root above it
  without guessing.
- `checkDecisions` resolves its policy path once instead of defaulting twice — the recorded policy
  digest and the policy actually loaded can no longer be two different files.

### Unchanged

Every standard, every rule, and every level, severity, disposition and assurance value; the verdict
vocabulary; the scoring; the exit codes; `standards-adapter.json`, whose declared invocation was
correct before and after. `test/baseline.test.mjs` pins the published shape and `version` is again the
only field in it that moved — 21 standards, 51 rules at 25/3/23, 23 non-exemptible prohibitions, 8
manual-review, 41 evaluated, 13 fully machine-represented, `COMPLIANT` at 94.

### Why a minor rather than a patch

A patch would say the observable behaviour is the same, and it is not: verdicts change for external
targets, and `check` refuses inputs it used to accept. `v1.0.1` is left standing with the defect it
shipped rather than amended, so the historical release stays reproducible.

## 1.0.1 — 2026-08-09

**Interoperability metadata. No normative or evaluator semantic change.**

Adds `standards-adapter.json`, a machine-readable declaration of how this pack is invoked and how its
result is read, against the schema owned by StandardsEnforcer. Nothing in it is new information: it
names the `validate` subcommand that has always produced the authoritative verdict, the target
argument that has always been positional, and the five statuses the pack has always emitted.

The declaration exists because `check` also runs cleanly and returns a verdict-shaped object while
answering a different question — it re-derives decision records. An orchestrator guessing between the
two would get a confident answer to a question nobody asked. Now it does not guess, because this pack
states which command carries its verdict rather than leaving it to be inferred.

`test/adapter-contract.test.mjs` is why the declaration can be trusted. It builds the invocation from
the contract, runs it, runs the documented invocation directly, and requires the two results to be
identical. A declaration that drifts from the CLI it describes fails this pack's own suite.

### Why a new release rather than a retag

The contract did not exist at `v1.0.0`, so `v1.0.0` cannot be made to claim it, and a consumer reads
the declaration out of the pinned checkout rather than from `main`. A released product acquired a new
public machine-readable interface, so a new release publishes that interface.

### Unchanged

Every standard, every rule, and every level, severity, disposition and assurance value; the verdict
vocabulary; the scoring; the exit codes. The adapter declaration and its fidelity test are the only
substantive changes since `v1.0.0`.

That claim is executable rather than asserted. `test/baseline.test.mjs` pins the published shape, and
the only field in it that moved is `version` — 21 standards, 51 rules at 25/3/23, 23 non-exemptible
prohibitions, 8 manual-review, 41 evaluated, 13 fully machine-represented, `COMPLIANT` at 94, all
still passing untouched. 163 tests pass, as at `v1.0.0`.

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

159 tests, zero third-party dependencies. CI has no install step, which is the dependency policy made
structural rather than documented.

### The baseline is executable

`test/baseline.test.mjs` asserts the published v1.0.0 shape: 21 standards, 51 rules, 23 non-exemptible
prohibitions, 8 manual-review rules claimed by nothing, coverage of 41/51, verdict COMPLIANT at 94%,
no dependency on any sibling repository, and both architectural anchors present in the README, the
standards that own them, and the templates an agent is handed.

It exists because a baseline left as prose drifts. A rule gets added without an inventory entry;
coverage creeps up because a lexical heuristic was quietly counted as evaluation; a prohibition loses
its non-exemptible flag in a refactor. None of those announces itself.

Changing the baseline means editing those numbers in the same commit as the change that moved them.
That is the point, not a workaround — it is this framework applying to itself the rule it applies to
everyone else.

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
