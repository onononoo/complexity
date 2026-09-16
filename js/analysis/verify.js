"use strict";
/* Compares the bytecode VM (hand-written kernels in mathlib.js) with the
   generic evaluator over RealAlgebra (library.js). The two share no math
   code, so agreement checks both the bytecode compiler and the kernels. */

const VERIFY_TOLERANCE = 1e-9;

function relativeDifference(a, b) {
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.isNaN(a) && Number.isNaN(b) ? 0 : Infinity;
  if (a === b) return 0;
  return Math.abs(a - b) / Math.max(1, Math.abs(a), Math.abs(b));
}

function verifyBytecode(g, root, info, prog, samples) {
  const rnd = mulberry32(0xc0ffee);
  const vm = new VM(prog);
  let max = 0, worst = null;
  for (let i = 0; i < samples; i++) {
    const [x, y, z] = samplePoint(rnd, 2);
    const t = rnd() * 10;
    const reference = evaluateGraph(g, root, info, RealAlgebra, SDF_REAL, [x, y, z], t);
    const diff = relativeDifference(reference, vm.run(x, y, z, t));
    if (diff > max) {
      max = diff;
      worst = [x, y, z, t];
    }
  }
  return { samples, max, worst, ok: max <= VERIFY_TOLERANCE };
}
