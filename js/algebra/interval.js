"use strict";
/* interval arithmetic. every operation returns an interval guaranteed to
   contain the exact result for any inputs drawn from the argument intervals
   (ignoring rounding in the last unit in the last place). */

class interval {
  constructor(lo, hi) {
    this.lo = lo;
    this.hi = hi;
  }
}

const interval_entire = new interval(-Infinity, Infinity);
const two_pi = 2 * Math.PI;

function interval_from(values) {
  let lo = Infinity, hi = -Infinity;
  for (const v of values) {
    if (Number.isNaN(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return lo <= hi ? new interval(lo, hi) : interval_entire;
}

function interval_mul(a, b) {
  const products = [a.lo * b.lo, a.lo * b.hi, a.hi * b.lo, a.hi * b.hi].map(v => (Number.isNaN(v) ? 0 : v));
  return interval_from(products);
}

/* true when phase + 2πk lies inside [a.lo, a.hi] for some integer k. */
function interval_contains_phase(a, phase) {
  const k = Math.ceil((a.lo - phase) / two_pi);
  return phase + k * two_pi <= a.hi;
}

function interval_sin(a) {
  if (!Number.isFinite(a.lo) || !Number.isFinite(a.hi) || a.hi - a.lo >= two_pi) return new interval(-1, 1);
  const s0 = Math.sin(a.lo), s1 = Math.sin(a.hi);
  let lo = Math.min(s0, s1), hi = Math.max(s0, s1);
  if (interval_contains_phase(a, Math.PI / 2)) hi = 1;
  if (interval_contains_phase(a, -Math.PI / 2)) lo = -1;
  return new interval(lo, hi);
}

const interval_algebra = {
  name: "interval",
  c: v => new interval(v, v),
  add: (a, b) => new interval(a.lo + b.lo, a.hi + b.hi),
  sub: (a, b) => new interval(a.lo - b.hi, a.hi - b.lo),
  mul: interval_mul,
  div: (a, b) => {
    if (b.lo <= 0 && b.hi >= 0) return interval_entire;
    return interval_mul(a, new interval(1 / b.hi, 1 / b.lo));
  },
  neg: a => new interval(-a.hi, -a.lo),
  sq: a => {
    const l = a.lo * a.lo, h = a.hi * a.hi;
    if (a.lo >= 0) return new interval(l, h);
    if (a.hi <= 0) return new interval(h, l);
    return new interval(0, Math.max(l, h));
  },
  sqrt: a => new interval(Math.sqrt(Math.max(0, a.lo)), Math.sqrt(Math.max(0, a.hi))),
  abs: a => {
    if (a.lo >= 0) return a;
    if (a.hi <= 0) return new interval(-a.hi, -a.lo);
    return new interval(0, Math.max(-a.lo, a.hi));
  },
  min: (a, b) => new interval(Math.min(a.lo, b.lo), Math.min(a.hi, b.hi)),
  max: (a, b) => new interval(Math.max(a.lo, b.lo), Math.max(a.hi, b.hi)),
  floor: a => new interval(Math.floor(a.lo), Math.floor(a.hi)),
  sin: interval_sin,
  cos: a => interval_sin(new interval(a.lo + Math.PI / 2, a.hi + Math.PI / 2)),
  exp: a => new interval(Math.exp(a.lo), Math.exp(a.hi)),
  pow: (a, b) => {
    // pow(x, y) is monotone in each argument separately when x >= 0.
    if (a.lo >= 0) return interval_from([a.lo, a.hi].flatMap(x => [b.lo, b.hi].map(y => Math.pow(x, y))));
    if (b.lo === b.hi && Number.isInteger(b.lo)) {
      const corners = [Math.pow(a.lo, b.lo), Math.pow(a.hi, b.lo)];
      if (b.lo % 2 === 0 && a.hi >= 0) corners.push(Math.pow(0, b.lo));
      return interval_from(corners);
    }
    return interval_entire;
  },
  value: a => (a.lo + a.hi) / 2,
};
