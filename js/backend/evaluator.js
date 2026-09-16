"use strict";
/* Generic DAG evaluator. Walks reachable nodes in ascending id order (a
   topological order) using any algebra: RealAlgebra for a reference value,
   DualAlgebra for gradients, IntervalAlgebra for bounds. */

const GENERIC_ARITH = { "+": "add", "-": "sub", "*": "mul", "/": "div" };

function evaluateGraph(g, root, info, A, L, p, t) {
  const vals = new Array(root.id + 1);
  for (let id = 0; id <= root.id; id++) {
    if (!info.seen[id]) continue;
    const n = g.nodes[id];
    const a = n.args.map(c => vals[c]);
    let v;
    if (n.op === "const") v = [A.c(n.v)];
    else if (n.op === "p") v = p;
    else if (n.op === "t") v = [t];
    else if (n.op === "neg") v = a[0].map(A.neg);
    else if (GENERIC_ARITH[n.op]) v = broadcast(A[GENERIC_ARITH[n.op]], a[0], a[1]);
    else if (n.op[0] === ".") v = Array.from(n.op.slice(1), ch => a[0]["xyz".indexOf(ch)]);
    else {
      const call = GENERIC_CALLS[n.op.slice(5)];
      if (!call) throw new Error(`No generic implementation for “${n.op}”`);
      v = call(A, L, a);
    }
    vals[id] = v;
  }
  return vals[root.id][0];
}
