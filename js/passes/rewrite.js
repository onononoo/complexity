"use strict";
/* constant reassociation for associative operators:
     (a * c1) * c2  →  a * (c1 * c2)
     (a + c1) + c2  →  a + (c1 + c2)
   subtraction of a constant is canonicalised to addition in elaborate.js
   before this runs, so chains like `x - 0.1 - 0.1` also collapse.
   returns { other, c } to rebuild with, or null when no rule applies. */

function reassociate(g, op, x, y) {
  if (op !== "+" && op !== "*") return null;
  const is_const = n => n.op === "const";
  if (is_const(x) && !is_const(y)) [x, y] = [y, x];
  if (!is_const(y) || x.op !== op) return null;

  const l = g.nodes[x.args[0]], r = g.nodes[x.args[1]];
  const c = is_const(l) ? l : is_const(r) ? r : null;
  if (!c) return null;
  const other = c === l ? r : l;

  const v = op === "+" ? c.v + y.v : c.v * y.v;
  if (!Number.isFinite(v)) return null;
  g.stats.reassociated++;
  return { other, c: g.num(v) };
}
