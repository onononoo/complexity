"use strict";
/* Surface localisation. Recursively subdivides a cube and evaluates the
   distance field over each cell with interval arithmetic. A cell whose
   interval excludes zero cannot contain the surface and is discarded. */

function localizeSurface(g, root, info, t, depth, extent) {
  const A = IntervalAlgebra;
  const tInterval = A.c(t);
  const leaves = [];
  let evaluated = 0, culledOutside = 0, culledInside = 0;
  const stack = [[0, 0, 0, extent, 0]];

  while (stack.length) {
    const [cx, cy, cz, hs, level] = stack.pop();
    const p = [new Interval(cx - hs, cx + hs), new Interval(cy - hs, cy + hs), new Interval(cz - hs, cz + hs)];
    const d = evaluateGraph(g, root, info, A, SDF_INTERVAL, p, tInterval);
    evaluated++;
    if (d.lo > 0) { culledOutside++; continue; }
    if (d.hi < 0) { culledInside++; continue; }
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
    surfaceLeaves: leaves.length,
    totalLeaves: 8 ** depth,
    evaluated,
    culledOutside,
    culledInside,
  };
}
