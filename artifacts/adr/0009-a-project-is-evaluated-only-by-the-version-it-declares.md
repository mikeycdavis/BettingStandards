# ADR 0009 — A project is evaluated only by the framework version it declares

**Status:** Accepted · **Date:** 2026-08-27 · **Deciders:** repository owner

## Context

`schemas/project-policy.schema.json` has carried this promise since `v1.0.0`, in the description of
the field itself:

> "The framework version this project is evaluated against. An unresolvable version is a
> configuration error, not a compliance failure — exit 2, never a verdict."

Nothing implemented it. `standardVersion` was read, echoed into the result envelope, and ignored. A
target's `project-policy.yml` is never validated against that schema, so not even `required` or the
semver `pattern` were enforced.

While the pack was 1.0.x the gap was dormant: a target declaring `1.0.0` got 1.0.x semantics, so the
label was accidentally true. Release 2.0.0 changes what `validate` does to an external target, and
`v1.0.0` is the only release anyone can pin — so this is exactly the release at which an unchanged v1
declaration silently crosses a major semantic boundary. Measured on the first 2.0.0 candidate:

```text
target declares          standardVersion: "1.0.0"
executing pack VERSION   2.0.0
→ COMPLIANT, score 96, coverage 41, exit 0
→ envelope standardVersion: "1.0.0"
```

A 2.0.0 verdict wearing a v1.0.0 label.

## The decision

**Evaluation requires the authority to evaluate, and that authority is the project's declared
framework version, resolved by exact equality with the executing `VERSION`.** An absent declaration,
a declaration that is not a version, and a declaration naming another release are all configuration
errors: exit 2, no verdict, no findings, no coverage figure.

Exact equality, deliberately. This pack has no compatibility range and no version-resolution
mechanism, and one was not invented inside a guard. A range mechanism needs its own design and its
own evidence; producing one as a side effect of a fix is how an unreviewed contract gets created.

## Why this ADR is mostly about *where*

The rule above was never in dispute. It was placed three times, and the first two placements were
locally convincing, defended in a commit message, covered by passing mutation tests, and wrong.

| # | Placement | The reasoning at the time | What review found |
| --- | --- | --- | --- |
| 1 | `runValidate` | `validate` is the only command that stamps `standardVersion` onto its output, so it is the only one that can mislabel a result | `audit` and `status` call `gatherEvidence` directly. `audit --strict` returned a wrong-framework evaluation as a **gating failure** |
| 2 | `gatherEvidence` | That is where evaluation happens | It is where evaluation happens for three commands. `standards check <target>` and `node scripts/decisions.mjs --dir <ledger>` reach `checkDecisions` without passing through it. Both re-derived five records of a target declaring `1.0.0` under a 2.0.0 checkout, exit 0 |
| 3 | The evidence authorities themselves | Below | — |

Each fix removed one enumeration and left a smaller one behind. That is a shape, not a run of bad
luck: **the guard was placed at the boundary that covered the callers already in mind, rather than at
the boundary the evidence is produced by.** A list of callers can be made complete on Tuesday and be
incomplete on Wednesday, and nothing in the code will say so.

It is the same correction as ADR 0008's rule-ownership addendum, made twice more. There, an
enumeration of rule ids was maintained one module away from the checker that produced the findings.
Here, an enumeration of *callers* was maintained one layer away from the code that produced the
evidence. The remedy is identical: the thing that establishes something owns the check on its
authority to establish it.

## The topology, established by tracing

Every externally reachable path that can evaluate a decision record:

| Path | Reaches records via | Project root known? | Class |
| --- | --- | --- | --- |
| `standards validate <dir>` | `gatherEvidence` → `checkDecisions` | yes — it was given one | external target |
| `standards audit <dir>` | `gatherEvidence` → `checkDecisions` | yes | external target |
| `standards status <dir>` | `gatherEvidence` → `checkDecisions` | yes | external target |
| `standards check <dir>` | **`checkDecisions` directly** | yes | external target |
| `decisions.mjs --dir` / `--record` | **`checkDecisions` directly** | **no** — a ledger directory | external target, authority must be supplied |
| `decisions.mjs` (no arguments) | `checkDecisions` | n/a | self-checkout |
| `checkOwnExamples()` | `checkDecisions` | n/a | self-checkout |
| `checkDecisions({…})` programmatic | itself | the caller's to state | caller declares |
| `checkRecord(record, {policy, schema})` | — | n/a | internal primitive: one already-parsed record against an already-loaded policy. Below the authority boundary, reachable only by importing the module, and used by this repository's own negative fixtures |
| `standards plan` / `init` / `explain` | — | — | produce no evidence |

## Where the guard went

**This pack has exactly two authorities that produce evidence, and each guards what it establishes.**

1. **`gatherEvidence`** — project-level evidence: the policy findings, the document findings, the
   rule dispositions, and the coverage figure. All of these exist even when no decision record is
   read, which is why this guard cannot be folded into the one below. A target with a full ledger and
   no `betting-policy.yml` never reaches `checkDecisions` at all, yet `audit` and `status` would
   still report dispositions and coverage derived from a framework the project never declared.
2. **`checkDecisions`** — record-level evidence. Nothing evaluates a decision record without coming
   through it, from any command, any CLI, or any programmatic caller.

One implementation, in `scripts/framework-version.mjs`, asked by both. Neither evaluator owns it, so
the two cannot drift into different ideas of what a version is.

**The number of guards follows the number of places evidence is made, not the number of ways to ask
for it.** That is the property that makes this an ownership rule rather than a third enumeration: a
new command, a new flag, or a new caller cannot add a guard site, because it cannot add a place where
evidence is produced.

### The input is a path, never a version string

`declaredVersionRefusal` is handed a path to a `project-policy.yml` and opens it. A caller that
extracted `standardVersion` itself and passed the result would put the *reading of the declaration*
outside the authority that acts on it — the defect ADR 0008 was written about. A caller chooses
**which** project policy speaks for these records. It never gets to say what that policy contains.

### Nothing searches

There is no walking up a directory tree, no fallback to this pack's own policy, no inference from
filesystem shape. ADR 0008 already recorded why: *"a search that succeeds in the wrong place is how
the sibling pack's version of this defect works."*

This is what forced the one genuinely new interface in this change. `node scripts/decisions.mjs
--dir <ledger>` is handed a ledger directory, and **a ledger directory is not a project root**. It
cannot establish the authority from what it was given, and it is not permitted to guess. The honest
options were to require the caller to supply it, or to declare that entry point unable to evaluate
external targets at all.

It requires the caller to supply it: `--project-policy <path>`, refused when `--dir` or `--record` is
given without it. This is exactly symmetric with `--policy`, which ADR 0008 added for the thresholds
for exactly the same reason. Two identities a ledger cannot supply about itself, both named by the
caller, neither derived. `standards check <dir>` joins both filenames onto the directory it was
handed, because it *was* handed a project.

### There is no self-checkout exemption

The obvious design — a flag or a wrapper meaning "this is us, skip the check" — was rejected. An
exemption is a door, and this ADR exists because doors kept being found.

`checkOwnExamples()` names this repository's own `project-policy.yml` and passes the same check every
external caller does. It proceeds because that file declares the version this checkout executes,
which is a fact re-read at call time rather than a status claimed. If this repository's declared
version ever drifted from its `VERSION`, the pack would refuse to check its own examples — and its
own gate would say so, which is the correct outcome.

The distinction "external target vs self-checkout" therefore never has to be drawn, and no code
attempts to draw it. That is the strongest form available: the question that could be answered wrongly
is not asked.

## Consequences

**Breaking, and folded into 2.0.0 rather than deferred.** Shipping a major that contradicts its own
schema, while `v1.0.0` remains the only pinnable release, would knowingly publish the mislabel.

- `validate`, `audit`, `status` and `check` exit 2 for a target whose declared version is absent,
  malformed, or not this one. `audit --strict` returns 2, not 1: a configuration error is never a
  gating failure about any record.
- `checkDecisions({ dir, policyPath })` now also requires `projectPolicyPath` and throws without it —
  a second required argument added to the same function in the same release, for the same reason as
  the first.
- `node scripts/decisions.mjs --dir`/`--record` requires `--project-policy`.
- `plan`, `init` and `explain` are unchanged. `plan` in particular must keep working: it is the one
  command that can still tell an adopter on an older version what this one would ask of them.

### Evidence

Red first, in both files, against the tree as it stood. The reviewer's table, verified by execution
rather than by reading:

```text
target declares 1.0.0, executing 2.0.0
  standards validate <target>                 exit 2, nothing evaluated
  standards audit <target>                    exit 2, nothing evaluated
  standards audit --strict <target>           exit 2, nothing evaluated
  standards status <target>                   exit 2, nothing evaluated
  standards check <target>                    exit 2, no records re-derived
  decisions.mjs external, no authority named  exit 2, names --project-policy
  decisions.mjs external, authority named     exit 2, names both versions
  plan <target>                               exit 0, preview intact
  decisions.mjs (self-checkout)               exit 0, 5 records
  validate . (self)                           exit 0, COMPLIANT
```

Three mutations, each run against the code it protects, each chosen so it discriminates the mechanism
rather than the fixture:

```text
move the guard after record evaluation        exactly the ordering test red
delete gatherEvidence's call site             validate + audit + status all leak, on the
                                              no-betting-policy fixture that only this
                                              authority covers
delete checkDecisions' call site              `standards check` + `decisions.mjs` both leak
```

The second of those had to be rewritten during this change, and the rewrite is worth recording. It
originally used a target *with* a betting policy and asserted all three commands leaked; once
`checkDecisions` grew a guard of its own, that assertion failed — correctly, because the commands
reached the record authority, which refused on its own account. The two guards cover different
ground, and a mutation has to name which ground it is testing. A mutation test that keeps passing
after the code around it changes shape is not necessarily still proving what it was written to prove.

A census test derives the subcommand list from the CLI's own help output and runs each one against a
mismatched target, so a subcommand added later cannot join the family without this evidence having an
opinion about it.

## Alternatives considered

**Add the check to `standards check` as well.** The third instance of the mistake this ADR is about.
It would have closed the door review had just found and left `decisions.mjs` open.

**Have `checkDecisions` locate the project policy from the ledger directory.** Rejected outright, and
the reason is the release this ADR ships in: 2.0.0 exists to *remove* a fallback that resolved a
policy path by guessing. Replacing one guess with another, in the same function, in the same release,
would have been the defect wearing a different hat.

**A `trusted: true` / `selfCheckout: true` option on `checkDecisions`.** An exemption flag is a door
that reads as safe at every call site and is only wrong at one of them. Naming the pack's own
project policy costs one argument and cannot be misused, because supplying it is indistinguishable
from what every honest caller does.
