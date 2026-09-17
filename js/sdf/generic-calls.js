"use strict";
/* builtin calls for the generic evaluator. each entry receives the algebra,
   the matching sdf library and the argument values, where every argument is
   an array of 1–3 algebra elements. it returns an array of the same shape. */

function broadcast(fn, ...args) {
  const n = Math.max(...args.map(a => a.length));
  const out = new Array(n);
  for (let k = 0; k < n; k++) out[k] = fn(...args.map(a => a[a.length === 1 ? 0 : k]));
  return out;
}

const generic_calls = {
  sin: (alg, lib, [x]) => x.map(alg.sin),
  cos: (alg, lib, [x]) => x.map(alg.cos),
  abs: (alg, lib, [x]) => x.map(alg.abs),
  sqrt: (alg, lib, [x]) => x.map(alg.sqrt),
  exp: (alg, lib, [x]) => x.map(alg.exp),
  floor: (alg, lib, [x]) => x.map(alg.floor),
  fract: (alg, lib, [x]) => x.map(lib.fract),
  min: (alg, lib, [a, b]) => broadcast(alg.min, a, b),
  max: (alg, lib, [a, b]) => broadcast(alg.max, a, b),
  pow: (alg, lib, [a, b]) => broadcast(alg.pow, a, b),
  clamp: (alg, lib, [x, lo, hi]) => broadcast(lib.clamp, x, lo, hi),
  mix: (alg, lib, [a, b, u]) => broadcast(lib.mix, a, b, u),
  length: (alg, lib, [v]) => [lib.length(v)],
  dot: (alg, lib, [a, b]) => [lib.dot(a, b)],
  vec2: (alg, lib, args) => (args.length === 1 ? [args[0][0], args[0][0]] : [args[0][0], args[1][0]]),
  vec3: (alg, lib, args) => (args.length === 1 ? [args[0][0], args[0][0], args[0][0]] : [args[0][0], args[1][0], args[2][0]]),

  sphere: (alg, lib, [q, r]) => [lib.sphere(q[0], q[1], q[2], r[0])],
  box: (alg, lib, [q, b]) => [b.length === 1 ? lib.box(q[0], q[1], q[2], b[0], b[0], b[0]) : lib.box(q[0], q[1], q[2], b[0], b[1], b[2])],
  torus: (alg, lib, [q, major, r]) => [lib.torus(q[0], q[1], q[2], major[0], r[0])],
  cylinder: (alg, lib, [q, r, h]) => [lib.cylinder(q[0], q[1], q[2], r[0], h[0])],
  plane: (alg, lib, [q, h]) => [lib.plane(q[0], q[1], q[2], h[0])],
  gyroid: (alg, lib, [q, s]) => [lib.gyroid(q[0], q[1], q[2], s[0])],
  smin: (alg, lib, [a, b, k]) => [lib.smin(a[0], b[0], k[0])],
  smax: (alg, lib, [a, b, k]) => [lib.smax(a[0], b[0], k[0])],
  shell: (alg, lib, [d, w]) => [lib.shell(d[0], w[0])],
  rotx: (alg, lib, [q, a]) => lib.rot_x(q[0], q[1], q[2], a[0]),
  roty: (alg, lib, [q, a]) => lib.rot_y(q[0], q[1], q[2], a[0]),
  rotz: (alg, lib, [q, a]) => lib.rot_z(q[0], q[1], q[2], a[0]),
  rep: (alg, lib, [q, s]) => lib.rep(q[0], q[1], q[2], s[0]),
  twist: (alg, lib, [q, k]) => lib.twist(q[0], q[1], q[2], k[0]),
};
