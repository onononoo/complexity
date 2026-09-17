"use strict";
/* orbit camera: drag to rotate, wheel to zoom, click to probe. */

const camera_default = { yaw: 0.65, pitch: 0.3, dist: 5.2 };
const cam = { ...camera_default };
const click_slop = 4;
let drag = null;

canvas.addEventListener("pointerdown", e => {
  drag = { x: e.clientX, y: e.clientY, moved: 0 };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  cam.yaw -= dx * 0.008;
  cam.pitch = Math.min(1.45, Math.max(-0.2, cam.pitch + dy * 0.006));
  drag.x = e.clientX;
  drag.y = e.clientY;
});

canvas.addEventListener("pointerup", e => {
  if (drag && drag.moved < click_slop) {
    const rect = canvas.getBoundingClientRect();
    run_probe(e.clientX - rect.left, e.clientY - rect.top);
  }
  drag = null;
});

canvas.addEventListener("pointercancel", () => { drag = null; });

canvas.addEventListener("wheel", e => {
  e.preventDefault();
  cam.dist = Math.min(14, Math.max(1.8, cam.dist * Math.exp(e.deltaY * 0.001)));
}, { passive: false });

document.getElementById("resetcam").addEventListener("click", () => Object.assign(cam, camera_default));
