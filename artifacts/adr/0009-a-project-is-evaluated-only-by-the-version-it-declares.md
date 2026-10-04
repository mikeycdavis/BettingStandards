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

The rule above was never in dispute. It was placed four times. The first three placements were each
locally convincing, defended in a commit message, covered by passing mutation tests, and wrong.

| # | Placement | The reasoning at the time | What review found |
| --- | --- | --- | --- |
| 1 | `runValidate` | `validate` is the only command that stamps `standardVersion` onto its output, so it is the only one that can mislabel a result | `audit` and `status` call `gatherEvidence` directly. `audit --strict` returned a wrong-framework evaluation as a **gating failure** |
| 2 | `gatherEvidence` | That is where evaluation happens | It is where evaluation happens for three commands. `standards check <target>` and `node scripts/decisions.mjs --dir <ledger>` reach `checkDecisions` without passing through it. Both re-derived five records of a target declaring `1.0.0` under a 2.0.0 checkout, exit 0 |
| 3 | `gatherEvidence` + `checkDecisions` | those are the authorities that produce evidence | **also wrong.** `policy.mjs` / `checkPolicy()` loads this checkout's rule catalog and applies `nonExemptible` to a policy document it is pointed at, reaching neither. An external policy declaring `1.0.0` produced `policy.non-exemptible-rule` and **exit 1** — a findings exit, about a subject that never authorized this framework |
| 4 | The evidence authorities, enumerated mechanically | that is a derived census, not a recalled one | **incomplete.** The census stated its line as a dichotomy — a surface either RESOLVES this checkout's semantics for a subject, or is HANDED them by its caller. `checkLedger` is neither: it is handed only the records and opens nothing, yet attributes this checkout's rule ids to them. Verified emitting `record.decision-record-required` about an external ledger with no authority anywhere |
| 5 | The same census, over a three-case line | `checkLedger` was the EMBEDS case | **still too narrow.** Review named `checkRecord` and `evaluate` in the same finding, and both embed too: the first attributes thirteen rule ids of its own while receiving only thresholds and a shape, the second applies this pack's whole verdict algebra — and is handed the very document carrying the declaration. Specimen: a 2.0.0 verdict for a policy declaring `1.0.0` |
| 6 | Every surface that can establish a finding, disposition, score, coverage figure or verdict | Below | — |

Each fix removed one enumeration and left a smaller one behind. That is a shape, not a run of bad
luck: **the guard was placed at the boundary that covered the callers already in mind, rather than at
the boundary the evidence is produced by.** A list of callers can be made complete on Tuesday and be
incomplete on Wednesday, and nothing in the code will say so.

**The third placement was right about the principle and wrong about the inventory, and the first
version of this ADR said so in a sentence that was false when it was written:** *"This pack has
exactly two authorities that produce evidence."* It had three. The census behind that claim was built
by reading the code and remembering what was in it — the same method that produced the two previous
inventories, both of which an external reviewer falsified. "I traced it carefully" is not evidence
about completeness; it is the identical claim that had already been wrong twice.

So the census is no longer asserted. `test/evidence-surface-census.test.mjs` derives it: the entry
points come from globbing `scripts/`, and the surface list comes from importing every module and
reading what it actually exports. Every file and every export must carry a classification with a
recorded reason, checked in both directions, so adding either fails the suite until somebody says
what the new surface does with an external subject. The rule below is the judgement; the census is
the thing that stops the judgement being applied to an incomplete list.

It is the same correction as ADR 0008's rule-ownership addendum, made twice more. There, an
enumeration of rule ids was maintained one module away from the checker that produced the findings.
Here, an enumeration of *callers* was maintained one layer away from the code that produced the
evidence. The remedy is identical: the thing that establishes something owns the check on its
authority to establish it.

## The topology, derived rather than recalled

Every externally reachable surface that can interpret an external subject using this checkout's
standards semantics. This table is the human-readable form; the machine-checked form is
`test/evidence-surface-census.test.mjs`, which builds the same list from the filesystem and from the
modules' own exports and fails when it meets a member nobody has classified.

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
| `node scripts/policy.mjs <policy>` | **`checkPolicy` directly** | it IS the project policy | external subject; the subject carries its own declaration |
| `node scripts/policy.mjs --betting <file>` | `checkPolicy` | **no** — a betting policy declares no framework | external subject; `--project-policy` names the governing declaration |
| `checkPolicy(...)` programmatic | itself | the caller's to state | caller declares |
| `loadBettingPolicy(path)` | — | n/a | primitive: validates a config file's shape and produces no finding, disposition, score, coverage or verdict |

## Where the guard went

**Three authorities produce evidence, and each guards what it establishes.**

1. **`gatherEvidence`** — project-level evidence: the policy findings, the document findings, the
   rule dispositions, and the coverage figure. All of these exist even when no decision record is
   read, which is why this guard cannot be folded into the others. A target with a full ledger and
   no `betting-policy.yml` never reaches `checkDecisions` at all, yet `audit` and `status` would
   still report dispositions and coverage derived from a framework the project never declared.
2. **`checkDecisions`** — record-level evidence. Nothing evaluates a decision record without coming
   through it, from any command, any CLI, or any programmatic caller.
3. **`checkPolicy`** — policy-level evidence. It loads this checkout's rule catalog and applies
   `nonExemptible` to a policy document it was pointed at, reaching neither of the other two. Which
   rules are non-exemptible is exactly the kind of thing a major version may change, so a finding
   derived from it is a statement made under this checkout's semantics. Whether that finding happens
   also to hold under the version the subject declared is beside the point: it was not established by
   a framework the subject authorized.

One implementation, in `scripts/framework-version.mjs`, asked by all three. No evaluator owns it, so
they cannot drift into different ideas of what a version is.

**The line, stated as a rule rather than a list — and it has three cases, not two.** A surface
needs the check when it interprets a subject it was handed under semantics the subject did not
supply. That happens three ways:

- **RESOLVES** — it opens this checkout's rule catalog or a normative schema on behalf of a subject
  it was pointed at: `gatherEvidence`, `checkDecisions`, `checkPolicy`.
- **EMBEDS** — the rule ids it attributes, or the algebra it applies, are written into the function
  itself. What its caller supplies is inputs, not semantics: `checkRecord`, `checkLedger`,
  `evaluate`.
- **TRANSFORMS** — it neither opens nor embeds. It moves data between shapes and attributes nothing:
  `canonicalize`, `decisionDigest`, `render`, `envelope`, `coverage`, all of `betmath`.

RESOLVES and EMBEDS both carry the check. Only TRANSFORMS does not.

### The TRANSFORMS boundary, examined rather than assumed

TRANSFORMS was the line's third draft and the first not yet falsified, so it was reviewed on its own
terms. Two surfaces sit in it that carry a subject's numbers to a user, and both recorded grounds
turned out to be the same "the caller supplied it" form that failed the two drafts before.

**`envelope`** stamps a `standardVersion` its caller hands it onto a verdict its caller hands it.
Every judgement field — `status`, `score`, `summary`, `assurance`, `denominator`, `results` — is
copied through; the only things it contributes are `schemaVersion` and the key layout. Handed a
fabricated verdict it will format one, but so will an object literal, which is all it is. A guard
here would refuse nobody who already holds the verdict, and a guard placed because a function is
exported is exactly the reasoning this ADR exists to stop.

**`coverage`** was recorded as computing "over a catalog the caller already holds". That was the
incomplete half of the truth. Its other argument, `evaluated`, is subject-derived: `gatherEvidence`
trims the set when a subject has no ledger or no checked records, and the effect is not marginal —
measured on an adopting project, removing its ledger takes `evaluatedRules` from 41 to 6 and
`fullyMachineRepresentedStandards` from 13 to 1. So `coverage` does report a figure *about a
subject*. It stays exempt on the narrower and true ground that it is handed no finding, no policy and
no disposition, and therefore judges nothing — it counts rule metadata against a list of ids.

That correction propagated to the census's own criterion sentence, which had listed "coverage figure"
among the triggers while exempting `coverage` three lines above — a contradiction that would have
misled the next reader the same way the last two false grounds did. The line is between *reporting a
number about a subject* and *judging one*.

**No code changed, because no bypass exists.** What was missing was that the exemption rested on
prose. The property that actually holds is reachability — neither surface is handed anything it could
establish authority from, so what must be true is that no user-visible transform output escapes for a
subject whose authority was never established. That is now asserted behaviourally in both directions:
absent for a subject declaring `1.0.0` and for one declaring nothing, present for one declaring the
executing version. The converse arm is not decoration — an absence assertion is satisfied by a pack
that emits nothing, by a refusal for an unrelated reason, or by a regex that matches nothing.

Reproduced red before the assertion was written: with the guards in `standards.mjs`, `decisions.mjs`,
`policy.mjs` and `compliance.mjs` removed, `validate` on a subject declaring `1.0.0` returns an
envelope reading `"standardVersion": "1.0.0"` beside a 2.0.0-derived `NON_COMPLIANT` at score 96 and a
coverage figure of 41 — an unverified version claim attached to this checkout's own judgement. The
mutation must remove every one of those guards to surface it, which is itself the finding that the
transforms are protected by their callers rather than by themselves.

**Two wrong lines were drawn here, and both are recorded rather than quietly replaced.**

The first was a dichotomy — a surface either RESOLVES this checkout's semantics or is HANDED them —
under which `checkLedger` was a primitive because it "is handed an already-loaded policy and schema".
It is handed neither; its only parameter was the record list.

The second kept the same "handed" ground for `checkRecord` and `evaluate`, and review found both in
one finding. `checkRecord` receives thresholds and a shape while attributing thirteen rule ids of its
own. `evaluate` receives a catalog and a policy while applying this pack's entire verdict algebra —
STATUS, the exception semantics, the prohibition ranking, the scoring — and the policy it receives is
the document carrying the declaration it was ignoring.

**The common defect is not the taxonomy. It is that "the caller supplied it" was accepted as a reason
without asking *what* the caller supplied.** A betting policy is thresholds. A schema is a shape.
Neither is a framework, and neither authorizes anything. The census now asserts *behaviour* rather
than checking prose: every surface classified as carrying the check must actually refuse when no
authority is named, which is a claim that cannot be satisfied by a well-written reason.

`evaluate` reads the declaration out of the document it was already given. That is not the rejected
"accept a version string" shape: what it receives is the document, and it extracts the version
itself — the same rule as everywhere else, with the path step already done by its caller.

**The number of guards follows the number of places evidence is made, not the number of ways to ask
for it.** That is the property that makes this an ownership rule rather than a third enumeration: a
new command, a new flag, or a new caller cannot add a guard site, because it cannot add a place where
evidence is produced. What a new *module* can do is add one — which is what the derived census is
for, and why it fails rather than passing when it meets a surface nobody has classified.

**The census's own scope was the last thing still asserted.** It derived its contents by globbing
`scripts/`, which is complete over the set it looks at — and the set it looks at was chosen by hand,
which is the shape of every failure above, moved up one level. A module added at `lib/evaluator.mjs`
would have produced evidence and been invisible to every test. The scope is derived now too: the
repository is walked, and `scripts/` must be the only place executable code lives.

**Amendment (ST-03): `ci-stages.mjs` is classified by execution, not by reading.** It was the one
surface the census could neither run nor import, because it has no `argv[1]` guard and executes the
whole pipeline, this suite included, on import. Its classification rested on two properties of its
source (no exports, argv only consulted through two boolean `.includes()` calls). That is evidence
about two properties, not behavioural proof, and it could not notice a route the patterns do not name.

It is now run. `ROOT` in that file is derived from its own location, so the unmodified file is copied
into a temporary tree beside a stub `ci/pipeline.json` and executed there: same bytes, different root,
stub stages, no recursion. **No production code changed and no manifest-override input was added**,
because an override would be an external input to the surface being shown to have none. The tests
assert, by execution, that handing it an external subject (as a path, a directory, a rogue manifest, in
`--flag value` and `--flag=value` forms, or as its working directory) changes none of: the stages run,
the arguments they receive, its exit code, its output, its evidence record; that the record's keys are
a closed set containing a pipeline result and nothing about a subject; that a failed stage stops the
run and later stages are `not-run`, never `passed`; that an unreadable manifest is exit 2 with no
record; and that importing it exposes no export (the export census, read by execution). A control
asserts the fixture runs the shipped file byte for byte. The source-property test remains as a cheap
tripwire and is no longer the ground of the classification.

Mutations, each run against `scripts/ci-stages.mjs` and reverted:

```text
manifest path taken from argv             killed (tripwire and executed)
add an export                             killed (tripwire and executed)
forward positional args to stages         killed (tripwire and executed)
manifest resolved from the cwd            killed by the executed cwd test only
record gains a standardVersion key        killed by the executed record test only
not-run recorded as passed                killed by the executed record test only
remove fail-fast                          killed by the executed record test only
--dir changes the working directory       survived: an equivalent mutant. Stages run with an
                                          absolute cwd and the manifest and evidence paths are
                                          absolute, so the chdir has no observable effect
```

What this does not establish: it is a finite set of spellings, not a proof over all inputs, and a
future input that is not argv, cwd or the manifest (for example an environment variable that selects
a manifest) is outside what is probed. Environment is deliberately not varied here.

**Amendment (ST-04): the census now reaches files that are not JavaScript.** It globbed
`.mjs`/`.cjs`/`.js`, so `package.json` scripts, `ci/pipeline.json`, `standards-adapter.json`, the
workflow, the container recipe and the shell and PowerShell wrappers had never been asked whether
they can establish a finding, disposition, score or verdict about a subject with no authority named.
The answer has the same shape as everywhere else: a data file cannot judge, it can only *name* a
command, so what is checked is where the names lead. All of it is derived, in
`test/evidence-surface-census.test.mjs`:

- **Scope.** The repository is walked and *every* file must be classified, not only files with an
  extension someone listed. Anything starting with `#!` must be a classified wrapper whatever it is
  called, so renaming a script does not hide it. No extension exempts a file from that check: a
  tracked `docs/validate.md` or `data.json` that begins with a shebang is a failure, not prose. Only
  JavaScript is skipped, because the JavaScript census owns it. What this does not establish: a
  file with no shebang that is executed some other way (an interpreter named by a wrapper) is
  reached only through the wrappers' own tripwire, and the executable bit in git is not examined.
- **Vocabulary.** Command-bearing keys (`command`, `arguments`, `entrypoint`, `scripts`, `bin`, `run`,
  and similar) exist only in the three files classified as command manifests. A new JSON or YAML file
  that starts launching things fails until it is classified.
- **`package.json`.** Every script parses strictly (no shell composition, `node scripts/*.mjs` or this
  suite only), reaches a script the CLI census classifies, and is *run* with the script's own parsed
  arguments, plus the subject, on an external subject declaring another framework. A script that
  carries an argument the census does not model for a refusing surface (a subject path of its own,
  `--record`, `--project-policy`, any flag not listed for that surface) fails the sweep instead of
  being replaced by the canonical invocation, and an exit 2 is accepted only when it is the guard's own refusal: stdout empty and stderr carrying
  the wrong-framework diagnostic (`this project declares standardVersion <declared>, and this checkout is
  <executing>` followed by `Nothing was evaluated.`) for the version the subject declares. A usage
  error, a missing file, a missing betting policy, a refusal about another version, the right words on
  stdout, and the right words with another exit code all fail the sweep. This matters because a
  *regressed* guard looks exactly like those: with no betting policy, the later step that fails first is
  also exit 2 with empty stdout. For `standards.mjs` the parsed arguments were already used:
  verdict-bearing subcommands must refuse with that diagnostic; `plan`, `explain` and `init --dry-run`
  may run (ADR 0009 keeps them working) but must emit no verdict-shaped figure. The subject has no
  betting policy or ledger on purpose, so only the project-level guard can answer, which is the ground
  a second guard would otherwise mask. The one exception is `standards check`, which refuses a
  directory without a betting policy before it reaches the guard: it is run against a copy of the
  subject that has one, so a guard is what answers. Which guard it is: `standards check` calls
  `checkDecisions`, whose own guard speaks first, before the ledger is read. The subject has no ledger,
  so `checkDecisions` returns at its missing-ledger branch and never calls `checkLedger` or
  `checkRecord`. The sweep therefore **does** distinguish removal of `checkDecisions`' guard (the
  command would then succeed instead of refusing), and it does **not** reach `checkLedger`'s or
  `checkRecord`'s guard at all; those two are held by direct-call tests in
  `test/policy-authority.test.mjs`. What masks what is the betting policy, not the ledger: with a
  betting policy present, `gatherEvidence`'s guard is answered for by `checkDecisions`' on
  `validate`, `audit` and `status`, which is why their subject has none.
  The refusal is asserted **whole**. Exit 2 with empty stdout is also what a command returns when it
  says the guard's sentence and then carries on to a later missing-file, missing-policy or usage
  failure, and its stderr still contains the sentence; so stderr must equal the command's name and the
  guard's complete diagnostic, and nothing before or after it. Which guard is distinguished and which
  is not was measured by mutating each one separately (see the table below).
- **`ci/pipeline.json`.** Each stage is `npm run <script>` or `npm test` with no further token, so no
  argument slot exists; the runner's side of that is proved by execution under ST-03.
- **The adapter contract.** Its entrypoint must be a surface the CLI census classifies as refusing
  subjects, `{target}` is the only placeholder, its own declared invocation is *run* against a subject
  declaring `1.0.0` and must refuse silently, and against a current subject must return a status from
  the contract's vocabulary. That vocabulary must equal `STATUS` in `compliance.mjs`.
- **Workflow and container.** Every `run:` is the pipeline runner, and every `uses:` is one of three
  recorded actions (`actions/checkout`, `actions/setup-node`, `actions/upload-artifact`) pinned to a
  major version and given only its recorded inputs, with the artifact upload pointed only at the
  runner's own evidence record. A local, composite, Docker, unlisted or unpinned action, an
  unrecorded input, and a job `container:` or `services:` all fail. The actions are classified by
  that allowlist and by reading, not run: what third-party action code does inside GitHub's runner
  is not observed here, only that nothing outside the list can be added unnoticed. The scan is line
  based, so it is sound on one spelling of YAML only; it does not try to read the others, it **refuses**
  them: a flow mapping or flow `steps:`, a quoted or explicit key, an anchor, alias, tag or `<<` merge,
  a second document, a tab, or a continuation line is itself a failure, and the only flow values
  allowed are flat lists of plain words under a trigger-filter key (`on`, `branches`, `paths`, ...).
  Refusing is deliberate: `scripts/yaml.mjs` is a policy-file subset that cannot read the real
  workflow, so "could not parse" must never read as "found nothing". The image's only
  `RUN` is the known `apk add`, its `CMD` is the runner, and compose overrides no command.
- **Wrappers.** Classified by **reading**, and recorded as such: executing them needs Docker or a push.
  `test/local-ci.test.mjs` runs `submit-pr` against throwaway repositories; this file adds only a
  tripwire that no wrapper launches a surface that interprets a subject. That is weaker than running,
  and it is the one place this census still rests on inspection.

Mutations, each applied and reverted, each killed by the test named for it:

```text
stray .sh not classified / shebang under a data-looking name   scope + shebang tests
npm script composes a shell pipeline                           package.json sweep
npm script hands arguments to an inert surface                 package.json sweep
pipeline stage gains a {target} slot                           pipeline test
adapter entrypoint swapped to an inert script                  adapter test
adapter promises an extra status                               adapter test
new JSON file with a command key                               vocabulary test
workflow runs the validator on an input                        workflow/container test
workflow gains a local/Docker/third-party `uses:` step         workflow scan fixtures
workflow action given an unrecorded input or path              workflow scan fixtures
shebang under a .md/.json name exempted again                  shebang scan fixtures
package sweep runs the canonical argv, not the script's own    package sweep fixtures
Dockerfile gains a build step                                  workflow/container test
a wrapper calls the validator                                  wrapper tripwire
gatherEvidence's guard removed                                 package.json sweep only
```

The last row is the reason the sweep's subject carries no betting policy. With one, removing that
guard goes unnoticed on `validate`, `audit` and `status`, because `checkDecisions`' guard still
refuses with the same sentence. That masking is by `checkDecisions`, not by `checkLedger`.

Measured per guard, removing exactly one at a time and running `test/evidence-surface-census.test.mjs`
alone, then the whole suite for any that survived it:

```text
guard removed                         census file       whole suite
checkDecisions                        killed            killed
gatherEvidence (standards.mjs)        killed            killed
checkPolicy (policy.mjs)              killed            killed
evaluate (compliance.mjs)             killed            killed
checkLedger                           survived          killed by policy-authority.test.mjs
checkRecord                           survived          killed by policy-authority.test.mjs
command prints the guard, then more   killed (3 of 3: standards, policy, decisions)
guard message truncated               killed (tail dropped; body lines dropped)
```

`checkLedger` and `checkRecord` survive the census file because the subject has no ledger, and that is
a recorded limit of the sweep, not an oversight: they are unreachable from it.

Not covered: the semantics data (`rules/`, `schemas/`, policies) is classified as data on the ground
that nothing in it can run, and is not otherwise examined; a change of *meaning* in it is the baseline
and inventory tests' concern, not this census's.

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
delete checkPolicy's call site                the reviewer's exact specimen returns —
                                              `policy.non-exemptible-rule` by name, at a
                                              findings exit, not merely a changed exit code
delete checkLedger's call site                a direct import judges an external ledger
                                              under this checkout's rule ids
delete checkRecord's call site                a direct import judges an external record
delete evaluate's call site                   a 2.0.0 verdict for a policy declaring 1.0.0
add a module outside scripts/                 the census scope test fails
give ci-stages.mjs an export                  its inert-by-construction test fails
```

**One mutation had to be repaired rather than added.** `checkLedger`'s guard is character-identical
to `checkDecisions`', and the existing mutation removed the first match in the file — which became
`checkLedger`'s. It also stopped meaning anything on a populated ledger, because the second guard
answered it. Both halves are fixed: the pattern is anchored to `checkDecisions`' own refusal message,
and the fixture is a target with no ledger directory, which is the one path that early-returns before
`checkLedger` and so is the only path the first guard alone stands on. A mutation that keeps passing
as the code around it changes shape is not necessarily still proving what it was written to prove.

The last of those asserts the finding **by id** rather than by exit code, because a guard that
stopped the run for some unrelated reason would satisfy a code-only assertion while leaving the
attribution defect exactly where it was.

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

**Patch `policy.mjs` on its own.** The obvious response to the third review, and it would have left
the fourth door unfound. The finding was never really "policy.mjs is unguarded"; it was "the
inventory you are guarding from is assembled by hand." A one-off patch answers the specimen and
leaves the method that produced it intact.

**Accept a `standardVersion` string argument on `checkPolicy`.** Rejected for the reason
`checkDecisions` already takes a path: a caller that extracts the declaration and passes the result
has moved the reading of it outside the authority that acts on it. For a project policy the subject
IS the declaration, so the function simply opens what it was already given.

**A further mutation had to be narrowed rather than repaired.** With `evaluate` guarded,
`validate` no longer leaks when `gatherEvidence`'s guard is deleted — it refuses downstream instead.
`audit` and `status` still leak, because they report findings and dispositions without producing a
verdict and so never reach `evaluate`. The mutation now asserts exactly that asymmetry, and asserts
positively that `validate` still refuses. Narrowing an assertion is only honest when the reason is
traced; this one was.

**Leave `checkLedger` a primitive and correct only its recorded reason.** Tempting, because the
classification would then merely be under-justified rather than wrong, and `checkDecisions` already
guards the path that reaches it from any CLI. Rejected because `scripts/` has no `exports` map, so a
deep import is a real door, and because the acceptance property is about interpretation rather than
about how the interpretation was reached. A function that attributes this checkout's rule ids to
records it was handed is interpreting a subject under semantics the subject never declared, whether
it opened a catalog to do so or had the catalog written into it.

**A `trusted: true` / `selfCheckout: true` option on `checkDecisions`.** An exemption flag is a door
that reads as safe at every call site and is only wrong at one of them. Naming the pack's own
project policy costs one argument and cannot be misused, because supplying it is indistinguishable
from what every honest caller does.
