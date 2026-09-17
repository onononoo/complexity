"use strict";
/* mesh refinement. surface nets put each vertex at an average of linear
   zero crossings, which is only roughly on the surface. this moves every
   vertex onto the surface with newton steps along the gradient:

       x ← x − f(x) · ∇f(x) / |∇f(x)|²

   f and ∇f come from the generic evaluator over dual numbers. a step is
   never allowed to move more than one grid cell, and a vertex that ends up
   further from the surface than it started is put back. */

const refine_tolerance = 1e-6;

function refine_mesh(g, root, info, mesh, t, iterations) {
  const positions = new Float32Array(mesh.positions);
  const h = (2 * mesh.extent) / mesh.resolution;
  const t_dual = new dual(t, 0, 0, 0);
  const field = (x, y, z) => evaluate_graph(g, root, info, dual_algebra, sdf_dual,
    [new dual(x, 1, 0, 0), new dual(y, 0, 1, 0), new dual(z, 0, 0, 1)], t_dual);

  let sum_before = 0, sum_after = 0, max_after = 0, steps = 0, reverted = 0, counted = 0;

  for (let i = 0; i < positions.length; i += 3) {
    const x0 = positions[i], y0 = positions[i + 1], z0 = positions[i + 2];
    let x = x0, y = y0, z = z0;
    let d = field(x, y, z);
    const before = Math.abs(d.v);
    if (!Number.isFinite(before)) continue;

    for (let it = 0; it < iterations && Math.abs(d.v) > refine_tolerance; it++) {
      const gg = d.dx * d.dx + d.dy * d.dy + d.dz * d.dz;
      if (!(gg > 1e-12)) break;
      let s = d.v / gg;
      const move = Math.abs(s) * Math.sqrt(gg);
      if (move > h) s *= h / move;
      x -= d.dx * s;
      y -= d.dy * s;
      z -= d.dz * s;
      d = field(x, y, z);
      steps++;
    }

    let after = Math.abs(d.v);
    if (!(after <= before)) {
      x = x0; y = y0; z = z0;
      after = before;
      reverted++;
    }
    positions[i] = x;
    positions[i + 1] = y;
    positions[i + 2] = z;
    sum_before += before;
    sum_after += after;
    max_after = Math.max(max_after, after);
    counted++;
  }

  const refined = summarize_mesh(positions, mesh.triangles, {
    resolution: mesh.resolution,
    extent: mesh.extent,
    time: mesh.time,
    samples: mesh.samples,
  });
  refined.refinement = {
    iterations,
    steps,
    reverted,
    mean_before: counted ? sum_before / counted : 0,
    mean_after: counted ? sum_after / counted : 0,
    max_after,
  };
  return refined;
}
