"use strict";

test("octree: sphere leaves hug the surface", () => {
  const { g, root, info } = buildProgram("sphere(p, 1.0)");
  const b = localizeSurface(g, root, info, 0, 4, 2);
  assert(b.surfaceLeaves > 0, "expected surface leaves");
  for (const [cx, cy, cz, hs] of b.leaves) {
    const distance = Math.abs(Math.hypot(cx, cy, cz) - 1);
    assert(distance <= hs * Math.sqrt(3) + 1e-9, `leaf at (${cx}, ${cy}, ${cz}) is ${distance} from the surface`);
  }
});

test("octree: culls cells entirely outside and inside", () => {
  const { g, root, info } = buildProgram("sphere(p, 1.5)");
  const b = localizeSurface(g, root, info, 0, 3, 3);
  assert(b.culledOutside > 0, "expected outside culling");
  assert(b.culledInside > 0, "expected inside culling");
  assert(b.surfaceLeaves < b.totalLeaves / 2, `too many leaves: ${b.surfaceLeaves}`);
});

test("octree: every true surface point lies in some leaf", () => {
  const { g, root, info } = buildProgram("torus(p, 1.0, 0.25)");
  const b = localizeSurface(g, root, info, 0, 4, 2);
  const rnd = mulberry32(7);
  for (let i = 0; i < 200; i++) {
    const u = rnd() * 2 * Math.PI, v = rnd() * 2 * Math.PI;
    const x = (1 + 0.25 * Math.cos(v)) * Math.cos(u), z = (1 + 0.25 * Math.cos(v)) * Math.sin(u), y = 0.25 * Math.sin(v);
    const inside = b.leaves.some(([cx, cy, cz, hs]) =>
      Math.abs(x - cx) <= hs + 1e-9 && Math.abs(y - cy) <= hs + 1e-9 && Math.abs(z - cz) <= hs + 1e-9);
    assert(inside, `surface point (${x}, ${y}, ${z}) not covered`);
  }
});
