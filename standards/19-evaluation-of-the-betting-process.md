# Standard 19 — Evaluation of the Betting Process

Grading a betting process by its profit is grading it through a screen of variance so thick that most
of what a bettor concludes from it is noise. This standard defines what to measure instead, how large
a sample is needed before concluding anything, and prohibits the backtest error that manufactures
false confidence.

Source: the "evaluation of betting process" item of the "Required standards" list in
[`artifacts/prompts/original-prompt.md`](../artifacts/prompts/original-prompt.md).

## Scope

Applies to any review of a wagering process: a periodic self-review, a report to someone else, or a
backtest of a proposed strategy.

## Requirements

### R1 — Metrics are defined before the results are seen

The metrics used to grade the process, and the sample size below which no conclusion is drawn, are
written down in advance.

Choosing metrics after seeing results is choosing the metric that flatters them, and it is
particularly easy to do accidentally: the numbers arrive, one of them looks meaningful, and it becomes
the number that gets reported. Fixing the metrics beforehand costs nothing and removes the option.

### R2 — The metrics are decision-time metrics; profit is a lagging indicator

The primary measures are computed from what was known when each decision was made:

- **Closing-line value in aggregate** ([Standard 17](17-closing-line-value.md)) — whether the process
  finds prices the market later agrees with. This is the primary metric, because it excludes outcome
  variance entirely.
- **Threshold adherence** — the proportion of BETs that cleared the minimum edge, stayed inside the
  sizing rule, and respected the caps. Anything other than 100% is a process finding.
- **PASS discipline** — how many decisions were declined and why. A process that never passes is not
  applying its thresholds.
- **Calibration** — over a large sample, whether outcomes at a given estimated probability occur at
  roughly that rate. This is the one metric that legitimately uses results, and it says something
  about the *estimates* rather than about any wager.

Profit and loss is recorded and reported, and it is read as a lagging indicator with wide error bars.
A sound process loses over samples large enough to feel conclusive, and an unsound one wins. Treating
profit as the primary signal means abandoning good processes after normal losing stretches and
persisting with bad ones after lucky runs — [Standard 1](01-the-fundamental-invariant.md)'s error at
the level of a whole process rather than a single wager.

### R3 — No conclusion below the stated sample floor

Below the floor set in R1, the honest report is "insufficient sample", not a number with a caveat
attached. A percentage computed over eleven wagers will be read as information no matter how it is
qualified.

### R4 — Evaluation reads decision fields; results are used only where R2 permits

A review examines the price, the estimate, the discount, the edge, and the constraints as they stood.
Results enter only through calibration and closing-line value, both of which are statements about the
process over a sample.

A review that concludes "this was a bad bet because it lost" has violated
[Standard 1](01-the-fundamental-invariant.md) regardless of what else it examined.

### R5 — Backtests MUST NEVER use information unavailable at the simulated decision time

**No historical simulation uses closing prices as though they were available when the wager was
placed, lineups announced after the simulated decision, revised statistics, or any other information
that did not exist at the moment being simulated.**

This is the most consequential prohibition in the pack, and the reason is the shape of its failure. A
leaked backtest produces a confident, quantified, entirely false expectation of profit — and it
produces it in the direction that encourages betting, at a scale the bettor then sizes against.

It is rarely deliberate. A data set assembled after the fact simply *contains* what became known
later; using it feels like using history. The revised statistic, the final line, the cleaned box score
— each arrived after the moment being simulated, and none of them announces itself.

The remedy is to reconstruct the information set as it stood: prices and data timestamped at or before
each simulated decision. Where that reconstruction is not possible, the honest answer is that the
backtest cannot be run — not that it can be run with what is available.

### R6 — Reviews happen on a cadence, not in response to results

A review triggered by a loss happens after losses and gets skipped after wins. That examines the
process at its least representative moments and mistakes variance for information. A fixed interval
removes the selection effect.

## Additions this standard makes beyond the source

The source says "evaluation of betting process" and "Never: use historical backtests that leak future
information". Everything else is this pack's:

- R1's requirement that metrics precede results, and R3's sample floor.
- R2's four specific metrics, the designation of closing-line value as primary, and the argument that
  treating profit as primary reproduces Standard 1's error at process scale.
- R4's restriction on how results may enter a review.
- R5's account of *why* leakage is usually accidental, the enumerated examples, and the instruction
  that an unreconstructable information set means the backtest cannot be run.
- R6 in full.

## Relationship to other standards

[Standard 1](01-the-fundamental-invariant.md) is the principle this operationalises at process scale.
[Standard 17](17-closing-line-value.md) supplies the primary metric.
[Standard 18](18-record-keeping.md) supplies the records, and its completeness limitation bounds every
conclusion here. [Standard 12](12-unit-sizing.md) and [Standard 14](14-correlated-bets.md) name this
standard's review as where their unverifiable judgements get examined.

## Implementation

**Met, as documentation.** `evaluation.process-metrics-defined` is `validationType: document` with
`assurance: partial`: the check establishes that this document exists and defines the metrics and the
floor. Whether they are the right metrics, and whether they were chosen before the results were seen,
is a judgement no check can make.

**Not met, and deliberately not faked.** `evaluation.no-lookahead-backtests` is `manual-review` with
`assurance: none`. Leakage is a property of how a data set was assembled, not a string that appears in
a file — a backtest can be entirely leaked without any artifact in this repository looking wrong.
Writing a heuristic here would produce exactly the false confidence the rule is about. It reports
not-evaluated until a human attests to having reconstructed the historical information set, and the
tooling will never report it satisfied because nothing was found.

`evaluation.review-cadence` is likewise `manual-review`: a review is a human activity, recorded as an
attestation with a content digest so it goes stale when the ledger it examined changes.

In this repository both are declared **not-applicable** with reasons — no wagering process is being
run here, and no backtests exist. That is an applicability decision about this project, not a
judgement that the rules are unimportant; `evaluation.no-lookahead-backtests` is one of the easiest
prohibitions to violate accidentally, which is why
[`examples/violations/`](../examples/violations/evaluation.no-lookahead-backtests.md) documents it at
length.
