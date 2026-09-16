"use strict";
/* Startup: fill the example list and reference table, restore the last
   draft, compile once and start the render loop. */

PRESETS.forEach((p, i) => presetEl.add(new Option(p.name, String(i))));
presetEl.add(new Option("(Edited)", "draft"));

document.getElementById("reftable").innerHTML = Object.values(B)
  .filter(b => b.doc)
  .map(b => `<dt><code>${esc(b.doc)}</code></dt><dd>${esc(b.about)}</dd>`)
  .join("");

let savedDraft = null;
try { savedDraft = localStorage.getItem("complexity.src"); } catch (_) {}
const savedPreset = PRESETS.findIndex(p => p.src === savedDraft);
if (savedDraft && savedDraft.trim() && savedPreset === -1) {
  srcEl.value = savedDraft;
  presetEl.value = "draft";
} else {
  const i = Math.max(0, savedPreset);
  srcEl.value = PRESETS[i].src;
  presetEl.value = String(i);
}

setPauseLabel();
compile();
requestAnimationFrame(frame);
