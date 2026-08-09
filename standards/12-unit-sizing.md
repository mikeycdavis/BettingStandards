# Standard 12 — Unit Sizing

How much to stake is a second decision, separate from whether to wager at all, and it is where the
most destructive behaviours in gambling live. This standard defines the sizing rule and prohibits
every variant of letting a loss decide the next stake.

Four of the pack's twenty-three prohibitions sit here. They are four descriptions of one behaviour,
kept separate because they are recognised differently and because one of them is mechanically
detectable while the others are not.

Source: the "unit sizing" item of the "Required standards" list in
[`artifacts/prompts/original-prompt.md`](../artifacts/prompts/original-prompt.md).

## Scope

Applies to every BET. A PASS stakes nothing and is unaffected.

## Requirements

### R1 — A unit is a declared fraction of bankroll

One unit is a percentage of the current bankroll, set in configuration. Units exist so stakes can be
described and compared without reference to a bankroll figure, and so sizing stays proportional as the
bankroll moves.

### R2 — The sizing rule is declared, and Kelly is fractional

The stake is produced by a stated function of the wager's own edge and price. This pack uses
fractional Kelly:

```text
kellyFraction  = max(0, (p × d − 1) / (d − 1))
recommendedStake = min(bankroll × kellyMultiplier × kellyFraction, bankroll × maxSingleBetPct)
```

where `p` is the discounted probability from [Standard 9](09-uncertainty-discount.md).

Three properties, each deliberate:

**The multiplier is at most 1.** Full Kelly maximises long-run growth *if the probability is exactly
right*. It is an estimate, and full Kelly on an estimate is an over-bet — the growth-optimal fraction
is highly sensitive to error in `p`, and the error is always in the direction of staking too much.
Fractional Kelly is the standard response, and this pack refuses a multiplier above 1 outright.

**The fraction is clamped at zero.** A negative Kelly fraction is the arithmetic saying "bet the other
side". Returning it would let a negative-expected-value wager produce a positive recommended stake
downstream. Zero is the honest answer: this wager gets no money.

**A hard cap applies regardless.** Kelly optimises under a correct estimate; `maxSingleBetPct` bounds
the damage from an incorrect one. Where Kelly recommends more than the cap, the cap wins.

### R3 — Losses MUST NEVER be chased

**No wager is placed, and no stake increased, in order to recover a previous loss.** Each decision is
made on its own edge, price, and exposure, as though the ledger before it were empty.

Chasing is what turns a bad night into a bad year. The mechanism is that a loss creates an urgency the
next wager did not earn: the wager gets placed because money is owed to the past, not because a price
is wrong in the present.

### R4 — Martingale-style loss recovery MUST NEVER be used

**No staking scheme increases the stake after a loss with the intent of recovering it**, whether by
doubling or by any other progression.

Martingale converts a series of survivable losses into one catastrophic loss, and it feels safe right
up until it is not. Each individual step is affordable; the sequence is bounded only by the bankroll,
and the bankroll always runs out before the losing streak does. The scheme's appeal is that it wins
frequently — it just loses everything when it loses.

### R5 — Bet size MUST NEVER increase because previous bets lost

**Prior results are not an input to sizing.** The stake is a function of this wager's edge, price, and
the declared rule.

Past results carry no information about the next wager's edge, so letting them move the stake adds
variance without adding expectation. It is the same error as the gambler's fallacy
([Standard 6](06-fair-probability.md) R4), expressed in money rather than in probability — and it is
harder to see, because the probability estimate is left untouched while the stake carries the mistake.

### R6 — Risk MUST NEVER be increased because someone is "due"

**No stake is raised on the grounds that a person, team, or outcome is overdue, owed a result, or
bound to turn.** Nothing is ever due.

If the belief that something is due is real, it belongs in the probability estimate with a causal
justification, upstream of this pack, where it can be examined. Applied to the stake instead, it
bypasses examination entirely.

## Additions this standard makes beyond the source

The source lists "unit sizing" and four prohibitions: chase losses, Martingale-style loss recovery,
increase bet size because previous bets lost, and increase risk because someone is "due". Everything
else is this pack's:

- R1's definition of a unit as a configured fraction of bankroll.
- R2 in full — the Kelly formula, the fractional multiplier and the refusal of values above 1, the
  clamp at zero, and the hard cap. The source does not name a sizing method.
- The reasoning throughout R3–R6: the mechanism of chasing, why Martingale feels safe, why loss-driven
  sizing is harder to see than the gambler's fallacy, and where a "due" belief legitimately belongs.
- The observation that these four prohibitions describe one behaviour recognised four ways, and the
  decision to keep them as separate rules.

## Relationship to other standards

[Standard 11](11-bankroll-management.md) supplies the bankroll this sizes against.
[Standard 9](09-uncertainty-discount.md) supplies the discounted probability R2 uses, so caution flows
into the stake automatically. [Standard 13](13-maximum-exposure.md) caps the aggregate.
[Standard 19](19-evaluation-of-the-betting-process.md) is where a review would notice a chasing
pattern that no check can see.

## Implementation

**Met.** `bankroll.stake-within-unit-rules` is evaluated on every record: the checker recomputes the
Kelly fraction and the recommended stake and reports `overstaked-bet` when a BET exceeds either.
[`scripts/betmath.mjs`](../scripts/betmath.mjs) enforces R2's three properties — it throws on a
multiplier above 1, clamps the fraction at zero, and applies the cap.

**Partially met, and only for two of the four prohibitions.**

`bankroll.no-martingale` and `bankroll.no-loss-driven-sizing` are detected across records, with a
deliberately narrow definition: a stake that grew after a loss **and** exceeds what the record's own
sizing arithmetic recommended. One such step reports a warning; two or more consecutive steps report
the Martingale violation. `test/fixtures/ledger-negative/martingale-seq/` is that sequence.

The narrowness is the honest part. An increase the bettor's own Kelly maths justifies is
indistinguishable from discipline, and flagging it would train people to ignore the finding — so a
progression that stays inside the recommended stake evades this check entirely. A test asserts that
the disciplined case does *not* fire.

**Not met, and cannot be.** `bankroll.no-chasing-losses` and `bankroll.no-due-theory` are
`manual-review` with `assurance: none`. Both prohibit a motive, and a wager placed to recover a loss
is indistinguishable in the record from the same wager placed on its merits. They report
not-evaluated until a human attests, and the tooling will never report them satisfied because nothing
was found.
