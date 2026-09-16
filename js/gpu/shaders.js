"use strict";
/* GLSL source fragments. The generated `map` function is inserted between
   FRAG_HEAD and FRAG_TAIL. */

const FRAG_HEAD = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uT;
uniform vec3 uCam;
out vec4 fragColor;
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdBox(vec3 p, float b) { return sdBox(p, vec3(b)); }
float sdTorus(vec3 p, float R, float r) { return length(vec2(length(p.xz) - R, p.y)) - r; }
float sdCyl(vec3 p, float r, float h) { vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }
float sdPlane(vec3 p, float h) { return p.y + h; }
float sdGyroid(vec3 p, float s) { vec3 q = p * s; return dot(sin(q), cos(q.yzx)) / s; }
float opSmin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float opSmax(float a, float b, float k) { return -opSmin(-a, -b, k); }
float opShell(float d, float w) { return abs(d) - w; }
vec3 opRotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }
vec3 opRotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
vec3 opRotZ(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z); }
vec3 opRep(vec3 p, float s) { return p - s * floor(p / s + 0.5); }
vec3 opTwist(vec3 p, float k) { return opRotY(p, k * p.y); }
`;

const FRAG_TAIL = `
vec3 calcNormal(vec3 p) {
  const vec2 e = vec2(1.0, -1.0) * 0.0007;
  return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) + e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float cy = cos(uCam.x), sy = sin(uCam.x), cp = cos(uCam.y), sp = sin(uCam.y);
  vec3 ro = uCam.z * vec3(sy * cp, sp, cy * cp);
  vec3 ww = normalize(-ro), uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0))), vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.7 * ww);
  vec3 col = vec3(0.5);
  float d = 0.0;
  for (int i = 0; i < 160; i++) {
    float h = map(ro + rd * d);
    if (abs(h) < 0.0004 * max(d, 1.0)) {
      vec3 n = calcNormal(ro + rd * d);
      float lambert = max(dot(n, normalize(vec3(0.5, 0.8, 0.3))), 0.0);
      col = vec3(0.35 + 0.5 * lambert);
      break;
    }
    d += h * 0.85;
    if (d > 24.0) break;
  }
  fragColor = vec4(col, 1.0);
}
`;

const VERT = `#version 300 es
void main() {
  vec2 v = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(v * 2.0 - 1.0, 0.0, 1.0);
}`;
