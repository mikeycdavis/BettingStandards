# Changelog

## 2.0.0 — 2026-08-26

**2.0.0 corrects external-target policy ownership.** Previous releases could evaluate a target's
decision records against **BettingStandards' own** betting thresholds, producing false-positive
compliance and inflated coverage. External decision evaluation now requires the target's governing
betting policy explicitly. As a consequence, several previously accepted CLI and programmatic
invocations reject a missing policy context rather than returning an unauthoritative result.

**Normative standards: unchanged.** Every standard, rule, level, severity, assurance value and
verdict term is byte-identical to `v1.0.0`. **Evaluator semantics and the public invocation
contract: breaking.** Those two facts are separate and both are load-bearing — a major version is
exactly where a reader would expect the standards to have moved, so the claim that they did not is
made mechanically by `test/baseline.test.mjs` rather than asserted here.

### The public lineage

```text
v1.0.0  a4e7e68   the last release a consumer can resolve
   ↓
v2.0.0            this release
```

`v1.0.1` was tagged locally and never pushed. `git ls-remote --tags origin` has only ever returned
`v1.0.0`, so from outside this repository no `v1.0.1` release exists and no consumer ever had one.
It is **not** being published retrospectively to make the entry below tidy: the public history
should say what actually happened. Its adapter metadata ships here instead, as part of 2.0.0.

### What was wrong

`standards validate <target>` read the target's `project-policy.yml` and the target's
`betting-policy.yml` — and then evaluated the records themselves against ours, because the call that
does the evaluating omitted the policy path and the default was this pack's own file.

Measured at `v1.0.0`, against a project with a real five-record ledger, a `project-policy.yml`, and
no `betting-policy.yml` of its own:

```text
v1.0.0    standards check <target>    exit 0     a report from thresholds that project never declared
          validate <target>           passed 36  coverage 41
2.0.0     standards check <target>    exit 2
          validate <target>           passed 2   coverage 6
```

Thirty-six rules reported as passed, every one of them judged against numbers the project never
wrote down. Nothing errored, and the result was shaped exactly like a correct one.

A second defect of the same family was found and fixed before this release shipped, after the first
repair had already merged. `gatherEvidence` decided which rules lose their evidence when decision
evaluation does not run by matching rule-id **prefixes it maintained itself**, one module away from
the checker that produces the findings. That approximation missed seven record-derived rules, so a
target with a full ledger and no betting policy still reported them `passed` at full assurance. The
prefix list was deleted rather than extended; ADR 0008 records why a longer enumeration outside the
authority that creates the findings would have been correct only until the next rule was added.

### Breaking — command line

- `standards check <target>` **exits 2** where a target declares no betting policy. It previously
  exited 0 and printed a report derived from this pack's thresholds.
- `node scripts/decisions.mjs --dir` / `--record` **exits 2** without `--policy`. That entry point is
  handed a ledger directory and cannot find a repository root above it without guessing.
- `standards validate <target>` — verdict, score, coverage and individual rule dispositions can all
  change for the same unmodified target, because the old values were derived from the wrong policy.
  A project that read `COMPLIANT` may now read `NON_COMPLIANT`, and coverage may fall sharply. **The
  earlier numbers were not conservative; they were unsound.**

### Breaking — programmatic

- `checkDecisions({ dir, policyPath })` **requires `policyPath`** and throws without it. The CLI
  refusal closes one door; a default on the function left the same mistake available to any caller
  that does not go through `parseArgs`.
- Fails closed, everywhere: a missing target betting policy produces exit 2 or an unevaluated rule,
  never a verdict. Exit 2 is still never reported as non-compliance.

### Added

- `--policy <path>` on `scripts/decisions.mjs`.
- `checkOwnExamples()` — this repository's own ledger against its own policy, the one case where the
  pack may supply the numbers, given a name so it cannot be mistaken for generic behaviour.
- `SUPPLIED_RULES`, exported by the decision checker: the exact set of rules its execution
  establishes. `validate` removes that set — no other — when the checker produces no record
  evidence, and every `checkDecisions` result carries it as `suppliedRules`.
- `standards-adapter.json`, the machine-readable declaration of how this pack is invoked and how its
  result is read. Written for the unpublished 1.0.1; it reaches consumers here.

### Changed — release identity

`VERSION`, `package.json`, `README.md`, `test/baseline.test.mjs`, this file, and the
`standardVersion` declared by both `project-policy.yml` and `templates/project-policy.yml`. The
template mattered: shipping 2.0.0 while `standards init` still stamped `standardVersion: "1.0.0"`
into every newly adopted project would have made the release contradict itself on its first day.

`standards-adapter.json` declares no pack version — only the adapter schema's — so nothing in it
moved.

### Unchanged

Every standard, every rule, and every level, severity, disposition and assurance value; the verdict
vocabulary; the scoring; the exit-code meanings. `test/baseline.test.mjs` pins the published shape
and `version` is the only field in it that moved — 21 standards, 51 rules at 25/3/23, 23
non-exemptible prohibitions, 8 manual-review, 41 evaluated, 13 fully machine-represented,
`COMPLIANT` at 94.

### Why a major rather than a minor

Three documented interfaces reject calls `v1.0.0` accepted, and one of them throws. That the old
behaviour was unsound is the **reason** for the break, not a reason to ship it as a minor: a
consumer pinned on `^1` picking this up gets an exception from a call that worked. Semantic
versioning governs the contract, not whether the contract was serving correct answers.

`v1.0.0` is left standing with the defect it shipped rather than amended, so the historical release
stays reproducible.

## 1.0.1 — 2026-08-09 · NEVER PUBLISHED

**This release was prepared and tagged locally, and the tag was never pushed.** `git ls-remote
--tags origin` has only ever returned `v1.0.0`, so no consumer could resolve `v1.0.1` and none ever
had it. The entry is kept rather than deleted because it is what happened; it is marked rather than
quietly renumbered because a changelog that describes a release nobody could fetch is the same kind
of confident-but-wrong artefact this pack exists to refuse. Its contents shipped in 2.0.0.

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
