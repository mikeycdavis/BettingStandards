# Violation — `edge.no-fabricated-edge`

**[Standard 7 — Edge](../../standards/07-edge.md) · forbidden · structural · assurance: partial**

> No edge is stated that does not follow from a recorded probability and a recorded price. A stated edge that does not recompute is a fabrication, not a rounding difference.

## What it looks like

The edge is written into a summary or a message before the calculation is done, or is adjusted afterwards so it reads better than the inputs support.

## Why it matters

Edge is the number that authorises risking money. Stating one that does not follow from its inputs is the shortest path from a wish to a wager, and it is the figure a reader is least likely to recompute.

## How this repository treats it

Detected as a finding bound to `edge.no-fabricated-edge`, at error severity.

The known-negative fixture `test/fixtures/ledger-negative/ev-mismatch.json` carries a derived value that does not follow from its recorded inputs.

**What the check does not establish.** Detects an edge inconsistent with its recorded inputs. An edge computed correctly from a fabricated probability or price passes this check and is caught, if at all, by the provenance rules.

## If it fires

Recompute the edge from the recorded inputs, or correct the inputs to the values actually used.

A confirmed violation produces the verdict `BLOCKED_BY_INVARIANT`. The required response is to stop and report — not to lower a threshold, mark the rule not-applicable, or record an exception. An exception declared against a prohibition is rejected and reported as a finding in its own right.
