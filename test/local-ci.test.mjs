/**
 * The local CI pipeline and the verified-PR gate, tested rather than trusted.
 *
 * Two groups:
 *
 *   1. The pipeline manifest is the single definition. Tests here fail if the stage list drifts out
 *      of step with package.json, or if the GitHub workflow starts redefining the pipeline instead
 *      of invoking it. That drift is the specific failure this design exists to prevent, so it is
 *      asserted rather than left to review.
 *
 *   2. The submit-pr refusals. Each builds a throwaway git repository in a temp directory with a
 *      real bare remote, drives scripts/submit-pr.sh against it with a stubbed CI command, and
 *      asserts both the refusal AND that nothing reached the remote. Asserting the message alone
 *      would pass for a script that printed the right words and pushed anyway.
 *
 * The SHA-mismatch case is the important one: it proves the guard bites, without mutating this
 * repository's real history to demonstrate it.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, cpSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const manifest = JSON.parse(readFileSync(path.join(ROOT, "ci", "pipeline.json"), "utf8"));
const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));

/** Both host wrappers, asserted together so a fix applied to one but not the other is caught. */
const wrappers = [
  ["scripts/ci.sh", readFileSync(path.join(ROOT, "scripts", "ci.sh"), "utf8")],
  ["scripts/ci.ps1", readFileSync(path.join(ROOT, "scripts", "ci.ps1"), "utf8")],
];

describe("ci/pipeline.json is the single definition of the pipeline", () => {
  test("declares stages, each with an id and a command", () => {
    assert.ok(Array.isArray(manifest.stages) && manifest.stages.length > 0, "no stages declared");
    for (const stage of manifest.stages) {
      assert.ok(stage.id, "a stage has no id");
      assert.ok(Array.isArray(stage.command) && stage.command.length > 0, `${stage.id} has no command`);
      assert.ok(stage.name, `${stage.id} has no name`);
      assert.ok(stage.why, `${stage.id} has no rationale — a check nobody can explain gets deleted`);
    }
  });

  test("stage ids are unique", () => {
    const ids = manifest.stages.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate stage id in ${ids.join(", ")}`);
  });

  test("every stage runs a script that package.json actually defines", () => {
    // Guards the drift where a stage is renamed in one file and not the other, which would show up
    // as a stage that silently fails to invoke rather than as a failing check.
    for (const stage of manifest.stages) {
      const [bin, ...rest] = stage.command;
      assert.equal(bin, "npm", `${stage.id} does not invoke npm; the pipeline runs package scripts`);
      const script = rest[0] === "run" ? rest[1] : rest[0];
      assert.ok(
        Object.hasOwn(pkg.scripts, script),
        `stage ${stage.id} runs "npm ${rest.join(" ")}" but package.json has no "${script}" script`
      );
    }
  });

  test("the eight checks the GitHub workflow used to define are all still present", () => {
    // The pipeline moved out of .github/workflows/ci.yml into the manifest. This asserts nothing was
    // dropped in the move. Adding a stage is fine; losing one of these is not.
    const required = ["inventory", "fidelity", "policy", "diagrams", "check", "test", "audit", "validate"];
    const ids = manifest.stages.map((s) => s.id);
    for (const id of required) {
      assert.ok(ids.includes(id), `stage "${id}" was dropped from the pipeline`);
    }
  });

  test("the GitHub workflow invokes the manifest rather than redefining it", () => {
    const workflow = readFileSync(path.join(ROOT, ".github", "workflows", "ci.yml"), "utf8");
    assert.match(workflow, /ci-stages\.mjs/, "the workflow no longer calls the shared stage runner");

    // ADR 0006: zero third-party dependencies, enforced structurally by the absence of an install
    // step. Kept as an assertion so the property survives edits to the workflow.
    //
    // Comment lines are stripped first. The workflow *explains* that `npm ci` must not appear, and
    // an assertion that cannot tell the prohibition from a violation of it is worse than none —
    // it fails on the documentation and would be "fixed" by deleting the explanation.
    const executable = workflow
      .split("\n")
      .filter((line) => !/^\s*#/.test(line))
      .join("\n");
    assert.doesNotMatch(executable, /npm (ci|install)\b/, "an install step appeared; see ADR 0006");
  });

  test("each run executes an image no concurrent run can retag", () => {
    // THE FALSIFIER FOR THE CONCURRENCY HOLE. compose.ci.yml pinned `betting-standards-ci:local`,
    // a single shared tag. A unique compose project isolates containers and networks; it does not
    // isolate a tag, and the tag is what gets executed:
    //
    //     run A build → tags :local at A's tree
    //     run B build → RETAGS :local at B's tree
    //     run A run   → executes B's code, records A's SHA
    //
    // That publishes commit A on the strength of run B's code, which falsifies the invariant this
    // whole workflow exists to establish. These assertions fail against that implementation.
    const compose = readFileSync(path.join(ROOT, "compose.ci.yml"), "utf8");
    const imageLine = compose
      .split("\n")
      .find((line) => /^\s*image:/.test(line));

    assert.ok(imageLine, "compose.ci.yml declares no image");
    assert.match(
      imageLine,
      /\$\{CI_IMAGE_TAG/,
      "the image tag is not per-run; a concurrent run can retag it between this run's build and its execution"
    );

    for (const [name, source] of wrappers) {
      // The tag must be derived from the per-run identifier, not a constant that merely arrives
      // through an environment variable.
      assert.match(
        source,
        /CI_IMAGE_TAG\s*=\s*"?\$\(?\{?(Project|PROJECT)\}?"?/,
        `${name} does not derive CI_IMAGE_TAG from the unique per-run project name`
      );
    }
  });

  test("the run container survives its own exit, so --keep-on-failure can keep it", () => {
    // `--keep-on-failure` previously ran with `--rm`, so the container it promised to leave for
    // inspection was deleted the moment the pipeline exited. An advertised debugging affordance that
    // does not exist is worse than none, because it is discovered while debugging.
    for (const [name, source] of wrappers) {
      const runLine = source
        .split("\n")
        .find((line) => /compose.*\brun\b/.test(line) && /--no-TTY/i.test(line));
      assert.ok(runLine, `${name} has no recognisable 'compose run' invocation`);
      assert.doesNotMatch(runLine, /--rm\b/, `${name} still passes --rm; the kept container is deleted on exit`);
      assert.match(runLine, /--name/, `${name} does not name the container, so it cannot be inspected or copied from`);
    }
  });

  test("PR evidence never hardcodes an image name", () => {
    // The evidence block once read `image: betting-standards-ci:local` as a literal. That was true
    // when written and became false when the tag went per-run — the line kept asserting it anyway,
    // which is the failure mode this whole PR exists to prevent, committed into the artefact whose
    // job is to describe what was verified. Evidence must be read from the run, never typed in.
    for (const name of ["scripts/submit-pr.sh", "scripts/submit-pr.ps1"]) {
      const source = readFileSync(path.join(ROOT, name), "utf8");
      const evidence = source
        .split("\n")
        .filter((line) => !/^\s*(#|\/\/)/.test(line));

      for (const line of evidence) {
        assert.doesNotMatch(
          line,
          /betting-standards-ci:[A-Za-z0-9._-]+/,
          `${name} names a literal image tag in the evidence it publishes; read imageId from the run instead`
        );
      }
      assert.match(
        source,
        /latest\.json/,
        `${name} does not read the run's own result, so its environment line cannot be evidence`
      );
    }
  });

  test("transient verification output is not committable", () => {
    const ignore = readFileSync(path.join(ROOT, ".gitignore"), "utf8");
    assert.match(ignore, /^artifacts\/local-ci\/?$/m, "artifacts/local-ci is not gitignored");
  });
});

// ── submit-pr refusals ────────────────────────────────────────────────────────────────────────────

/** The POSIX shell to drive submit-pr.sh with. On a Windows host `sh` is usually absent but Git for
 *  Windows puts `bash` on PATH, which runs the script unchanged. */
const SHELL = ["sh", "bash"].find(
  (candidate) => spawnSync(candidate, ["-c", "exit 0"], { encoding: "utf8" }).status === 0
);
const hasGit = spawnSync("git", ["--version"], { encoding: "utf8" }).status === 0;

// Honest about coverage rather than silently green: without a POSIX shell these cannot run, and they
// are reported as skipped with the reason. They always run inside the CI container, which is the
// environment the gate actually executes in — so the gate is never unverified, only the host echo
// of it is.
const skip = !SHELL || !hasGit
  ? `requires a POSIX shell and git (shell: ${SHELL ?? "none"}, git: ${hasGit})`
  : false;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  if (r.status !== 0 && opts.mustSucceed !== false) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${r.stderr || r.stdout}`);
  }
  return r;
}

/** A throwaway repository with a real bare remote and scripts/submit-pr.sh installed. */
function sandbox() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bs-submit-pr-"));
  const work = path.join(dir, "work");
  const remote = path.join(dir, "remote.git");

  run("git", ["init", "--bare", "--initial-branch=main", remote]);
  run("git", ["init", "--initial-branch=main", work]);

  const g = (...args) => run("git", ["-C", work, ...args]);
  g("config", "user.email", "ci-test@example.invalid");
  g("config", "user.name", "CI Test");
  g("remote", "add", "origin", remote);

  mkdirSync(path.join(work, "scripts"), { recursive: true });
  cpSync(path.join(ROOT, "scripts", "submit-pr.sh"), path.join(work, "scripts", "submit-pr.sh"));

  writeFileSync(path.join(work, "README.md"), "sandbox\n");
  g("add", "-A");
  g("commit", "-q", "-m", "initial commit");
  // A default branch must exist for the refusal-to-submit-from-default check to resolve; `main` is
  // it. Feature work happens on `feature`.
  g("switch", "-q", "-c", "feature");
  writeFileSync(path.join(work, "change.txt"), "a change\n");
  g("add", "-A");
  g("commit", "-q", "-m", "a change on the feature branch");

  return {
    dir,
    work,
    remote,
    git: g,
    head: () => run("git", ["-C", work, "rev-parse", "HEAD"]).stdout.trim(),
    remoteRefs: () =>
      run("git", ["--git-dir", remote, "for-each-ref", "--format=%(refname)"]).stdout.trim(),
    submit: (ciCmd, extra = []) =>
      spawnSync(SHELL, [path.join(work, "scripts", "submit-pr.sh"), ...extra], {
        cwd: work,
        encoding: "utf8",
        env: { ...process.env, SUBMIT_PR_CI_CMD: ciCmd },
      }),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

describe("submit-pr refuses to publish an unverified commit", { skip }, () => {
  test("refuses when HEAD changes during CI, and pushes nothing", () => {
    // THE INVARIANT. The stub CI "passes" but commits while it runs, so the SHA recorded before CI
    // is no longer HEAD afterwards. Submission must refuse: the commit that would be pushed is not
    // the commit that was verified.
    const s = sandbox();
    try {
      const before = s.head();
      const r = s.submit('git commit --allow-empty -q -m "moved during CI"');

      assert.notEqual(r.status, 0, "submission succeeded despite HEAD moving during CI");
      assert.match(
        `${r.stdout}${r.stderr}`,
        /HEAD changed after CI verification\. The current commit has not been verified\. Re-run CI before submitting\./
      );
      assert.notEqual(s.head(), before, "the stub did not actually move HEAD; the test proves nothing");
      assert.equal(s.remoteRefs(), "", "a commit reached the remote after a failed verification");
    } finally {
      s.cleanup();
    }
  });

  test("refuses when CI fails, and pushes nothing", () => {
    const s = sandbox();
    try {
      const r = s.submit("exit 3");
      assert.notEqual(r.status, 0);
      assert.match(
        `${r.stdout}${r.stderr}`,
        /CI failed\. No branch was pushed and no PR was created\./
      );
      assert.equal(s.remoteRefs(), "", "a commit reached the remote after CI failed");
    } finally {
      s.cleanup();
    }
  });

  test("refuses a dirty working tree, and never commits on your behalf", () => {
    const s = sandbox();
    try {
      const before = s.head();
      writeFileSync(path.join(s.work, "uncommitted.txt"), "work in progress\n");
      const r = s.submit("exit 0");

      assert.notEqual(r.status, 0);
      assert.match(`${r.stdout}${r.stderr}`, /working tree is dirty/);
      assert.equal(s.head(), before, "submit-pr created a commit; it must never do that");
      assert.equal(s.remoteRefs(), "");
    } finally {
      s.cleanup();
    }
  });

  test("refuses to submit from the default branch", () => {
    const s = sandbox();
    try {
      s.git("switch", "-q", "main");
      const r = s.submit("exit 0");
      assert.notEqual(r.status, 0);
      assert.match(`${r.stdout}${r.stderr}`, /refusing to submit from 'main'/);
      assert.equal(s.remoteRefs(), "");
    } finally {
      s.cleanup();
    }
  });

  test("refuses when the tree is modified while CI runs", () => {
    const s = sandbox();
    try {
      const r = s.submit("printf 'edited mid-run\\n' > change.txt");
      assert.notEqual(r.status, 0);
      assert.match(`${r.stdout}${r.stderr}`, /modified while CI was running/);
      assert.equal(s.remoteRefs(), "");
    } finally {
      s.cleanup();
    }
  });

  test("refuses when base and head are the same branch, before pushing anything", () => {
    // Previously this reached `gh pr create`, which fails -- but only AFTER the branch was pushed.
    // A command that reports refusal must not have already published something.
    const s = sandbox();
    try {
      const r = s.submit("exit 0", ["--base", "feature"]);
      assert.notEqual(r.status, 0);
      assert.match(`${r.stdout}${r.stderr}`, /base and head are both 'feature'/);
      assert.equal(s.remoteRefs(), "", "the branch was pushed before the refusal");
    } finally {
      s.cleanup();
    }
  });

  test("has no bypass flag", () => {
    const s = sandbox();
    try {
      const r = s.submit("exit 0", ["--skip-ci"]);
      assert.equal(r.status, 2);
      assert.match(`${r.stdout}${r.stderr}`, /--skip-ci does not exist/);
      assert.equal(s.remoteRefs(), "");
    } finally {
      s.cleanup();
    }
  });
});
