"use strict";
/* animation clock, adaptive render resolution and frame statistics. */

let paused = true;
let sim_time = 3.0;
let last_frame = performance.now();
let render_scale = 1;
let frame_ema = 1 / 60;
let last_adapt = 0;
let fps_acc = 0;
let fps_frames = 0;

const status_el = document.getElementById("status");
const pause_btn = document.getElementById("pause");

function set_pause_label() {
  pause_btn.textContent = paused ? "resume" : "pause";
}

function adapt_resolution(now, dt) {
  frame_ema = frame_ema * 0.9 + dt * 0.1;
  if (now - last_adapt < 500) return;
  last_adapt = now;
  if (frame_ema > 1 / 40 && render_scale > 0.35) render_scale = Math.max(0.35, render_scale * 0.82);
  else if (frame_ema < 1 / 55 && render_scale < 1) render_scale = Math.min(1, render_scale * 1.12);
}

function frame(now) {
  const dt = Math.min(0.1, (now - last_frame) / 1000);
  last_frame = now;
  if (!paused) sim_time += dt;
  adapt_resolution(now, dt);

  fps_acc += dt;
  fps_frames++;
  if (fps_acc > 1) {
    status_el.textContent =
      `frame rate: ${(fps_frames / fps_acc).toFixed(0)} frames per second. ` +
      `render scale: ${Math.round(render_scale * 100)} percent. time: ${sim_time.toFixed(1)} seconds. ` +
      `animation: ${paused ? "paused" : "running"}.`;
    fps_acc = 0;
    fps_frames = 0;
  }

  draw_frame(cam, sim_time, render_scale);
  requestAnimationFrame(frame);
}

pause_btn.addEventListener("click", () => {
  paused = !paused;
  set_pause_label();
});
