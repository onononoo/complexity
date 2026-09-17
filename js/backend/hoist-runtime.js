"use strict";
/* evaluates hoisted values once per frame into flat float32 buffers laid out
   the way webgl expects for uniform1fv, uniform2fv and uniform3fv. */

function make_hoist_runtime(hoist) {
  const buffers = {
    f: new Float32Array(hoist.counts.f),
    v2: new Float32Array(hoist.counts.v2 * 2),
    v3: new Float32Array(hoist.counts.v3 * 3),
  };
  const entries = [...hoist.slots.values()].map(slot => ({
    slot,
    vm: new bytecode_vm(slot.program),
    width: type_width[slot.type],
  }));
  const scratch = new Float64Array(3);
  let last_time = NaN;

  return {
    counts: hoist.counts,
    buffers,
    size: entries.length,
    update(t) {
      if (t === last_time) return false;
      last_time = t;
      for (const e of entries) {
        e.vm.run_into(0, 0, 0, t, scratch);
        const buf = buffers[e.slot.type];
        for (let k = 0; k < e.width; k++) buf[e.slot.index * e.width + k] = scratch[k];
      }
      return true;
    },
  };
}
