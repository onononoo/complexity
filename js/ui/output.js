"use strict";
/* Section 7: GLSL, expression graph, bytecode, analysis and token views. */

const outEl = document.getElementById("out");
const outMeta = document.getElementById("outmeta");
let outputView = "glsl";

const OUTPUT_VIEWS = {
  glsl(r) {
    if (!r.glsl) return ["// No shader. See the error in section 3.", ""];
    return [r.glsl, `${r.glsl.length} characters, ${r.temps} temporaries.`];
  },

  graph(r) {
    if (!r.info) return ["# The graph is available after type checking succeeds.", ""];
    const { g, info, root } = r;
    const s = g.stats;
    const rows = [
      "# Reachable nodes only.",
      `# folded ${s.folded}, simplified ${s.simplified}, reassociated ${s.reassociated}, shared ${s.shared}, inlined calls ${s.inlined}, dead ${info.dead}`,
      "",
    ];
    for (const n of g.nodes) {
      if (!info.seen[n.id]) continue;
      const label = n.op === "const" ? glslLiteral(n.v) : n.op.startsWith("call:") ? n.op.slice(5) : n.op;
      const args = n.args.length ? `(${n.args.map(a => "%" + a).join(", ")})` : "";
      const note = n.id === root.id ? "root" : info.refs[n.id] > 1 ? `used ${info.refs[n.id]} times` : "";
      rows.push(`%${String(n.id).padEnd(4)} ${TN[n.type].padEnd(6)} ${(label + args).padEnd(32)} ${note}`);
    }
    return [rows.join("\n"), `${info.reachable} live of ${g.nodes.length} nodes.`];
  },

  bytecode(r) {
    if (!r.bytecode) return ["; No bytecode. See the error in section 3.", ""];
    return [disassemble(r.bytecode), `${r.bytecode.code.length * 4} bytes.`];
  },

  analysis(r) {
    const lines = [];
    const row = (k, v) => lines.push(`  ${k.padEnd(34)} ${v}`);
    lines.push("Bytecode verification");
    if (r.verify) {
      row("samples", r.verify.samples);
      row("maximum relative difference", r.verify.max);
      row("tolerance", VERIFY_TOLERANCE);
    } else row("status", "not run");
    lines.push("", "Gradient check (dual numbers against finite differences)");
    if (r.gradient) {
      row("samples", r.gradient.samples);
      row("finite difference step", GRADIENT_STEP);
      row("median error", r.gradient.median);
      row("maximum error", r.gradient.max);
      row("maximum gradient magnitude", r.gradient.maxNorm);
    } else row("status", "not run");
    lines.push("", "Surface localization (interval arithmetic octree)");
    if (r.bounds) {
      const b = r.bounds;
      row("region", `[-${b.extent}, ${b.extent}] on each axis`);
      row("time", b.time);
      row("depth", b.depth);
      row("cells evaluated", b.evaluated);
      row("cells culled, outside", b.culledOutside);
      row("cells culled, inside", b.culledInside);
      row("leaf cells that may contain surface", `${b.surfaceLeaves} of ${b.totalLeaves}`);
      row("fraction of volume excluded", (1 - b.surfaceLeaves / b.totalLeaves).toFixed(4));
    } else row("status", "not run");
    return [lines.join("\n"), ""];
  },

  tokens(r) {
    if (!r.toks) return ["// Lexical analysis failed.", ""];
    const text = r.toks.map(t => {
      const { line, col } = lineCol(r.src, t.pos);
      const val = t.type === "sep" ? (t.value === "\n" ? "(newline)" : ";") : t.type === "eof" ? "" : String(t.value);
      return `${(line + ":" + col).padEnd(8)}${t.type.padEnd(5)} ${val}`;
    }).join("\n");
    return [text, `${r.toks.length} tokens.`];
  },
};

function renderOutput(r) {
  if (!r) return;
  const [text, meta] = OUTPUT_VIEWS[outputView](r);
  outEl.textContent = text;
  outMeta.textContent = meta;
}

document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => {
  outputView = b.dataset.view;
  document.querySelectorAll(".tabs button").forEach(x => x.setAttribute("aria-selected", String(x === b)));
  renderOutput(lastResult);
}));
