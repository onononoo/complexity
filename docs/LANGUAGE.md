# language reference

## programs

a program is a sequence of declarations followed by one expression. the expression is the signed distance from the point `p` to the surface: negative inside, positive outside.

```text
let r = 1.0 + 0.1 * sin(t)
fn ring(q, radius) = torus(q, radius, 0.05)

sphere(p, r) | ring(p, 1.5)
```

lines are separated by line breaks or `;`. line breaks inside parentheses are ignored, so long calls may wrap. `#` starts a comment that runs to the end of the line.

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

numbers may use a fraction and an exponent, for example `2`, `0.5`, `.5` and `1e-3`.

## operator precedence

from loosest to tightest. all binary operators are left-associative.

| precedence | operators | meaning |
| --- | --- | --- |
| 10 | `a \| b` | union: `min(a, b)` |
| 20 | `a & b`, `a ~ b` | intersection: `max(a, b)`. subtraction: `max(a, -b)` |
| 30 | `+`, `-` | addition, subtraction |
| 40 | `*`, `/` | multiplication, division |
| 50 | `-a` | negation |
| 60 | `f(...)`, `v.xz` | call, component access |

## names

| name | type | meaning |
| --- | --- | --- |
| `p` | `vec3` | the point being sampled |
| `t` | `float` | time in seconds |
| `pi` | `float` | 3.14159… |

a name must be defined before it is used and cannot be defined twice. built-in names cannot be redefined. a declaration that is never used produces a warning.

## functions

`fn` declares a function. each call is replaced by the function body with the arguments substituted, so functions have no runtime cost. parameter types are not declared; the body is type checked at each call.

a function can use names defined before it, but not itself or anything defined after it. recursion is therefore not possible.

## types

| type | components |
| --- | --- |
| `float` | 1 |
| `vec2` | 2 |
| `vec3` | 3 |

arithmetic operators accept two values of the same type, or a `float` and a vector, in which case the `float` applies to every component. `|`, `&` and `~` require two `float` values. the final expression must be a `float`.

component access reads one to three components: `p.x` is a `float`, `p.xz` is a `vec2` and `p.zyx` is a `vec3`. a `vec2` has no `z` component.

## builtins

in the signatures below, `t` stands for `float`, `vec2` or `vec3`, and must be the same type everywhere it appears in one signature.

### shapes

| signature | result |
| --- | --- |
| `sphere(vec3 q, float r)` | sphere of radius `r` centred at the origin |
| `box(vec3 q, vec3 half)` | box with half-extents `half` |
| `box(vec3 q, float half)` | cube with half-extent `half` |
| `torus(vec3 q, float major, float minor)` | torus in the xz plane with major radius `major` and tube radius `minor` |
| `cylinder(vec3 q, float r, float h)` | cylinder along y with radius `r` and half-height `h` |
| `plane(vec3 q, float h)` | horizontal plane at `y = -h` |
| `gyroid(vec3 q, float scale)` | gyroid surface; usually used as `abs(gyroid(q, s)) - thickness` |

### combining distances

| signature | result |
| --- | --- |
| `smin(float a, float b, float k)` | union with a blend of radius `k` |
| `smax(float a, float b, float k)` | intersection with a blend of radius `k` |
| `shell(float d, float w)` | hollow version of a shape, with wall thickness `w` |

### transforming points

| signature | result |
| --- | --- |
| `rotx(vec3 q, float a)` | `q` rotated about the x axis by `a` radians |
| `roty(vec3 q, float a)` | `q` rotated about the y axis |
| `rotz(vec3 q, float a)` | `q` rotated about the z axis |
| `rep(vec3 q, float s)` | `q` repeated every `s` units on every axis |
| `twist(vec3 q, float k)` | `q` twisted about the y axis by `k` radians per unit |

### vectors

| signature | result |
| --- | --- |
| `vec2(float x, float y)`, `vec2(float v)` | vector constructor |
| `vec3(float x, float y, float z)`, `vec3(float v)` | vector constructor |
| `length(t v)` | euclidean length |
| `dot(t a, t b)` | dot product |

### componentwise math

| signature |
| --- |
| `sin(t)`, `cos(t)`, `abs(t)`, `sqrt(t)`, `exp(t)`, `floor(t)`, `fract(t)` |
| `pow(t, t)` |
| `min(t, t)`, `min(t, float)`, `max(t, t)`, `max(t, float)` |
| `clamp(t x, float lo, float hi)` |
| `mix(t a, t b, float u)` |

## errors

errors report the stage, line and column, and are underlined in the editor. the stages that can report errors in a program are:

| label | cause |
| --- | --- |
| lexical error | a character that is not part of the language |
| syntax error | malformed declarations or expressions |
| type error | unknown names, wrong argument types or counts, redefinitions, a non-`float` result |
| verification error | the bytecode disagrees with the reference evaluator. this indicates a compiler bug. |
| gpu error | the browser rejected the generated shader |

## rendering notes

the renderer marches rays in steps of 85% of the distance returned by the program. operations such as `twist` and `gyroid` do not return exact distances, and their gradient can be larger than 1. the compiler warns when the sampled gradient magnitude is above 1.5, because the renderer may then step past thin features.
