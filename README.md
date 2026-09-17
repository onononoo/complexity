# complexity!!1!!!1111!1!

a compiler for a small language that describes 3d shapes as signed distance fields. it runs entirely in the browser. programs are compiled to a glsl shader for rendering on the gpu and to register bytecode for a javascript virtual machine. the compiler also checks its own output with a reference evaluator, automatic differentiation and interval arithmetic.

there is no build step and there are no dependencies.

## tabbel of contents

- [quick start](#quick-start)
- [example program](#example-program)
- [features](#features)
- [compiler stages](#compiler-stages)
- [project layout](#project-layout)
- [tests](#tests)
- [browser support](#browser-support)
- [further documentation](#further-documentation)
- [license](#license)
- [support](#support)

## quick start :: **locally**

open `index.html` in a browser.

opening the file directly works because the page uses classic scripts. if your browser blocks local files, serve the folder over http instead:

```bash
python -m http.server 8000
```

then open <http://localhost:8000/>.

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

`p` is the point being sampled and `t` is time in seconds. the last line is the distance to render. `|` is union, `&` is intersection and `~` is subtraction. the full language is described in [docs/language.md](docs/language.md).

## features!

- lexer and pratt parser with error messages that give a line, column and, for misspelled names, a suggestion.
- static types (`float`, `vec2`, `vec3`) with generic builtin signatures.
- user functions, inlined at each call site.
- hash-consed expression graph, which removes duplicate subexpressions.
- constant folding, algebraic simplification and constant reassociation.
- dead code detection and warnings for unused definitions.
- glsl code generation with shared values hoisted into temporaries.
- register bytecode with liveness-based register reuse, and a virtual machine to run it.
- verification of the bytecode against an independent reference evaluator.
- forward-mode automatic differentiation, checked against finite differences.
- interval arithmetic and an octree that finds the cells that may contain the surface.
- webgl2 raymarcher that swaps in each new shader without restarting.
- cpu ray probe, point evaluation and a 2d cross-section view.

## compiler stages!

| no. | stage | file | output |
| --- | --- | --- | --- |
| 1 | lexical analysis | `js/core/lexer.js` | tokens |
| 2 | parsing | `js/core/parser.js` | syntax tree |
| 3 | type checking and elaboration | `js/passes/elaborate.js` | typed expression graph |
| 4 | dead code analysis | `js/passes/analyze.js` | reachability and reference counts |
| 5 | glsl code generation | `js/backend/glsl.js` | glsl `map` function |
| 6 | bytecode generation | `js/backend/bytecode.js` | register bytecode |
| 7 | bytecode verification | `js/analysis/verify.js` | maximum difference from the reference evaluator |
| 8 | gradient check | `js/analysis/gradient.js` | gradient error and maximum gradient magnitude |
| 9 | surface localization | `js/analysis/octree.js` | octree cells that may contain the surface |
| 10 | gpu shader link | `js/gpu/renderer.js` | webgl2 program |

stages 1 to 9 are in `js/app/compiler.js` and do not use the dom. stage 10 runs in the page only. details are in [docs/architecture.md](docs/architecture.md).

## project layout

```text
index.html              page and script load order
css/base.css            minimal styles
js/core/                errors, math kernels, builtin table, lexer, parser, graph
js/passes/              overload resolution, rewrites, elaboration, analysis
js/algebra/             real, dual number and interval algebras
js/sdf/                 distance functions written once for every algebra
js/backend/             glsl, cpu kernels, bytecode, virtual machine, generic evaluator
js/analysis/            random sampling, verification, gradient check, octree
js/gpu/                 shader source and webgl2 renderer
js/ui/                  editor, messages, output views, probe, cross-section, camera
js/app/                 compiler driver, examples, page pipeline, render loop, startup
tests/                  node test runner, harness, benchmark and test files
docs/                   language and architecture documentation
```

the scripts share one global scope, so the order of the `<script>` tags in `index.html` matters. `tests/load.js` lists the same order for node.

## tests

the tests need [node.js](https://nodejs.org/) 18 or later. they cover every stage except the gpu link.

```bash
node tests/run-node.js
```

to run only the tests whose names contain some text:

```bash
node tests/run-node.js optimizer
```

to print the time taken by each stage for each example program:

```bash
node tests/bench-node.js
```

## browser support

the renderer needs webgl2. without it, the page still compiles programs and the probe and cross-section still work. the page has been written for current versions of chrome, edge, firefox and safari.

## further documentation

- [docs/language.md](docs/language.md): grammar, types, operators and builtins.
- [docs/architecture.md](docs/architecture.md): how each stage works.

## license

released under the [mit license](license).

## support

this project is open source, so please donate to support me, my wife, and my projects :) ! btc: bc1qs4z04ltddh6vaqd4stu3p4vekv253ht4cwqma4

my other projects: https://github.com/onononoo/
