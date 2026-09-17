"use strict";
/* minimal test harness. */

const test_registry = [];

function test(name, fn) {
  test_registry.push({ name, fn });
}

class assertion_error extends Error {}

function assert(condition, message) {
  if (!condition) throw new assertion_error(message || "assertion failed");
}

function assert_equal(actual, expected, message) {
  if (actual !== expected) {
    throw new assertion_error(`${message ? message + ": " : ""}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assert_close(actual, expected, tolerance, message) {
  if (!(Math.abs(actual - expected) <= tolerance)) {
    throw new assertion_error(`${message ? message + ": " : ""}expected ${expected} ± ${tolerance}, got ${actual}`);
  }
}

function assert_throws(fn, pattern, message) {
  try {
    fn();
  } catch (e) {
    if (pattern && !pattern.test(e.message)) {
      throw new assertion_error(`${message ? message + ": " : ""}error message ${JSON.stringify(e.message)} does not match ${pattern}`);
    }
    return e;
  }
  throw new assertion_error(message || "expected an error to be thrown");
}

/* helpers shared by test files. */
function build_program(src) {
  const el = elaborate(parse(lex(src)));
  const info = analyze(el.g, el.root);
  return { g: el.g, root: el.root, info, warnings: el.warnings };
}

function describe_node(g, n) {
  if (n.op === "const") return String(n.v);
  if (!n.args.length) return n.op;
  return `${n.op}(${n.args.map(id => describe_node(g, g.nodes[id])).join(", ")})`;
}

function run_tests(filter) {
  let passed = 0, failed = 0;
  for (const t of test_registry) {
    if (filter && !t.name.includes(filter)) continue;
    try {
      t.fn();
      passed++;
      console.log(`ok    ${t.name}`);
    } catch (e) {
      failed++;
      console.log(`fail  ${t.name}\n      ${e instanceof assertion_error ? e.message : e.stack}`);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  return { passed, failed };
}
