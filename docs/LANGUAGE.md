# Language reference

## Programs

A program is a sequence of declarations followed by one expression. The expression is the signed distance from the point `p` to the surface: negative inside, positive outside.

```text
let r = 1.0 + 0.1 * sin(t)
fn ring(q, radius) = torus(q, radius, 0.05)

sphere(p, r) | ring(p, 1.5)
```

Lines are separated by line breaks or `;`. Line breaks inside parentheses are ignored, so long calls may wrap. `#` starts a comment that runs to the end of the line.

## Grammar

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

Numbers may use a fraction and an exponent, for example `2`, `0.5`, `.5` and `1e-3`.

## Operator precedence

From loosest to tightest. All binary operators are left-associative.

| Precedence | Operators | Meaning |
| --- | --- | --- |
| 10 | `a \| b` | Union: `min(a, b)` |
| 20 | `a & b`, `a ~ b` | Intersection: `max(a, b)`. Subtraction: `max(a, -b)` |
| 30 | `+`, `-` | Addition, subtraction |
| 40 | `*`, `/` | Multiplication, division |
| 50 | `-a` | Negation |
| 60 | `f(...)`, `v.xz` | Call, component access |

## Names

| Name | Type | Meaning |
| --- | --- | --- |
| `p` | `vec3` | The point being sampled |
| `t` | `float` | Time in seconds |
| `pi` | `float` | 3.14159… |

A name must be defined before it is used and cannot be defined twice. Built-in names cannot be redefined. A declaration that is never used produces a warning.

## Functions

`fn` declares a function. Each call is replaced by the function body with the arguments substituted, so functions have no runtime cost. Parameter types are not declared; the body is type checked at each call.

A function can use names defined before it, but not itself or anything defined after it. Recursion is therefore not possible.

## Types

| Type | Components |
| --- | --- |
| `float` | 1 |
| `vec2` | 2 |
| `vec3` | 3 |

Arithmetic operators accept two values of the same type, or a `float` and a vector, in which case the `float` applies to every component. `|`, `&` and `~` require two `float` values. The final expression must be a `float`.

Component access reads one to three components: `p.x` is a `float`, `p.xz` is a `vec2` and `p.zyx` is a `vec3`. A `vec2` has no `z` component.

## Builtins

In the signatures below, `T` stands for `float`, `vec2` or `vec3`, and must be the same type everywhere it appears in one signature.

### Shapes

| Signature | Result |
| --- | --- |
| `sphere(vec3 q, float r)` | Sphere of radius `r` centred at the origin |
| `box(vec3 q, vec3 half)` | Box with half-extents `half` |
| `box(vec3 q, float half)` | Cube with half-extent `half` |
| `torus(vec3 q, float R, float r)` | Torus in the xz plane with major radius `R` and tube radius `r` |
| `cylinder(vec3 q, float r, float h)` | Cylinder along y with radius `r` and half-height `h` |
| `plane(vec3 q, float h)` | Horizontal plane at `y = -h` |
| `gyroid(vec3 q, float scale)` | Gyroid surface; usually used as `abs(gyroid(q, s)) - thickness` |

### Combining distances

| Signature | Result |
| --- | --- |
| `smin(float a, float b, float k)` | Union with a blend of radius `k` |
| `smax(float a, float b, float k)` | Intersection with a blend of radius `k` |
| `shell(float d, float w)` | Hollow version of a shape, with wall thickness `w` |

### Transforming points

| Signature | Result |
| --- | --- |
| `rotx(vec3 q, float a)` | `q` rotated about the x axis by `a` radians |
| `roty(vec3 q, float a)` | `q` rotated about the y axis |
| `rotz(vec3 q, float a)` | `q` rotated about the z axis |
| `rep(vec3 q, float s)` | `q` repeated every `s` units on every axis |
| `twist(vec3 q, float k)` | `q` twisted about the y axis by `k` radians per unit |

### Vectors

| Signature | Result |
| --- | --- |
| `vec2(float x, float y)`, `vec2(float v)` | Vector constructor |
| `vec3(float x, float y, float z)`, `vec3(float v)` | Vector constructor |
| `length(T v)` | Euclidean length |
| `dot(T a, T b)` | Dot product |

### Componentwise math

| Signature |
| --- |
| `sin(T)`, `cos(T)`, `abs(T)`, `sqrt(T)`, `exp(T)`, `floor(T)`, `fract(T)` |
| `pow(T, T)` |
| `min(T, T)`, `min(T, float)`, `max(T, T)`, `max(T, float)` |
| `clamp(T x, float lo, float hi)` |
| `mix(T a, T b, float u)` |

## Errors

Errors report the stage, line and column, and are underlined in the editor. The stages that can report errors in a program are:

| Label | Cause |
| --- | --- |
| Lexical error | A character that is not part of the language |
| Syntax error | Malformed declarations or expressions |
| Type error | Unknown names, wrong argument types or counts, redefinitions, a non-`float` result |
| Verification error | The bytecode disagrees with the reference evaluator. This indicates a compiler bug. |
| GPU error | The browser rejected the generated shader |

## Rendering notes

The renderer marches rays in steps of 85% of the distance returned by the program. Operations such as `twist` and `gyroid` do not return exact distances, and their gradient can be larger than 1. The compiler warns when the sampled gradient magnitude is above 1.5, because the renderer may then step past thin features.
