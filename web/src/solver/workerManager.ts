/**
 * Legacy WorkerManager — superseded by SolveController (Phase 0).
 *
 * Kept for reference. New code should use solveController.ts instead.
 * The SolveController provides: job superseding, warm-start, zero-copy
 * transfers, and decoupled render/solve loops.
 */

import type { FieldConfig, SolveResult, SolverProgress } from '../types/simulation';

export interface SolveOptions {
  mode: 'preview' | 'commit';
  chunkSize?: number;
  onProgress?: (progress: SolverProgress) => void;
}

export class WorkerManager {
  private worker: Worker | null = null;
  private resolvePromise: ((result: SolveResult | null) => void) | null = null;
  private startTime = 0;

  private createWorker(): Worker {
    return new Worker(
      new URL('./solver.worker.ts', import.meta.url),
      { type: 'module' },
    );
  }

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = this.createWorker();
    }
    return this.worker;
  }

  async solve(config: FieldConfig, options: SolveOptions): Promise<SolveResult | null> {
    const worker = this.ensureWorker();
    const chunkSize = options.chunkSize ?? (options.mode === 'preview' ? 50 : 500);

    const wasmConfig = {
      width: config.grid.width,
      height: config.grid.height,
      charges: config.charges.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), q: c.q })),
      boundary: config.boundary.type === 'dirichlet_zero' ? 'zero'
        : config.boundary.type === 'dirichlet_fixed' ? 'fixed'
        : 'neumann',
      boundary_voltages: config.boundary.type === 'dirichlet_fixed'
        ? config.boundary.voltages : undefined,
      engine: config.engine,
      omega: null,
      max_iterations: config.maxIterations,
      tolerance: config.tolerance,
      chunk_size: chunkSize,
    };

    return new Promise<SolveResult | null>((resolve) => {
      this.resolvePromise = resolve;
      this.startTime = performance.now();

      worker.onmessage = (e: MessageEvent) => {
        const msg = e.data;
        switch (msg.type) {
          case 'ready':
            worker.postMessage({ type: 'solve', jobId: 0 });
            break;
          case 'progress':
            options.onProgress?.({ iterations: msg.iterations, residual: msg.residual });
            break;
          case 'result':
            resolve({
              potential: msg.potential,
              width: msg.width,
              height: msg.height,
              iterations: msg.iterations,
              residual: msg.residual,
              converged: msg.converged,
              timeMs: performance.now() - this.startTime,
            });
            break;
          case 'cancelled':
            resolve(null);
            break;
          case 'error':
            console.error('Solver worker error:', msg.message);
            resolve(null);
            break;
        }
      };

      worker.postMessage({
        type: 'init',
        jobId: 0,
        config: JSON.stringify(wasmConfig),
      });
    });
  }

  cancel(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.resolvePromise?.(null);
      this.resolvePromise = null;
    }
  }

  cancelGraceful(): void {
    this.worker?.postMessage({ type: 'cancel' });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
