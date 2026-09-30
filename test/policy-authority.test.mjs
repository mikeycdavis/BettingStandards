/**
 * The policy evaluator is the third authority, and it was missed by a census that claimed to be
 * complete.
 *
 * THE SPECIMEN, measured before this fix. An external project policy declaring `standardVersion:
 * "1.0.0"`, carrying an exception against a rule THIS checkout's catalog marks non-exemptible:
 *
 *   node scripts/policy.mjs <external-project-policy>
 *   → policy.non-exemptible-rule: 'bankroll.no-chasing-losses' is non-exemptible ...
 *   → 1 compliance finding(s), exit 1
 *
 * Exit 1 is a findings exit. The 2.0.0 catalog was loaded, applied to a subject that declared 1.0.0,
 * and produced a rule-bound finding about it — the same false attribution as the two doors before,
 * with a different kind of evidence coming out of it. `checkPolicy` reaches none of `gatherEvidence`
 * or `checkDecisions`; it loads the catalog itself.
 *
 * WHY IT IS THE SAME DEFECT AND NOT A NEW ONE. `nonExemptible` is a property of a rule in a
 * versioned catalog. Which rules are non-exemptible is exactly the kind of thing a major version may
 * change, and a finding derived from it is a statement about the subject made under this checkout's
 * semantics. Whether the finding happens to be *correct* under 1.0.0 as well is not the point: it was
 * not established by a framework the subject authorized.
 *
 * PROVENANCE, following the rule already established for `checkDecisions`: the authority is read from
 * a project-policy document, never accepted as a version string from the caller. For a project policy
 * the subject IS the declaration, so nothing extra is passed — the function opens what it was already
 * given. For a betting policy, which declares no framework, the governing project policy must be
 * named. Nothing walks upward and nothing infers ownership from filesystem shape.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { checkPolicy } from "../scripts/policy.mjs";
import { loadCatalog } from "../scripts/catalog.mjs";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POLICY_CLI = path.join(ROOT, "scripts/policy.mjs");
const PROJECT_SCHEMA = path.join(ROOT, "schemas/project-policy.schema.json");
const BETTING_SCHEMA = path.join(ROOT, "schemas/betting-policy.schema.json");
const PACK_VERSION = readFileSync(path.join(ROOT, "VERSION"), "utf8").trim();
const TODAY = "2026-08-27";
const EXIT_INVOCATION = 2;

const TEMPORARY = [];
process.on("exit", () => {
  for (const dir of TEMPORARY) rmSync(dir, { recursive: true, force: true });
});

/** The first rule this checkout's catalog marks non-exemptible — read, not hardcoded. */
const NON_EXEMPTIBLE = await (async () => {
  const catalog = await loadCatalog();
  for (const rule of catalog.rules.values()) if (rule.nonExemptible) return rule.id;
  throw new Error("the catalog defines no non-exemptible rule; this specimen cannot be built");
})();

/**
 * The reviewer's specimen: a policy that is well-formed, declares a framework version, and carries
 * the one thing this checkout's catalog will produce a rule-bound finding about.
 */
function makePolicy(version, { except = true } = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bs-polauth-"));
  TEMPORARY.push(dir);
  const exceptions = except
    ? `exceptions:\n  - rule: "${NON_EXEMPTIBLE}"\n    reason: "we would rather not"\n    approvedBy: "someone"\n    approvedAt: "2026-01-01"\n`
    : "exceptions: []\n";
  const body =
    (version === null ? "" : `standardVersion: "${version}"\n`) + `project: "external-subject"\n${exceptions}`;
  writeFileSync(path.join(dir, "project-policy.yml"), body, "utf8");
  return path.join(dir, "project-policy.yml");
}

async function cli(...argv) {
  try {
    const { stdout, stderr } = await run(process.execPath, [POLICY_CLI, ...argv]);
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
}

test("the policy CLI produces no finding about a subject declaring another framework version", async () => {
  const policy = makePolicy("1.0.0");
  const { code, stdout, stderr } = await cli(policy);
  assert.equal(code, EXIT_INVOCATION, "a findings exit here says the 2.x catalog judged a 1.x subject");
  assert.doesNotMatch(stdout, /policy\.non-exemptible-rule/, "the specimen finding must not be produced");
  assert.equal(stdout.trim(), "", "and no report may be printed at all");
  assert.match(stderr, /standardVersion 1\.0\.0/);
});

test("checkPolicy refuses before any rule is applied to the subject", async () => {
  // The programmatic surface, which is what an embedder reaches. The CLI refusal alone would leave
  // the same mistake one direct call away — ADR 0008's residual-default lesson, third instance.
  await assert.rejects(
    () => checkPolicy(makePolicy("1.0.0"), PROJECT_SCHEMA, TODAY),
    (error) => error.name === "WrongFramework" && /standardVersion 1\.0\.0/.test(error.message),
    "checkPolicy must refuse rather than return findings",
  );
});

test("a subject declaring this framework is evaluated exactly as before", async () => {
  // The behaviour being preserved. The specimen finding is correct when this checkout is entitled to
  // make it, and the fix must not have quietly disabled the check it guards.
  const result = await checkPolicy(makePolicy(PACK_VERSION), PROJECT_SCHEMA, TODAY);
  assert.equal(result.status, "findings");
  assert.deepEqual(
    result.findings.map((f) => f.id),
    ["policy.non-exemptible-rule"],
    "the non-exemptible finding must still be produced for a subject this checkout may judge",
  );

  const clean = await checkPolicy(makePolicy(PACK_VERSION, { except: false }), PROJECT_SCHEMA, TODAY);
  assert.equal(clean.status, "ok");
});

test("a subject declaring nothing is refused, exactly as a subject declaring the wrong thing is", async () => {
  // Absence and contradiction are the same class at this boundary: the executing framework has not
  // been authorized to interpret the subject. Treating absence more permissively would reintroduce a
  // route where saying nothing is safer than saying something wrong.
  await assert.rejects(
    () => checkPolicy(makePolicy(null), PROJECT_SCHEMA, TODAY),
    (error) => error.name === "WrongFramework",
  );
});

test("this repository still checks its own policy", async () => {
  // The self-checkout regression. `npm run policy` is a gate stage; the check it now applies to
  // everyone else must not lock this repository out of its own pipeline.
  const { code, stdout } = await cli();
  assert.equal(code, 0, "this repository's own policy must still pass");
  assert.match(stdout, /Valid\./);
});

test("a betting policy is checked under a named project's authority, never on its own say-so", async () => {
  // A betting policy declares no framework version — it is a component of a project, and the project
  // is what declares. So the governing project policy is named rather than guessed, exactly as
  // `decisions.mjs` names one for an external ledger.
  const dir = mkdtempSync(path.join(os.tmpdir(), "bs-polbet-"));
  TEMPORARY.push(dir);
  cpSync(path.join(ROOT, "betting-policy.yml"), path.join(dir, "betting-policy.yml"));
  writeFileSync(path.join(dir, "project-policy.yml"), 'standardVersion: "1.0.0"\nproject: "p"\nexceptions: []\n', "utf8");

  const unnamed = await cli("--betting", path.join(dir, "betting-policy.yml"));
  assert.equal(unnamed.code, EXIT_INVOCATION, "an external betting policy needs its project's authority named");
  assert.match(unnamed.stderr, /--project-policy/);

  const named = await cli(
    "--betting", path.join(dir, "betting-policy.yml"),
    "--project-policy", path.join(dir, "project-policy.yml"),
  );
  assert.equal(named.code, EXIT_INVOCATION, "and naming it is not the same as satisfying it");
  assert.match(named.stderr, /standardVersion 1\.0\.0/);

  writeFileSync(path.join(dir, "project-policy.yml"), `standardVersion: "${PACK_VERSION}"\nproject: "p"\nexceptions: []\n`, "utf8");
  const ok = await cli(
    "--betting", path.join(dir, "betting-policy.yml"),
    "--project-policy", path.join(dir, "project-policy.yml"),
  );
  assert.equal(ok.code, 0, "the capability is preserved, not removed");
});

test("removing the policy authority's guard resurrects the exact specimen", async () => {
  // The mutation, and it must bring back the reviewer's finding by name rather than merely changing
  // an exit code. A guard that stops the run for some other reason would satisfy a code-only
  // assertion while leaving the attribution defect in place.
  const pack = mkdtempSync(path.join(os.tmpdir(), "bs-pack-pol-"));
  TEMPORARY.push(pack);
  cpSync(ROOT, pack, {
    recursive: true,
    filter: (src) => !/[\\/](\.git|node_modules)$/.test(src) && !/[\\/]artifacts[\\/]local-ci$/.test(src),
  });
  const file = path.join(pack, "scripts/policy.mjs");
  const before = readFileSync(file, "utf8");
  const guard = /^ *const refusal = await declaredVersionRefusal\(authorityPath\);\r?\n *if \(refusal\) throw new WrongFramework\(refusal\);\r?\n/m;
  assert.match(before, guard, "the guard must be one surgical call site for this mutation to mean anything");
  writeFileSync(file, before.replace(guard, ""), "utf8");

  const policy = makePolicy("1.0.0");
  let mutated;
  try {
    const { stdout: out } = await run(process.execPath, [path.join(pack, "scripts/policy.mjs"), policy]);
    mutated = { code: 0, stdout: out };
  } catch (error) {
    mutated = { code: error.code, stdout: error.stdout ?? "" };
  }
  assert.match(
    mutated.stdout,
    /policy\.non-exemptible-rule/,
    "with the guard removed the 2.x catalog must judge the 1.x subject again; it did not, so the " +
      "refusal is coming from somewhere else and this test is not proving what it claims",
  );
  assert.notEqual(mutated.code, EXIT_INVOCATION, "and the run must reach a findings exit rather than refusing");
});

/* --------------------------------------------------------------------------------------------
 * The third classification: a surface that EMBEDS this checkout's semantics.
 *
 * The census drew one line — does the surface RESOLVE this checkout's semantics for a subject it
 * was pointed at, or was it HANDED them by its caller? `checkLedger` is neither. It is handed only
 * the subject: no policy, no schema, no catalog. Its rule ids and its ledger-level reasoning are
 * written into the function itself, so it interprets an external subject under 2.0.0 semantics
 * without ever resolving anything.
 *
 * A dichotomy over a domain with three cases has a cell nobody looked in, and that is where this
 * one fell. For authority purposes "embeds" is indistinguishable from "resolves": the subject is
 * judged by this checkout's rules either way. So it carries the check, by the same provenance rule
 * as `checkDecisions` — an explicit project-policy path it opens itself, never a version string.
 * ------------------------------------------------------------------------------------------ */

test("checkLedger refuses a subject on another framework version", async () => {
  const { checkLedger } = await import("../scripts/decisions.mjs");
  const rec = (id) => ({ id, decidedAt: "2026-01-01", decision: { decision: "PASS" } });
  const records = [
    { file: "ext/a.json", record: rec("DEC-1") },
    { file: "ext/b.json", record: rec("DEC-1") },
  ];

  const stale = makePolicy("1.0.0", { except: false });
  await assert.rejects(
    () => checkLedger(records, { projectPolicyPath: stale }),
    (error) => error.name === "WrongFramework" && /declares standardVersion 1\.0\.0/.test(error.message),
    "an external ledger must not be judged by rule ids this checkout supplies and the subject never declared",
  );
});

test("checkLedger requires a named project policy rather than assuming one", async () => {
  const { checkLedger } = await import("../scripts/decisions.mjs");
  await assert.rejects(
    () => checkLedger([], {}),
    /projectPolicyPath/,
    "nothing may be searched for: a record list is not a project and does not imply one",
  );
});

test("checkLedger still produces its ledger findings once authority is established", async () => {
  const { checkLedger } = await import("../scripts/decisions.mjs");
  const rec = (id) => ({ id, decidedAt: "2026-01-01", decision: { decision: "PASS" } });
  const findings = await checkLedger(
    [
      { file: "ext/a.json", record: rec("DEC-1") },
      { file: "ext/b.json", record: rec("DEC-1") },
    ],
    { projectPolicyPath: path.join(ROOT, "project-policy.yml") },
  );
  assert.ok(
    findings.some((f) => f.id === "duplicate-record-id"),
    "the guard must gate the finding, not replace it",
  );
});

/* --------------------------------------------------------------------------------------------
 * The reviewer's wider finding: a betting policy and a schema are not the evaluation semantics.
 *
 * `checkLedger` above was one of three. Review named `checkRecord` and `evaluate` in the same
 * breath, and it was right for the same reason I had been wrong: I classified both as primitives on
 * the ground that their caller hands them everything. What the caller hands `checkRecord` is
 * thresholds and a shape; the thirteen rule ids it attributes are written into the function. What
 * the caller hands `evaluate` is a catalog and a policy; the verdict algebra — STATUS, the exception
 * semantics, the scoring — is written into the function, and the policy it is handed is the very
 * document that carries the declaration it was ignoring.
 * ------------------------------------------------------------------------------------------ */

test("evaluate refuses a policy declaring another framework version", async () => {
  const { evaluate } = await import("../scripts/compliance.mjs");
  const { loadCatalog } = await import("../scripts/catalog.mjs");
  const catalog = await loadCatalog();

  await assert.rejects(
    () =>
      evaluate({
        catalog,
        policy: { standardVersion: "1.0.0", exceptions: [] },
        findings: [],
        evaluated: [],
        today: "2026-01-01",
      }),
    (error) => error.name === "WrongFramework" && /declares standardVersion 1\.0\.0/.test(error.message),
    "a 2.0.0 verdict about a policy declaring 1.0.0 is the specimen this guard exists for",
  );
});

test("evaluate still produces its verdict for a policy declaring this version", async () => {
  const { evaluate } = await import("../scripts/compliance.mjs");
  const { loadCatalog } = await import("../scripts/catalog.mjs");
  const catalog = await loadCatalog();
  const verdict = await evaluate({
    catalog,
    policy: { standardVersion: PACK_VERSION, exceptions: [] },
    findings: [],
    evaluated: [],
    today: "2026-01-01",
  });
  assert.ok(verdict.status, "the guard must gate the verdict, not replace it");
});

test("checkRecord refuses a record judged under another framework version", async () => {
  const { checkRecord } = await import("../scripts/decisions.mjs");
  const stale = makePolicy("1.0.0", { except: false });
  await assert.rejects(
    () => checkRecord({ id: "DEC-1" }, { policy: {}, schema: {}, file: "x.json", projectPolicyPath: stale }),
    (error) => error.name === "WrongFramework",
    "the rule ids checkRecord attributes are this checkout's, whatever policy the caller supplied",
  );
});

test("checkRecord requires a named project policy rather than assuming one", async () => {
  const { checkRecord } = await import("../scripts/decisions.mjs");
  await assert.rejects(
    () => checkRecord({ id: "DEC-1" }, { policy: {}, schema: {}, file: "x.json" }),
    /projectPolicyPath/,
    "a record and a betting policy do not say which framework evaluates them",
  );
});
