/**
 * Gauss's law surface integral check.
 * Computes ∮E·dA around a rectangular contour surrounding a charge
 * and compares with Q/ε₀ (using ε₀ = 1 in our normalized units).
 *
 * Returns the ratio (computed flux) / (expected Q/ε₀).
 * A ratio near 1.0 indicates good solver accuracy.
 */
export interface GaussCheckResult {
  chargeId: string;
  expectedFlux: number;  // Q/ε₀
  computedFlux: number;  // ∮E·dA
  ratio: number;         // computed/expected
  pass: boolean;         // |ratio - 1| < tolerance
}

export function performGaussCheck(
  potential: Float32Array,
  width: number,
  height: number,
  charges: Array<{ id: string; x: number; y: number; q: number }>,
  tolerance: number = 0.1,
): GaussCheckResult[] {
  const results: GaussCheckResult[] = [];

  for (const charge of charges) {
    // Build a rectangular contour 2 cells away from charge
    const margin = 2;
    const x0 = Math.max(1, Math.round(charge.x) - margin);
    const x1 = Math.min(width - 2, Math.round(charge.x) + margin);
    const y0 = Math.max(1, Math.round(charge.y) - margin);
    const y1 = Math.min(height - 2, Math.round(charge.y) + margin);

    if (x1 - x0 < 2 || y1 - y0 < 2) continue; // too close to boundary

    let flux = 0;

    // Top edge: E·n where n = (0, -1), so flux = -Ey along top
    for (let x = x0; x <= x1; x++) {
      const ey = -(potential[y0 * width + x] - potential[(y0 - 1) * width + x]);
      flux += -ey; // outward normal is -y
    }

    // Bottom edge: n = (0, +1), flux = +Ey along bottom
    for (let x = x0; x <= x1; x++) {
      const ey = -(potential[(y1 + 1) * width + x] - potential[y1 * width + x]);
      flux += ey; // outward normal is +y
    }

    // Left edge: n = (-1, 0), flux = -Ex along left
    for (let y = y0; y <= y1; y++) {
      const ex = -(potential[y * width + x0] - potential[y * width + (x0 - 1)]);
      flux += -ex; // outward normal is -x
    }

    // Right edge: n = (+1, 0), flux = +Ex along right
    for (let y = y0; y <= y1; y++) {
      const ex = -(potential[y * width + (x1 + 1)] - potential[y * width + x1]);
      flux += ex; // outward normal is +x
    }

    const expectedFlux = charge.q; // Q/ε₀ with ε₀ = 1
    const ratio = expectedFlux !== 0 ? flux / expectedFlux : (Math.abs(flux) < 1e-10 ? 1 : 0);
    const pass = Math.abs(ratio - 1) < tolerance;

    results.push({
      chargeId: charge.id,
      expectedFlux,
      computedFlux: flux,
      ratio,
      pass,
    });
  }

  return results;
}
