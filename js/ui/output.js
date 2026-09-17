"use strict";
/* section 7: glsl, expression graph, bytecode, analysis and token views. */

const out_el = document.getElementById("out");
const out_meta = document.getElementById("outmeta");
let output_view = "glsl";

const output_views = {
  glsl(r) {
    if (!r.glsl) return ["// no shader. see the error in section 3.", ""];
    return [r.glsl, `${r.glsl.length} characters, ${r.temps} temporaries.`];
  },

  graph(r) {
    if (!r.info) return ["# the graph is available after type checking succeeds.", ""];
    const { g, info, root } = r;
    const s = g.stats;
    const rows = [
      "# reachable nodes only.",
      `# folded ${s.folded}, simplified ${s.simplified}, reassociated ${s.reassociated}, shared ${s.shared}, inlined calls ${s.inlined}, dead ${info.dead}`,
      "",
    ];
    for (const n of g.nodes) {
      if (!info.seen[n.id]) continue;
      const label = n.op === "const" ? glsl_literal(n.v) : n.op.startsWith("call:") ? n.op.slice(5) : n.op;
      const args = n.args.length ? `(${n.args.map(a => "%" + a).join(", ")})` : "";
      const note = n.id === root.id ? "root" : info.refs[n.id] > 1 ? `used ${info.refs[n.id]} times` : "";
      rows.push(`%${String(n.id).padEnd(4)} ${type_names[n.type].padEnd(6)} ${(label + args).padEnd(32)} ${note}`);
    }
    return [rows.join("\n"), `${info.reachable} live of ${g.nodes.length} nodes.`];
  },

  bytecode(r) {
    if (!r.bytecode) return ["; no bytecode. see the error in section 3.", ""];
    return [disassemble(r.bytecode), `${r.bytecode.code.length * 4} bytes.`];
  },

  analysis(r) {
    const lines = [];
    const row = (k, v) => lines.push(`  ${k.padEnd(34)} ${v}`);
    lines.push("bytecode verification");
    if (r.verify) {
      row("samples", r.verify.samples);
      row("maximum relative difference", r.verify.max);
      row("tolerance", verify_tolerance);
    } else row("status", "not run");
    lines.push("", "gradient check (dual numbers against finite differences)");
    if (r.gradient) {
      row("samples", r.gradient.samples);
      row("finite difference step", gradient_step);
      row("median error", r.gradient.median);
      row("maximum error", r.gradient.max);
      row("maximum gradient magnitude", r.gradient.max_norm);
    } else row("status", "not run");
    lines.push("", "surface localization (interval arithmetic octree)");
    if (r.bounds) {
      const b = r.bounds;
      row("region", `[-${b.extent}, ${b.extent}] on each axis`);
      row("time", b.time);
      row("depth", b.depth);
      row("cells evaluated", b.evaluated);
      row("cells culled, outside", b.culled_outside);
      row("cells culled, inside", b.culled_inside);
      row("leaf cells that may contain surface", `${b.surface_leaves} of ${b.total_leaves}`);
      row("fraction of volume excluded", (1 - b.surface_leaves / b.total_leaves).toFixed(4));
    } else row("status", "not run");
    return [lines.join("\n"), ""];
  },

  tokens(r) {
    if (!r.toks) return ["// lexical analysis failed.", ""];
    const text = r.toks.map(t => {
      const { line, col } = line_col(r.src, t.pos);
      const val = t.type === "sep" ? (t.value === "\n" ? "(newline)" : ";") : t.type === "eof" ? "" : String(t.value);
      return `${(line + ":" + col).padEnd(8)}${t.type.padEnd(5)} ${val}`;
    }).join("\n");
    return [text, `${r.toks.length} tokens.`];
  },
};

function render_output(r) {
  if (!r) return;
  const [text, meta] = output_views[output_view](r);
  out_el.textContent = text;
  out_meta.textContent = meta;
}

document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => {
  output_view = b.dataset.view;
  document.querySelectorAll(".tabs button").forEach(x => x.setAttribute("aria-selected", String(x === b)));
  render_output(last_result);
}));
