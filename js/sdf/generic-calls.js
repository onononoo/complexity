"use strict";
/* Builtin calls for the generic evaluator. Each entry receives the algebra,
   the matching SDF library and the argument values, where every argument is
   an array of 1–3 algebra elements. It returns an array of the same shape. */

function broadcast(fn, ...args) {
  const n = Math.max(...args.map(a => a.length));
  const out = new Array(n);
  for (let k = 0; k < n; k++) out[k] = fn(...args.map(a => a[a.length === 1 ? 0 : k]));
  return out;
}

const GENERIC_CALLS = {
  sin: (A, L, [x]) => x.map(A.sin),
  cos: (A, L, [x]) => x.map(A.cos),
  abs: (A, L, [x]) => x.map(A.abs),
  sqrt: (A, L, [x]) => x.map(A.sqrt),
  exp: (A, L, [x]) => x.map(A.exp),
  floor: (A, L, [x]) => x.map(A.floor),
  fract: (A, L, [x]) => x.map(L.fract),
  min: (A, L, [a, b]) => broadcast(A.min, a, b),
  max: (A, L, [a, b]) => broadcast(A.max, a, b),
  pow: (A, L, [a, b]) => broadcast(A.pow, a, b),
  clamp: (A, L, [x, lo, hi]) => broadcast(L.clamp, x, lo, hi),
  mix: (A, L, [a, b, u]) => broadcast(L.mix, a, b, u),
  length: (A, L, [v]) => [L.length(v)],
  dot: (A, L, [a, b]) => [L.dot(a, b)],
  vec2: (A, L, args) => (args.length === 1 ? [args[0][0], args[0][0]] : [args[0][0], args[1][0]]),
  vec3: (A, L, args) => (args.length === 1 ? [args[0][0], args[0][0], args[0][0]] : [args[0][0], args[1][0], args[2][0]]),

  sphere: (A, L, [q, r]) => [L.sphere(q[0], q[1], q[2], r[0])],
  box: (A, L, [q, b]) => [b.length === 1 ? L.box(q[0], q[1], q[2], b[0], b[0], b[0]) : L.box(q[0], q[1], q[2], b[0], b[1], b[2])],
  torus: (A, L, [q, R, r]) => [L.torus(q[0], q[1], q[2], R[0], r[0])],
  cylinder: (A, L, [q, r, h]) => [L.cylinder(q[0], q[1], q[2], r[0], h[0])],
  plane: (A, L, [q, h]) => [L.plane(q[0], q[1], q[2], h[0])],
  gyroid: (A, L, [q, s]) => [L.gyroid(q[0], q[1], q[2], s[0])],
  smin: (A, L, [a, b, k]) => [L.smin(a[0], b[0], k[0])],
  smax: (A, L, [a, b, k]) => [L.smax(a[0], b[0], k[0])],
  shell: (A, L, [d, w]) => [L.shell(d[0], w[0])],
  rotx: (A, L, [q, a]) => L.rotX(q[0], q[1], q[2], a[0]),
  roty: (A, L, [q, a]) => L.rotY(q[0], q[1], q[2], a[0]),
  rotz: (A, L, [q, a]) => L.rotZ(q[0], q[1], q[2], a[0]),
  rep: (A, L, [q, s]) => L.rep(q[0], q[1], q[2], s[0]),
  twist: (A, L, [q, k]) => L.twist(q[0], q[1], q[2], k[0]),
};
