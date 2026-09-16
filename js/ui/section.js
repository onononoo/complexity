"use strict";
/* Section 6: a horizontal slice of the distance field, evaluated with the
   bytecode VM, with octree leaves from the surface localization stage. */

const sectionCanvas = document.getElementById("section");
const sectionYEl = document.getElementById("section-y");
const sectionCaption = document.getElementById("section-caption");
const SECTION_EXTENT = 3;

function sectionShade(d) {
  if (Number.isNaN(d)) return 255;
  if (Math.abs(d) < 0.02) return 0;
  const base = d < 0 ? 150 : 220;
  return MathLib.fract(Math.abs(d) * 10) < 0.06 ? base - 40 : base;
}

function drawSection() {
  const ctx = sectionCanvas.getContext("2d");
  const n = sectionCanvas.width;
  if (!activeBytecode) {
    sectionCaption.textContent = "Not drawn. There is no compiled program.";
    return;
  }
  const y = parseFloat(sectionYEl.value) || 0;
  const vm = new VM(activeBytecode);
  const img = ctx.createImageData(n, n);
  const t0 = performance.now();
  const toWorld = i => -SECTION_EXTENT + ((i + 0.5) / n) * 2 * SECTION_EXTENT;

  for (let j = 0; j < n; j++) {
    const z = -toWorld(j);
    for (let i = 0; i < n; i++) {
      const g = sectionShade(vm.run(toWorld(i), y, z, simTime));
      const o = (j * n + i) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = g;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  let outlined = 0;
  if (activeBounds && activeBounds.extent >= SECTION_EXTENT) {
    const scale = n / (2 * SECTION_EXTENT);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    for (const [cx, cy, cz, hs] of activeBounds.leaves) {
      if (Math.abs(y - cy) > hs) continue;
      const px = (cx - hs + SECTION_EXTENT) * scale;
      const py = (SECTION_EXTENT - (cz + hs)) * scale;
      ctx.strokeRect(Math.round(px) + 0.5, Math.round(py) + 0.5, Math.round(2 * hs * scale) - 1, Math.round(2 * hs * scale) - 1);
      outlined++;
    }
  }

  const ms = performance.now() - t0;
  const boundsNote = activeBounds ? ` Octree cells were computed at t = ${activeBounds.time.toFixed(2)} s.` : "";
  sectionCaption.textContent =
    `Figure 1. Plane y = ${y}, x and z from −${SECTION_EXTENT} to ${SECTION_EXTENT}, t = ${simTime.toFixed(2)} s. ` +
    `${n * n} evaluations in ${ms.toFixed(1)} ms. ${outlined} cells outlined.${boundsNote}`;
}

document.getElementById("section-draw").addEventListener("click", drawSection);
