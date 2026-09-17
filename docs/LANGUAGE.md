# language reference

## programs

a program is a bunch of declarations and then one expression at the end. the expression is the signed distance from the point `p` to the surface: negative mean inside, positive mean outside.

```text
let r = 1.0 + 0.1 * sin(t)
fn ring(q, radius) = torus(q, radius, 0.05)

sphere(p, r) | ring(p, 1.5)
```

lines gets separated by line breaks or `;`. line breaks inside parentheses dont count, so long calls can wrap. `#` start a comment that go to the end of the line.

## grammar

```text
program     = { separator } { declaration separator { separator } } expression { separator }
declaration = "let" name "=" expression
            | "fn" name "(" [ name { "," name } ] ")" "=" expression
expression  = prefix { infix-operator expression | "(" arguments ")" | "." components }
prefix      = number | name | "(" expression ")" | "-" expression
arguments   = [ expression { "," expression } ]
components  = one to three of "x", "y", "z"
separator   = line break | ";"
```

numbers can have a fraction and a exponent, like `2`, `0.5`, `.5` and `1e-3`.

## operator precedence

loosest one first, tightest one last. every binary operator is left-associative.

| precedence | operators | what it mean |
| --- | --- | --- |
| 10 | `a \| b` | union: `min(a, b)` |
| 20 | `a & b`, `a ~ b` | intersection: `max(a, b)`. subtraction: `max(a, -b)` |
| 30 | `+`, `-` | add, subtract |
| 40 | `*`, `/` | multiply, divide |
| 50 | `-a` | negate |
| 60 | `f(...)`, `v.xz` | call, component access |

## names

| name | type | what it is |
| --- | --- | --- |
| `p` | `vec3` | the point thats being sampled |
| `t` | `float` | time in second |
| `pi` | `float` | 3.14159… |

a name gotta be defined before u use it and it cant be defined two times. builtin names cant be redefined. if u declare something and never use it u get a warning.

## functions

`fn` declare a function. every call get replaced with the function body with the arguments put in, so functions dont cost nothing at runtime. parameter types aint declared; the body get type checked at every call.

a function can use names from before it, but not itself or stuff defined after. so no recursion.

## types

| type | components |
| --- | --- |
| `float` | 1 |
| `vec2` | 2 |
| `vec3` | 3 |

arithmetic operators takes two values of the same type, or a `float` and a vector, then the `float` go to every component. `|`, `&` and `~` needs two `float` values. the last expression gotta be a `float`.

component access read one to three components: `p.x` is a `float`, `p.xz` is a `vec2` and `p.zyx` is a `vec3`. a `vec2` dont have a `z` component.

## builtins

in the signatures down below, `any` mean `float`, `vec2` or `vec3`, and it have to be the same type everywhere it show up in one signature.

### shapes

| signature | result |
| --- | --- |
| `sphere(vec3 q, float r)` | sphere with radius `r` at the origin |
| `box(vec3 q, vec3 half)` | box with half-extents `half` |
| `box(vec3 q, float half)` | cube with half-extent `half` |
| `torus(vec3 q, float major, float minor)` | torus laying in the xz plane, major radius `major` and tube radius `minor` |
| `cylinder(vec3 q, float r, float h)` | cylinder going along y with radius `r` and half-height `h` |
| `plane(vec3 q, float h)` | flat plane at `y = -h` |
| `gyroid(vec3 q, float scale)` | gyroid surface; mostly u use it like `abs(gyroid(q, s)) - thickness` |

### combining distances

| signature | result |
| --- | --- |
| `smin(float a, float b, float k)` | union with a blend that is `k` big |
| `smax(float a, float b, float k)` | intersection with a blend that is `k` big |
| `shell(float d, float w)` | hollow version of a shape, wall is `w` thick |

### moving points around

| signature | result |
| --- | --- |
| `rotx(vec3 q, float a)` | `q` rotated around x axis by `a` radians |
| `roty(vec3 q, float a)` | `q` rotated around y axis |
| `rotz(vec3 q, float a)` | `q` rotated around z axis |
| `rep(vec3 q, float s)` | `q` repeated every `s` units on all axis |
| `twist(vec3 q, float k)` | `q` twisted around y axis, `k` radians per unit |

### vectors

| signature | result |
| --- | --- |
| `vec2(float x, float y)`, `vec2(float v)` | make a vector |
| `vec3(float x, float y, float z)`, `vec3(float v)` | make a vector |
| `length(any v)` | how long it is |
| `dot(any a, any b)` | dot product |

### math on each component

| signature |
| --- |
| `sin(any)`, `cos(any)`, `abs(any)`, `sqrt(any)`, `exp(any)`, `floor(any)`, `fract(any)` |
| `pow(any, any)` |
| `min(any, any)`, `min(any, float)`, `max(any, any)`, `max(any, float)` |
| `clamp(any x, float lo, float hi)` |
| `mix(any a, any b, float u)` |

## errors

errors say the stage, line and column, and they get underlined in the editor. these is the ones a program can cause:

| label | why |
| --- | --- |
| lexer error | a character that aint part of the language |
| syntax error | declarations or expressions that is wrote wrong |
| type error | unknown names, wrong argument types or counts, defining something twice, a result that aint a `float` |
| binary format error | the bytecode didnt come back the same from the binary format. thats a compiler bug. |
| verify error | the bytecode dont agree with the reference evaluator. thats a compiler bug to. |
| gpu error | the browser didnt like the generated shader |

## rendering notes

the renderer march rays in steps of 85% of the distance the program give back. stuff like `twist` and `gyroid` dont give exact distances, and there gradient can be bigger then 1. the compiler warn u when the sampled gradient magnitude go over 1.5, cause then the renderer might step right past thin features.
