"use strict";
/* Loads the compiler's browser scripts into one Node VM context, giving
   them the same shared global scope they have in a page. */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");

// Same order as the <script> tags in index.html. DOM-dependent files
// (js/gpu/renderer.js, js/ui/*, and the rest of js/app/) are excluded.
const SOURCES = [
  "js/core/errors.js",
  "js/core/mathlib.js",
  "js/core/builtins.js",
  "js/core/lexer.js",
  "js/core/parser.js",
  "js/core/graph.js",
  "js/passes/signatures.js",
  "js/passes/rewrite.js",
  "js/passes/elaborate.js",
  "js/passes/analyze.js",
  "js/algebra/real.js",
  "js/algebra/dual.js",
  "js/algebra/interval.js",
  "js/sdf/library.js",
  "js/sdf/generic-calls.js",
  "js/backend/glsl.js",
  "js/backend/kernels.js",
  "js/backend/bytecode.js",
  "js/backend/vm.js",
  "js/backend/evaluator.js",
  "js/analysis/random.js",
  "js/analysis/verify.js",
  "js/analysis/gradient.js",
  "js/analysis/octree.js",
  "js/app/compiler.js",
  "js/app/presets.js",
];

function createCompilerContext() {
  const context = vm.createContext({
    console,
    performance: { now: () => Number(process.hrtime.bigint()) / 1e6 },
  });
  const load = file => vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: path.relative(ROOT, file) });
  for (const f of SOURCES) load(path.join(ROOT, f));
  return { context, load, run: code => vm.runInContext(code, context) };
}

module.exports = { createCompilerContext, ROOT };
