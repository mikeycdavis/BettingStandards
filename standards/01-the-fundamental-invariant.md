# Standard 1 — The Fundamental Invariant

A good bet can lose. A bad bet can win. Bet quality is determined from the information available at
decision time — never from the eventual outcome.

This is the first standard because every other one inherits from it. The pipeline exists to make a
decision that can be judged on its inputs; the record format exists to preserve those inputs; the
digest exists to stop them from changing once the result is known. Remove this invariant and the rest
of the pack becomes bookkeeping for a story about how well someone has been doing.

Source: the "Fundamental invariant" section of
[`artifacts/prompts/original-prompt.md`](../artifacts/prompts/original-prompt.md), which states it as:

> Good bet ≠ winning bet.
> Bad bet ≠ losing bet.

## Scope

Applies to every judgement anyone makes about a wagering decision — the bettor's own review, an
agent's report, a performance summary, a coaching conversation. It applies to individual wagers and
to the process that produced them.

It does **not** apply to judgements about *outcomes*. A losing wager did lose, the bankroll is
smaller, and this standard says nothing to the contrary. What it governs is the separate claim that
the loss tells you the decision was wrong.

## Requirements

### R1 — Judge a decision only from information available when it was made

The quality of a wager is a function of the price, the probability estimate, the uncertainty, and the
constraints as they stood at the moment of the decision. Any assessment that uses information which
arrived later — the result, the closing line, an injury announced after the wager, the final score —
is assessing something other than the decision.

The practical test: could the assessment have been made *before* the event, given the record? If not,
it is not an assessment of the decision.

### R2 — A winning wager MUST NOT be treated as proof it was a good bet

A win is one sample from a distribution the wager was always going to have. A bet with a 30% chance
of winning wins roughly three times in ten, and each of those wins is fully compatible with the
decision having been a mistake.

This direction is the more dangerous of the two, because nobody investigates a win. A process that
takes bad prices and gets lucky early receives exactly the same feedback as one that is working, and
the bettor learns to keep going.

### R3 — A losing wager MUST NOT be treated as proof it was a bad bet

A loss is also one sample. A wager taken at a genuine edge loses often — most of the time, at long
prices — and the loss says nothing about whether the price was wrong.

The cost of getting this backwards is that a sound process gets abandoned after a normal losing
stretch, which is the most common way a disciplined bettor stops being one. The abandonment usually
arrives dressed as learning.

### R4 — A quality claim cites the decision record, not the result

Any statement that a wager was good or bad must point at the decision-time evidence supporting it:
the price, the estimate and its source, the discount, the edge, the constraints. "It won" and "it
lost" are not evidence about decision quality and MUST NOT be offered as though they were.

### R5 — Results inform calibration, never per-wager verdicts

Outcomes are not useless — they are the only way to learn whether probability estimates are
calibrated. But that is an inference about a *process* over a sample, made with attention to how
large a sample it takes to conclude anything. It is never a verdict on the individual wager that
produced one of the data points.

[Standard 19](19-evaluation-of-the-betting-process.md) governs how results may be used in aggregate.
[Standard 17](17-closing-line-value.md) provides the decision-time metric that needs far fewer
samples than profit does.

## Additions this standard makes beyond the source

The source states the invariant in four words per direction and says bet quality must be judged from
information available at decision time. Everything else here is this pack's:

- R1's practical test — whether the assessment could have been made before the event.
- R2's and R3's asymmetry: that the winning direction is more dangerous because nobody investigates a
  win, and that the losing direction typically causes a sound process to be abandoned.
- R4's requirement that a quality claim cite the record.
- R5 in full. The source does not address how results may legitimately be used; leaving that unsaid
  would have made the invariant read as "ignore outcomes entirely", which is not what it means and
  would make calibration impossible.

## Relationship to other standards

[Standard 18](18-record-keeping.md) is the mechanical defence of this invariant: decision-time fields
are covered by a digest and settlement is recorded outside it, so nothing about a decision can change
when its outcome arrives. [Standard 20](20-pass-decisions.md) depends on this standard — PASS can
only be a success if decisions are judged by their reasoning. [Standard 21](21-prohibited-behaviors-and-the-integrity-invariant.md)
carries the prohibition, `decision.no-resulting`, which covers both directions as one rule.

## Implementation

**Met, structurally.** The decision record format makes the violation harder rather than detectable:
`decision` is immutable and digested, `outcome` sits outside it, and settlement timestamps must be
strictly after decision timestamps. A result therefore cannot alter what was decided, and
`record.results-separated` is evaluated on every record.

**Not met, and cannot be.** `decision.no-resulting` is `validationType: manual-review` with
`assurance: none`. This standard prohibits a way of reasoning, and reasoning is not in the record: a
review that concluded "bad bet, it lost" looks identical in the ledger to one that examined the
price. The rule reports not-evaluated until a human attests to it, and the tooling will never report
it as satisfied because nothing was found.

The worked example [`examples/ledger/DEC-20260808-005.json`](../examples/ledger/DEC-20260808-005.json)
is a settled wager that lost while beating the closing line, with a process review that says so —
the case this standard exists to distinguish from a bad decision.
