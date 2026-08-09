# Standard 14 — Correlated Bets

Three wagers on the same game are one wager on that game wearing three tickets. Counting them
separately produces a number that says the book is diversified when a single result settles all of it.

Source: the "correlated bets" item of the "Required standards" list in
[`artifacts/prompts/original-prompt.md`](../artifacts/prompts/original-prompt.md).

## Scope

Applies to every BET evaluated against open positions, and to any set of wagers placed together.

## Requirements

### R1 — Every wager records a correlation assessment

Each decision assigns the wager to a correlation group, or records explicitly that it belongs to none.

A null group is a claim, not a default. "This wager shares no outcome driver with anything currently
open" is a statement someone has to make, and making it explicit is what allows it to be wrong in a
way a reviewer can see.

Wagers share a driver when the same underlying event moves both. The common cases:

- **The same game** — a moneyline and a total on one fixture, or two player props from it.
- **The same team or participant** across markets or fixtures.
- **A shared external factor** — weather at a venue, a referee assignment, a schedule spot.
- **A causal chain** — an outcome that makes another materially more or less likely.

### R2 — Correlated stakes sum against the group cap

Within a group, stakes are added. The model assumes **full correlation**: the group is treated as
though one result settles all of it.

This is deliberately pessimistic and deliberately coarse, and the alternative was rejected for a
specific reason. A coefficient-weighted model — "these two are 0.3 correlated" — is more precise in
principle, but a correlation coefficient is an **unverifiable input**. Nothing in a decision record
could falsify it, and its only effect would be to reduce measured exposure by assertion. A number that
can only ever make the position look smaller, and that nobody can check, is not a measurement.

Binary grouping can be checked by reading the records. A coefficient cannot. The coarse model is the
honest one here, and its cost — occasionally treating loosely related wagers as fully correlated — is
paid in the safe direction.

### R3 — Correlated exposure MUST NEVER be ignored

**No decision treats correlated wagers as independent, and none omits the correlation assessment.**

Ignoring correlation is how a book that looks diversified turns out to be one large position. The
failure is invisible right up until the correlated leg resolves, at which point every ticket settles
the same way at once — which is precisely when the bettor discovers the diversification was arithmetic
rather than real.

### R4 — The assessment's quality is a judgement, and the check cannot make it

A bettor who marks every wager as uncorrelated satisfies R1 and R2 mechanically while ignoring
correlation completely. Nothing in this repository can tell a thoughtful grouping from a lazy one.

This limitation is stated as a requirement rather than hidden in an implementation note, because it
determines where the real work is: assigning groups honestly is a human obligation that the tooling
supports and cannot replace. [Standard 19](19-evaluation-of-the-betting-process.md)'s review is where
a pattern of under-grouping would be noticed.

## Additions this standard makes beyond the source

The source says "correlated bets" and "Never: ignore correlated exposure". Everything else is this
pack's:

- R1's requirement for an explicit assessment on every wager, the treatment of a null group as a
  claim, and the enumerated categories of shared driver.
- R2's full-correlation model, and the argument for rejecting correlation coefficients as unverifiable
  inputs. This is one of the pack's larger design decisions and is recorded in
  [`design/concept-model.md`](../design/concept-model.md).
- R3's account of why the failure is invisible until it is not.
- R4 in full — naming the limitation as a requirement rather than leaving it to the assurance note.

## Relationship to other standards

[Standard 13](13-maximum-exposure.md) owns the group cap that these totals meet.
[Standard 11](11-bankroll-management.md) supplies the bankroll the cap is a fraction of.
[Standard 19](19-evaluation-of-the-betting-process.md) is where R4's judgement gets reviewed.

## Implementation

**Met.** `exposure.correlated-bets-aggregated` is evaluated on every record: the schema requires a
`correlationGroup` (string or explicit null) and `exposureTotals` in
[`scripts/betmath.mjs`](../scripts/betmath.mjs) sums stakes within each group. The checker recomputes
`groupExposureAfter` and reports a mismatch.
[`examples/ledger/DEC-20260809-003.json`](../examples/ledger/DEC-20260809-003.json) is a PASS taken
because the group cap would have broken — the edge was fine, and it was not the only question.

**Partially met.** `exposure.no-ignored-correlation` carries `assurance: partial`. It establishes that
an assessment was recorded and applied. It cannot establish that the assessment was *right*, which is
R4's point, and the catalog's assurance note says so in those terms.
