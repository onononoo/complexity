"use strict";
/* Constant reassociation for associative operators:
     (a * c1) * c2  →  a * (c1 * c2)
     (a + c1) + c2  →  a + (c1 + c2)
   Subtraction of a constant is canonicalised to addition in elaborate.js
   before this runs, so chains like `x - 0.1 - 0.1` also collapse.
   Returns { other, c } to rebuild with, or null when no rule applies. */

function reassociate(g, op, x, y) {
  if (op !== "+" && op !== "*") return null;
  const isConst = n => n.op === "const";
  if (isConst(x) && !isConst(y)) [x, y] = [y, x];
  if (!isConst(y) || x.op !== op) return null;

  const l = g.nodes[x.args[0]], r = g.nodes[x.args[1]];
  const c = isConst(l) ? l : isConst(r) ? r : null;
  if (!c) return null;
  const other = c === l ? r : l;

  const v = op === "+" ? c.v + y.v : c.v * y.v;
  if (!Number.isFinite(v)) return null;
  g.stats.reassociated++;
  return { other, c: g.num(v) };
}
