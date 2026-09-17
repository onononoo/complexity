# complexity!!1!!!1111!1!

this is a compiler for a small language what describe 3d shapes as signed distance fields. it all run in the browser. programs gets compiled into a glsl shader for the gpu and into register bytecode for a javascript virtual machine, the bytecode also get saved in a binary format, and it make a triangle mesh to. the compiler check its own output using a reference evaluator, automatic differentiation and interval arithmetic.

no build step. no dependencies neither.

## tabbel of contents

- [quick start](#quick-start)
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

open `index.html` in a browser.

opening the file direct works because the page use classic scripts. if ur browser block local files, run the server thats in `.root`:

```bash
node .root/serve.js
```

then go to <http://localhost:8123/>. u can give it a other port like `node .root/serve.js 9000`.

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

`p` is the point that gets sampled and `t` is time in second. last line is the distance that get rendered. `|` is union, `&` is intersection and `~` is subtraction. the hole language is in [docs/language.md](docs/language.md).

## features!

- lexer and pratt parser, errors tells u the line and column and if u spell a name wrong it suggest one.
- static types (`float`, `vec2`, `vec3`) with generic builtin signatures.
- user functions, they gets inlined wherever there called.
- hash-consed expression graph so duplicate subexpressions goes away.
- constant folding, algebraic simplifying and constant reassociation.
- dead code detection and warnings for stuff u defined but never used.
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

stage 1 thru 13 is in `js/app/compiler.js` and dont use the dom. stage 14 only happen on the page. more detail is in [docs/architecture.md](docs/architecture.md).

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

all the scripts share one global scope so the order of `<script>` tags in `index.html` matter. `tests/load.js` got the same order for node.

## the .root folder

`.root` is where the local tooling live.

- `.root/serve.js` is a small static server with no dependencies. it serve the project folder no matter where u run it from, it send `no-store` so edits show up on reload, and it wont serve anything inside `.root` or `.git` or outside the project.
- `.root/launch.json` tell editors and tools how to start that server (`node .root/serve.js 8123`).

## tests

u need [node.js](https://nodejs.org/) 18 or newer for tests. they cover every stage except gpu linking.

```bash
node tests/run-node.js
```

to only run the tests with some text in there name:

```bash
node tests/run-node.js serialize
```

to print how long every stage take for each example:

```bash
node tests/bench-node.js
```

## browser support

the renderer need webgl2. without it the page still compile stuff, and the probe, cross-section, mesh and binary still works. its made for current chrome, edge, firefox and safari.

## more documentation

- [docs/language.md](docs/language.md): grammar, types, operators and builtins.
- [docs/architecture.md](docs/architecture.md): how each stage work.

## license

it is released under the [mit license](https://github.com/onononoo/complexity?tab=MIT-1-ov-file).

## support

this project is open source, so please donate to support me, my wife, and my projects :) ! btc: bc1qs4z04ltddh6vaqd4stu3p4vekv253ht4cwqma4

my other projects: https://github.com/onononoo/
