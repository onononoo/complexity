"use strict";
/* example programs. */

const presets = [
  { name: "example 1: perforated sphere", src:
`# a shell drilled by a lattice, with a torus around it
fn hollow(q, r, w) = shell(sphere(q, r), w)

let breathe = 1.0 + 0.06 * sin(t * 1.7)
let core = hollow(p, breathe, 0.04)
let halo = torus(rotx(p, t * 0.5), 1.55, 0.09)
let lattice = box(rep(p, 0.42), 0.15)

smin(core ~ lattice, halo, 0.2) | plane(p, 1.4)` },
  { name: "example 2: gyroid", src:
`# a rotating gyroid clipped to a sphere
let q = roty(p, t * 0.2)
let sheet = abs(gyroid(q, 6.0)) - 0.03
let ball = sphere(p, 1.3)

ball & sheet | plane(p, 1.4)` },
  { name: "example 3: twisted column", src:
`# twisted box with rings every half unit
let q = twist(p, 0.9 + 0.5 * sin(t * 0.6))
let column = box(q, vec3(0.45, 1.6, 0.45)) - 0.05
let rings = torus(vec3(p.x, fract(p.y * 2.0) / 2.0 - 0.25, p.z), 0.72, 0.04)

(column | rings) & box(p, vec3(2.0, 1.3, 2.0)) | plane(p, 1.4)` },
  { name: "example 4: optimizer test", src:
`# see the expression graph and bytecode output
let r = sqrt(2.0) * 0.5 + max(0.0, cos(0.0) - 1.0)   # folds to a constant
let bob = pow(sin(t * 0.5), 1.0) * 0.1 * 2.0 - 0.1 - 0.1
let same = sphere(p - vec3(0.0, bob, 0.0), r) + 0.0  # + 0.0 is removed
let wobble = sin(p.x * 2.0 * 2.0 + t) * 0.05 * 1.0   # 2.0 * 2.0 is merged
let unused = box(p, 9.0)                             # reported as unused

(same + wobble) | (same + wobble) | plane(p, 1.4)` },
];
