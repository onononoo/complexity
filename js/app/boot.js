"use strict";
/* startup: fill the example list and reference table, restore the last
   draft, compile once and start the render loop. */

presets.forEach((p, i) => preset_el.add(new Option(p.name, String(i))));
preset_el.add(new Option("(edited)", "draft"));

document.getElementById("reftable").innerHTML = Object.values(builtins)
  .filter(b => b.doc)
  .map(b => `<dt><code>${esc(b.doc)}</code></dt><dd>${esc(b.about)}</dd>`)
  .join("");

let saved_draft = null;
try { saved_draft = localStorage.getItem("complexity.source"); } catch (_) {}
const saved_preset = presets.findIndex(p => p.src === saved_draft);
if (saved_draft && saved_draft.trim() && saved_preset === -1) {
  src_el.value = saved_draft;
  preset_el.value = "draft";
} else {
  const i = Math.max(0, saved_preset);
  src_el.value = presets[i].src;
  preset_el.value = String(i);
}

set_pause_label();
compile();
requestAnimationFrame(frame);
