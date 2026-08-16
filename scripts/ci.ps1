#!/usr/bin/env pwsh
<#
.SYNOPSIS
    THE authoritative local CI command for this repository (Windows / PowerShell hosts).

.DESCRIPTION
    Builds an ephemeral Docker environment and runs the complete pipeline declared in
    ci/pipeline.json inside it. POSIX equivalent: scripts/ci.sh. Both wrappers are thin — the stage
    list lives in the manifest and is executed by scripts/ci-stages.mjs. Neither wrapper knows what
    a stage is, so there is nothing here to drift out of step with GitHub Actions.

    Exit code is 0 only when every stage passed, and nonzero on any failure, including a failure to
    build the image or reach the Docker daemon.

.PARAMETER Verbose
    Print each stage's rationale and the full docker build output.

.PARAMETER KeepOnFailure
    Leave the compose project in place when the pipeline fails, so the container can be inspected.
    On success the project is always torn down.

.EXAMPLE
    .\scripts\ci.ps1

.EXAMPLE
    .\scripts\ci.ps1 -KeepOnFailure -Verbose
#>
[CmdletBinding()]
param(
    [switch]$KeepOnFailure
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot

# Native commands do not throw on nonzero exit, so every invocation below checks $LASTEXITCODE
# explicitly. Silence here would be a false green, which is the one failure mode this repository
# exists to prevent.
function Test-Tooling {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "docker is not on PATH. Local CI requires Docker; see docs/local-ci.md (Prerequisites)."
    }
    docker compose version *>$null
    if ($LASTEXITCODE -ne 0) { throw "'docker compose' is unavailable (Compose v2 required)." }
    docker info *>$null
    if ($LASTEXITCODE -ne 0) { throw "the Docker daemon is not reachable. Start Docker Desktop and retry." }
}

# Unique to this run. Everything compose creates is namespaced under it, so teardown is exhaustive
# within the run and cannot touch another repository's containers, another run of this one, or a
# developer's own services.
$RunId = "$PID-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
$Project = "bs-ci-$RunId"
$Container = "bs-ci-run-$RunId"
$Compose = @('-p', $Project, '-f', 'compose.ci.yml')
$Status = 0

# The image tag is unique too, and that is the fix for a real invariant hole rather than hygiene: a
# shared tag can be retagged by a concurrent run between this run's build and its execution, so the
# pipeline would evaluate another tree while recording this commit's SHA. See compose.ci.yml.
$env:CI_IMAGE_TAG = $Project

function Invoke-Cleanup {
    # Scoped to THIS run by name. -v removes only volumes this project declared; it cannot reach a
    # developer's database volume, which belongs to a different project. `rmi` drops this run's TAG
    # only -- layers are content-addressed and stay cached for the next run.
    docker rm -f $Container *>$null
    docker compose @Compose down -v --remove-orphans *>$null
    docker rmi "betting-standards-ci:$($env:CI_IMAGE_TAG)" *>$null
}

try {
    Test-Tooling

    # Resolved on the host and passed in: the image deliberately contains no .git (see .dockerignore),
    # so this is how the run knows which commit it is evaluating.
    $env:CI_COMMIT_SHA = (& git rev-parse HEAD 2>$null)
    $env:CI_BRANCH = (& git rev-parse --abbrev-ref HEAD 2>$null)
    if ($LASTEXITCODE -ne 0) { $env:CI_COMMIT_SHA = ''; $env:CI_BRANCH = '' }

    New-Item -ItemType Directory -Force -Path (Join-Path $RepoRoot 'artifacts/local-ci') | Out-Null
    # Delete the previous run's result BEFORE this one starts. If the build fails, or the container
    # never gets far enough to write one, the path advertised as "the latest result" must be empty
    # rather than still holding an earlier PASS. Absence is readable as "no result"; a stale pass is
    # not readable as anything but a pass.
    Get-Item -ErrorAction Ignore (Join-Path $RepoRoot 'artifacts/local-ci/latest.json') | Remove-Item -Force -Confirm:$false

    Write-Host "ci: project $Project"
    Write-Host "ci: building image (betting-standards-ci:$($env:CI_IMAGE_TAG))"
    if ($PSBoundParameters.ContainsKey('Verbose') -or $VerbosePreference -eq 'Continue') {
        docker compose @Compose build --progress plain
    } else {
        docker compose @Compose build
    }
    if ($LASTEXITCODE -ne 0) {
        $Status = $LASTEXITCODE
        Invoke-Cleanup
        Write-Error "ci: image build failed. Pipeline did not run."
        exit $Status
    }

    # Resolve what was actually built and record it. Nothing else can move this tag, but recording
    # the ID means the evidence names the image that ran rather than a name that pointed at it.
    $env:CI_IMAGE_ID = (& docker image inspect --format '{{.Id}}' "betting-standards-ci:$($env:CI_IMAGE_TAG)" 2>$null)
    if ($LASTEXITCODE -ne 0) { $env:CI_IMAGE_ID = '' } else { Write-Host "ci: image $($env:CI_IMAGE_ID)" }

    # `run` rather than `up`: this repository has no long-running services, and `run` yields the
    # pipeline's exit code directly. When dependencies are added to compose.ci.yml, `run` still
    # starts them and still honours `depends_on: condition: service_healthy` -- the wait is a real
    # health gate owned by compose, never a sleep in this script.
    #
    # --rm is deliberately NOT used. The container must survive its own exit so the evidence file can
    # be copied out, and so -KeepOnFailure has something to leave behind. Teardown removes it.
    $StageArgs = @()
    if ($VerbosePreference -eq 'Continue') { $StageArgs += '--verbose' }

    docker compose @Compose run --no-TTY --name $Container ci node scripts/ci-stages.mjs @StageArgs
    $Status = $LASTEXITCODE

    # Copied out rather than bind-mounted: no host directory has to be writable by the container's
    # uid. Works on a stopped container, so a failed pipeline still yields its machine-readable
    # result -- which is when it is most useful.
    docker cp "${Container}:/repo/artifacts/local-ci/latest.json" (Join-Path $RepoRoot 'artifacts/local-ci/latest.json') *>$null
    if ($LASTEXITCODE -ne 0) { Write-Host "ci: warning - could not copy the run result out of the container" -ForegroundColor Yellow }
}
catch {
    Write-Host "ci: $($_.Exception.Message)" -ForegroundColor Red
    $Status = 2
    Invoke-Cleanup
    Pop-Location
    exit $Status
}

if ($Status -ne 0 -and $KeepOnFailure) {
    Write-Host ""
    Write-Host "ci: -KeepOnFailure set. Kept container '$Container' and image tag" -ForegroundColor Yellow
    Write-Host "    'betting-standards-ci:$($env:CI_IMAGE_TAG)'. Inspect the failed run with:" -ForegroundColor Yellow
    Write-Host "      docker logs $Container"
    Write-Host "      docker cp ${Container}:/repo/artifacts/local-ci/latest.json ."
    Write-Host "    or open a shell on the same image the run executed:" -ForegroundColor Yellow
    Write-Host "      docker run --rm -it --network none betting-standards-ci:$($env:CI_IMAGE_TAG) sh"
    Write-Host "    clean up when finished:" -ForegroundColor Yellow
    Write-Host "      docker rm -f $Container; docker rmi betting-standards-ci:$($env:CI_IMAGE_TAG)"
    Write-Host "      docker compose -p $Project -f compose.ci.yml down -v --remove-orphans"
} else {
    Invoke-Cleanup
}

Pop-Location

if ($Status -ne 0) {
    Write-Host "ci: FAILED (exit $Status)" -ForegroundColor Red
    exit $Status
}

Write-Host "ci: PASSED" -ForegroundColor Green
exit 0
