"use strict";
/* deterministic pseudo-random numbers, so analysis results are repeatable. */

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function sample_point(rnd, extent) {
  return [rnd() * 2 * extent - extent, rnd() * 2 * extent - extent, rnd() * 2 * extent - extent];
}
