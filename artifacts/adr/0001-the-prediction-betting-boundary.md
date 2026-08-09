# ADR 0001 — The prediction/betting boundary

**Status:** Accepted · **Date:** 2026-08-09 · **Deciders:** repository owner

## Context

Both governing briefs require this pack to remain separate from prediction standards. The source
prompt states it as a premise: a prediction can be correct and still represent a bad wager.

The question this ADR settles is what "separate" means mechanically. Three readings were available:

1. This pack evaluates the prediction too, and rejects poorly supported ones.
2. This pack references prediction-standards rules by id, deferring to them.
3. This pack consumes the prediction as an opaque input and evaluates nothing upstream of it.

Reading 1 would duplicate an entire other domain and produce two definitions of prediction quality.
Reading 2 requires a cross-pack rule-reference mechanism that does not exist anywhere in this family
of repositories, and would make this repository depend on another — which the expanded brief prohibits
outright.

## Decision

**This pack consumes the estimated fair probability as an opaque, provenance-carrying input, and
evaluates nothing upstream of it.**

The boundary, stated once so the standards can rely on it:

> Prediction standards determine whether a prediction deserves belief. These standards determine
> whether that prediction, at the offered price and under the applicable risk constraints, deserves
> money.

Mechanically:

- The decision record carries `prediction.fairProb`, `prediction.source`, and `prediction.predictedAt`
  as required fields.
- No rule in this catalog evaluates how the probability was produced, whether the model is sound, or
  whether the estimate is calibrated in isolation.
- Two things about the input *are* required, because they are properties of the wagering decision
  rather than of the prediction: it must name a source (Standard 6 R2), and it must be fresh
  (Standard 16).
- Cross-pack coupling is by **artifact contract** — the named input fields — never by rule id.

## Alternatives considered

**Evaluate the prediction here.** Rejected: it would make this pack a worse version of a pack that
should exist separately, and would create a second definition of prediction quality that drifts from
the first.

**Reference prediction-standards rules by id.** Rejected: no such mechanism exists, and building one
would create the dependency the expanded brief forbids. It would also mean this pack could not be
evaluated at all without another repository present.

**Require a calibration record with each estimate.** Rejected as scope creep. Calibration is a
property of a model over many predictions, which is prediction standards' subject, and requiring it
per wager would demand evidence the bettor usually cannot produce at decision time.

## Consequences

- This pack is genuinely standalone: no runtime, test, or CI reference to any other repository.
- The weakest point in the chain is explicit. `probability.fair-source-recorded` carries
  `assurance: partial`, and its note says it establishes that a source is *named*, not that the named
  source produced the number or that the number is any good. That is the honest limit of what a
  wagering framework can check about an input it does not produce.
- A project using both packs joins them at the artifact: the prediction pack's output becomes this
  pack's `prediction` block. Neither repository needs to know about the other.
