"use strict";

const mesh_of = (src, resolution, extent) => extract_mesh(compile_source(src).bytecode, 0, resolution, extent);

test("mesh: sphere is closed with euler characteristic 2", () => {
  const m = mesh_of("sphere(p, 1.5)", 24, 2);
  assert(m.closed, `${m.boundary_edges} boundary edges`);
  assert_equal(m.nonmanifold_edges, 0);
  assert_equal(m.euler, 2);
});

test("mesh: sphere area and volume are close to exact", () => {
  const m = mesh_of("sphere(p, 1.5)", 32, 2);
  const area = 4 * Math.PI * 1.5 * 1.5, volume = (4 / 3) * Math.PI * 1.5 ** 3;
  assert(Math.abs(m.area - area) / area < 0.05, `area ${m.area}, expected ${area}`);
  assert(Math.abs(m.volume - volume) / volume < 0.05, `volume ${m.volume}, expected ${volume}`);
});

test("mesh: torus has euler characteristic 0", () => {
  const m = mesh_of("torus(p, 1.2, 0.4)", 32, 2);
  assert(m.closed, `${m.boundary_edges} boundary edges`);
  assert_equal(m.euler, 0);
});

test("mesh: vertices lie near the surface", () => {
  const m = mesh_of("box(p, vec3(1.0, 0.6, 0.8))", 24, 2);
  const vm = new bytecode_vm(compile_source("box(p, vec3(1.0, 0.6, 0.8))").bytecode);
  const h = 4 / 24;
  for (let i = 0; i < m.positions.length; i += 3) {
    const d = vm.run(m.positions[i], m.positions[i + 1], m.positions[i + 2], 0);
    assert(Math.abs(d) <= h * Math.sqrt(3), `vertex ${i / 3} is ${d} from the surface`);
  }
});

test("mesh: a field with no surface gives an empty mesh", () => {
  const m = mesh_of("sphere(p, 0.01) + 10.0", 8, 2);
  assert_equal(m.vertex_count, 0);
  assert_equal(m.triangle_count, 0);
});

test("mesh: open surfaces report boundary edges", () => {
  const m = mesh_of("plane(p, 0.3)", 12, 2);
  assert(!m.closed, "a plane cut by the grid should be open");
  assert(m.triangle_count > 0);
});

test("mesh: obj export numbers vertices from 1", () => {
  const m = mesh_of("sphere(p, 1.0)", 8, 2);
  const obj = mesh_to_obj(m, 100000);
  assert(/^v /m.test(obj) && /^f /m.test(obj));
  assert(!/^f .*\b0\b/m.test(obj), "obj indices start at 1");
});
