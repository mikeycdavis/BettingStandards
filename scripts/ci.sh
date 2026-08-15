#!/usr/bin/env sh
#
# THE authoritative local CI command (POSIX hosts, and any self-hosted GitHub runner).
# Windows equivalent: scripts/ci.ps1. Both are thin: the stage list lives in ci/pipeline.json and is
# executed by scripts/ci-stages.mjs inside the container. Neither wrapper knows what a stage is.
#
#   ./scripts/ci.sh                     run the full pipeline in Docker
#   ./scripts/ci.sh --verbose           also print each stage's rationale, and docker build output
#   ./scripts/ci.sh --keep-on-failure   leave the failed container in place for inspection
#
# Exit 0 only when every stage passed. Nonzero otherwise, always.

set -eu

VERBOSE=0
KEEP_ON_FAILURE=0

for arg in "$@"; do
  case "$arg" in
    --verbose)         VERBOSE=1 ;;
    --keep-on-failure) KEEP_ON_FAILURE=1 ;;
    -h|--help)
      sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      echo "ci: unknown option '$arg' (try --help)" >&2
      exit 2 ;;
  esac
done

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
cd "$REPO_ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "ci: docker is not on PATH. Local CI requires Docker; see docs/local-ci.md § Prerequisites." >&2
  exit 2
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "ci: 'docker compose' is unavailable (Compose v2 required)." >&2
  exit 2
fi
if ! docker info >/dev/null 2>&1; then
  echo "ci: the Docker daemon is not reachable. Start Docker and retry." >&2
  exit 2
fi

# A project name unique to this run. Everything compose creates is namespaced under it, so `down`
# below can be exhaustive without any risk of touching a developer's own containers, networks, or
# volumes — including those of another repository running its CI at the same moment.
PROJECT="bs-ci-$$-$(date +%s)"

# Resolved on the host, passed in, and reported in the evidence file. The image has no .git.
CI_COMMIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")
CI_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
export CI_COMMIT_SHA CI_BRANCH

mkdir -p artifacts/local-ci

cleanup() {
  # Scoped to THIS project by name. `-v` removes only volumes this project declared; it cannot reach
  # a developer's database volume, which belongs to a different project.
  docker compose -p "$PROJECT" -f compose.ci.yml down -v --remove-orphans >/dev/null 2>&1 || true
}

STATUS=0

echo "ci: project $PROJECT"
echo "ci: building image (betting-standards-ci:local)"
if [ "$VERBOSE" -eq 1 ]; then
  docker compose -p "$PROJECT" -f compose.ci.yml build --progress plain || STATUS=$?
else
  docker compose -p "$PROJECT" -f compose.ci.yml build || STATUS=$?
fi

if [ "$STATUS" -ne 0 ]; then
  cleanup
  echo "ci: image build failed. Pipeline did not run." >&2
  exit "$STATUS"
fi

# `up` is not used: there are no long-running services to bring up in this repository, and `run`
# gives us the pipeline's exit code directly. When dependencies are added to compose.ci.yml, `run`
# still starts them and still honours `depends_on: condition: service_healthy` — the wait is a real
# health gate owned by compose, never a sleep in this script.
RUN_ARGS="run --rm --no-TTY"
STAGE_ARGS=""
[ "$VERBOSE" -eq 1 ] && STAGE_ARGS="--verbose"

# shellcheck disable=SC2086
docker compose -p "$PROJECT" -f compose.ci.yml $RUN_ARGS ci \
  node scripts/ci-stages.mjs $STAGE_ARGS || STATUS=$?

if [ "$STATUS" -ne 0 ] && [ "$KEEP_ON_FAILURE" -eq 1 ]; then
  echo "" >&2
  echo "ci: --keep-on-failure set. Compose project '$PROJECT' was NOT torn down." >&2
  echo "ci: inspect it with:" >&2
  echo "      docker compose -p $PROJECT -f compose.ci.yml run --rm ci sh" >&2
  echo "ci: and clean it up when finished with:" >&2
  echo "      docker compose -p $PROJECT -f compose.ci.yml down -v --remove-orphans" >&2
else
  cleanup
fi

if [ "$STATUS" -ne 0 ]; then
  echo "ci: FAILED (exit $STATUS)" >&2
  exit "$STATUS"
fi

echo "ci: PASSED"
exit 0
