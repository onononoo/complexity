"use strict";
/* loads the compiler's browser scripts into one node vm context, giving
   them the same shared global scope they have in a page. */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const project_root = path.resolve(__dirname, "..");

// same order as the <script> tags in index.html. dom-dependent files
// (js/gpu/renderer.js, js/ui/*, and the rest of js/app/) are excluded.
const sources = [
  "js/core/errors.js",
  "js/core/crc32.js",
  "js/core/mathlib.js",
  "js/core/builtins.js",
  "js/core/lexer.js",
  "js/core/parser.js",
  "js/core/graph.js",
  "js/passes/signatures.js",
  "js/passes/rewrite.js",
  "js/passes/elaborate.js",
  "js/passes/analyze.js",
  "js/passes/hoist.js",
  "js/algebra/real.js",
  "js/algebra/dual.js",
  "js/algebra/interval.js",
  "js/sdf/library.js",
  "js/sdf/generic-calls.js",
  "js/backend/glsl.js",
  "js/backend/kernels.js",
  "js/backend/bytecode.js",
  "js/backend/vm.js",
  "js/backend/serialize.js",
  "js/backend/evaluator.js",
  "js/backend/hoist-runtime.js",
  "js/analysis/random.js",
  "js/analysis/verify.js",
  "js/analysis/gradient.js",
  "js/analysis/octree.js",
  "js/analysis/mesh.js",
  "js/analysis/refine.js",
  "js/app/compiler.js",
  "js/app/presets.js",
];

function create_compiler_context() {
  const context = vm.createContext({
    console,
    performance: { now: () => Number(process.hrtime.bigint()) / 1e6 },
  });
  const load = file => vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: path.relative(project_root, file) });
  for (const f of sources) load(path.join(project_root, f));
  return { context, load, run: code => vm.runInContext(code, context) };
}

module.exports = { create_compiler_context, project_root };
