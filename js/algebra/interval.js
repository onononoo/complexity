"use strict";
/* Interval arithmetic. Every operation returns an interval guaranteed to
   contain the exact result for any inputs drawn from the argument intervals
   (ignoring rounding in the last unit in the last place). */

class Interval {
  constructor(lo, hi) {
    this.lo = lo;
    this.hi = hi;
  }
}

const INTERVAL_ENTIRE = new Interval(-Infinity, Infinity);
const TWO_PI = 2 * Math.PI;

function intervalFrom(values) {
  let lo = Infinity, hi = -Infinity;
  for (const v of values) {
    if (Number.isNaN(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return lo <= hi ? new Interval(lo, hi) : INTERVAL_ENTIRE;
}

function intervalMul(a, b) {
  const products = [a.lo * b.lo, a.lo * b.hi, a.hi * b.lo, a.hi * b.hi].map(v => (Number.isNaN(v) ? 0 : v));
  return intervalFrom(products);
}

/* True when phase + 2πk lies inside [a.lo, a.hi] for some integer k. */
function intervalContainsPhase(a, phase) {
  const k = Math.ceil((a.lo - phase) / TWO_PI);
  return phase + k * TWO_PI <= a.hi;
}

function intervalSin(a) {
  if (!Number.isFinite(a.lo) || !Number.isFinite(a.hi) || a.hi - a.lo >= TWO_PI) return new Interval(-1, 1);
  const s0 = Math.sin(a.lo), s1 = Math.sin(a.hi);
  let lo = Math.min(s0, s1), hi = Math.max(s0, s1);
  if (intervalContainsPhase(a, Math.PI / 2)) hi = 1;
  if (intervalContainsPhase(a, -Math.PI / 2)) lo = -1;
  return new Interval(lo, hi);
}

const IntervalAlgebra = {
  name: "interval",
  c: v => new Interval(v, v),
  add: (a, b) => new Interval(a.lo + b.lo, a.hi + b.hi),
  sub: (a, b) => new Interval(a.lo - b.hi, a.hi - b.lo),
  mul: intervalMul,
  div: (a, b) => {
    if (b.lo <= 0 && b.hi >= 0) return INTERVAL_ENTIRE;
    return intervalMul(a, new Interval(1 / b.hi, 1 / b.lo));
  },
  neg: a => new Interval(-a.hi, -a.lo),
  sq: a => {
    const l = a.lo * a.lo, h = a.hi * a.hi;
    if (a.lo >= 0) return new Interval(l, h);
    if (a.hi <= 0) return new Interval(h, l);
    return new Interval(0, Math.max(l, h));
  },
  sqrt: a => new Interval(Math.sqrt(Math.max(0, a.lo)), Math.sqrt(Math.max(0, a.hi))),
  abs: a => {
    if (a.lo >= 0) return a;
    if (a.hi <= 0) return new Interval(-a.hi, -a.lo);
    return new Interval(0, Math.max(-a.lo, a.hi));
  },
  min: (a, b) => new Interval(Math.min(a.lo, b.lo), Math.min(a.hi, b.hi)),
  max: (a, b) => new Interval(Math.max(a.lo, b.lo), Math.max(a.hi, b.hi)),
  floor: a => new Interval(Math.floor(a.lo), Math.floor(a.hi)),
  sin: intervalSin,
  cos: a => intervalSin(new Interval(a.lo + Math.PI / 2, a.hi + Math.PI / 2)),
  exp: a => new Interval(Math.exp(a.lo), Math.exp(a.hi)),
  pow: (a, b) => {
    // pow(x, y) is monotone in each argument separately when x >= 0.
    if (a.lo >= 0) return intervalFrom([a.lo, a.hi].flatMap(x => [b.lo, b.hi].map(y => Math.pow(x, y))));
    if (b.lo === b.hi && Number.isInteger(b.lo)) {
      const corners = [Math.pow(a.lo, b.lo), Math.pow(a.hi, b.lo)];
      if (b.lo % 2 === 0 && a.hi >= 0) corners.push(Math.pow(0, b.lo));
      return intervalFrom(corners);
    }
    return INTERVAL_ENTIRE;
  },
  value: a => (a.lo + a.hi) / 2,
};
