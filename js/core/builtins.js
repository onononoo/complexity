"use strict";
/* builtin function table. signatures use "g" for a generic float/vec2/vec3
   that must bind to the same type everywhere it appears. `fold` is used for
   compile-time evaluation when every argument is a constant float. */

const builtins = {
  sphere:   { sigs: [[["v3", "f"], "f"]], glsl: "sdsphere", doc: "sphere(q, r)", about: "a sphere what has radius r." },
  box:      { sigs: [[["v3", "v3"], "f"], [["v3", "f"], "f"]], glsl: "sdbox", doc: "box(q, half)", about: "box, the half-extents can be a vec3 or float." },
  torus:    { sigs: [[["v3", "f", "f"], "f"]], glsl: "sdtorus", doc: "torus(q, major, minor)", about: "torus that be laying in the xz plane." },
  cylinder: { sigs: [[["v3", "f", "f"], "f"]], glsl: "sdcyl", doc: "cylinder(q, r, h)", about: "capped cylinder going along y axis." },
  plane:    { sigs: [[["v3", "f"], "f"]], glsl: "sdplane", doc: "plane(q, h)", about: "flat plane at y = −h." },
  gyroid:   { sigs: [[["v3", "f"], "f"]], glsl: "sdgyroid", doc: "gyroid(q, scale)", about: "a gyroid surface thing." },
  smin:     { sigs: [[["f", "f", "f"], "f"]], glsl: "opsmin", fold: math_lib.smin, doc: "smin(a, b, k)", about: "smooth union, k is how much it blend." },
  smax:     { sigs: [[["f", "f", "f"], "f"]], glsl: "opsmax", fold: math_lib.smax, doc: "smax(a, b, k)", about: "smooth intersection." },
  shell:    { sigs: [[["f", "f"], "f"]], glsl: "opshell", fold: math_lib.shell, doc: "shell(d, w)", about: "make's a shape hollow with w thickness." },
  rotx:     { sigs: [[["v3", "f"], "v3"]], glsl: "oprotx", doc: "rotx(q, a)", about: "rotate's a point. theres also roty and rotz to." },
  roty:     { sigs: [[["v3", "f"], "v3"]], glsl: "oproty" },
  rotz:     { sigs: [[["v3", "f"], "v3"]], glsl: "oprotz" },
  rep:      { sigs: [[["v3", "f"], "v3"]], glsl: "oprep", doc: "rep(q, s)", about: "repeat the space every s units." },
  twist:    { sigs: [[["v3", "f"], "v3"]], glsl: "optwist", doc: "twist(q, k)", about: "twist space around y axis." },
  vec3:     { sigs: [[["f"], "v3"], [["f", "f", "f"], "v3"]], glsl: "vec3", doc: "vec3(x, y, z)", about: "make's a vector. vec2(x, y) work's to." },
  vec2:     { sigs: [[["f"], "v2"], [["f", "f"], "v2"]], glsl: "vec2" },
  length:   { sigs: [[["g"], "f"]], glsl: "length", fold: Math.abs, doc: "length, dot", about: "vector length and dot product." },
  dot:      { sigs: [[["g", "g"], "f"]], glsl: "dot", fold: (a, b) => a * b },
  min:      { sigs: [[["g", "g"], "g"], [["g", "f"], "g"]], glsl: "min", fold: Math.min, doc: "min, max, clamp, mix", about: "do's each component's." },
  max:      { sigs: [[["g", "g"], "g"], [["g", "f"], "g"]], glsl: "max", fold: Math.max },
  clamp:    { sigs: [[["g", "f", "f"], "g"]], glsl: "clamp", fold: (x, a, b) => Math.min(b, Math.max(a, x)) },
  mix:      { sigs: [[["g", "g", "f"], "g"]], glsl: "mix", fold: (a, b, u) => a + (b - a) * u },
  sin:      { sigs: [[["g"], "g"]], glsl: "sin", fold: Math.sin, doc: "sin, cos, abs, sqrt, pow, exp, floor, fract", about: "math on each component." },
  cos:      { sigs: [[["g"], "g"]], glsl: "cos", fold: Math.cos },
  abs:      { sigs: [[["g"], "g"]], glsl: "abs", fold: Math.abs },
  sqrt:     { sigs: [[["g"], "g"]], glsl: "sqrt", fold: Math.sqrt },
  pow:      { sigs: [[["g", "g"], "g"]], glsl: "pow", fold: Math.pow },
  exp:      { sigs: [[["g"], "g"]], glsl: "exp", fold: Math.exp },
  floor:    { sigs: [[["g"], "g"]], glsl: "floor", fold: Math.floor },
  fract:    { sigs: [[["g"], "g"]], glsl: "fract", fold: math_lib.fract },
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
  let best = null, best_d = Math.min(3, Math.ceil(name.length / 2));
  for (const c of candidates) {
    const dd = levenshtein(name, c);
    if (dd < best_d) { best_d = dd; best = c; }
  }
  return best ? `. did you mean “${best}”?` : "";
}
