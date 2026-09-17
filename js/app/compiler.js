"use strict";
/* the cpu side of the pipeline, free of any dom access so it can run under
   node for tests. returns every intermediate product plus per-stage timing. */

const cpu_stages = ["lex", "parse", "elab", "opt", "hoist", "emit", "bytecode", "serialize", "verify", "gradient", "bounds", "mesh", "refine"];

const compiler_defaults = {
  time: 0,
  verify_samples: 64,
  gradient_samples: 32,
  bounds_depth: 4,
  bounds_extent: 3,
  gradient_warning: 1.5,
  mesh_resolution: 24,
  mesh_extent: 3,
  refine_iterations: 4,
};

function format_small(v) {
  return v === 0 ? "0" : v.toExponential(1);
}

function compile_source(src, options) {
  const opt = Object.assign({}, compiler_defaults, options);
  const now = () => performance.now();
  const r = { src, stages: [], warnings: [], error: null, ok: false };

  const run = (name, fn, describe) => {
    const t0 = now();
    const value = fn();
    r.stages.push({ name, metric: describe(value), ms: now() - t0 });
    return value;
  };

  try {
    r.toks = run("lex", () => lex(src), v => `${v.length - 1} tokens`);
    const ast = run("parse", () => parse(r.toks), v => `${count_ast(v)} syntax tree nodes`);

    const el = run("elab", () => elaborate(ast), v => {
      const s = v.g.stats;
      return `${v.g.nodes.length} nodes; ${s.folded + s.simplified + s.reassociated} rewrites; ${s.shared} shared`;
    });
    r.g = el.g;
    r.root = el.root;
    r.warnings.push(...el.warnings);

    r.info = run("opt", () => analyze(r.g, r.root), v => `${v.reachable} live; ${v.dead} dead`);

    r.hoist = run("hoist", () => hoist_time_invariants(r.g, r.root, r.info), v => `${v.slots.size} values moved to per-frame uniforms`);

    const glsl = run("emit", () => emit_glsl(r.g, r.root, r.info, r.hoist), v => `${v.src.split("\n").length} lines`);
    r.glsl = glsl.src;
    r.temps = glsl.temps;

    r.bytecode = run("bytecode", () => compile_bytecode(r.g, r.root, r.info), v => `${v.count} instructions; ${v.regs} registers; ${v.fused} fused`);

    r.binary = run("serialize", () => {
      const bytes = serialize_bytecode(r.bytecode);
      if (!programs_equal(deserialize_bytecode(bytes), r.bytecode)) {
        throw new compile_error("bytecode did not survive a round trip through the binary format", null, 0, "serialize");
      }
      return bytes;
    }, v => `${v.length} bytes; crc32 ${hex32(crc32(v, 0, v.length - 4))}`);

    r.verify = run("verify", () => {
      const v = verify_bytecode(r.g, r.root, r.info, r.bytecode, opt.verify_samples);
      if (!v.ok) {
        const at = v.worst.map(n => n.toFixed(3)).join(", ");
        throw new compile_error(`bytecode and reference evaluator differ by ${v.max} at (${at})`, null, 0, "verify");
      }
      return v;
    }, v => `${v.samples} samples; maximum difference ${format_small(v.max)}`);

    r.gradient = run("gradient", () => check_gradient(r.g, r.root, r.info, r.bytecode, opt.gradient_samples),
      v => `${v.samples} samples; median error ${format_small(v.median)}`);
    if (r.gradient.max_norm > opt.gradient_warning) {
      r.warnings.push({
        msg: `the gradient magnitude reaches ${r.gradient.max_norm.toFixed(2)}, which is above 1, so the renderer may miss thin features`,
        pos: null,
      });
    }

    r.bounds = run("bounds", () => localize_surface(r.g, r.root, r.info, opt.time, opt.bounds_depth, opt.bounds_extent),
      v => `${v.surface_leaves} of ${v.total_leaves} cells may contain the surface`);

    r.mesh = run("mesh", () => extract_mesh(r.bytecode, opt.time, opt.mesh_resolution, opt.mesh_extent),
      v => `${v.vertex_count} vertices; ${v.triangle_count} triangles; euler ${v.euler}`);
    r.mesh_raw = r.mesh;

    r.mesh = run("refine", () => refine_mesh(r.g, r.root, r.info, r.mesh_raw, opt.time, opt.refine_iterations),
      v => `mean |f| ${format_small(v.refinement.mean_before)} → ${format_small(v.refinement.mean_after)}`);

    r.ok = true;
  } catch (e) {
    const stage = cpu_stages[r.stages.length];
    if (e instanceof compile_error) {
      r.error = e;
    } else {
      r.error = new compile_error("internal compiler error: " + e.message, null, 0, stage);
      r.error.cause = e;
    }
  }
  return r;
}
