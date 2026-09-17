"use strict";
/* mesh extraction with naive surface nets.

   1. sample the field on an (n + 1)³ grid of points with the bytecode vm.
   2. every cell whose corners disagree in sign gets one vertex, placed at
      the average of the zero crossings along its twelve edges.
   3. every grid edge with a sign change is surrounded by four cells; their
      vertices form a quad, split into two triangles, wound so that normals
      point out of the shape.

   the result also reports area, signed volume, edge count, boundary edges
   and the euler characteristic v − e + f (2 for a closed sphere-like mesh,
   0 for a torus). */

const mesh_corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const mesh_edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

function extract_mesh(prog, t, resolution, extent) {
  const n = resolution, np = n + 1, h = (2 * extent) / n;
  const vm = new bytecode_vm(prog);

  const field = new Float64Array(np * np * np);
  const at = (i, j, k) => (k * np + j) * np + i;
  for (let k = 0; k < np; k++) {
    for (let j = 0; j < np; j++) {
      for (let i = 0; i < np; i++) {
        const v = vm.run(-extent + i * h, -extent + j * h, -extent + k * h, t);
        field[at(i, j, k)] = Number.isNaN(v) ? 1 : v;
      }
    }
  }

  const cell_vertex = new Int32Array(n * n * n).fill(-1);
  const cell = (i, j, k) => (k * n + j) * n + i;
  const positions = [];
  const vals = new Float64Array(8);

  for (let k = 0; k < n; k++) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        let inside = 0;
        for (let c = 0; c < 8; c++) {
          const o = mesh_corners[c];
          vals[c] = field[at(i + o[0], j + o[1], k + o[2])];
          if (vals[c] < 0) inside++;
        }
        if (inside === 0 || inside === 8) continue;
        let sx = 0, sy = 0, sz = 0, count = 0;
        for (const [a, b] of mesh_edges) {
          const va = vals[a], vb = vals[b];
          if ((va < 0) === (vb < 0)) continue;
          const u = va / (va - vb);
          const ca = mesh_corners[a], cb = mesh_corners[b];
          sx += ca[0] + (cb[0] - ca[0]) * u;
          sy += ca[1] + (cb[1] - ca[1]) * u;
          sz += ca[2] + (cb[2] - ca[2]) * u;
          count++;
        }
        cell_vertex[cell(i, j, k)] = positions.length / 3;
        positions.push(-extent + (i + sx / count) * h, -extent + (j + sy / count) * h, -extent + (k + sz / count) * h);
      }
    }
  }

  const triangles = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) triangles.push(a, c, b, a, d, c);
    else triangles.push(a, b, c, a, c, d);
  };
  const cv = (i, j, k) => cell_vertex[cell(i, j, k)];

  for (let k = 0; k < n; k++) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const inside0 = field[at(i, j, k)] < 0;
        if (j > 0 && k > 0 && inside0 !== (field[at(i + 1, j, k)] < 0)) {
          quad(cv(i, j - 1, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i, j - 1, k), !inside0);
        }
        if (i > 0 && k > 0 && inside0 !== (field[at(i, j + 1, k)] < 0)) {
          quad(cv(i - 1, j, k - 1), cv(i - 1, j, k), cv(i, j, k), cv(i, j, k - 1), !inside0);
        }
        if (i > 0 && j > 0 && inside0 !== (field[at(i, j, k + 1)] < 0)) {
          quad(cv(i - 1, j - 1, k), cv(i, j - 1, k), cv(i, j, k), cv(i - 1, j, k), !inside0);
        }
      }
    }
  }

  return summarize_mesh(new Float32Array(positions), new Uint32Array(triangles), { resolution: n, extent, time: t, samples: field.length });
}

function summarize_mesh(positions, triangles, meta) {
  const vertex_count = positions.length / 3;
  const triangle_count = triangles.length / 3;
  const edge_use = new Map();
  let area = 0, volume = 0;

  for (let f = 0; f < triangles.length; f += 3) {
    const ia = triangles[f], ib = triangles[f + 1], ic = triangles[f + 2];
    const ax = positions[ia * 3], ay = positions[ia * 3 + 1], az = positions[ia * 3 + 2];
    const bx = positions[ib * 3], by = positions[ib * 3 + 1], bz = positions[ib * 3 + 2];
    const cx = positions[ic * 3], cy = positions[ic * 3 + 1], cz = positions[ic * 3 + 2];
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    area += Math.hypot(nx, ny, nz) / 2;
    volume += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
    for (const [p, q] of [[ia, ib], [ib, ic], [ic, ia]]) {
      const key = Math.min(p, q) * vertex_count + Math.max(p, q);
      edge_use.set(key, (edge_use.get(key) || 0) + 1);
    }
  }

  let boundary_edges = 0, nonmanifold_edges = 0;
  for (const uses of edge_use.values()) {
    if (uses === 1) boundary_edges++;
    else if (uses > 2) nonmanifold_edges++;
  }

  return Object.assign({}, meta, {
    positions,
    triangles,
    vertex_count,
    triangle_count,
    edge_count: edge_use.size,
    boundary_edges,
    nonmanifold_edges,
    closed: boundary_edges === 0,
    euler: vertex_count - edge_use.size + triangle_count,
    area,
    volume,
  });
}

function mesh_to_obj(mesh, max_lines) {
  const lines = [
    `# surface nets mesh, resolution ${mesh.resolution}, extent ${mesh.extent}, t = ${mesh.time}`,
    `# ${mesh.vertex_count} vertices, ${mesh.triangle_count} triangles`,
  ];
  for (let i = 0; i < mesh.positions.length && lines.length < max_lines; i += 3) {
    lines.push(`v ${mesh.positions[i].toFixed(4)} ${mesh.positions[i + 1].toFixed(4)} ${mesh.positions[i + 2].toFixed(4)}`);
  }
  for (let f = 0; f < mesh.triangles.length && lines.length < max_lines; f += 3) {
    lines.push(`f ${mesh.triangles[f] + 1} ${mesh.triangles[f + 1] + 1} ${mesh.triangles[f + 2] + 1}`);
  }
  if (lines.length >= max_lines) lines.push(`# output cut off at ${max_lines} lines`);
  return lines.join("\n");
}
