"use strict";
/* prints per-stage compile times for each example program.

   usage: node tests/bench-node.js [repetitions] */

const { create_compiler_context } = require("./load");

const { context, run } = create_compiler_context();
context.__reps = Math.max(1, parseInt(process.argv[2], 10) || 20);

const rows = run(`
  presets.map(preset => {
    const totals = {};
    for (let i = 0; i < __reps; i++) {
      const r = compile_source(preset.src, { time: 1 });
      if (!r.ok) throw new error(preset.name + ": " + r.error.message);
      for (const s of r.stages) totals[s.name] = (totals[s.name] || 0) + s.ms;
    }
    return { name: preset.name, stages: cpu_stages.map(n => [n, totals[n] / __reps]) };
  })
`);

for (const row of rows) {
  const total = row.stages.reduce((sum, [, ms]) => sum + ms, 0);
  console.log(`${row.name}  (total ${total.toFixed(2)} ms)`);
  for (const [name, ms] of row.stages) console.log(`  ${name.padEnd(10)} ${ms.toFixed(3).padStart(9)} ms`);
}
