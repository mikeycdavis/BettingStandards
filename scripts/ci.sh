#!/usr/bin/env sh
#
# THE authoritative local CI command (POSIX hosts, and any self-hosted GitHub runner).
# Windows equivalent: scripts/ci.ps1. Both are thin: the stage list lives in ci/pipeline.json and is
# executed by scripts/ci-stages.mjs inside the container. Neither wrapper knows what a stage is.
#
#   ./scripts/ci.sh                     run the full pipeline in Docker
#   ./scripts/ci.sh --verbose           also print each stage's rationale, and docker build output
#   ./scripts/ci.sh --keep-on-failure   leave the failed container and its image in place
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

# Unique to this run. Everything compose creates is namespaced under it, so teardown is exhaustive
# within the run and cannot touch another repository's containers, another run of this one, or a
# developer's own services.
RUN_ID="$$-$(date +%s)"
PROJECT="bs-ci-$RUN_ID"
CONTAINER="bs-ci-run-$RUN_ID"

# The image tag is unique too, and that is the fix for a real invariant hole rather than hygiene: a
# shared tag can be retagged by a concurrent run between this run's build and its execution, so the
# pipeline would evaluate another tree while recording this commit's SHA. See compose.ci.yml.
CI_IMAGE_TAG="$PROJECT"
export CI_IMAGE_TAG

CI_COMMIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")
CI_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
export CI_COMMIT_SHA CI_BRANCH

mkdir -p artifacts/local-ci

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker compose -p "$PROJECT" -f compose.ci.yml down -v --remove-orphans >/dev/null 2>&1 || true
  # Removes this run's TAG. Layers are content-addressed and stay cached for the next run.
  docker rmi "betting-standards-ci:$CI_IMAGE_TAG" >/dev/null 2>&1 || true
}

STATUS=0

echo "ci: project $PROJECT"
echo "ci: building image (betting-standards-ci:$CI_IMAGE_TAG)"
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

# Resolve what was actually built and record it. Nothing else can move this tag, but recording the
# ID means the evidence names the image that ran rather than a name that pointed at it.
CI_IMAGE_ID=$(docker image inspect --format '{{.Id}}' "betting-standards-ci:$CI_IMAGE_TAG" 2>/dev/null || echo "")
export CI_IMAGE_ID
[ -n "$CI_IMAGE_ID" ] && echo "ci: image $CI_IMAGE_ID"

# --rm is deliberately NOT used. The container has to survive its own exit for two reasons: the
# evidence file is copied out of it below, and --keep-on-failure has to leave something behind to
# inspect. Teardown removes it explicitly instead.
STAGE_ARGS=""
[ "$VERBOSE" -eq 1 ] && STAGE_ARGS="--verbose"

# shellcheck disable=SC2086
docker compose -p "$PROJECT" -f compose.ci.yml run --no-TTY --name "$CONTAINER" ci \
  node scripts/ci-stages.mjs $STAGE_ARGS || STATUS=$?

# Copied out rather than bind-mounted: no host directory has to be writable by the container's uid.
# Runs on a stopped container, so it works for a failed pipeline too — which is when the machine-
# readable result is most useful.
docker cp "$CONTAINER:/repo/artifacts/local-ci/latest.json" "artifacts/local-ci/latest.json" >/dev/null 2>&1 \
  || echo "ci: warning — could not copy the run result out of the container" >&2

if [ "$STATUS" -ne 0 ] && [ "$KEEP_ON_FAILURE" -eq 1 ]; then
  echo "" >&2
  echo "ci: --keep-on-failure set. Kept container '$CONTAINER' and image tag" >&2
  echo "    'betting-standards-ci:$CI_IMAGE_TAG'. Inspect the failed run with:" >&2
  echo "      docker logs $CONTAINER" >&2
  echo "      docker cp $CONTAINER:/repo/artifacts/local-ci/latest.json ." >&2
  echo "    or open a shell on the same image the run executed:" >&2
  echo "      docker run --rm -it --network none betting-standards-ci:$CI_IMAGE_TAG sh" >&2
  echo "    clean up when finished:" >&2
  echo "      docker rm -f $CONTAINER && docker rmi betting-standards-ci:$CI_IMAGE_TAG" >&2
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
