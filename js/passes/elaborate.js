"use strict";
/* stage 3: ast → typed dag. resolves names, checks types, inlines user
   functions, folds constants and applies algebraic simplifications as each
   node is built. */

function elaborate(prog) {
  const g = new expr_graph();
  const warnings = [];
  const err = (msg, at) => new compile_error(msg, at.pos, at.len, "elab");
  const is_c = (n, v) => n.op === "const" && (v === undefined || n.v === v);

  const globals = new Map([
    ["p", { kind: "val", node: g.intern("p", [], "v3"), builtin: true }],
    ["t", { kind: "val", node: g.intern("t", [], "f"), builtin: true }],
    ["pi", { kind: "val", node: g.num(Math.PI), builtin: true }],
  ]);

  function negate(x) {
    if (is_c(x)) { g.stats.folded++; return g.num(-x.v); }
    if (x.op === "neg") { g.stats.simplified++; return g.nodes[x.args[0]]; }
    return g.intern("neg", [x.id], x.type);
  }

  function arith(op, x, y, at) {
    let type;
    if (x.type === y.type) type = x.type;
    else if (x.type === "f") type = y.type;
    else if (y.type === "f") type = x.type;
    else throw err(`cannot apply “${op}” to ${type_names[x.type]} and ${type_names[y.type]}`, at);

    if (is_c(x) && is_c(y)) {
      const v = op === "+" ? x.v + y.v : op === "-" ? x.v - y.v : op === "*" ? x.v * y.v : x.v / y.v;
      if (Number.isFinite(v)) { g.stats.folded++; return g.num(v); }
      if (op === "/") throw err("this divides a constant by zero", at);
    }

    // canonical form: x - c  →  x + (-c)
    if (op === "-" && is_c(y) && !is_c(y, 0)) return arith("+", x, g.num(-y.v), at);

    const same = n => n.type === type;
    const simp = n => { g.stats.simplified++; return n; };
    switch (op) {
      case "+":
        if (is_c(x, 0) && same(y)) return simp(y);
        if (is_c(y, 0) && same(x)) return simp(x);
        break;
      case "-":
        if (is_c(y, 0) && same(x)) return simp(x);
        if (is_c(x, 0) && same(y)) return simp(negate(y));
        if (x.id === y.id && type === "f") return simp(g.num(0));
        break;
      case "*":
        if (is_c(x, 1) && same(y)) return simp(y);
        if (is_c(y, 1) && same(x)) return simp(x);
        if ((is_c(x, 0) || is_c(y, 0)) && type === "f") return simp(g.num(0));
        if (is_c(x, -1) && same(y)) return simp(negate(y));
        if (is_c(y, -1) && same(x)) return simp(negate(x));
        break;
      case "/":
        if (is_c(y, 1) && same(x)) return simp(x);
        if (is_c(y) && y.v !== 0) { g.stats.simplified++; return arith("*", x, g.num(1 / y.v), at); }
        break;
    }

    const ra = reassociate(g, op, x, y);
    if (ra) return arith(op, ra.other, ra.c, at);

    const ids = [x.id, y.id];
    if (op === "+" || op === "*") ids.sort((a, b) => a - b);
    return g.intern(op, ids, type);
  }

  function builtin(name, args, at) {
    const spec = builtins[name];
    const ret = resolve_signature(spec, args.map(a => a.type));
    if (!ret) {
      throw err(`${name}() does not accept (${args.map(a => type_names[a.type]).join(", ")}). expected ${describe_signatures(name, spec)}`, at);
    }
    if (spec.fold && ret === "f" && args.every(a => is_c(a))) {
      const v = spec.fold(...args.map(a => a.v));
      if (Number.isFinite(v)) { g.stats.folded++; return g.num(v); }
    }
    if ((name === "min" || name === "max") && args[0].id === args[1].id) { g.stats.simplified++; return args[0]; }
    if (name === "pow" && is_c(args[1])) {
      if (args[1].v === 1) { g.stats.simplified++; return args[0]; }
      if (args[1].v === 2) { g.stats.simplified++; return arith("*", args[0], args[0], at); }
      if (args[1].v === 0.5) { g.stats.simplified++; return builtin("sqrt", [args[0]], at); }
    }
    return g.intern("call:" + name, args.map(a => a.id), ret);
  }

  function member(at, obj) {
    const f = at.field;
    if (!/^[xyz]{1,3}$/.test(f)) throw err(`“.${f}” is not a component. use up to three of x, y, z`, at);
    const dims = type_width[obj.type];
    if (dims === 1) throw err(`a float has no components, so “.${f}” needs a vec2 or vec3`, at);
    if (dims === 2 && f.includes("z")) throw err("a vec2 has no z component", at);
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
        if (b || builtins[a.name]) throw err(`“${a.name}” is a function. call it with parentheses`, a);
        throw err(`unknown name “${a.name}”` + suggest(a.name, [...scope.keys()]), a);
      }
      case "neg": return negate(ev(a.a, scope));
      case "mem": return member(a, ev(a.obj, scope));
      case "bin": {
        const x = ev(a.a, scope), y = ev(a.b, scope);
        if (a.op === "|" || a.op === "&" || a.op === "~") {
          if (x.type !== "f" || y.type !== "f") throw err(`“${a.op}” combines two distances (floats), but got ${type_names[x.type]} and ${type_names[y.type]}`, a);
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
        if (builtins[a.name]) return builtin(a.name, args, a);
        const fn_names = [...scope].filter(([, v]) => v.kind === "fn").map(([n]) => n);
        throw err(`unknown function “${a.name}”` + suggest(a.name, [...Object.keys(builtins), ...fn_names]), a);
      }
    }
    throw err("unrecognised syntax", a);
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
        if (seen.has(pp.name)) throw err(`parameter “${pp.name}” appears twice`, pp);
        seen.add(pp.name);
      }
      // functions capture only earlier definitions, so recursion cannot occur.
      const binding = { kind: "fn", decl: d, scope: new Map(scope) };
      scope.set(d.name, binding);
      declared.push(binding);
    }
  }

  const root = ev(prog.result, scope);
  if (root.type !== "f") throw err(`the last line must be a distance (float), but it is a ${type_names[root.type]}`, prog.result);
  for (const b of declared) if (!b.used) warnings.push({ msg: `“${b.decl.name}” is never used`, pos: b.decl.pos, len: b.decl.len });
  return { g, root, warnings };
}
