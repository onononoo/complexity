"use strict";
/* Forward-mode automatic differentiation. A Dual carries a value and its
   partial derivatives with respect to p.x, p.y and p.z. */

class Dual {
  constructor(v, dx, dy, dz) {
    this.v = v;
    this.dx = dx;
    this.dy = dy;
    this.dz = dz;
  }
}

function dualChain(a, value, derivative) {
  return new Dual(value, derivative * a.dx, derivative * a.dy, derivative * a.dz);
}

function dualNeg(a) {
  return new Dual(-a.v, -a.dx, -a.dy, -a.dz);
}

const DualAlgebra = {
  name: "dual",
  c: v => new Dual(v, 0, 0, 0),
  add: (a, b) => new Dual(a.v + b.v, a.dx + b.dx, a.dy + b.dy, a.dz + b.dz),
  sub: (a, b) => new Dual(a.v - b.v, a.dx - b.dx, a.dy - b.dy, a.dz - b.dz),
  mul: (a, b) => new Dual(a.v * b.v, a.dx * b.v + a.v * b.dx, a.dy * b.v + a.v * b.dy, a.dz * b.v + a.v * b.dz),
  div: (a, b) => {
    const q = a.v / b.v, inv = 1 / b.v;
    return new Dual(q, (a.dx - q * b.dx) * inv, (a.dy - q * b.dy) * inv, (a.dz - q * b.dz) * inv);
  },
  neg: dualNeg,
  sq: a => dualChain(a, a.v * a.v, 2 * a.v),
  sqrt: a => {
    const s = Math.sqrt(a.v);
    return dualChain(a, s, s > 0 ? 0.5 / s : 0);
  },
  abs: a => (a.v < 0 ? dualNeg(a) : a),
  min: (a, b) => (b.v < a.v ? b : a),
  max: (a, b) => (b.v > a.v ? b : a),
  floor: a => new Dual(Math.floor(a.v), 0, 0, 0),
  sin: a => dualChain(a, Math.sin(a.v), Math.cos(a.v)),
  cos: a => dualChain(a, Math.cos(a.v), -Math.sin(a.v)),
  exp: a => { const e = Math.exp(a.v); return dualChain(a, e, e); },
  pow: (a, b) => {
    const v = Math.pow(a.v, b.v);
    const da = a.v !== 0 ? b.v * Math.pow(a.v, b.v - 1) : 0;
    const db = a.v > 0 ? v * Math.log(a.v) : 0;
    return new Dual(v, da * a.dx + db * b.dx, da * a.dy + db * b.dy, da * a.dz + db * b.dz);
  },
  value: a => a.v,
};
