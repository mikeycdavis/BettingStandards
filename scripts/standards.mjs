#!/usr/bin/env node
/**
 * The `standards` CLI.
 *
 * Seven subcommands, designed around the two workflows this pack actually has — adopting the
 * standards, and making and auditing wagering decisions — rather than copied from a generic
 * framework:
 *
 *   init      bootstrap a project (dry-run supported; dry-run and apply share one plan)
 *   plan      what would be evaluated, what evidence it needs, what is missing
 *   check     re-derive and re-evaluate decision records
 *   audit     evidence: every finding, no verdict
 *   validate  the verdict: policy applied to evidence, with coverage
 *   explain   what a rule means, why it applies, and what to do about it
 *   status    orientation: verdict, coverage, gaps, stale attestations
 *
 * THE AUDIT/VALIDATE SPLIT. Evidence discovery and verdict are different jobs with different exit
 * contracts, and merging them means every consumer has to guess which one it got. `audit` reports
 * what was observed and exits 0 unless asked to be strict. `validate` applies the policy and gates.
 *
 * EXIT CODES, and they are load-bearing:
 *   0  success
 *   1  a verdict failure — NON_COMPLIANT or BLOCKED_BY_INVARIANT
 *   2  input could not be read: a missing or malformed policy, catalog, or schema
 *
 * A 2 must NEVER be reported as non-compliance. "The policy could not be read" and "this project
 * does not comply" are different facts, and collapsing them lets a broken config masquerade as a
 * finding — or, worse, lets a deleted policy look like a passing run.
 */

import { readFile, readdir, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseYaml } from "./yaml.mjs";
import { loadCatalog, resolve, coverage, assertBindings, CatalogError } from "./catalog.mjs";
import { evaluate, envelope, STATUS } from "./compliance.mjs";
import { checkDecisions, FINDING_RULES, SUPPLIED_RULES } from "./decisions.mjs";
import { plan as initPlan, apply as initApply } from "./init.mjs";

const EXIT_OK = 0;
const EXIT_VERDICT = 1;
const EXIT_INVOCATION = 2;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOTAL_STANDARDS = 21;

/**
 * The rules this evaluator actually examines.
 *
 * This list is the difference between "no violation was observed" and "nothing looked". Every rule in
 * the catalog that is NOT here reports not-evaluated rather than passing, and a test asserts that
 * every id here is one the detectors can genuinely report against.
 *
 * What is deliberately absent: every `manual-review` rule. Those prohibit motives and ways of
 * reasoning — chasing a loss, betting for action, judging a decision by its result, leaking future
 * information into a backtest — and none of them is visible in a record. An automated run that found
 * nothing has not established them, and saying otherwise would be the exact false assurance this pack
 * refuses. They pass only through a recorded human attestation.
 */
export const EVALUATED_RULES = [
  // Established by re-deriving each stage of a decision record.
  "probability.implied-from-price",
  "vig.overround-computed",
  "vig.no-ignored-vig",
  "vig.removal-method-declared",
  "edge.computed-from-inputs",
  "edge.threshold-respected",
  "edge.no-fabricated-edge",
  "ev.computed-and-recorded",
  "ev.no-fabricated-ev",
  "uncertainty.discount-applied",
  "uncertainty.estimate-recorded",
  "bankroll.stake-within-unit-rules",
  "exposure.aggregate-computed",
  "exposure.correlated-bets-aggregated",
  "exposure.no-cap-breaches",
  "line.staleness-checked",
  "line.clv-computed",
  "line.movement-recorded",
  // Established by the record's structure and provenance fields.
  "odds.conversion-exact",
  "odds.quote-provenance",
  "odds.no-fabrication",
  "probability.fair-source-recorded",
  "edge.no-probability-only-bets",
  "decision.pipeline-complete",
  "decision.no-priceless-recommendations",
  "decision.pass-is-success",
  "record.decision-record-required",
  "record.pass-recorded",
  "record.results-separated",
  "record.no-silent-revision",
  // Established by scanning recorded prose.
  "uncertainty.no-guaranteed-language",
  "uncertainty.no-hidden-uncertainty",
  "ev.no-unsupported-ev-claims",
  // Established across records.
  "bankroll.no-martingale",
  "bankroll.no-loss-driven-sizing",
  // Established from the betting policy.
  "edge.minimum-threshold-defined",
  "bankroll.defined-in-policy",
  "bankroll.unit-defined",
  "exposure.caps-defined",
  "decision.no-bet-quota",
  "evaluation.process-metrics-defined",
];

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * The evaluation plan: what would be evaluated, and what evidence each rule needs.
 *
 * `plan`, `audit`, and `validate` all consume this same object. That is what makes `plan` an accurate
 * preview rather than a second implementation that drifts from the real thing — the same failure mode
 * a dry-run has when it re-derives its own idea of what apply would do.
 */
export async function buildPlan(dir) {
  const catalog = await loadCatalog();
  const evaluated = new Set(EVALUATED_RULES);

  const policyPath = path.join(dir, "project-policy.yml");
  const bettingPath = path.join(dir, "betting-policy.yml");
  const ledgerDir = (await exists(path.join(dir, "ledger"))) ? path.join(dir, "ledger") : path.join(dir, "examples/ledger");

  let policy = null;
  let policyError = null;
  if (await exists(policyPath)) {
    try {
      policy = parseYaml(await readFile(policyPath, "utf8"));
    } catch (error) {
      policyError = error.message;
    }
  }

  const applicability = policy?.applicability ?? {};
  const attestations = policy?.attestations ?? {};

  const rules = [];
  for (const rule of catalog.rules.values()) {
    const declaredNotApplicable = applicability[rule.id]?.status === "not-applicable";
    const attested = Boolean(attestations[rule.id]);
    const willEvaluate = evaluated.has(rule.id);

    let disposition;
    let needs;
    if (declaredNotApplicable) {
      disposition = "not-applicable";
      needs = applicability[rule.id].reason;
    } else if (willEvaluate) {
      disposition = "automated";
      needs = "decision records and the betting policy";
    } else if (rule.attestable) {
      disposition = attested ? "attested" : "needs-attestation";
      needs = attested
        ? `attested by ${attestations[rule.id].reviewedBy} on ${attestations[rule.id].reviewedAt}`
        : "human review recorded as an attestation in project-policy.yml";
    } else {
      disposition = "not-evaluated";
      needs = "no implemented check evaluates this rule";
    }

    rules.push({
      id: rule.id,
      standard: rule.standard,
      level: rule.level,
      validationType: rule.validationType,
      assurance: rule.assurance,
      disposition,
      needs,
      why: declaredNotApplicable
        ? `declared not-applicable: ${applicability[rule.id].reason}`
        : `applies: the catalog defines it at level '${rule.level}' and this project has not declared it not-applicable`,
    });
  }

  return {
    dir,
    catalog,
    policy,
    policyError,
    policyPath,
    bettingPath,
    ledgerDir,
    hasPolicy: policy !== null,
    hasBettingPolicy: await exists(bettingPath),
    rules,
    gaps: rules.filter((r) => r.disposition === "needs-attestation" || r.disposition === "not-evaluated"),
  };
}

/** Findings from the betting policy itself, rather than from any record. */
async function policyFindings(plan) {
  const findings = [];
  if (!plan.hasBettingPolicy) {
    for (const rule of ["edge.minimum-threshold-defined", "bankroll.defined-in-policy", "bankroll.unit-defined", "exposure.caps-defined"]) {
      findings.push({
        id: "betting-policy-missing",
        rule,
        severity: "error",
        message: "no betting-policy.yml: the thresholds and caps this rule requires are not defined",
        file: "betting-policy.yml",
      });
    }
    return findings;
  }

  // A quota cannot be expressed in this configuration format at all — the schema rejects unknown
  // fields — so a declared quota is structurally impossible here. That is a real but narrow
  // assurance, and the catalog's $assuranceNote says so: an informal quota someone holds in their
  // head is the common form and is invisible.
  try {
    const doc = parseYaml(await readFile(plan.bettingPath, "utf8"));
    for (const key of Object.keys(doc)) {
      if (/quota|betsPerDay|minimumBets|targetBets/i.test(key)) {
        findings.push({
          id: "bet-quota-declared",
          rule: "decision.no-bet-quota",
          severity: "error",
          message: `the betting policy declares '${key}', which sets a betting quota`,
          file: "betting-policy.yml",
        });
      }
    }
  } catch {
    // Unreadable policy is handled as exit 2 by the caller, never as a finding.
  }
  return findings;
}

/** Documentation-level findings: what the repository says about its own process. */
async function documentFindings(plan) {
  const findings = [];
  const metricsDoc = path.join(plan.dir, "standards/19-evaluation-of-the-betting-process.md");
  if (!(await exists(metricsDoc))) {
    findings.push({
      id: "process-metrics-undocumented",
      rule: "evaluation.process-metrics-defined",
      severity: "error",
      message: "no document defines the process metrics or the sample-size floor",
      file: "standards/19-evaluation-of-the-betting-process.md",
    });
  }
  return findings;
}

/** Digests for attestation staleness: when reviewed content changes, the attestation goes stale. */
async function attestationDigests(plan) {
  const digests = new Map();
  const attestations = plan.policy?.attestations ?? {};
  for (const [ruleId, attestation] of Object.entries(attestations)) {
    const paths = attestation.reviewedAgainst?.paths;
    if (!paths) continue;
    const hash = createHash("sha256");
    let readable = true;
    for (const relative of [...paths].sort()) {
      try {
        hash.update(await readFile(path.join(plan.dir, relative), "utf8"));
      } catch {
        readable = false;
      }
    }
    if (readable) digests.set(ruleId, hash.digest("hex").slice(0, 32));
  }
  return digests;
}

/** Gather all evidence. Shared by audit and validate so they can never disagree about the facts. */
async function gatherEvidence(plan) {
  const findings = [];
  let recordsChecked = 0;
  let ledgerPresent = false;

  // The policy whose presence establishes adoption is the policy the records are judged against.
  //
  // This call used to omit `policyPath`, and `checkDecisions` defaulted it to THIS pack's
  // betting-policy.yml. `validate <target>` therefore read the target's project-policy.yml and the
  // target's betting-policy.yml — and then evaluated the target's decisions against our numbers.
  // Measured: a target declaring minEdge 0.90, whose records carry an adjusted edge of 0.04, returned
  // COMPLIANT with denominator.scored 25. Nothing errored, and the verdict was shaped exactly like a
  // correct one. See test/target-policy.test.mjs and ADR 0008.
  //
  // With no policy in the target there is nothing to judge the records against, and this pack's file
  // is not a substitute. The records are left unevaluated — the trimming below reports them as such,
  // and policyFindings already fails the four rules that require the policy to exist. An adopting
  // project learns that its thresholds are undeclared, rather than being told it passed ours.
  let suppliedRules = SUPPLIED_RULES;
  if (plan.hasBettingPolicy) {
    const result = await checkDecisions({ dir: plan.ledgerDir, policyPath: plan.bettingPath });
    findings.push(...result.findings);
    recordsChecked = result.records;
    ledgerPresent = result.ledgerPresent;
    suppliedRules = result.suppliedRules;
  } else {
    ledgerPresent = await exists(plan.ledgerDir);
  }

  findings.push(...(await policyFindings(plan)));
  findings.push(...(await documentFindings(plan)));

  // The checker did not run, or ran over nothing. Either way every rule whose evidence it supplies
  // evaluated nothing, and saying they passed would be a clean bill of health from a chart nobody
  // opened.
  //
  // The set comes from the checker, never from a list kept here. This used to be a prefix match over
  // rule ids — `record.`, `decision.`, `odds.`, `edge.computed`, and so on — which was a second,
  // hand-maintained description of another module's behaviour and was measurably wrong: it missed
  // three `edge.*` rules, so a target with a full ledger and no betting policy reported them passed
  // at full assurance from records nothing had read. Two representations of one fact stay in step
  // only by luck, and the luck had already run out. See test/supplied-rules.test.mjs.
  const evaluated = new Set(EVALUATED_RULES);
  if (!ledgerPresent || recordsChecked === 0) {
    for (const id of suppliedRules) evaluated.delete(id);
  }

  assertBindings(plan.catalog, findings.map((f) => f.rule).filter(Boolean));
  return { findings, recordsChecked, ledgerPresent, evaluated: [...evaluated] };
}

async function runValidate(plan, { json }) {
  if (plan.policyError) {
    process.stderr.write(`standards validate: project-policy.yml could not be parsed — ${plan.policyError}\n`);
    return EXIT_INVOCATION;
  }

  // No policy at all — a missing file, or a directory that does not exist. This is exit 2, not a
  // verdict, and getting it wrong is the worst false green available: point the tool at the wrong
  // directory and an earlier version answered "fine, exit 0" because it had nothing to complain
  // about. Nothing was judged, so nothing may pass.
  if (!plan.hasPolicy) {
    process.stderr.write(
      `standards validate: no readable project-policy.yml in ${plan.dir}\n` +
        "Nothing was evaluated, so nothing can be reported as compliant. Run `standards init` first.\n",
    );
    return EXIT_INVOCATION;
  }

  const evidence = await gatherEvidence(plan);
  const today = new Date().toISOString().slice(0, 10);
  const verdict = evaluate({
    catalog: plan.catalog,
    policy: plan.policy,
    findings: evidence.findings,
    evaluated: evidence.evaluated,
    today,
    digests: await attestationDigests(plan),
  });

  const out = envelope({
    verdict,
    project: plan.policy?.project ?? null,
    standardVersion: plan.policy?.standardVersion ?? null,
    auditedAt: today,
    frameworkCoverage: coverage(plan.catalog, { evaluated: evidence.evaluated, totalStandards: TOTAL_STANDARDS }),
  });

  if (json) {
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  } else {
    process.stdout.write(renderVerdict(out, evidence));
  }

  // NOT_EVALUATED never exits 0. It means nothing was judged, and a gate that passes when nothing was
  // judged is the false green this whole framework exists to prevent.
  if (out.status === STATUS.NOT_EVALUATED) return EXIT_INVOCATION;
  return out.status === STATUS.NON_COMPLIANT || out.status === STATUS.BLOCKED_BY_INVARIANT ? EXIT_VERDICT : EXIT_OK;
}

function renderVerdict(out, evidence) {
  const lines = [];
  lines.push(`Project:  ${out.project ?? "(unnamed)"}`);
  lines.push(`Verdict:  ${out.status}`);
  lines.push(`Score:    ${out.score === null ? "n/a" : `${out.score}%`}  (${out.denominator.basis}: ${out.denominator.scored})`);
  lines.push("");

  if (out.status === STATUS.BLOCKED_BY_INVARIANT) {
    lines.push("STOP. A prohibition was violated.");
    lines.push("");
    lines.push("This is not a low score to be improved. The rules below prohibit conduct, and the");
    lines.push("required response is to stop and report — not to reclassify the rule, lower a");
    lines.push("threshold, or record an exception. An exception against a prohibition is rejected.");
    lines.push("");
    for (const id of out.blockedBy) lines.push(`  ${id}`);
    lines.push("");
  }

  const failures = out.results.filter((r) => r.status === "failed");
  for (const r of failures) {
    lines.push(`  FAILED  ${r.ruleId}  [${r.level}]`);
    lines.push(`          ${r.message}`);
    lines.push(`          ${r.remediation}`);
    lines.push("");
  }

  const cov = out.frameworkCoverage;
  lines.push("Coverage");
  lines.push(`  ${cov.evaluatedRules} of ${cov.cataloguedRules} rules evaluated by machine`);
  lines.push(`  ${cov.fullyMachineRepresentedStandards} of ${cov.standards} standards fully machine-represented`);
  lines.push(`  ${evidence.recordsChecked} decision record(s) checked`);
  lines.push("");
  lines.push("A verdict of COMPLIANT means everything that was CHECKED passed. It does not mean");
  lines.push("everything was checked — the coverage figures above say how much was, and they are");
  lines.push("deliberately kept out of the score so that improving coverage never looks like");
  lines.push("improving compliance.");
  lines.push("");

  const notEvaluated = out.results.filter((r) => r.disposition === "not-evaluated");
  if (notEvaluated.length > 0) {
    lines.push(`${notEvaluated.length} rule(s) not evaluated. These are NOT passing:`);
    for (const r of notEvaluated.slice(0, 8)) lines.push(`  ${r.ruleId} — ${r.message}`);
    if (notEvaluated.length > 8) lines.push(`  … and ${notEvaluated.length - 8} more (use --json for all)`);
  }
  return lines.join("\n") + "\n";
}

async function runAudit(plan, { json, strict }) {
  const evidence = await gatherEvidence(plan);
  const errors = evidence.findings.filter((f) => f.severity === "error");
  const warnings = evidence.findings.filter((f) => f.severity === "warning");

  if (json) {
    process.stdout.write(
      JSON.stringify({ schemaVersion: "1.0", records: evidence.recordsChecked, findings: evidence.findings }, null, 2) + "\n",
    );
  } else {
    const lines = [`Decision records checked: ${evidence.recordsChecked}`, `Errors:   ${errors.length}`, `Warnings: ${warnings.length}`, ""];
    for (const f of [...errors, ...warnings]) {
      lines.push(`  ${f.severity.toUpperCase()} ${f.id}${f.file ? ` — ${f.file}` : ""}`);
      lines.push(`      ${f.message}`);
      if (f.rule) lines.push(`      rule: ${f.rule}`);
      lines.push("");
    }
    lines.push("This is evidence, not a verdict. `standards validate` applies the policy and decides.");
    process.stdout.write(lines.join("\n") + "\n");
  }

  if (strict && evidence.findings.length > 0) return EXIT_VERDICT;
  return errors.length > 0 && strict ? EXIT_VERDICT : EXIT_OK;
}

function runPlanCommand(plan, { json }) {
  if (json) {
    process.stdout.write(JSON.stringify({ schemaVersion: "1.0", rules: plan.rules, gaps: plan.gaps }, null, 2) + "\n");
    return EXIT_OK;
  }
  const lines = [];
  lines.push(`Evaluation plan for ${plan.dir}`);
  lines.push("");
  const byDisposition = new Map();
  for (const r of plan.rules) {
    if (!byDisposition.has(r.disposition)) byDisposition.set(r.disposition, []);
    byDisposition.get(r.disposition).push(r);
  }
  for (const [disposition, rules] of [...byDisposition].sort()) {
    lines.push(`${disposition} (${rules.length})`);
    for (const r of rules) lines.push(`  ${r.id.padEnd(42)} ${r.needs}`);
    lines.push("");
  }
  lines.push("Rules listed as needs-attestation prohibit motives and ways of reasoning that no");
  lines.push("automated check can see. They will report not-evaluated — never passing — until a");
  lines.push("human records a review. That is the honest state, not a gap to be closed by pretending.");
  process.stdout.write(lines.join("\n") + "\n");
  return EXIT_OK;
}

async function runExplain(plan, id, { json }) {
  const rule = resolve(plan.catalog, id);
  if (!rule) {
    process.stderr.write(`standards explain: the catalog defines no rule '${id}'\n`);
    return EXIT_VERDICT;
  }
  const planned = plan.rules.find((r) => r.id === id);

  if (json) {
    process.stdout.write(JSON.stringify({ ...rule, disposition: planned?.disposition ?? null }, null, 2) + "\n");
    return EXIT_OK;
  }

  const lines = [];
  lines.push(`${rule.id}  —  ${rule.title}`);
  lines.push(`Standard ${rule.standard} · level ${rule.level} · severity ${rule.severity}`);
  lines.push("");
  if (rule.level === "forbidden") {
    lines.push("THIS IS A PROHIBITION.");
    lines.push("A violation is the PRESENCE of the behaviour, not the absence of an artifact. The");
    lines.push("required response is STOP — report it and do not proceed. No exception may be");
    lines.push("declared against it; an attempt to waive it is rejected and reported. The only");
    lines.push("escape is that the rule has no subject in this project at all.");
    lines.push("");
  }
  lines.push("What it requires");
  lines.push(`  ${rule.description}`);
  lines.push("");
  lines.push("Why");
  lines.push(`  ${rule.rationale}`);
  lines.push("");
  lines.push("If it is violated");
  lines.push(`  ${rule.remediation}`);
  lines.push("");
  lines.push(`How it is checked  (validationType: ${rule.validationType}, assurance: ${rule.assurance})`);
  lines.push(`  ${rule.$assuranceNote ?? "(no assurance note recorded)"}`);
  lines.push("");
  lines.push(`In this project: ${planned?.disposition ?? "unknown"} — ${planned?.why ?? ""}`);
  process.stdout.write(lines.join("\n") + "\n");
  return EXIT_OK;
}

async function runStatus(plan, { json }) {
  const evidence = await gatherEvidence(plan);
  const cov = coverage(plan.catalog, { evaluated: evidence.evaluated, totalStandards: TOTAL_STANDARDS });
  const counts = plan.rules.reduce((a, r) => ({ ...a, [r.disposition]: (a[r.disposition] ?? 0) + 1 }), {});
  const revisit = Object.entries(plan.policy?.applicability ?? {})
    .filter(([, d]) => d.revisitWhen)
    .map(([id, d]) => ({ id, revisitWhen: d.revisitWhen }));

  if (json) {
    process.stdout.write(JSON.stringify({ schemaVersion: "1.0", counts, coverage: cov, revisit, records: evidence.recordsChecked }, null, 2) + "\n");
    return EXIT_OK;
  }

  const lines = [];
  lines.push(`Status for ${plan.policy?.project ?? plan.dir}`);
  lines.push("");
  lines.push(`  ${plan.catalog.rules.size} rules across ${TOTAL_STANDARDS} standards`);
  for (const [disposition, n] of Object.entries(counts).sort()) lines.push(`  ${String(n).padStart(3)} ${disposition}`);
  lines.push("");
  lines.push(`  ${evidence.recordsChecked} decision record(s) in ${path.relative(plan.dir, plan.ledgerDir) || "."}`);
  lines.push(`  ${cov.evaluatedRules}/${cov.cataloguedRules} rules machine-evaluated`);
  lines.push("");
  if (revisit.length > 0) {
    lines.push("Applicability decisions to revisit when circumstances change:");
    for (const r of revisit) lines.push(`  ${r.id} — ${r.revisitWhen}`);
    lines.push("");
  }
  lines.push("Status informs; it never gates. Run `standards validate` for the verdict.");
  process.stdout.write(lines.join("\n") + "\n");
  return EXIT_OK;
}

async function runInit(dir, { dryRun, json }) {
  // Dry-run and apply share one plan object, so the preview cannot describe something other than
  // what apply would do — the failure mode a dry-run has when it derives its own idea of the work.
  const operations = await initPlan(dir, ROOT);
  if (dryRun) {
    if (json) {
      process.stdout.write(JSON.stringify({ schemaVersion: "1.0", dryRun: true, operations }, null, 2) + "\n");
    } else {
      process.stdout.write(`Would apply ${operations.length} operation(s) to ${dir}:\n\n`);
      for (const op of operations) process.stdout.write(`  ${op.action.padEnd(8)} ${op.path}\n`);
      process.stdout.write("\nNothing was written. Re-run without --dry-run to apply exactly these operations.\n");
    }
    return operations.some((o) => o.action === "conflict") ? EXIT_VERDICT : EXIT_OK;
  }

  const applied = await initApply(dir, operations);
  if (json) {
    process.stdout.write(JSON.stringify({ schemaVersion: "1.0", dryRun: false, operations: applied }, null, 2) + "\n");
  } else {
    for (const op of applied) process.stdout.write(`  ${op.action.padEnd(8)} ${op.path}\n`);
    process.stdout.write("\nNext: fill in betting-policy.yml, then run `standards plan .`\n");
  }
  return applied.some((o) => o.action === "conflict") ? EXIT_VERDICT : EXIT_OK;
}

const USAGE = `standards — betting and gambling decision standards

  standards init <dir> [--dry-run]   bootstrap a project
  standards plan <dir>               what would be evaluated and what evidence it needs
  standards check [<dir>]            re-derive and re-evaluate decision records
  standards audit <dir> [--strict]   evidence: every finding, no verdict
  standards validate <dir>           the verdict, with coverage
  standards explain <rule-id>        what a rule means and how it is checked
  standards status <dir>             orientation summary

  --json    machine-readable output

Exit codes: 0 success, 1 verdict failure, 2 input unreadable.
`;

function parseArgs(argv) {
  const options = { command: null, target: null, json: false, strict: false, dryRun: false };
  for (const arg of argv) {
    if (arg === "--json") options.json = true;
    else if (arg === "--strict") options.strict = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help" || arg === "-h") options.command = "help";
    else if (arg.startsWith("--")) throw new Error(`unknown flag '${arg}'`);
    else if (options.command === null) options.command = arg;
    else if (options.target === null) options.target = arg;
    else throw new Error(`unexpected argument '${arg}'`);
  }
  return options;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`standards: ${error.message}\n\n${USAGE}`);
    process.exit(EXIT_INVOCATION);
  }

  if (!options.command || options.command === "help") {
    process.stdout.write(USAGE);
    process.exit(options.command === "help" ? EXIT_OK : EXIT_INVOCATION);
  }

  const dir = options.target ? path.resolve(options.target) : ROOT;

  try {
    switch (options.command) {
      case "init":
        process.exit(await runInit(dir, options));
        break;
      case "check": {
        const { checkDecisions: check, render } = await import("./decisions.mjs");
        const ledger = (await exists(path.join(dir, "ledger"))) ? path.join(dir, "ledger") : path.join(dir, "examples/ledger");
        // The target's own thresholds, named explicitly. Omitting this let `checkDecisions` fall back
        // to THIS pack's betting-policy.yml, so `check <someone else's repo>` re-derived their numbers
        // correctly and then judged their decisions against ours.
        const policyPath = path.join(dir, "betting-policy.yml");
        if (!(await exists(policyPath))) {
          process.stderr.write(
            `standards check: no betting-policy.yml in ${dir}\n` +
              "The recorded decisions cannot be re-evaluated against thresholds that are not declared,\n" +
              "and they will not be evaluated against this pack's. Run `standards init` first.\n",
          );
          process.exit(EXIT_INVOCATION);
        }
        const result = await check({ dir: ledger, policyPath });
        process.stdout.write(options.json ? JSON.stringify(result, null, 2) + "\n" : render(result, options));
        process.exit(result.findings.some((f) => f.severity === "error") ? EXIT_VERDICT : EXIT_OK);
        break;
      }
      case "plan":
        process.exit(runPlanCommand(await buildPlan(dir), options));
        break;
      case "audit":
        process.exit(await runAudit(await buildPlan(dir), options));
        break;
      case "validate":
        process.exit(await runValidate(await buildPlan(dir), options));
        break;
      case "explain": {
        // `explain` takes a rule id where other commands take a directory.
        const plan = await buildPlan(ROOT);
        process.exit(await runExplain(plan, options.target, options));
        break;
      }
      case "status":
        process.exit(await runStatus(await buildPlan(dir), options));
        break;
      default:
        process.stderr.write(`standards: unknown command '${options.command}'\n\n${USAGE}`);
        process.exit(EXIT_INVOCATION);
    }
  } catch (error) {
    // Unreadable catalog, schema, or policy. Exit 2 — never a verdict, because nothing was judged.
    const detail = error instanceof CatalogError ? `catalog: ${error.message}` : error.message;
    process.stderr.write(`standards ${options.command}: ${detail}\n`);
    process.exit(EXIT_INVOCATION);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
