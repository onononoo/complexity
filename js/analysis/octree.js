"use strict";
/* surface localisation. recursively subdivides a cube and evaluates the
   distance field over each cell with interval arithmetic. a cell whose
   interval excludes zero cannot contain the surface and is discarded. */

function localize_surface(g, root, info, t, depth, extent) {
  const alg = interval_algebra;
  const t_interval = alg.c(t);
  const leaves = [];
  let evaluated = 0, culled_outside = 0, culled_inside = 0;
  const stack = [[0, 0, 0, extent, 0]];

  while (stack.length) {
    const [cx, cy, cz, hs, level] = stack.pop();
    const p = [new interval(cx - hs, cx + hs), new interval(cy - hs, cy + hs), new interval(cz - hs, cz + hs)];
    const d = evaluate_graph(g, root, info, alg, sdf_interval, p, t_interval);
    evaluated++;
    if (d.lo > 0) { culled_outside++; continue; }
    if (d.hi < 0) { culled_inside++; continue; }
    if (level === depth) { leaves.push([cx, cy, cz, hs]); continue; }
    const q = hs / 2;
    for (const dx of [-q, q]) for (const dy of [-q, q]) for (const dz of [-q, q]) {
      stack.push([cx + dx, cy + dy, cz + dz, q, level + 1]);
    }
  }

  return {
    depth,
    extent,
    time: t,
    leaves,
    surface_leaves: leaves.length,
    total_leaves: 8 ** depth,
    evaluated,
    culled_outside,
    culled_inside,
  };
}
