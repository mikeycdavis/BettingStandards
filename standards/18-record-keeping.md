# Standard 18 — Record Keeping

Every claim this pack makes is scoped to what was recorded. The caps bind over recorded wagers, the
metrics are computed from recorded decisions, and the arithmetic is checked against recorded inputs.
That makes the record not one standard among twenty-one but the assumption the other twenty rest on.

Source: the "record keeping" item of the "Required standards" list in
[`artifacts/prompts/original-prompt.md`](../artifacts/prompts/original-prompt.md).

## Scope

Applies to every wagering decision, and to every later edit anyone might make to one.

## Requirements

### R1 — Every decision produces a record, BET and PASS alike

Each decision is written as a record carrying every pipeline stage value as it stood at decision time,
with a unique identifier.

An unrecorded wager is not merely undocumented. It is invisible to every exposure cap
([Standard 13](13-maximum-exposure.md) R5), absent from every process metric
([Standard 19](19-evaluation-of-the-betting-process.md)), and outside every check in this repository.
The tooling will report a clean book while the real position is larger than any cap allows, and
nothing inside the ledger can reveal that — a ledger cannot show what was left out of it.

This is the pack's largest single limitation, and it is stated here rather than buried because the
honest reading of every clean report depends on it.

### R2 — Decision-time fields are immutable, and results are appended outside them

The decision block is written once. Settlement — the result, the closing price, the profit, a review —
is recorded in a separate block that never touches it, with a timestamp strictly after the decision's.

This separation is what makes [Standard 1](01-the-fundamental-invariant.md) enforceable rather than
aspirational. If a result could reach back into the decision block, every record would silently become
a record of what should have been done, and the invariant would have no mechanical defence at all.

### R3 — Historical recommendations MUST NEVER be silently altered

**No decision-time field is edited after the record is written.** A correction is a new record
referencing the original, never an amendment to it.

Editing history after a result is known is how a betting record becomes a story about how well someone
has been doing. It is also the violation that destroys every other guarantee at once: once records can
change, no metric computed from them means anything, and no check that reads them proves anything.

The correction path exists and is legitimate. A genuine error — a mistyped price, a wrong bankroll —
is fixed by writing a new record that references the original and explains the correction. What is
prohibited is the *silent* alteration, where the ledger afterwards shows no sign that anything was
ever different.

### R4 — Records are tamper-evident

Each record carries a digest over its decision block. The checker recomputes it, so any later edit to
a decision-time field is visible rather than merely prohibited.

Each record also pins the digest of the betting policy it was decided under. This closes the
complementary hole: leaving a record untouched while relaxing the thresholds it was judged against
would let a decision become acceptable retroactively without the record changing at all.

### R5 — A PASS is recorded with the same rigour as a BET

A PASS carries the full pipeline, the gates that failed, and a zero stake.
[Standard 20](20-pass-decisions.md) owns why; this standard requires the record.

A ledger of BETs only cannot show that anything was ever declined, so it cannot distinguish a
disciplined process from one that took every wager it looked at. Recorded PASSes are the only evidence
that the thresholds do anything, and they are the easiest record to skip — nothing happened, so
nothing prompts the writing.

## Additions this standard makes beyond the source

The source says "record keeping" and "Never: silently alter historical recommendations after results
are known". Everything else is this pack's:

- R1's requirement that PASSes be recorded, and the explicit statement that completeness is
  unverifiable from inside and is the pack's largest limitation.
- R2 in full — the immutable decision block, the separate outcome block, and the ordering constraint —
  together with the argument that this is what makes Standard 1 mechanically defensible.
- R3's distinction between a prohibited silent alteration and a legitimate referenced correction.
- R4 in full: both digests. Neither is in the source.
- R5's observation that a PASS is the easiest record to skip.

## Relationship to other standards

[Standard 1](01-the-fundamental-invariant.md) is what R2's separation defends.
[Standard 13](13-maximum-exposure.md) R5 names R1 as its load-bearing assumption.
[Standard 19](19-evaluation-of-the-betting-process.md) consumes these records.
[Standard 20](20-pass-decisions.md) owns the PASS that R5 requires recording.
[Standard 21](21-prohibited-behaviors-and-the-integrity-invariant.md) lists R4's digests among the
integrity invariant's mechanical defences.

## Implementation

**Met.** `record.decision-record-required`, `record.pass-recorded`, and `record.results-separated` are
evaluated on every record.
[`schemas/decision-record.schema.json`](../schemas/decision-record.schema.json) enforces the structure:
the decision block is required and complete, `outcome` is optional and separate, and a settlement
timestamp at or before the decision reports `settled-before-decided`.

R4 is implemented as a SHA-256 over the canonically serialized decision block. Object keys are sorted
so a reformat that changed nothing does not read as an edit; array order is preserved, because a line
history is chronological and sorting it would destroy information. An edit of one cent to a settled
record's stake flips the digest, and a test asserts exactly that.
`test/fixtures/ledger-negative/edited-history.json` is a record whose digest no longer matches its
contents.

**Not met, and cannot be.** `record.decision-record-required` carries `assurance: full` over recorded
decisions and its assurance note states the limit in capitals: it CANNOT establish that every decision
was recorded. R3's prohibition is likewise `assurance: partial` — the digests detect an edit made
after the record was written, and are defeated by an edit made before it was first written, or by
rewriting the digest along with the content. The latter is visible in version-control history rather
than here, which is a real defence and a different one.
