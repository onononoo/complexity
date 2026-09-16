"use strict";
/* Runs compileSource, links the GPU shader and updates every section. */

const STAGES = [...CPU_STAGES, "gpu"];
const pipeRows = Object.fromEntries([...document.querySelectorAll("#pipe tr[data-stage]")].map(tr => [tr.dataset.stage, tr]));

let lastResult = null;
let activeBytecode = null;
let activeBounds = null;

function setStage(name, state, metric, ms) {
  const tr = pipeRows[name];
  tr.dataset.state = state;
  tr.querySelector(".pm").textContent = metric;
  tr.querySelector(".pt").textContent = ms == null ? "—" : `${ms < 10 ? ms.toFixed(2) : ms.toFixed(1)} ms`;
}

function compile() {
  const src = srcEl.value;
  try { localStorage.setItem("complexity.src", src); } catch (_) {}

  const r = compileSource(src, { time: simTime });
  for (const s of r.stages) setStage(s.name, "ok", s.metric, s.ms);
  if (r.error && r.error.cause) console.error(r.error.cause);

  let error = r.error;
  if (!error) {
    activeBytecode = r.bytecode;
    activeBounds = r.bounds;
    const t0 = performance.now();
    try {
      linkProgram(r.glsl);
      r.stages.push({ name: "gpu", metric: "Linked", ms: performance.now() - t0 });
      setStage("gpu", "ok", "Linked", performance.now() - t0);
    } catch (e) {
      error = e instanceof CompileError ? e : new CompileError("Internal error: " + e.message, null, 0, "gpu");
    }
  }

  if (error) {
    const failed = r.stages.length;
    setStage(STAGES[failed], "fail", "Failed", null);
    for (let i = failed + 1; i < STAGES.length; i++) setStage(STAGES[i], "skip", "Not run", null);
  }

  highlight(src, error);
  renderDiagnostics(src, error, r.warnings, "Compilation completed");
  lastResult = r;
  renderOutput(r);
  if (!r.error) drawSection();
}
