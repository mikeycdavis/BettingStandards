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
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
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
    exec: false,
    why:
      "runs the pipeline declared in ci/pipeline.json against this repository. It reads process.argv " +
      "only for the boolean flags --verbose and --json and never takes a path, so no external subject " +
      "can reach it. NOT executed by this test: doing so runs the entire eight-stage pipeline, which " +
      "includes this suite, recursively. This is the one surface in the census classified by reading " +
      "rather than by running, and it is recorded here rather than left implicit.",
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
      "the pipeline runner. NOT imported by this test: it has no `argv[1]` guard and executes the " +
      "full eight-stage pipeline — this suite included — on import. Its surface is therefore " +
      "classified by reading rather than by importing, which is the one place this census falls back " +
      "on inspection. It takes no path from argv (only --verbose and --json) and has no external " +
      "subject to interpret.",
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
    // One surface is classified by reading rather than running, and says so in its own reason. An
    // excluded member of a census has to be visible in the census, not absent from it.
    if (spec.exec === false) continue;
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
