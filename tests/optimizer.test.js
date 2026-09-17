"use strict";

const root_shape = src => {
  const { g, root } = build_program(src);
  return describe_node(g, root);
};

test("optimizer: folds constant builtin calls", () => {
  assert_equal(root_shape("sphere(p, sqrt(4.0) + cos(0.0))"), "call:sphere(p, 3)");
});

test("optimizer: removes multiplicative and additive identities", () => {
  assert_equal(root_shape("sphere(p, 1.0) * 1.0 + 0.0"), "call:sphere(p, 1)");
});

test("optimizer: min(x, x) collapses after sharing", () => {
  assert_equal(root_shape("sphere(p, 1.0) | sphere(p, 1.0)"), "call:sphere(p, 1)");
});

test("optimizer: commutative operands share one node", () => {
  const { g, root } = build_program("let a = p.x * p.y\nlet b = p.y * p.x\na - b");
  assert_equal(describe_node(g, root), "0", "a - a should fold to zero");
});

test("optimizer: reassociates constant multiplication", () => {
  assert_equal(root_shape("p.x * 2.0 * 3.0"), "*(.x(p), 6)");
});

test("optimizer: subtraction chains become one addition", () => {
  const { g, root } = build_program("p.x - 0.25 - 0.25");
  assert_equal(root.op, "+");
  const c = root.args.map(id => g.nodes[id]).find(n => n.op === "const");
  assert_equal(c.v, -0.5);
});

test("optimizer: division by a constant becomes multiplication", () => {
  assert_equal(root_shape("p.x / 4.0"), "*(.x(p), 0.25)");
});

test("optimizer: pow with small constant exponents", () => {
  assert_equal(root_shape("pow(p.x, 1.0)"), ".x(p)");
  assert_equal(root_shape("pow(p.x, 2.0)"), "*(.x(p), .x(p))");
  assert_equal(root_shape("pow(p.x, 0.5)"), "call:sqrt(.x(p))");
});

test("optimizer: double negation cancels", () => {
  assert_equal(root_shape("--p.x"), ".x(p)");
});

test("optimizer: projection out of a constructor", () => {
  assert_equal(root_shape("vec3(p.z, t, 1.0).y"), "t");
});

test("optimizer: user functions are inlined", () => {
  const { g, root } = build_program("fn ball(q) = sphere(q, 1.0)\nball(p)");
  assert_equal(describe_node(g, root), "call:sphere(p, 1)");
  assert_equal(g.stats.inlined, 1);
});

test("optimizer: dead nodes are not reachable", () => {
  const { info, warnings } = build_program("let unused = box(p, 1.0)\nsphere(p, 1.0)");
  assert(info.dead > 0, "expected dead nodes");
  assert_equal(warnings.length, 1);
});

test("types: rejects mismatched builtin arguments", () => {
  assert_throws(() => build_program("sphere(p.xy, 1.0)"), /does not accept \(vec2, float\)/);
});

test("types: rejects vec2 + vec3", () => {
  assert_throws(() => build_program("length(p.xy + p)"), /cannot apply/);
});

test("types: final expression must be a float", () => {
  assert_throws(() => build_program("p"), /must be a distance/);
});

test("types: suggests close names", () => {
  assert_throws(() => build_program("sphre(p, 1.0)"), /did you mean “sphere”/);
});

test("types: functions cannot call themselves", () => {
  assert_throws(() => build_program("fn f(q) = f(q)\nf(p.x)"), /unknown function “f”/);
});

test("types: z component of a vec2", () => {
  assert_throws(() => build_program("p.xy.z"), /no z component/);
});
