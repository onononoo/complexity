"use strict";

const parse_expr = src => parse(lex(src)).result;

function shape(n) {
  switch (n.k) {
    case "num": return String(n.v);
    case "id": return n.name;
    case "neg": return `(-${shape(n.a)})`;
    case "bin": return `(${shape(n.a)} ${n.op} ${shape(n.b)})`;
    case "call": return `${n.name}(${n.args.map(shape).join(", ")})`;
    case "mem": return `${shape(n.obj)}.${n.field}`;
  }
  return "?";
}

test("parser: arithmetic precedence", () => {
  assert_equal(shape(parse_expr("a + b * c")), "(a + (b * c))");
});

test("parser: combinators bind looser than arithmetic, union loosest", () => {
  assert_equal(shape(parse_expr("a | b & c + d")), "(a | (b & (c + d)))");
});

test("parser: left associativity", () => {
  assert_equal(shape(parse_expr("a - b - c")), "((a - b) - c)");
});

test("parser: unary minus binds tighter than multiplication", () => {
  assert_equal(shape(parse_expr("-a * b")), "((-a) * b)");
});

test("parser: calls and swizzles chain", () => {
  assert_equal(shape(parse_expr("rep(p, 1.0).xz")), "rep(p, 1).xz");
});

test("parser: declarations", () => {
  const prog = parse(lex("fn f(a, b) = a + b\nlet x = f(1.0, 2.0)\nx"));
  assert_equal(prog.decls.length, 2);
  assert_equal(prog.decls[0].k, "fn");
  assert_equal(prog.decls[0].params.map(p => p.name).join(","), "a,b");
});

test("parser: a program needs a final expression", () => {
  assert_throws(() => parse(lex("let a = 1.0")), /needs a final line/);
});

test("parser: only the last line may be a bare expression", () => {
  assert_throws(() => parse(lex("a\nb")), /only the last line/);
});

test("parser: missing closing parenthesis", () => {
  const e = assert_throws(() => parse(lex("sphere(p, 1.0")), /expected/);
  assert_equal(e.stage, "parse");
});
