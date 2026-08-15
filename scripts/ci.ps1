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

# A project name unique to this run. Everything compose creates is namespaced under it, so teardown
# can be exhaustive without any risk of touching a developer's own containers, networks, or volumes
# -- including those of another repository running its CI at the same moment.
$Project = "bs-ci-$PID-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
$Compose = @('-p', $Project, '-f', 'compose.ci.yml')
$Status = 0

function Invoke-Cleanup {
    # Scoped to THIS project by name. -v removes only volumes this project declared; it cannot reach
    # a developer's database volume, which belongs to a different project.
    docker compose @Compose down -v --remove-orphans *>$null
}

try {
    Test-Tooling

    # Resolved on the host and passed in: the image deliberately contains no .git (see .dockerignore),
    # so this is how the run knows which commit it is evaluating.
    $env:CI_COMMIT_SHA = (& git rev-parse HEAD 2>$null)
    $env:CI_BRANCH = (& git rev-parse --abbrev-ref HEAD 2>$null)
    if ($LASTEXITCODE -ne 0) { $env:CI_COMMIT_SHA = ''; $env:CI_BRANCH = '' }

    New-Item -ItemType Directory -Force -Path (Join-Path $RepoRoot 'artifacts/local-ci') | Out-Null

    Write-Host "ci: project $Project"
    Write-Host "ci: building image (betting-standards-ci:local)"
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

    # `run` rather than `up`: this repository has no long-running services, and `run` yields the
    # pipeline's exit code directly. When dependencies are added to compose.ci.yml, `run` still
    # starts them and still honours `depends_on: condition: service_healthy` -- the wait is a real
    # health gate owned by compose, never a sleep in this script.
    $StageArgs = @()
    if ($VerbosePreference -eq 'Continue') { $StageArgs += '--verbose' }

    docker compose @Compose run --rm --no-TTY ci node scripts/ci-stages.mjs @StageArgs
    $Status = $LASTEXITCODE
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
    Write-Host "ci: -KeepOnFailure set. Compose project '$Project' was NOT torn down." -ForegroundColor Yellow
    Write-Host "ci: inspect it with:" -ForegroundColor Yellow
    Write-Host "      docker compose -p $Project -f compose.ci.yml run --rm ci sh"
    Write-Host "ci: and clean it up when finished with:" -ForegroundColor Yellow
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
