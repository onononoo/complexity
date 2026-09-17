"use strict";
/* webgl2 program management and drawing. a failed link keeps the previous
   program and its hoisted uniforms running. */

const canvas = document.getElementById("view");
const gl = canvas.getContext("webgl2", { antialias: false, powerPreference: "high-performance" });
let gl_program = null, gl_uniforms = null, gl_vert_shader = null, gl_hoist = null;

if (gl) {
  gl.bindVertexArray(gl.createVertexArray());
  gl_vert_shader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(gl_vert_shader, vert);
  gl.compileShader(gl_vert_shader);
} else {
  document.getElementById("glfail").hidden = false;
}

function link_program(map_src, hoist_runtime) {
  if (!gl) throw new compile_error("webgl2 is not available, so the shader cannot be linked", null, 0, "gpu");
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, frag_head + map_src + frag_tail);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    const log = (gl.getShaderInfoLog(fs) || "").trim();
    gl.deleteShader(fs);
    const offset = frag_head.split("\n").length - 1;
    const pretty = log.replace(/error: 0:(\d+):/gi, (_, ln) => `map() line ${Math.max(1, ln - offset)}:`);
    throw new compile_error("the gpu rejected the generated shader. " + pretty.split("\n")[0], null, 0, "gpu");
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, gl_vert_shader);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new compile_error("shader linking failed: " + log, null, 0, "gpu");
  }
  if (gl_program) gl.deleteProgram(gl_program);
  gl_program = prog;
  gl_hoist = hoist_runtime;
  gl_uniforms = {
    res: gl.getUniformLocation(prog, "ures"),
    t: gl.getUniformLocation(prog, "ut"),
    cam: gl.getUniformLocation(prog, "ucam"),
    hf: gl.getUniformLocation(prog, "u_hf"),
    hv2: gl.getUniformLocation(prog, "u_hv2"),
    hv3: gl.getUniformLocation(prog, "u_hv3"),
  };
}

function upload_hoisted(time) {
  if (!gl_hoist || gl_hoist.size === 0) return;
  gl_hoist.update(time);
  const { counts, buffers } = gl_hoist;
  // an unused array can be optimised out of the shader, leaving a null location.
  if (counts.f && gl_uniforms.hf) gl.uniform1fv(gl_uniforms.hf, buffers.f);
  if (counts.v2 && gl_uniforms.hv2) gl.uniform2fv(gl_uniforms.hv2, buffers.v2);
  if (counts.v3 && gl_uniforms.hv3) gl.uniform3fv(gl_uniforms.hv3, buffers.v3);
}

function draw_frame(cam, time, scale) {
  if (!gl || !gl_program) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr * scale));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr * scale));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  gl.viewport(0, 0, w, h);
  gl.useProgram(gl_program);
  gl.uniform2f(gl_uniforms.res, w, h);
  gl.uniform1f(gl_uniforms.t, time);
  gl.uniform3f(gl_uniforms.cam, cam.yaw, cam.pitch, cam.dist);
  upload_hoisted(time);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
