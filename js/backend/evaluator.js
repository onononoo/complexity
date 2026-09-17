"use strict";
/* generic dag evaluator. walks reachable nodes in ascending id order (a
   topological order) using any algebra: realalgebra for a reference value,
   dualalgebra for gradients, intervalalgebra for bounds. */

const generic_arith = { "+": "add", "-": "sub", "*": "mul", "/": "div" };

function evaluate_graph(g, root, info, alg, lib, p, t) {
  const vals = new Array(root.id + 1);
  for (let id = 0; id <= root.id; id++) {
    if (!info.seen[id]) continue;
    const n = g.nodes[id];
    const a = n.args.map(c => vals[c]);
    let v;
    if (n.op === "const") v = [alg.c(n.v)];
    else if (n.op === "p") v = p;
    else if (n.op === "t") v = [t];
    else if (n.op === "neg") v = a[0].map(alg.neg);
    else if (generic_arith[n.op]) v = broadcast(alg[generic_arith[n.op]], a[0], a[1]);
    else if (n.op[0] === ".") v = Array.from(n.op.slice(1), ch => a[0]["xyz".indexOf(ch)]);
    else {
      const call = generic_calls[n.op.slice(5)];
      if (!call) throw new Error(`no generic implementation for “${n.op}”`);
      v = call(alg, lib, a);
    }
    vals[id] = v;
  }
  return vals[root.id][0];
}
