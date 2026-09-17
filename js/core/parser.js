"use strict";
/* stage 2: tokens → ast, using a pratt (top-down operator precedence) parser. */

const infix = { "|": 10, "&": 20, "~": 20, "+": 30, "-": 30, "*": 40, "/": 40 };
const prefix_neg = 50;

function parse(toks) {
  let k = 0;
  const peek = () => toks[k];
  const next = () => toks[k++];
  const is = (type, v) => peek().type === type && (v === undefined || peek().value === v);
  const describe = t => t.type === "eof" ? "the end of the program" : t.type === "sep" ? "the end of the line" : `“${t.value}”`;
  const fail = (msg, t) => { throw new compile_error(msg, t.pos, Math.max(1, t.len), "parse"); };
  const expect = (type, v, what) => {
    if (!is(type, v)) fail(`expected ${what}, found ${describe(peek())}`, peek());
    return next();
  };

  function expr(rbp) {
    const t = next();
    let left;
    if (t.type === "num") left = { k: "num", v: t.value, pos: t.pos, len: t.len };
    else if (t.type === "id") left = { k: "id", name: t.value, pos: t.pos, len: t.len };
    else if (t.type === "op" && t.value === "(") { left = expr(0); expect("op", ")", "“)” to close the group"); }
    else if (t.type === "op" && t.value === "-") left = { k: "neg", a: expr(prefix_neg), pos: t.pos, len: 1 };
    else if (t.type === "kw") fail(`“${t.value}” starts a declaration and cannot appear inside an expression`, t);
    else fail(`expected a value, found ${describe(t)}`, t);

    for (;;) {
      const o = peek();
      if (o.type !== "op") break;
      if (o.value === "(") {
        if (left.k !== "id") fail("only named functions can be called", o);
        next();
        const args = [];
        if (!is("op", ")")) do args.push(expr(0)); while (is("op", ",") && next());
        expect("op", ")", "“,” or “)” in the argument list");
        left = { k: "call", name: left.name, args, pos: left.pos, len: left.len };
        continue;
      }
      if (o.value === ".") {
        next();
        const f = expect("id", undefined, "a component such as .x or .xz");
        left = { k: "mem", obj: left, field: f.value, pos: f.pos, len: f.len };
        continue;
      }
      const bp = infix[o.value];
      if (bp === undefined || bp <= rbp) break;
      next();
      left = { k: "bin", op: o.value, a: left, b: expr(bp), pos: o.pos, len: 1 };
    }
    return left;
  }

  const decls = [];
  let result = null;
  const skip_seps = () => { while (is("sep")) next(); };
  skip_seps();
  while (!is("eof")) {
    if (result) throw new compile_error("only the last line can be a bare expression. name this one with “let”", result.pos, result.len, "parse");
    if (is("kw", "let")) {
      next();
      const name = expect("id", undefined, "a name after “let”");
      expect("op", "=", "“=” after the name");
      decls.push({ k: "let", name: name.value, pos: name.pos, len: name.len, body: expr(0) });
    } else if (is("kw", "fn")) {
      next();
      const name = expect("id", undefined, "a function name after “fn”");
      expect("op", "(", "“(” to open the parameter list");
      const params = [];
      if (!is("op", ")")) do {
        const p = expect("id", undefined, "a parameter name");
        params.push({ name: p.value, pos: p.pos, len: p.len });
      } while (is("op", ",") && next());
      expect("op", ")", "“)” to close the parameter list");
      expect("op", "=", "“=” before the function body");
      decls.push({ k: "fn", name: name.value, pos: name.pos, len: name.len, params, body: expr(0) });
    } else {
      result = expr(0);
    }
    if (!is("eof")) expect("sep", undefined, "a line break");
    skip_seps();
  }
  if (!result) {
    const eof = toks[toks.length - 1];
    throw new compile_error("the program needs a final line: the distance expression to render", eof.pos, 0, "parse");
  }
  return { decls, result };
}

function count_ast(n) {
  if (!n || typeof n !== "object") return 0;
  if (Array.isArray(n)) return n.reduce((s, x) => s + count_ast(x), 0);
  if (n.decls) return count_ast(n.decls) + count_ast(n.result);
  return 1 + count_ast(n.a) + count_ast(n.b) + count_ast(n.obj) + count_ast(n.args) + count_ast(n.body);
}
