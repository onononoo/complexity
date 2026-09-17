"use strict";

test("backend: every builtin has a cpu kernel and a generic implementation", () => {
  for (const name of Object.keys(builtins)) {
    assert(kernel_by_name.has(name), `missing kernel for ${name}`);
    assert(typeof generic_calls[name] === "function", `missing generic call for ${name}`);
  }
});

test("backend: every example compiles through all cpu stages", () => {
  for (const preset of presets) {
    const r = compile_source(preset.src, { time: 1.25 });
    assert(r.ok, `${preset.name}: ${r.error && r.error.message}`);
    assert_equal(r.stages.length, cpu_stages.length, preset.name);
  }
});

test("backend: glsl output declares map and hoists shared values", () => {
  const r = compile_source("let s = sin(t)\nsphere(p, 1.0 + s * s)");
  assert(r.glsl.startsWith("float map(vec3 p) {"), r.glsl);
  assert_equal(r.temps, 1);
  assert(/float _0 = sin\(t\);/.test(r.glsl), r.glsl);
});

test("backend: glsl literals always contain a decimal point", () => {
  assert_equal(glsl_literal(2), "2.0");
  assert_equal(glsl_literal(-3), "(-3.0)");
  assert(/[.e]/.test(glsl_literal(1e-7)));
});

test("backend: vm matches hand-computed values", () => {
  const r = compile_source("box(p, vec3(1.0, 2.0, 3.0)) | sphere(p - vec3(5.0, 0.0, 0.0), 1.0)");
  const vm = new bytecode_vm(r.bytecode);
  assert_close(vm.run(0, 0, 0, 0), -1, 1e-12, "inside the box");
  assert_close(vm.run(5, 0, 0, 0), -1, 1e-12, "sphere centre");
  assert_close(vm.run(3, 0, 0, 0), 1, 1e-12, "between shapes");
});

test("backend: swizzles and broadcasting in the vm", () => {
  const r = compile_source("length(p.zx * 2.0 + vec2(1.0, 0.0)) - t");
  assert_close(new bytecode_vm(r.bytecode).run(0, 9, 1, 0.5), Math.hypot(3, 0) - 0.5, 1e-12);
});

test("backend: register allocation reuses freed registers", () => {
  const src = "sin(sin(sin(sin(sin(sin(p.x)))))) + cos(cos(cos(cos(p.y))))";
  const r = compile_source(src);
  assert(r.bytecode.reused > 0, "expected register reuse");
  assert(r.bytecode.regs < r.bytecode.count + r.bytecode.consts.length + 2, "expected fewer registers than values");
});

test("backend: disassembly lists every instruction", () => {
  const r = compile_source("sphere(p.zyx, 1.0)");
  const text = disassemble(r.bytecode);
  assert(text.includes("swizzle.zyx"), text);
  assert(text.includes("sphere"), text);
});

test("backend: verification compares against the generic evaluator", () => {
  for (const preset of presets) {
    const r = compile_source(preset.src);
    assert(r.verify.max <= verify_tolerance, `${preset.name}: ${r.verify.max}`);
  }
});

test("backend: a failed stage reports its name", () => {
  const r = compile_source("sphere(p)");
  assert_equal(r.ok, false);
  assert_equal(r.error.stage, "elab");
  assert_equal(r.stages.length, 2);
});
