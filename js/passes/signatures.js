"use strict";
/* overload resolution for builtin calls. "g" is a generic parameter that
   must bind to one type (float, vec2 or vec3) across the whole signature. */

function resolve_signature(spec, arg_types) {
  for (const [params, ret] of spec.sigs) {
    if (params.length !== arg_types.length) continue;
    let generic = null, ok = true;
    for (let i = 0; i < params.length && ok; i++) {
      const want = params[i], got = arg_types[i];
      if (want === "g") {
        if (generic === null) generic = got;
        else if (generic !== got) ok = false;
      } else if (want !== got) {
        ok = false;
      }
    }
    if (ok) return ret === "g" ? generic : ret;
  }
  return null;
}

function describe_signatures(name, spec) {
  return spec.sigs
    .map(([params]) => `${name}(${params.map(x => x === "g" ? "t" : type_names[x]).join(", ")})`)
    .join(" or ");
}
