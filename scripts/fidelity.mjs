#!/usr/bin/env node
/**
 * Hold every standard to its own word.
 *
 * WHAT IT CHECKS, AND WHY ONLY THAT. Two kinds of claim in a standards document are falsifiable, and
 * this falsifies both:
 *
 *   1. "reproduced verbatim from the source" (or a close variant) immediately before a fenced block,
 *      blockquote, or bullet list. The document is asserting that the block is source text.
 *   2. A link or inline-code reference to a path under examples/ or test/. The document is asserting
 *      that a worked example exists at that path.
 *
 * Authored content makes no such claim and is not checked. The point is to hold a document to what it
 * says about itself, not to forbid original writing — which matters especially here, because this
 * pack's source prompts are short and nearly all of its normative content is authored. A standard
 * that says "the source says X" when the source does not is the one failure mode that would make the
 * "Additions beyond the source" ledger worthless, and that ledger is where this pack earns trust.
 *
 * NORMALIZATION. Line wrapping differs between a standard and its source, so both sides are collapsed
 * to single-spaced text before comparison. Backticks, punctuation, and wording are NOT normalized
 * away — those are exactly what this exists to catch. A quotation that gained backticks around an
 * identifier is no longer verbatim, and saying so is the job.
 *
 * Usage:
 *   node scripts/fidelity.mjs           report, exit 1 on any unverified claim
 *   node scripts/fidelity.mjs --json    machine-readable
 */

import { readFile, readdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = [
  path.join(ROOT, "artifacts/prompts/original-prompt.md"),
  path.join(ROOT, "artifacts/prompts/expanded-brief.md"),
];
const JSON_OUT = process.argv.includes("--json");

/** A sentence asserting that what follows is source text. */
const CLAIM_RE =
  /reproduced\s+(?:verbatim\s+)?from\s+the\s+source|verbatim\s+from\s+the\s+(?:source|brief|prompt)|from\s+the\s+source[,:]?\s*$|^From the (?:source|brief)[,:]/i;

/** A cited example or fixture path: `examples/...` or [text](../examples/...). */
const PATH_RE = /(?:\]\(|`)((?:\.\.\/)?(?:examples|test)\/[A-Za-z0-9._\-/]+)(?:\)|`)/g;

const normalize = (s) =>
  s
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/^\s*>\s?/, "").replace(/^\s*[-*]\s+/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Collect the block immediately following a claim: a fenced block, a blockquote run, or a bullet
 * list. Prose paragraphs are skipped — a claim followed by explanation rather than a quotation is not
 * making a checkable assertion about a specific block.
 */
function blockAfter(lines, start) {
  let i = start;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length) return null;

  if (lines[i].trim().startsWith("```")) {
    const body = [];
    i++;
    while (i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i++]);
    return { kind: "fence", text: body.join("\n"), line: start + 1 };
  }
  if (lines[i].trim().startsWith(">")) {
    const body = [];
    while (i < lines.length && (lines[i].trim().startsWith(">") || lines[i].trim() === "")) {
      if (lines[i].trim() === "" && !(lines[i + 1] ?? "").trim().startsWith(">")) break;
      body.push(lines[i++]);
    }
    return { kind: "quote", text: body.join("\n"), line: start + 1 };
  }
  if (/^\s*[-*]\s+/.test(lines[i])) {
    const body = [];
    while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) body.push(lines[i++]);
    return { kind: "list", text: body.join("\n"), line: start + 1 };
  }
  return null;
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

const sourceNorms = [];
for (const source of SOURCES) {
  sourceNorms.push(normalize(await readFile(source, "utf8")));
}
const inAnySource = (text) => sourceNorms.some((s) => s.includes(text));

let files = [];
try {
  files = (await readdir(path.join(ROOT, "standards"))).filter((f) => /^\d\d-.*\.md$/.test(f)).sort();
} catch {
  files = []; // No standards yet. Nothing claims anything, so nothing is unverified.
}

const failures = [];
const missingPaths = [];
let claims = 0;
let citedPaths = 0;

for (const file of files) {
  const relative = `standards/${file}`;
  const text = await readFile(path.join(ROOT, "standards", file), "utf8");
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    if (!CLAIM_RE.test(lines[i])) continue;
    const block = blockAfter(lines, i + 1);
    if (!block) continue;
    claims++;
    const norm = normalize(block.text);
    if (!norm || inAnySource(norm)) continue;

    // Report the first fragment that diverges, so the message points at the actual edit rather than
    // at the whole quotation.
    const words = norm.split(" ");
    let longest = "";
    for (let a = 0; a < words.length; a++) {
      for (let b = words.length; b > a; b--) {
        const frag = words.slice(a, b).join(" ");
        if (frag.length > longest.length && inAnySource(frag)) longest = frag;
      }
    }
    const cut = longest ? norm.indexOf(longest) + longest.length : 0;
    failures.push({
      file: relative,
      line: block.line,
      kind: block.kind,
      diverges: norm.slice(cut, cut + 120).trim() || norm.slice(0, 120),
      claimed: norm.slice(0, 160),
    });
  }

  // Cited worked examples must exist. A standard that points at a decision record which is not there
  // is claiming a demonstration it does not have.
  for (const match of text.matchAll(PATH_RE)) {
    const cited = match[1].replace(/^\.\.\//, "");
    citedPaths++;
    if (!(await exists(path.join(ROOT, cited)))) {
      missingPaths.push({ file: relative, cited });
    }
  }
}

const ok = failures.length === 0 && missingPaths.length === 0;

if (JSON_OUT) {
  process.stdout.write(
    JSON.stringify({ claims, citedPaths, failures, missingPaths, ok }, null, 2) + "\n",
  );
  process.exit(ok ? 0 : 1);
}

const out = [
  `Standards read:          ${files.length}`,
  `Verbatim claims checked: ${claims}`,
  `Cited example paths:     ${citedPaths}`,
  `Unverified claims:       ${failures.length}`,
  `Missing cited paths:     ${missingPaths.length}`,
  "",
];
for (const f of failures) {
  out.push(`! ${f.file}:${f.line} (${f.kind})`);
  out.push(`    claimed verbatim: ${f.claimed}${f.claimed.length >= 160 ? "…" : ""}`);
  out.push(`    diverges at:      ${f.diverges}`);
  out.push("");
}
for (const m of missingPaths) {
  out.push(`! ${m.file} cites '${m.cited}', which does not exist`);
}
if (missingPaths.length > 0) out.push("");

if (failures.length > 0) {
  out.push("A block claimed as source text does not appear in either source prompt. The usual cause");
  out.push("is formatting added to the quotation — backticks around an identifier, a changed dash, a");
  out.push("reworded line. Reproduce the source exactly, or drop the verbatim claim and state the");
  out.push("content as this pack's own in the Additions section.");
} else if (missingPaths.length > 0) {
  out.push("A standard cites a worked example that is not in the repository.");
} else {
  out.push("Every verbatim claim appears in a source prompt, and every cited example exists.");
}
process.stdout.write(out.join("\n") + "\n");
process.exit(ok ? 0 : 1);
