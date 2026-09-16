"use strict";
/* Stage 4: reachability from the root and reference counts.
   Unreachable nodes are dead and are skipped by every backend. */

function analyze(g, root) {
  const refs = new Uint32Array(g.nodes.length);
  const seen = new Uint8Array(g.nodes.length);
  const stack = [root.id];
  seen[root.id] = 1;
  let reachable = 1;
  while (stack.length) {
    const n = g.nodes[stack.pop()];
    for (const c of n.args) {
      refs[c]++;
      if (!seen[c]) { seen[c] = 1; reachable++; stack.push(c); }
    }
  }
  return { refs, seen, reachable, dead: g.nodes.length - reachable };
}
