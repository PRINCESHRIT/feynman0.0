import { getColormapLUT } from './colormap';

/**
 * Render a potential field as a color-mapped heatmap using Canvas 2D.
 * Used as fallback / Phase 1 renderer before WebGL.
 */
export function renderHeatmap2D(
  ctx: CanvasRenderingContext2D,
  potential: Float32Array,
  gridWidth: number,
  gridHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  viewport: { offsetX: number; offsetY: number; scale: number },
): void {
  const lut = getColormapLUT();

  // Find min/max for normalization
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < potential.length; i++) {
    if (potential[i] < min) min = potential[i];
    if (potential[i] > max) max = potential[i];
  }

  // Symmetric range for diverging colormap
  const absMax = Math.max(Math.abs(min), Math.abs(max), 1e-10);
  const range = absMax * 2;

  const cellW = (canvasWidth / gridWidth) * viewport.scale;
  const cellH = (canvasHeight / gridHeight) * viewport.scale;

  const imageData = ctx.createImageData(canvasWidth, canvasHeight);
  const pixels = imageData.data;

  for (let py = 0; py < canvasHeight; py++) {
    for (let px = 0; px < canvasWidth; px++) {
      // Map pixel to grid coordinate
      const gx = ((px - viewport.offsetX) / viewport.scale) / (canvasWidth / gridWidth);
      const gy = ((py - viewport.offsetY) / viewport.scale) / (canvasHeight / gridHeight);

      const ix = Math.floor(gx);
      const iy = Math.floor(gy);

      if (ix < 0 || ix >= gridWidth || iy < 0 || iy >= gridHeight) {
        const pidx = (py * canvasWidth + px) * 4;
        pixels[pidx] = 26;     // bg color
        pixels[pidx + 1] = 26;
        pixels[pidx + 2] = 46;
        pixels[pidx + 3] = 255;
        continue;
      }

      const val = potential[iy * gridWidth + ix];
      const t = (val + absMax) / range; // normalize to 0..1
      const lutIdx = Math.max(0, Math.min(255, Math.round(t * 255)));

      const pidx = (py * canvasWidth + px) * 4;
      pixels[pidx] = lut[lutIdx * 3];
      pixels[pidx + 1] = lut[lutIdx * 3 + 1];
      pixels[pidx + 2] = lut[lutIdx * 3 + 2];
      pixels[pidx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}
