/**
 * Compute the difference between two potential fields.
 * Supports cross-resolution comparison via bilinear interpolation.
 */

export interface DiffResult {
  deltaV: Float32Array;
  width: number;
  height: number;
  maxDelta: number;
  maxDeltaX: number;
  maxDeltaY: number;
  rmsDelta: number;
  isResampled: boolean; // true if bilinear interpolation was used
}

/**
 * Bilinear interpolation sample from a potential field.
 */
function bilinearSample(
  data: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const fx = x - x0;
  const fy = y - y0;

  const v00 = data[y0 * width + x0];
  const v10 = data[y0 * width + x1];
  const v01 = data[y1 * width + x0];
  const v11 = data[y1 * width + x1];

  return (
    v00 * (1 - fx) * (1 - fy) +
    v10 * fx * (1 - fy) +
    v01 * (1 - fx) * fy +
    v11 * fx * fy
  );
}

/**
 * Compute ΔV = potentialA - potentialB.
 * If resolutions differ, resamples B to match A's resolution using bilinear interpolation.
 */
export function computeDiff(
  potentialA: Float32Array,
  widthA: number,
  heightA: number,
  potentialB: Float32Array,
  widthB: number,
  heightB: number,
): DiffResult {
  const isResampled = widthA !== widthB || heightA !== heightB;
  const outWidth = widthA;
  const outHeight = heightA;
  const deltaV = new Float32Array(outWidth * outHeight);

  let maxDelta = 0;
  let maxDeltaX = 0;
  let maxDeltaY = 0;
  let sumSq = 0;

  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x++) {
      const va = potentialA[y * outWidth + x];

      let vb: number;
      if (isResampled) {
        // Map A's coordinates to B's coordinate space
        const bx = (x / (outWidth - 1)) * (widthB - 1);
        const by = (y / (outHeight - 1)) * (heightB - 1);
        vb = bilinearSample(potentialB, widthB, heightB, bx, by);
      } else {
        vb = potentialB[y * outWidth + x];
      }

      const delta = va - vb;
      deltaV[y * outWidth + x] = delta;

      const absDelta = Math.abs(delta);
      if (absDelta > maxDelta) {
        maxDelta = absDelta;
        maxDeltaX = x;
        maxDeltaY = y;
      }
      sumSq += delta * delta;
    }
  }

  return {
    deltaV,
    width: outWidth,
    height: outHeight,
    maxDelta,
    maxDeltaX,
    maxDeltaY,
    rmsDelta: Math.sqrt(sumSq / (outWidth * outHeight)),
    isResampled,
  };
}
