"use strict";
/* forward-mode automatic differentiation. a dual carries a value and its
   partial derivatives with respect to p.x, p.y and p.z. */

class dual {
  constructor(v, dx, dy, dz) {
    this.v = v;
    this.dx = dx;
    this.dy = dy;
    this.dz = dz;
  }
}

function dual_chain(a, value, derivative) {
  return new dual(value, derivative * a.dx, derivative * a.dy, derivative * a.dz);
}

function dual_neg(a) {
  return new dual(-a.v, -a.dx, -a.dy, -a.dz);
}

const dual_algebra = {
  name: "dual",
  c: v => new dual(v, 0, 0, 0),
  add: (a, b) => new dual(a.v + b.v, a.dx + b.dx, a.dy + b.dy, a.dz + b.dz),
  sub: (a, b) => new dual(a.v - b.v, a.dx - b.dx, a.dy - b.dy, a.dz - b.dz),
  mul: (a, b) => new dual(a.v * b.v, a.dx * b.v + a.v * b.dx, a.dy * b.v + a.v * b.dy, a.dz * b.v + a.v * b.dz),
  div: (a, b) => {
    const q = a.v / b.v, inv = 1 / b.v;
    return new dual(q, (a.dx - q * b.dx) * inv, (a.dy - q * b.dy) * inv, (a.dz - q * b.dz) * inv);
  },
  neg: dual_neg,
  sq: a => dual_chain(a, a.v * a.v, 2 * a.v),
  sqrt: a => {
    const s = Math.sqrt(a.v);
    return dual_chain(a, s, s > 0 ? 0.5 / s : 0);
  },
  abs: a => (a.v < 0 ? dual_neg(a) : a),
  min: (a, b) => (b.v < a.v ? b : a),
  max: (a, b) => (b.v > a.v ? b : a),
  floor: a => new dual(Math.floor(a.v), 0, 0, 0),
  sin: a => dual_chain(a, Math.sin(a.v), Math.cos(a.v)),
  cos: a => dual_chain(a, Math.cos(a.v), -Math.sin(a.v)),
  exp: a => { const e = Math.exp(a.v); return dual_chain(a, e, e); },
  pow: (a, b) => {
    const v = Math.pow(a.v, b.v);
    const da = a.v !== 0 ? b.v * Math.pow(a.v, b.v - 1) : 0;
    const db = a.v > 0 ? v * Math.log(a.v) : 0;
    return new dual(v, da * a.dx + db * b.dx, da * a.dy + db * b.dy, da * a.dz + db * b.dz);
  },
  value: a => a.v,
};
