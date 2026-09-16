"use strict";
/* Runs every tests/*.test.js file against the compiler scripts.

   Usage: node tests/run-node.js [name filter] */

const fs = require("fs");
const path = require("path");
const { createCompilerContext } = require("./load");

const { context, load, run } = createCompilerContext();
load(path.join(__dirname, "harness.js"));
for (const f of fs.readdirSync(__dirname).filter(n => n.endsWith(".test.js")).sort()) {
  load(path.join(__dirname, f));
}

context.__filter = process.argv[2] || "";
const { failed } = run("runTests(__filter)");
process.exitCode = failed ? 1 : 0;
