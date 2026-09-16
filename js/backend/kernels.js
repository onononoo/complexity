"use strict";
/* CPU kernels shared by the bytecode VM and the reference interpreter.
   A kernel's index in KERNELS is its opcode. Kernel kinds:
     cw     componentwise, scalar arguments broadcast
     len    vector length of argument 0
     dot    dot product of arguments 0 and 1
     ctor   vec2/vec3 constructor (one scalar broadcasts)
     swz    swizzle; component indices are packed 2 bits each into `extra`
     flatF  all argument components flattened, scalar result
     flatV  all argument components flattened, vec3 result */

const KERNELS = [];
const KERNEL_BY_NAME = new Map();

function defKernel(name, spec) {
  spec.name = name;
  spec.code = KERNELS.length;
  KERNELS.push(spec);
  KERNEL_BY_NAME.set(name, spec);
}
const cw = (arity, fn) => ({ kind: "cw", arity, fn });

defKernel("add", cw(2, (a, b) => a + b));
defKernel("sub", cw(2, (a, b) => a - b));
defKernel("mul", cw(2, (a, b) => a * b));
defKernel("div", cw(2, (a, b) => a / b));
defKernel("neg", cw(1, a => -a));
defKernel("sin", cw(1, Math.sin));
defKernel("cos", cw(1, Math.cos));
defKernel("abs", cw(1, Math.abs));
defKernel("sqrt", cw(1, Math.sqrt));
defKernel("exp", cw(1, Math.exp));
defKernel("floor", cw(1, Math.floor));
defKernel("fract", cw(1, MathLib.fract));
defKernel("min", cw(2, Math.min));
defKernel("max", cw(2, Math.max));
defKernel("pow", cw(2, Math.pow));
defKernel("clamp", cw(3, (x, a, b) => Math.min(b, Math.max(a, x))));
defKernel("mix", cw(3, (a, b, u) => a + (b - a) * u));
defKernel("length", { kind: "len" });
defKernel("dot", { kind: "dot" });
defKernel("vec2", { kind: "ctor" });
defKernel("vec3", { kind: "ctor" });
defKernel("swizzle", { kind: "swz" });
defKernel("sphere", { kind: "flatF", fn: f => MathLib.sdSphere(f[0], f[1], f[2], f[3]) });
defKernel("box", { kind: "flatF", fn: (f, n) => n === 4 ? MathLib.sdBox(f[0], f[1], f[2], f[3], f[3], f[3]) : MathLib.sdBox(f[0], f[1], f[2], f[3], f[4], f[5]) });
defKernel("torus", { kind: "flatF", fn: f => MathLib.sdTorus(f[0], f[1], f[2], f[3], f[4]) });
defKernel("cylinder", { kind: "flatF", fn: f => MathLib.sdCyl(f[0], f[1], f[2], f[3], f[4]) });
defKernel("plane", { kind: "flatF", fn: f => MathLib.sdPlane(f[0], f[1], f[2], f[3]) });
defKernel("gyroid", { kind: "flatF", fn: f => MathLib.sdGyroid(f[0], f[1], f[2], f[3]) });
defKernel("smin", { kind: "flatF", fn: f => MathLib.smin(f[0], f[1], f[2]) });
defKernel("smax", { kind: "flatF", fn: f => MathLib.smax(f[0], f[1], f[2]) });
defKernel("shell", { kind: "flatF", fn: f => MathLib.shell(f[0], f[1]) });
defKernel("rotx", { kind: "flatV", fn: (f, out) => MathLib.rotX(f[0], f[1], f[2], f[3], out) });
defKernel("roty", { kind: "flatV", fn: (f, out) => MathLib.rotY(f[0], f[1], f[2], f[3], out) });
defKernel("rotz", { kind: "flatV", fn: (f, out) => MathLib.rotZ(f[0], f[1], f[2], f[3], out) });
defKernel("rep", { kind: "flatV", fn: (f, out) => MathLib.rep(f[0], f[1], f[2], f[3], out) });
defKernel("twist", { kind: "flatV", fn: (f, out) => MathLib.twist(f[0], f[1], f[2], f[3], out) });

const ARITH_KERNEL = { "+": "add", "-": "sub", "*": "mul", "/": "div", neg: "neg" };

function kernelFor(n) {
  if (ARITH_KERNEL[n.op]) return KERNEL_BY_NAME.get(ARITH_KERNEL[n.op]);
  if (n.op[0] === ".") return KERNEL_BY_NAME.get("swizzle");
  if (n.op.startsWith("call:")) return KERNEL_BY_NAME.get(n.op.slice(5)) || null;
  return null;
}

function packSwizzle(op) {
  let packed = 0;
  for (let k = 1; k < op.length; k++) packed |= "xyz".indexOf(op[k]) << (2 * (k - 1));
  return packed;
}

const KERNEL_FLAT = new Float64Array(12);

/* read(i, k) returns component k of argument i (scalars broadcast).
   Results go to `out` and are copied by the caller, so destinations may
   alias arguments. */
function applyKernel(K, dw, argc, read, widths, extra, out) {
  switch (K.kind) {
    case "cw":
      for (let k = 0; k < dw; k++) {
        out[k] = K.arity === 1 ? K.fn(read(0, k))
          : K.arity === 2 ? K.fn(read(0, k), read(1, k))
          : K.fn(read(0, k), read(1, k), read(2, k));
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
    case "flatF":
    case "flatV": {
      let n = 0;
      for (let i = 0; i < argc; i++) for (let k = 0; k < widths[i]; k++) KERNEL_FLAT[n++] = read(i, k);
      if (K.kind === "flatF") out[0] = K.fn(KERNEL_FLAT, n);
      else K.fn(KERNEL_FLAT, out);
      return;
    }
  }
  throw new Error("Unknown kernel kind " + K.kind);
}
