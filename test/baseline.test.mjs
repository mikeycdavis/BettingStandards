/**
 * The v1.0.0 baseline.
 *
 * WHY THIS FILE EXISTS. Everything asserted here was true when v1.0.0 shipped, and every number was
 * arrived at deliberately. Left as prose in a release note, a baseline drifts: a rule gets added
 * without an inventory entry, coverage creeps up because a lexical heuristic was quietly counted as
 * evaluation, a prohibition loses its non-exemptible flag in a refactor. None of those announces
 * itself, and each makes the framework claim slightly more than it can support.
 *
 * So the baseline is executable. This file is the framework's own application of the rule it applies
 * to everyone else: a change to what the pack claims must be deliberate and visible, never silent.
 *
 * HOW TO CHANGE IT. Edit the numbers here in the same commit as the change that moved them, with a
 * message saying why. That is not a workaround — it is the point. A failing assertion here means
 * "the shape of this framework changed"; the only wrong response is to relax the assertion so the
 * change passes unnoticed.
 *
 * WHAT IS DELIBERATELY NOT ASSERTED. The total test count. A suite that asserts its own size makes
 * adding a test a two-step chore, and the number carries no meaning the other assertions do not.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { loadCatalog } from "../scripts/catalog.mjs";
import { EVALUATED_RULES } from "../scripts/standards.mjs";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = await loadCatalog();
const rules = [...catalog.rules.values()];

/**
 * The published shape.
 *
 * `version` moved to 1.1.0 for the target-policy correction (ADR 0008), and it is the ONLY field that
 * moved — as it was the only one that moved for 1.0.1 before it. Every other number below is the one
 * v1.0.0 shipped with, still passing.
 *
 * That matters more for this release than for the last one. 1.0.1 was metadata and could claim "no
 * normative change" cheaply; 1.1.0 changes what `validate` does to an external target, so the claim
 * that the STANDARDS did not change needs to be mechanical rather than asserted. The evidence that
 * justifies moving `version` is the measurement in ADR 0008 and the suite in
 * test/target-policy.test.mjs, both in the same diff as this line.
 */
const BASELINE = {
  version: "1.1.0",
  standards: 21,
  rules: 51,
  required: 25,
  recommended: 3,
  forbidden: 23,
  manualReview: 8,
  evaluatedRules: 41,
  fullyMachineRepresentedStandards: 13,
  verdict: "COMPLIANT",
  score: 94,
};

test("VERSION matches the baseline", async () => {
  const version = (await readFile(path.join(ROOT, "VERSION"), "utf8")).trim();
  assert.equal(version, BASELINE.version);
});

test("the standards series is 21, contiguous, with no gaps", async () => {
  const files = (await readdir(path.join(ROOT, "standards"))).filter((f) => /^\d\d-.*\.md$/.test(f)).sort();
  assert.equal(files.length, BASELINE.standards);
  files.forEach((file, i) => {
    assert.equal(Number(file.slice(0, 2)), i + 1, `expected standard ${i + 1}, found ${file}`);
  });
});

test("the catalog is 51 rules: 25 required, 3 recommended, 23 forbidden", () => {
  assert.equal(rules.length, BASELINE.rules);
  const byLevel = (level) => rules.filter((r) => r.level === level).length;
  assert.equal(byLevel("required"), BASELINE.required);
  assert.equal(byLevel("recommended"), BASELINE.recommended);
  assert.equal(byLevel("forbidden"), BASELINE.forbidden);
  assert.equal(
    byLevel("required") + byLevel("recommended") + byLevel("forbidden"),
    BASELINE.rules,
    "every rule carries one of the three levels; there is no fourth",
  );
});

test("every one of the 23 prohibitions is non-exemptible and error-severity", () => {
  // The property that makes a prohibition a prohibition. Losing it on a single entry would be
  // invisible in review — the rule would still be listed, still be forbidden, and quietly waivable.
  for (const rule of rules.filter((r) => r.level === "forbidden")) {
    assert.equal(rule.nonExemptible, true, `${rule.id} is forbidden but exemptible`);
    assert.equal(rule.severity, "error", `${rule.id} is forbidden but not error-severity`);
  }
});

test("8 rules are manual-review, and none is claimed as machine-evaluated", () => {
  // The honesty commitment: these prohibit motives and ways of reasoning that no record contains.
  // Raising coverage by moving one of them into EVALUATED_RULES on the strength of a lexical
  // heuristic is precisely the false assurance this framework refuses.
  const manual = rules.filter((r) => r.validationType === "manual-review");
  assert.equal(manual.length, BASELINE.manualReview);
  for (const rule of manual) {
    assert.equal(rule.assurance, "none", `${rule.id} is manual-review but claims assurance above none`);
    assert.ok(!EVALUATED_RULES.includes(rule.id), `${rule.id} is manual-review and must not be claimed as evaluated`);
  }
});

test("coverage is 41 of 51 rules — truthful, not complete", () => {
  assert.equal(EVALUATED_RULES.length, BASELINE.evaluatedRules);
  assert.ok(
    EVALUATED_RULES.length < rules.length,
    "a claim of full coverage would mean the manual-review rules had been faked",
  );
});

test("this repository validates as COMPLIANT at the baseline score and coverage", async () => {
  const { stdout } = await run(process.execPath, [path.join(ROOT, "scripts/standards.mjs"), "validate", ".", "--json"], {
    cwd: ROOT,
  });
  const out = JSON.parse(stdout);

  assert.equal(out.status, BASELINE.verdict);
  assert.equal(out.score, BASELINE.score);
  assert.deepEqual(out.blockedBy, [], "no prohibition may be violated at the baseline");
  assert.equal(out.frameworkCoverage.cataloguedRules, BASELINE.rules);
  assert.equal(out.frameworkCoverage.evaluatedRules, BASELINE.evaluatedRules);
  assert.equal(out.frameworkCoverage.standards, BASELINE.standards);
  assert.equal(out.frameworkCoverage.fullyMachineRepresentedStandards, BASELINE.fullyMachineRepresentedStandards);
});

test("coverage is reported beside the verdict and never folded into the score", async () => {
  const { stdout } = await run(process.execPath, [path.join(ROOT, "scripts/standards.mjs"), "validate", ".", "--json"], {
    cwd: ROOT,
  });
  const out = JSON.parse(stdout);
  // The score's denominator is evaluated required rules. If coverage ever entered it, improving
  // coverage would look like improving compliance, and the two would stop being separable.
  assert.equal(out.denominator.basis, "required-level rules that were evaluated");
  assert.ok(out.denominator.scored <= out.denominator.applicable);
  assert.match(out.frameworkCoverage.note, /not compliance/i);
});

test("the repository is standalone: no source file references a sibling standards repository", async () => {
  // ADR 0006. The machinery was forked, not depended upon. Prose in design documents and ADRs may
  // discuss the provenance; nothing executable may reach for it.
  // The sibling names are assembled from fragments rather than written literally, so this file does
  // not match its own check. Excluding the checking file by name would work too, and would be one
  // more exclusion that a genuine offender could later hide behind.
  const siblings = ["Engineering", "Prediction", "Financial", "MachineLearning"].map((n) => `${n}Standards`);
  const absolutePath = /[A-Z]:[\\/]Repos/;

  const dirs = ["scripts", "rules", "schemas", "test", "standards", "templates"];
  const offenders = [];
  for (const dir of dirs) {
    for (const entry of await readdir(path.join(ROOT, dir), { withFileTypes: true, recursive: true })) {
      if (!entry.isFile()) continue;
      const file = path.join(entry.parentPath ?? entry.path, entry.name);
      const body = await readFile(file, "utf8");
      if (siblings.some((s) => body.includes(s)) || absolutePath.test(body)) {
        offenders.push(path.relative(ROOT, file).replace(/\\/g, "/"));
      }
    }
  }
  assert.deepEqual(offenders, [], "these files reference another repository");
});

test("package.json declares no dependencies", async () => {
  const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
  assert.deepEqual(pkg.dependencies ?? {}, {});
  assert.deepEqual(pkg.devDependencies ?? {}, {});
});

test("CI has no install step, which is how the zero-dependency decision is enforced", async () => {
  const ci = await readFile(path.join(ROOT, ".github/workflows/ci.yml"), "utf8");
  const executable = ci
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
  assert.doesNotMatch(executable, /npm (ci|install)/, "an install step would end the zero-dependency guarantee");
});

test("both architectural anchors are stated in the repository, not only in its history", async () => {
  // These two sentences are what the pack is for. They belong where a reader and an agent will meet
  // them, which means the README, the standards that own them, and the templates an agent is given.
  // Whitespace-tolerant: these sentences are prose in wrapped Markdown, so "deserves money" is
  // routinely split across a line break. A regex requiring a literal space would fail on formatting
  // rather than on substance.
  const boundary = /deserves\s+belief[\s\S]{0,400}deserves\s+money/;
  const invariant = /good\s+bet\s+can\s+lose[\s\S]{0,400}PASS\s+is\s+always/i;

  const readme = await readFile(path.join(ROOT, "README.md"), "utf8");
  assert.match(readme, boundary, "the README must state the prediction/betting boundary");
  assert.match(readme, invariant, "the README must state the fundamental invariant");

  const agents = await readFile(path.join(ROOT, "templates/AGENTS.md"), "utf8");
  assert.match(agents, /deserves belief/, "an adopting agent must be told where this pack begins");
  assert.match(agents, /good bet can lose/i, "an adopting agent must be told the invariant");

  const std01 = await readFile(path.join(ROOT, "standards/01-the-fundamental-invariant.md"), "utf8");
  assert.match(std01, /good bet can lose/i);

  const std02 = await readFile(path.join(ROOT, "standards/02-the-decision-pipeline.md"), "utf8");
  assert.match(std02, /deserves belief/);
});

test("PASS remains structurally available, so no positive recommendation can be forced", async () => {
  // The expanded brief's requirement, satisfied by structure rather than instruction. If a future
  // change ever made a discretionary PASS invalid, this is where it would show.
  const schema = JSON.parse(await readFile(path.join(ROOT, "schemas/decision-record.schema.json"), "utf8"));
  const decisionEnum = schema.$defs.decisionBody.properties.decision.enum;
  assert.deepEqual(decisionEnum, ["BET", "PASS"]);

  const passReasons = schema.$defs.decisionBody.properties.passReasons.description;
  assert.match(passReasons, /discretionary/, "a PASS taken when every gate passes must remain valid");

  const bettingSchema = JSON.parse(await readFile(path.join(ROOT, "schemas/betting-policy.schema.json"), "utf8"));
  assert.equal(bettingSchema.additionalProperties, false, "a bet quota must remain inexpressible in policy");
  assert.ok(!Object.keys(bettingSchema.properties).some((k) => /quota|minimumBets|targetBets/i.test(k)));
});
