# Local CI and verified pull requests

GitHub remains the source-control, pull-request, and review system. It is **not** what proves a branch
builds and passes its checks. That proof is produced here, in Docker, before the branch is pushed.

**The invariant:**

> **The commit pushed for a PR is exactly the commit that passed the complete local Docker CI
> pipeline.**

Everything below exists to make that a property of the tooling rather than a promise about how it is
used.

## Prerequisites

| Requirement | Why | Checked by |
| --- | --- | --- |
| **Docker** with Compose v2 | The isolation boundary for the whole pipeline | `scripts/ci.*` refuse with exit 2 if the daemon is unreachable |
| **git** | Resolving and comparing the verified SHA | `scripts/submit-pr.*` refuse with exit 2 outside a work tree |
| **PowerShell 7+** *(Windows)* or a POSIX shell | Invoking the wrapper | — |
| **GitHub CLI (`gh`)**, authenticated | Creating the PR only | Checked after the push; its absence never affects verification |

There is deliberately **no Node.js requirement on the host**. Node runs inside the container. You can
run `node scripts/ci-stages.mjs` directly for a fast inner loop, but that is a convenience, not the
gate — it uses whatever Node and whatever working tree you happen to have, which is the state the
container exists to eliminate.

## Running CI

```powershell
.\scripts\ci.ps1
```

```bash
./scripts/ci.sh
```

Exit code `0` only when every stage passed. Options:

| Option | Effect |
| --- | --- |
| `-Verbose` / `--verbose` | Print each stage's rationale and full `docker build` output |
| `-KeepOnFailure` / `--keep-on-failure` | Leave the compose project standing after a failure so you can inspect it |

## Submitting a verified pull request

```powershell
.\scripts\submit-pr.ps1
```

```bash
./scripts/submit-pr.sh
```

```
make changes  →  git commit  →  submit-pr
                                   │
                                   ├─ verify git repository
                                   ├─ refuse the default branch
                                   ├─ refuse base == head
                                   ├─ refuse a dirty working tree
                                   ├─ record HEAD                    ← the verified SHA
                                   ├─ run the full Docker CI pipeline
                                   ├─ stop on failure                → nothing pushed
                                   ├─ re-resolve HEAD, refuse if changed
                                   ├─ push that SHA by name
                                   └─ gh pr create, with evidence in the body
```

| Option | Effect |
| --- | --- |
| `-Draft` / `--draft` | Create the PR as a draft |
| `-Base <branch>` / `--base <branch>` | Base branch (default: the remote's default branch) |
| `-Title` / `--title` | PR title (default: the verified commit's subject) |
| `-Body` / `--body` | PR body. The evidence block is **appended**, never substituted for your text |

There is no `--skip-ci`. Passing it produces an error explaining why, because a bypass flag on a
verification tool is the same thing as no verification tool.

### Why the invariant actually holds

Four mechanisms, none of which rely on the developer doing the right thing:

1. **A dirty tree is refused before the SHA is recorded.** Clean tree + `HEAD` means the tree that
   gets built *is* the commit.
2. **The image copies the tree; it does not mount it.** The container cannot modify your working
   tree, so a CI run can never be the reason `HEAD` or the index moved during verification.
3. **`HEAD` is re-resolved after CI and any difference aborts** — with
   `HEAD changed after CI verification. The current commit has not been verified.`
4. **The push names the verified SHA explicitly**, `git push origin <sha>:refs/heads/<branch>`, not
   `git push origin <branch>`. Even a commit created in the gap between the check and the push cannot
   reach the remote.

`scripts/submit-pr.*` never creates a commit. If the tree is dirty it stops and says so.

## What CI performs

Eight stages, declared once in [`ci/pipeline.json`](../ci/pipeline.json) and executed by
[`scripts/ci-stages.mjs`](../scripts/ci-stages.mjs). They run in this order and **fail fast**.

| # | Stage | Command | What it establishes |
| --- | --- | --- | --- |
| 1 | Source inventory | `npm run inventory` | The standards series and prohibition register have not changed shape. Protection #2 of the standards-integrity invariant |
| 2 | Source fidelity | `npm run fidelity` | Every "verbatim from the source" block is verbatim; every cited `examples/` path exists |
| 3 | Policies | `npm run policy` | `project-policy.yml` and `betting-policy.yml` are schema-valid and internally consistent |
| 4 | Diagram freshness | `npm run diagrams` | Every `.mmd` matches its embedded copies (text comparison, no toolchain) |
| 5 | Decision records | `npm run check` | Every number in `examples/ledger` re-derives from its inputs |
| 6 | Test | `npm test` | The unit and contract suite |
| 7 | Audit | `npm run audit` | The repository audited by its own audit |
| 8 | Validate | `npm run validate` | **The gate.** This repository's own policy applied to itself |

This is the same list the GitHub workflow ran before local CI existed, and none of it was dropped —
`test/local-ci.test.mjs` asserts all eight stage ids are still present.

**Ordering is deliberate.** A broken worked example should fail at stage 5 with its own report rather
than as a test name at stage 6, and the gate runs last so that a failure names the specific check
rather than the verdict.

Stages that did not run because an earlier one failed are reported as **`not-run`**, never omitted and
never counted as passing.

## Container and service isolation

**This repository has no database and no services.** `docs/architecture.md` states it plainly: "There
is no server, no database, and no network I/O." So no database tier was invented for CI — a Postgres
or SQL Server container that nothing connects to would be theatre.

Two things follow, both stronger than the usual arrangement:

- **The pipeline runs with `network_mode: none`.** The architectural claim of no network I/O is
  enforced, not asserted. A check that quietly started reaching the internet fails here instead of
  passing on a machine that happened to be online.
- **No host path is mounted. Not one.** No source mount, no SSH agent, no Docker socket, no
  credential helper, no home directory. The run result is written inside the container and copied out
  with `docker cp` afterwards, which works on a stopped container and needs no shared uid.

**Nothing on your machine is touched.** Every compose resource is namespaced under a project name
unique to the run (`bs-ci-<pid>-<epoch>`), so teardown is exhaustive within the run and cannot reach
another repository's containers, your own services, or any volume you created.

### Concurrent runs get their own image, and this is load-bearing

The image tag carries the run id (`betting-standards-ci:bs-ci-<pid>-<epoch>`). It used to be a single
shared `:local`, which was a hole in the invariant rather than untidiness. A unique compose project
isolates containers and networks; it does **not** isolate a tag, and the tag is what executes:

```
run A: build → tags :local at A's tree
run B: build → RETAGS :local at B's tree
run A: run   → executes B's code, reports a result, records A's SHA
```

That publishes commit A on the strength of run B's code. The wrapper now also resolves the built
image ID and records it in the evidence file, so *which image ran* is auditable rather than inferred
from a mutable name. Teardown removes only that run's tag; layers are content-addressed, so the cache
survives.

**Demonstrated, not argued.** Two worktrees — one sound, one with a deliberately corrupted diagram —
ran concurrently:

| run | commit | result | failed stage | image |
| --- | --- | --- | --- | --- |
| good | `da94738` | passed | — | `88065f3705d1` |
| bad | `0eb34c3` | failed | `diagrams` | `4d8694abe445` |

Distinct images, each run reporting its own tree. Under the shared tag the dangerous crossover is the
other direction: the *bad* run executing the *good* image, reporting **PASS while recording
`0eb34c3`** — a broken commit published as verified.

### If you reuse this pattern in a repository that *does* have a database

`compose.ci.yml` carries the shape as a comment. Three rules make it safe, and `scripts/ci.*` already
assume them:

- the database is a service **inside the compose project**, so `down -v` destroys it and nothing else;
- credentials come from the CI shell environment, **never from a committed file**;
- the port is **not published to the host**, so your own SQL Server on 1433 is untouched and
  unreachable from the run.

Wait on it with `depends_on: { condition: service_healthy }` and a real `healthcheck`. Never a sleep.

## Failure and cleanup

On any outcome — pass, fail, or a build that never produced a container — the wrapper tears the
compose project down with `down -v --remove-orphans`, scoped to that run's project name.

To debug a failure, keep it:

```powershell
.\scripts\ci.ps1 -KeepOnFailure
```

The run does **not** use `--rm` — it previously did, which meant the container `--keep-on-failure`
promised to leave for inspection was deleted the moment the pipeline exited. The container is removed
explicitly at teardown instead, so keeping it actually keeps it. The script prints commands that work
on a stopped container:

```bash
docker logs bs-ci-run-12345-1786837178
docker cp bs-ci-run-12345-1786837178:/repo/artifacts/local-ci/latest.json .
docker run --rm -it --network none betting-standards-ci:bs-ci-12345-1786837178 sh
```

The image tag is kept too, so the shell you open is the image the run actually executed rather than a
rebuild that might differ. Clean-up commands are printed alongside. Nothing is left behind unless you
asked for it, and what is left is named so you can find it.

## Verification evidence

Every run writes `artifacts/local-ci/latest.json` — **gitignored**, because a machine-generated local
pass claim is not the kind of evidence this repository retains. Decision records and audit findings
are reviewed artifacts; this is transient output, and committing it would put an unreviewed assertion
alongside reviewed ones.

**The previous run's file is deleted before a new run starts**, not overwritten when it finishes. If a
run dies before the container writes a result — a failed image build, an unreachable daemon — the path
advertised as "the latest result" is then empty. Absence reads as *no result*; a leftover document
reads as a pass, and would attribute an earlier run's success to a run that failed.

```json
{
  "repository": "betting-standards",
  "commit": "56247ebff0ac872c3be652a5016567e771829dc5",
  "branch": "local-docker-ci",
  "result": "passed",
  "environment": "docker",
  "imageId": "sha256:3ff50005ff14691f4478793fac5125bb4af555775c414d2b73a1d3cb70fd1589",
  "startedAt": "2026-08-15T23:39:12.004Z",
  "completedAt": "2026-08-15T23:39:59.675Z",
  "checks": [
    { "id": "inventory", "result": "passed", "exitCode": 0, "durationMs": 241 }
  ]
}
```

The console summary prints repository, branch, verified SHA, result, the stages executed, and the
completion timestamp.

## Local CI is not GitHub Actions

Both exist. They are not the same claim and the tooling never conflates them.

```
              ci/pipeline.json          ← the single definition
                     │
            scripts/ci-stages.mjs
                 ╱        ╲
    scripts/ci.*           .github/workflows/ci.yml
    (Docker, local)        (GitHub-hosted)
    THE GATE               a second opinion
```

The workflow no longer lists the stages inline; it invokes the same runner over the same manifest.
Adding a check to `ci/pipeline.json` adds it to both, and `test/local-ci.test.mjs` fails if the
workflow stops calling the runner or if an `npm ci` appears in it (ADR 0006).

**The local run is authoritative for this repository.** The reason is historical and specific: when
this pipeline was written, GitHub-hosted Actions on this account had run exactly once, failing in four
seconds without executing a single step. Hosted runs have since succeeded, which changes the fact but
not the design — a gate that only reports after the push cannot gate the push. The PR evidence block
therefore says what was verified and where, and makes no claim about hosted runs:

```
## Local CI

Verified commit: <full SHA>
Result: PASS
Environment: Docker (compose.ci.yml, image sha256:<id>, no network)
```

The image is named by **ID, read out of that run's own `latest.json`** — not by tag. The tag is unique
per run and deleted at teardown, so a tag in the evidence would name something that no longer exists;
a *fixed* tag would be worse, since it stays plausible while silently ceasing to be true.
`test/local-ci.test.mjs` fails if either `submit-pr` script writes a literal image name.

### Self-hosted runners

A self-hosted runner would execute the **same** `./scripts/ci.sh` with no redesign. The job is written
out as a comment in `.github/workflows/ci.yml` rather than enabled, because a workflow targeting a
runner that does not exist sits queued forever — and a check that never reports is indistinguishable
from one that passed.

## Security

CI is treated as untrusted code execution.

- Runs as the unprivileged `node` user, never root.
- **No network** in the CI container at all.
- **No Docker socket** mounted.
- **No SSH credentials, no tokens, no `.npmrc`, no home directory** mounted.
- **No `.git`** in the image — the commit SHA is passed in as `CI_COMMIT_SHA`, so the container gets a
  tree, not a history it could rewrite.
- **No secrets in committed files.** The compose example takes a throwaway database password from the
  environment with `${CI_DB_PASSWORD:?...}`, which fails loudly if unset rather than defaulting.
- `gh` uses **your existing authenticated CLI session** on the host, after the push. No token is
  written into the repository, passed to a container, or baked into an image.

## Known limitations

Stated rather than implied away:

- **`scripts/submit-pr.ps1` is not covered by the automated refusal tests.** They drive
  `submit-pr.sh`, which needs a POSIX shell; on a Windows host without one the suite reports them
  **skipped with the reason**, and they run in full inside the container. The two scripts implement
  the same checks in the same order, but that correspondence is maintained by review, not asserted.
- **"Zero dependencies" means no npm packages.** CI shells out to `docker`, `git`, and `gh`, which is
  unavoidable for a tool whose job is running containers and pushing branches.
- **`npm test` requires Node ≥ 22 on Windows.** The glob is expanded by the shell on Linux and by
  Node on Windows, and Node's `--test` gained glob support in 22. Every environment in use — the
  container (Node 20, Linux), GitHub's runner (Node 20, Linux), and this workstation (Node 24) — is
  covered. Windows + Node 20 is not.
- **The invariant is established per run, not across a fleet.** Concurrent runs on one machine are
  covered (distinct images, demonstrated above). Two runs racing to `git push` the same branch are
  resolved by git, not by this tooling.
- **No test may plant fixtures in the tree other tests are reading.** `node --test` runs test files in
  parallel processes against one shared tree; a fixture written into `standards/` and cleaned up
  afterwards still makes an unrelated test file fail with `ENOENT` on a file it just listed. That was
  the cause of this pipeline's one intermittent failure (ADR 0007). Fixtures belong in a copy under
  `os.tmpdir()`. `test/fidelity.test.mjs` asserts its own fixture root is outside the repository; the
  rule is **not** mechanically enforced across all test files, because the source-scan version of it
  passed against the real offender and was discarded rather than kept as decoration.
- **Local CI proves the pipeline passed on this machine.** It is not a claim that no one can push an
  unverified commit: `git push` still exists. The guarantee is that `submit-pr` will not do it, which
  is the same governance boundary Standard 21 R5 draws — bypass is visible, not impossible.
