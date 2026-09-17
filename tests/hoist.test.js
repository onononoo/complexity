"use strict";

const hoist_of = src => {
  const prog = build_program(src);
  return Object.assign(prog, { hoist: hoist_time_invariants(prog.g, prog.root, prog.info) });
};

test("hoist: time-only subexpressions become uniform slots", () => {
  const { hoist } = hoist_of("sphere(p, 1.0 + 0.1 * sin(t * 2.0))");
  assert_equal(hoist.slots.size, 1);
  assert_equal(hoist.counts.f, 1);
});

test("hoist: programs without t hoist nothing", () => {
  const { hoist } = hoist_of("box(p, vec3(1.0, 2.0, 3.0)) | sphere(p, 1.0)");
  assert_equal(hoist.slots.size, 0);
});

test("hoist: leaves are not hoisted", () => {
  const { hoist } = hoist_of("sphere(p, t)");
  assert_equal(hoist.slots.size, 0);
});

test("hoist: only the largest time-only subexpression is taken", () => {
  const { hoist } = hoist_of("sphere(p, sin(t) * sin(t) + cos(t))");
  assert_equal(hoist.slots.size, 1, "inner sin(t) should live inside the hoisted program");
});

test("hoist: vector values get vec3 slots", () => {
  const { hoist } = hoist_of("sphere(p - vec3(0.0, sin(t), 0.0), 0.5)");
  assert_equal(hoist.counts.v3, 1);
  const runtime = make_hoist_runtime(hoist);
  runtime.update(1.25);
  assert_close(runtime.buffers.v3[1], Math.sin(1.25), 1e-6);
  assert_equal(runtime.buffers.v3[0], 0);
});

test("hoist: runtime values match the full program", () => {
  const src = "let r = 1.0 + 0.3 * sin(t * 1.5)\nsphere(p, r)";
  const { hoist } = hoist_of(src);
  const runtime = make_hoist_runtime(hoist);
  const full = new bytecode_vm(compile_source(src).bytecode);
  for (const t of [0, 0.7, 3.1]) {
    runtime.update(t);
    // at the origin, sphere(p, r) = -r
    assert_close(-runtime.buffers.f[0], full.run(0, 0, 0, t), 1e-6, `t = ${t}`);
  }
});

test("hoist: glsl declares the uniform array and uses its slots", () => {
  const r = compile_source("sphere(p, 1.0 + 0.1 * sin(t * 2.0)) | plane(p, 1.0 + cos(t))");
  assert(r.glsl.startsWith("uniform float u_hf[2];"), r.glsl);
  assert(r.glsl.includes("u_hf[0]") && r.glsl.includes("u_hf[1]"), r.glsl);
  assert(!/sin\(|cos\(/.test(r.glsl.split("{")[1]), "time-only math should not remain in map()");
});

test("hoist: every example still verifies and hoists something", () => {
  for (const preset of presets) {
    const r = compile_source(preset.src);
    assert(r.ok, preset.name);
    assert(r.hoist.slots.size > 0, `${preset.name} hoisted nothing`);
  }
});

test("hoist: runtime skips work when time has not changed", () => {
  const runtime = make_hoist_runtime(hoist_of("sphere(p, sin(t))").hoist);
  assert_equal(runtime.update(2), true);
  assert_equal(runtime.update(2), false);
});
