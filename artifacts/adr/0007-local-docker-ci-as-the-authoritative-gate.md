# ADR 0007 — Local Docker CI is the authoritative gate

**Status:** Accepted · **Date:** 2026-08-15 · **Deciders:** repository owner

## Context

The repository's checks lived as eight inline `run:` steps in `.github/workflows/ci.yml`. That
arrangement had two problems, one discovered and one structural.

**The discovered problem: hosted CI has never validated this repository.** GitHub Actions has run
exactly once, on 2026-08-09, and it failed after four seconds with no steps recorded — the signature
of an account-level constraint, not a code failure. Every green claim this repository has made about
itself was made by a developer running commands by hand. That is not a gate.

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
