# Adopting these standards

How to use this pack from another project. Six steps, then the things that will surprise you.

## 1. Bootstrap

```bash
node <path-to-this-repo>/scripts/standards.mjs init . --dry-run
```

The dry-run prints exactly the operations a real run will execute — the same plan object drives both,
so the preview cannot describe something else. When it looks right, run it without `--dry-run`.

It writes `project-policy.yml`, `betting-policy.yml`, `AGENTS.md`, `CLAUDE.md`, and a decision-record
template. **It never overwrites.** A file it did not write is reported as a conflict and left alone.

## 2. Set your numbers

`betting-policy.yml` ships with placeholders. Replace them deliberately — this is the only place your
risk tolerance is expressed, and copying someone else's is copying their tolerance for losing money.

| Field | What it controls |
| --- | --- |
| `minEdge` | The smallest edge, **after** the uncertainty discount, that permits a BET |
| `kellyMultiplier` | Fraction of full Kelly. Must be ≤ 1 — full Kelly on an estimate is an over-bet |
| `unitPercent` | One unit as a fraction of bankroll |
| `maxSingleBetPct` | Hard ceiling on any one stake, applied even when Kelly recommends more |
| `maxGroupExposurePct` | Ceiling on total stake within one correlation group |
| `maxTotalExposurePct` | Ceiling on all open stake at once |
| `maxOddsAgeMinutes` | How old a price may be at decision time |
| `maxPredictionAgeMinutes` | How old the probability estimate may be |
| `longshotOddsThreshold` / `longshotMinDiscount` | Extra caution where the devig method is least reliable |

Set `minEdge` above what the market's hold and your own estimation error consume together. An edge
smaller than your error bar is noise.

## 3. See what applies

```bash
node <path>/scripts/standards.mjs plan .
```

This lists every rule, whether it will be evaluated automatically, and what evidence it needs. Rules
shown as `needs-attestation` cannot be checked by any tool — see step 6.

## 4. Record decisions

Every decision, BET **and PASS**, produces a JSON record in `ledger/`. Before committing one:

```bash
node <path>/scripts/standards.mjs check --record draft.json --dry-run
```

This runs the same code path as a real check and tells you which gates fail. If any do, the decision
is a PASS and those failures are its recorded reasons.

## 5. Gate on validate

```bash
node <path>/scripts/standards.mjs validate .
```

Exit `0` compliant, `1` a verdict failure, `2` a policy or schema that could not be read. Gate your CI
on this. Do **not** gate on `audit --strict`: that fails on advisory findings too, and the predictable
result is that someone disables the step.

## 6. Attest what machines cannot check

Eight rules prohibit motives — chasing a loss, betting for action, judging a decision by its result,
leaking future information into a backtest — and no tool can see any of them. They report
`not-evaluated` until a human records a review:

```yaml
attestations:
  bankroll.no-chasing-losses:
    status: approved
    reviewedBy: "Your Name"
    reviewedAt: "2026-01-01"
    evidence: "Reviewed every stake increase last quarter against its own recorded sizing."
    reviewedAgainst:
      paths: ["ledger"]
```

The `reviewedAgainst` digest makes the attestation go stale when the ledger changes, returning the
rule to `not-evaluated`. An attestation is **evidence, not a waiver**: it never overrides an automated
finding, and a rule the catalog does not mark attestable rejects one outright.

---

## Things that will surprise you

### You cannot waive a prohibition

Every rule at `level: forbidden` is non-exemptible. An exception declared against one is **rejected
and reported** — the attempt is itself a finding, and the verdict becomes `BLOCKED_BY_INVARIANT`.

This is the biggest difference from most policy-as-code frameworks, where an approved exception is
always available as an escape hatch. Here the only escape is that the rule has no subject in your
project at all, declared through `applicability` with a reason:

```yaml
applicability:
  line.clv-computed:
    status: not-applicable
    reason: "Our book publishes no closing prices, so closing-line value cannot be observed."
    reviewedAt: "2026-01-01"
    revisitWhen: "We start using a book that publishes closing prices."
```

### `not-applicable` and an exception are different claims

`not-applicable` says the rule has no subject here. An exception says it applies and you are knowingly
not satisfying it. Collapsing them lets real non-compliance hide inside a claim of irrelevance, so the
schema keeps them apart and rejects a policy asserting both for one rule.

Every `not-applicable` declaration needs a reason. One without it is indistinguishable from a rule
someone forgot.

### PASS is a success, and it is most of the output

Most edges do not clear the bar. A ledger where most decisions are PASSes is a functioning process,
not an idle one. Nothing in this pack counts a PASS as a missed opportunity, and you should not add
anything that does — see [Standard 20](standards/20-pass-decisions.md) R6.

A discretionary PASS is always available, even when every gate passes. A BET past a failed gate never
is.

### A clean report is narrower than it looks

`COMPLIANT` means everything that was **checked** passed. The coverage figure beside it says how much
was checked, and it is deliberately never folded into the score.

Two limits in particular: nothing inside a ledger can show what was left out of it, so an unrecorded
wager is invisible to every exposure cap; and the eight manual-review rules will always report
`not-evaluated` without an attestation.

### Do not fix a finding by changing the rule

Lowering a threshold because a wager falls just below it, marking an applicable rule not-applicable to
clear a finding, widening a tolerance until a mismatch disappears, or deleting a failing test — these
are the same act, and it is prohibited by `integrity.no-standard-weakening`.

If a threshold is genuinely wrong, change it as a separate, argued change that does not also deliver
the conclusion it enables, and record why.

## Version pinning

Set `standardVersion` in `project-policy.yml` to the version of this pack you are evaluating against.
Each decision record additionally pins the digest of the `betting-policy.yml` it was decided under, so
changing a threshold never retroactively re-judges past decisions — old records remain visibly
decisions made under different rules.
