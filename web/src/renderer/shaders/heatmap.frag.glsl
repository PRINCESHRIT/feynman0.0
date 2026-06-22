precision mediump float;

varying vec2 v_texCoord;

uniform sampler2D u_potential;
uniform sampler2D u_colormap;
uniform float u_minVal;
uniform float u_maxVal;

void main() {
  float val = texture2D(u_potential, v_texCoord).r;

  // Normalize to 0..1 using symmetric range
  float range = max(abs(u_minVal), abs(u_maxVal));
  range = max(range, 0.0001);
  float t = (val + range) / (2.0 * range);
  t = clamp(t, 0.0, 1.0);

  // Lookup colormap (1D texture, sample along x)
  gl_FragColor = texture2D(u_colormap, vec2(t, 0.5));
}
