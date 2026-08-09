# ADR 0003 — Rule identity

**Status:** Accepted · **Date:** 2026-08-09 · **Deciders:** repository owner

## Context

Rule identity has to be fixed before any rule is written. The reference framework learned this the
expensive way: its source specification used camelCase key names, its catalog wanted kebab-case ids,
both got written, and reconciling them required an ADR plus a permanent alias mechanism.

## Decision

**Rule ids are `category.kebab-case-name`**, matching the pattern
`^[a-z][a-z0-9]*(\.[a-z0-9]+(-[a-z0-9]+)*)+$`, enforced in the catalog loader and in the policy
schema's `propertyNames`. A non-conforming id is rejected at load rather than accepted and normalised.

**There is no alias mechanism.** A rule declaring `aliases` is rejected by the loader.

**Thirteen categories**, each a file under `rules/`: `odds`, `probability`, `vig`, `edge`, `ev`,
`uncertainty`, `bankroll`, `exposure`, `line`, `record`, `evaluation`, `decision`, `integrity`.

**Prohibition ids begin with `no-` after the category** — `bankroll.no-martingale`,
`vig.no-ignored-vig` — so a prohibition is recognisable at a glance in a policy file or a finding.

**Each pack owns its category namespace.** Ids are unique within a pack and never shared across packs;
a consumer of several packs joins on the pair (pack, ruleId).

## Alternatives considered

**Carry an alias table anyway, for future flexibility.** Rejected. The reference framework's alias
table exists to absorb an injury this repository never suffered. An alias is a second name for one
rule, and second names drift — the table would be a place for two definitions to diverge, added
speculatively against a problem that does not exist here.

**A pack-level prefix such as BET-001.** Rejected. It duplicates information the repository already
carries, and a numeric id says nothing about what a rule governs. `bankroll.no-martingale` is readable
in a finding; BET-014 requires a lookup.

**Numbering rules within a standard, such as S12-R4.** Rejected: it couples rule identity to the
standards series, so renumbering a standard would rename every rule beneath it.

## Consequences

- Ids are stable and readable, and a prohibition is visually distinct from a requirement.
- The `no-` prefix is a convention rather than a loader constraint. What the loader enforces are the
  properties that matter: `forbidden` implies `nonExemptible` and `severity: error`.
- With no alias machinery, a rule id cannot be renamed compatibly. A rename is a supersession — the
  old rule gains `supersededBy`, the new one is added, and both are visible in the diff.
