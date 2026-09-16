"use strict";
/* Stage 3: AST → typed DAG. Resolves names, checks types, inlines user
   functions, folds constants and applies algebraic simplifications as each
   node is built. */

function elaborate(prog) {
  const g = new Graph();
  const warnings = [];
  const err = (msg, at) => new CompileError(msg, at.pos, at.len, "elab");
  const isC = (n, v) => n.op === "const" && (v === undefined || n.v === v);

  const globals = new Map([
    ["p", { kind: "val", node: g.intern("p", [], "v3"), builtin: true }],
    ["t", { kind: "val", node: g.intern("t", [], "f"), builtin: true }],
    ["pi", { kind: "val", node: g.num(Math.PI), builtin: true }],
  ]);

  function negate(x) {
    if (isC(x)) { g.stats.folded++; return g.num(-x.v); }
    if (x.op === "neg") { g.stats.simplified++; return g.nodes[x.args[0]]; }
    return g.intern("neg", [x.id], x.type);
  }

  function arith(op, x, y, at) {
    let type;
    if (x.type === y.type) type = x.type;
    else if (x.type === "f") type = y.type;
    else if (y.type === "f") type = x.type;
    else throw err(`Cannot apply “${op}” to ${TN[x.type]} and ${TN[y.type]}`, at);

    if (isC(x) && isC(y)) {
      const v = op === "+" ? x.v + y.v : op === "-" ? x.v - y.v : op === "*" ? x.v * y.v : x.v / y.v;
      if (Number.isFinite(v)) { g.stats.folded++; return g.num(v); }
      if (op === "/") throw err("This divides a constant by zero", at);
    }

    // canonical form: x - c  →  x + (-c)
    if (op === "-" && isC(y) && !isC(y, 0)) return arith("+", x, g.num(-y.v), at);

    const same = n => n.type === type;
    const simp = n => { g.stats.simplified++; return n; };
    switch (op) {
      case "+":
        if (isC(x, 0) && same(y)) return simp(y);
        if (isC(y, 0) && same(x)) return simp(x);
        break;
      case "-":
        if (isC(y, 0) && same(x)) return simp(x);
        if (isC(x, 0) && same(y)) return simp(negate(y));
        if (x.id === y.id && type === "f") return simp(g.num(0));
        break;
      case "*":
        if (isC(x, 1) && same(y)) return simp(y);
        if (isC(y, 1) && same(x)) return simp(x);
        if ((isC(x, 0) || isC(y, 0)) && type === "f") return simp(g.num(0));
        if (isC(x, -1) && same(y)) return simp(negate(y));
        if (isC(y, -1) && same(x)) return simp(negate(x));
        break;
      case "/":
        if (isC(y, 1) && same(x)) return simp(x);
        if (isC(y) && y.v !== 0) { g.stats.simplified++; return arith("*", x, g.num(1 / y.v), at); }
        break;
    }

    const ra = reassociate(g, op, x, y);
    if (ra) return arith(op, ra.other, ra.c, at);

    const ids = [x.id, y.id];
    if (op === "+" || op === "*") ids.sort((a, b) => a - b);
    return g.intern(op, ids, type);
  }

  function builtin(name, args, at) {
    const spec = B[name];
    const ret = resolveSignature(spec, args.map(a => a.type));
    if (!ret) {
      throw err(`${name}() does not accept (${args.map(a => TN[a.type]).join(", ")}). Expected ${describeSignatures(name, spec)}`, at);
    }
    if (spec.fold && ret === "f" && args.every(a => isC(a))) {
      const v = spec.fold(...args.map(a => a.v));
      if (Number.isFinite(v)) { g.stats.folded++; return g.num(v); }
    }
    if ((name === "min" || name === "max") && args[0].id === args[1].id) { g.stats.simplified++; return args[0]; }
    if (name === "pow" && isC(args[1])) {
      if (args[1].v === 1) { g.stats.simplified++; return args[0]; }
      if (args[1].v === 2) { g.stats.simplified++; return arith("*", args[0], args[0], at); }
      if (args[1].v === 0.5) { g.stats.simplified++; return builtin("sqrt", [args[0]], at); }
    }
    return g.intern("call:" + name, args.map(a => a.id), ret);
  }

  function member(at, obj) {
    const f = at.field;
    if (!/^[xyz]{1,3}$/.test(f)) throw err(`“.${f}” is not a component. Use up to three of x, y, z`, at);
    const dims = WIDTH[obj.type];
    if (dims === 1) throw err(`A float has no components, so “.${f}” needs a vec2 or vec3`, at);
    if (dims === 2 && f.includes("z")) throw err("A vec2 has no z component", at);
    if (f === "xyz".slice(0, dims)) { g.stats.simplified++; return obj; }
    if (f.length === 1 && obj.op === "call:vec" + dims && obj.args.length === dims) {
      g.stats.simplified++;
      return g.nodes[obj.args["xyz".indexOf(f)]];
    }
    return g.intern("." + f, [obj.id], ["f", "v2", "v3"][f.length - 1]);
  }

  function ev(a, scope) {
    switch (a.k) {
      case "num": return g.num(a.v);
      case "id": {
        const b = scope.get(a.name);
        if (b && b.kind === "val") { b.used = true; return b.node; }
        if (b || B[a.name]) throw err(`“${a.name}” is a function. Call it with parentheses`, a);
        throw err(`Unknown name “${a.name}”` + suggest(a.name, [...scope.keys()]), a);
      }
      case "neg": return negate(ev(a.a, scope));
      case "mem": return member(a, ev(a.obj, scope));
      case "bin": {
        const x = ev(a.a, scope), y = ev(a.b, scope);
        if (a.op === "|" || a.op === "&" || a.op === "~") {
          if (x.type !== "f" || y.type !== "f") throw err(`“${a.op}” combines two distances (floats), but got ${TN[x.type]} and ${TN[y.type]}`, a);
          return builtin(a.op === "|" ? "min" : "max", [x, a.op === "~" ? negate(y) : y], a);
        }
        return arith(a.op, x, y, a);
      }
      case "call": {
        const b = scope.get(a.name);
        if (b && b.kind === "val") throw err(`“${a.name}” is a value, not a function`, a);
        const args = a.args.map(x => ev(x, scope));
        if (b && b.kind === "fn") {
          b.used = true;
          const ps = b.decl.params;
          if (ps.length !== args.length) throw err(`${a.name}() takes ${ps.length} argument${ps.length === 1 ? "" : "s"}, got ${args.length}`, a);
          const inner = new Map(b.scope);
          ps.forEach((pp, i) => inner.set(pp.name, { kind: "val", node: args[i], used: true }));
          g.stats.inlined++;
          return ev(b.decl.body, inner);
        }
        if (B[a.name]) return builtin(a.name, args, a);
        const fnNames = [...scope].filter(([, v]) => v.kind === "fn").map(([n]) => n);
        throw err(`Unknown function “${a.name}”` + suggest(a.name, [...Object.keys(B), ...fnNames]), a);
      }
    }
    throw err("Unrecognised syntax", a);
  }

  const scope = new Map(globals);
  const declared = [];
  for (const d of prog.decls) {
    const prev = scope.get(d.name);
    if (prev) throw err(prev.builtin ? `“${d.name}” is built in and cannot be redefined` : `“${d.name}” is already defined above`, d);
    if (d.k === "let") {
      const binding = { kind: "val", node: ev(d.body, scope), decl: d };
      scope.set(d.name, binding);
      declared.push(binding);
    } else {
      const seen = new Set();
      for (const pp of d.params) {
        if (seen.has(pp.name)) throw err(`Parameter “${pp.name}” appears twice`, pp);
        seen.add(pp.name);
      }
      // Functions capture only earlier definitions, so recursion cannot occur.
      const binding = { kind: "fn", decl: d, scope: new Map(scope) };
      scope.set(d.name, binding);
      declared.push(binding);
    }
  }

  const root = ev(prog.result, scope);
  if (root.type !== "f") throw err(`The last line must be a distance (float), but it is a ${TN[root.type]}`, prog.result);
  for (const b of declared) if (!b.used) warnings.push({ msg: `“${b.decl.name}” is never used`, pos: b.decl.pos, len: b.decl.len });
  return { g, root, warnings };
}
