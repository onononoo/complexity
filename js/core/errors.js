"use strict";
/* Shared error type, type names and small text helpers. */

class CompileError extends Error {
  constructor(message, pos, len, stage) {
    super(message);
    this.pos = pos;
    this.len = len;
    this.stage = stage;
  }
}

const TN = { f: "float", v2: "vec2", v3: "vec3" };
const WIDTH = { f: 1, v2: 2, v3: 3 };

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function lineCol(src, pos) {
  const before = src.slice(0, pos);
  return { line: before.split("\n").length, col: pos - before.lastIndexOf("\n") };
}
