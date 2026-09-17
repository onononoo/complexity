"use strict";

test("dual: sphere gradient is the unit radial direction", () => {
  const d = sdf_dual.sphere(new dual(1, 1, 0, 0), new dual(2, 0, 1, 0), new dual(2, 0, 0, 1), dual_algebra.c(1));
  assert_close(d.v, 2, 1e-12);
  assert_close(d.dx, 1 / 3, 1e-12);
  assert_close(d.dy, 2 / 3, 1e-12);
  assert_close(d.dz, 2 / 3, 1e-12);
});

test("dual: gradients agree with finite differences on the examples", () => {
  for (const preset of presets) {
    const r = compile_source(preset.src);
    assert(r.gradient.samples > 0, preset.name);
    assert(r.gradient.median < 1e-4, `${preset.name}: median gradient error ${r.gradient.median}`);
  }
});

test("dual: pow and division rules", () => {
  const x = new dual(2, 1, 0, 0);
  assert_close(dual_algebra.pow(x, dual_algebra.c(3)).dx, 12, 1e-12);
  assert_close(dual_algebra.div(dual_algebra.c(1), x).dx, -0.25, 1e-12);
});

test("interval: sine bounds include interior extrema", () => {
  const s = interval_sin(new interval(0, Math.PI));
  assert_close(s.lo, 0, 1e-12);
  assert_equal(s.hi, 1);
  const c = interval_algebra.cos(new interval(3, 3.5));
  assert_equal(c.lo, -1);
});

test("interval: multiplication and square", () => {
  const m = interval_algebra.mul(new interval(-2, 3), new interval(-1, 4));
  assert_equal(m.lo, -8);
  assert_equal(m.hi, 12);
  const s = interval_algebra.sq(new interval(-2, 3));
  assert_equal(s.lo, 0);
  assert_equal(s.hi, 9);
});

test("interval: division by an interval containing zero is unbounded", () => {
  const d = interval_algebra.div(new interval(1, 2), new interval(-1, 1));
  assert_equal(d.lo, -Infinity);
  assert_equal(d.hi, Infinity);
});

test("interval: evaluation encloses sampled real values for every example", () => {
  const rnd = mulberry32(42);
  for (const preset of presets) {
    const { g, root, info } = build_program(preset.src);
    for (let i = 0; i < 40; i++) {
      const c = sample_point(rnd, 2);
      const hs = 0.05 + rnd() * 0.5;
      const t = rnd() * 10;
      const box = c.map(v => new interval(v - hs, v + hs));
      const bound = evaluate_graph(g, root, info, interval_algebra, sdf_interval, box, interval_algebra.c(t));
      for (let j = 0; j < 8; j++) {
        const q = c.map(v => v + (rnd() * 2 - 1) * hs);
        const v = evaluate_graph(g, root, info, real_algebra, sdf_real, q, t);
        const eps = 1e-9 * Math.max(1, Math.abs(v));
        assert(v >= bound.lo - eps && v <= bound.hi + eps,
          `${preset.name}: ${v} outside [${bound.lo}, ${bound.hi}]`);
      }
    }
  }
});
