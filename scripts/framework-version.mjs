/**
 * Which framework version is entitled to evaluate a project.
 *
 * `schemas/project-policy.schema.json` has described `standardVersion` since v1.0.0 as *"the
 * framework version this project is evaluated against"*, and said in the same sentence that an
 * unresolvable version is *"a configuration error, not a compliance failure — exit 2, never a
 * verdict"*. This module is that sentence, implemented once.
 *
 * WHY IT IS ITS OWN MODULE. The rule was placed in `runValidate`, then in `gatherEvidence`, then
 * here — and each earlier placement was a list of callers that happened to be in mind at the time.
 * It lives apart from every evaluator so that none owns it and all must ask it, and so the surfaces
 * that produce evidence in this pack cannot drift into different ideas of what a version is.
 *
 * HOW MANY ASK IT IS NOT WRITTEN DOWN HERE. An earlier version of this comment said "the two
 * authorities", and there were three; the sentence was false when it was written, and it is exactly
 * the kind of hand-maintained count that has been wrong at every previous step. The live inventory
 * is derived in `test/evidence-surface-census.test.mjs`, which fails when it meets a surface nobody
 * has classified.
 *
 * THE INPUT IS A PATH, NOT A VERSION STRING. A caller that extracted `standardVersion` itself and
 * handed over the result would put the reading of the declaration outside the authority that acts on
 * it, which is exactly the defect ADR 0008 was written about. This module opens the file. What a
 * caller chooses is *which* project policy speaks for the records — never what it says.
 *
 * NOTHING HERE SEARCHES. There is no walking up a directory tree, no fallback to this pack's own
 * policy, no inference from filesystem shape. A caller that cannot name a project policy cannot
 * establish the authority, and must say so rather than guess (ADR 0008: "a search that succeeds in
 * the wrong place is how the sibling pack's version of this defect works").
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "./yaml.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** This repository's own project policy: the version the pack's own doors are judged against. */
export const OWN_PROJECT_POLICY = path.join(ROOT, "project-policy.yml");

const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

/**
 * Thrown when this checkout may not evaluate this project at all.
 *
 * It carries no exit code of its own. Both CLIs already route a thrown error to exit 2 with the
 * command name prefixed, which is exactly the contract this needs: a configuration error, never a
 * verdict and never a finding. A distinct type rather than a bare Error so the reason is legible at
 * the boundary and cannot be confused with an unreadable catalog, schema, or policy.
 */
export class WrongFramework extends Error {
  constructor(message) {
    super(message);
    this.name = "WrongFramework";
  }
}

/**
 * The version this checkout executes.
 *
 * Read from `VERSION` rather than `package.json` because `VERSION` is the file the baseline test
 * pins and the file `standards init` and the templates are reconciled against. Two sources for one
 * fact is the defect ADR 0008 was written about.
 */
export async function packVersion() {
  return (await readFile(path.join(ROOT, "VERSION"), "utf8")).trim();
}

const TAIL =
  "\nThis is a configuration error, not a verdict. A project may only be evaluated by the\n" +
  "framework version it declares — see schemas/project-policy.schema.json.";

/**
 * Why this checkout may not evaluate the project whose policy is at `projectPolicyPath`, or null if
 * it may.
 *
 * Returns the message rather than writing or throwing it, so the decision and the reporting stay
 * separable and a test can assert what was said as well as what was decided. Every branch is exit 2
 * at the caller: none of these is a compliance failure, and reporting one as non-compliance would
 * collapse "this configuration cannot be evaluated" into "this project does not comply".
 *
 * Exact equality, deliberately. This pack has no compatibility range and no version-resolution
 * mechanism, and inventing one inside a guard would create an unreviewed contract in the middle of a
 * fix. When a range mechanism is wanted, it gets its own design and its own evidence.
 */
export async function declaredVersionRefusal(projectPolicyPath) {
  const executing = await packVersion();

  let policy = null;
  let unreadable = null;
  try {
    policy = parseYaml(await readFile(projectPolicyPath, "utf8"));
  } catch (error) {
    unreadable = error.code === "ENOENT" ? null : error.message;
  }

  if (policy === null) {
    return (
      (unreadable
        ? `${projectPolicyPath} could not be read as a project policy — ${unreadable}`
        : `no readable project-policy.yml at ${projectPolicyPath}, so nothing declares a standardVersion`) +
      `\nThe schema requires it, and this checkout is ${executing}.` +
      TAIL
    );
  }

  return declaredVersionRefusalIn(policy, projectPolicyPath, executing);
}

/**
 * The same rule, for an authority that has ALREADY been parsed.
 *
 * `evaluate()` is handed the project policy document itself — the declaration is in its arguments,
 * and it was ignoring it. Re-reading a path there would be inventing provenance the caller already
 * holds, so the document form exists rather than forcing a path. This is not the "accept a version
 * string" antipattern the ADR rejects: what is passed is the DOCUMENT that carries the declaration,
 * and this function reads `standardVersion` out of it itself. A caller still never gets to say what
 * the version is — only which document speaks.
 *
 * `executing` is a parameter only so the path form above can avoid reading VERSION twice; it is read
 * here when absent, never supplied by an outside caller for any other reason.
 */
export async function declaredVersionRefusalIn(policy, label, executing = null) {
  executing ??= await packVersion();
  const where = label ?? "the supplied project policy";

  if (policy === null || typeof policy !== "object") {
    return (
      `${where} is not a project policy document, so nothing declares a standardVersion\n` +
      `The schema requires it, and this checkout is ${executing}.` +
      TAIL
    );
  }

  const projectPolicyPath = where;
  const tail = TAIL;
  const declared = policy.standardVersion;
  if (declared === undefined || declared === null) {
    return (
      `${projectPolicyPath} declares no standardVersion\n` +
      `The schema requires it, and this checkout is ${executing}.` +
      tail
    );
  }
  if (typeof declared !== "string" || !SEMVER.test(declared)) {
    return (
      `standardVersion '${declared}' in ${projectPolicyPath} is not a version\n` +
      `It cannot be resolved to a framework release, and this checkout is ${executing}.` +
      tail
    );
  }
  if (declared !== executing) {
    return (
      `this project declares standardVersion ${declared}, and this checkout is ${executing}\n` +
      `Nothing was evaluated. A ${executing} result labelled ${declared} would describe a judgement that\n` +
      `${declared} never made. Check out ${declared} of this pack to evaluate against it, or update the\n` +
      `project's standardVersion to ${executing} once you have read what changed in CHANGELOG.md.` +
      tail
    );
  }
  return null;
}

