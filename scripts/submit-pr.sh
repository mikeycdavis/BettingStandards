#!/usr/bin/env sh
#
# Submit a pull request for a commit that has actually passed local CI.
#
# THE INVARIANT THIS ENFORCES:
#
#     The commit pushed for a PR is exactly the commit that passed the complete local Docker CI
#     pipeline.
#
# It is enforced by construction, not by convention:
#
#   - the working tree must be clean BEFORE the SHA is recorded, so tree == commit;
#   - the SHA is resolved before CI and re-resolved after, and a difference aborts;
#   - the push names the verified SHA explicitly (`git push origin <sha>:refs/heads/<branch>`)
#     rather than pushing "whatever HEAD is now", so even a race between the check and the push
#     cannot publish an unverified commit;
#   - nothing here ever creates a commit. If the tree is dirty, it stops and says so. A tool that
#     commits on your behalf to make a pipeline pass is a tool that can make an unreviewed change
#     look verified.
#
# Usage:
#   ./scripts/submit-pr.sh
#   ./scripts/submit-pr.sh --draft
#   ./scripts/submit-pr.sh --base develop --title "Short title"
#   ./scripts/submit-pr.sh --body "Explanation of the change"
#
# Options:
#   --base <branch>   base branch for the PR (default: the remote's default branch)
#   --title <text>    PR title (default: the subject of the verified commit)
#   --body <text>     PR body. The Local CI evidence block is APPENDED, never substituted for it.
#   --draft           create the PR as a draft
#   --remote <name>   git remote to push to (default: origin)
#   --skip-ci         REFUSED. Present only to give a clear error; there is no bypass.
#
# Supported override (used by test/local-ci.test.mjs, and by a self-hosted runner whose CI entry
# point differs):
#   SUBMIT_PR_CI_CMD   command executed as the CI gate. Default: ./scripts/ci.sh
#
# Exit codes: 0 submitted · 1 verification refused · 2 invocation/environment fault.

set -eu

DRAFT=0
BASE=""
TITLE=""
BODY=""
REMOTE="origin"

while [ $# -gt 0 ]; do
  case "$1" in
    --draft)   DRAFT=1; shift ;;
    --base)    BASE="${2:?--base requires a branch name}"; shift 2 ;;
    --title)   TITLE="${2:?--title requires text}"; shift 2 ;;
    --body)    BODY="${2:?--body requires text}"; shift 2 ;;
    --remote)  REMOTE="${2:?--remote requires a name}"; shift 2 ;;
    --skip-ci)
      echo "submit-pr: --skip-ci does not exist. The point of this command is that the pushed" >&2
      echo "           commit passed CI. Run ./scripts/ci.sh to see the failure instead." >&2
      exit 2 ;;
    -h|--help)
      sed -n '3,40p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      echo "submit-pr: unknown option '$1' (try --help)" >&2
      exit 2 ;;
  esac
done

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
cd "$REPO_ROOT"

# ── 1. A git repository ───────────────────────────────────────────────────────────────────────────
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "submit-pr: not a git repository." >&2
  exit 2
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" = "HEAD" ]; then
  echo "submit-pr: HEAD is detached. Check out a branch before submitting." >&2
  exit 1
fi

# ── 2. Not the default branch ─────────────────────────────────────────────────────────────────────
# A PR from the default branch to itself is not a PR, and pushing straight to it is what this
# workflow exists to replace.
DEFAULT_BRANCH=$(git symbolic-ref --quiet --short "refs/remotes/$REMOTE/HEAD" 2>/dev/null | sed "s#^$REMOTE/##" || true)
if [ -z "$DEFAULT_BRANCH" ]; then
  for candidate in main master; do
    if git show-ref --verify --quiet "refs/heads/$candidate"; then DEFAULT_BRANCH="$candidate"; break; fi
  done
fi
[ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH="main"
[ -z "$BASE" ] && BASE="$DEFAULT_BRANCH"

if [ "$BRANCH" = "$DEFAULT_BRANCH" ]; then
  echo "submit-pr: refusing to submit from '$BRANCH', which is the default branch." >&2
  echo "           Create a feature branch:  git switch -c my-change" >&2
  exit 1
fi

# ── 3. Clean working tree ─────────────────────────────────────────────────────────────────────────
# This is what makes "the tree that was verified" and "the commit that is pushed" the same object.
# CI builds an image from the working tree; if the tree is clean and equals HEAD, CI tested HEAD.
if [ -n "$(git status --porcelain)" ]; then
  echo "submit-pr: the working tree is dirty. CI verifies a commit, not a work in progress." >&2
  echo "" >&2
  git status --short >&2
  echo "" >&2
  echo "           Commit or stash these changes, then re-run. This command will never commit" >&2
  echo "           on your behalf." >&2
  exit 1
fi

# ── 4. Record the SHA under verification ──────────────────────────────────────────────────────────
SHA_BEFORE=$(git rev-parse HEAD)

echo "submit-pr: repository  $(basename "$REPO_ROOT")"
echo "submit-pr: branch      $BRANCH"
echo "submit-pr: base        $BASE"
echo "submit-pr: commit      $SHA_BEFORE"
echo "submit-pr: running local CI (this is the gate; nothing is pushed until it passes)"
echo ""

# ── 5. The gate ───────────────────────────────────────────────────────────────────────────────────
CI_CMD="${SUBMIT_PR_CI_CMD:-./scripts/ci.sh}"
CI_STATUS=0
# shellcheck disable=SC2086
sh -c "$CI_CMD" || CI_STATUS=$?

if [ "$CI_STATUS" -ne 0 ]; then
  echo "" >&2
  echo "CI failed. No branch was pushed and no PR was created." >&2
  exit 1
fi

# ── 6. The same commit, still ─────────────────────────────────────────────────────────────────────
SHA_AFTER=$(git rev-parse HEAD)
if [ "$SHA_BEFORE" != "$SHA_AFTER" ]; then
  echo "" >&2
  echo "HEAD changed after CI verification. The current commit has not been verified. Re-run CI before submitting." >&2
  echo "           verified: $SHA_BEFORE" >&2
  echo "           current:  $SHA_AFTER" >&2
  exit 1
fi

# Defence in depth: a clean tree before CI and an unchanged HEAD already imply this, but an edit made
# while CI was running would mean the tree on disk is no longer the tree that was verified. The
# commit would still be the verified one, so this is a warning-grade condition reported as a refusal
# rather than silently accepted.
if [ -n "$(git status --porcelain)" ]; then
  echo "" >&2
  echo "submit-pr: the working tree was modified while CI was running. Nothing was pushed." >&2
  exit 1
fi

# ── 7. Push exactly the verified commit ───────────────────────────────────────────────────────────
echo ""
echo "submit-pr: CI passed. Pushing verified commit $SHA_BEFORE to $REMOTE/$BRANCH"
if ! git push "$REMOTE" "$SHA_BEFORE:refs/heads/$BRANCH"; then
  echo "submit-pr: push failed. No PR was created." >&2
  exit 1
fi

# ── 8. Open the PR ────────────────────────────────────────────────────────────────────────────────
[ -z "$TITLE" ] && TITLE=$(git log -1 --pretty=%s "$SHA_BEFORE")

EVIDENCE=$(printf '%s\n' \
  "" \
  "---" \
  "" \
  "## Local CI" \
  "" \
  "Verified commit: \`$SHA_BEFORE\`" \
  "Result: **PASS**" \
  "Environment: Docker (\`compose.ci.yml\`, image \`betting-standards-ci:local\`, no network)" \
  "Pipeline: \`ci/pipeline.json\` via \`scripts/ci-stages.mjs\`" \
  "" \
  "This pull request was verified by the repository's **local** containerized CI pipeline before the" \
  "branch was pushed. GitHub-hosted Actions are a separate system and this block makes no claim about" \
  "them: if a hosted run appears on this PR, read its own status." \
  "" \
  "The pushed commit is exactly the commit that passed. \`scripts/submit-pr.sh\` records the SHA before" \
  "CI, re-resolves it after, refuses on any difference, and pushes the SHA by name." )

if [ -n "$BODY" ]; then
  PR_BODY="$BODY
$EVIDENCE"
else
  PR_BODY="$(git log -1 --pretty=%B "$SHA_BEFORE")
$EVIDENCE"
fi

if ! command -v gh >/dev/null 2>&1; then
  echo ""
  echo "submit-pr: verified commit pushed, but GitHub CLI (gh) is not installed, so no PR was created." >&2
  echo "           Open it manually against base '$BASE'." >&2
  exit 2
fi
if ! gh auth status >/dev/null 2>&1; then
  echo ""
  echo "submit-pr: verified commit pushed, but gh is not authenticated, so no PR was created." >&2
  echo "           Run 'gh auth login' and retry, or open the PR manually against base '$BASE'." >&2
  exit 2
fi

# An open PR for this branch already exists. The push above already moved its head, so the evidence
# block in its body now describes a DIFFERENT commit than the one under review — a stale "Result:
# PASS" against a superseded SHA is exactly the false claim this whole workflow exists to prevent.
# Refresh it, preserving whatever the author wrote above the block.
EXISTING=$(gh pr list --head "$BRANCH" --state open --json number --jq '.[0].number // empty' 2>/dev/null || true)

if [ -n "$EXISTING" ]; then
  CURRENT_BODY=$(gh pr view "$EXISTING" --json body --jq .body 2>/dev/null || printf '')
  # Everything above the evidence heading is the author's; trailing blank lines and the `---` rule
  # that introduces the block are dropped so repeated runs cannot accumulate separators.
  AUTHOR_PART=$(printf '%s\n' "$CURRENT_BODY" \
    | awk '/^## Local CI$/{exit} {print}' \
    | awk '{a[NR]=$0} END{n=NR; while(n>0 && (a[n]=="" || a[n]=="---")) n--; for(i=1;i<=n;i++) print a[i]}')

  if [ -n "$BODY" ]; then AUTHOR_PART="$BODY"; fi

  echo "submit-pr: PR #$EXISTING is already open for '$BRANCH'; its head is now the verified commit."
  echo "submit-pr: refreshing the Local CI evidence block so it names $SHA_BEFORE"
  gh pr edit "$EXISTING" --body "$AUTHOR_PART
$EVIDENCE"
  gh pr view "$EXISTING" --json url --jq .url
  exit 0
fi

set -- --base "$BASE" --head "$BRANCH" --title "$TITLE" --body "$PR_BODY"
[ "$DRAFT" -eq 1 ] && set -- "$@" --draft

echo "submit-pr: creating pull request"
gh pr create "$@"
