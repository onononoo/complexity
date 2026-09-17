"use strict";
/* section 6: a horizontal slice of the distance field, evaluated with the
   bytecode vm, with octree leaves from the surface localization stage. */

const section_canvas = document.getElementById("section");
const section_y_el = document.getElementById("section-y");
const section_caption = document.getElementById("section-caption");
const section_extent = 3;

function section_shade(d) {
  if (Number.isNaN(d)) return 255;
  if (Math.abs(d) < 0.02) return 0;
  const base = d < 0 ? 150 : 220;
  return math_lib.fract(Math.abs(d) * 10) < 0.06 ? base - 40 : base;
}

function draw_section() {
  const ctx = section_canvas.getContext("2d");
  const n = section_canvas.width;
  if (!active_bytecode) {
    section_caption.textContent = "not drawed. there aint no compiled program.";
    return;
  }
  const y = parseFloat(section_y_el.value) || 0;
  const vm = new bytecode_vm(active_bytecode);
  const img = ctx.createImageData(n, n);
  const t0 = performance.now();
  const to_world = i => -section_extent + ((i + 0.5) / n) * 2 * section_extent;

  for (let j = 0; j < n; j++) {
    const z = -to_world(j);
    for (let i = 0; i < n; i++) {
      const g = section_shade(vm.run(to_world(i), y, z, sim_time));
      const o = (j * n + i) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = g;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  let outlined = 0;
  if (active_bounds && active_bounds.extent >= section_extent) {
    const scale = n / (2 * section_extent);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    for (const [cx, cy, cz, hs] of active_bounds.leaves) {
      if (Math.abs(y - cy) > hs) continue;
      const px = (cx - hs + section_extent) * scale;
      const py = (section_extent - (cz + hs)) * scale;
      ctx.strokeRect(Math.round(px) + 0.5, Math.round(py) + 0.5, Math.round(2 * hs * scale) - 1, Math.round(2 * hs * scale) - 1);
      outlined++;
    }
  }

  const ms = performance.now() - t0;
  const bounds_note = active_bounds ? ` octree cell's was computed at t = ${active_bounds.time.toFixed(2)} s.` : "";
  section_caption.textContent =
    `figure 1. plane at y = ${y}, x and z goes from −${section_extent} to ${section_extent}, t = ${sim_time.toFixed(2)} s. ` +
    `done ${n * n} evaluation's in ${ms.toFixed(1)} ms. ${outlined} cell's is outlined.${bounds_note}`;
}

document.getElementById("section-draw").addEventListener("click", draw_section);
