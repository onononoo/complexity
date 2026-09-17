"use strict";
/* crc-32 (ieee 802.3, reflected polynomial 0xedb88320), table driven. */

const crc32_table = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes, start, end) {
  let c = 0xffffffff;
  for (let i = start || 0, n = end === undefined ? bytes.length : end; i < n; i++) {
    c = crc32_table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function hex32(v) {
  return "0x" + (v >>> 0).toString(16).padStart(8, "0");
}
