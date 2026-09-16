"use strict";
/* Animation clock, adaptive render resolution and frame statistics. */

let paused = true;
let simTime = 3.0;
let lastFrame = performance.now();
let renderScale = 1;
let frameEma = 1 / 60;
let lastAdapt = 0;
let fpsAcc = 0;
let fpsFrames = 0;

const statusEl = document.getElementById("status");
const pauseBtn = document.getElementById("pause");

function setPauseLabel() {
  pauseBtn.textContent = paused ? "Resume" : "Pause";
}

function adaptResolution(now, dt) {
  frameEma = frameEma * 0.9 + dt * 0.1;
  if (now - lastAdapt < 500) return;
  lastAdapt = now;
  if (frameEma > 1 / 40 && renderScale > 0.35) renderScale = Math.max(0.35, renderScale * 0.82);
  else if (frameEma < 1 / 55 && renderScale < 1) renderScale = Math.min(1, renderScale * 1.12);
}

function frame(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  if (!paused) simTime += dt;
  adaptResolution(now, dt);

  fpsAcc += dt;
  fpsFrames++;
  if (fpsAcc > 1) {
    statusEl.textContent =
      `Frame rate: ${(fpsFrames / fpsAcc).toFixed(0)} frames per second. ` +
      `Render scale: ${Math.round(renderScale * 100)} percent. Time: ${simTime.toFixed(1)} seconds. ` +
      `Animation: ${paused ? "paused" : "running"}.`;
    fpsAcc = 0;
    fpsFrames = 0;
  }

  drawFrame(cam, simTime, renderScale);
  requestAnimationFrame(frame);
}

pauseBtn.addEventListener("click", () => {
  paused = !paused;
  setPauseLabel();
});
