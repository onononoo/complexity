"use strict";
/* hash-consed expression dag. structurally identical nodes are interned
   once, which gives common subexpression elimination for free. node ids are
   assigned in creation order, so ascending id order is a topological order. */

class expr_graph {
  constructor() {
    this.nodes = [];
    this.index = new Map();
    this.stats = { folded: 0, shared: 0, simplified: 0, reassociated: 0, inlined: 0 };
  }

  intern(op, args, type, v) {
    const key = op === "const" ? "c:" + v : op + "(" + args.join(",") + ")";
    const hit = this.index.get(key);
    if (hit !== undefined) {
      if (args.length) this.stats.shared++;
      return this.nodes[hit];
    }
    const n = { id: this.nodes.length, op, args, type, v };
    this.nodes.push(n);
    this.index.set(key, n.id);
    return n;
  }

  num(v) {
    return this.intern("const", [], "f", Object.is(v, -0) ? 0 : v);
  }
}
