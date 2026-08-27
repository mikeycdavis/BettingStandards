#!/usr/bin/env node
/**
 * Validate this project's policies: project-policy.yml against schemas/project-policy.schema.json,
 * and betting-policy.yml against schemas/betting-policy.schema.json.
 *
 * Exit codes, and the distinction is the point:
 *
 *   0  the policies are valid
 *   1  a policy is valid but a compliance condition fails — an expired exception, an exception
 *      against a forbidden rule, or a rule declared both not-applicable and excepted
 *   2  a policy could not be evaluated: unreadable, unparseable, or schema-invalid
 *
 * Invalid configuration is a `2`, never a `1`. "This policy is malformed" and "this project fails a
 * rule" are different facts, and collapsing them reports a broken config as non-compliance.
 *
 * Usage: node scripts/policy.mjs [path/to/project-policy.yml] [--json] [--schema <path>]
 *        node scripts/policy.mjs --betting [path/to/betting-policy.yml]
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseYaml, YamlError } from "./yaml.mjs";
import { validate, assertSchemaSupported, SchemaError } from "./jsonschema.mjs";
import { declaredVersionRefusal, WrongFramework } from "./framework-version.mjs";

const EXIT_OK = 0;
const EXIT_FINDINGS = 1;
const EXIT_INVOCATION = 2;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SCHEMA = path.join(ROOT, "schemas/project-policy.schema.json");
const DEFAULT_POLICY = path.join(ROOT, "project-policy.yml");
const BETTING_SCHEMA = path.join(ROOT, "schemas/betting-policy.schema.json");
const BETTING_POLICY = path.join(ROOT, "betting-policy.yml");

/**
 * The one place a policy scalar becomes a number.
 *
 * The YAML parser returns every scalar as a string on purpose: type coercion belongs to the schema,
 * and a parser that turned `0.02` into a number would defeat the pattern check before it ran. So the
 * schema constrains the *string* with a pattern, and this converts afterwards — in exactly one
 * function, so there is no second interpretation of what `minEdge: "0.02"` means.
 *
 * Throws rather than returning NaN: a threshold nobody can read must stop the run, not silently
 * become a comparison that is false for every input.
 */
export function coerceNumber(value, where) {
  if (typeof value === "number") return value;
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${where}: expected a numeric string, got ${JSON.stringify(value)}`);
  }
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${where}: '${value}' is not a finite number`);
  return n;
}

/** The numeric fields of a betting policy, coerced once, in one place. */
export const BETTING_POLICY_NUMBERS = [
  "minEdge",
  "kellyMultiplier",
  "unitPercent",
  "maxSingleBetPct",
  "maxGroupExposurePct",
  "maxTotalExposurePct",
  "maxOddsAgeMinutes",
  "maxPredictionAgeMinutes",
  "longshotOddsThreshold",
  "longshotMinDiscount",
];

/**
 * Read and validate a betting policy, returning it with its numeric fields coerced.
 * Throws on unreadable, unparseable, or schema-invalid input — the caller turns that into exit 2.
 */
export async function loadBettingPolicy(policyPath = BETTING_POLICY, schemaPath = BETTING_SCHEMA) {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  assertSchemaSupported(schema);
  const document = parseYaml(await readFile(policyPath, "utf8"));
  const errors = validate(document, schema);
  if (errors.length > 0) {
    const detail = errors.map((e) => `${e.path || "(document)"}: ${e.message}`).join("; ");
    throw new Error(`betting policy is schema-invalid — ${detail}`);
  }
  const out = { ...document };
  for (const field of BETTING_POLICY_NUMBERS) {
    out[field] = coerceNumber(document[field], `betting-policy.yml:${field}`);
  }
  return out;
}

/** Compliance conditions that a well-formed policy can still fail. */
function complianceFindings(document, today, catalog) {
  const findings = [];
  const exceptions = Array.isArray(document.exceptions) ? document.exceptions : [];

  // A forbidden rule admits no exception. Caught here so an adopter learns it from `npm run policy`
  // rather than from a surprising verdict, and caught again in the compliance engine so it cannot be
  // bypassed by skipping this command. This is protection #1 of the standards-integrity invariant:
  // the attempt to waive a prohibition is itself the finding.
  for (const entry of exceptions) {
    const rule = catalog?.rules.get(entry.rule);
    if (rule?.nonExemptible) {
      findings.push({
        id: "policy.non-exemptible-rule",
        severity: "error",
        message: `'${rule.id}' is non-exemptible; an exception against it is rejected, not recorded`,
        remediation:
          "Remove the exception and satisfy the rule. If it genuinely has no subject here, declare it not-applicable with a reason.",
      });
    }
  }

  for (const entry of exceptions) {
    if (entry.expires && entry.expires < today) {
      findings.push({
        id: "policy.expired-exception",
        severity: "error",
        message: `exception for '${entry.rule}' expired on ${entry.expires}`,
        remediation: "Renew the exception with a new approval, or satisfy the rule.",
      });
    }
  }

  // An exception says the rule applies and is knowingly unmet; not-applicable says the rule has no
  // subject here. A rule cannot be both, and a policy asserting both is ambiguous rather than strict
  // — there is no safe way to pick one, so the policy is reported rather than interpreted.
  const notApplicable = new Set(
    Object.entries(document.applicability ?? {})
      .filter(([, decl]) => decl?.status === "not-applicable")
      .map(([id]) => id),
  );
  for (const entry of exceptions) {
    if (notApplicable.has(entry.rule)) {
      findings.push({
        id: "policy.conflicting-classification",
        severity: "error",
        message: `'${entry.rule}' is declared not-applicable and also carries an exception`,
        remediation:
          "Remove one. not-applicable means the rule has no subject; an exception means it applies and is unmet.",
      });
    }
  }

  return findings;
}

function parseArgs(argv) {
  const options = { policy: null, schema: null, projectPolicy: null, json: false, betting: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") options.json = true;
    else if (arg === "--betting") options.betting = true;
    else if (arg === "--schema") options.schema = argv[++i];
    else if (arg === "--project-policy") options.projectPolicy = argv[++i];
    else if (arg.startsWith("--")) throw new Error(`unknown flag '${arg}'`);
    else if (options.policy === null) options.policy = arg;
    else throw new Error(`unexpected argument '${arg}'`);
  }
  if (options.betting) {
    // A betting policy declares no framework version. It is a component of a project, and the
    // project is what declares — so for anything but this repository's own file, the governing
    // project policy is named rather than assumed. Same refusal, same reason, as `--policy` on
    // `decisions.mjs`: two identities a config file cannot supply about itself.
    if (options.policy && !options.projectPolicy) {
      throw new Error(
        "a betting policy declares no standardVersion, so the project whose framework judges it must be named —\n" +
          "  pass --project-policy <path to that project's project-policy.yml>.\n" +
          "  Nothing is searched for: a betting policy sitting next to a project policy is not evidence\n" +
          "  that the two belong together.",
      );
    }
    options.policy ??= BETTING_POLICY;
    options.schema ??= BETTING_SCHEMA;
    options.projectPolicy ??= DEFAULT_POLICY;
  } else {
    options.policy ??= DEFAULT_POLICY;
    options.schema ??= DEFAULT_SCHEMA;
    // A project policy carries its own declaration. The subject IS the authority, so nothing is
    // assumed and nothing extra is required — `checkPolicy` opens what it was already given.
    options.projectPolicy ??= options.policy;
  }
  return options;
}

/**
 * Returns { status, errors, findings, document }. status is one of ok|findings|invalid.
 *
 * THE THIRD AUTHORITY. This function loads THIS checkout's rule catalog and applies `nonExemptible`
 * to a policy document it was pointed at. That is this pack's standards semantics interpreting an
 * external subject, and it reaches neither `gatherEvidence` nor `checkDecisions` — which is how the
 * declared-version rule, having been placed correctly in both of those, still had a door around it.
 *
 * Measured before this guard: an external policy declaring `standardVersion: "1.0.0"` with an
 * exception against a rule the 2.0.0 catalog marks non-exemptible produced
 * `policy.non-exemptible-rule` and exit 1 — a findings exit, about a subject that never authorized
 * this framework to judge it. Which rules are non-exemptible is exactly the kind of thing a major
 * version may change; whether the finding also happens to hold under 1.0.0 is beside the point,
 * because it was not established by a framework the subject declared.
 *
 * `authorityPath` names the project policy that carries the declaration. For a project policy the
 * subject IS the declaration, so the caller passes the same path and the function opens it once more
 * for that purpose — the version is never accepted as a string from a caller, following the rule
 * `checkDecisions` already follows. A betting policy declares no framework and is a component of a
 * project, so the governing project policy is named. Nothing walks upward; nothing infers ownership
 * from filesystem shape.
 *
 * THE GUARD IS FIRST — before the schema is read, before the document is validated, before the
 * catalog is loaded. Authority precedes interpretation, and the schemas in `schemas/` are a
 * normative surface of this pack like the catalog is.
 */
export async function checkPolicy(policyPath, schemaPath, today, { authorityPath = policyPath } = {}) {
  const refusal = await declaredVersionRefusal(authorityPath);
  if (refusal) throw new WrongFramework(refusal);

  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  assertSchemaSupported(schema);

  let document;
  try {
    document = parseYaml(await readFile(policyPath, "utf8"));
  } catch (error) {
    if (error instanceof YamlError) {
      return { status: "invalid", errors: [{ path: "", message: error.message }], findings: [] };
    }
    throw error;
  }

  const errors = validate(document, schema);
  if (errors.length > 0) return { status: "invalid", errors, findings: [], document };

  const catalog = await (async () => {
    try {
      const { loadCatalog } = await import("./catalog.mjs");
      return await loadCatalog();
    } catch {
      return null; // A missing catalog disables the rule-aware checks; it never fakes a pass.
    }
  })();
  const findings = complianceFindings(document, today, catalog);
  return { status: findings.length > 0 ? "findings" : "ok", errors: [], findings, document };
}

function report(result, relative, options) {
  if (options.json) {
    process.stdout.write(
      JSON.stringify(
        {
          schemaVersion: "1.0",
          policy: relative,
          status: result.status,
          errors: result.errors,
          findings: result.findings,
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  process.stdout.write(`Policy: ${relative}\n\n`);
  for (const error of result.errors) {
    process.stdout.write(`  ${error.path || "(document)"}: ${error.message}\n`);
  }
  for (const finding of result.findings) {
    process.stdout.write(`  ${finding.severity.toUpperCase()} ${finding.id}: ${finding.message}\n`);
    process.stdout.write(`        ${finding.remediation}\n`);
  }
  if (result.status === "ok") {
    process.stdout.write("Valid.\n\n");
    process.stdout.write(
      "This says the policy is well-formed and internally consistent. It says nothing\n" +
        "about whether the project satisfies the rules it declares — that is a validation\n" +
        "run, not a schema check.\n",
    );
  } else if (result.status === "invalid") {
    process.stdout.write(`\n${result.errors.length} schema error(s). The policy could not be evaluated.\n`);
  } else {
    process.stdout.write(`\n${result.findings.length} compliance finding(s).\n`);
  }
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`standards policy: ${error.message}\n`);
    process.exit(EXIT_INVOCATION);
  }

  const today = new Date().toISOString().slice(0, 10);
  // Each target carries the authority that governs it. The second target below is THIS repository's
  // own betting policy, so its authority is this repository's own project policy — never the subject
  // the command was pointed at, which would be attributing our file to someone else's declaration.
  const targets = options.betting
    ? [{ policy: options.policy, schema: options.schema, authority: options.projectPolicy }]
    : [
        { policy: options.policy, schema: options.schema, authority: options.projectPolicy },
        { policy: BETTING_POLICY, schema: BETTING_SCHEMA, authority: DEFAULT_POLICY },
      ];

  let worst = EXIT_OK;
  for (const target of targets) {
    let result;
    try {
      result = await checkPolicy(target.policy, target.schema, today, { authorityPath: target.authority });
    } catch (error) {
      // A WrongFramework arrives here like any other unreadable-input error and leaves by the same
      // door: exit 2, never a findings exit. "This checkout may not judge that subject" and "that
      // subject has a problem" are different facts, and the second must not be reported for the first.
      const detail = error instanceof SchemaError ? `schema: ${error.message}` : error.message;
      process.stderr.write(`standards policy: ${detail}\n`);
      process.exit(EXIT_INVOCATION);
    }
    const relative = path.relative(ROOT, target.policy).replace(/\\/g, "/") || target.policy;
    report(result, relative, options);
    if (targets.length > 1) process.stdout.write("\n");
    if (result.status === "invalid") worst = EXIT_INVOCATION;
    else if (result.status === "findings" && worst === EXIT_OK) worst = EXIT_FINDINGS;
  }

  process.exit(worst);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`) {
  await main();
} else if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
