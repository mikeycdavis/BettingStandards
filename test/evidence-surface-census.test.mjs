/**
 * The census of surfaces that can interpret an external subject — derived, not recalled.
 *
 * WHY THIS FILE EXISTS. The declared-framework rule has now been placed four times. The rule was
 * never in dispute; the *inventory* of things it had to cover was wrong three times running:
 *
 *   1. `runValidate`            missed `audit` and `status`
 *   2. `gatherEvidence`         missed `standards check` and `decisions.mjs`
 *   3. two authorities          missed `policy.mjs` / `checkPolicy()`
 *   4. a derived census, two-case line   missed `checkLedger`, then `checkRecord` and `evaluate`
 *
 * Each time the inventory was assembled by reading the code and remembering what was in it, and each
 * time an external reviewer found a member of it that I had not listed. ADR 0009 asserted "exactly
 * two authorities produce evidence" and that assertion was false when it was written.
 *
 * A hand-built census cannot be trusted to be complete, and saying "I traced it carefully" is not
 * evidence — it is the same claim that was wrong the three previous times. So the census is derived
 * here instead: the CLI list comes from globbing `scripts/`, and the export list comes from importing
 * every module and reading what it actually exports. Adding a script, or adding an export to one,
 * fails this file until the new surface is classified.
 *
 * THE PROPERTY.
 *
 *   > No externally supplied subject may be interpreted using this checkout's standards semantics
 *   > until the subject's declared `standardVersion` has been established as exactly the executing
 *   > version.
 *
 * THE LINE, stated as a rule rather than a list. A surface needs the authority check when it
 * interprets a subject it was handed under semantics the subject did not supply. There are three
 * cases, not two, and the fourth review found the pack in the one nobody had looked in:
 *
 *   RESOLVES  it opens this checkout's rule catalog or a normative schema on behalf of a subject it
 *             was pointed at. `checkDecisions`, `checkPolicy`, `gatherEvidence`.
 *   EMBEDS    the rule ids it attributes, or the algebra it applies, are written into the function
 *             itself. What its caller supplies is inputs, not semantics. `checkRecord`, `checkLedger`,
 *             `evaluate`.
 *   TRANSFORMS it neither opens nor embeds: it moves data between shapes and attributes nothing.
 *             `canonicalize`, `decisionDigest`, `render`, `envelope`, `coverage`, all of `betmath`.
 *
 * RESOLVES and EMBEDS both carry the check; only TRANSFORMS does not. The distinction that matters
 * is not what a surface RECEIVES but whether it can establish a finding, disposition, score or
 * verdict about a subject with no authority named.
 *
 * REPORTING A NUMBER ABOUT A SUBJECT IS NOT JUDGING ONE, and the line runs between those rather than
 * around the word "coverage". `coverage` does report a figure about a subject — its `evaluated`
 * argument is subject-derived, and removing an adopting project's ledger takes `evaluatedRules` from
 * 41 to 6 — but it never sees a finding, a policy or a disposition, so it establishes nothing about
 * the subject's conduct. An earlier draft of this sentence listed "coverage figure" among the
 * triggers, which made the criterion contradict the classification three lines above it. The
 * exemption is no longer carried by this sentence either way: it is checked at the foot of the file.
 *
 * TWO WRONG LINES, BOTH RECORDED. The first was a dichotomy — resolve, or be handed — under which
 * `checkLedger` was a primitive on the ground that it "is handed an already-loaded policy and schema".
 * It is handed neither; its only parameter was the record list. The second kept the same "handed"
 * ground for `checkRecord` and `evaluate`, and review found both: `checkRecord` receives thresholds
 * and a shape while attributing thirteen rule ids of its own, and `evaluate` receives a catalog and
 * a policy while applying a verdict algebra of its own — to the very document carrying the
 * declaration it was ignoring. Its specimen was a 2.0.0 verdict for a policy declaring 1.0.0.
 *
 * The common defect in both is not the taxonomy: it is that "the caller supplied it" was accepted as
 * a reason without asking what the caller supplied. A reason recorded without being checked is not
 * better than no reason, so what is asserted below is behaviour — every surface classified as
 * carrying the check must actually refuse without a named authority.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = path.join(ROOT, "scripts");
const PACK_VERSION = readFileSync(path.join(ROOT, "VERSION"), "utf8").trim();
const EXIT_INVOCATION = 2;

const TEMPORARY = [];
process.on("exit", () => {
  for (const dir of TEMPORARY) rmSync(dir, { recursive: true, force: true });
});

async function cli(script, ...argv) {
  try {
    const { stdout, stderr } = await run(process.execPath, [script, ...argv]);
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
}

/**
 * Every file in `scripts/`, and what it must do when handed an external subject on its command line.
 *
 * NO DETECTION HEURISTIC. An earlier version of this table listed only the files it judged to "have
 * a command line", found by looking for an `argv[1]` guard in the source. That missed `fidelity.mjs`,
 * which has no such guard and runs on import — which is to say, the mechanism built to stop me
 * guessing at the inventory contained a guess at the inventory. Every `.mjs` in `scripts/` is listed
 * here now, and the directory is compared against these keys in both directions.
 *
 * `refuse`  the surface interprets an external subject and must exit 2 for one on another framework.
 * `inert`   the surface runs, but an external argument cannot change what it does. Proved by running
 *           it with and without one and requiring identical output — an exemption that rests on
 *           "there is no external subject here" is only honest while that stays true.
 */
const CLI_CENSUS = {
  "standards.mjs": {
    expect: "refuse",
    // `validate` stands for the family; the per-command sweep lives in framework-authority.test.mjs,
    // which derives its list from this CLI's own help output.
    argv: (target) => ["validate", target, "--json"],
  },
  "decisions.mjs": {
    expect: "refuse",
    argv: (target) => [
      "--dir", path.join(target, "ledger"),
      "--policy", path.join(target, "betting-policy.yml"),
      "--project-policy", path.join(target, "project-policy.yml"),
    ],
  },
  "policy.mjs": {
    expect: "refuse",
    argv: (target) => [path.join(target, "project-policy.yml")],
  },
  "inventory.mjs": { expect: "inert", why: "compares this repository's own standards documents against its own rule catalog." },
  "fidelity.mjs": { expect: "inert", why: "checks this repository's own rule text against its own standards documents." },
  "diagrams.mjs": { expect: "inert", why: "checks that this repository's own diagrams match its own pipeline definition." },
  "framework-version.mjs": { expect: "inert", why: "library: the authority check itself." },
  "betmath.mjs": { expect: "inert", why: "library: arithmetic." },
  "catalog.mjs": { expect: "inert", why: "library: loads this repository's own rule catalog." },
  "ci-stages.mjs": {
    expect: "inert",
    // Not run by the generic sweep, because running it against THIS checkout executes the real
    // eight-stage pipeline, which includes this suite, recursively. It is run by execution anyway,
    // in the dedicated tests at the foot of this file: the unmodified file is copied into a fixture
    // tree with a stub manifest and executed there, so the proof is behavioural and not recursive.
    exec: "fixture",
    why:
      "runs the pipeline declared in ci/pipeline.json against this repository. It reads process.argv " +
      "only for the boolean flags --verbose and --json and never takes a path, so no external subject " +
      "can reach it. Proved by execution in a fixture tree (see 'ci-stages.mjs, executed'), with the " +
      "source-property test kept only as a cheap tripwire.",
  },
  "compliance.mjs": { expect: "inert", why: "library: no command line. `evaluate` guards; see the export census." },
  "init.mjs": { expect: "inert", why: "library: bootstraps a new project, driven by `standards init`." },
  "jsonschema.mjs": { expect: "inert", why: "library: a validator." },
  "yaml.mjs": { expect: "inert", why: "library: a parser." },
};

/**
 * Every export of every script, classified. `resolver` means the surface resolves this checkout's
 * standards semantics for a subject it was handed and therefore carries the authority check.
 *
 * The reasons are recorded per entry rather than per group because the previous three inventories
 * were wrong in exactly the places where a group label had been applied without looking.
 */
const EXPORT_CENSUS = {
  "betmath.mjs": { all: "primitive", why: "arithmetic over numbers. Knows nothing of rules, policies or subjects." },
  "yaml.mjs": { all: "primitive", why: "a parser. Turns text into data and interprets nothing." },
  "jsonschema.mjs": { all: "primitive", why: "validates a supplied document against a supplied schema. Resolves neither." },
  "ci-stages.mjs": {
    all: "primitive",
    noImport: true,
    why:
      "the pipeline runner. NOT imported in-process here: it has no `argv[1] guard` and executes the " +
      "full eight-stage pipeline — this suite included — on import. Its export list is instead read " +
      "by execution: the unmodified file is imported inside a fixture tree with a stub manifest (see " +
      "'ci-stages.mjs, executed'), and must expose no export. It takes no path from argv (only " +
      "--verbose and --json) and has no external subject to interpret.",
  },
  "inventory.mjs": { all: "primitive", why: "`compare` takes two supplied inventories of this repository's own files." },
  "fidelity.mjs": { all: "primitive", why: "no exports. Checks this repository's own rule text against its own standards documents." },
  "diagrams.mjs": { all: "primitive", why: "no exports. Checks this repository's own diagrams against its own pipeline definition." },
  "framework-version.mjs": { all: "authority", why: "this IS the check. Reads a named project policy and the executing VERSION." },
  "init.mjs": { all: "primitive", why: "`plan`/`apply` write files into a new project. They establish no finding about an existing one." },
  "catalog.mjs": {
    loadCatalog: "loader",
    resolve: "primitive",
    coverage: "primitive",
    assertBindings: "primitive",
    CatalogError: "data",
    VALIDATION_TYPES: "data",
    ASSURANCE: "data",
    LEVELS: "data",
    SEVERITIES: "data",
    why:
      "`loadCatalog` resolves this checkout's semantics but is handed no subject, so it cannot attribute anything to one. " +
      "`resolve` computes over a catalog the caller already holds. `coverage` was recorded the same way, which was the " +
      "incomplete half of the truth: it also takes an `evaluated` list that IS subject-derived, and the figure moves 41 " +
      "to 6 with the subject's ledger. It stays exempt on the narrower ground that it is handed no finding, policy or " +
      "disposition and so judges nothing — and that ground is not left as prose. See the reachability check at the foot " +
      "of this file, where its output is asserted absent for an unauthorized subject and present for an authorized one.",
  },
  "compliance.mjs": {
    evaluate: "resolver",
    envelope: "primitive",
    STATUS: "data",
    why:
      "`evaluate` was classified primitive on the ground that every input is supplied by the caller. The inputs are; " +
      "the SEMANTICS are not. STATUS, the exception algebra, the prohibition ranking and the scoring live in this file, " +
      "and the `policy` it is handed is the very document carrying the declaration it was ignoring — review's specimen " +
      "was a 2.0.0 verdict returned for a policy declaring 1.0.0. It reads the declaration out of that document itself. " +
      "`envelope` formats a verdict it is handed and establishes nothing; it stamps a standardVersion its caller " +
      "supplies, which is a label rather than a judgement, and every path to it comes through a guarded evaluate. " +
      "That last clause is the one that carries the exemption, so it is checked rather than asserted at the foot of " +
      "this file: with the guards removed, the envelope stamps 1.0.0 onto a 2.0.0 verdict at score 96.",
  },
  "decisions.mjs": {
    checkDecisions: "resolver",
    checkOwnExamples: "resolver",
    checkLedger: "resolver",
    checkRecord: "resolver",
    canonicalize: "primitive",
    decisionDigest: "primitive",
    render: "primitive",
    FINDING_RULES: "data",
    SUPPLIED_RULES: "data",
    why:
      "`checkDecisions` resolves the record schema and reads the policy files it is pointed at: record-level authority. " +
      "`checkRecord` and `checkLedger` both EMBED: the thirteen rule ids the first attributes and the ledger reasoning " +
      "of the second are written into this file, so what the caller supplies — thresholds, a shape, a record list — is " +
      "not the evaluation semantics. Both take a named project policy and guard on it. `canonicalize`/`decisionDigest`/" +
      "`render` transform data and attribute nothing.",
  },
  "policy.mjs": {
    checkPolicy: "resolver",
    loadBettingPolicy: "primitive",
    coerceNumber: "primitive",
    BETTING_POLICY_NUMBERS: "data",
    why:
      "`checkPolicy` loads THIS checkout's rule catalog and applies `nonExemptible` to a policy document it was " +
      "pointed at — policy-level authority, and the surface the third review found. `loadBettingPolicy` validates " +
      "a config file's shape against a schema and produces no finding, disposition, score, coverage or verdict; " +
      "its only CLI reachability is through checkPolicy, which guards.",
  },
  "standards.mjs": {
    buildPlan: "primitive",
    EVALUATED_RULES: "data",
    why:
      "`buildPlan` previews: it classifies rules by what the project declares and produces no finding. " +
      "`gatherEvidence` is the project-level authority and is deliberately NOT exported.",
  },
};

function makeExternalTarget(version, { exceptRule } = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bs-census-"));
  TEMPORARY.push(dir);
  const exceptions = exceptRule
    ? `exceptions:\n  - rule: "${exceptRule}"\n    reason: "we would rather not"\n    approvedBy: "someone"\n    approvedAt: "2026-01-01"\n`
    : "exceptions: []\n";
  writeFileSync(
    path.join(dir, "project-policy.yml"),
    `standardVersion: "${version}"\nproject: "external-subject"\n${exceptions}`,
    "utf8",
  );
  return dir;
}

/* --------------------------------------------------------------------------------------------
 * The census is complete, because it is derived.
 * ------------------------------------------------------------------------------------------ */

test("every file in scripts/ is classified, and every classification names a real file", async () => {
  const onDisk = readdirSync(SCRIPTS).filter((f) => f.endsWith(".mjs"));
  assert.deepEqual(
    onDisk.filter((f) => !CLI_CENSUS[f]).sort(),
    [],
    "these scripts are not classified. A new file is a possible new door until somebody says what it " +
      "does with an external subject — which is the omission this file exists to prevent",
  );
  assert.deepEqual(
    Object.keys(CLI_CENSUS).filter((f) => !onDisk.includes(f)).sort(),
    [],
    "these classifications name a script that no longer exists",
  );
});

test("every export of every script is classified, and every classification names a real export", async () => {
  const files = readdirSync(SCRIPTS).filter((f) => f.endsWith(".mjs"));
  assert.deepEqual(
    files.filter((f) => !EXPORT_CENSUS[f]).sort(),
    [],
    "these modules are not in the export census",
  );

  const undeclared = [];
  const phantom = [];
  for (const file of files) {
    const entry = EXPORT_CENSUS[file];
    assert.ok(entry.why, `${file} is classified with no reason recorded`);
    if (entry.noImport || entry.all) continue; // classified wholesale, with the reason recorded above
    const module = await import(pathToFileURL(path.join(SCRIPTS, file)).href);
    const exported = Object.keys(module).sort();
    const classified = Object.keys(entry).filter((k) => k !== "why");
    for (const name of exported) if (!classified.includes(name)) undeclared.push(`${file}:${name}`);
    for (const name of classified) if (!exported.includes(name)) phantom.push(`${file}:${name}`);
  }
  assert.deepEqual(
    undeclared.sort(),
    [],
    "these exports exist and are unclassified. Say whether each resolves this checkout's standards " +
      "semantics for a subject it was handed, and if it does, give it the authority check and a test",
  );
  assert.deepEqual(phantom.sort(), [], "these classifications name exports that no longer exist");
});

test("every command line that takes an external subject refuses one on another framework version", async () => {
  // Behavioural, not documentary. The classification above says what each script should do; this
  // runs every one of them and checks that it does.
  const target = makeExternalTarget("1.0.0");
  writeFileSync(path.join(target, "betting-policy.yml"), readFileSync(path.join(ROOT, "betting-policy.yml"), "utf8"), "utf8");

  const leaked = [];
  for (const [file, spec] of Object.entries(CLI_CENSUS)) {
    if (spec.expect !== "refuse") continue;
    const { code, stdout } = await cli(path.join(SCRIPTS, file), ...spec.argv(target));
    if (code !== EXIT_INVOCATION) leaked.push(`${file} exited ${code}`);
    if (stdout.trim() !== "") leaked.push(`${file} printed output`);
  }
  assert.deepEqual(leaked, [], "these surfaces interpreted a subject declaring a framework this checkout is not");
});

test("an external subject cannot influence any surface classified as inert", async () => {
  // The stated reason, checked rather than trusted. These surfaces are exempt because there is no
  // external subject for them to interpret — so handing them one must change nothing at all. Running
  // each with and without the argument and comparing proves that, where asserting "it takes no
  // target" would only repeat the claim.
  //
  // This is what caught the previous version of this file: `fidelity.mjs` and `diagrams.mjs` accept
  // an argument and exit 0 rather than rejecting it. They ignore it, which is fine — but "it rejects
  // arguments" was not the true reason for the exemption, and a test asserting it was would have
  // been asserting something false about code it was meant to be checking.
  const target = makeExternalTarget("1.0.0");
  const subject = path.join(target, "project-policy.yml");
  for (const [file, spec] of Object.entries(CLI_CENSUS)) {
    if (spec.expect !== "inert") continue;
    assert.ok(spec.why, `${file} is exempt with no reason recorded`);
    // A surface that cannot be run against this checkout says so in its own entry and names where
    // it IS run. An excluded member of a census has to be visible in the census, not absent from it.
    if (spec.exec === "fixture") continue;
    const without = await cli(path.join(SCRIPTS, file));
    const with_ = await cli(path.join(SCRIPTS, file), subject);
    assert.equal(with_.code, without.code, `${file}: an external argument changed the exit code`);
    assert.equal(with_.stdout, without.stdout, `${file}: an external argument changed the output`);
  }
});

/* --------------------------------------------------------------------------------------------
 * The census's own SCOPE, which was itself asserted.
 *
 * Everything above derives the census by globbing `scripts/`. That is complete over the set it
 * looks at — and the set it looks at was chosen by hand, which is the exact shape of the three
 * inventory failures this file exists to prevent, moved up one level. A module added at
 * `lib/evaluator.mjs` would produce evidence and be invisible to every test here.
 *
 * So the scope is derived too: the repository is walked, and `scripts/` must be the only place
 * executable JavaScript lives. Adding code anywhere else fails this test until either the code
 * moves or this census is widened to cover it deliberately.
 * ------------------------------------------------------------------------------------------ */

test("scripts/ is the only place executable code lives, so globbing it is a complete census", () => {
  const IGNORED = new Set([".git", "node_modules", "test", "scripts"]);
  const strays = [];

  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (rel === "" && IGNORED.has(entry.name)) continue;
      const child = path.join(dir, entry.name);
      const childRel = rel === "" ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        walk(child, childRel);
      } else if (/\.(mjs|cjs|js)$/.test(entry.name)) {
        strays.push(childRel);
      }
    }
  };
  walk(ROOT, "");

  assert.deepEqual(
    strays.sort(),
    [],
    "executable code outside scripts/ is outside this census — classify it here, or move it in",
  );
});

/* --------------------------------------------------------------------------------------------
 * ci-stages.mjs: the one surface that cannot be run or imported by this suite, made mechanical.
 *
 * It has no `argv[1]` guard and runs the whole eight-stage pipeline — this suite included — on
 * import, so neither the behavioural sweep nor the export sweep can touch it. That left its
 * classification resting on prose, which is the thing this file was written to stop trusting.
 *
 * The disposition is instead established from two properties of the source that are checked here:
 * it exports nothing at all, and it never indexes `argv` — it consults it only through boolean
 * `.includes()` for two flags. A surface with no exports and no way to receive a path has no
 * external subject to interpret, and that is a fact about the file rather than a recollection.
 * ------------------------------------------------------------------------------------------ */

test("ci-stages.mjs is inert by construction: it exports nothing and can be handed no subject", () => {
  const source = readFileSync(path.join(SCRIPTS, "ci-stages.mjs"), "utf8");

  assert.deepEqual(
    source.match(/^\s*export\s/gm) ?? [],
    [],
    "an export would make it programmatically reachable, and this census cannot import it to check",
  );

  const argvUses = source.match(/process\.argv[^\n]*/g) ?? [];
  assert.deepEqual(
    argvUses,
    ["process.argv.slice(2);"],
    "argv must reach exactly one binding; any other use could carry a path in",
  );

  const consumed = source.match(/\bargs\b[^\n]*/g) ?? [];
  for (const use of consumed) {
    assert.match(
      use,
      /^args = process\.argv\.slice\(2\);$|args\.includes\("(--verbose|--json)"\)/,
      `args is consumed here in a way that could carry an external path: ${use.trim()}`,
    );
  }
});

/* --------------------------------------------------------------------------------------------
 * The GROUND of a primitive classification, checked rather than recorded.
 *
 * `checkLedger` was classified primitive on the recorded ground that it "is handed an already-loaded
 * policy and schema". It was handed neither. The prose was wrong and nothing was checking the prose,
 * so the classification survived a review that was looking straight at it.
 *
 * These two assertions pin the ground for the pair the mistake was made in: the surface said to
 * RECEIVE its semantics must actually accept them, and the surface said to EMBED them must actually
 * demand an authority.
 * ------------------------------------------------------------------------------------------ */

test("every surface classified as a resolver actually demands an authority", async () => {
  // THE GROUND, CHECKED. `checkRecord` was classified a primitive on the recorded ground that its
  // caller hands it policy and schema. It does take those — the prose was accurate about the
  // signature and wrong about what it implied, which is why checking the signature would not have
  // caught it. What matters is not what a surface RECEIVES but whether it can produce a finding
  // about a subject with no authority named, so that is what is asserted here.
  const { checkRecord, checkLedger } = await import(pathToFileURL(path.join(SCRIPTS, "decisions.mjs")).href);
  const { evaluate } = await import(pathToFileURL(path.join(SCRIPTS, "compliance.mjs")).href);

  await assert.rejects(
    () => checkLedger([], {}),
    /projectPolicyPath/,
    "checkLedger embeds this checkout's rule ids — it must demand a named authority",
  );
  await assert.rejects(
    () => checkRecord({ id: "x" }, { policy: {}, schema: {}, file: "x" }),
    /projectPolicyPath/,
    "checkRecord embeds this checkout's rule ids — a supplied betting policy is not an authority",
  );
  await assert.rejects(
    () => evaluate({ catalog: {}, policy: { standardVersion: "1.0.0" }, findings: [], evaluated: [] }),
    (error) => error.name === "WrongFramework",
    "evaluate embeds the verdict algebra and is handed the declaration — it must read it",
  );
});

/* --------------------------------------------------------------------------------------------
 * THE TRANSFORMS GROUND, CHECKED THE SAME WAY THE OTHERS ARE.
 *
 * `envelope` and `coverage` are the two surfaces classified TRANSFORMS that carry a subject's
 * numbers to a user. Until now their exemption rested on prose, and prose is what failed twice
 * here — "the caller supplied it" was accepted as a ground without asking what the caller supplied.
 * The claim is checkable, so it is checked.
 *
 * WHAT THEY ACTUALLY DO, traced rather than assumed:
 *
 *   `envelope` stamps a `standardVersion` its caller hands it onto a verdict its caller hands it.
 *   It derives nothing: `status`, `score`, `summary`, `assurance`, `denominator` and `results` are
 *   copied through. Handed a fabricated verdict it will happily format one — but so will an object
 *   literal, which is all it is. A guard here would stop nobody who already holds the verdict.
 *
 *   `coverage` is NOT the subject-independent constant its recorded ground implied. Its `evaluated`
 *   argument is subject-derived, and the trim in `gatherEvidence` moves the figure hard: measured on
 *   an adopting project, removing its ledger takes `evaluatedRules` from 41 to 6 and
 *   `fullyMachineRepresentedStandards` from 13 to 1. So it does report a number ABOUT a subject.
 *   What it does not do is judge one: it never sees a finding, a disposition or a policy, only rule
 *   metadata and a list of ids.
 *
 * SO THE PROPERTY IS REACHABILITY, NOT REFUSAL. Neither surface can establish authority — neither is
 * handed anything to establish it from — and adding a guard to either would be a guard placed
 * because a function is exported rather than because evidence is made there. What must hold instead
 * is that no user-visible transform output escapes for a subject whose authority was never
 * established. That is asserted below in both directions, because an assertion that output is absent
 * passes just as well when the output never appears at all.
 *
 * Reproduced red before it was written: with the guards in `standards.mjs`, `decisions.mjs`,
 * `policy.mjs` and `compliance.mjs` removed, `validate` on a subject declaring 1.0.0 returns an
 * envelope reading `"standardVersion": "1.0.0"` beside a 2.0.0-derived NON_COMPLIANT at score 96 and
 * a coverage figure of 41 — an unverified version claim attached to this checkout's own judgement.
 * ------------------------------------------------------------------------------------------ */

/** A complete adopting project, correct in every respect except the declaration line under test. */
function makeSubject(policyBody) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bs-transforms-"));
  TEMPORARY.push(dir);
  mkdirSync(path.join(dir, "ledger"));
  mkdirSync(path.join(dir, "standards"));
  cpSync(path.join(ROOT, "examples/ledger"), path.join(dir, "ledger"), { recursive: true });
  cpSync(
    path.join(ROOT, "standards/19-evaluation-of-the-betting-process.md"),
    path.join(dir, "standards/19-evaluation-of-the-betting-process.md"),
  );
  cpSync(path.join(ROOT, "betting-policy.yml"), path.join(dir, "betting-policy.yml"));
  writeFileSync(path.join(dir, "project-policy.yml"), policyBody, "utf8");
  return dir;
}

/** Anything only this checkout could have computed about the subject. */
const TRANSFORM_OUTPUT = /frameworkCoverage|cataloguedRules|evaluatedRules|fullyMachineRepresentedStandards|"score"|"standardVersion"/;

const CLI = path.join(SCRIPTS, "standards.mjs");

test("no transform output reaches a subject whose declared version was never established", async () => {
  const unauthorized = [
    ["declaring another framework version", `standardVersion: "1.0.0"\nproject: "stale"\nexceptions: []\n`],
    ["declaring no version at all", 'project: "unversioned"\nexceptions: []\n'],
  ];

  for (const [label, body] of unauthorized) {
    const dir = makeSubject(body);
    for (const command of ["validate", "status"]) {
      const result = await cli(CLI, command, dir, "--json");
      assert.equal(
        result.code,
        EXIT_INVOCATION,
        `${command} on a subject ${label} must refuse as a configuration error`,
      );
      assert.doesNotMatch(
        result.stdout,
        TRANSFORM_OUTPUT,
        `${command} on a subject ${label} emitted a figure this checkout computed about it — a ` +
          "transform was reached before the subject's authority was established",
      );
    }
  }
});

test("the same transform output is present for a subject that did establish its authority", async () => {
  // THE CONVERSE, and the reason it is here: the assertion above is that something is ABSENT, and
  // absence is satisfied by a pack that emits nothing at all, by a refusal for an unrelated reason,
  // or by a regex that matches nothing. This is the control that distinguishes a guard that works
  // from a test that cannot fail.
  const dir = makeSubject(`standardVersion: "${PACK_VERSION}"\nproject: "current"\nexceptions: []\n`);

  const validated = await cli(CLI, "validate", dir, "--json");
  assert.notEqual(validated.code, EXIT_INVOCATION, "the current subject must be evaluated, not refused");
  assert.match(validated.stdout, TRANSFORM_OUTPUT, "`envelope` must carry its figures for an authorized subject");
  assert.equal(
    JSON.parse(validated.stdout).standardVersion,
    PACK_VERSION,
    "and the version it stamps can only be the executing one, because every path to it is guarded",
  );

  const status = await cli(CLI, "status", dir, "--json");
  assert.equal(status.code, 0, "status on the current subject must succeed");
  assert.match(status.stdout, /evaluatedRules/, "`coverage` must report its figure for an authorized subject");
});

/* --------------------------------------------------------------------------------------------
 * ci-stages.mjs, EXECUTED (ST-03).
 *
 * The source-property test above is evidence about two properties of the text: no exports, and argv
 * never indexed. That is not behavioural proof, and it cannot notice a surface that becomes
 * evidence-producing by a route the regexes do not name (an environment variable, a file read, a new
 * flag spelled differently). So the file is also RUN.
 *
 * WHY THIS IS NOT RECURSIVE. Running ci-stages.mjs in this checkout runs the real pipeline, which
 * runs this suite. Its ROOT, though, is derived from its own location (`dirname/..`), so the
 * UNMODIFIED file is copied into a temporary tree beside a stub `ci/pipeline.json` and executed
 * there. Same bytes, different root, stubs for stages. No production code changed to allow it, and
 * no manifest-override input was added: an override would itself be an external input to the very
 * surface being shown to have none.
 *
 * WHAT "INERT" MEANS HERE, stated as observable behaviour: handing the runner any external subject
 * (as an argument in any spelling, as its working directory, as a file it is pointed at) changes
 * nothing: not the stages run, not the arguments those stages receive, not its exit code, its
 * output or its evidence record. And that record never carries a finding, disposition, score,
 * coverage figure or standards verdict, only a pipeline result.
 * ------------------------------------------------------------------------------------------ */

// Stage commands are plain tokens, never quoted strings: on Windows the runner spawns with
// `shell: true`, which joins the argument list with spaces and no quoting, so `node -e "..."` would
// not survive. The stub is a file instead; a stage whose id contains "fail" exits 3.
const STAGE_STUB =
  "const fs = require('fs');\n" +
  "fs.appendFileSync('stage.log', JSON.stringify([process.argv[2], process.argv.slice(3)]) + '\\n');\n" +
  "process.exit(process.argv[2].includes('fail') ? 3 : 0);\n";

function stubStage(id) {
  return { id, name: `Stub ${id}`, command: ["node", "stage-stub.cjs", id], why: "stub" };
}

/** A tree holding the real ci-stages.mjs and a stub manifest. Returns where to run it. */
function makeRunnerFixture(stages) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bs-cistages-"));
  TEMPORARY.push(dir);
  mkdirSync(path.join(dir, "scripts"));
  mkdirSync(path.join(dir, "ci"));
  cpSync(path.join(SCRIPTS, "ci-stages.mjs"), path.join(dir, "scripts", "ci-stages.mjs"));
  writeFileSync(path.join(dir, "ci", "pipeline.json"), JSON.stringify({ schemaVersion: "1.0.0", stages }), "utf8");
  writeFileSync(path.join(dir, "stage-stub.cjs"), STAGE_STUB, "utf8");
  return dir;
}

const RUNNER_ENV = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, CI_COMMIT_SHA: "fixture-sha", CI_BRANCH: "fixture" };

/** Run the fixture's runner. Returns exit code, normalised streams, evidence and stage log. */
async function runRunner(dir, argv = [], { cwd = dir } = {}) {
  let code = 0;
  let stdout = "";
  let stderr = "";
  try {
    ({ stdout, stderr } = await run(process.execPath, [path.join(dir, "scripts", "ci-stages.mjs"), ...argv], { cwd, env: RUNNER_ENV }));
  } catch (error) {
    stdout = error.stdout ?? "";
    stderr = error.stderr ?? "";
    code = error.code;
  }
  const evidencePath = path.join(dir, "artifacts", "local-ci", "latest.json");
  const evidence = existsSync(evidencePath) ? JSON.parse(readFileSync(evidencePath, "utf8")) : null;
  const stageLogPath = path.join(dir, "stage.log");
  const normalise = (t) => t.replace(/\d+ ms/g, "N ms").replace(/COMPLETED +\S+/g, "COMPLETED T");
  if (evidence) {
    for (const k of ["startedAt", "completedAt", "durationMs"]) delete evidence[k];
    for (const c of evidence.checks) delete c.durationMs;
  }
  return {
    code,
    stdout: normalise(stdout),
    stderr,
    evidence,
    stageLog: existsSync(stageLogPath) ? readFileSync(stageLogPath, "utf8") : "",
    poisoned: existsSync(path.join(dir, "poison.marker")),
  };
}

function resetRunner(dir) {
  for (const p of ["stage.log", "artifacts", "poison.marker"]) rmSync(path.join(dir, p), { recursive: true, force: true });
}

/** Every way of handing the runner an external subject that we can think of, plus the generic ones. */
function externalSubjectArgvs(subjectDir) {
  const policy = path.join(subjectDir, "project-policy.yml");
  const rogue = path.join(subjectDir, "rogue-pipeline.json");
  return [
    [policy],
    [subjectDir],
    [rogue],
    ["--policy", policy, "--project-policy", policy],
    ["--manifest", rogue, "--pipeline", rogue, "--config", rogue],
    ["--dir", subjectDir, "--record", policy],
    ["--verbose", policy, "--json", rogue],
    [`--manifest=${rogue}`, `--root=${subjectDir}`],
  ];
}

/** A subject declaring another framework version, and a rogue manifest that would leave a marker. */
function makeRunnerSubject(fixture) {
  const dir = makeExternalTarget("1.0.0");
  writeFileSync(
    path.join(fixture, "poison.cjs"),
    "require('fs').writeFileSync(require('path').join(__dirname, 'poison.marker'), 'x');\n",
    "utf8",
  );
  const rogue = {
    schemaVersion: "1.0.0",
    stages: [
      {
        id: "poison",
        name: "Poison",
        command: ["node", "poison.cjs"],
      },
    ],
  };
  writeFileSync(path.join(dir, "rogue-pipeline.json"), JSON.stringify(rogue), "utf8");
  return dir;
}

test("ci-stages.mjs, executed: an external subject in any spelling changes nothing it does", async () => {
  const fixture = makeRunnerFixture([stubStage("alpha"), stubStage("beta")]);
  const subject = makeRunnerSubject(fixture);

  const baseline = await runRunner(fixture);
  assert.equal(baseline.code, 0, `the fixture pipeline must pass untouched: ${baseline.stderr}`);
  assert.equal(baseline.evidence.result, "passed");
  assert.deepEqual(
    baseline.stageLog.trim().split("\n").map((l) => JSON.parse(l)),
    [["alpha", []], ["beta", []]],
    "control: both declared stages ran, and received no arguments",
  );

  for (const argv of externalSubjectArgvs(subject)) {
    resetRunner(fixture);
    const got = await runRunner(fixture, argv);
    const label = argv.join(" ");
    assert.equal(got.code, baseline.code, `exit code changed for: ${label}`);
    assert.equal(got.poisoned, false, `a subject-named manifest was executed for: ${label}`);
    assert.equal(got.stageLog, baseline.stageLog, `stages or their arguments changed for: ${label}`);
    assert.deepEqual(got.evidence, baseline.evidence, `evidence record changed for: ${label}`);
    // --verbose and --json are the two recognised flags and legitimately change PRESENTATION only.
    if (!argv.includes("--verbose") && !argv.includes("--json")) {
      assert.equal(got.stdout, baseline.stdout, `output changed for: ${label}`);
    }
  }
});

test("ci-stages.mjs, executed: its working directory is not a subject either", async () => {
  const fixture = makeRunnerFixture([stubStage("alpha")]);
  const subject = makeRunnerSubject(fixture);
  const baseline = await runRunner(fixture);
  resetRunner(fixture);
  const fromSubject = await runRunner(fixture, [], { cwd: subject });
  assert.equal(fromSubject.code, 0);
  assert.deepEqual(fromSubject.evidence, baseline.evidence, "running from a subject's directory changed the record");
  assert.equal(fromSubject.stageLog, baseline.stageLog);
});

test("ci-stages.mjs, executed: its record carries a pipeline result and nothing about a subject", async () => {
  const fixture = makeRunnerFixture([stubStage("alpha"), stubStage("beta-fail"), stubStage("gamma")]);
  const subject = makeRunnerSubject(fixture);

  for (const argv of [[], ...externalSubjectArgvs(subject).slice(0, 2)]) {
    resetRunner(fixture);
    const got = await runRunner(fixture, argv);
    assert.equal(got.code, 1, "a failing stage is a failing run");
    assert.deepEqual(
      Object.keys(got.evidence).sort(),
      ["branch", "checks", "commit", "environment", "failedStage", "imageId", "node", "repository", "result", "schemaVersion"],
      "the record's keys are a closed set; a new one is a new thing it can say and needs classifying here",
    );
    assert.deepEqual(
      got.evidence.checks.map((c) => [c.id, c.result]),
      [["alpha", "passed"], ["beta-fail", "failed"], ["gamma", "not-run"]],
      "fail fast, and a stage that did not run is never recorded as passed",
    );
    for (const c of got.evidence.checks) {
      assert.deepEqual(Object.keys(c).filter((k) => !["id", "name", "command", "result", "exitCode"].includes(k)), []);
    }
    assert.doesNotMatch(
      JSON.stringify(got.evidence) + got.stdout,
      /standardVersion|"score"|frameworkCoverage|evaluatedRules|disposition|finding|NON_COMPLIANT|COMPLIANT/,
      "the runner said something about a subject's conduct",
    );
    assert.equal(got.stageLog.includes("gamma"), false, "a stage after the failure ran");
  }
});

test("ci-stages.mjs, executed: an unreadable manifest is an invocation fault with no record", async () => {
  const fixture = makeRunnerFixture([stubStage("alpha")]);
  writeFileSync(path.join(fixture, "ci", "pipeline.json"), "{ not json", "utf8");
  const got = await runRunner(fixture);
  assert.equal(got.code, EXIT_INVOCATION);
  assert.equal(got.evidence, null, "a run that never started must not leave a result behind");
  assert.equal(got.stageLog, "");
});

test("ci-stages.mjs, executed: imported, it exposes no export (the export census, by execution)", async () => {
  const fixture = makeRunnerFixture([stubStage("alpha")]);
  const out = path.join(fixture, "exports.json");
  const probe = path.join(fixture, "probe.mjs");
  // Importing it RUNS it (there is no argv[1] guard), which is why this happens in the fixture. The
  // namespace is read as soon as the import settles and written to a file, not stdout, because the
  // runner calls process.exit when its pipeline completes.
  writeFileSync(
    probe,
    `import { writeFileSync } from "node:fs";\n` +
      `const ns = await import(${JSON.stringify(pathToFileURL(path.join(fixture, "scripts", "ci-stages.mjs")).href)});\n` +
      `writeFileSync(${JSON.stringify(out)}, JSON.stringify({ keys: Object.keys(ns), default: "default" in ns }));\n`,
    "utf8",
  );
  await run(process.execPath, [probe], { cwd: fixture, env: RUNNER_ENV }).catch(() => {});
  assert.ok(existsSync(out), "the import did not settle before the runner exited, so the namespace was never read");
  assert.deepEqual(JSON.parse(readFileSync(out, "utf8")), { keys: [], default: false });
  assert.ok(
    existsSync(path.join(fixture, "stage.log")),
    "control: importing it did run the pipeline, so the fixture is exercising the real behaviour",
  );
});

test("ci-stages.mjs, executed: the fixture runs the shipped file, byte for byte", () => {
  const fixture = makeRunnerFixture([stubStage("alpha")]);
  assert.equal(
    readFileSync(path.join(fixture, "scripts", "ci-stages.mjs"), "utf8"),
    readFileSync(path.join(SCRIPTS, "ci-stages.mjs"), "utf8"),
    "an executed proof about a copy that differs from the shipped file proves nothing about it",
  );
});

/* --------------------------------------------------------------------------------------------
 * BEYOND JAVASCRIPT (ST-04).
 *
 * Everything above derives the census from `.mjs`/`.cjs`/`.js`. That left a class of surface that
 * had never been asked whether it can establish a finding, disposition, score or verdict about an
 * external subject with no authority named: files that are not JavaScript but SELECT or LAUNCH
 * JavaScript (`package.json` scripts, `ci/pipeline.json`, the adapter contract, the workflow, the
 * container recipe, the shell and PowerShell wrappers) and files that supply SEMANTICS (rules,
 * schemas, policies).
 *
 * THE QUESTION IS THE SAME ONE, so the answer has the same shape. A file that is data cannot judge
 * anything; what it can do is NAME a command, and a command is only as safe as the JavaScript surface
 * it reaches, which is already classified above. So three things are derived and checked here, none
 * of them recalled:
 *
 *   1. SCOPE. The repository is walked and EVERY file must be classified, not only the ones with an
 *      extension somebody thought to list. A file with a shebang must be a classified wrapper
 *      whatever it is called, so renaming a script cannot hide it.
 *   2. REACH. Every command a non-JS file can name must resolve to a surface classified above, with
 *      no slot through which a subject could be handed in, except the one place a subject is
 *      meant to arrive (the adapter's `{target}`), which is run and must refuse without authority.
 *   3. VOCABULARY. Command-bearing keys exist only in the files classified as command manifests, so
 *      a new JSON file that starts launching things fails here until somebody classifies it.
 *
 * WHAT IS CLASSIFIED BY READING, AND SAY SO: the shell and PowerShell wrappers. Executing them needs
 * Docker or a push, which a unit suite cannot do; test/local-ci.test.mjs exercises submit-pr by
 * running it against throwaway repositories, and this file adds a mechanical tripwire that they
 * name no surface which interprets a subject. That is weaker than running and is recorded as such.
 * ------------------------------------------------------------------------------------------ */

/** Ordered: the first match wins. `kind` selects which checks below apply. */
const NON_JS_CENSUS = [
  { kind: "package-manifest", match: /^package\.json$/, why: "scripts and bin: names commands, takes no subject itself." },
  { kind: "pipeline-manifest", match: /^ci\/pipeline\.json$/, why: "the stage list. Each stage is an npm script of this repository with no argument slot." },
  { kind: "adapter-contract", match: /^standards-adapter\.json$/, why: "how an enforcer invokes this pack. The one place a subject (`{target}`) is meant to arrive." },
  { kind: "workflow", match: /^\.github\/workflows\/[^/]+\.ya?ml$/, why: "runs the pipeline runner and nothing else." },
  { kind: "container-recipe", match: /^(Dockerfile\.ci|compose\.ci\.yml|\.dockerignore)$/, why: "builds the CI image and runs the pipeline runner." },
  { kind: "wrapper", match: /^scripts\/[^/]+\.(sh|ps1)$/, why: "orchestrates docker, git and gh around the pipeline. Names no surface that interprets a subject." },
  {
    kind: "semantics-data",
    match: /^(rules\/[^/]+\.json|schemas\/[^/]+\.json|betting-policy\.yml|project-policy\.yml|artifacts\/standards-source-inventory\.json|standards-adapter\.json)$/,
    why: "data that the guarded loaders read. A file cannot judge a subject; what reads it can, and is classified above.",
  },
  { kind: "template-or-example", match: /^(templates|examples)\//, why: "copied into adopting projects, or worked examples read by the guarded checks." },
  { kind: "fixture", match: /^test\/fixtures\//, why: "test inputs." },
  { kind: "prose", match: /\.(md|mmd)$|^(VERSION|\.gitignore|\.gitattributes)$|^standards\/|^design\//, why: "documentation and metadata. Not read as input to any evaluation." },
];

/** `artifacts/local-ci/` is transient output the pipeline writes; it is gitignored and not source. */
const WALK_SKIP = new Set([".git", "node_modules", "local-ci"]);

function walkAll(dir = ROOT, rel = "") {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (WALK_SKIP.has(entry.name)) continue;
    const childRel = rel === "" ? entry.name : `${rel}/${entry.name}`;
    if (entry.isDirectory()) files.push(...walkAll(path.join(dir, entry.name), childRel));
    else files.push(childRel);
  }
  return files;
}

const JS_FILE = /\.(mjs|cjs|js)$/;
const kindOf = (rel) => NON_JS_CENSUS.find((e) => e.match.test(rel))?.kind ?? null;
const readRel = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
const filesOfKind = (kind) => walkAll().filter((f) => kindOf(f) === kind);

test("beyond JS: every file in the repository is classified, and every classification matches a file", () => {
  const all = walkAll();
  const unclassified = all.filter((f) => !JS_FILE.test(f) && kindOf(f) === null);
  assert.deepEqual(
    unclassified.sort(),
    [],
    "these files are not classified. A new file that is not JavaScript can still name or launch JavaScript, " +
      "so it needs a kind here, and a kind's checks apply to it",
  );
  const phantom = NON_JS_CENSUS.filter((e) => !all.some((f) => e.match.test(f))).map((e) => String(e.match));
  assert.deepEqual(phantom, [], "these classifications match no file");
  for (const e of NON_JS_CENSUS) assert.ok(e.why, `${e.kind} is classified with no reason recorded`);
});

test("beyond JS: anything with a shebang is a classified wrapper or JavaScript, whatever it is called", () => {
  const stray = [];
  for (const f of walkAll()) {
    if (JS_FILE.test(f) || /\.(md|json)$/.test(f)) continue;
    const head = readFileSync(path.join(ROOT, f)).subarray(0, 2).toString("latin1");
    if (head === "#!" && kindOf(f) !== "wrapper") stray.push(`${f} (${kindOf(f)})`);
  }
  assert.deepEqual(stray, [], "an executable script is hiding under a kind that implies it is data");
});

test("beyond JS: command-bearing keys exist only in files classified as command manifests", () => {
  const COMMAND_KEYS = new Set(["command", "commands", "arguments", "entrypoint", "script", "scripts", "run", "exec", "bin", "hooks"]);
  const found = (value, file, out = []) => {
    if (Array.isArray(value)) value.forEach((v) => found(v, file, out));
    else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        if (COMMAND_KEYS.has(k)) out.push(`${file}:${k}`);
        found(v, file, out);
      }
    }
    return out;
  };
  const carriers = new Set(["package-manifest", "pipeline-manifest", "adapter-contract"]);
  const unexpected = [];
  for (const f of walkAll().filter((x) => x.endsWith(".json"))) {
    if (carriers.has(kindOf(f))) continue;
    unexpected.push(...found(JSON.parse(readRel(f)), f));
  }
  assert.deepEqual(unexpected, [], "a JSON file launches commands but is not classified as a command manifest");

  const yamlLaunchers = [];
  for (const f of walkAll().filter((x) => /\.ya?ml$/.test(x))) {
    if (["workflow", "container-recipe"].includes(kindOf(f))) continue;
    if (/^\s*(run|command|entrypoint|script):/m.test(readRel(f))) yamlLaunchers.push(f);
  }
  assert.deepEqual(yamlLaunchers, [], "a YAML file launches commands but is not classified as a launcher");

  // The control: the carriers do carry them, so the scan above is looking at something real.
  for (const f of ["package.json", "ci/pipeline.json", "standards-adapter.json"]) {
    assert.ok(found(JSON.parse(readRel(f)), f).length > 0, `${f} should carry a command key`);
  }
});

/** What an npm script runs, parsed strictly: anything it cannot parse is a failure, not a pass. */
function parseNpmScript(name, command) {
  assert.doesNotMatch(command, /[;&|`$<>(){}]/, `package.json script '${name}' composes shell commands: ${command}`);
  const tokens = command.trim().split(/\s+/);
  assert.equal(tokens[0], "node", `package.json script '${name}' does not run node: ${command}`);
  if (tokens[1] === "--test") return { file: null, args: tokens.slice(2), testRunner: true };
  assert.match(tokens[1], /^scripts\/[\w-]+\.mjs$/, `package.json script '${name}' runs something outside scripts/: ${command}`);
  return { file: tokens[1].slice("scripts/".length), args: tokens.slice(2), testRunner: false };
}

const VERDICT_VOCABULARY = /"score"|"standardVersion"|NON_COMPLIANT|COMPLIANT|"verdict"|frameworkCoverage|evaluatedRules/;

test("beyond JS: every package.json script reaches a classified surface, and run on an external subject it refuses or says nothing", async () => {
  const pkg = JSON.parse(readRel("package.json"));
  // No betting policy and no ledger, on purpose: the other authorities (records, policy, verdict) have
  // nothing to open here, so the refusal can only come from the project-level guard. With a betting
  // policy present, removing that guard goes unnoticed because a second guard answers for it (ADR 0009).
  const target = makeExternalTarget("1.0.0");

  // `bin` is a second way in; it must name a classified script too.
  for (const [name, file] of Object.entries(pkg.bin ?? {})) {
    assert.match(file, /^scripts\/[\w-]+\.mjs$/, `bin '${name}' points outside scripts/`);
    assert.ok(CLI_CENSUS[file.slice("scripts/".length)], `bin '${name}' names an unclassified script`);
  }

  const VERDICT_BEARING = new Set(["status", "check", "audit", "validate"]);
  const ran = [];
  for (const [name, command] of Object.entries(pkg.scripts)) {
    const { file, args, testRunner } = parseNpmScript(name, command);
    if (testRunner) {
      assert.deepEqual(args, ["test/*.test.mjs"], `'${name}' runs a test set other than this repository's own suite`);
      continue;
    }
    const spec = CLI_CENSUS[file];
    assert.ok(spec, `package.json script '${name}' reaches '${file}', which the CLI census does not classify`);
    const script = path.join(SCRIPTS, file);

    if (spec.expect === "inert") {
      // An inert surface takes no subject, so the script that launches it must not carry a slot for one.
      assert.deepEqual(args, [], `'${name}' hands arguments to '${file}', which is classified as taking none`);
      continue;
    }

    // A surface that interprets subjects: run the script's own command with the subject put where
    // the script's own target goes (`.`, or appended where the script has none).
    const withTarget = args.includes(".") ? args.map((a) => (a === "." ? target : a)) : [...args, target];
    if (file === "standards.mjs") {
      const sub = args[0];
      if (sub === "init") withTarget.push("--dry-run");
      const { code, stdout } = await cli(script, ...withTarget, ...(sub === "explain" ? [] : ["--json"]));
      if (VERDICT_BEARING.has(sub)) {
        assert.equal(code, EXIT_INVOCATION, `package script '${name}' did not refuse a subject declaring another framework`);
        assert.equal(stdout.trim(), "", `package script '${name}' printed output for a subject with no authority`);
      } else {
        // plan / explain / init preview or look up; ADR 0009 keeps them working. What they must never do is
        // carry a verdict or a figure about the subject.
        assert.doesNotMatch(stdout, VERDICT_VOCABULARY, `package script '${name}' emitted a verdict-shaped figure about a subject`);
      }
    } else {
      const { code, stdout } = await cli(script, ...spec.argv(target));
      assert.equal(code, EXIT_INVOCATION, `package script '${name}' (${file}) did not refuse an external subject`);
      assert.equal(stdout.trim(), "");
    }
    ran.push(name);
  }
  // The control: the sweep reached the verdict-bearing scripts, so a loop that skipped everything fails.
  for (const must of ["validate", "audit", "status", "check", "plan", "policy"]) {
    assert.ok(ran.includes(must), `the package.json sweep never ran '${must}'`);
  }
});

test("beyond JS: ci/pipeline.json stages are this repository's own npm scripts with no slot for a subject", () => {
  const pkg = JSON.parse(readRel("package.json"));
  const manifest = JSON.parse(readRel("ci/pipeline.json"));
  const ids = manifest.stages.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "stage ids must be unique");

  for (const stage of manifest.stages) {
    const [npm, verb, script, ...extra] = stage.command;
    assert.equal(npm, "npm", `stage '${stage.id}' does not run npm: ${stage.command.join(" ")}`);
    assert.deepEqual(extra, [], `stage '${stage.id}' passes arguments, which is a slot a subject could arrive through`);
    const scriptName = verb === "test" ? "test" : verb === "run" ? script : null;
    assert.ok(scriptName && pkg.scripts[scriptName], `stage '${stage.id}' names an npm script that does not exist: ${stage.command.join(" ")}`);
    assert.ok(verb === "test" ? script === undefined : true, `stage '${stage.id}' has stray tokens`);
    // It resolves to a surface the census classifies (parseNpmScript fails on anything it cannot read).
    const parsed = parseNpmScript(scriptName, pkg.scripts[scriptName]);
    if (!parsed.testRunner) assert.ok(CLI_CENSUS[parsed.file], `stage '${stage.id}' reaches an unclassified script '${parsed.file}'`);
    assert.doesNotMatch(JSON.stringify(stage), /\{target\}|\$\{|%\w+%/, `stage '${stage.id}' has a placeholder a subject could fill`);
  }
  // The runner passes a stage nothing beyond this list. That is proved by execution in the tests above
  // ('an external subject in any spelling changes nothing it does': every stage received no arguments).
});

test("beyond JS: the adapter contract refuses an external subject without authority, and speaks only this pack's vocabulary", async () => {
  const adapter = JSON.parse(readRel("standards-adapter.json"));
  const { STATUS } = await import(pathToFileURL(path.join(SCRIPTS, "compliance.mjs")).href);

  // Derived link to the CLI census: the entrypoint is a surface classified as refusing subjects.
  const entry = adapter.evaluation.entrypoint;
  assert.match(entry, /^scripts\/[\w-]+\.mjs$/);
  assert.equal(CLI_CENSUS[entry.slice("scripts/".length)]?.expect, "refuse", "the adapter's entrypoint must be a surface that demands an authority");

  // `{target}` is the only slot, and appears exactly once.
  const slots = adapter.evaluation.arguments.filter((a) => a.includes("{"));
  assert.deepEqual(slots, ["{target}"], "the contract has a placeholder other than {target}, or none");

  const argvFor = (dir) => adapter.evaluation.arguments.map((a) => (a === "{target}" ? dir : a));

  // Run as declared, on a subject declaring another framework: refuse, say nothing.
  const stale = makeSubject(`standardVersion: "1.0.0"\nproject: "stale"\nexceptions: []\n`);
  const refused = await cli(path.join(ROOT, entry), ...argvFor(stale));
  assert.equal(refused.code, EXIT_INVOCATION, "the adapter's own invocation judged a subject with no authority");
  assert.equal(refused.stdout.trim(), "", "and emitted something about it");

  // And with authority established it evaluates, with a status from the declared vocabulary: the control.
  const current = makeSubject(`standardVersion: "${PACK_VERSION}"\nproject: "current"\nexceptions: []\n`);
  const evaluated = await cli(path.join(ROOT, entry), ...argvFor(current));
  assert.notEqual(evaluated.code, EXIT_INVOCATION, "the adapter's invocation refused a subject that did establish authority");
  assert.ok(adapter.result.statuses.includes(JSON.parse(evaluated.stdout).status), "the result's status is outside the contract's own vocabulary");

  // The vocabulary is this pack's, not a second one. A contract that promised a status the evaluator
  // cannot produce, or that passes one it never defined, would let an enforcer report a verdict nobody gave.
  assert.deepEqual([...adapter.result.statuses].sort(), Object.values(STATUS).sort(), "contract statuses differ from compliance.mjs STATUS");
  for (const passing of adapter.result.passing) assert.ok(adapter.result.statuses.includes(passing), `'${passing}' is passing but not a declared status`);
});

test("beyond JS: the workflow and container recipe run the pipeline runner and nothing that interprets a subject", () => {
  for (const f of filesOfKind("workflow")) {
    const runs = [...readRel(f).matchAll(/^\s*(?:-\s*)?run:\s*(.+)$/gm)].map((m) => m[1].trim());
    assert.ok(runs.length > 0, `${f}: control — it should have a run step`);
    for (const r of runs) {
      assert.match(r, /^node scripts\/ci-stages\.mjs( --verbose| --json)*$|^\.\/scripts\/ci\.sh$/, `${f} runs something other than the pipeline runner: ${r}`);
    }
  }
  const docker = readRel("Dockerfile.ci");
  const dockerRuns = [...docker.matchAll(/^RUN\s+(.+)$/gm)].map((m) => m[1].trim());
  assert.deepEqual(dockerRuns, ["apk add --no-cache git"], "the CI image runs a build step that is not the known one");
  assert.match(docker, /^CMD \["node", "scripts\/ci-stages\.mjs"\]$/m, "the image's default command is not the pipeline runner");
  const compose = readRel("compose.ci.yml");
  for (const m of compose.matchAll(/^\s+(?:command|entrypoint):\s*(.+)$/gm)) {
    assert.fail(`compose.ci.yml overrides the container command: ${m[1]}`);
  }
});

test("beyond JS: the wrappers name no surface that interprets a subject (classified by reading, and said so)", () => {
  const wrappers = filesOfKind("wrapper");
  assert.ok(wrappers.length >= 4, "control: ci.sh, ci.ps1, submit-pr.sh and submit-pr.ps1 should all be found");
  const interpreters = Object.entries(CLI_CENSUS).filter(([, s]) => s.expect === "refuse").map(([f]) => f.replace(/\./g, "\\."));
  const reaches = new RegExp(`scripts[\\\\/](${interpreters.join("|")})|\\bnpm (run|test)\\b|\\bstandards (validate|audit|status|check)\\b`);
  for (const f of wrappers) {
    // Comments are prose: only executable lines count (PowerShell block comments are stripped first).
    const code = readRel(f)
      .replace(/<#[\s\S]*?#>/g, "")
      .split(/\r?\n/)
      .filter((l) => !/^\s*#/.test(l))
      .join("\n");
    assert.doesNotMatch(code, reaches, `${f} launches a surface that interprets a subject`);
  }
});
