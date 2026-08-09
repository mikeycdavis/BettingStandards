Implement a **Betting and Gambling Decision Standards** pack.

This pack governs whether a prediction justifies risking money.

It must remain separate from Prediction Standards.

A prediction can be correct and still represent a bad wager. A wager can lose and still have been a rational positive-expected-value decision.

Preserve the existing standards architecture.

## Decision pipeline

Where applicable:

prediction
→ offered odds
→ implied probability
→ vig removal
→ estimated fair probability
→ uncertainty
→ edge
→ expected value
→ bankroll impact
→ exposure/correlation
→ BET or PASS

## Required standards

Cover:

* odds conversion
* implied probability
* vig
* fair probability
* edge
* expected value
* uncertainty discount
* minimum edge
* bankroll management
* unit sizing
* maximum exposure
* correlated bets
* line movement
* stale predictions
* closing-line value
* record keeping
* evaluation of betting process
* pass decisions

## Must-never rules

Never:

* bet solely because a team/player is likely to win
* recommend a wager without considering the offered price
* call something positive EV without supporting probability and price calculations
* ignore vig
* chase losses
* use Martingale-style loss recovery
* increase bet size because previous bets lost
* treat a winning wager as proof it was a good bet
* treat a losing wager as proof it was a bad bet
* fabricate odds
* fabricate line movement
* fabricate edge
* fabricate expected value
* hide uncertainty
* recommend a wager merely to create action
* force a daily bet quota
* recommend increasing risk because someone is "due"
* use gambler's-fallacy reasoning
* ignore correlated exposure
* exceed defined bankroll/exposure constraints
* describe any wager as guaranteed
* use historical backtests that leak future information
* silently alter historical recommendations after results are known

## Fundamental invariant

Encode:

> Good bet ≠ winning bet.
> Bad bet ≠ losing bet.

Bet quality must be judged from information available at decision time.

## PASS

PASS must be treated as a successful decision.

The system should actively prefer PASS when edge does not sufficiently exceed uncertainty and transaction/vig costs.

## Deliverables

Implement standards, must-never rules, applicability, evidence, verification, tests, documentation, and examples.

Where possible, make odds, implied probability, edge, EV, bankroll, and exposure calculations mechanically verifiable.

Run all validation and report results.
