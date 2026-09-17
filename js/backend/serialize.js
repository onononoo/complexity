"use strict";
/* binary bytecode format, version 1. all numbers are little endian.

     magic          4 bytes   "cxbc"
     version        u16       1
     stride         u16       instruction size in ints
     regs, root, root_width, count, reused, fused    u32 each
     kernel table   u32 count, then for each: u8 length + ascii name
     constants      u32 count, then for each: u32 register + f64 value
     code           u32 length (in ints), then i32 × length
     checksum       u32 crc-32 of every byte before it

   opcodes are stored as indices into the kernel table in the file, not the
   one in memory, so a reader with a reordered or extended kernel list can
   still load it. unknown kernel names are an error. */

const bytecode_magic = [0x63, 0x78, 0x62, 0x63];
const bytecode_version = 1;

class byte_writer {
  constructor() {
    this.buf = new ArrayBuffer(1024);
    this.view = new DataView(this.buf);
    this.len = 0;
  }
  reserve(n) {
    if (this.len + n <= this.buf.byteLength) return;
    const bigger = new ArrayBuffer(Math.max(this.buf.byteLength * 2, this.len + n));
    new Uint8Array(bigger).set(new Uint8Array(this.buf, 0, this.len));
    this.buf = bigger;
    this.view = new DataView(bigger);
  }
  u8(v) { this.reserve(1); this.view.setUint8(this.len, v); this.len += 1; }
  u16(v) { this.reserve(2); this.view.setUint16(this.len, v, true); this.len += 2; }
  u32(v) { this.reserve(4); this.view.setUint32(this.len, v >>> 0, true); this.len += 4; }
  i32(v) { this.reserve(4); this.view.setInt32(this.len, v, true); this.len += 4; }
  f64(v) { this.reserve(8); this.view.setFloat64(this.len, v, true); this.len += 8; }
  bytes() { return new Uint8Array(this.buf, 0, this.len); }
}

class byte_reader {
  constructor(bytes) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = 0;
  }
  need(n) {
    if (this.pos + n > this.bytes.length) throw new Error(`bytecode file ended early at byte ${this.pos}`);
  }
  u8() { this.need(1); return this.view.getUint8(this.pos++); }
  u16() { this.need(2); const v = this.view.getUint16(this.pos, true); this.pos += 2; return v; }
  u32() { this.need(4); const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
  i32() { this.need(4); const v = this.view.getInt32(this.pos, true); this.pos += 4; return v; }
  f64() { this.need(8); const v = this.view.getFloat64(this.pos, true); this.pos += 8; return v; }
}

function serialize_bytecode(prog) {
  const w = new byte_writer();
  for (const b of bytecode_magic) w.u8(b);
  w.u16(bytecode_version);
  w.u16(stride);
  for (const v of [prog.regs, prog.root, prog.root_width, prog.count, prog.reused, prog.fused || 0]) w.u32(v);

  // only the kernels this program uses go in the table.
  const local_index = new Map();
  const used = [];
  for (let pc = 0; pc < prog.code.length; pc += stride) {
    const op = prog.code[pc];
    if (!local_index.has(op)) { local_index.set(op, used.length); used.push(kernels[op].name); }
  }
  w.u32(used.length);
  for (const name of used) {
    w.u8(name.length);
    for (let i = 0; i < name.length; i++) w.u8(name.charCodeAt(i));
  }

  w.u32(prog.consts.length);
  for (const [reg, value] of prog.consts) { w.u32(reg); w.f64(value); }

  w.u32(prog.code.length);
  for (let i = 0; i < prog.code.length; i++) {
    w.i32(i % stride === 0 ? local_index.get(prog.code[i]) : prog.code[i]);
  }

  w.u32(crc32(w.bytes()));
  return w.bytes().slice();
}

function deserialize_bytecode(bytes) {
  if (bytes.length < 8) throw new Error("bytecode file is too short");
  const stored = new DataView(bytes.buffer, bytes.byteOffset + bytes.length - 4, 4).getUint32(0, true);
  const actual = crc32(bytes, 0, bytes.length - 4);
  if (stored !== actual) throw new Error(`checksum mismatch: file says ${hex32(stored)}, content is ${hex32(actual)}`);

  const r = new byte_reader(bytes.subarray(0, bytes.length - 4));
  for (const b of bytecode_magic) if (r.u8() !== b) throw new Error("not a complexity bytecode file");
  const version = r.u16();
  if (version !== bytecode_version) throw new Error(`unsupported bytecode version ${version}`);
  const file_stride = r.u16();
  if (file_stride !== stride) throw new Error(`instruction size ${file_stride} does not match ${stride}`);
  const [regs, root, root_width, count, reused, fused] = [r.u32(), r.u32(), r.u32(), r.u32(), r.u32(), r.u32()];

  const opcode_map = [];
  for (let i = 0, n = r.u32(); i < n; i++) {
    let name = "";
    for (let j = 0, len = r.u8(); j < len; j++) name += String.fromCharCode(r.u8());
    const kern = kernel_by_name.get(name);
    if (!kern) throw new Error(`unknown kernel “${name}”`);
    opcode_map.push(kern.code);
  }

  const consts = [];
  for (let i = 0, n = r.u32(); i < n; i++) consts.push([r.u32(), r.f64()]);

  const code_length = r.u32();
  if (code_length !== count * stride) throw new Error(`code length ${code_length} does not match ${count} instructions`);
  const code = new Int32Array(code_length);
  for (let i = 0; i < code_length; i++) {
    const v = r.i32();
    if (i % stride === 0) {
      if (v < 0 || v >= opcode_map.length) throw new Error(`bad opcode ${v} at instruction ${i / stride}`);
      code[i] = opcode_map[v];
    } else {
      code[i] = v;
    }
  }
  if (r.pos !== r.bytes.length) throw new Error(`${r.bytes.length - r.pos} extra bytes before the checksum`);

  return { code, regs, consts, root, root_width, count, reused, fused };
}

function programs_equal(a, b) {
  if (a.regs !== b.regs || a.root !== b.root || a.root_width !== b.root_width || a.count !== b.count) return false;
  if (a.code.length !== b.code.length || a.consts.length !== b.consts.length) return false;
  for (let i = 0; i < a.code.length; i++) if (a.code[i] !== b.code[i]) return false;
  for (let i = 0; i < a.consts.length; i++) {
    if (a.consts[i][0] !== b.consts[i][0] || !Object.is(a.consts[i][1], b.consts[i][1])) return false;
  }
  return true;
}

function hex_dump(bytes, max_rows) {
  const rows = [];
  for (let off = 0; off < bytes.length && rows.length < max_rows; off += 16) {
    const chunk = bytes.subarray(off, off + 16);
    const hex = Array.from(chunk, b => b.toString(16).padStart(2, "0"));
    const left = hex.slice(0, 8).join(" ").padEnd(23), right = hex.slice(8).join(" ").padEnd(23);
    const ascii = Array.from(chunk, b => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".")).join("");
    rows.push(`${off.toString(16).padStart(8, "0")}  ${left}  ${right}  |${ascii}|`);
  }
  if (bytes.length > max_rows * 16) rows.push(`... ${bytes.length - max_rows * 16} more bytes not showed`);
  return rows.join("\n");
}
