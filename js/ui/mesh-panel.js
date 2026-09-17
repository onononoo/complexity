"use strict";
/* section 7: numbers about the mesh from stages 2.12 and 2.13. */

const mesh_cells = {
  v: document.getElementById("mesh-v"),
  f: document.getElementById("mesh-f"),
  closed: document.getElementById("mesh-closed"),
  euler: document.getElementById("mesh-euler"),
  area: document.getElementById("mesh-area"),
  volume: document.getElementById("mesh-volume"),
  refine: document.getElementById("mesh-refine"),
};

function render_mesh_panel(mesh) {
  if (!mesh) {
    for (const el of Object.values(mesh_cells)) el.textContent = "—";
    return;
  }
  mesh_cells.v.textContent = String(mesh.vertex_count);
  mesh_cells.f.textContent = String(mesh.triangle_count);
  mesh_cells.closed.textContent = mesh.closed
    ? "yes"
    : `no, ${mesh.boundary_edges} edge are on the boundary`;
  mesh_cells.euler.textContent = mesh.closed ? String(mesh.euler) : `${mesh.euler} (dont mean much, its open)`;
  mesh_cells.area.textContent = mesh.area.toFixed(4);
  mesh_cells.volume.textContent = mesh.closed ? mesh.volume.toFixed(4) : "cant tell, mesh is open";
  const rf = mesh.refinement;
  mesh_cells.refine.textContent = rf
    ? `avg distance to surface was ${rf.mean_before.toExponential(2)} now its ${rf.mean_after.toExponential(2)} (${rf.steps} newton step, ${rf.reverted} put back)`
    : "—";
}
