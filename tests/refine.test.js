"use strict";

const refined_of = (src, resolution, extent) => {
  const r = compile_source(src, { mesh_resolution: resolution, mesh_extent: extent });
  assert(r.ok, r.error && r.error.message);
  return r;
};

test("refine: sphere vertices land on the surface", () => {
  const r = refined_of("sphere(p, 1.3)", 16, 2);
  const stats = r.mesh.refinement;
  assert(stats.mean_after < stats.mean_before, `${stats.mean_after} !< ${stats.mean_before}`);
  assert(stats.max_after < 1e-5, `max error ${stats.max_after}`);
  for (let i = 0; i < r.mesh.positions.length; i += 3) {
    const len = Math.hypot(r.mesh.positions[i], r.mesh.positions[i + 1], r.mesh.positions[i + 2]);
    assert_close(len, 1.3, 1e-5);
  }
});

test("refine: topology does not change", () => {
  const r = refined_of("torus(p, 1.2, 0.4)", 24, 2);
  assert_equal(r.mesh.euler, r.mesh_raw.euler);
  assert_equal(r.mesh.triangle_count, r.mesh_raw.triangle_count);
});

test("refine: sphere area gets closer to exact", () => {
  const r = refined_of("sphere(p, 1.5)", 16, 2);
  const exact = 4 * Math.PI * 1.5 * 1.5;
  assert(Math.abs(r.mesh.area - exact) <= Math.abs(r.mesh_raw.area - exact) + 1e-9,
    `refined ${r.mesh.area}, raw ${r.mesh_raw.area}, exact ${exact}`);
});

test("refine: never leaves a vertex worse than it started", () => {
  for (const preset of presets) {
    const r = refined_of(preset.src, 16, 3);
    assert(r.mesh.refinement.mean_after <= r.mesh.refinement.mean_before + 1e-12, preset.name);
  }
});
