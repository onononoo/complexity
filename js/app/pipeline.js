"use strict";
/* runs compilesource, links the gpu shader and updates every section. */

const page_stages = [...cpu_stages, "gpu"];
const pipe_rows = Object.fromEntries([...document.querySelectorAll("#pipe tr[data-stage]")].map(tr => [tr.dataset.stage, tr]));

let last_result = null;
let active_bytecode = null;
let active_bounds = null;

function set_stage(name, state, metric, ms) {
  const tr = pipe_rows[name];
  tr.dataset.state = state;
  tr.querySelector(".pm").textContent = metric;
  tr.querySelector(".pt").textContent = ms == null ? "—" : `${ms < 10 ? ms.toFixed(2) : ms.toFixed(1)} ms`;
}

function compile() {
  const src = src_el.value;
  try { localStorage.setItem("complexity.source", src); } catch (_) {}

  const r = compile_source(src, { time: sim_time });
  for (const s of r.stages) set_stage(s.name, "ok", s.metric, s.ms);
  if (r.error && r.error.cause) console.error(r.error.cause);

  let error = r.error;
  if (!error) {
    active_bytecode = r.bytecode;
    active_bounds = r.bounds;
    const t0 = performance.now();
    try {
      link_program(r.glsl);
      r.stages.push({ name: "gpu", metric: "linked", ms: performance.now() - t0 });
      set_stage("gpu", "ok", "linked", performance.now() - t0);
    } catch (e) {
      error = e instanceof compile_error ? e : new compile_error("internal error: " + e.message, null, 0, "gpu");
    }
  }

  if (error) {
    const failed = r.stages.length;
    set_stage(page_stages[failed], "fail", "failed", null);
    for (let i = failed + 1; i < page_stages.length; i++) set_stage(page_stages[i], "skip", "not run", null);
  }

  highlight(src, error);
  render_diagnostics(src, error, r.warnings, "compilation completed");
  last_result = r;
  render_output(r);
  if (!r.error) draw_section();
}
