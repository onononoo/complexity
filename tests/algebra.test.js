"use strict";

test("dual: sphere gradient is the unit radial direction", () => {
  const d = SDF_DUAL.sphere(new Dual(1, 1, 0, 0), new Dual(2, 0, 1, 0), new Dual(2, 0, 0, 1), DualAlgebra.c(1));
  assertClose(d.v, 2, 1e-12);
  assertClose(d.dx, 1 / 3, 1e-12);
  assertClose(d.dy, 2 / 3, 1e-12);
  assertClose(d.dz, 2 / 3, 1e-12);
});

test("dual: gradients agree with finite differences on the examples", () => {
  for (const preset of PRESETS) {
    const r = compileSource(preset.src);
    assert(r.gradient.samples > 0, preset.name);
    assert(r.gradient.median < 1e-4, `${preset.name}: median gradient error ${r.gradient.median}`);
  }
});

test("dual: pow and division rules", () => {
  const x = new Dual(2, 1, 0, 0);
  assertClose(DualAlgebra.pow(x, DualAlgebra.c(3)).dx, 12, 1e-12);
  assertClose(DualAlgebra.div(DualAlgebra.c(1), x).dx, -0.25, 1e-12);
});

test("interval: sine bounds include interior extrema", () => {
  const s = intervalSin(new Interval(0, Math.PI));
  assertClose(s.lo, 0, 1e-12);
  assertEqual(s.hi, 1);
  const c = IntervalAlgebra.cos(new Interval(3, 3.5));
  assertEqual(c.lo, -1);
});

test("interval: multiplication and square", () => {
  const m = IntervalAlgebra.mul(new Interval(-2, 3), new Interval(-1, 4));
  assertEqual(m.lo, -8);
  assertEqual(m.hi, 12);
  const s = IntervalAlgebra.sq(new Interval(-2, 3));
  assertEqual(s.lo, 0);
  assertEqual(s.hi, 9);
});

test("interval: division by an interval containing zero is unbounded", () => {
  const d = IntervalAlgebra.div(new Interval(1, 2), new Interval(-1, 1));
  assertEqual(d.lo, -Infinity);
  assertEqual(d.hi, Infinity);
});

test("interval: evaluation encloses sampled real values for every example", () => {
  const rnd = mulberry32(42);
  for (const preset of PRESETS) {
    const { g, root, info } = buildProgram(preset.src);
    for (let i = 0; i < 40; i++) {
      const c = samplePoint(rnd, 2);
      const hs = 0.05 + rnd() * 0.5;
      const t = rnd() * 10;
      const box = c.map(v => new Interval(v - hs, v + hs));
      const bound = evaluateGraph(g, root, info, IntervalAlgebra, SDF_INTERVAL, box, IntervalAlgebra.c(t));
      for (let j = 0; j < 8; j++) {
        const q = c.map(v => v + (rnd() * 2 - 1) * hs);
        const v = evaluateGraph(g, root, info, RealAlgebra, SDF_REAL, q, t);
        const eps = 1e-9 * Math.max(1, Math.abs(v));
        assert(v >= bound.lo - eps && v <= bound.hi + eps,
          `${preset.name}: ${v} outside [${bound.lo}, ${bound.hi}]`);
      }
    }
  }
});
