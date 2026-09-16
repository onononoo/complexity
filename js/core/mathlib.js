"use strict";
/* Scalar CPU mirrors of the GLSL helpers in js/gpu/shaders.js.
   Vector-valued helpers write into an `out` array instead of allocating. */

const MathLib = {
  fract: x => x - Math.floor(x),
  glRound: x => Math.floor(x + 0.5),

  smin(a, b, k) {
    const h = Math.min(1, Math.max(0, 0.5 + 0.5 * (b - a) / k));
    return b + (a - b) * h - k * h * (1 - h);
  },
  smax(a, b, k) { return -MathLib.smin(-a, -b, k); },
  shell(d, w) { return Math.abs(d) - w; },

  sdSphere(x, y, z, r) { return Math.hypot(x, y, z) - r; },
  sdBox(x, y, z, bx, by, bz) {
    const qx = Math.abs(x) - bx, qy = Math.abs(y) - by, qz = Math.abs(z) - bz;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, Math.max(qy, qz)), 0);
  },
  sdTorus(x, y, z, R, r) { return Math.hypot(Math.hypot(x, z) - R, y) - r; },
  sdCyl(x, y, z, r, h) {
    const dx = Math.hypot(x, z) - r, dy = Math.abs(y) - h;
    return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  },
  sdPlane(x, y, z, h) { return y + h; },
  sdGyroid(x, y, z, s) {
    const a = x * s, b = y * s, c = z * s;
    return (Math.sin(a) * Math.cos(b) + Math.sin(b) * Math.cos(c) + Math.sin(c) * Math.cos(a)) / s;
  },

  rotX(x, y, z, a, out) { const c = Math.cos(a), s = Math.sin(a); out[0] = x; out[1] = c * y - s * z; out[2] = s * y + c * z; },
  rotY(x, y, z, a, out) { const c = Math.cos(a), s = Math.sin(a); out[0] = c * x + s * z; out[1] = y; out[2] = -s * x + c * z; },
  rotZ(x, y, z, a, out) { const c = Math.cos(a), s = Math.sin(a); out[0] = c * x - s * y; out[1] = s * x + c * y; out[2] = z; },
  rep(x, y, z, s, out) {
    out[0] = x - s * MathLib.glRound(x / s);
    out[1] = y - s * MathLib.glRound(y / s);
    out[2] = z - s * MathLib.glRound(z / s);
  },
  twist(x, y, z, k, out) { MathLib.rotY(x, y, z, k * y, out); },
};
