"use strict";
/* distance functions and space operators written once against the algebra
   interface, then instantiated for real numbers, dual numbers and intervals.
   vector-valued operators return arrays of three algebra elements. */

function make_sdf_library(alg) {
  const zero = alg.c(0), half = alg.c(0.5), one = alg.c(1);
  const len2 = (x, y) => alg.sqrt(alg.add(alg.sq(x), alg.sq(y)));
  const len3 = (x, y, z) => alg.sqrt(alg.add(alg.add(alg.sq(x), alg.sq(y)), alg.sq(z)));

  const lib = {
    fract: x => alg.sub(x, alg.floor(x)),
    round: x => alg.floor(alg.add(x, half)),
    clamp: (x, a, b) => alg.min(alg.max(x, a), b),
    mix: (a, b, u) => alg.add(a, alg.mul(alg.sub(b, a), u)),
    length: v => (v.length === 1 ? alg.abs(v[0]) : v.length === 2 ? len2(v[0], v[1]) : len3(v[0], v[1], v[2])),
    dot: (a, b) => a.reduce((sum, x, i) => alg.add(sum, alg.mul(x, b[i])), zero),

    sphere: (x, y, z, r) => alg.sub(len3(x, y, z), r),
    box: (x, y, z, bx, by, bz) => {
      const qx = alg.sub(alg.abs(x), bx), qy = alg.sub(alg.abs(y), by), qz = alg.sub(alg.abs(z), bz);
      const outside = len3(alg.max(qx, zero), alg.max(qy, zero), alg.max(qz, zero));
      const inside = alg.min(alg.max(qx, alg.max(qy, qz)), zero);
      return alg.add(outside, inside);
    },
    torus: (x, y, z, major, r) => alg.sub(len2(alg.sub(len2(x, z), major), y), r),
    cylinder: (x, y, z, r, h) => {
      const dx = alg.sub(len2(x, z), r), dy = alg.sub(alg.abs(y), h);
      return alg.add(alg.min(alg.max(dx, dy), zero), len2(alg.max(dx, zero), alg.max(dy, zero)));
    },
    plane: (x, y, z, h) => alg.add(y, h),
    gyroid: (x, y, z, s) => {
      const a = alg.mul(x, s), b = alg.mul(y, s), c = alg.mul(z, s);
      const sum = alg.add(alg.add(alg.mul(alg.sin(a), alg.cos(b)), alg.mul(alg.sin(b), alg.cos(c))), alg.mul(alg.sin(c), alg.cos(a)));
      return alg.div(sum, s);
    },

    smin: (a, b, k) => {
      const h = lib.clamp(alg.add(half, alg.div(alg.mul(half, alg.sub(b, a)), k)), zero, one);
      return alg.sub(alg.add(b, alg.mul(alg.sub(a, b), h)), alg.mul(alg.mul(k, h), alg.sub(one, h)));
    },
    smax: (a, b, k) => alg.neg(lib.smin(alg.neg(a), alg.neg(b), k)),
    shell: (d, w) => alg.sub(alg.abs(d), w),

    rot_x: (x, y, z, a) => {
      const c = alg.cos(a), s = alg.sin(a);
      return [x, alg.sub(alg.mul(c, y), alg.mul(s, z)), alg.add(alg.mul(s, y), alg.mul(c, z))];
    },
    rot_y: (x, y, z, a) => {
      const c = alg.cos(a), s = alg.sin(a);
      return [alg.add(alg.mul(c, x), alg.mul(s, z)), y, alg.add(alg.mul(alg.neg(s), x), alg.mul(c, z))];
    },
    rot_z: (x, y, z, a) => {
      const c = alg.cos(a), s = alg.sin(a);
      return [alg.sub(alg.mul(c, x), alg.mul(s, y)), alg.add(alg.mul(s, x), alg.mul(c, y)), z];
    },
    rep: (x, y, z, s) => [x, y, z].map(v => alg.sub(v, alg.mul(s, lib.round(alg.div(v, s))))),
    twist: (x, y, z, k) => lib.rot_y(x, y, z, alg.mul(k, y)),
  };
  return lib;
}

const sdf_real = make_sdf_library(real_algebra);
const sdf_dual = make_sdf_library(dual_algebra);
const sdf_interval = make_sdf_library(interval_algebra);
