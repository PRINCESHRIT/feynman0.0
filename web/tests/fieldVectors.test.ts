import { describe, it, expect } from 'vitest';
import { computeFieldVectors } from '../src/solver/fieldVectors';

describe('Field vector computation', () => {
  it('constant gradient → constant E field', () => {
    // V(x,y) = x (linear gradient), so E = -dV/dx = -1, dV/dy = 0
    const width = 10;
    const height = 10;
    const potential = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        potential[y * width + x] = x;
      }
    }

    const field = computeFieldVectors(potential, width, height);

    // Interior points should have Ex ≈ -1, Ey ≈ 0
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        expect(field.ex[idx]).toBeCloseTo(-1, 5);
        expect(field.ey[idx]).toBeCloseTo(0, 5);
      }
    }
  });

  it('radial potential → radial E field', () => {
    // V(x,y) = sqrt((x-5)^2 + (y-5)^2), so E points inward
    const width = 11;
    const height = 11;
    const potential = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        potential[y * width + x] = Math.sqrt((x - 5) * (x - 5) + (y - 5) * (y - 5));
      }
    }

    const field = computeFieldVectors(potential, width, height);

    // At (7, 5): E should point in -x direction (toward center)
    const idx = 5 * width + 7;
    expect(field.ex[idx]).toBeLessThan(0); // pointing left (toward center)
    expect(Math.abs(field.ey[idx])).toBeLessThan(0.1); // nearly zero y-component
  });
});
