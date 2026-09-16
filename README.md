# complexity

A compiler for a small language that describes 3D shapes as signed distance fields. It runs entirely in the browser. Programs are compiled to a GLSL shader for rendering on the GPU and to register bytecode for a JavaScript virtual machine. The compiler also checks its own output with a reference evaluator, automatic differentiation and interval arithmetic.

There is no build step and there are no dependencies.

## Contents

- [Quick start](#quick-start)
- [Example program](#example-program)
- [Features](#features)
- [Compiler stages](#compiler-stages)
- [Project layout](#project-layout)
- [Tests](#tests)
- [Browser support](#browser-support)
- [Further documentation](#further-documentation)
- [License](#license)
- [Support](#support)

## Quick start

Open `index.html` in a browser.

Opening the file directly works because the page uses classic scripts. If your browser blocks local files, serve the folder over HTTP instead:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000/>.

## Example program

```text
# A shell drilled by a lattice, with a torus around it
fn hollow(q, r, w) = shell(sphere(q, r), w)

let breathe = 1.0 + 0.06 * sin(t * 1.7)
let core = hollow(p, breathe, 0.04)
let halo = torus(rotx(p, t * 0.5), 1.55, 0.09)
let lattice = box(rep(p, 0.42), 0.15)

smin(core ~ lattice, halo, 0.2) | plane(p, 1.4)
```

`p` is the point being sampled and `t` is time in seconds. The last line is the distance to render. `|` is union, `&` is intersection and `~` is subtraction. The full language is described in [docs/LANGUAGE.md](docs/LANGUAGE.md).

## Features

- Lexer and Pratt parser with error messages that give a line, column and, for misspelled names, a suggestion.
- Static types (`float`, `vec2`, `vec3`) with generic builtin signatures.
- User functions, inlined at each call site.
- Hash-consed expression graph, which removes duplicate subexpressions.
- Constant folding, algebraic simplification and constant reassociation.
- Dead code detection and warnings for unused definitions.
- GLSL code generation with shared values hoisted into temporaries.
- Register bytecode with liveness-based register reuse, and a virtual machine to run it.
- Verification of the bytecode against an independent reference evaluator.
- Forward-mode automatic differentiation, checked against finite differences.
- Interval arithmetic and an octree that finds the cells that may contain the surface.
- WebGL2 raymarcher that swaps in each new shader without restarting.
- CPU ray probe, point evaluation and a 2D cross-section view.

## Compiler stages

| No. | Stage | File | Output |
| --- | --- | --- | --- |
| 1 | Lexical analysis | `js/core/lexer.js` | Tokens |
| 2 | Parsing | `js/core/parser.js` | Syntax tree |
| 3 | Type checking and elaboration | `js/passes/elaborate.js` | Typed expression graph |
| 4 | Dead code analysis | `js/passes/analyze.js` | Reachability and reference counts |
| 5 | GLSL code generation | `js/backend/glsl.js` | GLSL `map` function |
| 6 | Bytecode generation | `js/backend/bytecode.js` | Register bytecode |
| 7 | Bytecode verification | `js/analysis/verify.js` | Maximum difference from the reference evaluator |
| 8 | Gradient check | `js/analysis/gradient.js` | Gradient error and maximum gradient magnitude |
| 9 | Surface localization | `js/analysis/octree.js` | Octree cells that may contain the surface |
| 10 | GPU shader link | `js/gpu/renderer.js` | WebGL2 program |

Stages 1 to 9 are in `js/app/compiler.js` and do not use the DOM. Stage 10 runs in the page only. Details are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Project layout

```text
index.html              Page and script load order
css/base.css            Minimal styles
js/core/                Errors, math kernels, builtin table, lexer, parser, graph
js/passes/              Overload resolution, rewrites, elaboration, analysis
js/algebra/             Real, dual number and interval algebras
js/sdf/                 Distance functions written once for every algebra
js/backend/             GLSL, CPU kernels, bytecode, virtual machine, generic evaluator
js/analysis/            Random sampling, verification, gradient check, octree
js/gpu/                 Shader source and WebGL2 renderer
js/ui/                  Editor, messages, output views, probe, cross-section, camera
js/app/                 Compiler driver, examples, page pipeline, render loop, startup
tests/                  Node test runner, harness, benchmark and test files
docs/                   Language and architecture documentation
```

The scripts share one global scope, so the order of the `<script>` tags in `index.html` matters. `tests/load.js` lists the same order for Node.

## Tests

The tests need [Node.js](https://nodejs.org/) 18 or later. They cover every stage except the GPU link.

```bash
node tests/run-node.js
```

To run only the tests whose names contain some text:

```bash
node tests/run-node.js optimizer
```

To print the time taken by each stage for each example program:

```bash
node tests/bench-node.js
```

## Browser support

The renderer needs WebGL2. Without it, the page still compiles programs and the probe and cross-section still work. The page has been written for current versions of Chrome, Edge, Firefox and Safari.

## Further documentation

- [docs/LANGUAGE.md](docs/LANGUAGE.md): grammar, types, operators and builtins.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how each stage works.

## License

Released under the [MIT License](LICENSE).

## Support

this project is open source, so please donate to support me, my wife, and my projects :) ! btc: bc1qs4z04ltddh6vaqd4stu3p4vekv253ht4cwqma4
