/**
 * Compute E-field from potential via central differences: E = -∇V
 */
export interface FieldVectorData {
  ex: Float32Array;
  ey: Float32Array;
  width: number;
  height: number;
}

export function computeFieldVectors(
  potential: Float32Array,
  width: number,
  height: number,
): FieldVectorData {
  const ex = new Float32Array(width * height);
  const ey = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      // E = -∇V, central differences with h=1
      ex[idx] = -(potential[idx + 1] - potential[idx - 1]) / 2;
      ey[idx] = -(potential[(y + 1) * width + x] - potential[(y - 1) * width + x]) / 2;
    }
  }

  // Forward/backward differences at boundaries
  for (let y = 0; y < height; y++) {
    ex[y * width] = -(potential[y * width + 1] - potential[y * width]);
    ex[y * width + width - 1] = -(potential[y * width + width - 1] - potential[y * width + width - 2]);
  }
  for (let x = 0; x < width; x++) {
    ey[x] = -(potential[width + x] - potential[x]);
    ey[(height - 1) * width + x] = -(potential[(height - 1) * width + x] - potential[(height - 2) * width + x]);
  }

  return { ex, ey, width, height };
}
