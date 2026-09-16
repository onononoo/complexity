"use strict";
/* Plain floating point numbers, expressed through the algebra interface
   shared with DualAlgebra and IntervalAlgebra:
     c(v) add sub mul div neg sq sqrt abs min max floor sin cos exp pow value */

const RealAlgebra = {
  name: "real",
  c: v => v,
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  mul: (a, b) => a * b,
  div: (a, b) => a / b,
  neg: a => -a,
  sq: a => a * a,
  sqrt: Math.sqrt,
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
  floor: Math.floor,
  sin: Math.sin,
  cos: Math.cos,
  exp: Math.exp,
  pow: Math.pow,
  value: a => a,
};
