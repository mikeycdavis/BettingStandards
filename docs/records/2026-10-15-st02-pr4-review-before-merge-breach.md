# Breach record: PR #4 merged before the required exact-head review (ST-02)

Dated: 2026-10-15. Recorded under the owner's Batch 2 decision on ST-02 (issue #14), option A.

## The breach

ST-02 (#14) required an external review of PR #4 at its exact current HEAD, before merge, tag, or release.

PR #4 merged before the required exact-head review. The before-merge timing criterion was not met.

The later review covered an identical tree, and every resulting finding was fixed in #24 and #25.

## Facts (re-read from GitHub on 2026-10-15)

| Item | Value |
| --- | --- |
| PR #4 head at merge | `28854ee676e325c046a7e6bf25ad3361bc4a7419` |
| PR #4 merged | 2026-09-30T20:34:56Z as `2888621628abb042dc47c1cd90ae5cb98cfb8d0f` |
| Last review that named a head before merge | Codex on `23dfb7074a41b2c7e83a0162059424fbfc63e2e2`, 2026-08-27T22:35:29Z |
| First review of head `28854ee` | Codex, 2026-10-03T20:57:55Z, recorded against merge commit `2888621` (manual request, 2026-10-03T20:48:48Z) |
| Tree of `28854ee` and of `2888621` | both `be862f57659d3bff596b72509867dd4bf868e479` |
| Fixes for the findings | #24 (`536ff98`) and #25 (`a887590`) |

The reviewed content is the merged content (identical tree), so the exact-head review was substantively obtained, but only after the merge.

## What this record does not claim

- It does not claim that the before-merge timing criterion was met.
- It does not close or alter FE-01 (#12) or EP-04 (#11); both remain open while ST-05 (#17) is open.
- It does not tag or release v2.0.0.
