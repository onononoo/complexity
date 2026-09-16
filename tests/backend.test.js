"use strict";

test("backend: every builtin has a CPU kernel and a generic implementation", () => {
  for (const name of Object.keys(B)) {
    assert(KERNEL_BY_NAME.has(name), `missing kernel for ${name}`);
    assert(typeof GENERIC_CALLS[name] === "function", `missing generic call for ${name}`);
  }
});

test("backend: every example compiles through all CPU stages", () => {
  for (const preset of PRESETS) {
    const r = compileSource(preset.src, { time: 1.25 });
    assert(r.ok, `${preset.name}: ${r.error && r.error.message}`);
    assertEqual(r.stages.length, CPU_STAGES.length, preset.name);
  }
});

test("backend: GLSL output declares map and hoists shared values", () => {
  const r = compileSource("let s = sin(t)\nsphere(p, 1.0 + s * s)");
  assert(r.glsl.startsWith("float map(vec3 p) {"), r.glsl);
  assertEqual(r.temps, 1);
  assert(/float _0 = sin\(t\);/.test(r.glsl), r.glsl);
});

test("backend: GLSL literals always contain a decimal point", () => {
  assertEqual(glslLiteral(2), "2.0");
  assertEqual(glslLiteral(-3), "(-3.0)");
  assert(/[.e]/.test(glslLiteral(1e-7)));
});

test("backend: VM matches hand-computed values", () => {
  const r = compileSource("box(p, vec3(1.0, 2.0, 3.0)) | sphere(p - vec3(5.0, 0.0, 0.0), 1.0)");
  const vm = new VM(r.bytecode);
  assertClose(vm.run(0, 0, 0, 0), -1, 1e-12, "inside the box");
  assertClose(vm.run(5, 0, 0, 0), -1, 1e-12, "sphere centre");
  assertClose(vm.run(3, 0, 0, 0), 1, 1e-12, "between shapes");
});

test("backend: swizzles and broadcasting in the VM", () => {
  const r = compileSource("length(p.zx * 2.0 + vec2(1.0, 0.0)) - t");
  assertClose(new VM(r.bytecode).run(0, 9, 1, 0.5), Math.hypot(3, 0) - 0.5, 1e-12);
});

test("backend: register allocation reuses freed registers", () => {
  const src = "sin(sin(sin(sin(sin(sin(p.x)))))) + cos(cos(cos(cos(p.y))))";
  const r = compileSource(src);
  assert(r.bytecode.reused > 0, "expected register reuse");
  assert(r.bytecode.regs < r.bytecode.count + r.bytecode.consts.length + 2, "expected fewer registers than values");
});

test("backend: disassembly lists every instruction", () => {
  const r = compileSource("sphere(p.zyx, 1.0)");
  const text = disassemble(r.bytecode);
  assert(text.includes("swizzle.zyx"), text);
  assert(text.includes("sphere"), text);
});

test("backend: verification compares against the generic evaluator", () => {
  for (const preset of PRESETS) {
    const r = compileSource(preset.src);
    assert(r.verify.max <= VERIFY_TOLERANCE, `${preset.name}: ${r.verify.max}`);
  }
});

test("backend: a failed stage reports its name", () => {
  const r = compileSource("sphere(p)");
  assertEqual(r.ok, false);
  assertEqual(r.error.stage, "elab");
  assertEqual(r.stages.length, 2);
});
