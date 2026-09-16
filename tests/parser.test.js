"use strict";

const parseExpr = src => parse(lex(src)).result;

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
  assertEqual(shape(parseExpr("a + b * c")), "(a + (b * c))");
});

test("parser: combinators bind looser than arithmetic, union loosest", () => {
  assertEqual(shape(parseExpr("a | b & c + d")), "(a | (b & (c + d)))");
});

test("parser: left associativity", () => {
  assertEqual(shape(parseExpr("a - b - c")), "((a - b) - c)");
});

test("parser: unary minus binds tighter than multiplication", () => {
  assertEqual(shape(parseExpr("-a * b")), "((-a) * b)");
});

test("parser: calls and swizzles chain", () => {
  assertEqual(shape(parseExpr("rep(p, 1.0).xz")), "rep(p, 1).xz");
});

test("parser: declarations", () => {
  const prog = parse(lex("fn f(a, b) = a + b\nlet x = f(1.0, 2.0)\nx"));
  assertEqual(prog.decls.length, 2);
  assertEqual(prog.decls[0].k, "fn");
  assertEqual(prog.decls[0].params.map(p => p.name).join(","), "a,b");
});

test("parser: a program needs a final expression", () => {
  assertThrows(() => parse(lex("let a = 1.0")), /needs a final line/);
});

test("parser: only the last line may be a bare expression", () => {
  assertThrows(() => parse(lex("a\nb")), /Only the last line/);
});

test("parser: missing closing parenthesis", () => {
  const e = assertThrows(() => parse(lex("sphere(p, 1.0")), /Expected/);
  assertEqual(e.stage, "parse");
});
