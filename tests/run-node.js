"use strict";
/* runs every tests/*.test.js file against the compiler scripts.

   usage: node tests/run-node.js [name filter] */

const fs = require("fs");
const path = require("path");
const { create_compiler_context } = require("./load");

const { context, load, run } = create_compiler_context();
load(path.join(__dirname, "harness.js"));
for (const f of fs.readdirSync(__dirname).filter(n => n.endsWith(".test.js")).sort()) {
  load(path.join(__dirname, f));
}

context.__filter = process.argv[2] || "";
const { failed } = run("run_tests(__filter)");
process.exitCode = failed ? 1 : 0;
