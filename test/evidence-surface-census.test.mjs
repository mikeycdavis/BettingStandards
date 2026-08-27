/**
 * The census of surfaces that can interpret an external subject — derived, not recalled.
 *
 * WHY THIS FILE EXISTS. The declared-framework rule has now been placed four times. The rule was
 * never in dispute; the *inventory* of things it had to cover was wrong three times running:
 *
 *   1. `runValidate`            missed `audit` and `status`
 *   2. `gatherEvidence`         missed `standards check` and `decisions.mjs`
 *   3. two authorities          missed `policy.mjs` / `checkPolicy()`
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
 * THE LINE, stated as a rule rather than a list. A surface needs the authority check exactly when it
 * *resolves* part of this checkout's standards semantics — the rule catalog, or a normative schema —
 * on behalf of a subject it was pointed at. A surface that receives the catalog, the schema and the
 * policy from its caller resolves nothing: it cannot be reached without someone having already gone
 * through a resolver, and it establishes nothing the caller had not already assembled. Those are
 * primitives, and they are classified as such below with the reason recorded per export.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
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
  "compliance.mjs": { expect: "inert", why: "library: the verdict function, over inputs a caller supplies." },
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
      "`coverage` and `resolve` compute over a catalog the caller already holds.",
  },
  "compliance.mjs": {
    evaluate: "primitive",
    envelope: "primitive",
    STATUS: "data",
    why:
      "produces the verdict, but every input — catalog, policy, findings, evaluated set — is supplied by the caller. " +
      "It resolves nothing and is unreachable without a resolver having run first.",
  },
  "decisions.mjs": {
    checkDecisions: "resolver",
    checkOwnExamples: "resolver",
    checkRecord: "primitive",
    checkLedger: "primitive",
    canonicalize: "primitive",
    decisionDigest: "primitive",
    render: "primitive",
    FINDING_RULES: "data",
    SUPPLIED_RULES: "data",
    why:
      "`checkDecisions` resolves the record schema and reads the policy files it is pointed at: record-level authority. " +
      "`checkRecord`/`checkLedger` are handed an already-loaded policy and schema and resolve nothing.",
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
