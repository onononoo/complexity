"use strict";
/* time hoisting. a subexpression that depends on t but not on p has the
   same value for every pixel of a frame, so evaluating it once per pixel on
   the gpu is wasted work. this pass finds the largest such subexpressions
   that feed into p-dependent code, compiles each one to its own bytecode
   program, and gives it a slot in a uniform array. the renderer runs those
   programs on the cpu once per frame and uploads the results. */

const hoist_limit = 16;
const hoist_arrays = { f: "u_hf", v2: "u_hv2", v3: "u_hv3" };

function hoist_time_invariants(g, root, info) {
  const depends_on_p = new Uint8Array(g.nodes.length);
  const depends_on_t = new Uint8Array(g.nodes.length);
  for (let id = 0; id <= root.id; id++) {
    if (!info.seen[id]) continue;
    const n = g.nodes[id];
    if (n.op === "p") depends_on_p[id] = 1;
    if (n.op === "t") depends_on_t[id] = 1;
    for (const c of n.args) {
      depends_on_p[id] |= depends_on_p[c];
      depends_on_t[id] |= depends_on_t[c];
    }
  }

  const counts = { f: 0, v2: 0, v3: 0 };
  const slots = new Map();
  let skipped = 0;

  const consider = id => {
    if (slots.has(id)) return;
    const n = g.nodes[id];
    // leaves are already cheap, and constant-only values were folded or are free on the gpu.
    if (!n.args.length || depends_on_p[id] || !depends_on_t[id]) return;
    if (counts[n.type] >= hoist_limit) { skipped++; return; }
    const index = counts[n.type]++;
    slots.set(id, {
      id,
      type: n.type,
      index,
      glsl: `${hoist_arrays[n.type]}[${index}]`,
      program: compile_bytecode(g, n, analyze(g, n)),
    });
  };

  // ascending ids visit children before parents, so slot order is stable.
  for (let id = 0; id <= root.id; id++) {
    if (!info.seen[id] || !depends_on_p[id]) continue;
    for (const c of g.nodes[id].args) consider(c);
  }
  if (!depends_on_p[root.id]) consider(root.id);

  return { slots, counts, skipped, depends_on_p, depends_on_t };
}

/* declarations for the generated shader, in a fixed order. */
function hoist_uniform_declarations(hoist) {
  const glsl_types = { f: "float", v2: "vec2", v3: "vec3" };
  return Object.entries(hoist_arrays)
    .filter(([type]) => hoist.counts[type] > 0)
    .map(([type, name]) => `uniform ${glsl_types[type]} ${name}[${hoist.counts[type]}];`);
}
