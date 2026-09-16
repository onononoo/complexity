"use strict";
/* Overload resolution for builtin calls. "G" is a generic parameter that
   must bind to one type (float, vec2 or vec3) across the whole signature. */

function resolveSignature(spec, argTypes) {
  for (const [params, ret] of spec.sigs) {
    if (params.length !== argTypes.length) continue;
    let generic = null, ok = true;
    for (let i = 0; i < params.length && ok; i++) {
      const want = params[i], got = argTypes[i];
      if (want === "G") {
        if (generic === null) generic = got;
        else if (generic !== got) ok = false;
      } else if (want !== got) {
        ok = false;
      }
    }
    if (ok) return ret === "G" ? generic : ret;
  }
  return null;
}

function describeSignatures(name, spec) {
  return spec.sigs
    .map(([params]) => `${name}(${params.map(x => x === "G" ? "T" : TN[x]).join(", ")})`)
    .join(" or ");
}
