# Standard 9 — Uncertainty Discount

Every probability estimate is wrong by some amount. The uncertainty discount is where a bettor says
how wrong it might be, and then acts on the cautious end of that range rather than the convenient one.

Source: the "uncertainty discount" item of the "Required standards" list in
[`artifacts/prompts/original-prompt.md`](../artifacts/prompts/original-prompt.md).

## Scope

Applies to every decision. There is no exemption for a confident estimate; a discount of zero is a
legitimate entry, but it is an entry someone made rather than a field left blank.

## Requirements

### R1 — Every decision records an uncertainty discount

The discount is a number in `[0, 1]` recorded on every decision record. Requiring it everywhere is
the point: it forces the question to be answered rather than left implicit, and an estimate presented
with no error bar invites being treated as exact.

### R2 — The discount is a haircut on the edge

```text
adjustedEdge = rawEdge × (1 − discount)
```

A discount of `0.3` keeps 70% of the estimated edge. A discount of `1` removes it entirely, and the
decision becomes a PASS — which is the correct answer for an estimate carrying no real confidence.

Two design choices here, both deliberate:

**It shrinks toward the market, never away.** Being unsure about a probability should make you bet
less, never more. Applying uncertainty in the direction that increases a stake would invert the
purpose of measuring it.

**It applies to the edge, not to the probability.** The edge is what
[Standard 10](10-minimum-edge.md)'s threshold compares, so discounting anywhere else would leave the
gate reading an undiscounted number. Discounting the edge and deriving the adjusted probability from
it keeps one place where caution is applied.

### R3 — Uncertainty MUST NEVER be hidden

**No decision presents an estimate as more certain than it is** by omitting the discount, suppressing
a known source of error, or recording a discount smaller than the bettor's own assessment.

Hidden uncertainty is the quiet form of overclaiming. Nothing is asserted falsely; something true is
simply left out, and the omission always runs in the direction that makes a thin edge look like a
real one. That directional bias is what makes it a prohibition rather than a matter of style.

### R4 — No wager is ever described as guaranteed

**No wager is described as guaranteed, a lock, a sure thing, risk-free, or unable to lose, and no
outcome is described as due.**

Every wager can lose. Language claiming otherwise is false about the thing itself, and it is the
language that precedes the largest stakes — the certainty does the sizing. Stating the probability
and the edge conveys all the confidence the evidence supports, and no more.

### R5 — Long prices carry a minimum discount

Where the offered price is at or above the policy's longshot threshold, the discount must be at least
the policy's longshot floor.

This exists to answer a known bias rather than to add ceremony. The multiplicative vig-removal method
this pack uses ([Standard 6](06-fair-probability.md) R1) overstates the fair probability of longshots,
because books load more margin onto long prices. Rather than leave that distortion implicit, the pack
requires extra caution exactly where the method is least reliable — and the requirement is
mechanical, read from configuration and checked on every record.

## Additions this standard makes beyond the source

The source says "uncertainty discount", "Never: hide uncertainty", and "Never: describe any wager as
guaranteed". Everything else is this pack's:

- R1's requirement that the discount be present on every record, including when it is zero.
- R2's formula and both design choices — that it shrinks toward the market, and that it applies to
  the edge rather than the probability.
- R3's characterisation of hidden uncertainty as directionally biased, which is the argument for
  treating it as a prohibition.
- R4's specific banned vocabulary. The source prohibits the claim; the list of phrases is this pack's,
  and it is a literal scan with the limits that implies.
- R5 in full. The source does not mention longshot bias; this is the pack's mechanical answer to a
  known weakness in its own chosen devig method.

## Relationship to other standards

[Standard 6](06-fair-probability.md) produces the estimate this discounts, and its method's longshot
bias is what R5 answers. [Standard 7](07-edge.md) supplies the raw edge.
[Standard 10](10-minimum-edge.md) compares the discounted edge against the threshold.
[Standard 12](12-unit-sizing.md) sizes from the discounted probability, so caution flows through to
the stake automatically.

## Implementation

**Met.** `uncertainty.estimate-recorded` and `uncertainty.discount-applied` are evaluated on every
record. The schema requires the discount and constrains it to `[0, 1]`; the checker recomputes the
adjusted edge and adjusted probability, and reports `longshot-discount-missing` when R5 is breached.
`test/fixtures/ledger-negative/longshot-no-discount.json` is that case.

**Partially met, and the gaps are the honest part.**

`uncertainty.no-hidden-uncertainty` detects a missing or out-of-range discount and a longshot floor
breach. It cannot detect a discount that is present, in range, and dishonestly small — which is the
most likely form of this violation, since nothing in the record says what the discount *should* have
been.

`uncertainty.no-guaranteed-language` is a literal scan for a fixed list of phrases. It catches the
careless case, which is the common one, and it cannot catch a paraphrase. It MUST NOT be reported as
establishing that no wager was overclaimed. `test/fixtures/ledger-negative/guarantee-language.json`
exercises it.
