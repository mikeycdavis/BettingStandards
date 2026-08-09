/**
 * Tests for the source inventory check.
 *
 * The check's whole value is that it disagrees when something changed. So most of these tests are
 * mutations: take the real source and the real inventory, break exactly one thing, and assert the
 * specific disagreement is reported. A test that only asserted "the real repository agrees" would
 * still pass if `compare` were replaced with `return { problems: [], pending: [] }`.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compare } from "../scripts/inventory.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const source = await readFile(path.join(ROOT, "artifacts/prompts/original-prompt.md"), "utf8");

/**
 * Delete a whole bullet line, whatever the file's line endings are.
 *
 * This helper exists because of a real trap: the working tree on Windows carries CRLF, so a naive
 * `source.replace("* chase losses\n", "")` matches nothing and silently mutates nothing — and a
 * mutation test whose mutation did not happen passes while proving nothing. Anchoring on the line
 * with an explicit `\r?\n` is the fix; asserting the text actually changed is the seatbelt.
 */
function removeLine(text, line) {
  const escaped = line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const out = text.replace(new RegExp(`${escaped}\\r?\\n`), "");
  assert.notEqual(out, text, `the mutation did not apply: '${line}' was not found`);
  return out;
}
const inventoryText = await readFile(path.join(ROOT, "artifacts/standards-source-inventory.json"), "utf8");
const load = () => JSON.parse(inventoryText);

/** Every standard file present and every prohibition catalogued: the finished-repository state. */
const allPresent = () => new Set(load().standards.items.map((i) => i.file));
const allRules = () => {
  const inv = load();
  const ids = new Set([
    ...inv.mustNever.items.map((e) => e.ruleId),
    ...inv.mustNeverFromExpandedBrief.items.map((e) => e.ruleId),
  ]);
  return [...ids].map((id) => ({ id, forbidden: true }));
};

test("the committed source and inventory agree", () => {
  const { problems } = compare({
    source,
    inventory: load(),
    presentFiles: allPresent(),
    catalogRules: allRules(),
  });
  assert.deepEqual(problems, [], "the repository's own source and inventory must not disagree");
});

test("a finished repository reports nothing pending", () => {
  const { pending } = compare({
    source,
    inventory: load(),
    presentFiles: allPresent(),
    catalogRules: allRules(),
  });
  assert.deepEqual(pending, []);
});

test("an unwritten standard is pending, and pending is not agreement", () => {
  const present = allPresent();
  present.delete("standards/07-edge.md");
  const { problems, pending } = compare({
    source,
    inventory: load(),
    presentFiles: present,
    catalogRules: allRules(),
  });
  assert.equal(problems.length, 0, "an unwritten standard is not a disagreement");
  assert.equal(pending.length, 1);
  assert.match(pending[0], /standards\/07-edge\.md/);
});

test("a missing rule catalog leaves prohibitions pending, never confirmed", () => {
  const { problems, pending } = compare({
    source,
    inventory: load(),
    presentFiles: allPresent(),
    catalogRules: null,
  });
  assert.equal(problems.length, 0);
  assert.equal(pending.length, 24, "23 source prohibitions plus the integrity invariant");
  for (const item of pending) assert.match(item, /rule catalog does not exist yet/);
});

test("deleting a must-never bullet from the source is caught", () => {
  const mutated = removeLine(source, "* chase losses");
  const { problems } = compare({
    source: mutated,
    inventory: load(),
    presentFiles: allPresent(),
    catalogRules: allRules(),
  });
  assert.ok(
    problems.some((p) => /lists 22 must-never bullets/.test(p)),
    `expected a count disagreement, got: ${problems.join(" | ")}`,
  );
});

test("editing a must-never bullet is caught at its own position", () => {
  const mutated = source.replace("* chase losses", "* avoid chasing losses where practical");
  const { problems } = compare({
    source: mutated,
    inventory: load(),
    presentFiles: allPresent(),
    catalogRules: allRules(),
  });
  const hit = problems.find((p) => /must-never bullet 5 disagrees/.test(p));
  assert.ok(hit, `expected bullet 5 to disagree, got: ${problems.join(" | ")}`);
  assert.match(hit, /avoid chasing losses where practical/);
});

test("a prohibition whose rule is absent from the catalog is a problem, not a pending item", () => {
  const rules = allRules().filter((r) => r.id !== "bankroll.no-martingale");
  const { problems } = compare({
    source,
    inventory: load(),
    presentFiles: allPresent(),
    catalogRules: rules,
  });
  assert.ok(
    problems.some((p) => p.includes("bankroll.no-martingale") && p.includes("no rule in the catalog")),
    `expected the missing rule to be reported, got: ${problems.join(" | ")}`,
  );
});

test("a forbidden rule the briefs never asked for is caught", () => {
  const rules = [...allRules(), { id: "bankroll.no-betting-on-tuesdays", forbidden: true }];
  const { problems } = compare({
    source,
    inventory: load(),
    presentFiles: allPresent(),
    catalogRules: rules,
  });
  assert.ok(
    problems.some((p) => /no-betting-on-tuesdays.*no source bullet or brief maps to/.test(p)),
    `expected an unmapped prohibition to be reported, got: ${problems.join(" | ")}`,
  );
});

test("dropping a required-standards bullet from the source leaves it unowned", () => {
  const mutated = removeLine(source, "* closing-line value");
  const { problems } = compare({
    source: mutated,
    inventory: load(),
    presentFiles: allPresent(),
    catalogRules: allRules(),
  });
  assert.ok(
    problems.some((p) => /'closing-line value'.*source does not contain/.test(p)),
    `expected the orphaned claim to be reported, got: ${problems.join(" | ")}`,
  );
});

test("a gap in the standards series is caught", () => {
  const inventory = load();
  inventory.standards.items = inventory.standards.items.filter((i) => i.number !== 12);
  inventory.standards.expectedCount = 20;
  const { problems } = compare({
    source,
    inventory,
    presentFiles: allPresent(),
    catalogRules: allRules(),
  });
  assert.ok(
    problems.some((p) => /standard 20 is missing|standard 12/.test(p)),
    `expected a series gap to be reported, got: ${problems.join(" | ")}`,
  );
});

test("expectedCount is checked against the list it describes", () => {
  const inventory = load();
  inventory.standards.expectedCount = 44;
  const { problems } = compare({
    source,
    inventory,
    presentFiles: allPresent(),
    catalogRules: allRules(),
  });
  assert.ok(
    problems.some((p) => /declares expectedCount 44/.test(p)),
    `expected the count mismatch to be reported, got: ${problems.join(" | ")}`,
  );
});

test("a filename that does not match its standard number is caught", () => {
  const inventory = load();
  inventory.standards.items[6].file = "standards/70-edge.md";
  const present = new Set([...allPresent(), "standards/70-edge.md"]);
  present.delete("standards/07-edge.md");
  const { problems } = compare({ source, inventory, presentFiles: present, catalogRules: allRules() });
  assert.ok(
    problems.some((p) => /does not start with 'standards\/07-'/.test(p)),
    `expected the filename mismatch to be reported, got: ${problems.join(" | ")}`,
  );
});

test("two standards claiming the same source bullet is caught", () => {
  const inventory = load();
  inventory.standards.items[0].sourceItem = "edge"; // Standard 1 also claims Standard 7's bullet.
  const { problems } = compare({
    source,
    inventory,
    presentFiles: allPresent(),
    catalogRules: allRules(),
  });
  assert.ok(
    problems.some((p) => /'edge' is claimed by standards 1, 7/.test(p)),
    `expected the double claim to be reported, got: ${problems.join(" | ")}`,
  );
});
