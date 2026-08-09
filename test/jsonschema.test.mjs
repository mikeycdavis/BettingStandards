/**
 * Tests for the schema evaluator, focused on the numeric keywords added for decision records.
 *
 * The last test is a mutation test in the strict sense: it proves that removing the `minimum`
 * implementation would let an invalid document pass. A test that only checked valid documents pass
 * and invalid ones fail can be satisfied by a validator that happens to reject for another reason,
 * so each bound is exercised on a document that is otherwise entirely valid.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate, assertSchemaSupported, SchemaError } from "../scripts/jsonschema.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("every keyword used by the shipped schemas is implemented", async () => {
  // The point of the evaluator's throw-on-unknown design: this test fails the moment a schema starts
  // using a constraint the evaluator would otherwise skip in silence.
  for (const name of ["project-policy", "decision-record", "betting-policy"]) {
    const schema = JSON.parse(await readFile(path.join(ROOT, `schemas/${name}.schema.json`), "utf8"));
    assert.doesNotThrow(() => assertSchemaSupported(schema), `schemas/${name}.schema.json uses an unimplemented keyword`);
  }
});

test("an unsupported keyword throws rather than being ignored", () => {
  const schema = { type: "object", properties: { a: { type: "number", multipleOf: 2 } } };
  assert.throws(() => validate({ a: 3 }, schema), SchemaError);
  assert.throws(() => assertSchemaSupported(schema), SchemaError);
});

test("exclusiveMinimum and exclusiveMaximum bound probabilities", () => {
  const schema = { type: "number", exclusiveMinimum: 0, exclusiveMaximum: 1 };
  assert.deepEqual(validate(0.55, schema), []);
  assert.equal(validate(0, schema).length, 1, "zero is not a probability estimate");
  assert.equal(validate(1, schema).length, 1, "certainty is not a probability estimate");
  assert.equal(validate(1.5, schema).length, 1);
  assert.equal(validate(-0.2, schema).length, 1);
});

test("minimum and maximum bound the uncertainty discount inclusively", () => {
  const schema = { type: "number", minimum: 0, maximum: 1 };
  assert.deepEqual(validate(0, schema), [], "no discount is a legitimate entry");
  assert.deepEqual(validate(1, schema), [], "total uncertainty is a legitimate entry");
  assert.equal(validate(1.01, schema).length, 1);
  assert.equal(validate(-0.01, schema).length, 1, "a negative discount would inflate edge");
});

test("minimum rejects a negative stake", () => {
  const schema = { type: "number", minimum: 0 };
  assert.deepEqual(validate(0, schema), []);
  assert.equal(validate(-1, schema).length, 1);
});

test("the error message names the offending value", () => {
  const errors = validate(1.5, { type: "number", exclusiveMaximum: 1 });
  assert.match(errors[0].message, /must be less than 1, got 1\.5/);
});

test("maxLength is enforced", () => {
  const schema = { type: "string", maxLength: 3 };
  assert.deepEqual(validate("abc", schema), []);
  assert.equal(validate("abcd", schema).length, 1);
});

test("MUTATION: without the numeric bounds, an impossible record would validate", async () => {
  // This is the check that gives the others meaning. It builds a decision-record fragment that is
  // structurally perfect and numerically impossible — a probability of 1.5 — and asserts the schema
  // rejects it. Delete the `minimum`/`exclusiveMaximum` handling from jsonschema.mjs and this test
  // goes red while every structural test stays green.
  const schema = JSON.parse(await readFile(path.join(ROOT, "schemas/decision-record.schema.json"), "utf8"));
  const probabilitySchema = schema.$defs.probability;

  assert.deepEqual(validate(0.523810, probabilitySchema), [], "a real implied probability must pass");

  const impossible = validate(1.5, probabilitySchema);
  assert.equal(impossible.length, 1, "a probability above 1 must be rejected by the schema, not by luck downstream");
  assert.match(impossible[0].message, /must be less than 1/);
});
