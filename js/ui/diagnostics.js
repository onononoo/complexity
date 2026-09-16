"use strict";
/* Error, warning and status messages below the editor. */

const diagEl = document.getElementById("diag");

const STAGE_LABEL = {
  lex: "Lexical error",
  parse: "Syntax error",
  elab: "Type error",
  verify: "Verification error",
  gradient: "Gradient check error",
  bounds: "Surface localization error",
  gpu: "GPU error",
};

function renderDiagnostics(src, error, warnings, summary) {
  diagEl.innerHTML = "";
  const add = (label, msg, pos, len) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "msg";
    const where = pos != null ? (({ line, col }) => ` (line ${line}, column ${col})`)(lineCol(src, pos)) : "";
    b.textContent = `${label}${where}: ${msg}${/[.?!]$/.test(msg) ? "" : "."}`;
    if (pos != null) {
      b.addEventListener("click", () => { srcEl.focus(); srcEl.setSelectionRange(pos, pos + Math.max(0, len || 0)); });
    } else {
      b.dataset.static = "";
    }
    diagEl.appendChild(b);
  };
  if (error) add(STAGE_LABEL[error.stage] || "Internal error", error.message, error.pos, error.len);
  for (const w of warnings) add("Warning", w.msg, w.pos, w.len);
  if (!error && summary) add("Status", summary, null);
}
