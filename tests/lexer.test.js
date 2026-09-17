"use strict";

test("lexer: produces typed tokens and skips comments", () => {
  const toks = lex("let a = 1.5e2 # comment\np.xz");
  assert_equal(toks.map(t => t.type).join(" "), "kw id op num sep id op id eof");
  assert_equal(toks[3].value, 150);
});

test("lexer: line breaks inside parentheses are not separators", () => {
  const toks = lex("sphere(p,\n  1.0)");
  assert(!toks.some(t => t.type === "sep"), "unexpected separator token");
});

test("lexer: consecutive blank lines collapse into one separator", () => {
  const toks = lex("a\n\n\nb");
  assert_equal(toks.filter(t => t.type === "sep").length, 1);
});

test("lexer: leading-dot numbers", () => {
  assert_equal(lex(".25")[0].value, 0.25);
});

test("lexer: reports unexpected characters with a position", () => {
  const e = assert_throws(() => lex("a $ b"), /unexpected character/);
  assert_equal(e.pos, 2);
  assert_equal(e.stage, "lex");
});
