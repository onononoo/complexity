"use strict";
/* compares analytic gradients from dualalgebra with central finite
   differences from the vm, and records the largest gradient magnitude.
   a true distance field has gradient magnitude 1; values well above 1 mean
   the raymarcher can step past thin features. */

const gradient_step = 1e-5;

function check_gradient(g, root, info, prog, samples) {
  const rnd = mulberry32(0x5eed);
  const vm = new bytecode_vm(prog);
  const h = gradient_step;
  const errors = [];
  let max_norm = 0;
  for (let i = 0; i < samples; i++) {
    const [x, y, z] = sample_point(rnd, 2);
    const t = rnd() * 10;
    const d = evaluate_graph(g, root, info, dual_algebra, sdf_dual,
      [new dual(x, 1, 0, 0), new dual(y, 0, 1, 0), new dual(z, 0, 0, 1)], new dual(t, 0, 0, 0));
    const fd = [
      (vm.run(x + h, y, z, t) - vm.run(x - h, y, z, t)) / (2 * h),
      (vm.run(x, y + h, z, t) - vm.run(x, y - h, z, t)) / (2 * h),
      (vm.run(x, y, z + h, t) - vm.run(x, y, z - h, t)) / (2 * h),
    ];
    if (![d.dx, d.dy, d.dz, ...fd].every(Number.isFinite)) continue;
    errors.push(Math.hypot(d.dx - fd[0], d.dy - fd[1], d.dz - fd[2]));
    max_norm = Math.max(max_norm, Math.hypot(d.dx, d.dy, d.dz));
  }
  errors.sort((a, b) => a - b);
  return {
    samples: errors.length,
    median: errors.length ? errors[errors.length >> 1] : 0,
    max: errors.length ? errors[errors.length - 1] : 0,
    max_norm,
  };
}
