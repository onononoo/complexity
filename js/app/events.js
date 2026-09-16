"use strict";
/* Editor and example selector events. */

const presetEl = document.getElementById("preset");
const COMPILE_DELAY_MS = 250;
let pendingCompile = 0;

srcEl.addEventListener("input", () => {
  presetEl.value = "draft";
  highlight(srcEl.value, null);
  clearTimeout(pendingCompile);
  pendingCompile = setTimeout(compile, COMPILE_DELAY_MS);
});

srcEl.addEventListener("keydown", e => {
  if (e.key === "Tab" && !e.shiftKey) {
    e.preventDefault();
    srcEl.setRangeText("  ", srcEl.selectionStart, srcEl.selectionEnd, "end");
    srcEl.dispatchEvent(new Event("input"));
  } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    clearTimeout(pendingCompile);
    compile();
  }
});

presetEl.addEventListener("change", () => {
  if (presetEl.value === "draft") return;
  srcEl.value = PRESETS[+presetEl.value].src;
  srcEl.scrollTop = 0;
  compile();
});
