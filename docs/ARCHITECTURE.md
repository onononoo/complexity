# architecture

this doc explain how a program go thru the compiler, from source text to a gpu shader, cpu bytecode, a binary file and a mesh.

## how the scripts is organised

all the javascript files is classic scripts that share one global scope. there isnt modules and there isnt a build step. each file only depend on files that was loaded before it, so the `<script>` order in `index.html` matter alot. `tests/load.js` repeat that order for the files that dont touch the dom.

`js/app/compiler.js` have `compile_source(src, options)`, it run stages 1 thru 13 and give back every result in between with timings. the page (`js/app/pipeline.js`) and the tests both call it.

## 1. lexical analysis

`js/core/lexer.js`

the lexer make `num`, `id`, `kw`, `op`, `sep` and `eof` tokens, each one have a source position and a length. it keep track of parenthesis depth so line breaks inside parentheses dont make separators, and it squash separators that come after each other into one.

## 2. parsing

`js/core/parser.js`

its a pratt parser. every infix operator got a binding power (look at the precedence table in `language.md`). calls and component access is postfix and bind tighter then any infix operator. the parser output plain objects with a `k` field (`num`, `id`, `neg`, `bin`, `call`, `mem`) plus a source span for errors.

## 3. type check and elaborating

`js/passes/elaborate.js`, `js/passes/signatures.js`, `js/passes/rewrite.js`, `js/core/graph.js`

elaborating walk the syntax tree and build a typed expression graph in one go. there is no seperate optimise pass, every node get simplified when its made.

### hash-consing

`expr_graph.intern(op, args, type)` look up a key made from the operator and the argument ids. if a node that is the same already exist, that one get returned instead of a new one. this remove duplicate subexpressions and it make node identity mean something: two nodes is equal exactly when there ids is equal.

since a node can only point at nodes that already exist, going through ids from low to high is always a topological order. alot of later stages rely on that.

### scopes and functions

a scope is a map from names to bindings. a `let` binding keep a graph node. a `fn` binding keep its declaration and a copy of the scope from where it was declared. a call evaluate the arguments, bind them to the parameter names in a new scope made from that copy, and elaborate the body. so the body get type checked again at every call, and a function cant refer to itself.

### overload resolution

builtins is listed in `js/core/builtins.js` with one or more signatures. `resolve_signature` try each signature in order. the generic parameter `g` bind to the first argument type it see and have to match everywhere after.

### rewrites

these happen while nodes is being built:

| rule | example |
| --- | --- |
| constant folding for operators and builtins that got a `fold` function | `sqrt(4.0)` → `2.0` |
| adding zero and multiplying by one | `x + 0.0` → `x`, `x * 1.0` → `x` |
| multiply by zero, for floats | `x * 0.0` → `0.0` |
| negation | `--x` → `x`, `x * -1.0` → `-x` |
| subtract itself, for floats | `x - x` → `0.0` |
| divide by a constant | `x / 4.0` → `x * 0.25` |
| subtract a constant | `x - c` → `x + (-c)` |
| constant reassociation | `(x * 2.0) * 3.0` → `x * 6.0` |
| min and max of the same thing | `min(x, x)` → `x` |
| small constant powers | `pow(x, 1)` → `x`, `pow(x, 2)` → `x * x`, `pow(x, 0.5)` → `sqrt(x)` |
| taking a component out of a constructor | `vec3(a, b, c).y` → `b` |
| swizzle that does nothing | `p.xyz` → `p` |
| operand order | `b * a` and `a * b` turn into the same node |

## 4. dead code analysis

`js/passes/analyze.js`

a depth-first walk from the root mark the nodes that can be reached and count references. nodes that got made during elaborating but cant be reached, like `let` bindings nobody use, is dead and every backend ignore them.

## 5. time hoisting

`js/passes/hoist.js`, `js/backend/hoist-runtime.js`

a subexpression that depend on `t` but not on `p` is the same for every pixel in a frame, so working it out per pixel on the gpu is a waste. this pass mark which nodes depend on `p` and which depend on `t` (one pass in id order is enough, because of the topological order). then for every node that depend on `p`, any argument that depend on `t` but not `p` and isnt a leaf get a slot. only the biggest one get picked, the stuff inside it dont get its own slot.

every slot get:

- a spot in a uniform array for its type: `u_hf` for floats, `u_hv2` for vec2, `u_hv3` for vec3, up to 16 each.
- its own bytecode program, compiled with the hoisted node as the root.

the renderer make a runtime from this that run all the small programs once a frame on the cpu (only when the time changed) and put the results in `float32array` buffers, then upload them with `uniform1fv`, `uniform2fv` and `uniform3fv`.

## 6. glsl code generating

`js/backend/glsl.js`, `js/gpu/shaders.js`

an iterative post-order walk build a glsl string for each node. a node that got hoisted just become its uniform slot, like `u_hf[0]`, and the walk dont go inside it. a node with more then one reference get wrote to a temporary (`float _0 = ...;`) and used by name. everything else get inlined. the output is the uniform declarations and then a `float map(vec3 p)` function, and that get put between the helper functions and the raymarcher in `shaders.js`.

## 7. bytecode generating and fuseing

`js/backend/bytecode.js`, `js/backend/kernels.js`, `js/backend/vm.js`

### registers

each register hold three float64 slots. register 0 is `p` and register 1 is `t`. every constant get its own register, it get filled once when the vm is made and never reused.

### instructions

each instruction is 11 integers:

```text
[opcode, dst, dst_width, argc, r0, w0, r1, w1, r2, w2, extra]
```

the opcode is a index into `kernels`. `w0` to `w2` is the argument widths, the vm use them to broadcast scalars. `extra` hold swizzle component indices, two bits each one.

### register allocation

instructions come out in id order. the compiler first write down the last instruction that read each value. when it emit an instruction, it free the registers of arguments that is being read for the last time, then take the destination from the free list. so the destination can reuse a argument's register. the vm write results to a scratch buffer before copying to the destination so thats fine.

### kernels

there is a few kinds of kernels: componentwise with broadcasting (`cw`), vector reductions (`len`, `dot`), constructors (`ctor`), swizzles (`swz`), and shape functions that take flattened components and give a float (`flatf`) or a `vec3` (`flatv`). the shape kernels call the hand wrote scalar functions in `js/core/mathlib.js`.

### fusion

before instructions get emitted, every `+` node get checked. if one of its arguments is a `*` node that nothing else read (reference count 1), the `*` get absorbed and the `+` become one `muladd(a, b, c)` instruction that do `a * b + c`. the absorbed node dont get a instruction or a register. last use is worked out on the fused argument lists so register reuse still work. javascript dont have a fused multiply-add, so the answer is bit for bit the same as doing it in two instructions, the tests check that. `muladd` is the last kernel in the table so the other opcodes dont move.

## 8. binary format round trip

`js/backend/serialize.js`, `js/core/crc32.js`

the bytecode get wrote to bytes, all little endian:

| field | size |
| --- | --- |
| magic `cxbc` | 4 bytes |
| version, stride | u16 each |
| regs, root, root width, count, reused, fused | u32 each |
| kernel table | u32 count, then u8 length + ascii name for each |
| constants | u32 count, then u32 register + f64 value for each |
| code | u32 length in ints, then i32 for each |
| checksum | u32 crc-32 of every byte before it |

opcodes in the file is indexes into the file's own kernel table, not the one in memory. when reading, every name get looked up in the current `kernel_by_name`, so a reader with kernels in a different order can still load it, and a name it dont know is a error. the reader also check the magic, version, stride, that the code length match the instruction count, that every opcode is in range and that theres no bytes left over.

every compile write the program, read it back and compare it to the original. if they aint equal compiling stop with a binary format error. the "binary" tab show a hex dump.

## 9. bytecode verifying

`js/analysis/verify.js`, `js/backend/evaluator.js`

the vm get compared to `evaluate_graph`, a generic evaluator that walk the graph directly with `real_algebra` and the shape functions in `js/sdf/library.js`. the two of them dont share any math code. they get evaluated at 64 pseudo-random points and times. the biggest relative difference cant be more then `1e-9`, if it is compiling stop with a verify error.

## 10. gradient checking

`js/algebra/dual.js`, `js/analysis/gradient.js`

### algebras

`js/sdf/library.js` write every shape and operator one time, against a interface of basic operations (`add`, `mul`, `sqrt`, `sin`, `min`, etc). `make_sdf_library` get made three times:

| instance | algebra | element |
| --- | --- | --- |
| `sdf_real` | `real_algebra` | a number |
| `sdf_dual` | `dual_algebra` | a value and its partial derivatives for `p.x`, `p.y` and `p.z` |
| `sdf_interval` | `interval_algebra` | a lower and a upper bound |

### check

the generic evaluator run over dual numbers to get the exact gradient, and that get compared to central finite differences the vm work out at 32 points. the median and max errors get reported. the biggest gradient magnitude get recorded too; for a real distance field its 1, and if its over 1.5 the compiler warn that rendering might miss thin features.

## 11. surface localization

`js/algebra/interval.js`, `js/analysis/octree.js`

the generic evaluator run over intervals for a cube shaped cell. if the interval that come out is all positive, the cell is outside the shape; if its all negative its inside. either way the cell cant have the surface in it and get thrown away. if not, the cell get split in eight and it happen again, down to depth 4 in a cube from −3 to 3. the leaf cells that is left maybe contain the surface and get outlined on the cross-section.

interval operations is conservative. `sin` and `cos` find extrema inside the interval, `sq` handle intervals that go over zero, and dividing by a interval with zero in it give back a unbounded interval. the tests check that sampled real values always land inside the bounds.

## 12. mesh extracting

`js/analysis/mesh.js`, `js/ui/mesh-panel.js`

this use naive surface nets:

1. sample the field with the vm on a grid of (n + 1)³ points, n is 24 on the page.
2. every cell where the corners dont agree on the sign get one vertex, at the average of where the field cross zero along its 12 edges.
3. every grid edge with a sign change is surrounded by four cells. there vertices make a quad, it get split in two triangles and wound so the normals point out.

after that it count unique edges, boundary edges (used by one triangle) and non-manifold edges (used by more then two), and work out:

- the euler characteristic v − e + f. a closed mesh like a sphere give 2, a torus give 0.
- the surface area, summed from triangle areas.
- the enclosed volume with the divergence theorem. this only mean something when the mesh is closed.

the whole mesh can be seen as obj text in the "mesh" output tab. the page cut it off at 20000 lines.

## 13. mesh refineing

`js/analysis/refine.js`

surface nets put vertex's at a average of linear zero crossings, so there only kinda on the surface. this stage move each vertex with newton steps along the gradient:

```text
x ← x − f(x) · ∇f(x) / |∇f(x)|²
```

`f` and `∇f` come from the generic evaluator over dual numbers (the same thing stage 10 use). it do up to 4 steps and stop early when `|f|` is under `1e-6`. one step cant move a vertex more then one grid cell, and if a vertex end up further from the surface then where it started it get put back. triangles dont change, so the euler characteristic stay the same, but area and volume gets worked out again. the page show the average `|f|` before and after.

shapes with sharp edges (anything with `min`, `max`, `|`, `&` or `~`) wont go all the way to zero at the creases, cause the gradient jump there.

## 14. gpu shader linking

`js/gpu/renderer.js`

the glsl get compiled and linked with webgl2. if linking fail the old program and its hoisting runtime keep running and the error get shown. line numbers in gpu errors get changed so they point into the `map` function.

the fragment shader march up to 160 steps of 85% of the distance, then shade hits with one directional light. resolution go between 35% and 100% to try keeping it near 60 frames per second.

## page stuff that isnt in the pipeline

| feature | file | how |
| --- | --- | --- |
| probe | `js/ui/probe.js` | rebuild the shader's camera ray on the cpu and march it with the vm |
| point evaluation | `js/ui/probe.js` | run the vm one time at a point |
| cross-section | `js/ui/section.js` | evaluate the vm on a 300 × 300 grid and draw the octree leaves |
| mesh numbers | `js/ui/mesh-panel.js` | show vertex and triangle counts, closed or not, euler characteristic, area, volume and refinement |
| dev server | `.root/serve.js` | serve the project folder over http for working on it locally |
