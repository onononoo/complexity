"use strict";

const bytecode_of = (src, options) => {
  const prog = build_program(src);
  return compile_bytecode(prog.g, prog.root, prog.info, options);
};

test("fusion: a * b + c becomes one instruction", () => {
  const fused = bytecode_of("p.x * p.y + p.z");
  const plain = bytecode_of("p.x * p.y + p.z", { fuse: false });
  assert_equal(fused.fused, 1);
  assert_equal(fused.count, plain.count - 1);
  assert(disassemble(fused).includes("muladd"));
});

test("fusion: shared products are not fused", () => {
  const prog = bytecode_of("let m = p.x * p.y\n(m + p.z) + m");
  assert_equal(prog.fused, 0);
});

test("fusion: fused and unfused programs give identical results", () => {
  const rnd = mulberry32(99);
  for (const preset of presets) {
    const fused = new bytecode_vm(bytecode_of(preset.src));
    const plain = new bytecode_vm(bytecode_of(preset.src, { fuse: false }));
    for (let i = 0; i < 50; i++) {
      const [x, y, z] = sample_point(rnd, 2);
      const t = rnd() * 10;
      assert(Object.is(fused.run(x, y, z, t), plain.run(x, y, z, t)), `${preset.name} at ${x}, ${y}, ${z}`);
    }
  }
});

test("fusion: vector products broadcast the same as separate ops", () => {
  const src = "length(p * 2.0 + vec3(1.0, 0.0, 0.0)) - 1.0";
  const fused = new bytecode_vm(bytecode_of(src));
  assert_equal(bytecode_of(src).fused, 1);
  assert_close(fused.run(0.5, 1, 0, 0), Math.hypot(2, 2, 0) - 1, 1e-12);
});
