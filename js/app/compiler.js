"use strict";
/* The CPU side of the pipeline, free of any DOM access so it can run under
   Node for tests. Returns every intermediate product plus per-stage timing. */

const CPU_STAGES = ["lex", "parse", "elab", "opt", "emit", "bytecode", "verify", "gradient", "bounds"];

const COMPILER_DEFAULTS = {
  time: 0,
  verifySamples: 64,
  gradientSamples: 32,
  boundsDepth: 4,
  boundsExtent: 3,
  gradientWarning: 1.5,
};

function formatSmall(v) {
  return v === 0 ? "0" : v.toExponential(1);
}

function compileSource(src, options) {
  const opt = Object.assign({}, COMPILER_DEFAULTS, options);
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
    const ast = run("parse", () => parse(r.toks), v => `${countAst(v)} syntax tree nodes`);

    const el = run("elab", () => elaborate(ast), v => {
      const s = v.g.stats;
      return `${v.g.nodes.length} nodes; ${s.folded + s.simplified + s.reassociated} rewrites; ${s.shared} shared`;
    });
    r.g = el.g;
    r.root = el.root;
    r.warnings.push(...el.warnings);

    r.info = run("opt", () => analyze(r.g, r.root), v => `${v.reachable} live; ${v.dead} dead`);

    const glsl = run("emit", () => emitGlsl(r.g, r.root, r.info), v => `${v.src.split("\n").length} lines`);
    r.glsl = glsl.src;
    r.temps = glsl.temps;

    r.bytecode = run("bytecode", () => compileBytecode(r.g, r.root, r.info), v => `${v.count} instructions; ${v.regs} registers`);

    r.verify = run("verify", () => {
      const v = verifyBytecode(r.g, r.root, r.info, r.bytecode, opt.verifySamples);
      if (!v.ok) {
        const at = v.worst.map(n => n.toFixed(3)).join(", ");
        throw new CompileError(`Bytecode and reference evaluator differ by ${v.max} at (${at})`, null, 0, "verify");
      }
      return v;
    }, v => `${v.samples} samples; maximum difference ${formatSmall(v.max)}`);

    r.gradient = run("gradient", () => checkGradient(r.g, r.root, r.info, r.bytecode, opt.gradientSamples),
      v => `${v.samples} samples; median error ${formatSmall(v.median)}`);
    if (r.gradient.maxNorm > opt.gradientWarning) {
      r.warnings.push({
        msg: `The gradient magnitude reaches ${r.gradient.maxNorm.toFixed(2)}, which is above 1, so the renderer may miss thin features`,
        pos: null,
      });
    }

    r.bounds = run("bounds", () => localizeSurface(r.g, r.root, r.info, opt.time, opt.boundsDepth, opt.boundsExtent),
      v => `${v.surfaceLeaves} of ${v.totalLeaves} cells may contain the surface`);

    r.ok = true;
  } catch (e) {
    const stage = CPU_STAGES[r.stages.length];
    if (e instanceof CompileError) {
      r.error = e;
    } else {
      r.error = new CompileError("Internal compiler error: " + e.message, null, 0, stage);
      r.error.cause = e;
    }
  }
  return r;
}
