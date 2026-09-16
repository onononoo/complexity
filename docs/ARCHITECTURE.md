# Architecture

This document describes how a program moves through the compiler, from source text to a GPU shader and CPU bytecode.

## Script organisation

All JavaScript files are classic scripts that share one global scope. There are no modules and no build step. Each file depends only on files loaded before it, so the `<script>` order in `index.html` is significant. `tests/load.js` repeats that order for the files that do not use the DOM.

`js/app/compiler.js` contains `compileSource(src, options)`, which runs stages 1 to 9 and returns every intermediate result with timings. The page (`js/app/pipeline.js`) and the tests both call it.

## 1. Lexical analysis

`js/core/lexer.js`

The lexer produces `num`, `id`, `kw`, `op`, `sep` and `eof` tokens, each with a source position and length. It tracks parenthesis depth so that line breaks inside parentheses do not produce separators, and it collapses consecutive separators into one.

## 2. Parsing

`js/core/parser.js`

A Pratt parser. Each infix operator has a binding power (see the precedence table in `LANGUAGE.md`). Calls and component access are postfix operations that bind tighter than any infix operator. The parser produces plain objects with a `k` field (`num`, `id`, `neg`, `bin`, `call`, `mem`) and a source span for error reporting.

## 3. Type checking and elaboration

`js/passes/elaborate.js`, `js/passes/signatures.js`, `js/passes/rewrite.js`, `js/core/graph.js`

Elaboration walks the syntax tree and builds a typed expression graph in one pass. There is no separate optimisation pass; every node is simplified as it is created.

### Hash-consing

`Graph.intern(op, args, type)` looks up a key built from the operator and argument ids. If a structurally identical node already exists, it is returned instead of a new one. This removes duplicate subexpressions and makes node identity meaningful: two nodes are equal exactly when their ids are equal.

Because a node can only refer to nodes that already exist, ascending id order is always a valid topological order. Several later stages depend on this.

### Scopes and functions

Scopes are `Map`s from names to bindings. A `let` binding stores a graph node. A `fn` binding stores its declaration and a copy of the scope at the point of declaration. A call evaluates the arguments, binds them to the parameter names in a new scope derived from that copy, and elaborates the body. The body is therefore type checked separately at every call, and a function cannot refer to itself.

### Overload resolution

Builtins are listed in `js/core/builtins.js` with one or more signatures. `resolveSignature` tries each signature in order. The generic parameter `G` binds to the first argument type it meets and must match at every later occurrence.

### Rewrites

Applied while nodes are built:

| Rule | Example |
| --- | --- |
| Constant folding of operators and builtins with a `fold` function | `sqrt(4.0)` → `2.0` |
| Additive and multiplicative identities | `x + 0.0` → `x`, `x * 1.0` → `x` |
| Multiplication by zero, for floats | `x * 0.0` → `0.0` |
| Negation | `--x` → `x`, `x * -1.0` → `-x` |
| Self-subtraction, for floats | `x - x` → `0.0` |
| Division by a constant | `x / 4.0` → `x * 0.25` |
| Subtraction of a constant | `x - c` → `x + (-c)` |
| Constant reassociation | `(x * 2.0) * 3.0` → `x * 6.0` |
| Idempotent min and max | `min(x, x)` → `x` |
| Small constant powers | `pow(x, 1)` → `x`, `pow(x, 2)` → `x * x`, `pow(x, 0.5)` → `sqrt(x)` |
| Projection from a constructor | `vec3(a, b, c).y` → `b` |
| Identity swizzle | `p.xyz` → `p` |
| Canonical operand order | `b * a` and `a * b` become the same node |

## 4. Dead code analysis

`js/passes/analyze.js`

A depth-first walk from the root marks reachable nodes and counts references. Nodes created during elaboration but not reachable, such as unused `let` bindings, are dead and are ignored by every backend.

## 5. GLSL code generation

`js/backend/glsl.js`, `js/gpu/shaders.js`

An iterative post-order walk builds a GLSL expression string for each node. A node with more than one reference is written to a temporary (`float _0 = ...;`) and referred to by name. Everything else is inlined. The result is a `float map(vec3 p)` function inserted between the helper functions and the raymarcher in `shaders.js`.

## 6. Bytecode generation

`js/backend/bytecode.js`, `js/backend/kernels.js`, `js/backend/vm.js`

### Registers

Each register holds three `Float64Array` slots. Register 0 is `p` and register 1 is `t`. Each constant gets its own register, which is filled once when the VM is created and never reused.

### Instructions

Each instruction is 11 integers:

```text
[opcode, dst, dstWidth, argc, r0, w0, r1, w1, r2, w2, extra]
```

The opcode is an index into `KERNELS`. `w0` to `w2` are argument widths, which the VM uses to broadcast scalars. `extra` holds swizzle component indices, two bits each.

### Register allocation

Instructions are emitted in ascending node id order. The compiler first records the index of the last instruction that reads each value. When emitting an instruction, it releases the registers of any arguments read for the last time, then allocates the destination from the free list. The destination can therefore reuse an argument's register. The VM writes results to a scratch buffer before copying them into the destination, so that is safe.

### Kernels

Kernels come in a few kinds: componentwise with broadcasting (`cw`), vector reductions (`len`, `dot`), constructors (`ctor`), swizzles (`swz`), and shape functions that take flattened components and return a float (`flatF`) or a `vec3` (`flatV`). The shape kernels call the hand-written scalar functions in `js/core/mathlib.js`.

## 7. Bytecode verification

`js/analysis/verify.js`, `js/backend/evaluator.js`

The VM is compared with `evaluateGraph`, a generic evaluator that walks the graph directly using `RealAlgebra` and the shape functions in `js/sdf/library.js`. The two share no math code. They are evaluated at 64 pseudo-random points and times. The largest relative difference must not exceed `1e-9`, or compilation stops with a verification error.

## 8. Gradient check

`js/algebra/dual.js`, `js/analysis/gradient.js`

### Algebras

`js/sdf/library.js` writes every shape and operator once, against an interface of basic operations (`add`, `mul`, `sqrt`, `sin`, `min`, and so on). `makeSdfLibrary` is instantiated three times:

| Instance | Algebra | Element |
| --- | --- | --- |
| `SDF_REAL` | `RealAlgebra` | A number |
| `SDF_DUAL` | `DualAlgebra` | A value and its partial derivatives with respect to `p.x`, `p.y` and `p.z` |
| `SDF_INTERVAL` | `IntervalAlgebra` | A lower and upper bound |

### Check

The generic evaluator runs over dual numbers to get the analytic gradient, which is compared with central finite differences computed by the VM at 32 points. The median and maximum errors are reported. The largest gradient magnitude is also recorded; for an exact distance field it is 1, and above 1.5 the compiler warns that rendering may miss thin features.

## 9. Surface localization

`js/algebra/interval.js`, `js/analysis/octree.js`

The generic evaluator runs over intervals for a cube-shaped cell of space. If the resulting interval is entirely positive, the cell is outside the shape; if entirely negative, inside. In either case the cell cannot contain the surface and is discarded. Otherwise the cell is split into eight and the process repeats, down to depth 4 in a cube from −3 to 3. The remaining leaf cells may contain the surface and are outlined in the cross-section view.

Interval operations are conservative. `sin` and `cos` detect extrema inside the interval, `sq` handles intervals that span zero, and division by an interval containing zero returns an unbounded interval. The tests check that sampled real values always fall inside the computed bounds.

## 10. GPU shader link

`js/gpu/renderer.js`

The generated GLSL is compiled and linked with WebGL2. If linking fails, the previous program keeps running and the error is reported. Line numbers in GPU errors are adjusted to refer to the `map` function.

The fragment shader marches up to 160 steps of 85% of the returned distance, then shades hits with a single directional light. Resolution scales between 35% and 100% to keep the frame rate near 60 frames per second.

## Page features outside the pipeline

| Feature | File | Method |
| --- | --- | --- |
| Probe | `js/ui/probe.js` | Rebuilds the shader's camera ray on the CPU and marches it with the VM |
| Point evaluation | `js/ui/probe.js` | Runs the VM once at a given point |
| Cross-section | `js/ui/section.js` | Evaluates the VM on a 300 × 300 grid and draws octree leaves |
