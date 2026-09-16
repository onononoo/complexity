"use strict";
/* Minimal test harness. */

const TEST_REGISTRY = [];

function test(name, fn) {
  TEST_REGISTRY.push({ name, fn });
}

class AssertionError extends Error {}

function assert(condition, message) {
  if (!condition) throw new AssertionError(message || "Assertion failed");
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new AssertionError(`${message ? message + ": " : ""}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertClose(actual, expected, tolerance, message) {
  if (!(Math.abs(actual - expected) <= tolerance)) {
    throw new AssertionError(`${message ? message + ": " : ""}expected ${expected} ± ${tolerance}, got ${actual}`);
  }
}

function assertThrows(fn, pattern, message) {
  try {
    fn();
  } catch (e) {
    if (pattern && !pattern.test(e.message)) {
      throw new AssertionError(`${message ? message + ": " : ""}error message ${JSON.stringify(e.message)} does not match ${pattern}`);
    }
    return e;
  }
  throw new AssertionError(message || "Expected an error to be thrown");
}

/* Helpers shared by test files. */
function buildProgram(src) {
  const el = elaborate(parse(lex(src)));
  const info = analyze(el.g, el.root);
  return { g: el.g, root: el.root, info, warnings: el.warnings };
}

function describeNode(g, n) {
  if (n.op === "const") return String(n.v);
  if (!n.args.length) return n.op;
  return `${n.op}(${n.args.map(id => describeNode(g, g.nodes[id])).join(", ")})`;
}

function runTests(filter) {
  let passed = 0, failed = 0;
  for (const t of TEST_REGISTRY) {
    if (filter && !t.name.includes(filter)) continue;
    try {
      t.fn();
      passed++;
      console.log(`ok    ${t.name}`);
    } catch (e) {
      failed++;
      console.log(`FAIL  ${t.name}\n      ${e instanceof AssertionError ? e.message : e.stack}`);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  return { passed, failed };
}
