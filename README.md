# complexity!!1!!!1111!1!

<img src="kara.jpg" alt="kara" width="96" height="96">

this here is a compiler for a small language what describe's 3d shape's as signed distance field's. it all run's in the browser. program's gets compile into a glsl shader for the gpu and in to register bytecode for a javascript virtual machine, the bytecode also get saved in a binary format to, and it make's a triangle mesh aswell. the compiler check's it's own output by using a reference evaluator, automatic differentiation and interval arithmetic.

there aint no build step. no dependencie's neither.

## tabbel of contents

- [quick start](#quick-start--locally)
- [example program](#example-program)
- [features](#features)
- [compiler stages](#compiler-stages)
- [project layout](#project-layout)
- [the .root folder](#the-root-folder)
- [tests](#tests)
- [browser support](#browser-support)
- [more documentation](#more-documentation)
- [license](#license)
- [support](#support)

## quick start :: **locally**

open up `index.html` in a browser.

opening the file direct work's cause the page use classic script's. if ur browser block's local file's, run the server what's in `.root`:

```bash
node .root/serve.js
```

then go on <http://localhost:8123/>. u can gives it a other port like `node .root/serve.js 9000`.

## example program

```text
# a shell drilled by a lattice, with a torus around it
fn hollow(q, r, w) = shell(sphere(q, r), w)

let breathe = 1.0 + 0.06 * sin(t * 1.7)
let core = hollow(p, breathe, 0.04)
let halo = torus(rotx(p, t * 0.5), 1.55, 0.09)
let lattice = box(rep(p, 0.42), 0.15)

smin(core ~ lattice, halo, 0.2) | plane(p, 1.4)
```

`p` be the point what gets sampled and `t` be time in second's. last line is the distance what get render. `|` is union, `&` is intersection and `~` is subtraction. the hole language be in [docs/language.md](docs/language.md).

## features!

- lexer and pratt parser, error's tells u the line and column and if u spells a name wrong it suggest's one.
- static types (`float`, `vec2`, `vec3`) with generic builtin signatures.
- user function's, they gets inline wherever there call.
- hash-consed expression graph so duplicate subexpressions goes away.
- constant folding, algebraic simplifying and constant reassociation.
- dead code detection and warning's for stuff u defined but never use'd.
- time hoisting, math that only use `t` get moved out the shader and done once a frame on cpu.
- glsl code generating, shared values goes in temporaries.
- register bytecode with liveness based register reuse and multiply-add fusion, plus a virtual machine for running it.
- binary bytecode format with a crc32 checksum, it get round tripped every compile and theres a hex dump.
- bytecode verifying against a reference evaluator that dont share code with it.
- forward-mode automatic differentiation, checked against finite differences.
- interval arithmetic and a octree that find cells what maybe has the surface.
- surface nets mesh extracting with euler characteristic, area, volume and obj output.
- newton's method mesh refineing that use the dual number gradients to snap vertex's onto the surface.
- webgl2 raymarcher that swap each new shader in without restarting.
- cpu ray probe, point evaluation and a 2d cross-section.

## compiler stages!

| no. | stage | file | output |
| --- | --- | --- | --- |
| 1 | lexical analysis | `js/core/lexer.js` | tokens |
| 2 | parseing | `js/core/parser.js` | syntax tree |
| 3 | type check and elaborating | `js/passes/elaborate.js` | typed expression graph |
| 4 | dead code analysis | `js/passes/analyze.js` | whats reachable and reference counts |
| 5 | time hoisting | `js/passes/hoist.js` | uniform slots and little bytecode programs |
| 6 | glsl code generating | `js/backend/glsl.js` | glsl `map` function |
| 7 | bytecode generating and fuseing | `js/backend/bytecode.js` | register bytecode |
| 8 | binary format round trip | `js/backend/serialize.js` | bytes with a crc32 |
| 9 | bytecode verifying | `js/analysis/verify.js` | biggest difference from the reference evaluator |
| 10 | gradient checking | `js/analysis/gradient.js` | gradient error and biggest gradient magnitude |
| 11 | surface localization | `js/analysis/octree.js` | octree cells that maybe has the surface |
| 12 | mesh extracting | `js/analysis/mesh.js` | triangle mesh and its numbers |
| 13 | mesh refineing | `js/analysis/refine.js` | same mesh but vertex's is on the surface |
| 14 | gpu shader linking | `js/gpu/renderer.js` | webgl2 program |

stage 1 thru 13 is at `js/app/compiler.js` and dont uses the dom. stage 14 only happen's on the page. more detail's is in [docs/architecture.md](docs/architecture.md).

## project layout

```text
index.html              the page and script load order
css/base.css            barely any styles
.root/                  local dev server and its launch config
js/core/                errors, crc32, math kernels, builtin table, lexer, parser, graph
js/passes/              overload resolution, rewrites, elaborating, analysis, hoisting
js/algebra/             real, dual number and interval algebras
js/sdf/                 distance functions wrote once for every algebra
js/backend/             glsl, cpu kernels, bytecode, vm, binary format, evaluator, hoist runtime
js/analysis/            random sampling, verify, gradient check, octree, mesh, refine
js/gpu/                 shader source and webgl2 renderer
js/ui/                  editor, messages, output views, probe, cross-section, mesh panel, camera
js/app/                 compiler driver, examples, page pipeline, render loop, startup
tests/                  node test runner, harness, benchmark and test files
docs/                   language and architecture docs
```

all the script's share one global scope so the order of `<script>` tag's in `index.html` matter's alot. `tests/load.js` got the same order for node.

## the .root folder

`.root` be where all the local tooling live's at.

- `.root/serve.js` is a small static server with no dependencies. it serve the project folder no matter where u run it from, it send `no-store` so edits show up on reload, and it wont serve anything inside `.root` or `.git` or outside the project.
- `.root/launch.json` tell editors and tools how to start that server (`node .root/serve.js 8123`).

## tests

u needs [node.js](https://nodejs.org/) 18 or more newer for test's. they cover's every stage accept gpu linking.

```bash
node tests/run-node.js
```

to only run the test's with some text in they're name:

```bash
node tests/run-node.js serialize
```

for printing how long every stage take's for each example's:

```bash
node tests/bench-node.js
```

## browser support

the renderer need's webgl2. without it the page still compile's stuff, and the probe, cross-section, mesh and binary still work's. it's made for current chrome, edge, firefox and safari's.

## more documentation

- [docs/language.md](docs/language.md): grammar, types, operators and builtins.
- [docs/architecture.md](docs/architecture.md): how each stage work.

## license

it be released under the [mit license](https://github.com/onononoo/complexity?tab=MIT-1-ov-file).

## support

this project is open source, so please donate to support me, my wife, and my projects :) ! btc: bc1qs4z04ltddh6vaqd4stu3p4vekv253ht4cwqma4

my other projects: https://github.com/onononoo/
