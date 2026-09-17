"use strict";
/* compares the bytecode vm (hand-written kernels in mathlib.js) with the
   generic evaluator over realalgebra (library.js). the two share no math
   code, so agreement checks both the bytecode compiler and the kernels. */

const verify_tolerance = 1e-9;

function relative_difference(a, b) {
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.isNaN(a) && Number.isNaN(b) ? 0 : Infinity;
  if (a === b) return 0;
  return Math.abs(a - b) / Math.max(1, Math.abs(a), Math.abs(b));
}

function verify_bytecode(g, root, info, prog, samples) {
  const rnd = mulberry32(0xc0ffee);
  const vm = new bytecode_vm(prog);
  let max = 0, worst = null;
  for (let i = 0; i < samples; i++) {
    const [x, y, z] = sample_point(rnd, 2);
    const t = rnd() * 10;
    const reference = evaluate_graph(g, root, info, real_algebra, sdf_real, [x, y, z], t);
    const diff = relative_difference(reference, vm.run(x, y, z, t));
    if (diff > max) {
      max = diff;
      worst = [x, y, z, t];
    }
  }
  return { samples, max, worst, ok: max <= verify_tolerance };
}
