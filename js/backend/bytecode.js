"use strict";
/* stage 6: dag → register bytecode.

   each register holds up to three float components. register 0 is p,
   register 1 is t, then one register per constant (pinned). computed
   values get registers from a free list: a register is released at the
   last instruction that reads it, so later values can reuse it.

   instruction layout (stride ints):
     [opcode, dst, dstwidth, argc, r0, w0, r1, w1, r2, w2, extra]

   fusion: a "*" node that is read by exactly one "+" node gets folded into
   that addition as one muladd(a, b, c) = a * b + c instruction. the "*"
   node never gets an instruction or a register of its own. */

const stride = 11;

function compile_bytecode(g, root, info, options) {
  const fuse = !options || options.fuse !== false;
  const reg_of = new Int32Array(g.nodes.length).fill(-1);
  const consts = [];
  let next_reg = 2;

  for (const n of g.nodes) {
    if (!info.seen[n.id]) continue;
    if (n.op === "p") reg_of[n.id] = 0;
    else if (n.op === "t") reg_of[n.id] = 1;
    else if (n.op === "const") { reg_of[n.id] = next_reg; consts.push([next_reg, n.v]); next_reg++; }
  }
  const pinned = next_reg;

  const candidates = g.nodes.filter(n => info.seen[n.id] && n.args.length);
  const absorbed = new Uint8Array(g.nodes.length);
  const fused_args = new Map();
  if (fuse) {
    for (const n of candidates) {
      if (n.op !== "+") continue;
      for (let j = 0; j < 2; j++) {
        const m = g.nodes[n.args[j]];
        if (m.op !== "*" || info.refs[m.id] !== 1 || m.id === root.id || absorbed[m.id]) continue;
        absorbed[m.id] = 1;
        fused_args.set(n.id, [m.args[0], m.args[1], n.args[1 - j]]);
        break;
      }
    }
  }
  const order = candidates.filter(n => !absorbed[n.id]);
  const args_of = n => fused_args.get(n.id) || n.args;
  const last_use = new Int32Array(g.nodes.length).fill(-1);
  order.forEach((n, i) => { for (const c of args_of(n)) last_use[c] = i; });

  const code = new Int32Array(order.length * stride);
  const free = [];
  let reused = 0;

  order.forEach((n, i) => {
    const args = args_of(n);
    const kern = fused_args.has(n.id) ? kernel_by_name.get("muladd") : kernel_for(n);
    if (!kern) throw new compile_error(`no cpu kernel exists for “${n.op}”`, null, 0, "bytecode");
    const base = i * stride;
    code[base] = kern.code;
    code[base + 2] = type_width[n.type];
    code[base + 3] = args.length;
    args.forEach((c, j) => {
      code[base + 4 + 2 * j] = reg_of[c];
      code[base + 5 + 2 * j] = type_width[g.nodes[c].type];
    });
    if (n.op[0] === ".") code[base + 10] = pack_swizzle(n.op);

    for (const c of new Set(args)) {
      if (last_use[c] === i && reg_of[c] >= pinned) free.push(reg_of[c]);
    }
    let dst;
    if (free.length) { dst = free.pop(); reused++; }
    else dst = next_reg++;
    reg_of[n.id] = dst;
    code[base + 1] = dst;
  });

  return {
    code,
    regs: next_reg,
    consts,
    root: reg_of[root.id],
    root_width: type_width[root.type],
    count: order.length,
    reused,
    fused: fused_args.size,
  };
}

function disassemble(prog) {
  const ty = ["", "f", "v2", "v3"];
  const reg_name = (r, w) => `r${r}:${ty[w]}`;
  const out = [
    `; ${prog.count} instructions, ${prog.regs} registers, ${prog.reused} register reuses, ${prog.fused || 0} fused`,
    "; r0 = p (vec3), r1 = t (float)",
  ];
  for (const [r, v] of prog.consts) out.push(`; r${r} = ${v}`);
  out.push("");
  for (let pc = 0, i = 0; pc < prog.code.length; pc += stride, i++) {
    const c = prog.code;
    const kern = kernels[c[pc]];
    const args = [];
    for (let j = 0; j < c[pc + 3]; j++) args.push(reg_name(c[pc + 4 + 2 * j], c[pc + 5 + 2 * j]));
    let name = kern.name;
    if (kern.kind === "swz") {
      let f = ".";
      for (let k = 0; k < c[pc + 2]; k++) f += "xyz"[(c[pc + 10] >> (2 * k)) & 3];
      name += f;
    }
    out.push(`${String(i).padStart(4, "0")}  ${name.padEnd(12)} ${reg_name(c[pc + 1], c[pc + 2]).padEnd(8)} <- ${args.join(", ")}`);
  }
  out.push(`      ret          r${prog.root}`);
  return out.join("\n");
}
