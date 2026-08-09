# Standard 6 — Fair Probability

Two different numbers are called the fair probability, and a decision needs both. The **market's**
fair probability is what the prices say once the margin is removed. The **estimated** fair
probability is what the bettor believes. Edge is the distance between them, which means a record that
does not keep them apart cannot compute one.

Source: the "fair probability" item of the "Required standards" list in
[`artifacts/prompts/original-prompt.md`](../artifacts/prompts/original-prompt.md).

## Scope

Applies to every decision. The *production* of the estimated fair probability is outside this pack
(see [Standard 2](02-the-decision-pipeline.md) R2); this standard governs how it is recorded, and how
the market's fair probability is derived.

## Requirements

### R1 — The market's fair probability is derived by the multiplicative method

```text
fairProbᵢ = impliedProbᵢ / Σ impliedProb
```

Each outcome keeps its share of the total. The results must sum to 1; a method that does not is
broken, and the implementation asserts this rather than trusting it.

**Why this method and not another.** The additive method — subtracting the margin equally across
outcomes — produces negative fair probabilities at long prices, which is not an approximation error
but a wrong answer. Power and Shin methods need iterative solvers, and every line of solver is
machinery that has to be verified before anyone can trust a number that came out of it: more
unverified surface than the bias it removes.

**The known cost of this choice, stated rather than buried.** The multiplicative method overstates
the fair probability of longshots, because bookmakers load more margin onto long prices than onto
short ones. This pack does not pretend otherwise. It answers the bias mechanically instead:
[Standard 9](09-uncertainty-discount.md) R5 requires a minimum uncertainty discount at long prices,
enforced from policy. A known bias with a guard on it is honest; a known bias left unmentioned is not.

### R2 — The estimated fair probability records its source and the time it was made

Every estimate names what produced it — a model and run, a documented method, a person — and when.

This pack cannot check whether an estimate is any good. What it can insist on is that the estimate be
*attributable*, because an estimate with no source cannot be distinguished from a number chosen to
justify a wager. Provenance is the only defence available at this boundary, and it is a weak one; it
is stated as such in the catalog.

The timestamp feeds [Standard 16](16-stale-predictions.md): an estimate has a shelf life.

### R3 — Market and estimate are recorded separately and never reconciled by adjustment

Both numbers appear in the record, each with its own provenance. Where they disagree, the
disagreement *is* the edge — it is not a discrepancy to be resolved.

Specifically, an estimate MUST NOT be nudged toward the market's fair probability to make it look
more reasonable, nor away from it to manufacture an edge. If the market's price is genuine evidence
about the outcome, that belongs in the estimate at the time it is produced, upstream of this pack,
and with the reasoning recorded there.

### R4 — Gambler's-fallacy reasoning MUST NEVER be used

**No probability estimate is raised or lowered on the grounds that an independent outcome is overdue,
has run hot, or must balance out.** A coin that has landed heads nine times is not more likely to
land tails.

The fallacy is persuasive precisely because it feels like evidence — a streak is real, observable,
and salient. But a probability adjusted for a streak has been moved by something that carries no
information, and every number downstream of it inherits the error while looking exactly as rigorous
as before.

Where a streak genuinely is informative — fatigue across a schedule, a cumulative injury, a system
someone has adapted to — the *causal mechanism* is what belongs in the estimate, recorded so it can
be examined. "They are due" is not a mechanism.

## Additions this standard makes beyond the source

The source says "fair probability" and "Never: use gambler's-fallacy reasoning". Everything else is
this pack's:

- R1's formula, the choice of the multiplicative method, the reasons for rejecting the additive,
  power, and Shin alternatives, and the disclosure of the longshot bias with its mechanical guard.
- R2 and R3 in full, including the prohibition on reconciling the two numbers by adjustment.
- R4's distinction between a streak and a causal mechanism, and the requirement that the mechanism be
  recorded where it can be examined.

## Relationship to other standards

[Standard 5](05-vig.md) provides the implied probabilities and requires the full market this method
needs. [Standard 7](07-edge.md) consumes both fair probabilities. [Standard 9](09-uncertainty-discount.md)
carries the longshot floor that answers this method's known bias.
[Standard 16](16-stale-predictions.md) uses the estimate's timestamp.

## Implementation

**Met.** `probability.fair-source-recorded` is evaluated on every record: the schema requires
`prediction.source` and `prediction.predictedAt`. The multiplicative method is implemented in
[`scripts/betmath.mjs`](../scripts/betmath.mjs), which asserts that the resulting probabilities sum to
1 and throws if they do not — a broken devig would otherwise surface as a plausible edge rather than
as an error.

**Not met, and cannot be.** `probability.no-gamblers-fallacy` is `manual-review` with
`assurance: none`. The reasoning behind an estimate is not in the record, and a text scan for words
like "due" would catch the careless case while missing the substance and flagging honest prose. The
rule reports not-evaluated until a human attests to it.

Note also the limit on R2: the check establishes that a source is *named*, not that the named source
produced the number. The catalog says so.
