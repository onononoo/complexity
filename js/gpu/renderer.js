"use strict";
/* WebGL2 program management and drawing. A failed link keeps the previous
   program running. */

const canvas = document.getElementById("view");
const gl = canvas.getContext("webgl2", { antialias: false, powerPreference: "high-performance" });
let glProgram = null, glUniforms = null, glVertShader = null;

if (gl) {
  gl.bindVertexArray(gl.createVertexArray());
  glVertShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(glVertShader, VERT);
  gl.compileShader(glVertShader);
} else {
  document.getElementById("glfail").hidden = false;
}

function linkProgram(mapSrc) {
  if (!gl) throw new CompileError("WebGL2 is not available, so the shader cannot be linked", null, 0, "gpu");
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, FRAG_HEAD + mapSrc + FRAG_TAIL);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    const log = (gl.getShaderInfoLog(fs) || "").trim();
    gl.deleteShader(fs);
    const offset = FRAG_HEAD.split("\n").length - 1;
    const pretty = log.replace(/ERROR: 0:(\d+):/g, (_, ln) => `map() line ${Math.max(1, ln - offset)}:`);
    throw new CompileError("The GPU rejected the generated shader. " + pretty.split("\n")[0], null, 0, "gpu");
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, glVertShader);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new CompileError("Shader linking failed: " + log, null, 0, "gpu");
  }
  if (glProgram) gl.deleteProgram(glProgram);
  glProgram = prog;
  glUniforms = {
    res: gl.getUniformLocation(prog, "uRes"),
    t: gl.getUniformLocation(prog, "uT"),
    cam: gl.getUniformLocation(prog, "uCam"),
  };
}

function drawFrame(cam, time, scale) {
  if (!gl || !glProgram) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr * scale));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr * scale));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  gl.viewport(0, 0, w, h);
  gl.useProgram(glProgram);
  gl.uniform2f(glUniforms.res, w, h);
  gl.uniform1f(glUniforms.t, time);
  gl.uniform3f(glUniforms.cam, cam.yaw, cam.pitch, cam.dist);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
