# PROJECT.md

## Purpose

A standalone, auditable standards system for betting and gambling decisions: whether a prediction, at
an offered price and under applicable risk constraints, justifies risking money.

It is deliberately separate from prediction standards. Whether a prediction deserves belief is a
different question, answered elsewhere (ADR 0001).

## Stack

Node.js >= 18, ESM. **Zero third-party dependencies**, enforced structurally: CI has no install step,
so adding one breaks the build rather than passing review (ADR 0006).

Both the YAML subset parser and the JSON Schema evaluator are hand-written and deliberately strict —
every construct outside the supported subset is a hard error, never a best guess.

## Layout

| Path | Contents |
| --- | --- |
| `standards/` | 21 numbered normative documents |
| `rules/` | 13 category files: the machine-readable rule catalog |
| `schemas/` | decision record, betting policy, project policy |
| `scripts/` | CLI, betting arithmetic, decision checker, invariant checks |
| `test/` | 144 tests plus known-negative fixtures |
| `examples/` | worked decisions, walkthroughs, one document per prohibition |
| `templates/` | what `standards init` copies into an adopting project |
| `design/` | concept model, architecture and milestones |
| `artifacts/` | both source briefs, the source inventory, 6 ADRs |
| `docs/` | architecture, diagrams |

## Commands

```bash
npm test           # 144 tests
npm run check      # re-derive every number in examples/ledger
npm run validate   # the verdict — the CI gate
npm run audit      # evidence, no verdict
npm run inventory  # the standards series and prohibition register have not changed shape
npm run fidelity   # every verbatim claim is verbatim; every cited example exists
npm run policy     # both policies against their schemas
npm run diagrams   # Mermaid source matches its embedded copies
```

CI runs all eight in this order: inventory, fidelity, policy, diagrams, check, test, audit, validate.

## Architectural rules

1. **The catalog defines rule identity. The policy defines applicability. The evaluator produces
   evidence. None may redefine the others.** Enforced by `assertBindings`.
2. **No false green.** A rule nothing evaluated reports `not-evaluated`, never passing. An empty
   ledger reports that nothing was evaluated.
3. **The number is never the verdict.** Expected value is an input to a decision, never the decision;
   coverage ships beside the verdict and is never folded into the score.
4. **Exit codes are load-bearing.** 0 success, 1 verdict failure, 2 input unreadable. A 2 is never
   reported as non-compliance.
5. **Nothing depends on another repository** at runtime, in tests, or in CI.
6. **Do not weaken a standard, test, or tolerance to make an implementation pass.** That is
   `integrity.no-standard-weakening`, and it applies to the people building this repository first.

## Own compliance

This repository dogfoods its own policy. It places no wagers, so the operational rules are declared
`not-applicable` with reasons and revisit conditions — never exceptions. `exceptions: []` is a
position, not an accident.
