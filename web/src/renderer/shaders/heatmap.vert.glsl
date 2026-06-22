attribute vec2 a_position;
varying vec2 v_texCoord;

uniform mat3 u_transform;

void main() {
  vec3 transformed = u_transform * vec3(a_position, 1.0);
  gl_Position = vec4(transformed.xy, 0.0, 1.0);
  // Map position to texture coordinates (0..1)
  v_texCoord = a_position * 0.5 + 0.5;
}
