"use strict";

test("crc32: matches the standard check value", () => {
  const bytes = Uint8Array.from("123456789", ch => ch.charCodeAt(0));
  assert_equal(crc32(bytes), 0xcbf43926);
});

test("serialize: every example round trips exactly", () => {
  for (const preset of presets) {
    const prog = compile_source(preset.src).bytecode;
    const back = deserialize_bytecode(serialize_bytecode(prog));
    assert(programs_equal(prog, back), preset.name);
  }
});

test("serialize: file starts with the magic bytes", () => {
  const bytes = serialize_bytecode(compile_source("sphere(p, 1.0)").bytecode);
  assert_equal(String.fromCharCode(...bytes.subarray(0, 4)), "cxbc");
});

test("serialize: a flipped bit fails the checksum", () => {
  const bytes = serialize_bytecode(compile_source("sphere(p, 1.0) | plane(p, 1.0)").bytecode);
  bytes[20] ^= 0x10;
  assert_throws(() => deserialize_bytecode(bytes), /checksum mismatch/);
});

test("serialize: truncated files are rejected", () => {
  const bytes = serialize_bytecode(compile_source("sphere(p, 1.0)").bytecode);
  assert_throws(() => deserialize_bytecode(bytes.subarray(0, 6)), /too short|checksum/);
});

test("serialize: opcodes are remapped by kernel name", () => {
  const prog = compile_source("sin(p.x) + cos(p.y)").bytecode;
  const bytes = serialize_bytecode(prog);
  // the file only lists kernels the program uses, so its opcode numbers are small.
  const back = deserialize_bytecode(bytes);
  const vm_a = new bytecode_vm(prog), vm_b = new bytecode_vm(back);
  assert_equal(vm_a.run(0.3, 0.7, 0, 0), vm_b.run(0.3, 0.7, 0, 0));
});

test("serialize: unknown kernel names are an error", () => {
  const bytes = serialize_bytecode(compile_source("sin(p.x)").bytecode);
  const text = Array.from(bytes, b => String.fromCharCode(b)).join("");
  const at = text.indexOf("sin");
  bytes[at] = "z".charCodeAt(0);
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  view.setUint32(bytes.length - 4, crc32(bytes, 0, bytes.length - 4), true);
  assert_throws(() => deserialize_bytecode(bytes), /unknown kernel “zin”/);
});

test("serialize: hex dump shows offsets and ascii", () => {
  const dump = hex_dump(serialize_bytecode(compile_source("sphere(p, 1.0)").bytecode), 4);
  assert(dump.startsWith("00000000  63 78 62 63"), dump);
  assert(dump.includes("|cxbc"), dump);
});
