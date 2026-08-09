# ADR 0006 — A standalone repository with vendored machinery

**Status:** Accepted · **Date:** 2026-08-09 · **Deciders:** repository owner

## Context

The expanded brief opens with a constraint: this repository "will be independently maintained and must
not depend on any of the other standards repositories."

It also says to use the successful concepts of policy-as-code and evidence-based standards evaluation,
while designing the repository appropriately for this domain rather than copying blindly.

Those two instructions pull in opposite directions. A working implementation of exactly those concepts
exists in a sibling repository — a strict YAML subset parser, a JSON Schema evaluator, a catalog
loader, a compliance engine, a diagram freshness check. Roughly seventy per cent of it is entirely
content-agnostic. Reimplementing it from scratch would be a week of work reproducing decisions that
were already made correctly, and the reimplementation would be worse.

## Decision

**Fork the content-agnostic machinery; depend on nothing.**

- `yaml.mjs`, `jsonschema.mjs`, `catalog.mjs`, `compliance.mjs`, `policy.mjs`, `init.mjs`, and
  `diagrams.mjs` were copied in at M0 and are now this repository's code, maintained here.
- **After that copy, nothing in this repository references any other repository** at runtime, in
  tests, or in CI. Style references in prose are the only exception, and they are prose.
- Zero third-party dependencies, enforced structurally: CI has no install step, so adding a dependency
  breaks the build rather than passing review.
- Every borrowed *concept* is justified independently in `design/concept-model.md`, which records for
  each of the brief's fifteen candidate concepts whether it was adopted, adapted, or rejected, and
  why.

## Alternatives considered

**Depend on the sibling repository as a package or submodule.** Rejected: prohibited by the brief, and
it would mean this repository could not be validated without another present.

**Reimplement everything from scratch.** Rejected. It would spend the project's time on a YAML parser
instead of on the normative content, and it would rediscover the same design decisions with less
information. The parser's strictness — every scalar returned as a string, every unsupported construct
a hard error — is a considered position that took a real failure to arrive at, and rewriting it would
likely have produced something more permissive and worse.

**Vendor the machinery but keep it byte-identical for easy re-syncing.** Rejected, and this is the
subtler call. Keeping it identical implies an upstream, which is a dependency in everything but name —
and it would have blocked the changes this domain actually needed: removing the alias mechanism,
dropping the unused `optional` level and `info` severity, adding numeric bounds to the schema
evaluator, adding the `BLOCKED_BY_INVARIANT` verdict, and making the catalog refuse a waivable
prohibition. A fork that cannot diverge is not a fork.

## Consequences

- The repository is genuinely standalone: `git clone`, `npm test`, and everything runs.
- The machinery has already diverged, in the five ways listed above, each because this domain needed
  it.
- Zero dependencies means hand-written parsers and validators, which is more code to own. The
  compensating benefit is that CI has no supply chain and no install step, and the strictness of both
  hand-written components is deliberate rather than inherited.
- Bug fixes upstream will not arrive here. That is the cost of independence and it is accepted; the
  test suite is what stands in for it.
