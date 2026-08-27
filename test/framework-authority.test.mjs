/**
 * Every door into record evaluation, and the one boundary that guards them all.
 *
 * WHAT KEPT GOING WRONG. The rule — a project is evaluated only by the framework version it declares
 * — has now been placed three times, and the first two placements were both locally convincing and
 * both wrong in the same way:
 *
 *   1. `runValidate` only.        Reasoning: `validate` is the only command that stamps the declared
 *                                 version onto its output. Missed `audit` and `status`, which call
 *                                 `gatherEvidence` directly. `audit --strict` returned a
 *                                 wrong-framework evaluation as a CI gating failure.
 *   2. `gatherEvidence`.          Reasoning: that is where evaluation happens. It is where evaluation
 *                                 happens for THREE of the commands. `standards check <target>` calls
 *                                 `checkDecisions` directly from the command layer, and
 *                                 `node scripts/decisions.mjs --dir <ledger>` never enters
 *                                 `standards.mjs` at all. Measured on the 2.0.0 candidate: both
 *                                 re-derived five records of a target declaring `1.0.0` under a 2.0.0
 *                                 checkout and exited 0.
 *   3. `checkDecisions`.          The authority that evaluates records. Nothing evaluates a record
 *                                 without going through it.
 *
 * Each fix removed one enumeration and left a smaller one. That is the shape of the mistake, not a
 * run of bad luck: the guard was placed at the boundary that covered the callers already in mind,
 * rather than at the boundary the *evidence* is produced by. It is the same correction as ADR 0008's
 * rule-ownership addendum, made twice more.
 *
 * THE TOPOLOGY, established by tracing rather than by recollection. Every externally reachable path
 * that can evaluate a decision record:
 *
 *   path                                            project root known?   class
 *   ------------------------------------------------------------------------------------------
 *   standards validate <dir>   -> gatherEvidence     yes, it was given one  external target
 *   standards audit <dir>      -> gatherEvidence     yes                    external target
 *   standards status <dir>     -> gatherEvidence     yes                    external target
 *   standards check <dir>      -> checkDecisions     yes                    external target
 *   decisions.mjs --dir/--record                     NO — a ledger dir      external target,
 *                                                                           authority must be given
 *   decisions.mjs (no arguments)                     n/a                    self-checkout
 *   checkOwnExamples()                               n/a                    self-checkout
 *   checkDecisions({...}) programmatic               caller's to state      caller declares
 *
 * HOW THE TWO CLASSES ARE TOLD APART: they are not. Every caller must NAME a project policy, and the
 * pack's own doors name the pack's own. There is no self-checkout exemption to be reached by
 * mistake, no flag that means "trust me", and nothing infers a project root from filesystem shape —
 * which is the guessing this whole release exists to remove. `checkOwnExamples()` proceeds because
 * this repository's `project-policy.yml` declares the version this checkout executes, which is a fact
 * it re-reads rather than an exemption it claims.
 *
 * `decisions.mjs --dir <ledger>` is the one entry point that genuinely cannot establish the
 * authority: a ledger directory is not a project root, and walking upward to find one is forbidden
 * (ADR 0008, "a search that succeeds in the wrong place"). It therefore requires the caller to say
 * so explicitly, with `--project-policy`, exactly as it already requires `--policy` for the
 * thresholds. Two policy identities, both named, neither derived.
 *
 * `plan` and `init` and `explain` evaluate no records and are not guarded. The census test below
 * derives the command list from the CLI's own help output, so a new subcommand cannot join the
 * family without this file having an opinion about it.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { checkDecisions, checkOwnExamples } from "../scripts/decisions.mjs";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STANDARDS = path.join(ROOT, "scripts/standards.mjs");
const DECISIONS = path.join(ROOT, "scripts/decisions.mjs");
const PACK_VERSION = readFileSync(path.join(ROOT, "VERSION"), "utf8").trim();

const EXIT_INVOCATION = 2;

const TEMPORARY = [];
process.on("exit", () => {
  for (const dir of TEMPORARY) rmSync(dir, { recursive: true, force: true });
});

/**
 * A complete adopting project: a real five-record ledger, its own thresholds, its own project policy.
 * Everything is in order except the framework version it declares, so any refusal can only be about
 * that. The betting policy is this pack's, copied in — the target legitimately owns a copy.
 */
function makeExternalTarget(version) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bs-authority-"));
  TEMPORARY.push(dir);
  mkdirSync(path.join(dir, "ledger"));
  mkdirSync(path.join(dir, "standards"));
  cpSync(path.join(ROOT, "examples/ledger"), path.join(dir, "ledger"), { recursive: true });
  cpSync(path.join(ROOT, "betting-policy.yml"), path.join(dir, "betting-policy.yml"));
  cpSync(
    path.join(ROOT, "standards/19-evaluation-of-the-betting-process.md"),
    path.join(dir, "standards/19-evaluation-of-the-betting-process.md"),
  );
  writeFileSync(
    path.join(dir, "project-policy.yml"),
    `standardVersion: "${version}"\nproject: "declared-${version}"\nexceptions: []\n`,
    "utf8",
  );
  return dir;
}

/** Never throws: the exit code is the thing under test. */
async function cli(script, ...argv) {
  try {
    const { stdout, stderr } = await run(process.execPath, [script, ...argv]);
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
}

/* --------------------------------------------------------------------------------------------
 * The two doors the previous placement missed.
 * ------------------------------------------------------------------------------------------ */

test("standards check does not re-derive an external target's records under the wrong framework", async () => {
  // Reproduced before the fix: five records re-derived, one warning reported, exit 0. `check` is the
  // command an adopting project is told to run before committing a decision, so a wrong-framework
  // pass here is the earliest possible false green in the workflow.
  const dir = makeExternalTarget("1.0.0");
  const { code, stdout, stderr } = await cli(STANDARDS, "check", dir);
  assert.equal(code, EXIT_INVOCATION, "records must not be re-derived under a framework the project never declared");
  assert.doesNotMatch(stdout, /Decision records checked/, "nothing may be reported as checked");
  assert.match(stderr, /standardVersion 1\.0\.0/, "and the refusal must name the declared version");
});

test("standards check still works on a target declaring this framework", async () => {
  const dir = makeExternalTarget(PACK_VERSION);
  const { code, stdout } = await cli(STANDARDS, "check", dir);
  assert.equal(code, 0, "a matching declaration must be evaluated normally");
  assert.match(stdout, /Decision records checked: 5/);
});

test("decisions.mjs refuses an external ledger with no declared framework authority", async () => {
  // A ledger directory is not a project root, and this command will not go looking for one. It
  // already refuses `--dir` without `--policy` for the same reason; the framework version is the
  // second identity it cannot derive from what it was handed.
  const dir = makeExternalTarget("1.0.0");
  const { code, stdout, stderr } = await cli(DECISIONS, "--dir", path.join(dir, "ledger"), "--policy", path.join(dir, "betting-policy.yml"));
  assert.equal(code, EXIT_INVOCATION);
  assert.equal(stdout.trim(), "", "no findings may be printed from an unattributed evaluation");
  assert.match(stderr, /--project-policy/, "the refusal must say what is missing and how to supply it");
});

test("decisions.mjs refuses an external ledger whose project declares another framework", async () => {
  const dir = makeExternalTarget("1.0.0");
  const { code, stdout, stderr } = await cli(
    DECISIONS,
    "--dir", path.join(dir, "ledger"),
    "--policy", path.join(dir, "betting-policy.yml"),
    "--project-policy", path.join(dir, "project-policy.yml"),
  );
  assert.equal(code, EXIT_INVOCATION, "naming the authority is not the same as satisfying it");
  assert.equal(stdout.trim(), "");
  assert.match(stderr, /standardVersion 1\.0\.0/);
});

test("decisions.mjs evaluates an external ledger once the authority is named and satisfied", async () => {
  const dir = makeExternalTarget(PACK_VERSION);
  const { code, stdout } = await cli(
    DECISIONS,
    "--dir", path.join(dir, "ledger"),
    "--policy", path.join(dir, "betting-policy.yml"),
    "--project-policy", path.join(dir, "project-policy.yml"),
  );
  assert.equal(code, 0);
  assert.match(stdout, /Decision records checked: 5/, "the capability is preserved, not removed");
});

/* --------------------------------------------------------------------------------------------
 * The self-checkout doors, which must stay open — and must stay open for a reason rather than by
 * exemption.
 * ------------------------------------------------------------------------------------------ */

test("decisions.mjs with no arguments still checks this repository's own examples", async () => {
  const { code, stdout } = await cli(DECISIONS);
  assert.equal(code, 0);
  assert.match(stdout, /Decision records checked: 5/);
});

test("checkOwnExamples proceeds because this repository declares the version it executes", async () => {
  // Not an exemption. It passes the same check every external caller does, against this repository's
  // own project-policy.yml, re-read at call time.
  const result = await checkOwnExamples();
  assert.ok(result.records > 0, "the self-checkout must actually read the examples");
});

test("checkDecisions requires the framework authority to be named, like the policy before it", async () => {
  // The residual-default lesson from ADR 0008, applied to the second identity. A default here would
  // leave the same mistake one direct call away for any caller that never touches a CLI.
  await assert.rejects(
    () =>
      checkDecisions({
        dir: path.join(ROOT, "examples/ledger"),
        policyPath: path.join(ROOT, "betting-policy.yml"),
      }),
    /projectPolicyPath/,
    "a checker that will silently supply the framework version is not a general checker",
  );
});

/* --------------------------------------------------------------------------------------------
 * Drift guards.
 * ------------------------------------------------------------------------------------------ */

test("every subcommand the CLI advertises either refuses or provably evaluates nothing", async () => {
  // The census. Derived from the CLI's own help output rather than from a list maintained here, so a
  // subcommand added later cannot quietly join without this test having an opinion about it.
  //
  // The three exempt commands are exempt for a stated reason, not by convenience:
  //   init     writes a new project; it reads no records and produces no finding
  //   plan     previews from buildPlan; evaluates nothing, and is the one command that can still
  //            tell an adopter on an older version what this one would ask of them
  //   explain  takes a rule id, not a directory
  const help = (await cli(STANDARDS, "help")).stdout;
  const advertised = [...help.matchAll(/^ {2}standards (\w+)/gm)].map((m) => m[1]);
  assert.ok(advertised.length >= 7, `the help output must list the commands, found ${advertised.length}`);

  const EVALUATES_NOTHING = new Set(["init", "plan", "explain"]);
  const dir = makeExternalTarget("1.0.0");
  const leaked = [];
  for (const command of advertised) {
    if (EVALUATES_NOTHING.has(command)) continue;
    const { code } = await cli(STANDARDS, command, dir, "--json");
    if (code !== EXIT_INVOCATION) leaked.push(`${command} exited ${code}`);
  }
  assert.deepEqual(leaked, [], "these commands evaluated a target declaring a framework this checkout is not");
});

test("plan and explain remain usable for a project on another framework version", async () => {
  const dir = makeExternalTarget("1.0.0");
  const preview = await cli(STANDARDS, "plan", dir, "--json");
  assert.equal(preview.code, 0, "the preview must survive: it is how an adopter learns what to change");
  assert.ok(JSON.parse(preview.stdout).rules.length > 0);

  const explained = await cli(STANDARDS, "explain", "bankroll.no-martingale");
  assert.equal(explained.code, 0, "explaining a rule is not evaluating a project");
});

test("removing the single guard reopens every external door at once", async () => {
  // The mutation that discriminates PLACEMENT from presence, widened to the true topology. A copy of
  // the check pasted into each entry point would satisfy every test above and regress exactly one
  // door when one copy was removed. Deleting the one call site inside the evaluating authority must
  // reopen `standards check` AND `decisions.mjs` together.
  const pack = mkdtempSync(path.join(os.tmpdir(), "bs-pack-auth-"));
  TEMPORARY.push(pack);
  cpSync(ROOT, pack, {
    recursive: true,
    filter: (src) => !/[\\/](\.git|node_modules)$/.test(src) && !/[\\/]artifacts[\\/]local-ci$/.test(src),
  });
  const file = path.join(pack, "scripts/decisions.mjs");
  const before = readFileSync(file, "utf8");
  const guard = /^ *const refusal = await declaredVersionRefusal\(projectPolicyPath\);\r?\n *if \(refusal\) throw new WrongFramework\(refusal\);\r?\n/m;
  assert.match(before, guard, "the guard must be one surgical call site for this mutation to mean anything");
  writeFileSync(file, before.replace(guard, ""), "utf8");

  const dir = makeExternalTarget("1.0.0");
  const reopened = [];
  const check = await cli(path.join(pack, "scripts/standards.mjs"), "check", dir);
  if (check.code !== EXIT_INVOCATION) reopened.push("standards check");
  const direct = await cli(
    path.join(pack, "scripts/decisions.mjs"),
    "--dir", path.join(dir, "ledger"),
    "--policy", path.join(dir, "betting-policy.yml"),
    "--project-policy", path.join(dir, "project-policy.yml"),
  );
  if (direct.code !== EXIT_INVOCATION) reopened.push("decisions.mjs");

  assert.deepEqual(
    reopened.sort(),
    ["decisions.mjs", "standards check"],
    "with the shared guard removed both external doors must reopen; a door still refusing is " +
      "carrying its own copy of the check, which is the enumeration this placement exists to end",
  );
});
