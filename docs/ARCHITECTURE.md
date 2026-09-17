# architecture

this document describes how a program moves through the compiler, from source text to a gpu shader and cpu bytecode.

## script organisation

all javascript files are classic scripts that share one global scope. there are no modules and no build step. each file depends only on files loaded before it, so the `<script>` order in `index.html` is significant. `tests/load.js` repeats that order for the files that do not use the dom.

`js/app/compiler.js` contains `compile_source(src, options)`, which runs stages 1 to 9 and returns every intermediate result with timings. the page (`js/app/pipeline.js`) and the tests both call it.

## 1. lexical analysis

`js/core/lexer.js`

the lexer produces `num`, `id`, `kw`, `op`, `sep` and `eof` tokens, each with a source position and length. it tracks parenthesis depth so that line breaks inside parentheses do not produce separators, and it collapses consecutive separators into one.

## 2. parsing

`js/core/parser.js`

a pratt parser. each infix operator has a binding power (see the precedence table in `language.md`). calls and component access are postfix operations that bind tighter than any infix operator. the parser produces plain objects with a `k` field (`num`, `id`, `neg`, `bin`, `call`, `mem`) and a source span for error reporting.

## 3. type checking and elaboration

`js/passes/elaborate.js`, `js/passes/signatures.js`, `js/passes/rewrite.js`, `js/core/graph.js`

elaboration walks the syntax tree and builds a typed expression graph in one pass. there is no separate optimisation pass; every node is simplified as it is created.

### hash-consing

`expr_graph.intern(op, args, type)` looks up a key built from the operator and argument ids. if a structurally identical node already exists, it is returned instead of a new one. this removes duplicate subexpressions and makes node identity meaningful: two nodes are equal exactly when their ids are equal.

because a node can only refer to nodes that already exist, ascending id order is always a valid topological order. several later stages depend on this.

### scopes and functions

scopes are `map`s from names to bindings. a `let` binding stores a graph node. a `fn` binding stores its declaration and a copy of the scope at the point of declaration. a call evaluates the arguments, binds them to the parameter names in a new scope derived from that copy, and elaborates the body. the body is therefore type checked separately at every call, and a function cannot refer to itself.

### overload resolution

builtins are listed in `js/core/builtins.js` with one or more signatures. `resolve_signature` tries each signature in order. the generic parameter `g` binds to the first argument type it meets and must match at every later occurrence.

### rewrites

applied while nodes are built:

| rule | example |
| --- | --- |
| constant folding of operators and builtins with a `fold` function | `sqrt(4.0)` → `2.0` |
| additive and multiplicative identities | `x + 0.0` → `x`, `x * 1.0` → `x` |
| multiplication by zero, for floats | `x * 0.0` → `0.0` |
| negation | `--x` → `x`, `x * -1.0` → `-x` |
| self-subtraction, for floats | `x - x` → `0.0` |
| division by a constant | `x / 4.0` → `x * 0.25` |
| subtraction of a constant | `x - c` → `x + (-c)` |
| constant reassociation | `(x * 2.0) * 3.0` → `x * 6.0` |
| idempotent min and max | `min(x, x)` → `x` |
| small constant powers | `pow(x, 1)` → `x`, `pow(x, 2)` → `x * x`, `pow(x, 0.5)` → `sqrt(x)` |
| projection from a constructor | `vec3(a, b, c).y` → `b` |
| identity swizzle | `p.xyz` → `p` |
| canonical operand order | `b * a` and `a * b` become the same node |

## 4. dead code analysis

`js/passes/analyze.js`

a depth-first walk from the root marks reachable nodes and counts references. nodes created during elaboration but not reachable, such as unused `let` bindings, are dead and are ignored by every backend.

## 5. glsl code generation

`js/backend/glsl.js`, `js/gpu/shaders.js`

an iterative post-order walk builds a glsl expression string for each node. a node with more than one reference is written to a temporary (`float _0 = ...;`) and referred to by name. everything else is inlined. the result is a `float map(vec3 p)` function inserted between the helper functions and the raymarcher in `shaders.js`.

## 6. bytecode generation

`js/backend/bytecode.js`, `js/backend/kernels.js`, `js/backend/vm.js`

### registers

each register holds three `float64array` slots. register 0 is `p` and register 1 is `t`. each constant gets its own register, which is filled once when the vm is created and never reused.

### instructions

each instruction is 11 integers:

```text
[opcode, dst, dstwidth, argc, r0, w0, r1, w1, r2, w2, extra]
```

the opcode is an index into `kernels`. `w0` to `w2` are argument widths, which the vm uses to broadcast scalars. `extra` holds swizzle component indices, two bits each.

### register allocation

instructions are emitted in ascending node id order. the compiler first records the index of the last instruction that reads each value. when emitting an instruction, it releases the registers of any arguments read for the last time, then allocates the destination from the free list. the destination can therefore reuse an argument's register. the vm writes results to a scratch buffer before copying them into the destination, so that is safe.

### kernels

kernels come in a few kinds: componentwise with broadcasting (`cw`), vector reductions (`len`, `dot`), constructors (`ctor`), swizzles (`swz`), and shape functions that take flattened components and return a float (`flatf`) or a `vec3` (`flatv`). the shape kernels call the hand-written scalar functions in `js/core/mathlib.js`.

## 7. bytecode verification

`js/analysis/verify.js`, `js/backend/evaluator.js`

the vm is compared with `evaluate_graph`, a generic evaluator that walks the graph directly using `real_algebra` and the shape functions in `js/sdf/library.js`. the two share no math code. they are evaluated at 64 pseudo-random points and times. the largest relative difference must not exceed `1e-9`, or compilation stops with a verification error.

## 8. gradient check

`js/algebra/dual.js`, `js/analysis/gradient.js`

### algebras

`js/sdf/library.js` writes every shape and operator once, against an interface of basic operations (`add`, `mul`, `sqrt`, `sin`, `min`, and so on). `make_sdf_library` is instantiated three times:

| instance | algebra | element |
| --- | --- | --- |
| `sdf_real` | `real_algebra` | a number |
| `sdf_dual` | `dual_algebra` | a value and its partial derivatives with respect to `p.x`, `p.y` and `p.z` |
| `sdf_interval` | `interval_algebra` | a lower and upper bound |

### check

the generic evaluator runs over dual numbers to get the analytic gradient, which is compared with central finite differences computed by the vm at 32 points. the median and maximum errors are reported. the largest gradient magnitude is also recorded; for an exact distance field it is 1, and above 1.5 the compiler warns that rendering may miss thin features.

## 9. surface localization

`js/algebra/interval.js`, `js/analysis/octree.js`

the generic evaluator runs over intervals for a cube-shaped cell of space. if the resulting interval is entirely positive, the cell is outside the shape; if entirely negative, inside. in either case the cell cannot contain the surface and is discarded. otherwise the cell is split into eight and the process repeats, down to depth 4 in a cube from −3 to 3. the remaining leaf cells may contain the surface and are outlined in the cross-section view.

interval operations are conservative. `sin` and `cos` detect extrema inside the interval, `sq` handles intervals that span zero, and division by an interval containing zero returns an unbounded interval. the tests check that sampled real values always fall inside the computed bounds.

## 10. gpu shader link

`js/gpu/renderer.js`

the generated glsl is compiled and linked with webgl2. if linking fails, the previous program keeps running and the error is reported. line numbers in gpu errors are adjusted to refer to the `map` function.

the fragment shader marches up to 160 steps of 85% of the returned distance, then shades hits with a single directional light. resolution scales between 35% and 100% to keep the frame rate near 60 frames per second.

## page features outside the pipeline

| feature | file | method |
| --- | --- | --- |
| probe | `js/ui/probe.js` | rebuilds the shader's camera ray on the cpu and marches it with the vm |
| point evaluation | `js/ui/probe.js` | runs the vm once at a given point |
| cross-section | `js/ui/section.js` | evaluates the vm on a 300 × 300 grid and draws octree leaves |
