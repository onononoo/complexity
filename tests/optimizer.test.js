"use strict";

const rootShape = src => {
  const { g, root } = buildProgram(src);
  return describeNode(g, root);
};

test("optimizer: folds constant builtin calls", () => {
  assertEqual(rootShape("sphere(p, sqrt(4.0) + cos(0.0))"), "call:sphere(p, 3)");
});

test("optimizer: removes multiplicative and additive identities", () => {
  assertEqual(rootShape("sphere(p, 1.0) * 1.0 + 0.0"), "call:sphere(p, 1)");
});

test("optimizer: min(x, x) collapses after sharing", () => {
  assertEqual(rootShape("sphere(p, 1.0) | sphere(p, 1.0)"), "call:sphere(p, 1)");
});

test("optimizer: commutative operands share one node", () => {
  const { g, root } = buildProgram("let a = p.x * p.y\nlet b = p.y * p.x\na - b");
  assertEqual(describeNode(g, root), "0", "a - a should fold to zero");
});

test("optimizer: reassociates constant multiplication", () => {
  assertEqual(rootShape("p.x * 2.0 * 3.0"), "*(.x(p), 6)");
});

test("optimizer: subtraction chains become one addition", () => {
  const { g, root } = buildProgram("p.x - 0.25 - 0.25");
  assertEqual(root.op, "+");
  const c = root.args.map(id => g.nodes[id]).find(n => n.op === "const");
  assertEqual(c.v, -0.5);
});

test("optimizer: division by a constant becomes multiplication", () => {
  assertEqual(rootShape("p.x / 4.0"), "*(.x(p), 0.25)");
});

test("optimizer: pow with small constant exponents", () => {
  assertEqual(rootShape("pow(p.x, 1.0)"), ".x(p)");
  assertEqual(rootShape("pow(p.x, 2.0)"), "*(.x(p), .x(p))");
  assertEqual(rootShape("pow(p.x, 0.5)"), "call:sqrt(.x(p))");
});

test("optimizer: double negation cancels", () => {
  assertEqual(rootShape("--p.x"), ".x(p)");
});

test("optimizer: projection out of a constructor", () => {
  assertEqual(rootShape("vec3(p.z, t, 1.0).y"), "t");
});

test("optimizer: user functions are inlined", () => {
  const { g, root } = buildProgram("fn ball(q) = sphere(q, 1.0)\nball(p)");
  assertEqual(describeNode(g, root), "call:sphere(p, 1)");
  assertEqual(g.stats.inlined, 1);
});

test("optimizer: dead nodes are not reachable", () => {
  const { info, warnings } = buildProgram("let unused = box(p, 1.0)\nsphere(p, 1.0)");
  assert(info.dead > 0, "expected dead nodes");
  assertEqual(warnings.length, 1);
});

test("types: rejects mismatched builtin arguments", () => {
  assertThrows(() => buildProgram("sphere(p.xy, 1.0)"), /does not accept \(vec2, float\)/);
});

test("types: rejects vec2 + vec3", () => {
  assertThrows(() => buildProgram("length(p.xy + p)"), /Cannot apply/);
});

test("types: final expression must be a float", () => {
  assertThrows(() => buildProgram("p"), /must be a distance/);
});

test("types: suggests close names", () => {
  assertThrows(() => buildProgram("sphre(p, 1.0)"), /Did you mean “sphere”/);
});

test("types: functions cannot call themselves", () => {
  assertThrows(() => buildProgram("fn f(q) = f(q)\nf(p.x)"), /Unknown function “f”/);
});

test("types: z component of a vec2", () => {
  assertThrows(() => buildProgram("p.xy.z"), /no z component/);
});
