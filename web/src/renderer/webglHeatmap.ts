import { getColormapRGBA } from './colormap';

import vertSrc from './shaders/heatmap.vert.glsl?raw';
import fragSrc from './shaders/heatmap.frag.glsl?raw';

export class WebGLHeatmapRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private potentialTex: WebGLTexture;
  private colormapTex: WebGLTexture;
  private vao: WebGLVertexArrayObject;

  // Uniform locations
  private uTransform: WebGLUniformLocation;
  private uMinVal: WebGLUniformLocation;
  private uMaxVal: WebGLUniformLocation;
  private uPotential: WebGLUniformLocation;
  private uColormap: WebGLUniformLocation;

  private gridWidth = 0;
  private gridHeight = 0;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { alpha: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;

    // Compile shaders
    const vs = this.compileShader(gl.VERTEX_SHADER, vertSrc);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fragSrc);
    this.program = this.createProgram(vs, fs);

    // Get uniform locations
    this.uTransform = gl.getUniformLocation(this.program, 'u_transform')!;
    this.uMinVal = gl.getUniformLocation(this.program, 'u_minVal')!;
    this.uMaxVal = gl.getUniformLocation(this.program, 'u_maxVal')!;
    this.uPotential = gl.getUniformLocation(this.program, 'u_potential')!;
    this.uColormap = gl.getUniformLocation(this.program, 'u_colormap')!;

    // Full-screen quad VAO
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const posBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // Create textures
    this.potentialTex = gl.createTexture()!;
    this.colormapTex = gl.createTexture()!;

    // Upload colormap texture (256x1 RGBA)
    gl.bindTexture(gl.TEXTURE_2D, this.colormapTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, getColormapRGBA());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Init potential texture
    gl.bindTexture(gl.TEXTURE_2D, this.potentialTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  updatePotential(potential: Float32Array, width: number, height: number): void {
    const gl = this.gl;
    this.gridWidth = width;
    this.gridHeight = height;

    gl.bindTexture(gl.TEXTURE_2D, this.potentialTex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.R32F,
      width, height, 0,
      gl.RED, gl.FLOAT,
      potential,
    );
  }

  render(viewport: { offsetX: number; offsetY: number; scale: number }): void {
    const gl = this.gl;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.1, 0.1, 0.18, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (this.gridWidth === 0) return;

    gl.useProgram(this.program);

    // Identity transform for now (full-screen quad)
    const transform = new Float32Array([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ]);
    gl.uniformMatrix3fv(this.uTransform, false, transform);

    // Compute min/max from texture (cached from updatePotential would be better)
    // For now pass reasonable defaults
    gl.uniform1f(this.uMinVal, -1.0);
    gl.uniform1f(this.uMaxVal, 1.0);

    // Bind textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.potentialTex);
    gl.uniform1i(this.uPotential, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.colormapTex);
    gl.uniform1i(this.uColormap, 1);

    // Draw
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  setMinMax(min: number, max: number): void {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniform1f(this.uMinVal, min);
    gl.uniform1f(this.uMaxVal, max);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteTexture(this.potentialTex);
    gl.deleteTexture(this.colormapTex);
    gl.deleteProgram(this.program);
  }

  private compileShader(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${info}`);
    }
    return shader;
  }

  private createProgram(vs: WebGLShader, fs: WebGLShader): WebGLProgram {
    const gl = this.gl;
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program link error: ${info}`);
    }
    return program;
  }
}
