import type { FieldConfig, SolveResult } from '../types/simulation';

/**
 * TypeScript reference Gauss-Seidel solver.
 * Runs synchronously — used for Phase 1 before WASM worker is ready.
 */
export function solveGaussSeidel(config: FieldConfig): SolveResult {
  const { width, height } = config.grid;
  const potential = new Float32Array(width * height);
  const rhs = new Float32Array(width * height);

  // Set charge density
  for (const charge of config.charges) {
    const ix = Math.round(charge.x);
    const iy = Math.round(charge.y);
    if (ix >= 0 && ix < width && iy >= 0 && iy < height) {
      rhs[iy * width + ix] = -charge.q;
    }
  }

  // Apply initial boundary conditions
  applyBoundary(potential, config.boundary, width, height);

  const t0 = performance.now();
  let iterations = 0;
  let residual = Infinity;
  let converged = false;

  for (let iter = 0; iter < config.maxIterations; iter++) {
    residual = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const old = potential[idx];
        const newVal = 0.25 * (
          potential[idx + 1] +
          potential[idx - 1] +
          potential[(y + 1) * width + x] +
          potential[(y - 1) * width + x] -
          rhs[idx]
        );
        const diff = Math.abs(newVal - old);
        if (diff > residual) residual = diff;
        potential[idx] = newVal;
      }
    }

    applyBoundary(potential, config.boundary, width, height);
    iterations++;

    if (residual < config.tolerance) {
      converged = true;
      break;
    }
  }

  return {
    potential,
    width,
    height,
    iterations,
    residual,
    converged,
    timeMs: performance.now() - t0,
  };
}

function applyBoundary(
  grid: Float32Array,
  bc: FieldConfig['boundary'],
  w: number,
  h: number,
): void {
  switch (bc.type) {
    case 'dirichlet_zero':
      for (let x = 0; x < w; x++) {
        grid[x] = 0;
        grid[(h - 1) * w + x] = 0;
      }
      for (let y = 0; y < h; y++) {
        grid[y * w] = 0;
        grid[y * w + w - 1] = 0;
      }
      break;
    case 'dirichlet_fixed': {
      const [top, right, bottom, left] = bc.voltages;
      for (let x = 0; x < w; x++) {
        grid[x] = top;
        grid[(h - 1) * w + x] = bottom;
      }
      for (let y = 0; y < h; y++) {
        grid[y * w] = left;
        grid[y * w + w - 1] = right;
      }
      break;
    }
    case 'neumann':
      for (let x = 1; x < w - 1; x++) {
        grid[x] = grid[w + x];
        grid[(h - 1) * w + x] = grid[(h - 2) * w + x];
      }
      for (let y = 1; y < h - 1; y++) {
        grid[y * w] = grid[y * w + 1];
        grid[y * w + w - 1] = grid[y * w + w - 2];
      }
      break;
  }
}
