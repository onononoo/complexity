"use strict";
/* Register virtual machine for programs produced by compileBytecode. */

class VM {
  constructor(prog) {
    this.prog = prog;
    this.mem = new Float64Array(Math.max(2, prog.regs) * 3);
    for (const [r, v] of prog.consts) this.mem[r * 3] = v;
    this.out = new Float64Array(3);
    this.reg = new Int32Array(3);
    this.wid = new Int32Array(3);
    this.evaluations = 0;
    const mem = this.mem, reg = this.reg, wid = this.wid;
    this.read = (i, k) => mem[reg[i] * 3 + (wid[i] === 1 ? 0 : k)];
  }

  run(x, y, z, t) {
    const code = this.prog.code, mem = this.mem, out = this.out;
    mem[0] = x; mem[1] = y; mem[2] = z; mem[3] = t;
    for (let pc = 0; pc < code.length; pc += STRIDE) {
      const argc = code[pc + 3];
      for (let i = 0; i < argc; i++) {
        this.reg[i] = code[pc + 4 + 2 * i];
        this.wid[i] = code[pc + 5 + 2 * i];
      }
      const dst = code[pc + 1] * 3, dw = code[pc + 2];
      applyKernel(KERNELS[code[pc]], dw, argc, this.read, this.wid, code[pc + 10], out);
      for (let k = 0; k < dw; k++) mem[dst + k] = out[k];
    }
    this.evaluations++;
    return mem[this.prog.root * 3];
  }
}
