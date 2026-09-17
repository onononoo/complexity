"use strict";
/* editor and example selector events. */

const preset_el = document.getElementById("preset");
const compile_delay_ms = 250;
let pending_compile = 0;

src_el.addEventListener("input", () => {
  preset_el.value = "draft";
  highlight(src_el.value, null);
  clearTimeout(pending_compile);
  pending_compile = setTimeout(compile, compile_delay_ms);
});

src_el.addEventListener("keydown", e => {
  if (e.key === "Tab" && !e.shiftKey) {
    e.preventDefault();
    src_el.setRangeText("  ", src_el.selectionStart, src_el.selectionEnd, "end");
    src_el.dispatchEvent(new Event("input"));
  } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    clearTimeout(pending_compile);
    compile();
  }
});

preset_el.addEventListener("change", () => {
  if (preset_el.value === "draft") return;
  src_el.value = presets[+preset_el.value].src;
  src_el.scrollTop = 0;
  compile();
});
