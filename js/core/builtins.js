"use strict";
/* Builtin function table. Signatures use "G" for a generic float/vec2/vec3
   that must bind to the same type everywhere it appears. `fold` is used for
   compile-time evaluation when every argument is a constant float. */

const B = {
  sphere:   { sigs: [[["v3", "f"], "f"]], glsl: "sdSphere", doc: "sphere(q, r)", about: "Sphere of radius r." },
  box:      { sigs: [[["v3", "v3"], "f"], [["v3", "f"], "f"]], glsl: "sdBox", doc: "box(q, half)", about: "Box with half-extents given as a vec3 or float." },
  torus:    { sigs: [[["v3", "f", "f"], "f"]], glsl: "sdTorus", doc: "torus(q, R, r)", about: "Torus in the xz plane." },
  cylinder: { sigs: [[["v3", "f", "f"], "f"]], glsl: "sdCyl", doc: "cylinder(q, r, h)", about: "Capped cylinder along the y axis." },
  plane:    { sigs: [[["v3", "f"], "f"]], glsl: "sdPlane", doc: "plane(q, h)", about: "Horizontal plane at y = −h." },
  gyroid:   { sigs: [[["v3", "f"], "f"]], glsl: "sdGyroid", doc: "gyroid(q, scale)", about: "Gyroid surface." },
  smin:     { sigs: [[["f", "f", "f"], "f"]], glsl: "opSmin", fold: MathLib.smin, doc: "smin(a, b, k)", about: "Smooth union with blend radius k." },
  smax:     { sigs: [[["f", "f", "f"], "f"]], glsl: "opSmax", fold: MathLib.smax, doc: "smax(a, b, k)", about: "Smooth intersection." },
  shell:    { sigs: [[["f", "f"], "f"]], glsl: "opShell", fold: MathLib.shell, doc: "shell(d, w)", about: "Hollows a shape to thickness w." },
  rotx:     { sigs: [[["v3", "f"], "v3"]], glsl: "opRotX", doc: "rotx(q, a)", about: "Rotates a point. Also roty and rotz." },
  roty:     { sigs: [[["v3", "f"], "v3"]], glsl: "opRotY" },
  rotz:     { sigs: [[["v3", "f"], "v3"]], glsl: "opRotZ" },
  rep:      { sigs: [[["v3", "f"], "v3"]], glsl: "opRep", doc: "rep(q, s)", about: "Repeats space every s units." },
  twist:    { sigs: [[["v3", "f"], "v3"]], glsl: "opTwist", doc: "twist(q, k)", about: "Twists space around the y axis." },
  vec3:     { sigs: [[["f"], "v3"], [["f", "f", "f"], "v3"]], glsl: "vec3", doc: "vec3(x, y, z)", about: "Vector constructor. Also vec2(x, y)." },
  vec2:     { sigs: [[["f"], "v2"], [["f", "f"], "v2"]], glsl: "vec2" },
  length:   { sigs: [[["G"], "f"]], glsl: "length", fold: Math.abs, doc: "length, dot", about: "Vector length and dot product." },
  dot:      { sigs: [[["G", "G"], "f"]], glsl: "dot", fold: (a, b) => a * b },
  min:      { sigs: [[["G", "G"], "G"], [["G", "f"], "G"]], glsl: "min", fold: Math.min, doc: "min, max, clamp, mix", about: "Componentwise." },
  max:      { sigs: [[["G", "G"], "G"], [["G", "f"], "G"]], glsl: "max", fold: Math.max },
  clamp:    { sigs: [[["G", "f", "f"], "G"]], glsl: "clamp", fold: (x, a, b) => Math.min(b, Math.max(a, x)) },
  mix:      { sigs: [[["G", "G", "f"], "G"]], glsl: "mix", fold: (a, b, u) => a + (b - a) * u },
  sin:      { sigs: [[["G"], "G"]], glsl: "sin", fold: Math.sin, doc: "sin, cos, abs, sqrt, pow, exp, floor, fract", about: "Componentwise math." },
  cos:      { sigs: [[["G"], "G"]], glsl: "cos", fold: Math.cos },
  abs:      { sigs: [[["G"], "G"]], glsl: "abs", fold: Math.abs },
  sqrt:     { sigs: [[["G"], "G"]], glsl: "sqrt", fold: Math.sqrt },
  pow:      { sigs: [[["G", "G"], "G"]], glsl: "pow", fold: Math.pow },
  exp:      { sigs: [[["G"], "G"]], glsl: "exp", fold: Math.exp },
  floor:    { sigs: [[["G"], "G"]], glsl: "floor", fold: Math.floor },
  fract:    { sigs: [[["G"], "G"]], glsl: "fract", fold: MathLib.fract },
};

function levenshtein(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function suggest(name, candidates) {
  let best = null, bestD = Math.min(3, Math.ceil(name.length / 2));
  for (const c of candidates) {
    const dd = levenshtein(name, c);
    if (dd < bestD) { bestD = dd; best = c; }
  }
  return best ? `. Did you mean “${best}”?` : "";
}
