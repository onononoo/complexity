"use strict";
/* section 9: glsl, expression graph, hoisting, bytecode, binary, analysis, mesh and token views. */

const out_el = document.getElementById("out");
const out_meta = document.getElementById("outmeta");
let output_view = "glsl";

const output_views = {
  glsl(r) {
    if (!r.glsl) return ["// no shader. theres a error in section 3.", ""];
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
    if (!r.bytecode) return ["; no bytecode. theres a error in section 3.", ""];
    return [disassemble(r.bytecode), `${r.bytecode.count} instruction, ${r.bytecode.fused} of them is fused.`];
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

  binary(r) {
    if (!r.binary) return ["# no binary, compile didnt got that far.", ""];
    const crc = hex32(crc32(r.binary, 0, r.binary.length - 4));
    const head = [
      "# bytecode in the binary format (look in js/backend/serialize.js for the layout)",
      `# ${r.binary.length} byte, crc32 ${crc}, it was read back in and it matched`,
      "",
    ];
    return [head.join("\n") + hex_dump(r.binary, 400), `${r.binary.length} bytes.`];
  },

  hoist(r) {
    if (!r.hoist) return ["# no hoisting, compile didnt get this far.", ""];
    const lines = [
      "# values that only depend on t get computed on the cpu once a frame",
      "# and sent to the gpu as uniform, instead of per pixel",
      "",
    ];
    if (!r.hoist.slots.size) lines.push("# nothing to hoist here. the program dont use t in a way that can be moved.");
    for (const slot of r.hoist.slots.values()) {
      const n = r.g.nodes[slot.id];
      lines.push(`${slot.glsl.padEnd(12)} ${type_names[slot.type].padEnd(6)} %${slot.id}  ${describe_expression(r.g, n)}`);
      lines.push(`  bytecode: ${slot.program.count} instructions, ${slot.program.regs} registers`);
    }
    if (r.hoist.skipped) lines.push("", `# ${r.hoist.skipped} more could of been hoisted but the limit is ${hoist_limit} per type`);
    return [lines.join("\n"), `${r.hoist.slots.size} hoisted.`];
  },

  mesh(r) {
    if (!r.mesh) return ["# no mesh, compile didnt get this far.", ""];
    const m = r.mesh;
    const lines = [
      `# grid ${m.resolution}x${m.resolution}x${m.resolution} over [-${m.extent}, ${m.extent}], ${m.samples} samples, t = ${m.time.toFixed(2)}`,
      `# edges ${m.edge_count}, boundary edges ${m.boundary_edges}, non-manifold edges ${m.nonmanifold_edges}`,
      `# euler characteristic ${m.euler}${m.closed ? "" : " (mesh is open so this dont mean much)"}`,
      `# surface area ${m.area.toFixed(4)}`,
      `# refine moved vertex's so mean |f| went from ${m.refinement.mean_before.toExponential(2)} to ${m.refinement.mean_after.toExponential(2)}`,
      `# enclosed volume ${m.closed ? m.volume.toFixed(4) : "not meaningful, mesh is open"}`,
      "",
      mesh_to_obj(m, 20000),
    ];
    return [lines.join("\n"), `${m.vertex_count} vertices, ${m.triangle_count} triangles. copy it into a .obj file if u want it.`];
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

/* short readable form of a graph node, cut off when it gets too long. */
function describe_expression(g, n, budget = 80) {
  const walk = node => {
    if (node.op === "const") return glsl_literal(node.v);
    if (!node.args.length) return node.op;
    const args = node.args.map(id => walk(g.nodes[id]));
    if (node.op === "neg") return `-${args[0]}`;
    if (node.op[0] === ".") return `${args[0]}${node.op}`;
    if (node.op.startsWith("call:")) return `${node.op.slice(5)}(${args.join(", ")})`;
    return `(${args[0]} ${node.op} ${args[1]})`;
  };
  const s = walk(n);
  return s.length > budget ? s.slice(0, budget - 3) + "..." : s;
}
