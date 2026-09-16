"use strict";
/* Stage 1: source text → tokens. Line breaks inside parentheses are
   whitespace, so long calls can wrap across lines. */

function lex(src) {
  const toks = [];
  let i = 0, depth = 0;
  const push = (type, value, pos, len) => toks.push({ type, value, pos, len });

  while (i < src.length) {
    const c = src[i];
    if (c === "#") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "\n" || c === ";") {
      if (depth === 0 && (toks.length === 0 || toks[toks.length - 1].type !== "sep")) push("sep", c, i, 1);
      i++;
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") { i++; continue; }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] || ""))) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i, i + 64));
      push("num", parseFloat(m[0]), i, m[0].length);
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const w = /^[A-Za-z_]\w*/.exec(src.slice(i, i + 128))[0];
      push(w === "let" || w === "fn" ? "kw" : "id", w, i, w.length);
      i += w.length;
      continue;
    }
    if ("+-*/(),.=|&~".includes(c)) {
      if (c === "(") depth++;
      if (c === ")") depth = Math.max(0, depth - 1);
      push("op", c, i, 1);
      i++;
      continue;
    }
    throw new CompileError(`Unexpected character “${c}”. Allowed operators are + - * / | & ~ ( ) , . =`, i, 1, "lex");
  }
  push("eof", "", src.length, 0);
  return toks;
}
