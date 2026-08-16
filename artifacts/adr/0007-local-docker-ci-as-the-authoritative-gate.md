# ADR 0007 — Local Docker CI is the authoritative gate

**Status:** Accepted · **Date:** 2026-08-15 · **Deciders:** repository owner

## Context

The repository's checks lived as eight inline `run:` steps in `.github/workflows/ci.yml`. That
arrangement had two problems, one discovered and one structural.

**The discovered problem: hosted CI had never validated this repository.** At the time of this
decision, GitHub Actions had run exactly once, on 2026-08-09, failing after four seconds with no steps
recorded — the signature of an account-level constraint, not a code failure. Every green claim this
repository had made about itself was made by a developer running commands by hand. That is not a gate.
(Hosted runs have since succeeded on this branch. That retires the fact, not the decision: see the
structural problem below, which no amount of hosted reliability addresses.)

**The structural problem: a workflow file is not runnable before a push.** Verifying a branch meant
pushing it and waiting, which inverts the order that matters — the proof arrives after the thing it
was supposed to gate is already published.

## Decision

**The complete pipeline runs locally in Docker, and it is what gates a pull request.**

- The stage list moved out of the workflow and into `ci/pipeline.json`, executed by
  `scripts/ci-stages.mjs`. **There is one definition.** The local Docker run and the GitHub workflow
  both invoke it; neither restates it.
- `scripts/ci.ps1` / `ci.sh` build an ephemeral, uniquely-named compose project, run the pipeline in
  a networkless unprivileged container, and tear it down on every outcome.
- `scripts/submit-pr.ps1` / `.sh` enforce the invariant: **the commit pushed for a PR is exactly the
  commit that passed the complete local Docker CI pipeline.**
- `.github/workflows/ci.yml` is kept and refactored, not deleted. It is a second opinion, and it
  says so.

The invariant is enforced by construction: a clean tree is required before the SHA is recorded, the
image copies the tree rather than mounting it (so CI cannot move `HEAD`), the SHA is re-resolved after
CI and any difference aborts, and the push names the verified SHA explicitly rather than pushing a
branch ref.

## Admissibility under the v1.0 release boundary

`v1.0.0` was a release boundary: changes to the published contract require new evidence, not a green
build. This work does not change that contract, and the claim is mechanical rather than asserted.

Nothing under `standards/`, `rules/`, `schemas/`, `examples/`, `project-policy.yml`,
`betting-policy.yml`, `standards-adapter.json`, `VERSION`, or the evaluator modules is touched.
`test/baseline.test.mjs` is **unmodified and passing** — 21 standards, 51 rules at 25/3/23, 23
non-exemptible prohibitions, 41 evaluated, 13 fully machine-represented, `COMPLIANT` at 94. The one
`package.json` edit is to the `test` *script*, which is invocation and not part of the declared
adapter contract; `test/adapter-contract.test.mjs` passes, including its README-derived oracle.

**No version is issued**, which follows the precedent set at `56247eb`: *"an improved test is not by
itself grounds for a version."* Build and verification infrastructure is the same category.

The narrower point worth recording, because it is the one easy to get wrong: `v1.0.1` did **not**
reopen this repository for general development. It was a scoped, evidence-backed, non-normative
release — an orchestrator could not tell `validate` from `check`, both of which run cleanly and return
verdict-shaped objects, so the pack published which command carries its verdict. What `v1.0.1` and
`56247eb` establish is a *precedent* for non-normative change with recorded justification, not a
standing licence. This work is admissible because it falls in that category and was directed by the
owner — not because the boundary lapsed.

## Consequences

**Two production changes were required, both recorded rather than absorbed.**

`npm test` was `node --test "test/*.test.mjs"`. The quoting forced *Node* to expand the glob, and
Node gained `--test` glob support in v22 — so the command failed on Node 20 with
`Could not find '/repo/test/*.test.mjs'`, which is the version `.github/workflows/ci.yml` requests.
The hosted pipeline could never have passed this step. Unquoting lets the shell expand it on Linux
while Node still expands it on Windows; the same 167 tests run in both. **The container found this on
its first run**, which is the argument for the container.

The residual gap is stated in `docs/local-ci.md`: Windows + Node 20 remains unsupported for `npm
test`. It is not an environment in use, and papering over it by pinning CI to Node 24 would have hidden
a real defect behind a version bump.

**What this does not claim.** Local CI does not make an unverified push impossible — `git push` still
exists. It makes `submit-pr` refuse, and it makes what was verified auditable. That is the same
governance boundary Standard 21 R5 draws one level down: **bypass is visible, not prevented.** Any
wording suggesting otherwise would be the false green this repository exists to refuse.

**ADR 0006 is unaffected.** Zero third-party npm dependencies still holds and is still enforced
structurally: the CI image has no install step, and `test/local-ci.test.mjs` now asserts that no
`npm ci` or `npm install` appears in the workflow. "Zero dependencies" has always meant no packages;
the pipeline shells out to `docker`, `git`, and `gh`, and `docs/local-ci.md` says so plainly rather
than letting the dependency claim imply more than it means.

## The concurrency hole, and why it is recorded here

The first implementation shipped a defect that review caught and that is worth recording rather than
quietly fixing, because the reasoning error is reusable.

`compose.ci.yml` pinned a single image tag, `betting-standards-ci:local`. The wrapper gave every run
a unique compose *project* name, and the conclusion drawn from that — "runs are isolated" — was
wrong. A project namespaces containers, networks, and volumes. It does not namespace an image tag,
and the tag is the thing that executes. Two concurrent runs interleave as build-A, build-B, run-A,
and run-A then evaluates B's tree while recording A's SHA.

That is not a cache annoyance. It is a direct falsifier of the invariant: commit A gets pushed on the
strength of run B's code. The original report called it "layer-cache races are possible", which
understated a correctness defect as a performance note.

The fix is a per-run tag, plus resolving the built image ID and recording it in the evidence, so what
ran is auditable rather than inferred from a mutable name. It is demonstrated by running two
worktrees concurrently — one sound, one with a corrupted diagram — and observing distinct images and
each run reporting its own tree.

**The general lesson:** isolation is only isolation of the things actually namespaced. Every shared
mutable name between concurrent runs — a tag, a fixed path, a well-known port, a database name — is a
candidate crossover, and "the containers are separate" does not cover any of them.

**A second-order defect the fix created, and the rule taken from it.** The PR evidence block named the
image as a literal string, `betting-standards-ci:local`. Making the tag per-run left that line
untouched, so the artefact whose entire purpose is describing what was verified went on asserting an
image that no longer existed — in a pull request about trustworthy evidence. The evidence now reads
the image **ID** out of that run's own `latest.json`, and `test/local-ci.test.mjs` fails if either
`submit-pr` script writes a literal image name.

The rule is narrower than "keep documentation current": **an evidence field must be read from the run
it describes, never typed in.** A hand-written value is correct on the day it is written and has no
mechanism for ever becoming wrong out loud. The same reasoning retired this document's claim that
hosted Actions had never validated the repository — true when written, since falsified by hosted runs
succeeding, and stated as history rather than as current fact.

## The intermittent failure, diagnosed

A single `Test`-stage failure appeared once in roughly ten gate runs and resisted reproduction. It was
recorded as unexplained rather than dismissed, and it was found by the gate itself, on the run that
submitted this work.

`test/fidelity.test.mjs` planted fixture standards into the **real** `standards/` directory and
removed each one in a `finally`. The tree therefore always ended clean, which is why it looked
harmless. But `node --test` runs test files in parallel processes against one shared tree, and
`test/baseline.test.mjs` walks `standards/` reading every entry. When the two interleaved, baseline
listed a fixture and then failed to open it:

```
ENOENT: no such file or directory, open '/repo/standards/92-fidelity-backticks.md'
```

An unrelated test file, failing on a file it had itself just seen.

**Reproduced, then measured.** Built at the pre-fix tree and run in the container: **2 of 20** and **2
of 10** suite runs failed, every one of them with that same ENOENT. The fixed tree, same image
recipe: **0 of 40**. On the Windows host (Node 24) the pre-fix tree failed **0 of 20** — the race is
scheduling-dependent, and the environment that found it is the one the gate actually runs in. That is
the second time the container caught something no amount of running commands by hand did.

**This is the concurrency lesson
above, one level down:** a fixed path shared between concurrent runs is a crossover, and "each test
cleans up after itself" does not address it any more than "each run has its own container" addressed
the image tag. Fixtures now go in a copy of the tree under `os.tmpdir()`; `fidelity.mjs` resolves its
root from its own location, so a copy is a complete subject and **no production code was changed for
testability**.

The general rule — no test plants fixtures in the tree other tests are reading — is enforced where it
is decidable: `fidelity.test.mjs` asserts its own fixture root lies outside the repository, which
fails against the previous implementation. A source-scanning version covering all test files was
written and **discarded**: run against the actual offender it passed, because the offender built its
path into a variable before the write and the regex only saw inline calls. Deciding it needs dataflow
a regex does not have, and a check that green-lights the defect it names is worse than an
acknowledged gap.

## Alternatives considered

**Keep the pipeline in the workflow and call it from Docker.** Rejected: parsing YAML to discover the
stage list needs a YAML parser in the CI entry point, and the vendored one is deliberately a strict
subset that does not cover the workflow schema. JSON is read by `JSON.parse` with nothing vendored.

**Delete the workflow.** Rejected. It costs nothing while disabled, it is the natural home for a
self-hosted runner later, and deleting the only external check because it is currently broken removes
the evidence that it is broken.

**Duplicate the stages in both files and keep them in sync by review.** Rejected outright — that is
the failure this ADR exists to prevent. Two pipelines that can disagree will, and the one that goes
green is the one that gets believed.

**A dedicated database container for CI.** Rejected as fiction: this repository has no database. The
reusable shape is a comment in `compose.ci.yml`; a service nothing connects to would be theatre and
would make the CI run look like it proved more than it did.
