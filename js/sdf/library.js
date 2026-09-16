"use strict";
/* Distance functions and space operators written once against the algebra
   interface, then instantiated for real numbers, dual numbers and intervals.
   Vector-valued operators return arrays of three algebra elements. */

function makeSdfLibrary(A) {
  const zero = A.c(0), half = A.c(0.5), one = A.c(1);
  const len2 = (x, y) => A.sqrt(A.add(A.sq(x), A.sq(y)));
  const len3 = (x, y, z) => A.sqrt(A.add(A.add(A.sq(x), A.sq(y)), A.sq(z)));

  const L = {
    fract: x => A.sub(x, A.floor(x)),
    round: x => A.floor(A.add(x, half)),
    clamp: (x, a, b) => A.min(A.max(x, a), b),
    mix: (a, b, u) => A.add(a, A.mul(A.sub(b, a), u)),
    length: v => (v.length === 1 ? A.abs(v[0]) : v.length === 2 ? len2(v[0], v[1]) : len3(v[0], v[1], v[2])),
    dot: (a, b) => a.reduce((sum, x, i) => A.add(sum, A.mul(x, b[i])), zero),

    sphere: (x, y, z, r) => A.sub(len3(x, y, z), r),
    box: (x, y, z, bx, by, bz) => {
      const qx = A.sub(A.abs(x), bx), qy = A.sub(A.abs(y), by), qz = A.sub(A.abs(z), bz);
      const outside = len3(A.max(qx, zero), A.max(qy, zero), A.max(qz, zero));
      const inside = A.min(A.max(qx, A.max(qy, qz)), zero);
      return A.add(outside, inside);
    },
    torus: (x, y, z, R, r) => A.sub(len2(A.sub(len2(x, z), R), y), r),
    cylinder: (x, y, z, r, h) => {
      const dx = A.sub(len2(x, z), r), dy = A.sub(A.abs(y), h);
      return A.add(A.min(A.max(dx, dy), zero), len2(A.max(dx, zero), A.max(dy, zero)));
    },
    plane: (x, y, z, h) => A.add(y, h),
    gyroid: (x, y, z, s) => {
      const a = A.mul(x, s), b = A.mul(y, s), c = A.mul(z, s);
      const sum = A.add(A.add(A.mul(A.sin(a), A.cos(b)), A.mul(A.sin(b), A.cos(c))), A.mul(A.sin(c), A.cos(a)));
      return A.div(sum, s);
    },

    smin: (a, b, k) => {
      const h = L.clamp(A.add(half, A.div(A.mul(half, A.sub(b, a)), k)), zero, one);
      return A.sub(A.add(b, A.mul(A.sub(a, b), h)), A.mul(A.mul(k, h), A.sub(one, h)));
    },
    smax: (a, b, k) => A.neg(L.smin(A.neg(a), A.neg(b), k)),
    shell: (d, w) => A.sub(A.abs(d), w),

    rotX: (x, y, z, a) => {
      const c = A.cos(a), s = A.sin(a);
      return [x, A.sub(A.mul(c, y), A.mul(s, z)), A.add(A.mul(s, y), A.mul(c, z))];
    },
    rotY: (x, y, z, a) => {
      const c = A.cos(a), s = A.sin(a);
      return [A.add(A.mul(c, x), A.mul(s, z)), y, A.add(A.mul(A.neg(s), x), A.mul(c, z))];
    },
    rotZ: (x, y, z, a) => {
      const c = A.cos(a), s = A.sin(a);
      return [A.sub(A.mul(c, x), A.mul(s, y)), A.add(A.mul(s, x), A.mul(c, y)), z];
    },
    rep: (x, y, z, s) => [x, y, z].map(v => A.sub(v, A.mul(s, L.round(A.div(v, s))))),
    twist: (x, y, z, k) => L.rotY(x, y, z, A.mul(k, y)),
  };
  return L;
}

const SDF_REAL = makeSdfLibrary(RealAlgebra);
const SDF_DUAL = makeSdfLibrary(DualAlgebra);
const SDF_INTERVAL = makeSdfLibrary(IntervalAlgebra);
