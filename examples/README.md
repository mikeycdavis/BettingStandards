# Examples

Everything here is verified by the same code CI runs, so it cannot rot. `npm run check` re-derives
every number in `ledger/` and fails if any of them stops following from its inputs; `npm run fidelity`
fails if a standard cites a file here that does not exist.

## `ledger/` — five decision records

| Record | Decision | Why |
| --- | --- | --- |
| `DEC-20260809-001` | BET | A clear edge that survives a 30% uncertainty haircut. |
| `DEC-20260809-002` | PASS | A real 1.5-point edge that does not survive its own ±5-point uncertainty. |
| `DEC-20260809-003` | PASS | The best edge in the ledger, declined because a correlation-group cap would break. |
| `DEC-20260809-004` | PASS | A large apparent edge computed from a 22-hour-old prediction. |
| `DEC-20260808-005` | BET | Settled: it lost, and it beat the closing line. |

Three of five are PASSes, with genuinely different reasons. A ledger of BETs with one token PASS
would not demonstrate what [Standard 20](../standards/20-pass-decisions.md) is about.

## `decisions/` — the same five, walked stage by stage

Each walkthrough shows every pipeline stage with real numbers and says what the record establishes and
what it does not. Start with `001-bet-clear-edge.md` for the arithmetic, then
`005-settled-loss-that-beat-the-close.md` for the case the whole pack exists for: a wager that lost and
was a good decision.

## `violations/` — one document per prohibition

Twenty-three files, named exactly for the rule each describes. Every one says what the violation looks
like in practice, why it matters, and — importantly — how much the tooling can actually detect.

Fifteen are mechanically detected and name the known-negative fixture that fires them. **Eight are
not**, and say so plainly: chasing losses, "due" theory, gambler's-fallacy reasoning, resulting,
action bets, backtest leakage, review cadence, and the standards-integrity invariant. Those prohibit
motives and ways of reasoning, none of which appears in a record. They report `not-evaluated` until a
human attests, and the tooling will never report them satisfied because nothing was found.

Read [`integrity.no-standard-weakening.md`](violations/integrity.no-standard-weakening.md) first if
you read only one. It is the prohibition that decides whether any of the others mean anything.
