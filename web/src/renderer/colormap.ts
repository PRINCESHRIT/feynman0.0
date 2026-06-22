/**
 * Coolwarm diverging colormap (256 entries).
 * Blue (negative) → White (zero) → Red (positive).
 */

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

const LUT_SIZE = 256;
let lut: Uint8Array | null = null;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function buildLUT(): Uint8Array {
  const buf = new Uint8Array(LUT_SIZE * 3);

  // Control points: blue → white → red
  const blue = { r: 59, g: 76, b: 192 };
  const white = { r: 221, g: 221, b: 221 };
  const red = { r: 180, g: 4, b: 38 };

  for (let i = 0; i < LUT_SIZE; i++) {
    const t = i / (LUT_SIZE - 1); // 0..1
    let r: number, g: number, b: number;

    if (t < 0.5) {
      const s = t * 2; // 0..1 over blue→white
      r = lerp(blue.r, white.r, s);
      g = lerp(blue.g, white.g, s);
      b = lerp(blue.b, white.b, s);
    } else {
      const s = (t - 0.5) * 2; // 0..1 over white→red
      r = lerp(white.r, red.r, s);
      g = lerp(white.g, red.g, s);
      b = lerp(white.b, red.b, s);
    }

    buf[i * 3] = Math.round(r);
    buf[i * 3 + 1] = Math.round(g);
    buf[i * 3 + 2] = Math.round(b);
  }

  return buf;
}

export function getColormapLUT(): Uint8Array {
  if (!lut) lut = buildLUT();
  return lut;
}

/**
 * Map a normalized value (0..1) to an RGB color string.
 */
export function colormapToCSS(t: number): string {
  const lut = getColormapLUT();
  const idx = Math.max(0, Math.min(LUT_SIZE - 1, Math.round(t * (LUT_SIZE - 1))));
  const r = lut[idx * 3];
  const g = lut[idx * 3 + 1];
  const b = lut[idx * 3 + 2];
  return `rgb(${r},${g},${b})`;
}

/**
 * Build a 256×1 RGBA Uint8Array for use as a WebGL colormap texture.
 */
export function getColormapRGBA(): Uint8Array {
  const rgb = getColormapLUT();
  const rgba = new Uint8Array(LUT_SIZE * 4);
  for (let i = 0; i < LUT_SIZE; i++) {
    rgba[i * 4] = rgb[i * 3];
    rgba[i * 4 + 1] = rgb[i * 3 + 1];
    rgba[i * 4 + 2] = rgb[i * 3 + 2];
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}
