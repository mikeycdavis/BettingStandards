#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Submit a pull request for a commit that has actually passed local CI.

.DESCRIPTION
    THE INVARIANT THIS ENFORCES:

        The commit pushed for a PR is exactly the commit that passed the complete local Docker CI
        pipeline.

    Enforced by construction, not by convention:

      - the working tree must be clean BEFORE the SHA is recorded, so tree == commit;
      - the SHA is resolved before CI and re-resolved after, and any difference aborts;
      - the push names the verified SHA explicitly (git push origin <sha>:refs/heads/<branch>)
        rather than pushing "whatever HEAD is now", so even a race between the check and the push
        cannot publish an unverified commit;
      - nothing here ever creates a commit. A tool that commits on your behalf to make a pipeline
        pass is a tool that can make an unreviewed change look verified.

    POSIX equivalent: scripts/submit-pr.sh. The two implement the same checks in the same order.

.PARAMETER Base
    Base branch for the PR. Defaults to the remote's default branch.

.PARAMETER Title
    PR title. Defaults to the subject of the verified commit.

.PARAMETER Body
    PR body. The Local CI evidence block is APPENDED to it, never substituted for it.

.PARAMETER Draft
    Create the PR as a draft.

.PARAMETER Remote
    Git remote to push to. Default: origin.

.EXAMPLE
    .\scripts\submit-pr.ps1

.EXAMPLE
    .\scripts\submit-pr.ps1 -Draft -Base develop -Title "Short title"

.NOTES
    Supported override (used by test/local-ci.test.mjs, and by a self-hosted runner whose CI entry
    point differs):  $env:SUBMIT_PR_CI_CMD  -- the command executed as the CI gate.
    Default: pwsh -NoProfile -File ./scripts/ci.ps1

    Exit codes: 0 submitted, 1 verification refused, 2 invocation/environment fault.
#>
[CmdletBinding()]
param(
    [string]$Base = '',
    [string]$Title = '',
    [string]$Body = '',
    [string]$Remote = 'origin',
    [switch]$Draft
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot

function Stop-With([string]$Message, [int]$Code) {
    Write-Host $Message -ForegroundColor Red
    Pop-Location
    exit $Code
}

# ── 1. A git repository ───────────────────────────────────────────────────────────────────────────
& git rev-parse --is-inside-work-tree *>$null
if ($LASTEXITCODE -ne 0) { Stop-With "submit-pr: not a git repository." 2 }

$Branch = (& git rev-parse --abbrev-ref HEAD).Trim()
if ($Branch -eq 'HEAD') {
    Stop-With "submit-pr: HEAD is detached. Check out a branch before submitting." 1
}

# ── 2. Not the default branch ─────────────────────────────────────────────────────────────────────
$DefaultBranch = (& git symbolic-ref --quiet --short "refs/remotes/$Remote/HEAD" 2>$null)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($DefaultBranch)) {
    $DefaultBranch = ''
    foreach ($candidate in @('main', 'master')) {
        & git show-ref --verify --quiet "refs/heads/$candidate"
        if ($LASTEXITCODE -eq 0) { $DefaultBranch = $candidate; break }
    }
    if ([string]::IsNullOrWhiteSpace($DefaultBranch)) { $DefaultBranch = 'main' }
} else {
    $DefaultBranch = $DefaultBranch.Trim() -replace "^$([regex]::Escape($Remote))/", ''
}
if ([string]::IsNullOrWhiteSpace($Base)) { $Base = $DefaultBranch }

if ($Branch -eq $DefaultBranch) {
    Write-Host "submit-pr: refusing to submit from '$Branch', which is the default branch." -ForegroundColor Red
    Stop-With "           Create a feature branch:  git switch -c my-change" 1
}

# ── 3. Clean working tree ─────────────────────────────────────────────────────────────────────────
# This is what makes "the tree that was verified" and "the commit that is pushed" the same object.
$Dirty = & git status --porcelain
if ($Dirty) {
    Write-Host "submit-pr: the working tree is dirty. CI verifies a commit, not a work in progress." -ForegroundColor Red
    Write-Host ""
    $Dirty | ForEach-Object { Write-Host "  $_" }
    Write-Host ""
    Stop-With "           Commit or stash these changes, then re-run. This command will never commit on your behalf." 1
}

# ── 4. Record the SHA under verification ──────────────────────────────────────────────────────────
$ShaBefore = (& git rev-parse HEAD).Trim()

Write-Host "submit-pr: repository  $(Split-Path -Leaf $RepoRoot)"
Write-Host "submit-pr: branch      $Branch"
Write-Host "submit-pr: base        $Base"
Write-Host "submit-pr: commit      $ShaBefore"
Write-Host "submit-pr: running local CI (this is the gate; nothing is pushed until it passes)"
Write-Host ""

# ── 5. The gate ───────────────────────────────────────────────────────────────────────────────────
$CiCmd = $env:SUBMIT_PR_CI_CMD
if ([string]::IsNullOrWhiteSpace($CiCmd)) {
    & (Join-Path $PSScriptRoot 'ci.ps1')
} else {
    & pwsh -NoProfile -Command $CiCmd
}
$CiStatus = $LASTEXITCODE

if ($CiStatus -ne 0) {
    Write-Host ""
    Stop-With "CI failed. No branch was pushed and no PR was created." 1
}

# ── 6. The same commit, still ─────────────────────────────────────────────────────────────────────
$ShaAfter = (& git rev-parse HEAD).Trim()
if ($ShaBefore -ne $ShaAfter) {
    Write-Host ""
    Write-Host "HEAD changed after CI verification. The current commit has not been verified. Re-run CI before submitting." -ForegroundColor Red
    Write-Host "           verified: $ShaBefore"
    Stop-With "           current:  $ShaAfter" 1
}

# Defence in depth: an edit made while CI was running means the tree on disk is no longer the tree
# that was verified. The commit would still be the verified one, so this is reported as a refusal
# rather than silently accepted.
if (& git status --porcelain) {
    Write-Host ""
    Stop-With "submit-pr: the working tree was modified while CI was running. Nothing was pushed." 1
}

# ── 7. Push exactly the verified commit ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "submit-pr: CI passed. Pushing verified commit $ShaBefore to $Remote/$Branch" -ForegroundColor Green
& git push $Remote "${ShaBefore}:refs/heads/$Branch"
if ($LASTEXITCODE -ne 0) { Stop-With "submit-pr: push failed. No PR was created." 1 }

# ── 8. Open the PR ────────────────────────────────────────────────────────────────────────────────
if ([string]::IsNullOrWhiteSpace($Title)) { $Title = (& git log -1 --pretty=%s $ShaBefore).Trim() }

$Evidence = @"

---

## Local CI

Verified commit: ``$ShaBefore``
Result: **PASS**
Environment: Docker (``compose.ci.yml``, image ``betting-standards-ci:local``, no network)
Pipeline: ``ci/pipeline.json`` via ``scripts/ci-stages.mjs``

This pull request was verified by the repository's **local** containerized CI pipeline before the
branch was pushed. GitHub-hosted Actions are a separate system and this block makes no claim about
them: if a hosted run appears on this PR, read its own status.

The pushed commit is exactly the commit that passed. ``scripts/submit-pr.ps1`` records the SHA before
CI, re-resolves it after, refuses on any difference, and pushes the SHA by name.
"@

if ([string]::IsNullOrWhiteSpace($Body)) { $Body = (& git log -1 --pretty=%B $ShaBefore) -join "`n" }
$PrBody = "$Body`n$Evidence"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Stop-With "submit-pr: verified commit pushed, but GitHub CLI (gh) is not installed, so no PR was created.`n           Open it manually against base '$Base'." 2
}
& gh auth status *>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Stop-With "submit-pr: verified commit pushed, but gh is not authenticated, so no PR was created.`n           Run 'gh auth login' and retry, or open the PR manually against base '$Base'." 2
}

# An open PR for this branch already exists. The push above already moved its head, so the evidence
# block in its body now describes a DIFFERENT commit than the one under review -- a stale
# "Result: PASS" against a superseded SHA is exactly the false claim this workflow exists to prevent.
# Refresh it, preserving whatever the author wrote above the block.
$Existing = (& gh pr list --head $Branch --state open --json number --jq '.[0].number // empty' 2>$null)
if ($LASTEXITCODE -ne 0) { $Existing = '' }

if (-not [string]::IsNullOrWhiteSpace($Existing)) {
    $Existing = $Existing.Trim()
    $CurrentBody = (& gh pr view $Existing --json body --jq .body 2>$null) -join "`n"

    if ([string]::IsNullOrWhiteSpace($PSBoundParameters['Body'])) {
        # Everything above the evidence heading is the author's. Trailing blank lines and the `---`
        # rule that introduces the block are trimmed so repeated runs cannot accumulate separators.
        $AuthorPart = ($CurrentBody -split '(?m)^## Local CI\s*$')[0]
        $AuthorPart = $AuthorPart -replace '(?s)(\r?\n)+(-{3,}\s*)?\s*$', ''
    } else {
        $AuthorPart = $Body
    }

    Write-Host "submit-pr: PR #$Existing is already open for '$Branch'; its head is now the verified commit."
    Write-Host "submit-pr: refreshing the Local CI evidence block so it names $ShaBefore"
    & gh pr edit $Existing --body "$AuthorPart`n$Evidence"
    $PrStatus = $LASTEXITCODE
    if ($PrStatus -eq 0) { & gh pr view $Existing --json url --jq .url }
    Pop-Location
    exit $PrStatus
}

$GhArgs = @('pr', 'create', '--base', $Base, '--head', $Branch, '--title', $Title, '--body', $PrBody)
if ($Draft) { $GhArgs += '--draft' }

Write-Host "submit-pr: creating pull request"
& gh @GhArgs
$PrStatus = $LASTEXITCODE

Pop-Location
exit $PrStatus
