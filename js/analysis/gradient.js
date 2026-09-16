"use strict";
/* Compares analytic gradients from DualAlgebra with central finite
   differences from the VM, and records the largest gradient magnitude.
   A true distance field has gradient magnitude 1; values well above 1 mean
   the raymarcher can step past thin features. */

const GRADIENT_STEP = 1e-5;

function checkGradient(g, root, info, prog, samples) {
  const rnd = mulberry32(0x5eed);
  const vm = new VM(prog);
  const h = GRADIENT_STEP;
  const errors = [];
  let maxNorm = 0;
  for (let i = 0; i < samples; i++) {
    const [x, y, z] = samplePoint(rnd, 2);
    const t = rnd() * 10;
    const d = evaluateGraph(g, root, info, DualAlgebra, SDF_DUAL,
      [new Dual(x, 1, 0, 0), new Dual(y, 0, 1, 0), new Dual(z, 0, 0, 1)], new Dual(t, 0, 0, 0));
    const fd = [
      (vm.run(x + h, y, z, t) - vm.run(x - h, y, z, t)) / (2 * h),
      (vm.run(x, y + h, z, t) - vm.run(x, y - h, z, t)) / (2 * h),
      (vm.run(x, y, z + h, t) - vm.run(x, y, z - h, t)) / (2 * h),
    ];
    if (![d.dx, d.dy, d.dz, ...fd].every(Number.isFinite)) continue;
    errors.push(Math.hypot(d.dx - fd[0], d.dy - fd[1], d.dz - fd[2]));
    maxNorm = Math.max(maxNorm, Math.hypot(d.dx, d.dy, d.dz));
  }
  errors.sort((a, b) => a - b);
  return {
    samples: errors.length,
    median: errors.length ? errors[errors.length >> 1] : 0,
    max: errors.length ? errors[errors.length - 1] : 0,
    maxNorm,
  };
}
