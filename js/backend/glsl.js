"use strict";
/* stage 6: dag → glsl `map` function. nodes referenced more than once are
   stored in temporaries; everything else is inlined. nodes chosen by the
   time hoisting pass are replaced by their uniform array slot. */

function glsl_literal(v) {
  let s = Number.isInteger(v) && Math.abs(v) < 1e15 ? v.toFixed(1) : String(+v.toPrecision(9));
  if (!/[.e]/i.test(s)) s += ".0";
  return v < 0 ? `(${s})` : s;
}

function balanced_outer(s) {
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") d++;
    else if (s[i] === ")") d--;
    if (d === 0 && i < s.length - 1) return false;
  }
  return true;
}

function emit_glsl(g, root, info, hoist) {
  const glsl_types = { f: "float", v2: "vec2", v3: "vec3" };
  const lines = [];
  const text = new Map();
  let temps = 0;
  // iterative post-order walk so deep programs cannot overflow the js stack.
  const stack = [[root.id, false]];
  while (stack.length) {
    const [id, expanded] = stack.pop();
    if (text.has(id)) continue;
    const n = g.nodes[id];
    const slot = hoist && hoist.slots.get(id);
    if (slot) {
      text.set(id, slot.glsl);
      continue;
    }
    if (!expanded) {
      stack.push([id, true]);
      for (let i = n.args.length - 1; i >= 0; i--) if (!text.has(n.args[i])) stack.push([n.args[i], false]);
      continue;
    }
    const a = n.args.map(c => text.get(c));
    let s;
    if (n.op === "const") s = glsl_literal(n.v);
    else if (n.op === "p" || n.op === "t") s = n.op;
    else if (n.op === "neg") s = `(-${a[0]})`;
    else if (n.op[0] === ".") s = `${a[0]}${n.op}`;
    else if (n.op.startsWith("call:")) s = `${builtins[n.op.slice(5)].glsl}(${a.join(", ")})`;
    else s = `(${a[0]} ${n.op} ${a[1]})`;
    if (n.args.length && info.refs[id] > 1) {
      const name = "_" + temps++;
      lines.push(`  ${glsl_types[n.type]} ${name} = ${s};`);
      s = name;
    }
    text.set(id, s);
  }
  let ret = text.get(root.id);
  if (ret[0] === "(" && balanced_outer(ret)) ret = ret.slice(1, -1);
  const decls = hoist ? hoist_uniform_declarations(hoist) : [];
  const body = `float map(vec3 p) {\n  float t = ut;\n${lines.length ? lines.join("\n") + "\n" : ""}  return ${ret};\n}`;
  const src = (decls.length ? decls.join("\n") + "\n" : "") + body;
  return { src, temps, hoisted: hoist ? hoist.slots.size : 0 };
}
