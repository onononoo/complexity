"use strict";
/* Stage 6: DAG → register bytecode.

   Each register holds up to three float components. Register 0 is p,
   register 1 is t, then one register per constant (pinned). Computed
   values get registers from a free list: a register is released at the
   last instruction that reads it, so later values can reuse it.

   Instruction layout (STRIDE ints):
     [opcode, dst, dstWidth, argc, r0, w0, r1, w1, r2, w2, extra] */

const STRIDE = 11;

function compileBytecode(g, root, info) {
  const regOf = new Int32Array(g.nodes.length).fill(-1);
  const consts = [];
  let nextReg = 2;

  for (const n of g.nodes) {
    if (!info.seen[n.id]) continue;
    if (n.op === "p") regOf[n.id] = 0;
    else if (n.op === "t") regOf[n.id] = 1;
    else if (n.op === "const") { regOf[n.id] = nextReg; consts.push([nextReg, n.v]); nextReg++; }
  }
  const pinned = nextReg;

  const order = g.nodes.filter(n => info.seen[n.id] && n.args.length);
  const lastUse = new Int32Array(g.nodes.length).fill(-1);
  order.forEach((n, i) => { for (const c of n.args) lastUse[c] = i; });

  const code = new Int32Array(order.length * STRIDE);
  const free = [];
  let reused = 0;

  order.forEach((n, i) => {
    const K = kernelFor(n);
    if (!K) throw new CompileError(`No CPU kernel exists for “${n.op}”`, null, 0, "bytecode");
    const base = i * STRIDE;
    code[base] = K.code;
    code[base + 2] = WIDTH[n.type];
    code[base + 3] = n.args.length;
    n.args.forEach((c, j) => {
      code[base + 4 + 2 * j] = regOf[c];
      code[base + 5 + 2 * j] = WIDTH[g.nodes[c].type];
    });
    if (n.op[0] === ".") code[base + 10] = packSwizzle(n.op);

    for (const c of new Set(n.args)) {
      if (lastUse[c] === i && regOf[c] >= pinned) free.push(regOf[c]);
    }
    let dst;
    if (free.length) { dst = free.pop(); reused++; }
    else dst = nextReg++;
    regOf[n.id] = dst;
    code[base + 1] = dst;
  });

  return {
    code,
    regs: nextReg,
    consts,
    root: regOf[root.id],
    count: order.length,
    reused,
  };
}

function disassemble(prog) {
  const ty = ["", "f", "v2", "v3"];
  const R = (r, w) => `r${r}:${ty[w]}`;
  const out = [
    `; ${prog.count} instructions, ${prog.regs} registers, ${prog.reused} register reuses`,
    "; r0 = p (vec3), r1 = t (float)",
  ];
  for (const [r, v] of prog.consts) out.push(`; r${r} = ${v}`);
  out.push("");
  for (let pc = 0, i = 0; pc < prog.code.length; pc += STRIDE, i++) {
    const c = prog.code;
    const K = KERNELS[c[pc]];
    const args = [];
    for (let j = 0; j < c[pc + 3]; j++) args.push(R(c[pc + 4 + 2 * j], c[pc + 5 + 2 * j]));
    let name = K.name;
    if (K.kind === "swz") {
      let f = ".";
      for (let k = 0; k < c[pc + 2]; k++) f += "xyz"[(c[pc + 10] >> (2 * k)) & 3];
      name += f;
    }
    out.push(`${String(i).padStart(4, "0")}  ${name.padEnd(12)} ${R(c[pc + 1], c[pc + 2]).padEnd(8)} <- ${args.join(", ")}`);
  }
  out.push(`      ret          r${prog.root}`);
  return out.join("\n");
}
