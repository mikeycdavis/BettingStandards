#!/usr/bin/env node
/**
 * Execute the authoritative CI pipeline declared in `ci/pipeline.json`.
 *
 * WHY THIS EXISTS. The pipeline used to live in `.github/workflows/ci.yml` as eight `run:` steps.
 * Introducing a local Docker CI created the obvious hazard: two copies of the stage list, drifting,
 * with the local one green and the hosted one testing something else. So the stage list moved into
 * data, and both callers read it. There is no second definition to forget.
 *
 * WHERE IT RUNS. Three places, identically:
 *   - inside the CI container   (scripts/ci.ps1 | ci.sh, the authoritative local run)
 *   - on a GitHub runner        (.github/workflows/ci.yml, one step)
 *   - on a developer's machine  (`node scripts/ci-stages.mjs`, no Docker, for a fast inner loop)
 *
 * The third is a convenience and is NOT the gate: it runs against whatever Node and whatever working
 * tree the developer happens to have, which is the state the Docker run exists to eliminate.
 *
 * FAIL FAST. The first non-zero stage stops the run. Stages are ordered so that a cheap, specific
 * report (a broken worked example) fails before a general one (a test name), and the gate runs last.
 *
 * EVIDENCE. On completion — pass or fail — writes a machine-readable result to
 * `artifacts/local-ci/latest.json`. That directory is gitignored: it is transient verification
 * output, not the repository's evidence record, and committing it would make a local claim look like
 * a reviewed artifact.
 *
 * Exit 0 only when every stage exited 0; 1 when a stage failed; 2 on invocation error.
 */

import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(ROOT, "ci", "pipeline.json");
const EVIDENCE_DIR = path.join(ROOT, "artifacts", "local-ci");

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_INVOCATION = 2;

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const jsonOnly = args.includes("--json");

/** Read the stage list. A manifest that cannot be read is exit 2 — an invocation fault, never a
 *  failing build. The distinction is the same one scripts/policy.mjs draws, for the same reason. */
async function loadManifest() {
  let raw;
  try {
    raw = await readFile(MANIFEST, "utf8");
  } catch (err) {
    throw new InvocationError(`cannot read ${path.relative(ROOT, MANIFEST)}: ${err.message}`);
  }
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (err) {
    throw new InvocationError(`${path.relative(ROOT, MANIFEST)} is not valid JSON: ${err.message}`);
  }
  if (!Array.isArray(manifest.stages) || manifest.stages.length === 0) {
    throw new InvocationError(`${path.relative(ROOT, MANIFEST)} declares no stages`);
  }
  for (const stage of manifest.stages) {
    if (!stage.id || !Array.isArray(stage.command) || stage.command.length === 0) {
      throw new InvocationError(`stage ${JSON.stringify(stage.id ?? "<unnamed>")} has no command`);
    }
  }
  return manifest;
}

class InvocationError extends Error {}

/** Resolve the commit under test without requiring git to be present. Inside the CI image `.git` is
 *  deliberately absent (see .dockerignore) — the image holds a tree, not a history — so the host
 *  passes the SHA in. An unknown SHA is recorded as null rather than guessed. */
function commitUnderTest() {
  if (process.env.CI_COMMIT_SHA) return process.env.CI_COMMIT_SHA;
  const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" });
  if (r.status === 0 && r.stdout) return r.stdout.trim();
  return null;
}

function branchUnderTest() {
  if (process.env.CI_BRANCH) return process.env.CI_BRANCH;
  const r = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: ROOT, encoding: "utf8" });
  if (r.status === 0 && r.stdout) return r.stdout.trim();
  return null;
}

function log(line = "") {
  if (!jsonOnly) process.stdout.write(`${line}\n`);
}

function runStage(stage) {
  const [command, ...rest] = stage.command;
  const started = Date.now();
  const result = spawnSync(command, rest, {
    cwd: ROOT,
    stdio: jsonOnly ? ["ignore", "pipe", "pipe"] : "inherit",
    // npm ships as npm.cmd on Windows, which is not directly executable without a shell. The local
    // gate runs in Linux; this keeps `node scripts/ci-stages.mjs` usable on a Windows host too.
    shell: process.platform === "win32",
    encoding: "utf8",
  });
  const durationMs = Date.now() - started;

  if (result.error) {
    return { ok: false, durationMs, exitCode: null, reason: result.error.message };
  }
  if (result.signal) {
    return { ok: false, durationMs, exitCode: null, reason: `killed by signal ${result.signal}` };
  }
  return { ok: result.status === 0, durationMs, exitCode: result.status, reason: null };
}

async function writeEvidence(payload) {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const file = path.join(EVIDENCE_DIR, "latest.json");
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return file;
}

async function main() {
  const manifest = await loadManifest();
  const startedAt = new Date();
  const commit = commitUnderTest();
  const branch = branchUnderTest();

  log("── Local CI ──────────────────────────────────────────────────────────");
  log(`repository  betting-standards`);
  log(`branch      ${branch ?? "(unknown)"}`);
  log(`commit      ${commit ?? "(unknown)"}`);
  log(`environment ${process.env.CI_ENVIRONMENT ?? "host"} · node ${process.version}`);
  log(`stages      ${manifest.stages.map((s) => s.id).join(", ")}`);
  log("──────────────────────────────────────────────────────────────────────");
  log();

  const checks = [];
  let failed = null;

  for (const [index, stage] of manifest.stages.entries()) {
    const position = `${index + 1}/${manifest.stages.length}`;
    log(`▶ [${position}] ${stage.name} — ${stage.command.join(" ")}`);
    if (verbose && stage.why) log(`  ${stage.why}`);

    const outcome = runStage(stage);
    checks.push({
      id: stage.id,
      name: stage.name,
      command: stage.command.join(" "),
      result: outcome.ok ? "passed" : "failed",
      exitCode: outcome.exitCode,
      durationMs: outcome.durationMs,
    });

    if (outcome.ok) {
      log(`✔ [${position}] ${stage.name} (${outcome.durationMs} ms)`);
      log();
      continue;
    }

    const detail = outcome.reason ?? `exit ${outcome.exitCode}`;
    log(`✘ [${position}] ${stage.name} FAILED — ${detail}`);
    failed = { stage, detail };
    break; // fail fast: later stages tell you nothing you can act on yet
  }

  const completedAt = new Date();
  const skipped = manifest.stages
    .slice(checks.length)
    .map((s) => ({ id: s.id, name: s.name, command: s.command.join(" "), result: "not-run" }));

  const payload = {
    schemaVersion: "1.0.0",
    repository: "betting-standards",
    commit,
    branch,
    result: failed ? "failed" : "passed",
    environment: process.env.CI_ENVIRONMENT ?? "host",
    node: process.version,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt - startedAt,
    // The stage list is reported in full. A stage that did not run is "not-run", never omitted and
    // never "passed" — the whole point of this repository is that an unevaluated check is not a
    // successful one.
    checks: [...checks, ...skipped],
    failedStage: failed ? failed.stage.id : null,
  };

  const evidenceFile = await writeEvidence(payload);

  if (jsonOnly) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    log("──────────────────────────────────────────────────────────────────────");
    if (failed) {
      log(`RESULT      FAIL — ${failed.stage.name} (${failed.detail})`);
      const notRun = skipped.map((s) => s.id);
      if (notRun.length > 0) log(`NOT RUN     ${notRun.join(", ")}`);
    } else {
      log(`RESULT      PASS — ${checks.length} stages`);
      log(`STAGES      ${checks.map((c) => c.id).join(", ")}`);
    }
    log(`COMMIT      ${commit ?? "(unknown)"}`);
    log(`COMPLETED   ${completedAt.toISOString()}`);
    log(`EVIDENCE    ${path.relative(ROOT, evidenceFile).split(path.sep).join("/")}`);
    log("──────────────────────────────────────────────────────────────────────");
  }

  return failed ? EXIT_FAILED : EXIT_OK;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    if (err instanceof InvocationError) {
      process.stderr.write(`ci-stages: ${err.message}\n`);
      process.exit(EXIT_INVOCATION);
    }
    process.stderr.write(`ci-stages: unexpected failure — ${err.stack ?? err.message}\n`);
    process.exit(EXIT_INVOCATION);
  });
