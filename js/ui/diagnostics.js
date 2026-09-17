"use strict";
/* error, warning and status messages below the editor. */

const diag_el = document.getElementById("diag");

const stage_label = {
  lex: "lexer error",
  parse: "syntax error",
  elab: "type error",
  verify: "verify error",
  gradient: "gradient checking error",
  bounds: "surface localize error",
  mesh: "mesh extract error",
  hoist: "hoisting error",
  serialize: "binary format error",
  refine: "refine error",
  gpu: "gpu error",
};

function render_diagnostics(src, error, warnings, summary) {
  diag_el.innerHTML = "";
  const add = (label, msg, pos, len) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "msg";
    const where = pos != null ? (({ line, col }) => ` (line ${line}, column ${col})`)(line_col(src, pos)) : "";
    b.textContent = `${label}${where}: ${msg}${/[.?!]$/.test(msg) ? "" : "."}`;
    if (pos != null) {
      b.addEventListener("click", () => { src_el.focus(); src_el.setSelectionRange(pos, pos + Math.max(0, len || 0)); });
    } else {
      b.dataset.static = "";
    }
    diag_el.appendChild(b);
  };
  if (error) add(stage_label[error.stage] || "internal error happen", error.message, error.pos, error.len);
  for (const w of warnings) add("warning", w.msg, w.pos, w.len);
  if (!error && summary) add("status", summary, null);
}
