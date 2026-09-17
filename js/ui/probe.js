"use strict";
/* cpu ray probe. rebuilds the shader's camera ray for a clicked pixel and
   marches it with the bytecode vm, independently of the gpu. */

const vec = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  fmt: a => a.map(v => v.toFixed(4)).join(", "),
};

function camera_ray(cam, px, py, w, h) {
  const ux = (px - 0.5 * w) / h, uy = ((h - py) - 0.5 * h) / h;
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const ro = [cam.dist * sy * cp, cam.dist * sp, cam.dist * cy * cp];
  const ww = vec.norm([-ro[0], -ro[1], -ro[2]]);
  const uu = vec.norm(vec.cross(ww, [0, 1, 0]));
  const vv = vec.cross(uu, ww);
  const rd = vec.norm([0, 1, 2].map(i => ux * uu[i] + uy * vv[i] + 1.7 * ww[i]));
  return { ro, rd };
}

function march_cpu(vm, ro, rd, t) {
  let d = 0, steps = 0, hit = false;
  for (; steps < 160; steps++) {
    const h = vm.run(ro[0] + rd[0] * d, ro[1] + rd[1] * d, ro[2] + rd[2] * d, t);
    if (Math.abs(h) < 0.0004 * Math.max(d, 1)) { hit = true; break; }
    d += h * 0.85;
    if (d > 24) break;
  }
  const pos = [0, 1, 2].map(i => ro[i] + rd[i] * d);
  let normal = null;
  if (hit) {
    const e = 0.0007, taps = [[1, -1, -1], [-1, -1, 1], [-1, 1, -1], [1, 1, 1]];
    const n = [0, 0, 0];
    for (const k of taps) {
      const v = vm.run(pos[0] + k[0] * e, pos[1] + k[1] * e, pos[2] + k[2] * e, t);
      n[0] += k[0] * v; n[1] += k[1] * v; n[2] += k[2] * v;
    }
    normal = vec.norm(n);
  }
  return { hit, steps, d, pos, normal };
}

function run_probe(px, py) {
  if (!active_bytecode) return;
  const vm = new bytecode_vm(active_bytecode);
  const t0 = performance.now();
  const { ro, rd } = camera_ray(cam, px, py, canvas.clientWidth, canvas.clientHeight);
  const r = march_cpu(vm, ro, rd, sim_time);
  const ms = performance.now() - t0;
  const set = (id, text) => { document.getElementById(id).textContent = text; };
  set("pr-pixel", `(${Math.round(px)}, ${Math.round(py)}) at t = ${sim_time.toFixed(3)} s`);
  set("pr-hit", r.hit ? "it hit the surface" : "didnt hit nothing");
  set("pr-steps", String(r.steps));
  set("pr-len", r.d.toFixed(4));
  set("pr-pos", r.hit ? vec.fmt(r.pos) : "—");
  set("pr-normal", r.normal ? vec.fmt(r.normal) : "—");
  set("pr-evals", String(vm.evaluations));
  set("pr-time", `${ms.toFixed(2)} ms`);
}

document.getElementById("evalbtn").addEventListener("click", () => {
  const out = document.getElementById("evalout");
  if (!active_bytecode) { out.textContent = "theres no compiled program."; return; }
  const v = id => parseFloat(document.getElementById(id).value) || 0;
  const d = new bytecode_vm(active_bytecode).run(v("ex"), v("ey"), v("ez"), sim_time);
  out.textContent = `distance is ${d.toFixed(6)}`;
});
