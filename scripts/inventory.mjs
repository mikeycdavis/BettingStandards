#!/usr/bin/env node
/**
 * Prove that the standards series and the prohibition register have not silently changed shape.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT JUST A REGEX. The obvious design is: extract the bullets from
 * the source prompt on every run and count them. That design has a known failure mode — a scan
 * reports a count, the count is written into three documents as a fact about the world, and it was a
 * fact about the regex. Once that has happened, nothing in the repository disagrees with it.
 *
 * So the enumeration is NOT derived on every run. `artifacts/standards-source-inventory.json` was
 * reviewed by a human once and committed as the canonical list. This script extracts from the source
 * and compares the result *against* that file. A parser that becomes more or less forgiving cannot
 * redefine how many standards or prohibitions exist — it can only disagree with the inventory, and
 * disagreeing fails.
 *
 * WHAT IT ALSO IS. This is protection #2 of the standards-integrity invariant (Standard 21). Deleting
 * a prohibition, renaming its rule, or quietly reclassifying it breaks this check, so weakening the
 * register cannot be done in one file without the build noticing.
 *
 * Exit 0 when the source, the inventory, the standards files, and the catalog all agree; 1 on any
 * disagreement; 2 on invocation error.
 */

import { readFile, access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const EXIT_OK = 0;
const EXIT_FINDINGS = 1;
const EXIT_INVOCATION = 2;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "artifacts/prompts/original-prompt.md");
const INVENTORY = path.join(ROOT, "artifacts/standards-source-inventory.json");

/**
 * Pull the bullets out of one `## Heading` section of the source prompt.
 *
 * Deliberately anchored on the heading rather than on document order: an editor who adds a section
 * between two others should not shift what this reads. Bullets are `* text` at column 0, which is the
 * only bullet form the source uses; a nested or indented bullet would not be a top-level item and is
 * not collected.
 */
function bulletsUnder(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) return null; // Distinct from "a section with no bullets" — the caller reports it.
  const bullets = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) break;
    const match = /^\*\s+(.+?)\s*$/.exec(line);
    if (match) bullets.push(match[1]);
  }
  return bullets;
}

async function exists(relative) {
  try {
    await access(path.join(ROOT, relative));
    return true;
  } catch {
    return false;
  }
}

/**
 * Compare the source, the inventory, the standards files, and the rule catalog.
 *
 * `catalogRules` is an array of `{ id, forbidden }`, or null when the catalog does not exist yet (it
 * is built in a later milestone than this check). A missing catalog leaves the rule-binding checks
 * PENDING and is reported as such — pending is not passing, and the run still fails while anything is
 * pending, so an unfinished repository can never look finished.
 */
export function compare({ source, inventory, presentFiles, catalogRules }) {
  const catalogIds = catalogRules === null ? null : new Set(catalogRules.map((r) => r.id));
  const problems = [];
  const pending = [];

  // --- The standards series ------------------------------------------------------------------
  const required = bulletsUnder(source, "Required standards");
  if (required === null) {
    problems.push("the source has no '## Required standards' section — extraction cannot proceed");
  }

  const items = inventory.standards.items;
  if (items.length !== inventory.standards.expectedCount) {
    problems.push(
      `inventory lists ${items.length} standards but declares expectedCount ${inventory.standards.expectedCount}`,
    );
  }

  const numbers = items.map((i) => i.number);
  for (let n = 1; n <= items.length; n++) {
    if (!numbers.includes(n)) problems.push(`standard ${n} is missing from the inventory — the series has a gap`);
  }
  const seen = new Set();
  for (const n of numbers) {
    if (seen.has(n)) problems.push(`standard ${n} appears twice in the inventory`);
    seen.add(n);
  }

  // Every source bullet must be owned by exactly one standard, and every standard claiming to derive
  // from a bullet must name one the source actually contains. Both directions, because one direction
  // alone lets a topic be silently dropped or silently invented.
  if (required !== null) {
    const claimed = items.filter((i) => i.sourceItem !== null).map((i) => i.sourceItem);
    for (const bullet of required) {
      const owners = items.filter((i) => i.sourceItem === bullet);
      if (owners.length === 0) problems.push(`source bullet '${bullet}' is not owned by any standard`);
      if (owners.length > 1) {
        problems.push(`source bullet '${bullet}' is claimed by standards ${owners.map((o) => o.number).join(", ")}`);
      }
    }
    for (const item of claimed) {
      if (!required.includes(item)) {
        problems.push(`inventory claims source bullet '${item}', which the source does not contain`);
      }
    }
  }

  for (const item of items) {
    if (!item.file.startsWith("standards/")) problems.push(`standard ${item.number}: file is not under standards/`);
    const expectedPrefix = `standards/${String(item.number).padStart(2, "0")}-`;
    if (!item.file.startsWith(expectedPrefix)) {
      problems.push(`standard ${item.number}: filename '${item.file}' does not start with '${expectedPrefix}'`);
    }
    if (!presentFiles.has(item.file)) {
      pending.push(`standard ${item.number} (${item.title}) is not yet written: ${item.file}`);
    }
  }

  // --- The prohibition register --------------------------------------------------------------
  const never = bulletsUnder(source, "Must-never rules");
  if (never === null) {
    problems.push("the source has no '## Must-never rules' section — extraction cannot proceed");
  }

  const mustNever = inventory.mustNever.items;
  if (mustNever.length !== inventory.mustNever.expectedCount) {
    problems.push(
      `inventory maps ${mustNever.length} prohibitions but declares expectedCount ${inventory.mustNever.expectedCount}`,
    );
  }

  if (never !== null) {
    if (never.length !== mustNever.length) {
      problems.push(`the source lists ${never.length} must-never bullets; the inventory maps ${mustNever.length}`);
    }
    // Positional comparison, not set comparison: the inventory records the source's bullets in the
    // source's order, so a bullet that was edited rather than removed shows up as a mismatch at its
    // own position instead of as one addition plus one deletion somewhere else in the list.
    for (let i = 0; i < Math.min(never.length, mustNever.length); i++) {
      if (never[i] !== mustNever[i].bullet) {
        problems.push(
          `must-never bullet ${i + 1} disagrees:\n      source:    ${never[i]}\n      inventory: ${mustNever[i].bullet}`,
        );
      }
    }
  }

  const standardNumbers = new Set(numbers);
  for (const entry of [...mustNever, ...inventory.mustNeverFromExpandedBrief.items]) {
    if (!standardNumbers.has(entry.standard)) {
      problems.push(`prohibition '${entry.ruleId}' is owned by standard ${entry.standard}, which does not exist`);
    }
    if (catalogIds === null) {
      pending.push(`prohibition '${entry.ruleId}' cannot be confirmed: the rule catalog does not exist yet`);
    } else if (!catalogIds.has(entry.ruleId)) {
      problems.push(`prohibition '${entry.ruleId}' has no rule in the catalog`);
    }
  }

  // Every forbidden rule in the catalog must trace back to a source obligation. Without this, a
  // prohibition could be added to the catalog that no source ever asked for, and the register would
  // grow claims the briefs do not support.
  if (catalogRules !== null) {
    const mapped = new Set([
      ...mustNever.map((e) => e.ruleId),
      ...inventory.mustNeverFromExpandedBrief.items.map((e) => e.ruleId),
    ]);
    for (const rule of catalogRules) {
      if (rule.forbidden && !mapped.has(rule.id)) {
        problems.push(`catalog defines forbidden rule '${rule.id}', which no source bullet or brief maps to`);
      }
    }
  }

  return { problems, pending };
}

async function main() {
  let source, inventory;
  try {
    source = await readFile(SOURCE, "utf8");
    inventory = JSON.parse(await readFile(INVENTORY, "utf8"));
  } catch (error) {
    process.stderr.write(`standards inventory: ${error.message}\n`);
    process.exit(EXIT_INVOCATION);
  }

  const presentFiles = new Set();
  for (const item of inventory.standards.items) {
    if (await exists(item.file)) presentFiles.add(item.file);
  }

  let catalogRules = null;
  try {
    const { loadCatalog } = await import("./catalog.mjs");
    const catalog = await loadCatalog();
    catalogRules = [...catalog.rules.values()].map((r) => ({ id: r.id, forbidden: r.level === "forbidden" }));
  } catch {
    catalogRules = null; // Not built yet, or unloadable. Reported as pending, never as agreement.
  }

  const { problems, pending } = compare({ source, inventory, presentFiles, catalogRules });

  process.stdout.write(`Source:    ${path.relative(ROOT, SOURCE).replace(/\\/g, "/")}\n`);
  process.stdout.write(`Inventory: ${path.relative(ROOT, INVENTORY).replace(/\\/g, "/")}\n\n`);
  process.stdout.write(
    `  ${inventory.standards.expectedCount} standards, ${inventory.mustNever.expectedCount} source prohibitions, ` +
      `${inventory.mustNeverFromExpandedBrief.expectedCount} from the expanded brief\n`,
  );
  process.stdout.write(`  ${presentFiles.size}/${inventory.standards.items.length} standards written\n\n`);

  for (const item of pending) process.stdout.write(`  PENDING  ${item}\n`);
  for (const item of problems) process.stdout.write(`  PROBLEM  ${item}\n`);

  if (problems.length > 0) {
    process.stdout.write(
      `\n${problems.length} disagreement(s).\n\n` +
        "The inventory is the canonical enumeration and was reviewed by a human. A disagreement\n" +
        "means either the source changed, or the extraction changed, or a standard or prohibition\n" +
        "was altered. Establish which before editing the inventory — regenerating it from a run\n" +
        "would destroy the guarantee it exists to provide.\n",
    );
    process.exit(EXIT_FINDINGS);
  }

  if (pending.length > 0) {
    process.stdout.write(
      `\n${pending.length} item(s) pending. The source and the inventory agree; the repository is\n` +
        "not finished. Pending is not passing.\n",
    );
    process.exit(EXIT_FINDINGS);
  }

  process.stdout.write("Source, inventory, standards files, and rule catalog all agree.\n");
  process.exit(EXIT_OK);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
