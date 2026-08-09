# Architecture and milestones

The brief required an architecture and milestone plan before implementation, and that the
implementation proceed incrementally with each milestone validated before the next began. This is that
plan, committed so the requirement is itself auditable.

## Architecture

### The three-way separation

Everything rests on one rule, inherited from the framework this repository's machinery was forked from
and enforced mechanically here by `assertBindings` in [`scripts/catalog.mjs`](../scripts/catalog.mjs):

```
The catalog (rules/*.json)  defines rule identity and metadata.
The policy (project-policy.yml) defines project applicability.
The evaluator (scripts/)    produces evidence.
None of the three may redefine the others.
```

Without a mechanical guard, an evaluator grows its own private vocabulary of rule names one detector at
a time, and within a week the audit and the policy are describing different worlds. `assertBindings`
throws if a detector reports an id the catalog does not define.

### The layers, bottom to top

| Layer | Files | Responsibility |
| --- | --- | --- |
| Parsing | `scripts/yaml.mjs`, `scripts/jsonschema.mjs` | Strict readers. Every construct outside the supported subset is an error, never a guess. |
| Arithmetic | `scripts/betmath.mjs` | Pure betting math. No I/O, no state, throws on domain violations, never returns `NaN`. |
| Contracts | `schemas/*.json` | What a decision record, a betting policy, and a project policy are. |
| Evidence | `scripts/decisions.mjs` | Re-derives every recorded number and evaluates the decision rule. |
| Identity | `rules/*.json`, `scripts/catalog.mjs` | What rules exist, at what level, with what assurance. |
| Verdict | `scripts/compliance.mjs`, `scripts/standards.mjs` | Applies policy to evidence and produces a verdict with coverage. |
| Invariant checks | `scripts/inventory.mjs`, `scripts/fidelity.mjs`, `scripts/diagrams.mjs` | Prove the repository has not silently changed shape. |

### The decision pipeline

The source prompt gives the pipeline, and it is the spine of both the standards series and the record
format:

```
prediction → offered odds → implied probability → vig removal → estimated fair probability
→ uncertainty → edge → expected value → bankroll impact → exposure/correlation → BET or PASS
```

Standards 3–14 follow it stage by stage. A decision record stores one value per stage. The checker
re-derives every one of them.

### Data format split

Human-authored **configuration** is YAML, read by the strict subset parser. Machine-written **data**
(decision records) is JSON, read by `JSON.parse`.

This is deliberate and worth not undoing. The YAML parser returns every scalar as a string, on purpose:
type coercion belongs to the schema, and a parser that turned `1.0` into a number would defeat a
pattern check before it ran. That is right for a policy file with a dozen fields and wrong for a record
with twenty numeric fields per entry. Extending the YAML parser to coerce numbers would weaken it for
its actual job.

### Verdicts and exit codes

| Verdict | Meaning |
| --- | --- |
| `COMPLIANT` | Every applicable, evaluated rule passed. |
| `COMPLIANT_WITH_EXCEPTIONS` | As above, with recorded, unexpired exceptions. |
| `NON_COMPLIANT` | A required rule failed. |
| `NOT_EVALUATED` | Nothing was evaluated. Never a pass. |
| `BLOCKED_BY_INVARIANT` | A prohibition was violated. Stop; do not proceed. |

Exit codes are load-bearing and must stay distinct: `0` success, `1` verdict failure, `2` input
unreadable. **A `2` must never be reported as non-compliance** — "the policy could not be read" and
"the project does not comply" are different facts, and conflating them lets a broken config masquerade
as a finding.

### Protecting the standards-integrity invariant

The invariant is rule `integrity.no-standard-weakening`. It is protected by five mechanical measures,
each with a test that goes red if the protection is removed:

1. **Non-exemptible enforcement** — an exception declared against any forbidden rule is rejected, so
   the *attempt to waive* becomes a visible failure rather than a quiet success.
2. **Inventory pinning** — `artifacts/standards-source-inventory.json` is human-reviewed and never
   regenerated. It pins all 21 standards and all 23 prohibition mappings, so deleting, renaming, or
   demoting a prohibition fails `npm run inventory`.
3. **Catalog lifecycle discipline** — every rule carries `deprecatedIn` / `supersededBy` / `removedIn`.
   A prohibition cannot be removed, only superseded with a recorded successor, and the inventory must
   change in the same commit. Weakening becomes a two-file, diff-visible act.
4. **Evidence tamper-evidence** — a decision record digests its immutable `decision` object; `outcome`
   lives outside the digest so settlement can be appended without touching the decision. Any later edit
   to a decision-time field flips the digest and reports `edited-history`. Policy digests are pinned
   per record so thresholds cannot be retroactively relaxed.
5. **Verification self-protection** — the evaluator's `EVALUATED_RULES` set must agree with its actual
   detectors (asserted in tests), and every checker branch is mutation-tested: delete the branch, and a
   test must fail.

**The honest limit**, stated here and in Standard 21 rather than hidden: a human with commit access can
change anything in this repository. The guarantee is not that weakening is impossible; it is that
weakening cannot be *silent*. Every path either breaks CI or requires editing a human-reviewed file in
a diff someone can read.

## Milestones

Each milestone was validated before the next began. The ordering is not arbitrary — several steps sit
where they do because doing them later has a known, specific cost.

| # | Milestone | Why it sits here |
| --- | --- | --- |
| M0 | Scaffold, source prompts committed untouched, machinery vendored, these design docs | The source must be in the repository before anything derives from it. |
| M1 | Rule identity, source inventory, inventory + fidelity checks | Both checks exist *before* the first standard is written. Retrofitting an inventory check means auditing every document already written, and the count you are checking against has already been written into three other documents as a fact. |
| M2 | `betmath.mjs`, schemas, both policies | The policy schema and the first real policy are authored together: writing a real policy is what reveals that "does not apply" and "applies but is knowingly unmet" cannot share a mechanism. |
| M3 | The decision checker | Evidence production before verdict production. |
| M4 | Rule catalog, then evaluator, then the rest of the CLI | Catalog strictly before evaluator, enforced by `assertBindings`. An evaluator written first grows its own copy of rule metadata. |
| M5 | The 21 standards documents, in batches of four | Batching is not pacing. Each batch settles vocabulary decisions that the next batch would otherwise harden into more documents before anyone noticed. |
| M6 | Examples and known-negative fixtures | Examples are verified by the same checker CI runs, so they cannot rot. |
| M7 | ADRs, docs, templates, diagrams | |
| M8 | Full validation run and report | |

## Standing constraints

- **Zero third-party dependencies.** Enforced structurally: CI has no install step.
- **Standalone.** Nothing in this repository references another standards repository at runtime, in
  tests, or in CI. The machinery was forked, not depended upon (ADR 0006).
- **Deterministic.** Verdicts derive from inputs. Timestamps come from records, not the wall clock.
- **No false green.** A skip reports `not-evaluated`. An empty ledger reports that nothing was
  evaluated. Neither ever reports a pass.
- **Do not weaken a test or a standard to make an implementation pass.** That is the invariant itself,
  and it applies to the people building this repository first.
