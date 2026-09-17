"use strict";
/* cpu kernels shared by the bytecode vm and the reference interpreter.
   a kernel's index in kernels is its opcode. kernel kinds:
     cw     componentwise, scalar arguments broadcast
     len    vector length of argument 0
     dot    dot product of arguments 0 and 1
     ctor   vec2/vec3 constructor (one scalar broadcasts)
     swz    swizzle; component indices are packed 2 bits each into `extra`
     flatf  all argument components flattened, scalar result
     flatv  all argument components flattened, vec3 result */

const kernels = [];
const kernel_by_name = new Map();

function def_kernel(name, spec) {
  spec.name = name;
  spec.code = kernels.length;
  kernels.push(spec);
  kernel_by_name.set(name, spec);
}
const cw = (arity, fn) => ({ kind: "cw", arity, fn });

def_kernel("add", cw(2, (a, b) => a + b));
def_kernel("sub", cw(2, (a, b) => a - b));
def_kernel("mul", cw(2, (a, b) => a * b));
def_kernel("div", cw(2, (a, b) => a / b));
def_kernel("neg", cw(1, a => -a));
def_kernel("sin", cw(1, Math.sin));
def_kernel("cos", cw(1, Math.cos));
def_kernel("abs", cw(1, Math.abs));
def_kernel("sqrt", cw(1, Math.sqrt));
def_kernel("exp", cw(1, Math.exp));
def_kernel("floor", cw(1, Math.floor));
def_kernel("fract", cw(1, math_lib.fract));
def_kernel("min", cw(2, Math.min));
def_kernel("max", cw(2, Math.max));
def_kernel("pow", cw(2, Math.pow));
def_kernel("clamp", cw(3, (x, a, b) => Math.min(b, Math.max(a, x))));
def_kernel("mix", cw(3, (a, b, u) => a + (b - a) * u));
def_kernel("length", { kind: "len" });
def_kernel("dot", { kind: "dot" });
def_kernel("vec2", { kind: "ctor" });
def_kernel("vec3", { kind: "ctor" });
def_kernel("swizzle", { kind: "swz" });
def_kernel("sphere", { kind: "flatf", fn: f => math_lib.sd_sphere(f[0], f[1], f[2], f[3]) });
def_kernel("box", { kind: "flatf", fn: (f, n) => n === 4 ? math_lib.sd_box(f[0], f[1], f[2], f[3], f[3], f[3]) : math_lib.sd_box(f[0], f[1], f[2], f[3], f[4], f[5]) });
def_kernel("torus", { kind: "flatf", fn: f => math_lib.sd_torus(f[0], f[1], f[2], f[3], f[4]) });
def_kernel("cylinder", { kind: "flatf", fn: f => math_lib.sd_cyl(f[0], f[1], f[2], f[3], f[4]) });
def_kernel("plane", { kind: "flatf", fn: f => math_lib.sd_plane(f[0], f[1], f[2], f[3]) });
def_kernel("gyroid", { kind: "flatf", fn: f => math_lib.sd_gyroid(f[0], f[1], f[2], f[3]) });
def_kernel("smin", { kind: "flatf", fn: f => math_lib.smin(f[0], f[1], f[2]) });
def_kernel("smax", { kind: "flatf", fn: f => math_lib.smax(f[0], f[1], f[2]) });
def_kernel("shell", { kind: "flatf", fn: f => math_lib.shell(f[0], f[1]) });
def_kernel("rotx", { kind: "flatv", fn: (f, out) => math_lib.rot_x(f[0], f[1], f[2], f[3], out) });
def_kernel("roty", { kind: "flatv", fn: (f, out) => math_lib.rot_y(f[0], f[1], f[2], f[3], out) });
def_kernel("rotz", { kind: "flatv", fn: (f, out) => math_lib.rot_z(f[0], f[1], f[2], f[3], out) });
def_kernel("rep", { kind: "flatv", fn: (f, out) => math_lib.rep(f[0], f[1], f[2], f[3], out) });
def_kernel("twist", { kind: "flatv", fn: (f, out) => math_lib.twist(f[0], f[1], f[2], f[3], out) });

const arith_kernel = { "+": "add", "-": "sub", "*": "mul", "/": "div", neg: "neg" };

function kernel_for(n) {
  if (arith_kernel[n.op]) return kernel_by_name.get(arith_kernel[n.op]);
  if (n.op[0] === ".") return kernel_by_name.get("swizzle");
  if (n.op.startsWith("call:")) return kernel_by_name.get(n.op.slice(5)) || null;
  return null;
}

function pack_swizzle(op) {
  let packed = 0;
  for (let k = 1; k < op.length; k++) packed |= "xyz".indexOf(op[k]) << (2 * (k - 1));
  return packed;
}

const kernel_flat = new Float64Array(12);

/* read(i, k) returns component k of argument i (scalars broadcast).
   results go to `out` and are copied by the caller, so destinations may
   alias arguments. */
function apply_kernel(kern, dw, argc, read, widths, extra, out) {
  switch (kern.kind) {
    case "cw":
      for (let k = 0; k < dw; k++) {
        out[k] = kern.arity === 1 ? kern.fn(read(0, k))
          : kern.arity === 2 ? kern.fn(read(0, k), read(1, k))
          : kern.fn(read(0, k), read(1, k), read(2, k));
      }
      return;
    case "len": {
      let s = 0;
      for (let k = 0; k < widths[0]; k++) { const v = read(0, k); s += v * v; }
      out[0] = Math.sqrt(s);
      return;
    }
    case "dot": {
      let s = 0;
      for (let k = 0; k < widths[0]; k++) s += read(0, k) * read(1, k);
      out[0] = s;
      return;
    }
    case "ctor":
      for (let k = 0; k < dw; k++) out[k] = argc === 1 ? read(0, 0) : read(k, 0);
      return;
    case "swz":
      for (let k = 0; k < dw; k++) out[k] = read(0, (extra >> (2 * k)) & 3);
      return;
    case "flatf":
    case "flatv": {
      let n = 0;
      for (let i = 0; i < argc; i++) for (let k = 0; k < widths[i]; k++) kernel_flat[n++] = read(i, k);
      if (kern.kind === "flatf") out[0] = kern.fn(kernel_flat, n);
      else kern.fn(kernel_flat, out);
      return;
    }
  }
  throw new Error("unknown kernel kind " + kern.kind);
}
